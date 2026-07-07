import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

// Every layer in the pipeline. Order matters — index defines fan-out from `fromLayer`.
const CHAIN = ["LA", "IR", "L3", "L2", "L1", "S"] as const;
type Layer = (typeof CHAIN)[number];

// Docker image built from the compiler's own docker-compose.
const IMAGE = "322-cs322";
// Untouched original binaries — read-only mount inside container.
const COMPILER_HOST_DIR =
  process.env.COMPILER_HOST_DIR || `${os.homedir()}/Desktop/northwestern/322`;
// Fork with per-pass flags baked in. Only IR is customized right now.
const COMPILER_FORK_DIR = path.resolve(process.cwd(), "..", "compiler-src");

const MAX_SOURCE_BYTES = 128 * 1024;
const COMPILE_TIMEOUT_MS = 20_000;

// Every IR pass with an --no-<slug> flag exposed by compiler-src/IR/src/compiler.cpp
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
  // When a pass is present with value `false`, we pass --no-<pass> to the IR compiler.
  optFlags?: Partial<Record<IrPass, boolean>>;
};

function isLayer(x: unknown): x is Layer {
  return typeof x === "string" && (CHAIN as readonly string[]).includes(x);
}

function runDocker(
  args: string[],
  script: string,
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (c) => (stdout += c.toString()));
    p.stderr.on("data", (c) => (stderr += c.toString()));
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
    }, timeoutMs);
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    p.stdin.write(script);
    p.stdin.end();
  });
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
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "compile-"));
  const srcName = `prog.${body.fromLayer}`;
  await fs.writeFile(path.join(work, srcName), body.source);

  // Build the CLI flag suffix for the IR compiler based on requested opt toggles.
  const irFlags: string[] = [];
  for (const p of IR_PASSES) {
    if (body.optFlags && body.optFlags[p] === false) {
      irFlags.push(`--no-${p}`);
    }
  }
  const irExtra = irFlags.join(" ");

  // Build a shell script the container runs. Each layer picks up prog.<PREV> and
  // writes prog.<NEXT>; after each step we copy that output into /out for us to
  // read back before the next layer overwrites `prog.<X>` naming again.
  // The IR layer uses our fork binary so per-pass flags (--no-licm, …) work.
  const steps: string[] = [];
  for (let i = fromIdx; i < CHAIN.length - 1; i++) {
    const cur = CHAIN[i];
    const nxt = CHAIN[i + 1];
    if (cur === "S") continue;
    const bin =
      cur === "IR" ? `/fork/IR/bin/IR` : `/workspace/${cur}/bin/${cur}`;
    const extra = cur === "IR" ? ` ${irExtra}` : "";
    steps.push(
      `if [ -f prog.${cur} ]; then ${bin} prog.${cur} -g 1 -O0${extra} 2> /out/${cur}.err && [ -f prog.${nxt} ] && cp prog.${nxt} /out/prog.${nxt}; fi`,
    );
  }
  // Always echo the input layer to /out as well.
  const script = [
    `set +e`,
    `cd /pgen`,
    `cp ${srcName} /out/${srcName}`,
    ...steps,
    `exit 0`,
  ].join("\n");

  const outDir = path.join(work, "out");
  await fs.mkdir(outDir);

  const started = Date.now();
  const args = [
    "run",
    "--rm",
    "-i",
    "--platform",
    "linux/amd64",
    "-v",
    `${COMPILER_HOST_DIR}:/workspace:ro`,
    "-v",
    `${COMPILER_FORK_DIR}:/fork:ro`,
    "-v",
    `${work}:/pgen`,
    "-v",
    `${outDir}:/out`,
    "-w",
    "/pgen",
    IMAGE,
    "bash",
    "-s",
  ];
  const res = await runDocker(args, script, COMPILE_TIMEOUT_MS);
  const totalMs = Date.now() - started;

  const layers: Partial<Record<Layer, string>> = {};
  const errors: Partial<Record<Layer, string>> = {};

  // Read whatever the container produced.
  for (const L of CHAIN) {
    const p = path.join(outDir, `prog.${L}`);
    try {
      const buf = await fs.readFile(p, "utf8");
      layers[L] = buf;
    } catch {
      /* not produced */
    }
    if (L !== "S") {
      const ep = path.join(outDir, `${L}.err`);
      try {
        const e = (await fs.readFile(ep, "utf8")).trim();
        if (e) errors[L] = e;
      } catch {
        /* no error file */
      }
    }
  }

  await fs.rm(work, { recursive: true, force: true }).catch(() => {});

  // Determine the deepest layer that compiled. If none past fromLayer, treat as error.
  const producedBeyond = CHAIN.slice(fromIdx + 1).some((L) => layers[L]);
  if (!producedBeyond) {
    const firstErr = Object.values(errors).find(Boolean) || res.stderr || "compilation failed";
    return NextResponse.json({
      ok: false,
      error: firstErr,
      dockerExit: res.code,
      dockerStderr: res.stderr,
      layers,
      totalMs,
    });
  }

  return NextResponse.json({
    ok: true,
    layers,
    errors,
    totalMs,
  });
}
