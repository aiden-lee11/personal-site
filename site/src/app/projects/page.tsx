import Link from "next/link";
import type { Metadata } from "next";
import { projects, type Project } from "@/data/projects";

export const metadata: Metadata = {
  title: "Projects · Aiden Lee",
  description:
    "Compiler, dining-hall app, Discord bot, git reimpl, container runtime, poker — projects by Aiden Lee.",
};

function Row({ project, index }: { project: Project; index: number }) {
  const p = project;
  return (
    <li className="grid sm:grid-cols-[4rem_1fr] gap-4 sm:gap-8">
      <span className="font-mono text-xs text-[color:var(--muted)] tabular pt-2">
        {String(index).padStart(2, "0")}
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
  );
}

export default function ProjectsPage() {
  const main = projects.filter((p) => !p.side);
  const side = projects.filter((p) => p.side);
  const totalMain = main.length;

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
        {main.map((p, i) => (
          <Row key={p.slug} project={p} index={i + 1} />
        ))}
      </ol>

      {side.length > 0 && (
        <>
          <div className="mt-20 mb-12 flex items-baseline gap-4">
            <p className="font-mono text-xs text-[color:var(--muted)] uppercase tracking-widest">
              Side quests
            </p>
            <hr className="flex-1 border-t border-[color:var(--border)]" />
          </div>
          <p className="text-[color:var(--muted)] max-w-2xl mb-12 -mt-4">
            Smaller things built to internalize how something works — a git
            reimplementation, a container runtime from scratch, and a few
            interactive tools. Not resume material; just how I learn.
          </p>
          <ol className="space-y-16">
            {side.map((p, i) => (
              <Row key={p.slug} project={p} index={totalMain + i + 1} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
