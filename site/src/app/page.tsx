import Link from "next/link";
import Image from "next/image";
import { profile } from "@/data/profile";
import { projects, type Project } from "@/data/projects";
import { experience } from "@/data/experience";

const STATUS = [
  ["Work", "Pinterest", "SWE intern"],
  ["Focus", "On-call agents", "Kafka / MCP"],
  ["School", "Northwestern CS", "Class of 2027"],
  ["Based", "Evanston", "Illinois"],
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
  // Explicit pick + order for the home page; /projects keeps its own order.
  const otherProjects = ["nufood", "nu-esports-bot", "the-end", "content"]
    .map((slug) => projects.find((p) => p.slug === slug))
    .filter((p): p is Project => Boolean(p));
  const featuredRole = experience.find((r) => r.featured) ?? experience[0];
  const pastRoles = experience.filter((r) => !r.featured);

  return (
    <div className="mx-auto max-w-5xl px-6">
      {/* Hero */}
      <section className="relative grid gap-x-16 gap-y-12 pt-20 pb-16 sm:pt-28 lg:grid-cols-[1fr_15rem]">
        {/* Warm desk-lamp glow behind the headline — see .hero-lamp. */}
        <div className="hero-lamp" aria-hidden />
        <div>
          <p className="eyebrow">Aiden Lee — Software engineer</p>
          <h1 className="mt-8 text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
            Hi, I&apos;m Aiden.
          </h1>
          <p className="mt-9 max-w-xl text-lg leading-relaxed text-[color:var(--muted)]">
            I&apos;m a Northwestern CS student, currently at Pinterest. I like
            making people&apos;s lives easier, and code that runs fast.
          </p>
          <div className="mt-10">
            <Link href="/compiler" className="btn btn-primary">
              Explore my compiler <span aria-hidden>↗</span>
            </Link>
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-8 sm:mt-16 sm:grid-cols-4">
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
        </div>

        <div className="lg:self-start">
          <Image
            src="/aiden-platform.jpg"
            alt="Aiden on a Chicago L platform"
            width={800}
            height={800}
            priority
            className="hero-photo w-40 self-start aspect-square lg:w-full"
          />
        </div>
      </section>

      {/* Featured — the compiler */}
      <Section label="Featured project">
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-[-0.035em]">
          {featuredProject.title}
        </h2>
        <p className="mt-5 max-w-xl text-[color:var(--muted)] leading-relaxed">
          My partner and I built this compiler for Northwestern&apos;s CS 322
          class competition. After we won, I thought it&apos;d be fun to show it
          off, so I ported it to WebAssembly: write a little C-like code, see
          how it changes on the way to assembly, and run it right here.
        </p>

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
          {otherProjects.map((p) => {
            const external = p.href?.startsWith("http");
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-xl font-semibold tracking-tight group-hover:text-[color:var(--accent)] transition-colors">
                    {p.title}
                    {external && <span aria-hidden> ↗</span>}
                  </h3>
                  <span className="font-mono text-[11px] text-[color:var(--muted)] whitespace-nowrap">
                    {p.period.split(" – ")[0]}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-[color:var(--muted)]">{p.tagline}</p>
                {p.stack.length > 0 && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)] opacity-70">
                    {p.stack.join(" · ")}
                  </p>
                )}
              </>
            );
            return (
              <li key={p.slug}>
                {external ? (
                  <a href={p.href} target="_blank" rel="noreferrer" className="group block">
                    {inner}
                  </a>
                ) : (
                  <Link href={p.href ?? "/projects"} className="group block">
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
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
        <a
          href={`mailto:${profile.email}`}
          className="inline-block text-lg link-underline break-all"
        >
          {profile.email}
        </a>
      </Section>
    </div>
  );
}
