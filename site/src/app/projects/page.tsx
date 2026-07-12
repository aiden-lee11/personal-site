import Link from "next/link";
import type { Metadata } from "next";
import { projects, type Project } from "@/data/projects";

export const metadata: Metadata = {
  title: "Projects · Aiden Lee",
  description:
    "Compiler, dining-hall app, Discord bot, git reimpl, container runtime, poker — projects by Aiden Lee.",
};

function Row({ project }: { project: Project }) {
  const p = project;
  return (
    <li className="border-t border-[color:var(--border)] py-12 first:border-t-0">
      <div className="grid gap-4 md:grid-cols-[12rem_1fr] md:gap-12 lg:gap-20">
        <div className="flex items-baseline justify-between gap-4 md:block">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
            {p.period}
          </p>
          <p className="mt-0 md:mt-3 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)] opacity-60">
            {p.stack.join(" · ")}
          </p>
        </div>
        <article>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.035em]">
            {p.href ? (
              <Link href={p.href} className="hover:text-[color:var(--accent)] transition-colors">
                {p.title}
              </Link>
            ) : (
              p.title
            )}
          </h2>
          <p className="mt-2 text-[color:var(--muted)]">{p.tagline}</p>
          <ul className="mt-5 space-y-2.5 text-[15px] leading-relaxed text-[color:var(--muted)]">
            {p.bullets.map((b) => (
              <li key={b} className="flex gap-3">
                <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[color:var(--accent)]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {p.links && p.links.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              {p.links.map((l) => (
                <a key={l.href} href={l.href} className="font-mono text-xs link-underline">
                  {l.label} →
                </a>
              ))}
            </div>
          )}
        </article>
      </div>
    </li>
  );
}

export default function ProjectsPage() {
  const main = projects.filter((p) => !p.side);
  const side = projects.filter((p) => p.side);

  return (
    <div className="mx-auto max-w-5xl px-6 pt-20 pb-24 sm:pt-28">
      <header className="grid gap-6 pb-16 lg:grid-cols-[1fr_18rem] lg:items-end">
        <div>
          <p className="eyebrow">Projects</p>
          <h1 className="mt-6 text-5xl sm:text-7xl font-semibold tracking-[-0.05em] leading-[0.95]">
            Work
          </h1>
        </div>
        <p className="text-[color:var(--muted)] lg:text-right">
          Compilers, production systems, and tools with real users.
        </p>
      </header>

      <ol>
        {main.map((p) => (
          <Row key={p.slug} project={p} />
        ))}
      </ol>

      {side.length > 0 && (
        <div className="mt-20 border-t border-[color:var(--border)] pt-16">
          <div className="grid gap-4 md:grid-cols-[12rem_1fr] md:gap-12 lg:gap-20">
            <p className="eyebrow">Smaller builds</p>
            <p className="text-[color:var(--muted)] max-w-xl">
              A Git reimplementation, a Linux container runtime, a poker server, a
              Strands solver, and a lecture-summary extension.
            </p>
          </div>
          <ol className="mt-12">
            {side.map((p) => (
              <Row key={p.slug} project={p} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
