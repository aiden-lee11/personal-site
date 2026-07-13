#!/usr/bin/env node
// Build-time preset precompilation.
//
// For every compiler preset, in TWO configurations (full optimizations = all
// IR passes on, and no optimizations = every pass off), this runs the SAME
// compile chain the /api/compile route runs, links the x86 with the C runtime,
// executes and times the binary, and persists:
//
//   precomputed-presets/<key>/manifest.json   all the stats the UI shows
//                                              (layers, per-stage compile ms,
//                                              total compile ms, real program
//                                              runtime ms, output, exit code)
//   precomputed-presets/<key>/prog_exec        the linked binary the run step
//                                              executes directly (no compile)
//
// It is meant to run in an environment where the stage binaries execute
// natively — i.e. the production image's final stage (see the repo-root
// Dockerfile), so the cached binary is produced by the very compiler that will
// serve requests. When the binaries can't run here (e.g. a dev machine with a
// cross-arch checked-in binary), it skips that preset gracefully and the route
// falls back to live compilation.
//
// The cache key + fingerprint come from ../src/lib/presetCache.mjs, the same
// module the route uses, so generation and lookup can never disagree.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const sharedUrl =
  process.env.PRESET_CACHE_SHARED ||
  new URL("../src/lib/presetCache.mjs", import.meta.url);
const {
  CHAIN,
  SHORT_OUTPUT,
  IR_PASSES,
  CACHEABLE_CONFIGS,
  configId,
  cacheKey,
  cacheDir,
  entryDir,
  manifestPath,
  binaryPath,
  stageBinary,
  compilerFingerprint,
} = await import(sharedUrl.toString());

// --- environment (mirrors compile/route.ts resolution) ----------------------
const COMPILER_BIN_DIR =
  process.env.COMPILER_BIN_DIR ||
  path.resolve(process.cwd(), "..", "compiler-bin");
const RUNTIME_C =
  process.env.COMPILER_RUNTIME_C ||
  path.join(COMPILER_BIN_DIR, "lib", "runtime.c");
const GCC = process.env.COMPILER_GCC || "gcc";
const CONTENT_DIR =
  process.env.PRESET_CONTENT_DIR ||
  path.join(process.cwd(), "content", "compiler-presets");
const OUT_DIR = cacheDir();

// Entry layers the UI actually starts a preset from: LC (top of the tower,
// the default) and LA (the in-browser entry / fallback). We precompute every
// one whose source exists and whose chain runs in this environment.
const ENTRY_LAYERS = ["LC", "LA"];

// Timing knobs — mirror the route so baked numbers match what a live run shows.
const FAST_RUN_US = 100_000;
const RUN_ITERS = 25;

const PRESETS = ["hello", "branch", "fib", "matrix"];

/** Run a command, capped, capturing stdout/stderr + wall time in µs. */
function run(cmd, args, cwd, timeoutMs) {
  const start = performance.now();
  const r = spawnSync(cmd, args, {
    cwd,
    timeout: timeoutMs,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const wallUs = Math.round((performance.now() - start) * 1000);
  return {
    code: r.status ?? (r.signal ? 124 : 1),
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    timedOut: r.signal === "SIGTERM" && r.error?.code === "ETIMEDOUT",
    wallUs,
  };
}

/** True if the whole chain from `fromLayer` is runnable natively here. */
function chainRunnable(fromLayer) {
  if (!fs.existsSync(RUNTIME_C)) return false;
  const fromIdx = CHAIN.indexOf(fromLayer);
  for (let i = fromIdx; i < CHAIN.length - 1; i++) {
    const bin = stageBinary(COMPILER_BIN_DIR, CHAIN[i]);
    if (!bin) return false;
    // Probe once: try to exec with no args; a native binary returns (usually
    // non-zero usage), a cross-arch one fails to exec (ENOENT/EACCES/Exec err).
    const probe = spawnSync(bin, [], { timeout: 10_000 });
    if (probe.error && probe.error.code !== "ETIMEDOUT") return false;
  }
  return true;
}

/**
 * Compile `source` (entering at `fromLayer`) with `disabled` passes turned off,
 * then link + execute. Returns the full stat payload + the path to prog_exec,
 * or { ok:false } if the chain didn't produce x86.
 */
function compileAndRun(workDir, source, fromLayer, disabled) {
  const irExtra = disabled.map((p) => `--no-${p}`);
  fs.writeFileSync(path.join(workDir, `prog.${fromLayer}`), source);

  const layers = {};
  const errors = {};
  const layerMs = {};
  const fromIdx = CHAIN.indexOf(fromLayer);
  const chainStart = performance.now();

  for (let i = fromIdx; i < CHAIN.length - 1; i++) {
    const cur = CHAIN[i];
    if (!fs.existsSync(path.join(workDir, `prog.${cur}`))) continue;
    const bin = stageBinary(COMPILER_BIN_DIR, cur);
    const args = [`prog.${cur}`, "-g", "1", "-O0"];
    if (cur === "IR") args.push(...irExtra);
    const r = run(bin, args, workDir, 60_000);
    layerMs[cur] = Math.round(r.wallUs / 1000);
    if (r.stderr && r.stderr.length > 0) errors[cur] = r.stderr;

    // LC/LB write a short-extension file — rename to the canonical prog.<next>.
    const short = SHORT_OUTPUT[cur];
    if (short) {
      const shortPath = path.join(workDir, short);
      const next = CHAIN[i + 1];
      if (fs.existsSync(shortPath)) {
        fs.renameSync(shortPath, path.join(workDir, `prog.${next}`));
      }
    }
  }

  for (const L of CHAIN) {
    const f = path.join(workDir, `prog.${L}`);
    if (fs.existsSync(f)) layers[L] = fs.readFileSync(f, "utf8");
  }
  const totalMs = Math.round(performance.now() - chainStart);

  const producedBeyond = CHAIN.slice(fromIdx + 1).some((L) => layers[L]);
  if (!producedBeyond || !layers.S) {
    return { ok: false, layers, errors, layerMs, totalMs };
  }

  // Link the produced x86 with the C runtime.
  const rt = run(GCC, ["-O2", "-c", "-g", "-o", "runtime.o", RUNTIME_C], workDir, 60_000);
  const link = run(GCC, ["-no-pie", "-o", "prog_exec", "prog.S", "runtime.o"], workDir, 60_000);
  const execPath = path.join(workDir, "prog_exec");
  if (rt.code !== 0 || link.code !== 0 || !fs.existsSync(execPath)) {
    return {
      ok: false,
      layers,
      errors,
      layerMs,
      totalMs,
      linkError: (rt.stderr + link.stderr) || "link failed",
    };
  }

  // Execute once for output + exit code.
  const cap = run("./prog_exec", [], workDir, 30_000);
  const programOutput = cap.stdout.slice(0, 32 * 1024);
  const runExit = cap.timedOut ? 124 : cap.code;

  // Time it fairly (only if it exited cleanly): warmup, one sample, average
  // fast programs over RUN_ITERS — same policy as the route.
  let runMs;
  if (runExit === 0) {
    run("./prog_exec", [], workDir, 30_000); // warmup, discarded
    const timed = run("./prog_exec", [], workDir, 30_000);
    if (!timed.timedOut && timed.code === 0) {
      let oneUs = timed.wallUs;
      if (oneUs < FAST_RUN_US) {
        const loopStart = performance.now();
        let broke = false;
        for (let k = 0; k < RUN_ITERS; k++) {
          const it = run("./prog_exec", [], workDir, 30_000);
          if (it.timedOut || it.code !== 0) {
            broke = true;
            break;
          }
        }
        if (!broke) {
          oneUs = Math.round(
            ((performance.now() - loopStart) * 1000) / RUN_ITERS,
          );
        }
      }
      runMs = oneUs / 1000;
    }
  }

  return {
    ok: true,
    layers,
    errors,
    layerMs,
    totalMs,
    programOutput,
    runExit,
    runMs,
    execPath,
  };
}

async function main() {
  if (!fs.existsSync(RUNTIME_C)) {
    console.log(
      `[precompile] runtime.c not found at ${RUNTIME_C} — skipping (route falls back to live compile).`,
    );
    return;
  }

  const fingerprint = compilerFingerprint(COMPILER_BIN_DIR, RUNTIME_C);
  console.log(`[precompile] compiler fingerprint ${fingerprint.slice(0, 16)}…`);
  console.log(`[precompile] output -> ${OUT_DIR}`);

  // Fresh cache each build so stale entries never linger.
  await fsp.rm(OUT_DIR, { recursive: true, force: true });
  await fsp.mkdir(OUT_DIR, { recursive: true });

  const runnable = {};
  for (const L of ENTRY_LAYERS) runnable[L] = chainRunnable(L);
  console.log(
    `[precompile] runnable entries: ${ENTRY_LAYERS.filter((L) => runnable[L]).join(", ") || "(none — will skip all)"}`,
  );

  let written = 0;
  const index = [];

  for (const slug of PRESETS) {
    const presetDir = path.join(CONTENT_DIR, slug);
    for (const from of ENTRY_LAYERS) {
      if (!runnable[from]) continue;
      const srcPath = path.join(presetDir, `prog.${from}`);
      if (!fs.existsSync(srcPath)) continue;
      const source = fs.readFileSync(srcPath, "utf8");
      if (!source.trim()) continue;

      for (const [cfg, disabled] of Object.entries(CACHEABLE_CONFIGS)) {
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "precompile-"));
        try {
          const res = compileAndRun(workDir, source, from, disabled);
          if (!res.ok) {
            console.warn(
              `[precompile] ${slug} ${from}/${cfg}: did not produce a runnable binary — skipping (${res.linkError || Object.values(res.errors)[0] || "no x86"})`,
            );
            continue;
          }
          const key = cacheKey(source, from, disabled);
          if (configId(disabled) !== cfg) {
            throw new Error(`config mismatch for ${cfg}`);
          }
          const dir = entryDir(OUT_DIR, key);
          await fsp.mkdir(dir, { recursive: true });
          await fsp.copyFile(res.execPath, binaryPath(OUT_DIR, key));
          await fsp.chmod(binaryPath(OUT_DIR, key), 0o755);

          const manifest = {
            version: 1,
            fingerprint,
            preset: slug,
            fromLayer: from,
            config: cfg,
            disabledPasses: disabled,
            ok: true,
            layers: res.layers,
            errors: res.errors,
            layerMs: res.layerMs,
            totalMs: res.totalMs,
            programOutput: res.programOutput,
            runExit: res.runExit,
            runMs: res.runMs,
            hasBinary: true,
            generatedAt: new Date().toISOString(),
          };
          await fsp.writeFile(
            manifestPath(OUT_DIR, key),
            JSON.stringify(manifest),
          );
          written++;
          index.push({ preset: slug, from, cfg, key, runMs: res.runMs });
          console.log(
            `[precompile] ✓ ${slug} ${from}/${cfg}  compile=${res.totalMs}ms run=${res.runMs?.toFixed(3)}ms  ${key.slice(0, 12)}…`,
          );
        } finally {
          await fsp.rm(workDir, { recursive: true, force: true });
        }
      }
    }
  }

  // A small index + the fingerprint, handy for debugging and for a fast
  // "is the cache present & fresh" check.
  await fsp.writeFile(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify({ fingerprint, generatedAt: new Date().toISOString(), entries: index }, null, 2),
  );

  console.log(`[precompile] wrote ${written} cached (preset, config) artifacts.`);
}

main().catch((e) => {
  // Never fail the build over precompilation: a missing/broken cache just means
  // the route compiles live. (Production correctness is still guaranteed —
  // the route verifies the fingerprint before trusting any artifact.)
  console.warn(`[precompile] skipped due to error: ${e?.message ?? e}`);
  process.exitCode = 0;
});
