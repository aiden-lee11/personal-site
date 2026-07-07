"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { diffArrays } from "diff";
import type { Layer, PresetLayers, PresetMeta } from "@/lib/loadPresets";
import type { OptExample } from "@/data/compiler";
import { PASS_DEMOS, type PassDemoId } from "@/data/passDemos";

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

// Every IR pass with a --no-<slug> flag exposed by compiler-src/IR/src/compiler.cpp
const IR_PASSES = [
  { id: "sccp",        name: "SCCP",        full: "Sparse Conditional Constant Propagation" },
  { id: "dce",         name: "DCE",         full: "Dead Code Elimination" },
  { id: "licm",        name: "LICM",        full: "Loop-Invariant Code Motion" },
  { id: "gvn",         name: "GVN",         full: "Global Value Numbering" },
  { id: "copy-prop",   name: "CopyProp",    full: "Copy Propagation" },
  { id: "algebra",     name: "AlgSimp",     full: "Algebraic Simplification" },
  { id: "peephole",    name: "Peephole",    full: "Peephole" },
  { id: "vra-bce",     name: "VRA/BCE",     full: "Value Range Analysis / Branch-Check Elim." },
  { id: "simplify-cfg",name: "CFGSimp",     full: "CFG Simplification" },
  { id: "cmov-synth",  name: "CMovSynth",   full: "Conditional-Move Synthesis" },
  { id: "loop-dse",    name: "LoopDSE",     full: "Loop Dead-Store Elim." },
] as const;
type IrPassId = (typeof IR_PASSES)[number]["id"];

type OptFlags = Partial<Record<IrPassId, boolean>>;

function defaultOptFlags(): OptFlags {
  const o: OptFlags = {};
  for (const p of IR_PASSES) o[p.id] = true;
  return o;
}

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
  const [activePresetSlug, setActivePresetSlug] = useState<string | null>(
    initialPreset.meta.slug,
  );
  const [optFlags, setOptFlags] = useState<OptFlags>(defaultOptFlags);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [baseline, setBaseline] = useState<CompileResult | null>(null); // all-opts-off compile
  const [compareMode, setCompareMode] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<Layer>("LA");
  const [pending, setPending] = useState(false);
  const [baselinePending, setBaselinePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialTried, setInitialTried] = useState(false);
  const activeReq = useRef(0);
  const baselineReq = useRef(0);

  const compile = useCallback(
    async (opts?: {
      source?: string;
      fromLayer?: Layer;
      optFlags?: OptFlags;
      preserveLayer?: boolean;
    }) => {
      const reqId = ++activeReq.current;
      setPending(true);
      setError(null);
      const prevLayer = selectedLayer;
      try {
        const res = await fetch("/api/compile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: opts?.source ?? source,
            fromLayer: opts?.fromLayer ?? fromLayer,
            optFlags: opts?.optFlags ?? optFlags,
          }),
        });
        const data: CompileResult = await res.json();
        if (activeReq.current !== reqId) return; // stale
        setResult(data);
        if (!data.ok) {
          setError(data.error ?? "compilation failed");
          setSelectedLayer(opts?.fromLayer ?? fromLayer);
        } else if (opts?.preserveLayer && data.layers[prevLayer]) {
          setSelectedLayer(prevLayer);
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
    [fromLayer, layers, optFlags, source, selectedLayer],
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
      setActivePresetSlug(slug);
      setSource(p.layers.LA);
      setFromLayer("LA");
      compile({ source: p.layers.LA, fromLayer: "LA" });
    },
    [presets, initialPreset, compile],
  );

  // When the user changes "start at" — if a preset is loaded, swap the editor to
  // that preset's source at the chosen layer. If they'd edited into custom code,
  // preset is cleared so we don't clobber their work.
  const setFromLayerAndSwap = useCallback(
    (L: Layer) => {
      setFromLayer(L);
      if (activePresetSlug) {
        const p = presets.find((x) => x.meta.slug === activePresetSlug);
        const next = p?.layers[L];
        if (next) {
          setSource(next);
          compile({ source: next, fromLayer: L });
        }
      }
    },
    [activePresetSlug, presets, compile],
  );

  // Debounced auto-recompile when the user flips a pass toggle. Keeps the
  // currently-viewed layer selected so the diff feels live.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRecompile = useCallback(
    (nextFlags: OptFlags) => {
      setOptFlags(nextFlags);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        compile({ optFlags: nextFlags, preserveLayer: true });
      }, 220);
    },
    [compile],
  );
  const toggleOpt = useCallback(
    (id: IrPassId) => {
      scheduleRecompile({ ...optFlags, [id]: !(optFlags[id] ?? true) });
    },
    [optFlags, scheduleRecompile],
  );
  const setAllOpts = useCallback(
    (on: boolean) => {
      const next: OptFlags = {};
      for (const p of IR_PASSES) next[p.id] = on;
      scheduleRecompile(next);
    },
    [scheduleRecompile],
  );

  // Compile-with-all-opts-off — the baseline for diff view. Kicked off any
  // time source or fromLayer changes (or user opens compare mode).
  const compileBaseline = useCallback(
    async (opts?: { source?: string; fromLayer?: Layer }) => {
      const reqId = ++baselineReq.current;
      setBaselinePending(true);
      try {
        const noOpts: OptFlags = {};
        for (const p of IR_PASSES) noOpts[p.id] = false;
        const res = await fetch("/api/compile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: opts?.source ?? source,
            fromLayer: opts?.fromLayer ?? fromLayer,
            optFlags: noOpts,
          }),
        });
        const data: CompileResult = await res.json();
        if (baselineReq.current !== reqId) return;
        setBaseline(data);
      } catch {
        /* baseline is best-effort */
      } finally {
        if (baselineReq.current === reqId) setBaselinePending(false);
      }
    },
    [source, fromLayer],
  );

  // Load a per-pass demo — sets source, enables *only* that pass so the diff
  // isolates its effect, and (if in compare mode) refreshes the baseline.
  const loadDemo = useCallback(
    (id: PassDemoId) => {
      const src = PASS_DEMOS[id];
      if (!src) return;
      const next: OptFlags = {};
      for (const p of IR_PASSES) next[p.id] = false;
      if (id !== "combo" && (IR_PASSES as ReadonlyArray<{ id: string }>).some((p) => p.id === id)) {
        next[id as IrPassId] = true;
      } else if (id === "combo") {
        next.sccp = true;
        next.dce = true;
        next.licm = true;
      }
      setActivePresetSlug(null);
      setSource(src);
      setFromLayer("LA");
      setOptFlags(next);
      setCompareMode(true);
      compile({ source: src, fromLayer: "LA", optFlags: next });
      compileBaseline({ source: src, fromLayer: "LA" });
    },
    [compile, compileBaseline],
  );

  const toggleCompareMode = useCallback(() => {
    const next = !compareMode;
    setCompareMode(next);
    if (next && !baseline) compileBaseline();
  }, [compareMode, baseline, compileBaseline]);

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
          {presets.map((p) => {
            const active = activePresetSlug === p.meta.slug;
            return (
              <button
                key={p.meta.slug}
                onClick={() => loadPreset(p.meta.slug)}
                className={`text-left rounded-lg border p-4 transition-all ${
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--subtle)]"
                    : "border-[color:var(--border)] hover:border-[color:var(--fg)]"
                }`}
              >
                <div className="font-mono text-xs mb-1 flex items-center gap-2">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      active
                        ? "bg-[color:var(--accent)]"
                        : "bg-[color:var(--border)]"
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

      {/* Pass demos — one-click showcase for each optimization */}
      <section>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            02 · Pass showcase
          </h2>
          <span className="font-mono text-xs text-[color:var(--muted)]">
            each button loads code + isolates that pass
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {(
            [
              { id: "sccp", label: "SCCP", hint: "prunes unreachable branches, folds constants" },
              { id: "dce", label: "DCE", hint: "removes unused computations" },
              { id: "licm", label: "LICM", hint: "hoists loop-invariant work" },
              { id: "gvn", label: "GVN", hint: "dedupes identical expressions" },
              { id: "copy-prop", label: "CopyProp", hint: "chases copy chains" },
              { id: "algebra", label: "AlgSimp", hint: "x*1 → x, y+0 → y" },
              { id: "cmov-synth", label: "CMovSynth", hint: "branch → cmov" },
              { id: "combo", label: "Combo (SCCP+DCE+LICM)", hint: "three passes at once" },
            ] as { id: PassDemoId; label: string; hint: string }[]
          ).map((d) => (
            <button
              key={d.id}
              onClick={() => loadDemo(d.id)}
              className="text-left rounded-lg border border-[color:var(--border)] hover:border-[color:var(--accent)] p-3 transition-all group"
            >
              <div className="font-mono text-xs mb-1 flex items-center gap-2">
                <span className="text-[color:var(--accent)] opacity-60 group-hover:opacity-100">
                  ▸
                </span>
                {d.label}
              </div>
              <div className="text-xs text-[color:var(--muted)] leading-snug">
                {d.hint}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Editor */}
      <section>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            03 · Write code · compile
          </h2>
          <div className="flex items-center gap-2 font-mono text-xs">
            <label className="text-[color:var(--muted)]">start at</label>
            <select
              value={fromLayer}
              onChange={(e) => setFromLayerAndSwap(e.target.value as Layer)}
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
            onChange={(e) => {
              setSource(e.target.value);
              setActivePresetSlug(null);
              setBaseline(null); // invalidate; user must recompile to compare
            }}
            onKeyDown={handleKey}
            spellCheck={false}
            className="code-pane w-full block resize-y min-h-[14rem] max-h-[24rem] outline-none border-0 rounded-none"
            style={{ background: "var(--code-bg)" }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs">
          {pending && (
            <span className="text-[color:var(--muted)] inline-flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
              running compiler…
            </span>
          )}
          {!pending && result?.totalMs != null && !error && (
            <span className="text-[color:var(--muted)]">
              ✓ compiled in{" "}
              <span className="text-[color:var(--accent)] tabular">
                {result.totalMs}
              </span>{" "}
              ms
            </span>
          )}
          {!activePresetSlug && !pending && !error && result?.ok && (
            <span className="text-[color:var(--muted)]">· custom source</span>
          )}
        </div>
        {error && !pending && (
          <div className="mt-3 rounded-lg border border-[color:var(--accent)] bg-[color:var(--subtle)] p-3">
            <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--accent)] mb-1">
              Compilation error
            </p>
            <pre className="font-mono text-xs whitespace-pre-wrap break-words leading-relaxed">
              {error}
            </pre>
          </div>
        )}
      </section>

      {/* Pipeline */}
      <section>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            04 · Step through the pipeline
          </h2>
          <button
            onClick={toggleCompareMode}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              compareMode
                ? "border-[color:var(--accent)] text-[color:var(--accent)] bg-[color:var(--subtle)]"
                : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--fg)] hover:text-[color:var(--fg)]"
            }`}
            title="Compile the same source with all opts off and show side-by-side"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
            {compareMode ? "comparing vs unoptimized" : "compare vs unoptimized"}
          </button>
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
          <div className="min-w-0">
            {compareMode ? (
              <ComparisonPane
                layer={selectedLayer}
                optimized={currentCode}
                baseline={baseline?.layers?.[selectedLayer] ?? ""}
                pending={pending}
                baselinePending={baselinePending}
              />
            ) : (
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
            )}
          </div>

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

            <div className="rounded-lg border border-[color:var(--border)] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--muted)]">
                  IR passes
                </p>
                <div className="flex gap-1 font-mono text-[10px]">
                  <button
                    onClick={() => setAllOpts(true)}
                    className="px-2 py-0.5 rounded border border-[color:var(--border)] hover:border-[color:var(--fg)] transition-colors"
                  >
                    all
                  </button>
                  <button
                    onClick={() => setAllOpts(false)}
                    className="px-2 py-0.5 rounded border border-[color:var(--border)] hover:border-[color:var(--fg)] transition-colors"
                  >
                    none
                  </button>
                </div>
              </div>
              <ul className="space-y-1.5">
                {IR_PASSES.map((p) => {
                  const on = optFlags[p.id] ?? true;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => toggleOpt(p.id)}
                        className="w-full text-left group flex items-start gap-2"
                        title={p.full}
                      >
                        <span
                          className={`mt-[3px] inline-block w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${
                            on
                              ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
                              : "border-[color:var(--border)] group-hover:border-[color:var(--fg)]"
                          }`}
                        >
                          {on && (
                            <svg
                              viewBox="0 0 12 12"
                              className="w-2.5 h-2.5 text-[color:var(--bg)]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path d="M2 6.5 L5 9 L10 3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span className="text-xs leading-tight flex-1 min-w-0">
                          <span
                            className={`font-mono ${
                              on ? "text-[color:var(--fg)]" : "text-[color:var(--muted)]"
                            }`}
                          >
                            {p.name}
                          </span>
                          <span className="block text-[color:var(--muted)] text-[10px] leading-snug">
                            {p.full}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[10px] text-[color:var(--muted)] leading-snug border-t border-[color:var(--border)] pt-2">
                Flags plumbed through <code className="font-mono">--no-&lt;pass&gt;</code>{" "}
                to the IR binary (compiler-src fork). Toggle any to see the emitted
                code change live.
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

      {/* IR optimizations — pedagogical */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            05 · What each pass does
          </h2>
        </div>
        <p className="text-[color:var(--muted)] max-w-2xl mb-8">
          Canonical illustrations of three passes, at the scale of a single
          transformation. Flip the toggles in the sidebar above to see the same
          passes running on your actual code — this is just the explainer.
        </p>
        <OptGallery examples={optExamples} />
      </section>
    </div>
  );
}

/**
 * Side-by-side pane showing the same layer's output with the user's opt
 * selections vs the same source compiled with every pass turned off. Lines
 * present only on the optimized side get a green rail; lines present only on
 * baseline get an amber rail. Same lines are dimmed to draw the eye to diffs.
 */
function ComparisonPane({
  layer,
  optimized,
  baseline,
  pending,
  baselinePending,
}: {
  layer: Layer;
  optimized: string;
  baseline: string;
  pending: boolean;
  baselinePending: boolean;
}) {
  type Row = { kind: "same" | "add" | "del" | "gap"; text: string };
  const { left, right, added, removed } = useMemo(() => {
    if (!optimized || !baseline) {
      return { left: [] as Row[], right: [] as Row[], added: 0, removed: 0 };
    }
    const bl = baseline.split("\n");
    const ol = optimized.split("\n");
    const chunks = diffArrays(bl, ol);
    const l: Row[] = [];
    const r: Row[] = [];
    let addN = 0;
    let delN = 0;
    for (const c of chunks) {
      const lines = c.value;
      if (c.added) {
        addN += lines.length;
        for (const t of lines) {
          l.push({ kind: "gap", text: "" });
          r.push({ kind: "add", text: t });
        }
      } else if (c.removed) {
        delN += lines.length;
        for (const t of lines) {
          l.push({ kind: "del", text: t });
          r.push({ kind: "gap", text: "" });
        }
      } else {
        for (const t of lines) {
          l.push({ kind: "same", text: t });
          r.push({ kind: "same", text: t });
        }
      }
    }
    return { left: l, right: r, added: addN, removed: delN };
  }, [optimized, baseline]);

  const savings =
    baseline.length > 0
      ? Math.round(((baseline.length - optimized.length) / baseline.length) * 100)
      : 0;

  const rowCls = (kind: Row["kind"], side: "opt" | "base") => {
    if (kind === "gap") return "bg-[color:var(--subtle)]/40 opacity-40";
    if (kind === "same") return "opacity-55";
    if (kind === "add" && side === "opt")
      return "bg-[color:var(--accent)]/15 border-l-2 border-[color:var(--accent)]";
    if (kind === "del" && side === "base")
      return "bg-[color:var(--muted)]/15 border-l-2 border-[color:var(--muted)]";
    return "";
  };

  const renderCol = (rows: Row[], side: "opt" | "base") => (
    <div className="font-mono text-[0.8rem] leading-6 whitespace-pre">
      {rows.map((row, i) => {
        const cls = `px-2 -mx-2 ${rowCls(row.kind, side)}`;
        return (
          <div key={i} className={cls}>
            {row.text || " "}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[color:var(--border)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--subtle)] px-4 py-2">
            <span className="font-mono text-xs">
              <span className="text-[color:var(--accent)]">optimized</span>
              <span className="text-[color:var(--muted)]"> · prog.{layer}</span>
            </span>
            <span className="font-mono text-xs text-[color:var(--muted)] tabular">
              +{added}
              {pending && " · running…"}
            </span>
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto">
            {optimized ? (
              renderCol(right, "opt")
            ) : (
              <p className="font-mono text-xs text-[color:var(--muted)]">
                {pending ? "compiling…" : "no output for this layer"}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[color:var(--border)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--subtle)] px-4 py-2">
            <span className="font-mono text-xs">
              <span className="text-[color:var(--muted)]">unoptimized</span>
              <span className="text-[color:var(--muted)]"> · prog.{layer}</span>
            </span>
            <span className="font-mono text-xs text-[color:var(--muted)] tabular">
              −{removed}
              {baselinePending && " · running…"}
            </span>
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto">
            {baseline ? (
              renderCol(left, "base")
            ) : (
              <p className="font-mono text-xs text-[color:var(--muted)]">
                {baselinePending
                  ? "compiling baseline…"
                  : "baseline not yet computed"}
              </p>
            )}
          </div>
        </div>
      </div>

      {optimized && baseline && (
        <div className="rounded-lg border border-[color:var(--border)] p-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs">
          <span className="text-[color:var(--muted)]">
            optimized:{" "}
            <span className="text-[color:var(--accent)] tabular">
              {optimized.length.toLocaleString()}
            </span>{" "}
            chars
          </span>
          <span className="text-[color:var(--muted)]">
            unoptimized:{" "}
            <span className="text-[color:var(--fg)] tabular">
              {baseline.length.toLocaleString()}
            </span>{" "}
            chars
          </span>
          <span className="text-[color:var(--muted)]">
            savings:{" "}
            <span className="text-[color:var(--accent)] tabular">
              {savings}%
            </span>
          </span>
          <span className="text-[color:var(--muted)]">
            <span className="text-[color:var(--accent)] tabular">+{added}</span>
            {" "}added ·{" "}
            <span className="text-[color:var(--fg)] tabular">−{removed}</span>
            {" "}removed lines
          </span>
        </div>
      )}
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
