export type Project = {
  slug: string;
  title: string;
  tagline: string;
  stack: string[];
  period: string;
  bullets: string[];
  links?: { label: string; href: string }[];
  featured?: boolean;
  href?: string;
  // Side projects — smaller than the resume-tier work, but shown to convey range.
  side?: boolean;
};

export type LiveThing = {
  title: string;
  blurb: string;
  href: string;
  cta: string;
  external?: boolean;
};

// Things a visitor can try right now — no cloning, no setup.
export const LIVE: LiveThing[] = [
  {
    title: "Compiler",
    blurb: "Write C-like code and run it in your browser.",
    href: "/compiler",
    cta: "open the playground",
  },
  {
    title: "NUFood",
    blurb: "Dining-hall menus for Northwestern.",
    href: "https://nufood.me",
    cta: "visit nufood.me",
    external: true,
  },
  {
    title: "The End",
    blurb: "A Minecraft End scene in hand-rolled WebGL.",
    href: "/the-end",
    cta: "fly around the End",
  },
  {
    title: "Panopto Summarizer",
    blurb: "Lecture summaries when you need them.",
    href: "https://chromewebstore.google.com/detail/panopto-summarizer/cpeanbbcgghgjbpjpkgidndkmhgoplob?hl=en",
    cta: "install from the web store",
    external: true,
  },
  {
    title: "YouTube",
    blurb: "Coding streams and project builds.",
    href: "https://www.youtube.com/@aiden-lee11",
    cta: "watch on YouTube",
    external: true,
  },
];

export const projects: Project[] = [
  {
    slug: "compiler",
    title: "C-Like Compiler",
    tagline: "A C-like compiler built from scratch in C++",
    stack: ["C++23", "PEGTL", "SSA", "x86-64"],
    period: "Mar 2026 – Jun 2026",
    featured: true,
    href: "/compiler",
    bullets: [
      "Built every part with a partner in 21K+ lines of C++. Won the class competition: fastest of 100+ students and 2× faster than the previous winner.",
      "Lowers C-like source through multiple IR layers before emitting x86-64.",
      "Includes 10+ IR optimizations, graph-coloring register allocation, and instruction tiling on the backend.",
    ],
    links: [
      { label: "Try the visualizer", href: "/compiler" },
      { label: "LinkedIn post", href: "https://www.linkedin.com/feed/update/urn:li:activity:7476648103211585536/" },
    ],
  },
  {
    slug: "the-end",
    title: "The End (WebGL)",
    tagline: "A Minecraft End scene rendered from scratch in WebGL",
    stack: ["JavaScript", "WebGL", "GLSL"],
    period: "Nov 2025 – Dec 2025",
    href: "/the-end",
    bullets: [
      "Hand-rolled WebGL with no engine and no three.js, from the scene graph to the GLSL shaders.",
      "The scene has the ender dragon, up to 250 endermen wandering procedural terrain, end crystals, and torches you can place.",
      "Fly-through camera controls to move around the world.",
    ],
    links: [
      { label: "Fly around the End", href: "/the-end" },
    ],
  },
  {
    slug: "nufood",
    title: "NUFood",
    tagline: "A faster way to check Northwestern dining-hall menus",
    stack: ["Go", "TypeScript", "React", "PostgreSQL", "AWS"],
    period: "Sep 2024 – Present",
    href: "https://nufood.me",
    bullets: [
      "Used by more than 500 students and featured in The Daily Northwestern.",
      "Built the backend to make menus load quickly and stay easy to search.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/nufood" },
      { label: "nufood.me", href: "https://nufood.me" },
    ],
  },
  {
    slug: "nu-esports-bot",
    title: "NU Esports Discord Bot",
    tagline: "A Discord bot for checking campus game-room availability",
    stack: ["Python", "PostgreSQL", "Docker"],
    period: "Sep 2025 – Present",
    href: "https://github.com/aiden-lee11/nu-esports-bot",
    bullets: [
      "Helps more than 1,500 students see what rooms and PCs are available before walking over.",
      "Also handles reservations and team scheduling.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/nu-esports-bot" },
    ],
  },
  {
    slug: "content",
    title: "YouTube — @aiden-lee11",
    tagline: "Coding streams, interview prep, and project builds",
    stack: ["OBS", "Real-time coding"],
    period: "Dec 2024 – Present",
    href: "https://www.youtube.com/@aiden-lee11",
    bullets: [
      "More than 350 videos and 2,000 subscribers.",
    ],
    links: [
      { label: "YouTube", href: "https://www.youtube.com/@aiden-lee11" },
    ],
  },

  // — side projects, smaller in scope but real —

  {
    slug: "panopto-summaries",
    title: "panopto-summaries",
    tagline: "A Chrome extension for AI lecture summaries",
    stack: ["JavaScript", "Chrome extension", "OpenAI", "Gemini"],
    period: "Feb 2026 – Present",
    side: true,
    bullets: [
      "Turns a lecture transcript into notes right on the Panopto page.",
      "Built the day I realized I could either watch the whole recording or read the notes in five minutes.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/panopto-summaries" },
      { label: "Chrome Web Store", href: "https://chromewebstore.google.com/detail/panopto-summarizer/cpeanbbcgghgjbpjpkgidndkmhgoplob?hl=en" },
    ],
  },
  {
    slug: "poker",
    title: "Go Poker",
    tagline: "Multiplayer poker in the browser",
    stack: ["Go", "WebSockets", "Monte Carlo"],
    period: "Jan 2025 – Mar 2025",
    side: true,
    bullets: [
      "Keeps a live game in sync over WebSockets and estimates hand odds as you play.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/poker" },
    ],
  },
  {
    slug: "stop",
    title: "STOP",
    tagline: "A C++ solver for NYT Strands",
    stack: ["C++", "DFS", "BFS"],
    period: "2025",
    side: true,
    bullets: [
      "Finds every valid word on the day's board.",
      "Written mostly to stop losing to my friends.",
    ],
    links: [{ label: "GitHub", href: "https://github.com/aiden-lee11/STOP" }],
  },
  {
    slug: "lit",
    title: "lit",
    tagline: "A small reimplementation of Git in C++",
    stack: ["C++", "SHA-1", "Zlib"],
    period: "2025",
    side: true,
    bullets: [
      "Reads and writes Git's object format directly, without calling the Git CLI.",
    ],
    links: [{ label: "GitHub", href: "https://github.com/aiden-lee11/lit" }],
  },
  {
    slug: "baby-docker",
    title: "baby-docker",
    tagline: "A small Linux container runtime in C++",
    stack: ["C++", "Linux syscalls", "clone()", "namespaces"],
    period: "2025",
    side: true,
    bullets: [
      "Runs isolated processes with Linux namespaces, without a Docker daemon.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/baby-docker" },
    ],
  },
];
