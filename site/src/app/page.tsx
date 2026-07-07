import Link from "next/link";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { experience } from "@/data/experience";
import { getAllPosts } from "@/lib/posts";

export default function Home() {
  const featuredProject = projects.find((p) => p.featured) ?? projects[0];
  const otherProjects = projects.filter((p) => p.slug !== featuredProject.slug).slice(0, 3);
  const posts = getAllPosts().slice(0, 3);
  const featuredRole = experience.find((r) => r.featured) ?? experience[0];

  return (
    <div className="mx-auto max-w-5xl px-6">
      {/* Hero */}
      <section className="pt-20 pb-16 sm:pt-28 sm:pb-24">
        <p className="font-mono text-xs text-[color:var(--muted)] mb-6 tracking-wide uppercase">
          Northwestern CS · Spring 2027
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight max-w-3xl">
          Hi, I&apos;m Aiden.
          <br />
          <span className="text-[color:var(--muted)]">
            I build{" "}
            <span className="text-[color:var(--fg)] italic">compilers</span>,{" "}
            <span className="text-[color:var(--fg)] italic">distributed systems</span>,
            <br className="hidden sm:block" />
            and interactive tools.
          </span>
        </h1>
        <p className="mt-8 text-base sm:text-lg text-[color:var(--muted)] max-w-2xl leading-relaxed">
          Currently interning at <span className="text-[color:var(--fg)]">Pinterest</span> on
          agent tooling for oncall. I care about work that&apos;s fast enough to feel invisible
          and clear enough to teach — the last one is why my compiler lives inside this
          site as{" "}
          <Link
            href="/compiler"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1 hover:decoration-2"
          >
            an interactive visualizer
          </Link>
          .
        </p>
        <div className="mt-10 flex flex-wrap gap-3 font-mono text-sm">
          <Link
            href="/compiler"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--fg)] text-[color:var(--bg)] hover:bg-[color:var(--accent)] transition-colors"
          >
            <span>Try the compiler visualizer</span>
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[color:var(--border)] hover:border-[color:var(--fg)] transition-colors"
          >
            All projects
          </Link>
        </div>
      </section>

      <hr className="rule-accent" />

      {/* Featured project */}
      <section className="py-16 sm:py-20">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            Featured
          </h2>
          <Link
            href={featuredProject.href ?? "/projects"}
            className="font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            open →
          </Link>
        </div>
        <div className="grid lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3">
            <h3 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
              {featuredProject.title}
            </h3>
            <p className="mt-3 text-[color:var(--muted)] text-lg">
              {featuredProject.tagline}
            </p>
            <ul className="mt-6 space-y-2 text-[15px] leading-relaxed">
              {featuredProject.bullets.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="text-[color:var(--accent)] mt-[0.5em] shrink-0">▸</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="lg:col-span-2 lg:pl-8 lg:border-l border-[color:var(--border)]">
            <p className="font-mono text-xs text-[color:var(--muted)]">Stack</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {featuredProject.stack.map((s) => (
                <li
                  key={s}
                  className="font-mono text-[11px] px-2 py-1 rounded bg-[color:var(--subtle)]"
                >
                  {s}
                </li>
              ))}
            </ul>
            <p className="font-mono text-xs text-[color:var(--muted)] mt-6">Period</p>
            <p className="font-mono text-sm mt-2">{featuredProject.period}</p>
          </aside>
        </div>
      </section>

      <hr className="rule-accent" />

      {/* Other projects */}
      <section className="py-16 sm:py-20">
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-8">
          Selected work
        </h2>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
          {otherProjects.map((p) => (
            <article key={p.slug} className="group">
              <div className="flex items-baseline gap-3 mb-1">
                <h3 className="font-serif text-2xl tracking-tight">
                  {p.href ? (
                    <Link
                      href={p.href}
                      className="group-hover:text-[color:var(--accent)] transition-colors"
                    >
                      {p.title}
                    </Link>
                  ) : (
                    p.title
                  )}
                </h3>
                <span className="font-mono text-xs text-[color:var(--muted)] tabular">
                  {p.period.split(" – ")[0]}
                </span>
              </div>
              <p className="text-[color:var(--muted)] text-sm mb-3">{p.tagline}</p>
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
            </article>
          ))}
        </div>
        <Link
          href="/projects"
          className="inline-block mt-10 font-mono text-sm text-[color:var(--muted)] hover:text-[color:var(--accent)]"
        >
          → All projects
        </Link>
      </section>

      <hr className="rule-accent" />

      {/* Now / Experience */}
      <section className="py-16 sm:py-20">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-4">
              Now
            </h2>
            <p className="font-serif text-2xl leading-tight">
              {featuredRole.title} at{" "}
              <span className="italic">{featuredRole.company}</span>.
            </p>
            <p className="font-mono text-xs text-[color:var(--muted)] mt-2 tabular">
              {featuredRole.start} → {featuredRole.end}
            </p>
          </div>
          <ul className="lg:col-span-3 space-y-3 text-[15px] leading-relaxed">
            {featuredRole.bullets.map((b) => (
              <li key={b} className="flex gap-3">
                <span className="text-[color:var(--accent)] mt-[0.5em] shrink-0">▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 pt-8 border-t border-[color:var(--border)] grid sm:grid-cols-2 gap-4">
          {experience.filter((r) => !r.featured).map((r) => (
            <div key={r.company} className="font-mono text-sm flex items-baseline gap-3">
              <span className="text-[color:var(--muted)] tabular whitespace-nowrap">
                {r.start.split(" ").pop()}
              </span>
              <span className="flex-1">
                <span className="text-[color:var(--fg)]">{r.company}</span>{" "}
                <span className="text-[color:var(--muted)]">— {r.title}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {posts.length > 0 && (
        <>
          <hr className="rule-accent" />
          <section className="py-16 sm:py-20">
            <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-8">
              Writing
            </h2>
            <ul className="space-y-4">
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/writing/${p.slug}`}
                    className="group flex items-baseline gap-4 py-3 border-b border-[color:var(--border)] hover:border-[color:var(--accent)] transition-colors"
                  >
                    <span className="font-mono text-xs text-[color:var(--muted)] tabular whitespace-nowrap">
                      {p.date ?? ""}
                    </span>
                    <span className="font-serif text-xl group-hover:text-[color:var(--accent)] transition-colors">
                      {p.title}
                    </span>
                    <span className="ml-auto font-mono text-xs text-[color:var(--muted)]">
                      {p.readingTime}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <hr className="rule-accent" />

      {/* Contact strip */}
      <section className="py-16 sm:py-20">
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-6">
          Say hi
        </h2>
        <p className="font-serif text-2xl sm:text-3xl leading-tight max-w-2xl">
          The best way to reach me is{" "}
          <a
            href={`mailto:${profile.email}`}
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1 hover:decoration-2"
          >
            {profile.email}
          </a>
          .
        </p>
        <p className="mt-4 text-[color:var(--muted)]">
          Or find me on{" "}
          <a href={profile.github} className="text-[color:var(--fg)] underline underline-offset-4">
            GitHub
          </a>
          ,{" "}
          <a href={profile.linkedin} className="text-[color:var(--fg)] underline underline-offset-4">
            LinkedIn
          </a>
          , and{" "}
          <a href={profile.youtube} className="text-[color:var(--fg)] underline underline-offset-4">
            YouTube
          </a>
          .
        </p>
      </section>
    </div>
  );
}
