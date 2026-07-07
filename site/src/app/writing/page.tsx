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
    <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
      <header className="mb-16">
        <p className="font-mono text-xs text-[color:var(--muted)] uppercase tracking-wide mb-3">
          Writing
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl tracking-tight leading-tight">
          Notes I&apos;ve kept.
        </h1>
        <p className="mt-4 text-[color:var(--muted)] max-w-xl">
          Working out what I&apos;ve learned in the open.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-[color:var(--muted)] font-mono text-sm">
          Nothing published yet. Check back soon.
        </p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/writing/${p.slug}`}
                className="group grid grid-cols-[6rem_1fr_auto] items-baseline gap-4 py-4 border-b border-[color:var(--border)] hover:border-[color:var(--accent)] transition-colors"
              >
                <span className="font-mono text-xs text-[color:var(--muted)] tabular">
                  {p.date ?? ""}
                </span>
                <span>
                  <span className="font-serif text-2xl leading-tight group-hover:text-[color:var(--accent)] transition-colors">
                    {p.title}
                  </span>
                  {p.description && (
                    <span className="block text-sm text-[color:var(--muted)] mt-1">
                      {p.description}
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-[color:var(--muted)] whitespace-nowrap">
                  {p.readingTime}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
