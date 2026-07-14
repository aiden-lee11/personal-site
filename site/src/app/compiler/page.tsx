import type { Metadata } from "next";
import Link from "next/link";
import { LAYERS, LAYER_LABEL, LAYER_TAGLINE } from "@/lib/loadPresets";
import { OPT_EXAMPLES } from "@/data/compiler";
import ShareLinkRedirect from "./ShareLinkRedirect";

export const metadata: Metadata = {
  title: "Compiler · Aiden Lee",
  description: "A C-like compiler that you can explore and run in your browser.",
};

const STATS = [
  { value: "536 ms", label: "fastest compiler in the class competition" },
  { value: "8", label: "steps from source code to assembly" },
  { value: `${OPT_EXAMPLES.length}`, label: "optimizations you can turn on and off" },
];

export default function CompilerOverviewPage() {
  return (
    <div>
      <ShareLinkRedirect />
      <header className="mb-16">
        <p className="eyebrow mb-5">Interactive / Compiler</p>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.055em] leading-[0.95] max-w-4xl">
          C-like source to x86-64,
          <br />
          <span className="text-[color:var(--accent)]">in your browser.</span>
        </h1>
        <p className="mt-6 text-[color:var(--muted)] max-w-2xl leading-relaxed">
          My partner and I built this compiler for Northwestern&apos;s CS 322.
          Write a little C-like code, see how it changes on the way to assembly,
          and run it. The{" "}
          <Link
            href="/compiler/grammar"
            className="text-[color:var(--fg)] link-underline"
          >
            language page
          </Link>{" "}
          helps you get started.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/compiler/playground" className="btn btn-primary">
            <span>Open the playground</span>
            <span aria-hidden>→</span>
          </Link>
          <Link href="/compiler/passes" className="btn btn-ghost">
            Explore the passes
          </Link>
          <a
            href="https://www.linkedin.com/feed/update/urn:li:activity:7476648103211585536/"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm link-underline"
          >
            the announcement post ↗
          </a>
        </div>
      </header>

      {/* Stats */}
      <section className="mb-16 grid gap-8 sm:grid-cols-3 border-t border-[color:var(--border)] pt-10">
        {STATS.map((s) => (
          <div key={s.label}>
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
                  className={`flex-shrink-0 w-8 h-8 border flex items-center justify-center font-mono text-[11px] ${
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
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/compiler/playground"
            className="group border border-[color:var(--border)] hover:border-[color:var(--accent)] p-6 transition-all"
          >
            <p className="text-2xl font-semibold tracking-tight leading-tight mb-2 group-hover:text-[color:var(--accent)] transition-colors">
              Playground
            </p>
            <p className="text-sm text-[color:var(--muted)] leading-relaxed">
              Write code, step through the compiler, and run the result.
            </p>
            <p className="mt-4 font-mono text-xs text-[color:var(--accent)]">
              open playground →
            </p>
          </Link>
          <Link
            href="/compiler/passes"
            className="group border border-[color:var(--border)] hover:border-[color:var(--accent)] p-6 transition-all"
          >
            <p className="text-2xl font-semibold tracking-tight leading-tight mb-2 group-hover:text-[color:var(--accent)] transition-colors">
              Passes
            </p>
            <p className="text-sm text-[color:var(--muted)] leading-relaxed">
              See what each optimization changes with a small before-and-after
              example.
            </p>
            <p className="mt-4 font-mono text-xs text-[color:var(--accent)]">
              explore passes →
            </p>
          </Link>
          <Link
            href="/compiler/grammar"
            className="group border border-[color:var(--border)] hover:border-[color:var(--accent)] p-6 transition-all"
          >
            <p className="text-2xl font-semibold tracking-tight leading-tight mb-2 group-hover:text-[color:var(--accent)] transition-colors">
              Language
            </p>
            <p className="text-sm text-[color:var(--muted)] leading-relaxed">
              A short reference and starter program for the language.
            </p>
            <p className="mt-4 font-mono text-xs text-[color:var(--accent)]">
              start writing LC →
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
