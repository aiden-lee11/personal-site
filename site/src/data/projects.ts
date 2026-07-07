export type Project = {
  name: string;
  description: string;
  link?: string;
};

export const projects: Project[] = [
  {
    name: "Raft",
    description: "Fault-tolerant key-value store implementing distributed consensus (Go).",
  },
  {
    name: "NUFood",
    description: "Fast dining hall app; 90% latency reduction with batched prefetching and caching (Go, TS, React, PostgreSQL).",
    link: "https://www.dineon.nu/",
  },
  {
    name: "AutoStory",
    description: "Automation pipeline converting Reddit stories into TikTok videos with narration, captions, and visuals; published 100+ videos/month and reached 10k+ views in the first month.",
  },
  {
    name: "Universal Playlists",
    description: "Flask full‑stack app to unify playlist management across Spotify and Apple Music; 95% faster transfers via cross‑platform pattern matching.",
  },
  {
    name: "Go Poker",
    description: "Real‑time poker platform in Go using WebSockets; concurrent Monte Carlo simulations and hand evaluation to compute win probabilities.",
  },
];


