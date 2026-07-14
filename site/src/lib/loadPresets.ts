import fs from "node:fs";
import path from "node:path";

export const LAYERS = ["LC", "LB", "LA", "IR", "L3", "L2", "L1", "S"] as const;
export type Layer = (typeof LAYERS)[number];

// LC and LB are lowered by the CS 322 instructor reference binaries (I built
// LA and below); they only run server-side — see /api/compile.
export const SERVER_ONLY_LAYERS: readonly Layer[] = ["LC", "LB"];

export const LAYER_LABEL: Record<Layer, string> = {
  LC: "LC",
  LB: "LB",
  LA: "LA",
  IR: "IR",
  L3: "L3",
  L2: "L2",
  L1: "L1",
  S: "x86-64",
};

export const LAYER_TAGLINE: Record<Layer, string> = {
  LC: "Top of the tower, the most C-like layer: if/else, while, do-while, for, break/continue, nested scopes",
  LB: "Control flow starts naming its targets: if and while jump to explicit labels; scopes and loops remain",
  LA: "Scopes and loops lowered away: straight-line code with conditional br to labels, plus 1-D and n-D array primitives",
  IR: "SSA intermediate representation: φ-nodes, cleaned CFG, where all the optimization passes live",
  L3: "Post-SSA linear IR: three-address ops, calls, memory as loads/stores",
  L2: "Register-abstract IR: infinite virtual regs, right before register allocation",
  L1: "Register-concrete IR: after graph-coloring reg alloc + spilling",
  S: "x86-64 assembly (AT&T syntax): the final artifact your CPU actually runs",
};

export type PresetSlug = "hello" | "branch" | "fib" | "matrix";

export type PresetMeta = {
  slug: PresetSlug;
  title: string;
  blurb: string;
  runtime?: string; // what the program prints
};

export const PRESETS: PresetMeta[] = [
  {
    slug: "hello",
    title: "hello",
    blurb: "Empty main. Shows the minimum you can compile.",
  },
  {
    slug: "branch",
    title: "branch",
    blurb: "Unconditional false branch, trivially prune-able.",
  },
  {
    slug: "fib",
    title: "fib (iterative)",
    blurb: "fib(20) → 6765, repeated 5M× so opt vs unopt runtime is visible.",
  },
  {
    slug: "matrix",
    title: "matrix search",
    blurb: "Nested loops over a 2-D array, exercising the array-materialization pass.",
  },
];

export type PresetLayers = Record<Layer, string>;

const PRESET_ROOT = path.join(process.cwd(), "content", "compiler-presets");

export function loadPreset(slug: PresetSlug): {
  meta: PresetMeta;
  layers: PresetLayers;
} {
  const meta = PRESETS.find((p) => p.slug === slug);
  if (!meta) throw new Error(`Unknown preset: ${slug}`);

  const runtimePath = path.join(PRESET_ROOT, slug, "expected.out");
  const runtime = fs.existsSync(runtimePath)
    ? fs.readFileSync(runtimePath, "utf8").trim()
    : undefined;

  const layers = Object.fromEntries(
    LAYERS.map((L) => {
      const p = path.join(PRESET_ROOT, slug, `prog.${L}`);
      const content = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
      return [L, content];
    }),
  ) as PresetLayers;

  return { meta: { ...meta, runtime }, layers };
}

export function loadAllPresets(): Array<{ meta: PresetMeta; layers: PresetLayers }> {
  return PRESETS.map((p) => loadPreset(p.slug));
}
