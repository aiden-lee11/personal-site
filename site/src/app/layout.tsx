import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Aiden Lee",
  description:
    "Aiden Lee — CS at Northwestern. Compilers, distributed systems, and interactive tools.",
  metadataBase: new URL("https://aidenlee.dev"),
  openGraph: {
    title: "Aiden Lee",
    description:
      "CS at Northwestern. Compilers, distributed systems, and interactive tools.",
    url: "/",
    siteName: "Aiden Lee",
    type: "website",
  },
  // Tell the Dark Reader browser extension to skip this site — we already
  // ship our own dark theme via prefers-color-scheme, so its DOM mutations
  // are redundant and cause hydration warnings.
  other: { "darkreader-lock": "true" },
};

const NAV_LINKS = [
  { href: "/compiler", label: "Compiler" },
  { href: "/projects", label: "Projects" },
  { href: "/gallery", label: "Gallery" },
  // Writing hidden for now — only one post. Route still lives at /writing.
  // { href: "/writing", label: "Writing" },
  { href: "/Aiden-Lee-Resume.pdf", label: "Résumé", external: true },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${serif.variable} ${mono.variable} min-h-screen flex flex-col`}
      >
        <header>
          <nav className="mx-auto max-w-5xl px-6 h-16 flex items-center gap-6">
            <Link
              href="/"
              className="font-mono text-sm tracking-tight hover:text-[color:var(--accent)] transition-colors whitespace-nowrap"
            >
              aiden lee<span className="text-[color:var(--accent)]">.</span>
            </Link>
            <ul className="ml-auto flex items-center gap-5 sm:gap-6 text-sm">
              {NAV_LINKS.map((l) =>
                l.external ? (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-24 border-t border-[color:var(--border)]">
          <div className="mx-auto max-w-5xl px-6 py-10 flex flex-wrap gap-4 items-center justify-between text-xs text-[color:var(--muted)] font-mono">
            <span>© {new Date().getFullYear()} Aiden Lee</span>
            <div className="flex gap-5">
              <a
                href="https://github.com/aiden-lee11"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[color:var(--fg)] transition-colors"
              >
                github
              </a>
              <a
                href="https://www.linkedin.com/in/aiden-lee11/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[color:var(--fg)] transition-colors"
              >
                linkedin
              </a>
              <a
                href="https://www.youtube.com/@aiden-lee11"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[color:var(--fg)] transition-colors"
              >
                youtube
              </a>
              <a
                href="mailto:aidenlee2027@u.northwestern.edu"
                className="hover:text-[color:var(--fg)] transition-colors"
              >
                email
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
