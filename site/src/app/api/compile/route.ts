import { NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import {
  normalizeDisabledPasses,
  configId,
  cacheKey,
  cacheDir,
  binaryPath,
  readManifest,
  compilerFingerprint,
} from "@/lib/presetCache.mjs";

// ---------------------------------------------------------------------------
// ISOLATION MODEL (read before touching this file — it runs untrusted code)
// ---------------------------------------------------------------------------
// This endpoint compiles AND executes arbitrary user-submitted programs. It
// no longer shells out to Docker. The compiler stage binaries + gcc + the C
// runtime are baked into the *app's own* container image (see the repo-root
// Dockerfile) and exec'd directly with child_process.
//
// The deployment target is Railway: a standard shared-infra container, with
// NO per-request microVM. The container is the only isolation boundary, so
// in-container hardening does the real work here:
//
//   * The whole app process runs as a NON-ROOT user (see Dockerfile `USER`),
//     so every compiler stage and the linked program run unprivileged.
//   * Every exec is wrapped in `ulimit` caps (CPU seconds, address space,
//     file size, process count) PLUS a wall-clock `timeout`. A `while(1)`, a
//     huge malloc, or a fork bomb is killed and cannot wedge the box.
//   * Each request gets its own `fs.mkdtemp` working dir, fully self-contained
//     and removed afterwards. There is no shared warm state a bad run can
//     corrupt (unlike the old warm-container design).
//   * Per-IP rate limiting on the run path (see RATE_* below) bounds burst.
//   * Source size, output size, and PID/fork limits are enforced.
//
// RESIDUAL RISK — NETWORK EGRESS: we do NOT cut the executed program's
// network. Cleanly dropping a child's egress needs Linux net-namespace /
// NET_ADMIN capability, which Railway containers do not grant to unprivileged
// processes. Shipping a privileged hack would be worse than documenting the
// gap. A determined user can therefore make raw syscalls (e.g. hand-written
// x86 that opens a socket) and reach the network from inside the container.
// The mitigation is: (a) strict CPU/mem/time/pid caps below, (b) the per-IP
// rate limit, (c) the source-size cap, and (d) Railway's container isolation
// keeping this off the host and off other tenants.
// ---------------------------------------------------------------------------

// Every layer in the pipeline. Order matters — index defines fan-out from
// `fromLayer`. Most stage binaries read prog.<cur> and write prog.<next>:
//   LA -> prog.IR, IR -> prog.L3, L3 -> prog.L2, L2 -> prog.L1, L1 -> prog.S
// EXCEPTION: the LC/LB instructor reference binaries (see compiler-bin/README.md)
// write SHORT extensions — LC emits prog.b (LB code) and LB emits prog.a (LA
// code). We rename those to prog.LB / prog.LA right after each runs (see
// SHORT_OUTPUT below) so the rest of the chain sees the expected names. The
// rest of the stages are Aiden's compiler.
const CHAIN = ["LC", "LB", "LA", "IR", "L3", "L2", "L1", "S"] as const;
type Layer = (typeof CHAIN)[number];

// Stages whose binary writes a short-extension file instead of prog.<next>.
// Renamed to the canonical prog.<next> immediately after the stage runs.
const SHORT_OUTPUT: Partial<Record<Layer, string>> = { LC: "prog.b", LB: "prog.a" };

// Directory containing the stage binaries in `<STAGE>/bin/<STAGE>` layout and
// `lib/runtime.c`. Defaults to the vendored compiler-bin/ bundle (prebuilt
// linux/amd64 artifacts of the private compiler repo). The image sets it
// explicitly to /opt/compiler; on a non-linux dev host the binaries can't exec
// natively, so the Docker/qemu fallback below runs the stages instead.
const COMPILER_BIN_DIR =
  process.env.COMPILER_BIN_DIR ||
  path.resolve(process.cwd(), "..", "compiler-bin");
// C runtime linked into every executed program.
const RUNTIME_C =
  process.env.COMPILER_RUNTIME_C ||
  path.join(COMPILER_BIN_DIR, "lib", "runtime.c");
// gcc used for the link step (and to compile runtime.c). Configurable for odd
// toolchain layouts.
const GCC = process.env.COMPILER_GCC || "gcc";

/** Absolute path to a stage's compiler binary. */
function stageBin(layer: Exclude<Layer, "S">): string {
  return path.join(COMPILER_BIN_DIR, layer, "bin", layer);
}

// ---------------------------------------------------------------------------
// Docker fallback (dev only). Every stage binary in the source tree —
// including the LC/LB instructor binaries — is a linux/amd64 ELF, so on a
// dev machine (e.g. macOS) none of them exec natively. When the native
// stageBin() can't run on this host and Docker is available, run the stage
// inside an ubuntu container instead (qemu emulation — a few seconds per
// stage, fine for local dev). The production image always ships runnable
// native binaries at stageBin(), so this path never triggers there.
// ---------------------------------------------------------------------------

/** The checked-in linux binary for a stage: bin/<L> if present, else .bin/<L>
 *  (where the prebuilt LC/LB instructor ELFs live). */
function checkedInBin(layer: Exclude<Layer, "S">): string | null {
  const built = stageBin(layer);
  if (fs.existsSync(built)) return built;
  const prebuilt = path.join(COMPILER_BIN_DIR, layer, ".bin", layer);
  return fs.existsSync(prebuilt) ? prebuilt : null;
}

/** Can stageBin() exec on THIS host? X_OK alone lies on macOS — a checked-in
 *  linux ELF has +x bits but can't run — so on non-linux hosts an ELF magic
 *  number disqualifies the binary. */
function nativeStageUsable(layer: Exclude<Layer, "S">): boolean {
  const bin = stageBin(layer);
  try {
    fs.accessSync(bin, fs.constants.X_OK);
  } catch {
    return false;
  }
  if (process.platform === "linux") return true;
  try {
    const fd = fs.openSync(bin, "r");
    const magic = Buffer.alloc(4);
    fs.readSync(fd, magic, 0, 4, 0);
    fs.closeSync(fd);
    return !(magic[0] === 0x7f && magic[1] === 0x45 && magic[2] === 0x4c && magic[3] === 0x46);
  } catch {
    return false;
  }
}

// Cached `docker version` probe (also fails when the daemon is down).
// Success is cached forever; failure is re-probed after a short TTL so
// starting Docker Desktop mid-session brings LC/LB back without restarting
// the dev server (a permanently cached false bricked them until restart).
let dockerOk: boolean | null = null;
let dockerProbedAt = 0;
const DOCKER_REPROBE_MS = 30_000;
function dockerAvailable(): boolean {
  if (dockerOk === true) return true;
  if (dockerOk === false && Date.now() - dockerProbedAt < DOCKER_REPROBE_MS) {
    return false;
  }
  try {
    dockerOk =
      spawnSync("docker", ["version"], { stdio: "ignore", timeout: 10_000 })
        .status === 0;
  } catch {
    dockerOk = false;
  }
  dockerProbedAt = Date.now();
  return dockerOk;
}

/** True when the stage should run via docker on this host. */
function dockerStageUsable(layer: Exclude<Layer, "S">): boolean {
  return (
    !nativeStageUsable(layer) &&
    checkedInBin(layer) !== null &&
    dockerAvailable()
  );
}

const MAX_SOURCE_BYTES = 128 * 1024;
// Outer wall-clock ceiling for the whole compile chain. Railway's edge proxy
// must comfortably exceed this; keep programs fast.
const COMPILE_TIMEOUT_MS = 90_000;
// Per-exec wall for the linked program. Needs headroom so unoptimized builds
// can finish and show a real slowdown vs opt.
const RUN_TIMEOUT_MS = 30_000;
const MAX_RUN_OUTPUT_BYTES = 32 * 1024;
// After a discarded warmup, if one timed iter is below this, average more
// iters for a stable runMs; otherwise reuse that single post-warmup sample.
const FAST_RUN_US = 100_000;
const RUN_ITERS = 25;

// ulimit caps (bash `ulimit` units): -t CPU seconds, -v address space (KB),
// -f max file size (1024-byte blocks), -u max user processes (fork bomb guard).
// NOTE on -u: the app runs single-uid, so this bounds ALL processes for that
// uid, node included. It is set well above node's baseline thread count; a
// fork bomb hits the ceiling and is reaped by `timeout`, without room to wedge
// the server. See the isolation note above.
const RUN_LIMITS = "ulimit -t 25 -v 1572864 -f 32768 -u 512 2>/dev/null";
const COMPILE_LIMITS = "ulimit -t 60 -v 3145728 -f 65536 -u 512 2>/dev/null";

// Per-IP rate limit on the run path (in-memory; Railway runs a persistent
// node process so this survives across requests). Small burst — the frontend
// fires up to ~2 runs per user action (opt + baseline).
const RATE_MAX = 12; // requests
const RATE_WINDOW_MS = 15_000; // per window
const rateBuckets = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const hits = (rateBuckets.get(ip) || []).filter((t) => t > cutoff);
  hits.push(now);
  rateBuckets.set(ip, hits);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (rateBuckets.size > 4096) {
    for (const [k, v] of rateBuckets) {
      if (v.every((t) => t <= cutoff)) rateBuckets.delete(k);
    }
  }
  return hits.length > RATE_MAX;
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Every IR pass with an --no-<slug> flag exposed by the IR stage's compiler.cpp
// (private compiler repo, site-fork branch)
const IR_PASSES = [
  "licm",
  "dce",
  "sccp",
  "gvn",
  "copy-prop",
  "peephole",
  "vra-bce",
  "simplify-cfg",
  "algebra",
  "cmov-synth",
  "loop-dse",
] as const;
type IrPass = (typeof IR_PASSES)[number];

type Body = {
  source: string;
  fromLayer: Layer;
  optFlags?: Partial<Record<IrPass, boolean>>;
  // If true, link the produced x86 with the C runtime and actually execute it
  // (bounded by RUN_TIMEOUT_MS). Response includes programOutput/runMs/runExit.
  run?: boolean;
};

function isLayer(x: unknown): x is Layer {
  return typeof x === "string" && (CHAIN as readonly string[]).includes(x);
}

/**
 * Run a shell command in `cwd` with a wall-clock backstop. Returns exit code,
 * captured stdout/stderr (each capped), timed-out flag, and wall time in µs.
 * Commands are our own templates over a fixed allowlist — user source never
 * reaches the shell (it is written to a file), so there is no injection here.
 */
function sh(
  command: string,
  cwd: string,
  timeoutMs: number,
  outCap = MAX_RUN_OUTPUT_BYTES,
  // `group`: run in its own process group and SIGKILL the WHOLE group on
  // timeout AND after exit. This reaps any children a program forked and
  // detached (e.g. a fork bomb delivered via hand-written L1/asm) — `timeout`
  // alone only kills its direct child, leaving orphans that would sit at the
  // `-u` ceiling. Used for executing untrusted programs.
  group = false,
): Promise<{
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  wallUs: number;
}> {
  return new Promise((resolve) => {
    // performance.now() gives sub-ms (µs-grade) resolution without BigInt
    // literals (tsconfig targets ES2017).
    const start = performance.now();
    const p = spawn("bash", ["-c", command], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      detached: group, // new process group so we can kill the whole tree
    });
    const killGroup = (sig: NodeJS.Signals) => {
      try {
        if (group && p.pid) process.kill(-p.pid, sig);
        else p.kill(sig);
      } catch {
        /* already gone */
      }
    };
    let stdout = "";
    let stderr = "";
    let outBytes = 0;
    let timedOut = false;
    p.stdout.on("data", (c: Buffer) => {
      if (outBytes < outCap) {
        stdout += c.toString();
        outBytes += c.length;
        if (stdout.length > outCap) stdout = stdout.slice(0, outCap);
      }
    });
    p.stderr.on("data", (c: Buffer) => {
      if (stderr.length < outCap) stderr += c.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup("SIGKILL");
    }, timeoutMs);
    p.on("close", (code) => {
      clearTimeout(timer);
      // Sweep: reap any lingering group members even on a clean exit (a program
      // may fork-and-detach then return 0). No-op if nothing is left.
      if (group) killGroup("SIGKILL");
      const wallUs = Math.round((performance.now() - start) * 1000);
      resolve({ code: code ?? 1, stdout, stderr, timedOut, wallUs });
    });
    p.on("error", () => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr, timedOut, wallUs: 0 });
    });
  });
}

/** True if the toolchain + all stage binaries needed from `fromIdx` can run —
 *  natively, or (dev only) via the docker fallback. */
function runtimeAvailable(fromIdx: number): boolean {
  if (!fs.existsSync(RUNTIME_C)) return false;
  for (let i = fromIdx; i < CHAIN.length - 1; i++) {
    const cur = CHAIN[i] as Exclude<Layer, "S">;
    if (!nativeStageUsable(cur) && !dockerStageUsable(cur)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Precompiled-preset cache. The 4 playground presets are precompiled at BUILD
// time (scripts/precompile-presets.mjs, run inside the production image against
// the shipped stage binaries) in two configs — full opts / no opts. A request
// whose source + normalized opt flags hash to a cached (preset, config) is
// answered with the baked stats and, for a run, by executing the PREBUILT
// binary directly — no compile chain in the path.
//
// Staleness is structurally impossible: each artifact records a fingerprint of
// the exact compiler (content hash of every stage binary + runtime.c). The
// route recomputes that fingerprint once (memoized) and ignores any artifact
// that doesn't match, falling straight through to live compilation. So a cache
// left over from a different compiler/arch (e.g. a dev machine) is never
// trusted.
// ---------------------------------------------------------------------------
let cachedFingerprint: string | null = null;
function currentFingerprint(): string {
  if (cachedFingerprint === null) {
    cachedFingerprint = compilerFingerprint(COMPILER_BIN_DIR, RUNTIME_C);
  }
  return cachedFingerprint;
}

type CachedManifest = {
  fingerprint: string;
  ok: boolean;
  layers: Partial<Record<Layer, string>>;
  errors: Partial<Record<Layer, string>>;
  layerMs: Partial<Record<Layer, number>>;
  totalMs: number;
  programOutput?: string;
  runExit?: number;
  runMs?: number;
};

/**
 * Try to answer `body` from the precompiled cache. Returns the JSON payload on
 * a hit (fingerprint-verified), or null to fall through to live compilation.
 * Only the two precomputed configs (all opts on / all opts off) can hit; any
 * custom pass subset returns null immediately.
 */
async function serveFromCache(body: Body): Promise<object | null> {
  const disabled = normalizeDisabledPasses(body.optFlags);
  if (configId(disabled) === "custom") return null;

  const dir = cacheDir();
  const key = cacheKey(body.source, body.fromLayer, disabled);
  const manifest = readManifest(dir, key) as CachedManifest | null;
  if (!manifest || !manifest.ok) return null;
  if (manifest.fingerprint !== currentFingerprint()) return null; // stale — recompile

  // Transform-only request: hand back the baked stats, zero compile work.
  if (!body.run) {
    return {
      ok: true,
      layers: manifest.layers,
      errors: manifest.errors,
      totalMs: manifest.totalMs,
      layerMs: manifest.layerMs,
      cached: true,
    };
  }

  // Run request: execute the PREBUILT binary directly (no compile). Program
  // runtime (runMs) uses the build-time measured value — stable and never null.
  const bin = binaryPath(dir, key);
  let programOutput = manifest.programOutput;
  let runExit = manifest.runExit;
  if (fs.existsSync(bin)) {
    const runDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cachedrun-"));
    try {
      await fsp.copyFile(bin, path.join(runDir, "prog_exec"));
      await fsp.chmod(path.join(runDir, "prog_exec"), 0o755);
      const runSecs = Math.ceil(RUN_TIMEOUT_MS / 1000);
      const cap = await sh(
        `${RUN_LIMITS}; exec timeout ${runSecs}s ./prog_exec 2>&1`,
        runDir,
        RUN_TIMEOUT_MS + 5_000,
        MAX_RUN_OUTPUT_BYTES,
        true, // own process group; sweep-kill any forked children
      );
      // Only trust a clean exec; otherwise keep the baked output/exit.
      if (!cap.timedOut) {
        programOutput = cap.stdout;
        runExit = cap.code;
      }
    } catch {
      /* fall back to baked programOutput/runExit */
    } finally {
      fsp.rm(runDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return {
    ok: true,
    layers: manifest.layers,
    errors: manifest.errors,
    totalMs: manifest.totalMs,
    layerMs: manifest.layerMs,
    programOutput,
    runExit,
    runMs: manifest.runMs,
    cached: true,
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  if (typeof body.source !== "string" || !body.source.trim()) {
    return NextResponse.json({ ok: false, error: "source is required" }, { status: 400 });
  }
  if (body.source.length > MAX_SOURCE_BYTES) {
    return NextResponse.json(
      { ok: false, error: `source > ${MAX_SOURCE_BYTES} bytes` },
      { status: 413 },
    );
  }
  if (!isLayer(body.fromLayer) || body.fromLayer === "S") {
    return NextResponse.json({ ok: false, error: "invalid fromLayer" }, { status: 400 });
  }

  const fromIdx = CHAIN.indexOf(body.fromLayer);

  // Graceful degradation: if the compiler binaries / runtime aren't present
  // (e.g. a static/dev deploy without the image), return a 503 with a shape
  // the frontend already handles (no programOutput/runMs -> it shows
  // "program execution requires the server runtime" and keeps the transform
  // view working).
  if (!runtimeAvailable(fromIdx)) {
    return NextResponse.json(
      { ok: false, error: "compiler runtime unavailable on this deployment" },
      { status: 503 },
    );
  }

  // Per-IP rate limit on the run path only (all live-run traffic hits this).
  if (body.run && rateLimited(clientIp(req))) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate limited",
        linkError: "rate limited: too many runs, slow down and retry",
      },
      { status: 429 },
    );
  }

  // Fast path: a precompiled preset (source + full/none opts) is served from
  // the build-time cache with zero compile work. Misses (edited source, custom
  // pass subset, stale fingerprint) fall through to the live chain below.
  try {
    const cached = await serveFromCache(body);
    if (cached) return NextResponse.json(cached);
  } catch {
    /* any cache error -> live compile */
  }

  const irFlags: string[] = [];
  for (const p of IR_PASSES) {
    if (body.optFlags && body.optFlags[p] === false) irFlags.push(`--no-${p}`);
  }
  const irExtra = irFlags.join(" ");

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "compile-"));
  const started = Date.now();

  try {
    // Write the source as prog.<fromLayer>. Written to a file (never the
    // shell), so user input cannot inject shell commands.
    await fsp.writeFile(path.join(workDir, `prog.${body.fromLayer}`), body.source);

    const layers: Partial<Record<Layer, string>> = {};
    const errors: Partial<Record<Layer, string>> = {};
    const layerMs: Partial<Record<Layer, number>> = {};

    // Compile chain: run each stage's binary directly. Errors -> <cur>.err,
    // stdout discarded. Wall-clock per stage keyed by the SOURCE layer.
    const deadline = started + COMPILE_TIMEOUT_MS;
    for (let i = fromIdx; i < CHAIN.length - 1; i++) {
      const cur = CHAIN[i] as Exclude<Layer, "S">;
      if (!fs.existsSync(path.join(workDir, `prog.${cur}`))) continue;
      const extra = cur === "IR" && irExtra ? ` ${irExtra}` : "";
      // Dev-only docker path (see dockerStageUsable above). The container
      // mounts workDir as /w, so outputs (including LC/LB's prog.b / prog.a)
      // land in workDir and the SHORT_OUTPUT rename below applies unchanged.
      // No ulimit prefix — the container bounds the process, and this path
      // never runs in production. realpathSync because macOS mkdtemp dirs
      // live under symlinked /var/folders → /private/var/folders.
      const dockerBin = dockerStageUsable(cur) ? checkedInBin(cur) : null;
      const cmd = dockerBin
        ? `docker run --rm --platform linux/amd64 -v '${fs.realpathSync(workDir)}':/w -v '${COMPILER_BIN_DIR}':/cs -w /w ubuntu:24.04 '/cs/${path.relative(COMPILER_BIN_DIR, dockerBin)}' 'prog.${cur}' -g 1 -O0${extra} > /dev/null 2> '${cur}.err'`
        : `${COMPILE_LIMITS}; exec '${stageBin(cur)}' 'prog.${cur}' -g 1 -O0${extra} > /dev/null 2> '${cur}.err'`;
      const remaining = Math.max(1, deadline - Date.now());
      const r = await sh(cmd, workDir, remaining);
      layerMs[cur] = Math.round(r.wallUs / 1000);

      // LC/LB write a short-extension file — rename it to the canonical
      // prog.<next> the next stage (and the collection loop below) expects.
      const short = SHORT_OUTPUT[cur];
      if (short) {
        const shortPath = path.join(workDir, short);
        const next = CHAIN[i + 1];
        if (fs.existsSync(shortPath)) {
          await fsp.rename(shortPath, path.join(workDir, `prog.${next}`));
        }
      }
    }

    // Collect produced layer files + per-layer error output.
    for (const L of CHAIN) {
      const f = path.join(workDir, `prog.${L}`);
      if (fs.existsSync(f)) layers[L] = await fsp.readFile(f, "utf8");
    }
    for (const L of CHAIN.slice(0, -1)) {
      const f = path.join(workDir, `${L}.err`);
      if (fs.existsSync(f)) {
        const txt = await fsp.readFile(f, "utf8");
        if (txt.length > 0) errors[L] = txt;
      }
    }

    // Link + run the produced x86 when requested.
    let programOutput: string | undefined;
    let runExit: number | undefined;
    let runMs: number | undefined;
    let linkError: string | undefined;

    if (body.run && layers.S) {
      const runSecs = Math.ceil(RUN_TIMEOUT_MS / 1000);
      // Compile runtime + link. Both diagnostics land in gcc.err.
      const link = await sh(
        `${COMPILE_LIMITS}; ${GCC} -O2 -c -g -o runtime.o '${RUNTIME_C}' > gcc.err 2>&1 && ${GCC} -no-pie -o prog_exec prog.S runtime.o >> gcc.err 2>&1`,
        workDir,
        Math.max(1, deadline - Date.now()),
      );
      const execPath = path.join(workDir, "prog_exec");
      if (link.code === 0 && fs.existsSync(execPath)) {
        const runCapture = `${RUN_LIMITS}; exec timeout ${runSecs}s ./prog_exec 2>&1`;
        const runSilent = `${RUN_LIMITS}; exec timeout ${runSecs}s ./prog_exec > /dev/null 2>&1`;

        // 1) Capture stdout + exit code once (timeout -> 124).
        const cap = await sh(
          runCapture,
          workDir,
          RUN_TIMEOUT_MS + 5_000,
          MAX_RUN_OUTPUT_BYTES,
          true, // run in own process group; sweep-kill any forked children
        );
        programOutput = cap.stdout;
        runExit = cap.timedOut ? 124 : cap.code;

        // 2) Time it fairly: discard one warmup, take one timed sample; if the
        //    program is fast, average RUN_ITERS runs; else reuse the sample.
        //    Only time programs that exited cleanly — timing a crashed or
        //    resource-capped (e.g. CPU-ulimit-killed) run is meaningless and
        //    would re-run a runaway twice more, so we skip it entirely.
        if (runExit === 0) {
          await sh(runSilent, workDir, RUN_TIMEOUT_MS + 5_000, MAX_RUN_OUTPUT_BYTES, true); // warmup, discarded
          const timed = await sh(runSilent, workDir, RUN_TIMEOUT_MS + 5_000, MAX_RUN_OUTPUT_BYTES, true);
          if (!timed.timedOut && timed.code !== 124) {
            let oneUs = timed.wallUs;
            if (oneUs < FAST_RUN_US) {
              const loopStart = performance.now();
              let broke = false;
              for (let k = 0; k < RUN_ITERS; k++) {
                const it = await sh(runSilent, workDir, RUN_TIMEOUT_MS + 5_000, MAX_RUN_OUTPUT_BYTES, true);
                if (it.timedOut || it.code === 124 || it.code !== 0) {
                  broke = true;
                  break;
                }
              }
              if (!broke) {
                const totalUs = Math.round((performance.now() - loopStart) * 1000);
                oneUs = Math.round(totalUs / RUN_ITERS);
              }
            }
            runMs = oneUs / 1000; // µs -> fractional ms
          }
        }
      } else {
        const gccErrPath = path.join(workDir, "gcc.err");
        linkError = fs.existsSync(gccErrPath)
          ? await fsp.readFile(gccErrPath, "utf8")
          : "link failed";
      }
    }

    const totalMs = Date.now() - started;

    const producedBeyond = CHAIN.slice(fromIdx + 1).some((L) => layers[L]);
    if (!producedBeyond) {
      const firstErr =
        Object.values(errors).find(Boolean) || "compilation failed";
      return NextResponse.json({ ok: false, error: firstErr, layers, totalMs });
    }

    return NextResponse.json({
      ok: true,
      layers,
      errors,
      totalMs,
      layerMs,
      programOutput,
      runExit,
      runMs,
      linkError,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `compile failed: ${(e as Error).message}` },
      { status: 500 },
    );
  } finally {
    // Always clean up the isolated working dir.
    fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
