import Link from "next/link";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { experience } from "@/data/experience";

const STATUS = [
  ["Work", "Pinterest", "SWE intern"],
  ["Focus", "On-call agents", "Kafka / MCP"],
  ["School", "Northwestern CS", "Class of 2027"],
  ["Based", "Evanston", "Illinois"],
];

const STATS = [
  ["536 ms", "winning benchmark"],
  ["18×", "faster than GCC"],
  ["21K+", "lines of C++"],
  ["10+", "optimization passes"],
];

const PIPELINE = [
  "LC · C-like source",
  "LB · scoped control flow",
  "LA · flat branches",
  "IR · control flow",
  "L3 · instruction selection",
  "L2 · register allocation",
  "L1 · machine operations",
  "x86-64 · assembly",
];

function Section({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[color:var(--border)] py-14 sm:py-20">
      <div className="grid gap-8 md:grid-cols-[12rem_1fr] md:gap-12 lg:gap-20">
        <div className="flex items-baseline justify-between gap-4 md:block">
          <p className="eyebrow md:sticky md:top-24">{label}</p>
          {aside && <div className="md:mt-4">{aside}</div>}
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

export default function Home() {
  const featuredProject = projects.find((p) => p.featured) ?? projects[0];
  const otherProjects = projects.filter((p) => p.slug !== featuredProject.slug).slice(0, 3);
  const featuredRole = experience.find((r) => r.featured) ?? experience[0];
  const pastRoles = experience.filter((r) => !r.featured);

  return (
    <div className="mx-auto max-w-5xl px-6">
      {/* Hero */}
      <section className="grid gap-x-16 gap-y-12 pt-20 pb-16 sm:pt-28 lg:grid-cols-[1fr_15rem]">
        <div>
          <p className="eyebrow">Aiden Lee — Software engineer</p>
          <h1 className="mt-8 text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
            Compilers.
            <br />
            Infrastructure.
            <br />
            <span className="text-[color:var(--accent)]">Developer tools.</span>
          </h1>
          <p className="mt-9 max-w-xl text-lg leading-relaxed text-[color:var(--muted)]">
            I&apos;m a Northwestern CS student, currently at Pinterest. I like
            making people&apos;s lives easier, and I like code that runs fast.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/compiler" className="btn btn-primary">
              Explore my compiler <span aria-hidden>↗</span>
            </Link>
            <Link href="/projects" className="btn btn-ghost">
              View projects <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 self-end lg:grid-cols-1 lg:gap-y-7">
          {STATUS.map(([label, value, detail]) => (
            <div key={label}>
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-2 text-sm font-medium">{value}</dd>
              <dd className="mt-0.5 font-mono text-[11px] text-[color:var(--muted)]">
                {detail}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Featured — the compiler */}
      <Section label="Featured project">
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-[-0.035em]">
          {featuredProject.title}
        </h2>
        <p className="mt-5 max-w-xl text-[color:var(--muted)] leading-relaxed">
          A C-like language lowered through six intermediate layers to x86-64 —
          the whole pipeline runs live in this site.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {STATS.map(([value, label]) => (
            <div key={label}>
              <p className="font-mono text-2xl tracking-tight text-[color:var(--accent)]">
                {value}
              </p>
              <p className="mt-1.5 text-xs text-[color:var(--muted)]">{label}</p>
            </div>
          ))}
        </div>

        <ol className="group mt-10 space-y-1 font-mono text-sm">
          {PIPELINE.map((layer, i) => {
            const isLast = i === PIPELINE.length - 1;
            return (
              <li
                key={layer}
                className={`flex items-center gap-3 transition-colors hover:text-[color:var(--fg)]! ${
                  isLast
                    ? "text-[color:var(--fg)] group-hover:text-[color:var(--muted)]"
                    : "text-[color:var(--muted)]"
                }`}
              >
                <span className="w-6 text-[11px] opacity-50">{String(i + 1).padStart(2, "0")}</span>
                <span>{layer}</span>
              </li>
            );
          })}
        </ol>

        <Link
          href={featuredProject.href ?? "/projects"}
          className="mt-9 inline-block font-mono text-sm link-underline"
        >
          Open the interactive compiler ↗
        </Link>
      </Section>

      {/* Selected work */}
      <Section
        label="Selected work"
        aside={
          <Link
            href="/projects"
            className="font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            All projects →
          </Link>
        }
      >
        <ul className="space-y-8">
          {otherProjects.map((p) => (
            <li key={p.slug}>
              <Link href={p.href ?? "/projects"} className="group block">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-xl font-semibold tracking-tight group-hover:text-[color:var(--accent)] transition-colors">
                    {p.title}
                  </h3>
                  <span className="font-mono text-[11px] text-[color:var(--muted)] whitespace-nowrap">
                    {p.period.split(" – ")[0]}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-[color:var(--muted)]">{p.tagline}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)] opacity-70">
                  {p.stack.join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Experience */}
      <Section label="Right now">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-xl font-semibold">
            {featuredRole.company} · {featuredRole.title}
          </h3>
          <span className="font-mono text-[11px] text-[color:var(--muted)]">
            {featuredRole.start} — {featuredRole.end}
          </span>
        </div>
        <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-[color:var(--muted)]">
          {featuredRole.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3">
              <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[color:var(--accent)]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {pastRoles.map((role) => (
            <div key={role.company}>
              <p className="font-semibold">{role.company}</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">{role.title}</p>
              <p className="mt-2 font-mono text-[10px] text-[color:var(--muted)]">
                {role.start} — {role.end}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Writing — hidden for now (only one post). Route still at /writing. */}

      {/* Contact */}
      <Section label="Contact">
        <p className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] leading-snug">
          Let&apos;s talk.
        </p>
        <a
          href={`mailto:${profile.email}`}
          className="mt-4 inline-block text-lg link-underline break-all"
        >
          {profile.email}
        </a>
      </Section>
    </div>
  );
}
