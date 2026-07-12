import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Writing · Aiden Lee",
  description: "Notes on engineering, performance, and building things.",
};

export default function WritingIndex() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-5xl px-6 pt-20 pb-24 sm:pt-28">
      <header className="grid gap-6 pb-16 lg:grid-cols-[1fr_18rem] lg:items-end">
        <div>
          <p className="eyebrow">Writing</p>
          <h1 className="mt-6 text-5xl sm:text-7xl font-semibold tracking-[-0.05em] leading-[0.95]">
            Notes
          </h1>
        </div>
        <p className="text-[color:var(--muted)] lg:text-right">
          Technical notes and project write-ups.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-[color:var(--muted)] font-mono text-sm">Nothing published yet.</p>
      ) : (
        <ul>
          {posts.map((p) => (
            <li key={p.slug} className="border-t border-[color:var(--border)] first:border-t-0">
              <Link
                href={`/writing/${p.slug}`}
                className="group grid gap-2 py-8 md:grid-cols-[12rem_1fr] md:gap-12 lg:gap-20"
              >
                <p className="font-mono text-[11px] text-[color:var(--muted)] tabular md:pt-1">
                  {p.date ?? ""}
                </p>
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight group-hover:text-[color:var(--accent)] transition-colors">
                      {p.title}
                    </h2>
                    <span className="font-mono text-[11px] text-[color:var(--muted)] whitespace-nowrap">
                      {p.readingTime}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-2 text-sm text-[color:var(--muted)] max-w-xl">
                      {p.description}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
