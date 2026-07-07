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

export const projects: Project[] = [
  {
    slug: "compiler",
    title: "Optimizing Compiler",
    tagline: "5-stage C-like → x86-64 compiler, 21K+ lines of C++",
    stack: ["C++23", "PEGTL", "SSA", "x86-64"],
    period: "Mar 2026 – Jun 2026",
    featured: true,
    href: "/compiler",
    bullets: [
      "Won the class compiler competition at 536 ms — 18× faster than GCC, 2× faster than the previous winner.",
      "Lowers a C-like source through LC → LB → LA → IR → L3 → L2 → L1 → x86-64.",
      "10+ SSA-based optimizations (SCCP, GVN, LICM, DCE, VRA/BCE, algebraic simplification, copy prop, out-of-SSA, CFG simplify, peephole).",
      "Graph-coloring register allocation and instruction tiling on the backend.",
    ],
    links: [
      { label: "Try the visualizer", href: "/compiler" },
    ],
  },
  {
    slug: "nu-esports-bot",
    title: "NU Esports Discord Bot",
    tagline: "Real-time game-room visibility for 1,500+ students",
    stack: ["Python", "PostgreSQL", "Docker"],
    period: "Sep 2025 – Present",
    bullets: [
      "Shipped commands that give 1,500+ students live game-room availability, replacing walk-in checks.",
      "Self-hosted GGLeap proxy reusing attendant session JWT to unlock PC state and reservation endpoints.",
      "PostgreSQL reservation scheduler with conflict detection, room allocation, and prime-time quotas per team.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/nu-esports-bot" },
    ],
  },
  {
    slug: "nufood",
    title: "NUFood",
    tagline: "Dining-hall app used by 500+ students, featured in The Daily Northwestern",
    stack: ["Go", "TypeScript", "React", "PostgreSQL", "AWS"],
    period: "Sep 2024 – Sep 2025",
    bullets: [
      "Optimized dining-hall menu app used by 500+ students; covered in The Daily Northwestern.",
      "Go backend with 90% latency reduction vs available alternatives.",
      "Deployed on AWS with a batched pipeline that caches all pages upfront for instant UI filtering.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/nufood" },
    ],
  },
  {
    slug: "content",
    title: "YouTube — @aiden-lee11",
    tagline: "Live-programming content · 2K+ subs · 125K+ views",
    stack: ["OBS", "Real-time coding"],
    period: "Dec 2024 – Present",
    bullets: [
      "Long-form programming streams and edits — 2,000+ subscribers, 125,000+ views to date.",
    ],
    links: [
      { label: "YouTube", href: "https://www.youtube.com/@aiden-lee11" },
    ],
  },

  // — side projects, smaller in scope but real —

  {
    slug: "lit",
    title: "lit",
    tagline: "A from-scratch reimplementation of git in C++",
    stack: ["C++", "SHA-1", "Zlib"],
    period: "2025",
    side: true,
    bullets: [
      "`lit init / hash-object / add / commit / status / log` implemented against the real .git object-store layout — SHA-1-addressed blobs, trees, commits.",
      "Written to internalize how git actually stores content, not to be a drop-in replacement.",
    ],
    links: [{ label: "GitHub", href: "https://github.com/aiden-lee11/lit" }],
  },
  {
    slug: "baby-docker",
    title: "baby-docker",
    tagline: "A minimal Linux container runtime in C++",
    stack: ["C++", "Linux syscalls", "clone()", "namespaces"],
    period: "2025",
    side: true,
    bullets: [
      "Uses raw `clone()` with `CLONE_NEWPID/UTS/NS` flags to isolate a child process into its own namespaces — the same primitive Docker uses under the hood.",
      "Built to demystify what a container actually is: a normal process with unshared kernel namespaces.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/baby-docker" },
    ],
  },
  {
    slug: "poker",
    title: "Go Poker",
    tagline: "Real-time multiplayer poker over WebSockets",
    stack: ["Go", "WebSockets", "Monte Carlo"],
    period: "Jan 2025 – Mar 2025",
    side: true,
    bullets: [
      "Concurrent Go backend serving live game state to browsers over a single WebSocket per player.",
      "Monte Carlo hand evaluator running 10K+ win-probability simulations per hand in real time.",
      "Modular room/table/hand model with unit-tested evaluator on top.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/aiden-lee11/poker" },
    ],
  },
  {
    slug: "regex-lab",
    title: "regex-lab",
    tagline: "An interactive playground for regex — see matches highlighted as you type",
    stack: ["TypeScript", "Next.js", "React"],
    period: "2025",
    side: true,
    bullets: [
      "Live matching + capture-group inspection with the pattern and test text side by side.",
      "Same shape as this site's compiler visualizer — small, interactive, teaches one concept.",
    ],
    links: [
      { label: "Live", href: "https://regex-lab.vercel.app" },
      { label: "GitHub", href: "https://github.com/aiden-lee11/regex-lab" },
    ],
  },
];
