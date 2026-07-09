"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/compiler", label: "Overview" },
  { href: "/compiler/playground", label: "Playground" },
  { href: "/compiler/passes", label: "Passes" },
];

export default function CompilerNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Compiler sections"
      className="mb-10 flex items-center gap-1 border-b border-[color:var(--border)]"
    >
      {TABS.map((t) => {
        const active =
          t.href === "/compiler"
            ? pathname === "/compiler"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative px-3 py-2.5 font-mono text-xs tracking-wide transition-colors ${
              active
                ? "text-[color:var(--fg)]"
                : "text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            }`}
          >
            {t.label}
            {active && (
              <span className="absolute inset-x-3 -bottom-px h-[2px] bg-[color:var(--accent)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
