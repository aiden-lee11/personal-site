import type { Metadata } from "next";
import { loadAllPresets, LAYERS, LAYER_LABEL, LAYER_TAGLINE } from "@/lib/loadPresets";
import { OPT_EXAMPLES } from "@/data/compiler";
import CompilerVisualizer from "./CompilerVisualizer";

export const metadata: Metadata = {
  title: "Compiler Visualizer · Aiden Lee",
  description:
    "Step-by-step through my 5-stage C++ compiler — LA → IR → L3 → L2 → L1 → x86-64, with IR optimization illustrations.",
};

export default function CompilerPage() {
  const presets = loadAllPresets();

  return (
    <div className="mx-auto max-w-6xl px-6 pt-16 pb-24">
      <header className="mb-12">
        <p className="font-mono text-xs text-[color:var(--muted)] uppercase tracking-wide mb-3">
          Interactive · Aiden&apos;s Compiler
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05] max-w-3xl">
          Watch a C-like program become x86-64,
          <br />
          <span className="text-[color:var(--muted)]">
            one intermediate at a time.
          </span>
        </h1>
        <p className="mt-6 text-[color:var(--muted)] max-w-2xl leading-relaxed">
          Every layer below is real output from the compiler I wrote for Northwestern&apos;s
          CS 322 — the one that won the class competition at{" "}
          <span className="font-mono text-[color:var(--fg)]">536 ms</span>, 18× faster than
          GCC. Pick a preset, then step through the pipeline. The final panel is the exact
          assembly your CPU would run.
        </p>
      </header>

      <CompilerVisualizer
        presets={presets}
        layers={[...LAYERS]}
        layerLabel={LAYER_LABEL}
        layerTagline={LAYER_TAGLINE}
        optExamples={OPT_EXAMPLES}
      />
    </div>
  );
}
