import { NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";

// Every layer in the pipeline. Order matters — index defines fan-out from `fromLayer`.
const CHAIN = ["LA", "IR", "L3", "L2", "L1", "S"] as const;
type Layer = (typeof CHAIN)[number];

// Docker image built from the compiler's own docker-compose.
const IMAGE = "322-cs322";
// Untouched original binaries — read-only mount inside the warm container.
const COMPILER_HOST_DIR =
  process.env.COMPILER_HOST_DIR || `${os.homedir()}/Desktop/northwestern/322`;
// Fork with per-pass flags baked in (IR only, right now).
const COMPILER_FORK_DIR = path.resolve(process.cwd(), "..", "compiler-src");

// Name of the persistent container. Reused across requests so we pay the QEMU
// startup cost once instead of on every compile.
const WARM_NAME = "aiden-compiler-warm";

const MAX_SOURCE_BYTES = 128 * 1024;
const COMPILE_TIMEOUT_MS = 20_000;
const RUN_TIMEOUT_MS = 5_000;
const MAX_RUN_OUTPUT_BYTES = 32 * 1024;

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
  optFlags?: Partial<Record<IrPass, boolean>>;
  // If true, link the produced x86 with the C runtime and actually execute it
  // (bounded by RUN_TIMEOUT_MS). Response includes programOutput/runMs/runExit.
  run?: boolean;
};

function isLayer(x: unknown): x is Layer {
  return typeof x === "string" && (CHAIN as readonly string[]).includes(x);
}

/** Whether a container with the given name is currently running. */
function containerRunning(name: string): boolean {
  try {
    const out = execFileSync("docker", ["ps", "-q", "-f", `name=^/${name}$`], {
      encoding: "utf8",
    }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

/** Guarantee `WARM_NAME` is running; start it detached if not. */
function ensureWarmContainer(): void {
  if (containerRunning(WARM_NAME)) return;
  // Remove any stopped container by the same name so `run` doesn't collide.
  try {
    execFileSync("docker", ["rm", "-f", WARM_NAME], { stdio: "ignore" });
  } catch {
    /* fine if nothing to remove */
  }
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--platform",
      "linux/amd64",
      "--name",
      WARM_NAME,
      "-v",
      `${COMPILER_HOST_DIR}:/workspace:ro`,
      "-v",
      `${COMPILER_FORK_DIR}:/fork:ro`,
      IMAGE,
      "sleep",
      "infinity",
    ],
    { stdio: "ignore" },
  );
}

function execIn(
  script: string,
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn("docker", ["exec", "-i", WARM_NAME, "bash", "-s"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (c) => (stdout += c.toString()));
    p.stderr.on("data", (c) => (stderr += c.toString()));
    const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    p.stdin.write(script);
    p.stdin.end();
  });
}

/**
 * Parse `___LAYER_START___<L>___\n<body>\n___LAYER_END___<L>___` blocks out of
 * the container script's stdout. Each layer appears at most once.
 */
function parseBlocks(
  stdout: string,
  prefix: string,
): Partial<Record<Layer, string>> {
  const out: Partial<Record<Layer, string>> = {};
  const re = new RegExp(
    `___${prefix}_START___(LA|IR|L3|L2|L1|S)___\\n([\\s\\S]*?)\\n___${prefix}_END___\\1___`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(stdout)) !== null) {
    out[m[1] as Layer] = m[2];
  }
  return out;
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

  try {
    ensureWarmContainer();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `docker not available: ${(e as Error).message}` },
      { status: 503 },
    );
  }

  const fromIdx = CHAIN.indexOf(body.fromLayer);
  const reqId = crypto.randomBytes(6).toString("hex");
  const workDir = `/tmp/req_${reqId}`;
  const srcName = `prog.${body.fromLayer}`;

  const irFlags: string[] = [];
  for (const p of IR_PASSES) {
    if (body.optFlags && body.optFlags[p] === false) irFlags.push(`--no-${p}`);
  }
  const irExtra = irFlags.join(" ");

  // Per-layer commands. Errors go to $D/<layer>.err so we can surface them.
  const steps: string[] = [];
  for (let i = fromIdx; i < CHAIN.length - 1; i++) {
    const cur = CHAIN[i];
    const nxt = CHAIN[i + 1];
    if (cur === "S") continue;
    const bin =
      cur === "IR" ? `/fork/IR/bin/IR` : `/workspace/${cur}/bin/${cur}`;
    const extra = cur === "IR" ? ` ${irExtra}` : "";
    steps.push(
      `[ -f prog.${cur} ] && ${bin} prog.${cur} -g 1 -O0${extra} > /dev/null 2> ${cur}.err`,
    );
  }

  const srcB64 = Buffer.from(body.source, "utf8").toString("base64");

  const runBlock = body.run
    ? `
if [ -f prog.S ]; then
  gcc -O2 -c -g -o runtime.o /fork/lib/runtime.c > gcc.err 2>&1
  gcc -no-pie -o prog_exec prog.S runtime.o >> gcc.err 2>&1
  if [ -x prog_exec ]; then
    echo "___RUN_START___go___"
    timeout ${Math.ceil(RUN_TIMEOUT_MS / 1000)}s ./prog_exec 2>&1 | head -c ${MAX_RUN_OUTPUT_BYTES}
    echo
    echo "___RUN_EXIT___go___$?___"
    echo "___RUN_END___go___"
  else
    echo "___LINK_ERROR_START___go___"
    cat gcc.err
    echo "___LINK_ERROR_END___go___"
  fi
fi
`
    : "";

  const script = `
set +e
D=${JSON.stringify(workDir)}
mkdir -p "$D"
cd "$D"
echo "${srcB64}" | base64 -d > ${srcName}
${steps.join("\n")}
for L in LA IR L3 L2 L1 S; do
  if [ -f "prog.$L" ]; then
    echo "___LAYER_START___${"${L}"}___"
    cat "prog.$L"
    echo
    echo "___LAYER_END___${"${L}"}___"
  fi
done
for L in LA IR L3 L2 L1; do
  if [ -s "$L.err" ]; then
    echo "___ERROR_START___${"${L}"}___"
    cat "$L.err"
    echo
    echo "___ERROR_END___${"${L}"}___"
  fi
done
${runBlock}
cd /
rm -rf "$D"
exit 0
`;

  const started = Date.now();
  const res = await execIn(script, COMPILE_TIMEOUT_MS);
  const totalMs = Date.now() - started;

  const layers = parseBlocks(res.stdout, "LAYER");
  const errors = parseBlocks(res.stdout, "ERROR");

  // Extract the runtime output if body.run was set. Also captures link errors
  // (uncompilable assembly, missing runtime symbols) and the program exit code.
  let programOutput: string | undefined;
  let runExit: number | undefined;
  let linkError: string | undefined;
  const runMatch = res.stdout.match(
    /___RUN_START___go___\n([\s\S]*?)\n___RUN_EXIT___go___(\d+)___\n___RUN_END___go___/,
  );
  if (runMatch) {
    programOutput = runMatch[1];
    runExit = parseInt(runMatch[2], 10);
  } else {
    const linkMatch = res.stdout.match(
      /___LINK_ERROR_START___go___\n([\s\S]*?)\n___LINK_ERROR_END___go___/,
    );
    if (linkMatch) linkError = linkMatch[1];
  }

  const producedBeyond = CHAIN.slice(fromIdx + 1).some((L) => layers[L]);
  if (!producedBeyond) {
    const firstErr =
      Object.values(errors).find(Boolean) || res.stderr || "compilation failed";
    return NextResponse.json({
      ok: false,
      error: firstErr,
      dockerExit: res.code,
      dockerStderr: res.stderr.slice(0, 1000),
      layers,
      totalMs,
    });
  }

  return NextResponse.json({
    ok: true,
    layers,
    errors,
    totalMs,
    programOutput,
    runExit,
    linkError,
  });
}
