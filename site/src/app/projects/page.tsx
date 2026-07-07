import Link from "next/link";
import type { Metadata } from "next";
import { projects } from "@/data/projects";

export const metadata: Metadata = {
  title: "Projects · Aiden Lee",
  description: "Compiler, dining-hall app, Discord bot, YouTube — projects by Aiden Lee.",
};

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 pt-16 pb-24">
      <header className="mb-16">
        <p className="font-mono text-xs text-[color:var(--muted)] uppercase tracking-wide mb-3">
          Projects
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl tracking-tight leading-tight">
          Things I&apos;ve built.
        </h1>
      </header>

      <ol className="space-y-16">
        {projects.map((p, i) => (
          <li key={p.slug} className="grid sm:grid-cols-[4rem_1fr] gap-4 sm:gap-8">
            <span className="font-mono text-xs text-[color:var(--muted)] tabular pt-2">
              {String(i + 1).padStart(2, "0")}
            </span>
            <article>
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h2 className="font-serif text-3xl tracking-tight">
                  {p.href ? (
                    <Link
                      href={p.href}
                      className="hover:text-[color:var(--accent)] transition-colors"
                    >
                      {p.title}
                    </Link>
                  ) : (
                    p.title
                  )}
                </h2>
                <span className="font-mono text-xs text-[color:var(--muted)] tabular">
                  {p.period}
                </span>
              </div>
              <p className="mt-2 text-[color:var(--muted)]">{p.tagline}</p>
              <ul className="mt-5 space-y-2 text-[15px] leading-relaxed">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-3">
                    <span className="text-[color:var(--accent)] mt-[0.5em] shrink-0">▸</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <ul className="flex flex-wrap gap-1.5">
                  {p.stack.map((s) => (
                    <li
                      key={s}
                      className="font-mono text-[11px] px-2 py-1 rounded bg-[color:var(--subtle)]"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
                {p.links?.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="font-mono text-xs text-[color:var(--accent)] underline underline-offset-4 hover:text-[color:var(--fg)]"
                  >
                    {l.label} →
                  </a>
                ))}
              </div>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
