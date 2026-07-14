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

const DIVE_LINKS = [
  { href: "/compiler/playground", title: "Playground", cta: "open playground →" },
  { href: "/compiler/passes", title: "Passes", cta: "explore passes →" },
  { href: "/compiler/grammar", title: "Language", cta: "start writing LC →" },
];

export default function CompilerOverviewPage() {
  return (
    <div>
      <ShareLinkRedirect />
      <header className="mb-12">
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
      <section className="mb-12 grid gap-8 sm:grid-cols-3 border-t border-[color:var(--border)] pt-8">
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
      <section className="mb-12">
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-5">
          The pipeline
        </h2>
        <ol className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {LAYERS.map((L, i) => (
            <li key={L} className="flex gap-3">
              <span
                className={`flex-shrink-0 w-6 h-6 border flex items-center justify-center font-mono text-[10px] ${
                  i === 0 || i === LAYERS.length - 1
                    ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                    : "border-[color:var(--border)] text-[color:var(--muted)]"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-mono text-sm text-[color:var(--fg)] leading-6">
                  {LAYER_LABEL[L]}
                </p>
                <p className="mt-0.5 text-[13px] text-[color:var(--muted)] leading-snug">
                  {LAYER_TAGLINE[L]}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Dive in — compact CTA row */}
      <section className="border-t border-[color:var(--border)] pt-8">
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-5">
          Dive in
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {DIVE_LINKS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group flex items-center justify-between gap-4 border border-[color:var(--border)] hover:border-[color:var(--accent)] px-4 py-3 transition-colors"
            >
              <span className="text-base font-semibold tracking-tight group-hover:text-[color:var(--accent)] transition-colors">
                {d.title}
              </span>
              <span className="font-mono text-xs text-[color:var(--accent)]">
                {d.cta}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
