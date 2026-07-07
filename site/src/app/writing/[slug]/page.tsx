import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug, getPostSlugs } from "@/lib/posts";
import { renderMarkdownToHtml } from "@/lib/markdown";

type Params = { slug: string };

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = getPostBySlug(slug);
    return {
      title: `${post.title} · Aiden Lee`,
      description: post.description,
    };
  } catch {
    return { title: "Not found" };
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  let post;
  try {
    post = getPostBySlug(slug);
  } catch {
    notFound();
  }

  const html = await renderMarkdownToHtml(post.content);

  return (
    <article className="mx-auto max-w-3xl px-6 pt-16 pb-24">
      <Link
        href="/writing"
        className="inline-block font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--accent)] mb-8"
      >
        ← Writing
      </Link>
      <header className="mb-12 pb-8 border-b border-[color:var(--border)]">
        {post.date && (
          <p className="font-mono text-xs text-[color:var(--muted)] mb-3 tabular">
            {post.date} · {post.readingTime}
          </p>
        )}
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-tight">
          {post.title}
        </h1>
      </header>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
