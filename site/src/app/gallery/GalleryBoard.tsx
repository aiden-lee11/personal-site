"use client";

import { useEffect, useRef } from "react";
import { Caveat } from "next/font/google";
import type { GalleryItem } from "@/lib/gallery";

// Handwritten feel for the caption/date ink. Variable font — no weight needed.
const caveat = Caveat({ subsets: ["latin"] });

/** "2026-06-14" → "Jun 2026" — enough context without cluttering each caption. */
function formatMonth(date: string): string {
  const [y, m] = date.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return "";
  return `${months[mi]} ${y}`;
}

// FNV-1a over the string. Deterministic so SSR and client agree — no Math.random,
// no Date seeds, no hydration mismatch. Math.imul keeps it 32-bit.
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Salted hash of the id mapped to [0, 1) — one stable roll per purpose. */
function roll(id: string, salt: string): number {
  return hash(`${id}:${salt}`) / 0x100000000;
}

// CSS custom props the stylesheet composes into the scatter transform.
type PrintVars = React.CSSProperties & {
  "--rot": string;
  "--tx": string;
  "--ty": string;
  "--tape-rot": string;
  "--delay": string;
};

function scatter(id: string): PrintVars {
  return {
    "--rot": `${(roll(id, "r") * 7 - 3.5).toFixed(2)}deg`,
    "--tx": `${(roll(id, "x") * 24 - 12).toFixed(1)}px`,
    "--ty": `${(roll(id, "y") * 18 - 8).toFixed(1)}px`,
    "--tape-rot": `${(roll(id, "tape") * 14 - 7).toFixed(2)}deg`,
    "--delay": `${Math.round(roll(id, "d") * 240)}ms`,
  };
}

export default function GalleryBoard({ items }: { items: GalleryItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Reveal prints as they scroll into view; CSS transitions the settle-in.
  // Without IntersectionObserver, show everything at once.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const prints = Array.from(
      root.querySelectorAll<HTMLElement>("[data-pending]"),
    );
    if (typeof IntersectionObserver === "undefined") {
      // No staggered reveal without IO — drop the delay too.
      prints.forEach((el) => {
        el.style.setProperty("--delay", "0ms");
        el.removeAttribute("data-pending");
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.removeAttribute("data-pending");
          // The stagger delay sits on the base state, so it would also lag the
          // hover-out transition — zero it once the settle-in has finished.
          el.addEventListener(
            "transitionend",
            () => el.style.setProperty("--delay", "0ms"),
            { once: true },
          );
          io.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    prints.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <div
      ref={containerRef}
      className="print-board columns-1 gap-8 pt-6 pb-10 sm:columns-2 lg:columns-3"
    >
      {items.map((item) => (
        <figure
          key={item.id}
          className="print"
          data-pending=""
          tabIndex={0}
          style={scatter(item.id)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.caption || "Gallery photo"}
            width={item.w}
            height={item.h}
            loading="lazy"
            className="print-photo"
            style={
              item.w && item.h
                ? { aspectRatio: `${item.w} / ${item.h}` }
                : undefined
            }
          />
          {/* Bottom band always renders — the polaroid look holds even with no caption. */}
          <figcaption className={`print-caption ${caveat.className}`}>
            {item.caption && (
              <span className="print-caption-text">{item.caption}</span>
            )}
            <span className="print-caption-date">{formatMonth(item.date)}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
