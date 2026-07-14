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
      "Built tools that help on-call engineers investigate and respond to Kafka alerts.",
      "Working on alert tooling that replaces manual runbooks with useful context and next steps.",
    ],
  },
  {
    company: "360 Privacy",
    title: "Software Engineer Intern",
    location: "Remote",
    start: "Sep 2025",
    end: "Dec 2025",
    bullets: [
      "Built a tool to help turn messy datasets into reliable parsers.",
      "Made large file processing five times faster.",
    ],
  },
  {
    company: "CodeHS",
    title: "Software Engineer Intern",
    location: "Chicago, IL",
    start: "Jun 2025",
    end: "Aug 2025",
    bullets: [
      "Built product and infrastructure work for Bool, a website builder used by more than 1,000 people.",
      "Made background jobs more reliable and cut cloud costs in half.",
    ],
  },
];
