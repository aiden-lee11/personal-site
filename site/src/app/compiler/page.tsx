import type { Metadata } from "next";
import Link from "next/link";
import { OPT_EXAMPLES } from "@/data/compiler";
import ShareLinkRedirect from "./ShareLinkRedirect";
import PipelineChain from "./PipelineChain";

export const metadata: Metadata = {
  title: "Compiler · Aiden Lee",
  description: "A C-like compiler that you can explore and run in your browser.",
};

const STATS: {
  value: string;
  label: string;
  link?: { label: string; href: string };
}[] = [
  {
    value: "536 ms",
    label: "fastest compiler in the class competition",
    link: {
      label: "the announcement post ↗",
      href: "https://www.linkedin.com/feed/update/urn:li:activity:7476648103211585536/",
    },
  },
  { value: "8", label: "steps from source code to assembly" },
  { value: `${OPT_EXAMPLES.length}`, label: "optimizations you can turn on and off" },
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
            {s.link && (
              <a
                href={s.link.href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block font-mono text-xs text-[color:var(--fg)] link-underline"
              >
                {s.link.label}
              </a>
            )}
          </div>
        ))}
      </section>

      {/* The pipeline */}
      <section className="mb-12">
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-5">
          The pipeline
        </h2>
        <PipelineChain />
      </section>
    </div>
  );
}
