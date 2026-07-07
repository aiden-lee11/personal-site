"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type CompileResult = {
  ok: boolean;
  layers: Partial<Record<Layer, string>>;
  errors?: Partial<Record<Layer, string>>;
  error?: string;
  totalMs?: number;
};

// The compiler doesn't emit S itself — you can only pick a `from` up to L1.
const FROM_LAYERS: Layer[] = ["LA", "IR", "L3", "L2", "L1"];

export default function CompilerVisualizer({
  presets,
  layers,
  layerLabel,
  layerTagline,
  optExamples,
}: Props) {
  const initialPreset = presets[2] ?? presets[0]; // default fib
  const [source, setSource] = useState(initialPreset.layers.LA);
  const [fromLayer, setFromLayer] = useState<Layer>("LA");
  const [result, setResult] = useState<CompileResult | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<Layer>("LA");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialTried, setInitialTried] = useState(false);
  const activeReq = useRef(0);

  const compile = useCallback(
    async (opts?: { source?: string; fromLayer?: Layer }) => {
      const reqId = ++activeReq.current;
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/compile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: opts?.source ?? source,
            fromLayer: opts?.fromLayer ?? fromLayer,
          }),
        });
        const data: CompileResult = await res.json();
        if (activeReq.current !== reqId) return; // stale
        setResult(data);
        if (!data.ok) {
          setError(data.error ?? "compilation failed");
          setSelectedLayer(opts?.fromLayer ?? fromLayer);
        } else {
          // Jump to the deepest produced layer so the "wow" moment lands.
          const produced = layers.filter((L) => data.layers[L]);
          setSelectedLayer(produced[produced.length - 1] ?? "LA");
        }
      } catch (e) {
        if (activeReq.current !== reqId) return;
        setError((e as Error).message);
      } finally {
        if (activeReq.current === reqId) setPending(false);
      }
    },
    [fromLayer, layers, source],
  );

  // Auto-compile the default preset once on mount so the page never looks empty.
  useEffect(() => {
    if (initialTried) return;
    setInitialTried(true);
    compile({ source: initialPreset.layers.LA, fromLayer: "LA" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPreset = useCallback(
    (slug: string) => {
      const p = presets.find((x) => x.meta.slug === slug) ?? initialPreset;
      setSource(p.layers.LA);
      setFromLayer("LA");
      compile({ source: p.layers.LA, fromLayer: "LA" });
    },
    [presets, initialPreset, compile],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        compile();
      }
      // Tab inserts 2 spaces instead of losing focus
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const s = ta.selectionStart;
        const en = ta.selectionEnd;
        const next = source.slice(0, s) + "  " + source.slice(en);
        setSource(next);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = s + 2;
        });
      }
    },
    [compile, source],
  );

  const currentCode = result?.layers?.[selectedLayer] ?? "";
  const currentErr = result?.errors?.[selectedLayer];

  return (
    <div className="space-y-16">
      {/* Presets — quick-load */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            01 · Start from a preset (or write your own)
          </h2>
          <span className="font-mono text-xs text-[color:var(--muted)]">
            {presets.length} presets
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map((p) => (
            <button
              key={p.meta.slug}
              onClick={() => loadPreset(p.meta.slug)}
              className="text-left rounded-lg border p-4 border-[color:var(--border)] hover:border-[color:var(--fg)] transition-all"
            >
              <div className="font-mono text-xs mb-1">→ {p.meta.title}</div>
              <div className="text-xs text-[color:var(--muted)] leading-snug">
                {p.meta.blurb}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Editor */}
      <section>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            02 · Write code · compile
          </h2>
          <div className="flex items-center gap-2 font-mono text-xs">
            <label className="text-[color:var(--muted)]">start at</label>
            <select
              value={fromLayer}
              onChange={(e) => setFromLayer(e.target.value as Layer)}
              className="rounded border border-[color:var(--border)] bg-[color:var(--bg)] px-2 py-1 hover:border-[color:var(--fg)] focus:border-[color:var(--accent)]"
            >
              {FROM_LAYERS.map((L) => (
                <option key={L} value={L}>
                  {layerLabel[L]}
                </option>
              ))}
            </select>
            <button
              onClick={() => compile()}
              disabled={pending}
              className="ml-2 inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[color:var(--fg)] text-[color:var(--bg)] hover:bg-[color:var(--accent)] transition-colors disabled:opacity-50"
              title="Cmd/Ctrl+Enter"
            >
              {pending ? "compiling…" : "▸ compile"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[color:var(--border)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--subtle)] px-4 py-2">
            <span className="font-mono text-xs text-[color:var(--muted)]">
              prog.{fromLayer}
              <span className="mx-2">·</span>
              editable
            </span>
            <span className="font-mono text-xs text-[color:var(--muted)] tabular">
              ⌘/Ctrl+Enter to compile
            </span>
          </div>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={handleKey}
            spellCheck={false}
            className="code-pane w-full block resize-y min-h-[14rem] max-h-[24rem] outline-none border-0 rounded-none"
            style={{ background: "var(--code-bg)" }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs">
          {result?.totalMs != null && !error && (
            <span className="text-[color:var(--muted)]">
              ✓ compiled in{" "}
              <span className="text-[color:var(--accent)] tabular">
                {result.totalMs}
              </span>{" "}
              ms
            </span>
          )}
          {error && (
            <span className="text-[color:var(--accent)] max-w-full break-words">
              ✗ {error.split("\n")[0]}
            </span>
          )}
          {pending && (
            <span className="text-[color:var(--muted)]">running compiler…</span>
          )}
        </div>
      </section>

      {/* Pipeline */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            03 · Step through the pipeline
          </h2>
        </div>

        {/* Layer stepper */}
        <div className="mb-6">
          <div className="grid grid-cols-6 gap-1">
            {layers.map((L) => {
              const active = L === selectedLayer;
              const produced = !!result?.layers?.[L];
              const disabled = !produced;
              return (
                <button
                  key={L}
                  onClick={() => produced && setSelectedLayer(L)}
                  disabled={disabled}
                  className="group flex flex-col items-start disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Show ${layerLabel[L]}`}
                >
                  <div
                    className={`h-[3px] w-full mb-2 transition-all ${
                      active
                        ? "bg-[color:var(--accent)]"
                        : produced
                          ? "bg-[color:var(--fg)]"
                          : "bg-[color:var(--border)]"
                    }`}
                  />
                  <span
                    className={`font-mono text-[11px] uppercase tracking-widest transition-colors ${
                      active
                        ? "text-[color:var(--accent)]"
                        : produced
                          ? "text-[color:var(--fg)]"
                          : "text-[color:var(--muted)] group-hover:text-[color:var(--fg)]"
                    }`}
                  >
                    {layerLabel[L]}
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--muted)] mt-0.5 tabular">
                    {L === "S" ? "final" : produced ? "ready" : "—"}
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
              key={selectedLayer + (result ? "-r" : "-p")}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="min-w-0"
            >
              <div className="rounded-lg border border-[color:var(--border)] overflow-hidden">
                <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--subtle)] px-4 py-2">
                  <span className="font-mono text-xs text-[color:var(--muted)]">
                    prog.{selectedLayer}
                  </span>
                  <span className="font-mono text-xs text-[color:var(--muted)] tabular">
                    {currentCode
                      ? `${currentCode.split("\n").length} lines · ${currentCode.length.toLocaleString()} chars`
                      : pending
                        ? "…"
                        : "no output"}
                  </span>
                </div>
                <pre className="code-pane max-h-[70vh] rounded-none border-0">
                  <code>
                    {currentCode ||
                      (pending
                        ? "running compiler…"
                        : currentErr ||
                          "This layer wasn't produced. If you started from a later stage, earlier layers won't exist. If compilation failed, see the error above.")}
                  </code>
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
                {layerLabel[selectedLayer]}
              </p>
              <p className="text-sm text-[color:var(--muted)] leading-relaxed">
                {layerTagline[selectedLayer]}
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] p-4 text-xs text-[color:var(--muted)] leading-relaxed">
              <p>
                Every layer is <em>real output</em> from the compiler binary running
                on your input inside a Linux sandbox — same code that won the class
                competition.
              </p>
              {result?.totalMs != null && (
                <p className="mt-2 font-mono tabular text-[color:var(--fg)]">
                  round-trip: {result.totalMs} ms
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* IR optimizations */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            04 · IR optimizations
          </h2>
        </div>
        <p className="text-[color:var(--muted)] max-w-2xl mb-8">
          The IR stage is where every optimization pass lives. Below are canonical
          illustrations of three of them — the same transformations my compiler
          performs on the real IR you saw above. Toggle each to see before / after.
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
                !showAfter
                  ? "bg-[color:var(--fg)] text-[color:var(--bg)]"
                  : "text-[color:var(--muted)]"
              }`}
            >
              before
            </button>
            <button
              role="tab"
              aria-selected={showAfter}
              onClick={() => setShowAfter(true)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                showAfter
                  ? "bg-[color:var(--accent)] text-[color:var(--bg)]"
                  : "text-[color:var(--muted)]"
              }`}
            >
              after
            </button>
          </div>
        </div>

        <p className="text-sm text-[color:var(--muted)] leading-relaxed mb-4 max-w-2xl">
          {active.what}
        </p>

        <div className="hidden md:grid md:grid-cols-2 gap-4 min-w-0">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--muted)] mb-2">
              Before
            </p>
            <pre className="code-pane max-h-[60vh]">
              <code>{active.before}</code>
            </pre>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--accent)] mb-2">
              After · {active.name}
            </p>
            <pre className="code-pane max-h-[60vh]">
              <code>{active.after}</code>
            </pre>
          </div>
        </div>
        <div className="md:hidden">
          <AnimatePresence mode="wait">
            <motion.pre
              key={showAfter ? "after" : "before"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="code-pane max-h-[60vh]"
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
