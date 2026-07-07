import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";

export type PostMeta = {
  slug: string;
  title: string;
  description?: string;
  date?: string;
  readingTime: string;
};

export type Post = PostMeta & {
  content: string;
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

function ensurePostsDir(): void {
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }
}

export function getPostSlugs(): string[] {
  ensurePostsDir();
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

function toSentenceCandidates(markdown: string): string[] {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^>.*$/gm, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p && p.length > 0);
}

function clampWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ").trim() + "…";
}

function smartFallbackTitle(markdown: string): string {
  const lower = markdown.toLowerCase();
  const mentionsNUFood = /nufood/i.test(markdown);
  const mentionsInMemory = /in-?memory/i.test(lower);
  const mentionsCache = /cache/i.test(lower);
  const mentionsPerf = /(speed|load ?time|performance|gzip)/i.test(lower);
  const mentionsX = /(10x|20x)/i.exec(markdown)?.[0];
  if (mentionsNUFood && (mentionsInMemory || mentionsCache)) {
    return `NUFood performance: ${mentionsInMemory ? "in‑memory caching" : "caching"}${mentionsX ? ` (${mentionsX})` : ""}`;
  }
  if (mentionsPerf) {
    return "Performance notes";
  }
  const firstSentence = toSentenceCandidates(markdown)[0] ?? "Notes";
  return clampWords(firstSentence.replace(/`/g, ""), 12);
}

function extractTitleAndExcerpt(markdown: string): { title: string; excerpt?: string } {
  const lines = markdown.split(/\r?\n/);
  let title: string | undefined;
  let excerpt: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("# ")) {
      title = line.replace(/^#\s+/, "").trim();
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (next.length === 0) continue;
        if (next.startsWith("#")) break;
        excerpt = clampWords(next, 32);
        break;
      }
      break;
    }
  }
  if (!title) {
    title = smartFallbackTitle(markdown);
    const firstSentence = toSentenceCandidates(markdown)[0];
    if (firstSentence) {
      excerpt = clampWords(firstSentence, 40);
    }
  }
  return { title, excerpt };
}

export function getPostBySlug(slug: string): Post {
  ensurePostsDir();
  const fullPath = path.join(POSTS_DIR, `${slug}.md`);
  const file = fs.readFileSync(fullPath, "utf8");
  const { content, data } = matter(file);
  const { title: fmTitle, description: fmDescription, date } = data as {
    title?: string;
    description?: string;
    date?: string;
  };
  const { title: derivedTitle, excerpt } = extractTitleAndExcerpt(content);
  const meta: PostMeta = {
    slug,
    title: fmTitle ?? derivedTitle,
    description: fmDescription ?? excerpt,
    date,
    readingTime: readingTime(content).text,
  };
  return { ...meta, content };
}

export function getAllPosts(): PostMeta[] {
  const slugs = getPostSlugs();
  const posts = slugs.map((slug) => getPostBySlug(slug));
  return posts
    .map(({ content, ...meta }) => meta)
    .sort((a, b) => {
      if (a.date && b.date) return a.date > b.date ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
}


