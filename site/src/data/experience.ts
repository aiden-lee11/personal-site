export type Role = {
  company: string;
  title: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
  featured?: boolean;
};

export const experience: Role[] = [
  {
    company: "Pinterest",
    title: "Software Engineer Intern",
    location: "Remote",
    start: "Jun 2026",
    end: "Sep 2026",
    featured: true,
    bullets: [
      "Shipped Kafka High Disk agent (3–5×/day) on petabyte-scale clusters — automates broker-set analysis and mitigation via Slack for oncall.",
      "Building MCP + Skills tooling for logging alerts (CDC GTID diffing), replacing error-prone manual runbooks.",
      "Designing an internal OpenClaw integration where PagerDuty alerts auto-invoke agents that reply in the alert thread.",
    ],
  },
  {
    company: "360 Privacy",
    title: "Software Engineer Intern",
    location: "Remote",
    start: "Sep 2025",
    end: "Dec 2025",
    bullets: [
      "LangGraph state machine for automated parser generation with human-in-the-loop validation — cut manual transform effort on unstructured datasets.",
      "Parallelized producer-consumer pipeline streaming 1 GB+ files into Pinecone at 5× throughput.",
      "Identity-resolution system (union-find + weighted phonetic similarity) at 98.4% precision across 86K+ records.",
    ],
  },
  {
    company: "CodeHS",
    title: "Software Engineer Intern",
    location: "Chicago, IL",
    start: "Jun 2025",
    end: "Aug 2025",
    bullets: [
      "Built core utilities for Bool — 1K+ users generating websites from a prompt.",
      "High-performance async job processor (Django + Redis) with 99%+ reliable stream completion.",
      "Cut cloud costs 50% by eliminating duplicate startup instances spawning parallel workers.",
      "Shipped the promo engine powering discount codes and a feature-flag system for PM A/B testing.",
    ],
  },
];
