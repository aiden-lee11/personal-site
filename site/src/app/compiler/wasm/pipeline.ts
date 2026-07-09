// In-browser compiler pipeline. Chains the five layer wasm modules
// (LA -> IR -> L3 -> L2 -> L1, where L1 emits x86-64 "S" text) entirely
// client-side, mirroring the shape the /api/compile route returns for
// transforms. Designed to run inside a Web Worker.

import type { LayerFactory, LayerModule } from "./layer-modules";

export const CHAIN = ["LA", "IR", "L3", "L2", "L1", "S"] as const;
export type Layer = (typeof CHAIN)[number];

// The layer each step produces (source layer -> output file layer).
const NEXT: Record<string, Layer> = {
  LA: "IR",
  IR: "L3",
  L3: "L2",
  L2: "L1",
  L1: "S",
};

// IR passes, in the order the flags are declared in compiler-src/IR/src/compiler.cpp.
export const IR_PASSES = [
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
export type IrPass = (typeof IR_PASSES)[number];

export type OptFlags = Partial<Record<IrPass, boolean>>;

export type PipelineInput = {
  source: string;
  fromLayer: Layer;
  optFlags?: OptFlags;
};

export type PipelineResult = {
  ok: boolean;
  layers: Partial<Record<Layer, string>>;
  errors: Partial<Record<Layer, string>>;
  layerMs: Partial<Record<Layer, number>>;
  totalMs: number;
  error?: string;
};

// Base URL for the emitted wasm assets in /public/wasm.
function wasmBase(): string {
  const origin =
    typeof self !== "undefined" && self.location ? self.location.origin : "";
  return `${origin}/wasm/`;
}

// `import()` a runtime-computed URL without the bundler trying to resolve it.
// The .js modules live in /public (served statically), not in the bundle.
const dynamicImport = new Function(
  "url",
  "return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);",
) as (url: string) => Promise<{ default: LayerFactory }>;

// Factory cache — the factory is reused, but a FRESH instance is created for
// every layer invocation (repeated callMain on one instance is not safe once
// the runtime has exited).
const factoryCache = new Map<string, LayerFactory>();

async function factoryFor(layer: string): Promise<LayerFactory> {
  const cached = factoryCache.get(layer);
  if (cached) return cached;
  const base = wasmBase();
  const mod = await dynamicImport(`${base}${layer}.js`);
  factoryCache.set(layer, mod.default);
  return mod.default;
}

function irArgs(optFlags: OptFlags | undefined): string[] {
  if (!optFlags) return [];
  const args: string[] = [];
  for (const pass of IR_PASSES) {
    if (optFlags[pass] === false) args.push(`--no-${pass}`);
  }
  return args;
}

type StepResult = { exit: number; out: string | null; stderr: string };

async function runLayer(
  layer: string,
  source: string,
  extraArgs: string[],
): Promise<StepResult> {
  const create = await factoryFor(layer);
  let stderr = "";
  const mod: LayerModule = await create({
    noInitialRun: true,
    print: () => {}, // swallow diagnostic stdout (e.g. IR pass progress)
    printErr: (s: string) => {
      stderr += s + "\n";
    },
    locateFile: (p: string) => `${wasmBase()}${p}`,
  });

  const inName = `prog.${layer}`;
  const outName = `prog.${NEXT[layer]}`;
  mod.FS.writeFile(inName, source);

  let exit = 0;
  try {
    exit = mod.callMain([inName, "-g", "1", "-O0", ...extraArgs]);
  } catch (e) {
    // Emscripten throws ExitStatus on exit(); a non-zero status is a failure.
    const status = (e as { status?: number })?.status;
    if (typeof status === "number") exit = status;
    else throw e;
  }

  let out: string | null = null;
  try {
    if (mod.FS.analyzePath(outName).exists) {
      out = mod.FS.readFile(outName, { encoding: "utf8" });
    }
  } catch {
    out = null;
  }

  return { exit: exit ?? 0, out, stderr };
}

export async function runPipeline(
  input: PipelineInput,
): Promise<PipelineResult> {
  const { source, fromLayer, optFlags } = input;
  const layers: Partial<Record<Layer, string>> = {};
  const errors: Partial<Record<Layer, string>> = {};
  const layerMs: Partial<Record<Layer, number>> = {};

  // The route cats every prog.* including the input layer.
  layers[fromLayer] = source;

  const fromIdx = CHAIN.indexOf(fromLayer);
  const started = performance.now();

  let current = source;
  for (let i = fromIdx; i < CHAIN.length - 1; i++) {
    const cur = CHAIN[i];
    if (cur === "S") break; // S is a sink, never a source
    const extra = cur === "IR" ? irArgs(optFlags) : [];

    const t0 = performance.now();
    let step: StepResult;
    try {
      step = await runLayer(cur, current, extra);
    } catch (e) {
      errors[cur] = (e as Error)?.message ?? "wasm module crashed";
      break;
    }
    layerMs[cur] = Math.round(performance.now() - t0);

    if (step.stderr.trim()) errors[cur] = step.stderr;

    if (step.exit !== 0 || !step.out) {
      // Failed this step — stop; earlier layers remain displayable.
      if (!errors[cur]) errors[cur] = `exited with status ${step.exit}`;
      break;
    }

    const next = NEXT[cur];
    layers[next] = step.out;
    current = step.out;
  }

  const totalMs = Math.round(performance.now() - started);

  // ok mirrors the route: did we produce anything beyond the source layer?
  const producedBeyond = CHAIN.slice(fromIdx + 1).some((L) => layers[L]);

  if (!producedBeyond) {
    const firstErr = Object.values(errors).find(Boolean) || "compilation failed";
    return { ok: false, layers, errors, layerMs, totalMs, error: firstErr };
  }

  return { ok: true, layers, errors, layerMs, totalMs };
}
