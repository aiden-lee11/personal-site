import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pixelHeading = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

const pixelBody = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

export const metadata: Metadata = {
  title: "Aiden Lee — Personal Site",
  description: "Projects, blog, and resume for Aiden Lee",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${pixelHeading.variable} ${pixelBody.variable} antialiased retro-bg min-h-screen`}> 
        <header className="sticky top-0 z-30 backdrop-blur bg-white/70 dark:bg-black/50 border-b border-neutral-200 dark:border-neutral-800 pixel-border">
          <nav className="mx-auto max-w-5xl px-6 h-14 flex items-center gap-6">
            <Link className="font-press text-[14px]" href="/">Aiden Lee</Link>
            <div className="ml-auto flex items-center gap-4 text-[16px] font-vt">
              <Link className="hover:underline" href="/blog">Blog</Link>
              <Link className="hover:underline" href="/resume">Resume</Link>
              <a className="hover:underline" href="/Aiden-Lee-Resume.pdf" target="_blank" rel="noreferrer">PDF</a>
            </div>
          </nav>
        </header>
        <div className="mx-auto max-w-5xl px-6">
          {children}
        </div>
      </body>
    </html>
  );
}
