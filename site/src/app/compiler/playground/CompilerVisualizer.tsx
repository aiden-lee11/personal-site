"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { diffArrays } from "diff";
import type { Layer, PresetLayers, PresetMeta } from "@/lib/loadPresets";
import { PASS_DEMOS, type PassDemoId } from "@/data/passDemos";
import { runTransform } from "../wasm/client";

type PresetBundle = { meta: PresetMeta; layers: PresetLayers };

type Props = {
  presets: PresetBundle[];
  layers: Layer[];
  layerLabel: Record<Layer, string>;
  layerTagline: Record<Layer, string>;
};

type CompileResult = {
  ok: boolean;
  layers: Partial<Record<Layer, string>>;
  errors?: Partial<Record<Layer, string>>;
  error?: string;
  /** Wall time to transform source → x86 (wasm pipeline). Not program runtime. */
  totalMs?: number;
  layerMs?: Partial<Record<Layer, number>>;
  programOutput?: string;
  runExit?: number;
  /** Averaged wall time of the linked program (ms). Distinct from totalMs. */
  runMs?: number;
  /** Same measurement with all IR opts off — for speedup comparison. */
  baselineRunMs?: number;
  linkError?: string;
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

/** Format program runtime for display (sub-ms programs are common). */
function formatRunMs(ms: number): string {
  if (ms < 0.001) return "<0.001 ms";
  if (ms < 1) return `${ms.toFixed(3)} ms`;
  if (ms < 100) return `${ms.toFixed(2)} ms`;
  return `${Math.round(ms)} ms`;
}

type RunPayload = {
  programOutput?: string;
  runExit?: number;
  runMs?: number;
  linkError?: string;
  ok?: boolean;
};

/** Link + execute via the server runtime. Returns timing + stdout when Docker is up. */
async function fetchRun(input: {
  source: string;
  fromLayer: Layer;
  optFlags: OptFlags;
}): Promise<RunPayload> {
  try {
    const res = await fetch("/api/compile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: input.source,
        fromLayer: input.fromLayer,
        optFlags: input.optFlags,
        run: true,
      }),
    });
    const data = (await res.json()) as RunPayload;
    if (data.linkError) return data;
    if (data.programOutput === undefined && data.runMs === undefined) {
      return { linkError: "program execution requires the server runtime" };
    }
    return data;
  } catch {
    return { linkError: "program execution requires the server runtime" };
  }
}

export default function CompilerVisualizer({
  presets,
  layers,
  layerLabel,
  layerTagline,
}: Props) {
  const initialPreset = presets[2] ?? presets[0]; // default fib
  const [source, setSource] = useState(initialPreset.layers.LA);
  const [fromLayer, setFromLayer] = useState<Layer>("LA");
  const [activePresetSlug, setActivePresetSlug] = useState<string | null>(
    initialPreset.meta.slug,
  );

  // Persist current source + fromLayer on every change so refresh preserves work.
  useEffect(() => {
    try {
      localStorage.setItem("aiden-compiler:source", source);
      localStorage.setItem("aiden-compiler:from", fromLayer);
    } catch { /* SSR / private mode / quota — ignore */ }
  }, [source, fromLayer]);
  const [optFlags, setOptFlags] = useState<OptFlags>(defaultOptFlags);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [baseline, setBaseline] = useState<CompileResult | null>(null); // all-opts-off compile
  const [compareMode, setCompareMode] = useState(false);
  // Also time an all-opts-off binary on ▸▸ run (noticeable on heavy presets like fib).
  const [compareRuntime, setCompareRuntime] = useState(true);
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
      selectLayer?: Layer;
      run?: boolean;
    }) => {
      const reqId = ++activeReq.current;
      setPending(true);
      setError(null);
      const prevLayer = selectedLayer;
      const reqSource = opts?.source ?? source;
      const reqFrom = opts?.fromLayer ?? fromLayer;
      const reqFlags = opts?.optFlags ?? optFlags;
      try {
        // The transform pipeline runs entirely in the browser (wasm) — no network.
        const data: CompileResult = await runTransform({
          source: reqSource,
          fromLayer: reqFrom,
          optFlags: reqFlags,
        });
        if (activeReq.current !== reqId) return; // stale
        setResult(data);
        if (!data.ok) {
          setError(data.error ?? "compilation failed");
          setSelectedLayer(reqFrom);
        } else if (opts?.selectLayer && data.layers[opts.selectLayer]) {
          setSelectedLayer(opts.selectLayer);
        } else if (opts?.preserveLayer && data.layers[prevLayer]) {
          setSelectedLayer(prevLayer);
        } else {
          // Jump to the deepest produced layer so the "wow" moment lands.
          const produced = layers.filter((L) => data.layers[L]);
          setSelectedLayer(produced[produced.length - 1] ?? "LA");
        }

        // Running the produced x86 can't happen in-browser — that still needs
        // the server runtime (gcc link + execute). Best-effort; a failure here
        // (static deploy, no Docker) must not break the transform display.
        // Optionally also time an all-opts-off build when compareRuntime is on.
        if (opts?.run && data.ok) {
          const runData = await fetchRun({
            source: reqSource,
            fromLayer: reqFrom,
            optFlags: reqFlags,
          });
          let baselineRunMs: number | undefined;
          if (compareRuntime) {
            const alreadyUnopt = IR_PASSES.every(
              (p) => reqFlags[p.id] === false,
            );
            if (alreadyUnopt) {
              baselineRunMs = runData.runMs;
            } else {
              const noOpts: OptFlags = {};
              for (const p of IR_PASSES) noOpts[p.id] = false;
              const baselineRun = await fetchRun({
                source: reqSource,
                fromLayer: reqFrom,
                optFlags: noOpts,
              });
              baselineRunMs = baselineRun.runMs;
            }
          }
          if (activeReq.current !== reqId) return;
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  programOutput: runData.programOutput,
                  runExit: runData.runExit,
                  runMs: runData.runMs,
                  baselineRunMs,
                  linkError: runData.linkError,
                }
              : prev,
          );
        }
      } catch (e) {
        if (activeReq.current !== reqId) return;
        setError((e as Error).message);
      } finally {
        if (activeReq.current === reqId) setPending(false);
      }
      // Keep the baseline in sync when compare mode is active, so switching
      // opts or hitting Compile refreshes the side-by-side without a click.
      if (compareMode) {
        compileBaseline({
          source: opts?.source ?? source,
          fromLayer: opts?.fromLayer ?? fromLayer,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fromLayer, layers, optFlags, source, selectedLayer, compareMode, compareRuntime],
  );

  const loadPreset = useCallback(
    (slug: string) => {
      const p = presets.find((x) => x.meta.slug === slug) ?? initialPreset;
      setActivePresetSlug(slug);
      setSource(p.layers.LA);
      setFromLayer("LA");
      compile({ source: p.layers.LA, fromLayer: "LA", run: true });
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
        // Baseline is a pure transform — runs in the browser wasm worker.
        const data: CompileResult = await runTransform({
          source: opts?.source ?? source,
          fromLayer: opts?.fromLayer ?? fromLayer,
          optFlags: noOpts,
        });
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
      // Each demo has a "best view" layer where its transformation is most legible.
      // IR passes are visible at L3 (the first layer emitted post-SSA); low-level
      // idioms like cmov synthesis and peephole are easier to see on final x86.
      const preferred: Record<PassDemoId, Layer> = {
        sccp: "L3", dce: "L3", licm: "L3", gvn: "L3", "copy-prop": "L3",
        algebra: "L3", peephole: "S", "vra-bce": "L3",
        "simplify-cfg": "L3", "cmov-synth": "S", "loop-dse": "L3",
        combo: "L3",
      };
      setActivePresetSlug(null);
      setSource(src);
      setFromLayer("LA");
      setOptFlags(next);
      setCompareMode(true);
      compile({
        source: src,
        fromLayer: "LA",
        optFlags: next,
        selectLayer: preferred[id],
        run: true,
      });
      compileBaseline({ source: src, fromLayer: "LA" });
    },
    [compile, compileBaseline],
  );

  // Rehydrate on mount: ?demo= (from the Passes page) wins, then the URL hash
  // (share link), then localStorage. Finishes with the initial compile+run so
  // the first paint isn't an empty panel.
  useEffect(() => {
    if (initialTried) return;
    setInitialTried(true);

    try {
      const demo = new URLSearchParams(window.location.search).get(
        "demo",
      ) as PassDemoId | null;
      if (demo && PASS_DEMOS[demo]) {
        loadDemo(demo);
        return;
      }
    } catch { /* malformed query — fall through */ }

    let src = initialPreset.layers.LA;
    let from: Layer = "LA";
    let flags: OptFlags | undefined;
    let hydratedFromUrl = false;

    // URL hash — format: #s=<base64-source>&f=<layer>&o=<11-char-bitmask>
    try {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (hash.startsWith("#s=")) {
        const params = new URLSearchParams(hash.slice(1));
        const s = params.get("s");
        const f = params.get("f") as Layer | null;
        const o = params.get("o");
        if (s) {
          src = decodeURIComponent(escape(atob(s)));
          setSource(src);
          setActivePresetSlug(null);
          hydratedFromUrl = true;
        }
        if (f && (["LA","IR","L3","L2","L1"] as string[]).includes(f)) {
          from = f;
          setFromLayer(f);
        }
        if (o && o.length === IR_PASSES.length) {
          const next: OptFlags = {};
          for (let i = 0; i < IR_PASSES.length; i++) {
            next[IR_PASSES[i].id] = o[i] !== "0";
          }
          flags = next;
          setOptFlags(next);
        }
      }
    } catch { /* malformed — fall through to localStorage */ }

    if (!hydratedFromUrl) try {
      const saved = localStorage.getItem("aiden-compiler:source");
      const savedFrom = localStorage.getItem("aiden-compiler:from") as Layer | null;
      if (saved) {
        src = saved;
        setSource(saved);
        if (saved !== initialPreset.layers.LA) setActivePresetSlug(null);
      }
      if (savedFrom && (["LA","IR","L3","L2","L1"] as string[]).includes(savedFrom)) {
        from = savedFrom;
        setFromLayer(savedFrom);
      }
    } catch { /* ignore */ }
    compile({ source: src, fromLayer: from, optFlags: flags, run: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [justCopied, setJustCopied] = useState(false);
  const copyShareUrl = useCallback(async () => {
    try {
      const s = btoa(unescape(encodeURIComponent(source)));
      const o = IR_PASSES.map((p) => (optFlags[p.id] ?? true) ? "1" : "0").join("");
      const params = new URLSearchParams();
      params.set("s", s);
      params.set("f", fromLayer);
      params.set("o", o);
      const url = `${window.location.origin}${window.location.pathname}#${params.toString()}`;
      // Persist locally too so refresh stays on the shared state.
      window.location.hash = `#${params.toString()}`;
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1800);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  }, [source, fromLayer, optFlags]);

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
            <button
              onClick={() => compile({ run: true })}
              disabled={pending}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[color:var(--accent)] text-[color:var(--accent)] hover:bg-[color:var(--accent)] hover:text-[color:var(--bg)] transition-colors disabled:opacity-50"
              title="Compile all the way to x86, link with C runtime, and run"
            >
              ▸▸ run
            </button>
            <label
              className="inline-flex items-center gap-1.5 text-[color:var(--muted)] hover:text-[color:var(--fg)] cursor-pointer select-none"
              title="Also time the same program with all IR opts off (second server run)"
            >
              <input
                type="checkbox"
                checked={compareRuntime}
                onChange={(e) => setCompareRuntime(e.target.checked)}
                className="accent-[color:var(--accent)]"
              />
              vs unopt
            </label>
            <button
              onClick={copyShareUrl}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--fg)] hover:text-[color:var(--fg)] transition-colors"
              title="Copy a shareable URL that reproduces this exact source, start-layer, and pass toggles"
            >
              {justCopied ? "copied ✓" : "share"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[color:var(--border)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--subtle)] px-4 py-2">
            <span className="font-mono text-xs text-[color:var(--muted)]">
              prog.{fromLayer}
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
              ✓ compile{" "}
              <span className="text-[color:var(--fg)] tabular">
                {result.totalMs}
              </span>{" "}
              ms
            </span>
          )}
          {!pending && result?.runMs != null && !error && (
            <span className="text-[color:var(--muted)]">
              · program runtime{" "}
              <span className="text-[color:var(--accent)] tabular">
                {formatRunMs(result.runMs)}
              </span>
              {result.baselineRunMs != null &&
                result.baselineRunMs > 0 &&
                result.runMs > 0 &&
                result.baselineRunMs / result.runMs >= 1.05 && (
                  <span className="text-[color:var(--accent)]">
                    {" "}
                    ({(result.baselineRunMs / result.runMs).toFixed(2)}× vs unopt)
                  </span>
                )}
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
            03 · Step through the pipeline
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
                    {produced
                      ? `${(result?.layers?.[L] ?? "").split("\n").length} lines`
                      : "—"}
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
          </aside>
        </div>

        {/* Run + timing results — laid out horizontally under the code pane so
            they don't run the sidebar far past the bottom of the viewer. */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
            {(result?.programOutput !== undefined ||
              result?.linkError ||
              result?.runMs != null) && (
              <div className="rounded-lg border border-[color:var(--accent)] bg-[color:var(--subtle)] p-4">
                <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
                  <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--accent)]">
                    program output
                  </p>
                  <div className="flex items-baseline gap-3 font-mono text-[10px] text-[color:var(--muted)] tabular">
                    {result.runExit !== undefined && (
                      <span>exit {result.runExit}</span>
                    )}
                  </div>
                </div>

                {result.runMs != null && (
                  <div className="mb-3 rounded border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2">
                    <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--muted)] mb-1.5">
                      program runtime
                      <span className="normal-case tracking-normal ml-1.5 opacity-70">
                        — how long the binary ran
                      </span>
                    </p>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <p className="font-mono text-sm text-[color:var(--fg)] tabular">
                        <span className="text-[color:var(--accent)]">
                          {formatRunMs(result.runMs)}
                        </span>
                        <span className="text-[10px] text-[color:var(--muted)] ml-1.5">
                          with current opts
                        </span>
                      </p>
                      {result.baselineRunMs != null && (
                        <p className="font-mono text-xs text-[color:var(--muted)] tabular">
                          {formatRunMs(result.baselineRunMs)}
                          <span className="text-[10px] ml-1.5">unoptimized</span>
                        </p>
                      )}
                      {result.baselineRunMs != null &&
                        result.baselineRunMs > 0 &&
                        result.runMs > 0 && (
                          <p className="font-mono text-xs tabular">
                            {result.baselineRunMs / result.runMs >= 1.05 ? (
                              <span className="text-[color:var(--accent)]">
                                {(result.baselineRunMs / result.runMs).toFixed(2)}×
                                faster
                              </span>
                            ) : result.runMs / result.baselineRunMs >= 1.05 ? (
                              <span className="text-[color:var(--muted)]">
                                {(result.runMs / result.baselineRunMs).toFixed(2)}×
                                slower
                              </span>
                            ) : (
                              <span className="text-[color:var(--muted)]">
                                ≈ same as unopt
                              </span>
                            )}
                          </p>
                        )}
                    </div>
                  </div>
                )}

                {result.linkError ? (
                  <pre className="font-mono text-xs whitespace-pre-wrap break-words text-[color:var(--accent)]">
                    {result.linkError}
                  </pre>
                ) : result.programOutput !== undefined ? (
                  <pre className="font-mono text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto">
                    {result.programOutput || "(no output)"}
                  </pre>
                ) : null}
              </div>
            )}

            {result?.layerMs &&
              Object.values(result.layerMs).some((v) => (v ?? 0) > 0) && (
                <div className="rounded-lg border border-[color:var(--border)] p-4">
                  <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--muted)] mb-1">
                    Compile time
                  </p>
                  <p className="text-[10px] text-[color:var(--muted)] mb-3 leading-snug">
                    How long the compiler took to emit each layer — not how fast
                    the program runs.
                  </p>
                  <TimingBars layerMs={result.layerMs} layers={["LA", "IR", "L3", "L2", "L1"]} />
                </div>
              )}

            <div className="rounded-lg border border-[color:var(--border)] p-4 text-xs text-[color:var(--muted)] leading-relaxed">
              <p>
                Transforms run in-browser via WebAssembly.{" "}
                <span className="text-[color:var(--fg)]">▸▸ run</span> links the
                x86 and times the binary on the server. Check{" "}
                <span className="text-[color:var(--fg)]">vs unopt</span> to also
                time an all-opts-off build for a speedup comparison.
              </p>
              {result?.totalMs != null && (
                <p className="mt-2 font-mono tabular text-[color:var(--fg)]">
                  compile: {result.totalMs} ms
                  {result.runMs != null && (
                    <span className="text-[color:var(--muted)]">
                      {" "}
                      · program: {formatRunMs(result.runMs)}
                    </span>
                  )}
                </p>
              )}
            </div>
        </div>
      </section>

    </div>
  );
}

/** Tiny in-line bar chart: one row per source-layer stage with time in ms. */
function TimingBars({
  layerMs,
  layers,
}: {
  layerMs: Partial<Record<Layer, number>>;
  layers: Layer[];
}) {
  const max = Math.max(1, ...layers.map((L) => layerMs[L] ?? 0));
  return (
    <ul className="space-y-2">
      {layers.map((L) => {
        const ms = layerMs[L];
        const pct = ms ? Math.max(4, Math.round((ms / max) * 100)) : 0;
        return (
          <li key={L} className="flex items-center gap-2">
            <span className="font-mono text-[10px] w-8 text-[color:var(--muted)] tabular">
              {L}
            </span>
            <div className="flex-1 h-1.5 rounded bg-[color:var(--subtle)] overflow-hidden">
              {ms !== undefined && (
                <div
                  className="h-full bg-[color:var(--accent)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
            </div>
            <span className="font-mono text-[10px] w-12 text-right tabular text-[color:var(--fg)]">
              {ms !== undefined ? `${ms} ms` : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Side-by-side pane showing the same layer's output with the user's opt
 * selections vs the same source compiled with every pass turned off.
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
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const lines = c.value;
      if (c.removed) {
        // A removed block directly followed by an added block is a *replacement*.
        // Align the two side-by-side on shared rows instead of stacking them as
        // two half-empty blocks — only the length difference becomes gap rows.
        const next = chunks[i + 1];
        if (next?.added) {
          const del = lines;
          const add = next.value;
          delN += del.length;
          addN += add.length;
          const n = Math.max(del.length, add.length);
          for (let k = 0; k < n; k++) {
            l.push(
              k < del.length
                ? { kind: "del", text: del[k] }
                : { kind: "gap", text: "" },
            );
            r.push(
              k < add.length
                ? { kind: "add", text: add[k] }
                : { kind: "gap", text: "" },
            );
          }
          i++; // consume the paired added chunk
        } else {
          delN += lines.length;
          for (const t of lines) {
            l.push({ kind: "del", text: t });
            r.push({ kind: "gap", text: "" });
          }
        }
      } else if (c.added) {
        addN += lines.length;
        for (const t of lines) {
          l.push({ kind: "gap", text: "" });
          r.push({ kind: "add", text: t });
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
