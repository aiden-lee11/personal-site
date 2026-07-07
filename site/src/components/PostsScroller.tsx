'use client';

import type { PostMeta } from "@/lib/posts";
import { motion } from "framer-motion";
import Link from "next/link";

type Props = {
  posts: PostMeta[];
};

export function PostsScroller({ posts }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 snap-x snap-mandatory pb-4">
        {posts.map((post, index) => (
          <motion.div
            key={post.slug}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
            viewport={{ once: true }}
            className="min-w-[320px] max-w-[360px] snap-start rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-black/40 backdrop-blur p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
            {post.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3 mb-3">
                {post.description}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{post.readingTime}</span>
              {post.date && <span>{new Date(post.date).toLocaleDateString('en-US')}</span>}
            </div>
            <Link
              className="mt-4 inline-block text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              href={`/blog/${post.slug}`}
            >
              Read →
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}


