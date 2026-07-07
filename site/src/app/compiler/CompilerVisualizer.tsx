"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Layer, PresetLayers, PresetMeta } from "@/lib/loadPresets";
import type { OptExample } from "@/data/compiler";

type PresetBundle = { meta: PresetMeta; layers: PresetLayers };

type Props = {
  presets: PresetBundle[];
  layers: Layer[];
  layerLabel: Record<Layer, string>;
  layerTagline: Record<Layer, string>;
  optExamples: OptExample[];
};

export default function CompilerVisualizer({
  presets,
  layers,
  layerLabel,
  layerTagline,
  optExamples,
}: Props) {
  const [presetSlug, setPresetSlug] = useState(presets[2]?.meta.slug ?? presets[0].meta.slug); // default = fib
  const [layerIdx, setLayerIdx] = useState(0);

  const preset = useMemo(
    () => presets.find((p) => p.meta.slug === presetSlug) ?? presets[0],
    [presetSlug, presets],
  );
  const currentLayer = layers[layerIdx];
  const code = preset.layers[currentLayer] || "";

  const next = useCallback(
    () => setLayerIdx((i) => Math.min(i + 1, layers.length - 1)),
    [layers.length],
  );
  const prev = useCallback(() => setLayerIdx((i) => Math.max(i - 1, 0)), []);

  return (
    <div className="space-y-16">
      {/* Preset picker */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            01 · Pick a program
          </h2>
          <span className="font-mono text-xs text-[color:var(--muted)]">
            {presets.length} presets
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map((p) => {
            const active = p.meta.slug === presetSlug;
            return (
              <button
                key={p.meta.slug}
                onClick={() => {
                  setPresetSlug(p.meta.slug);
                  setLayerIdx(0);
                }}
                className={`text-left rounded-lg border p-4 transition-all ${
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--subtle)]"
                    : "border-[color:var(--border)] hover:border-[color:var(--fg)]"
                }`}
              >
                <div className="font-mono text-xs mb-1 flex items-center gap-2">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      active ? "bg-[color:var(--accent)]" : "bg-[color:var(--border)]"
                    }`}
                  />
                  {p.meta.title}
                </div>
                <div className="text-xs text-[color:var(--muted)] leading-snug">
                  {p.meta.blurb}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pipeline */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            02 · Step through the pipeline
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={layerIdx === 0}
              className="font-mono text-xs px-3 py-1.5 rounded border border-[color:var(--border)] hover:border-[color:var(--fg)] disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous layer"
            >
              ← prev
            </button>
            <button
              onClick={next}
              disabled={layerIdx === layers.length - 1}
              className="font-mono text-xs px-3 py-1.5 rounded border border-[color:var(--border)] hover:border-[color:var(--fg)] disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next layer"
            >
              next →
            </button>
          </div>
        </div>

        {/* Layer stepper */}
        <div className="mb-6">
          <div className="grid grid-cols-6 gap-1">
            {layers.map((L, i) => {
              const active = i === layerIdx;
              const visited = i <= layerIdx;
              return (
                <button
                  key={L}
                  onClick={() => setLayerIdx(i)}
                  className="group flex flex-col items-start"
                  aria-label={`Show ${layerLabel[L]}`}
                >
                  <div
                    className={`h-[3px] w-full mb-2 transition-all ${
                      active
                        ? "bg-[color:var(--accent)]"
                        : visited
                          ? "bg-[color:var(--fg)]"
                          : "bg-[color:var(--border)]"
                    }`}
                  />
                  <span
                    className={`font-mono text-[11px] uppercase tracking-widest transition-colors ${
                      active
                        ? "text-[color:var(--accent)]"
                        : visited
                          ? "text-[color:var(--fg)]"
                          : "text-[color:var(--muted)] group-hover:text-[color:var(--fg)]"
                    }`}
                  >
                    {layerLabel[L]}
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--muted)] mt-0.5 tabular">
                    {i === layers.length - 1 ? "final" : `stage ${i + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Layer viewer */}
        <div className="grid lg:grid-cols-[1fr_18rem] gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${presetSlug}-${currentLayer}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="min-w-0"
            >
              <div className="rounded-lg border border-[color:var(--border)] overflow-hidden">
                <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--subtle)] px-4 py-2">
                  <span className="font-mono text-xs text-[color:var(--muted)]">
                    prog.{currentLayer}
                  </span>
                  <span className="font-mono text-xs text-[color:var(--muted)] tabular">
                    {code.split("\n").length} lines · {code.length.toLocaleString()} chars
                  </span>
                </div>
                <pre className="code-pane max-h-[70vh] rounded-none border-0">
                  <code>{code || "(no output produced at this layer)"}</code>
                </pre>
              </div>
            </motion.div>
          </AnimatePresence>

          <aside className="space-y-4">
            <div className="rounded-lg border border-[color:var(--border)] p-4">
              <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--muted)] mb-1">
                Current layer
              </p>
              <p className="font-serif text-2xl leading-tight mb-2">
                {layerLabel[currentLayer]}
              </p>
              <p className="text-sm text-[color:var(--muted)] leading-relaxed">
                {layerTagline[currentLayer]}
              </p>
            </div>
            {preset.meta.runtime && layerIdx === layers.length - 1 && (
              <div className="rounded-lg border border-[color:var(--accent)] p-4 bg-[color:var(--subtle)]">
                <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--accent)] mb-2">
                  Expected runtime output
                </p>
                <pre className="font-mono text-xs whitespace-pre-wrap break-words">
                  {preset.meta.runtime}
                </pre>
              </div>
            )}
            <div className="rounded-lg border border-[color:var(--border)] p-4 text-xs text-[color:var(--muted)] leading-relaxed">
              <p>
                Every layer above is <em>real output</em> from the compiler binary, captured
                on this preset with <code className="font-mono">-O0 -g 1</code>.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* IR optimizations */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            03 · IR optimizations
          </h2>
        </div>
        <p className="text-[color:var(--muted)] max-w-2xl mb-8">
          The IR stage is where every optimization pass lives. Below are canonical
          illustrations of three of them — the same transformations my compiler performs on
          the real IR you saw above. Toggle each to see the before / after.
        </p>
        <OptGallery examples={optExamples} />
      </section>
    </div>
  );
}

function OptGallery({ examples }: { examples: OptExample[] }) {
  const [activeId, setActiveId] = useState<OptExample["id"]>(examples[0]?.id ?? "licm");
  const [showAfter, setShowAfter] = useState(false);
  const active = examples.find((e) => e.id === activeId) ?? examples[0];

  return (
    <div className="grid lg:grid-cols-[16rem_1fr] gap-6">
      <nav className="space-y-2">
        {examples.map((e) => {
          const isActive = e.id === activeId;
          return (
            <button
              key={e.id}
              onClick={() => {
                setActiveId(e.id);
                setShowAfter(false);
              }}
              className={`w-full text-left rounded-lg border p-3 transition-all ${
                isActive
                  ? "border-[color:var(--accent)] bg-[color:var(--subtle)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--fg)]"
              }`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className={`font-mono text-xs ${
                    isActive ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  {e.name}
                </span>
                <span className="font-mono text-[10px] text-[color:var(--muted)]">
                  · pass
                </span>
              </div>
              <div className="text-sm">{e.fullName}</div>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-6 mb-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-serif text-2xl leading-tight">{active.fullName}</p>
            <p className="text-[color:var(--muted)] mt-1">{active.tagline}</p>
          </div>
          <div
            className="inline-flex items-center rounded-full border border-[color:var(--border)] p-0.5 font-mono text-xs"
            role="tablist"
            aria-label="Before/After toggle"
          >
            <button
              role="tab"
              aria-selected={!showAfter}
              onClick={() => setShowAfter(false)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                !showAfter ? "bg-[color:var(--fg)] text-[color:var(--bg)]" : "text-[color:var(--muted)]"
              }`}
            >
              before
            </button>
            <button
              role="tab"
              aria-selected={showAfter}
              onClick={() => setShowAfter(true)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                showAfter ? "bg-[color:var(--accent)] text-[color:var(--bg)]" : "text-[color:var(--muted)]"
              }`}
            >
              after
            </button>
          </div>
        </div>

        <p className="text-sm text-[color:var(--muted)] leading-relaxed mb-4 max-w-2xl">
          {active.what}
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--muted)] mb-2">
              Before
            </p>
            <pre className="code-pane max-h-[60vh]">
              <code>{active.before}</code>
            </pre>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--accent)] mb-2">
              After · {active.name}
            </p>
            <pre className="code-pane max-h-[60vh]">
              <code>{active.after}</code>
            </pre>
          </div>
        </div>

        {/* Mobile: single pane that swaps */}
        <div className="md:hidden mt-4">
          <AnimatePresence mode="wait">
            <motion.pre
              key={showAfter ? "after" : "before"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="code-pane"
            >
              <code>{showAfter ? active.after : active.before}</code>
            </motion.pre>
          </AnimatePresence>
        </div>

        <p className="mt-6 font-mono text-xs text-[color:var(--muted)]">
          Source: <code className="text-[color:var(--fg)]">{active.sourceFile}</code>
        </p>
      </div>
    </div>
  );
}
