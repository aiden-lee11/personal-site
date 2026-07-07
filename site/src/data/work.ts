export type WorkItem = {
  company: string;
  role: string;
  start: string;
  end: string | "Present";
  highlights: string[];
};

export const workHistory: WorkItem[] = [
  {
    company: "360 Privacy",
    role: "Software Engineer Intern",
    start: "Sept. 2025",
    end: "Dec. 2025",
    highlights: [
      "Incoming Software Engineer on the Vulnerability Explorer team",
    ],
  },
  {
    company: "CodeHS",
    role: "Software Engineer Intern",
    start: "June 2025",
    end: "August 2025",
    highlights: [
      "Built out core utilities for early-stage development of Bool, helping 1k+ users create websites from a prompt",
      "Collaborated with a team to engineer a reliable, high-performance async job processor using Django and Redis",
      "Fixed a submission bug in network stream that led to a 50% reduction in cloud resources",
      "Engineered core systems including a promo code engine, asset management, and a feature flagging service",
    ],
  },
  {
    company: "ApplyRight",
    role: "Software Engineer Intern",
    start: "June 2024",
    end: "Dec. 2024",
    highlights: [
      "Led development of AI platform for high-quality college essay feedback, defining stakeholder requirements",
      "Created synthetic dataset pairing essay scoring, feedback, and reasoning traces to improve feedback",
    ],
  },
];


