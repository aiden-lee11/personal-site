"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/compiler", label: "Overview" },
  { href: "/compiler/playground", label: "Playground" },
  { href: "/compiler/passes", label: "Passes" },
  { href: "/compiler/grammar", label: "Language" },
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
            className={`group relative px-3.5 py-3 font-mono text-[13px] tracking-wide transition-colors ${
              active
                ? "text-[color:var(--fg)] font-medium"
                : "text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            }`}
          >
            {t.label}
            {active ? (
              <span className="absolute inset-x-3.5 -bottom-px h-[2px] bg-[color:var(--accent)]" />
            ) : (
              <span className="absolute inset-x-3.5 -bottom-px h-[2px] bg-[color:var(--border)] opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
