import type { Metadata } from "next";
import { getAllPosts } from "@/lib/posts";
import { PostsScroller } from "@/components/PostsScroller";
import { SectionTitle } from "@/components/Pixel";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Build notes — Aiden Lee",
  description: "Performance, web, and product write-ups from projects I'm building.",
};

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <main className="min-h-screen py-10">
      <h1 className="font-press text-[24px] mb-2">Build notes</h1>
      <p className="font-vt text-[20px] text-neutral-600 dark:text-neutral-400 mb-4">Short summaries as titles; click to read the full write-up.</p>
      <SectionTitle>All posts</SectionTitle>
      <PostsScroller posts={posts} />
    </main>
  );
}


