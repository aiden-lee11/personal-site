import type { Metadata } from "next";
import { loadAllPresets, LAYERS, LAYER_LABEL, LAYER_TAGLINE } from "@/lib/loadPresets";
import CompilerVisualizer from "./CompilerVisualizer";

export const metadata: Metadata = {
  title: "Compiler Playground · Aiden Lee",
  description:
    "Write code and step through my 5-stage C++ compiler — LA → IR → L3 → L2 → L1 → x86-64 — with live pass toggles and optimized-vs-unoptimized diffs.",
};

export default function CompilerPlaygroundPage() {
  const presets = loadAllPresets();

  return (
    <div>
      <header className="mb-12">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
          Playground
        </h1>
        <p className="mt-4 text-[color:var(--muted)] max-w-2xl leading-relaxed">
          Pick a preset or write your own code, then step through the pipeline.
          Every layer is real output from the compiler, running in your browser
          as WebAssembly. The final panel is the exact assembly your CPU would run.
        </p>
      </header>

      <CompilerVisualizer
        presets={presets}
        layers={[...LAYERS]}
        layerLabel={LAYER_LABEL}
        layerTagline={LAYER_TAGLINE}
      />
    </div>
  );
}
