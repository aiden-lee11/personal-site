import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/posts";
import { renderMarkdownToHtml } from "@/lib/markdown";

export const dynamic = "force-static";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Aiden Lee`,
    description: post.description,
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  const contentHtml = await renderMarkdownToHtml(post.content);

  return (
    <main className="min-h-screen py-10 max-w-3xl">
      <h1 className="font-press text-[24px] mb-1">{post.title}</h1>
      <p className="font-vt text-[18px] text-neutral-500">
        {post.readingTime}
        {post.date ? ` · ${new Date(post.date).toLocaleDateString('en-US')}` : ""}
      </p>
      {post.description && (
        <p className="mt-2 font-vt text-[20px] text-neutral-600 dark:text-neutral-400">{post.description}</p>
      )}
      <div className="my-6 pixel-border" />
      <article className="prose prose-neutral dark:prose-invert" dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </main>
  );
}


