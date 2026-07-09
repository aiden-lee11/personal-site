import type { Metadata } from "next";
import Link from "next/link";
import { LAYERS, LAYER_LABEL, LAYER_TAGLINE } from "@/lib/loadPresets";
import { OPT_EXAMPLES } from "@/data/compiler";
import ShareLinkRedirect from "./ShareLinkRedirect";

export const metadata: Metadata = {
  title: "Compiler · Aiden Lee",
  description:
    "My 5-stage C++ compiler — LA → IR → L3 → L2 → L1 → x86-64 — running in your browser, with an interactive playground and a gallery of every IR optimization pass.",
};

const STATS = [
  { value: "536 ms", label: "class-competition benchmark, 18× faster than GCC" },
  { value: "6", label: "pipeline layers, LA source down to x86-64" },
  { value: `${OPT_EXAMPLES.length}`, label: "IR optimization passes, each toggleable live" },
];

export default function CompilerOverviewPage() {
  return (
    <div>
      <ShareLinkRedirect />
      <header className="mb-16">
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
          This is the compiler I wrote for Northwestern&apos;s CS 322 — the one that won
          the class competition. It now runs inside this site as WebAssembly: you can
          write code, step through every intermediate representation, and flip
          individual optimization passes on and off to see exactly what they do.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 font-mono text-sm">
          <Link
            href="/compiler/playground"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--fg)] text-[color:var(--bg)] hover:bg-[color:var(--accent)] transition-colors"
          >
            <span>Open the playground</span>
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/compiler/passes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[color:var(--border)] hover:border-[color:var(--fg)] transition-colors"
          >
            Explore the passes
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section className="mb-16 grid sm:grid-cols-3 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-[color:var(--border)] p-5"
          >
            <p className="font-mono text-3xl text-[color:var(--accent)] tabular">
              {s.value}
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted)] leading-snug">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {/* The pipeline */}
      <section className="mb-16">
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-6">
          The pipeline
        </h2>
        <ol className="space-y-0">
          {LAYERS.map((L, i) => (
            <li key={L} className="flex gap-5">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center font-mono text-[11px] ${
                    i === 0 || i === LAYERS.length - 1
                      ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                      : "border-[color:var(--border)] text-[color:var(--muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                {i < LAYERS.length - 1 && (
                  <span className="w-px flex-1 bg-[color:var(--border)]" />
                )}
              </div>
              <div className="pb-8 min-w-0">
                <p className="font-mono text-sm text-[color:var(--fg)] pt-1.5">
                  {LAYER_LABEL[L]}
                </p>
                <p className="mt-1 text-sm text-[color:var(--muted)] leading-relaxed max-w-2xl">
                  {LAYER_TAGLINE[L]}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Section cards */}
      <section>
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-6">
          Dive in
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/compiler/playground"
            className="group rounded-lg border border-[color:var(--border)] hover:border-[color:var(--accent)] p-6 transition-all"
          >
            <p className="font-serif text-2xl leading-tight mb-2 group-hover:text-[color:var(--accent)] transition-colors">
              Playground
            </p>
            <p className="text-sm text-[color:var(--muted)] leading-relaxed">
              Write LA (or any intermediate) and step through every layer the
              compiler emits — down to the exact assembly your CPU would run.
              Toggle passes, diff optimized vs unoptimized, and time the real
              binary on the server.
            </p>
            <p className="mt-4 font-mono text-xs text-[color:var(--accent)]">
              open playground →
            </p>
          </Link>
          <Link
            href="/compiler/passes"
            className="group rounded-lg border border-[color:var(--border)] hover:border-[color:var(--accent)] p-6 transition-all"
          >
            <p className="font-serif text-2xl leading-tight mb-2 group-hover:text-[color:var(--accent)] transition-colors">
              Passes
            </p>
            <p className="text-sm text-[color:var(--muted)] leading-relaxed">
              A guided tour of all {OPT_EXAMPLES.length} IR optimizations —
              SCCP, DCE, LICM, GVN, and friends — each with a minimal
              before/after example and a one-click demo that runs the pass on
              real code.
            </p>
            <p className="mt-4 font-mono text-xs text-[color:var(--accent)]">
              explore passes →
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
