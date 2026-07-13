"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GalleryItem } from "@/lib/gallery";

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

export default function GalleryFeed({ items }: { items: GalleryItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const stripRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null); // the accent segment inside .progress
  const countRef = useRef<HTMLSpanElement>(null);
  // The effect owns paint(); the <img> onLoad reaches it through this ref so a
  // late-loading image (offsets shift once it arrives) triggers a fresh paint.
  const repaintRef = useRef<() => void>(() => {});

  // Active tag filter. Seeded from ?tag= so a shared/bookmarked link lands filtered.
  const initialTag = searchParams.get("tag");
  const [activeTag, setActiveTag] = useState<string | null>(
    initialTag ? initialTag.toLowerCase() : null,
  );

  // The tag rail is collapsed by default so the header stays clean; a single
  // trigger chip expands the full set. Even a deep-linked filter starts
  // collapsed — the active chip on the trigger row makes the state legible.
  const [tagsOpen, setTagsOpen] = useState(false);

  // Rail tags: every distinct tag across ALL items (not just the filtered set),
  // in first-seen order so the rail is stable as the filter changes.
  const allTags = useMemo(() => {
    const seen: string[] = [];
    for (const it of items) {
      for (const t of it.tags ?? []) if (!seen.includes(t)) seen.push(t);
    }
    return seen;
  }, [items]);

  const filtered = useMemo(
    () => (activeTag ? items.filter((i) => i.tags?.includes(activeTag)) : items),
    [items, activeTag],
  );

  // Toggle a tag: clicking the active one clears the filter, else switch to it.
  // Mirror the choice into the URL (?tag=) without disturbing scroll position.
  // The motion effect re-runs on the filtered change and centers the new first
  // slide before the browser paints, so no manual rewind is needed here.
  function selectTag(tag: string | null) {
    const next = tag && tag === activeTag ? null : tag;
    setActiveTag(next);
    router.replace(next ? `/gallery?tag=${encodeURIComponent(next)}` : "/gallery", {
      scroll: false,
    });
  }

  // The whole motion engine, ported 1:1 from the mock. Keyed on `filtered` so
  // it rebuilds (and repaints) whenever the visible set changes. Everything is
  // imperative — transforms via el.style, progress/counter via refs — so no
  // per-frame React state and no re-render while scrolling. Layout effect, not
  // effect: the first slide must be centered before the browser paints.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    // Reduced motion: go() jumps instead of gliding and paint() clears the
    // per-slide transforms (CSS also kills the breathe animation).
    const calm =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const slides = () =>
      Array.from(strip.querySelectorAll<HTMLElement>("[data-slide]"));

    let target = 0;
    let gliding = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let rafPaint = 0;
    let rafGlide = 0;

    // Follow-the-hand motion is quick; the idle settle is a slow drift. Two
    // speeds, one loop — `ease` is re-set by whichever motion is in charge.
    const FOLLOW = 0.14;
    const SETTLE = 0.04;
    let ease = FOLLOW;

    const clamp = (x: number) =>
      Math.max(0, Math.min(x, strip.scrollWidth - strip.clientWidth));

    // One rAF glide owns all programmatic motion: wheel momentum, arrow keys,
    // click-to-center, and snap-on-idle. Native touch drag stays native.
    const glide = () => {
      const d = target - strip.scrollLeft;
      if (Math.abs(d) < 0.5) {
        strip.scrollLeft = target;
        gliding = false;
        return;
      }
      strip.scrollLeft += d * ease;
      rafGlide = requestAnimationFrame(glide);
    };
    const go = (x: number, speed = FOLLOW) => {
      target = clamp(x);
      ease = speed;
      if (calm) {
        strip.scrollLeft = target;
        return;
      }
      if (!gliding) {
        gliding = true;
        rafGlide = requestAnimationFrame(glide);
      }
    };

    const centerOf = (s: HTMLElement) =>
      s.offsetLeft + s.offsetWidth / 2 - strip.clientWidth / 2;

    const nearest = (vis: HTMLElement[]) => {
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      let best = 0;
      let dist = Infinity;
      vis.forEach((s, i) => {
        const c = s.offsetLeft + s.offsetWidth / 2;
        if (Math.abs(c - mid) < dist) {
          dist = Math.abs(c - mid);
          best = i;
        }
      });
      return best;
    };

    const snapSoon = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const vis = slides();
        // A long pause, then a drift so slow it reads as the strip exhaling —
        // never a snap.
        if (vis.length) go(centerOf(vis[nearest(vis)]), SETTLE);
      }, 380);
    };

    const paint = () => {
      const vis = slides();
      if (!vis.length) return;
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      let i = 0;
      let best = Infinity;

      vis.forEach((s, k) => {
        const c = s.offsetLeft + s.offsetWidth / 2;
        const raw = (c - mid) / strip.clientWidth; // signed distance, viewport units
        const d = Math.abs(raw);
        if (d < best) {
          best = d;
          i = k;
        }
        const ov = s.querySelector<HTMLElement>("[data-overlay]");
        if (calm) {
          s.style.transform = "";
          s.style.opacity = "";
          s.style.filter = "";
          if (ov) ov.style.opacity = "";
          return;
        }

        // Everything eases continuously with scroll position — no snap states.
        // Blur is quantized to 0.5px steps: continuous blur on large images
        // re-rasterizes every frame and is the main source of scroll jank.
        const t = Math.min(1, d * 2.1);
        s.style.transform = `translate3d(${(-raw * 26).toFixed(1)}px, 0, 0) scale(${(
          1 - 0.06 * t
        ).toFixed(3)})`;
        s.style.opacity = (1 - 0.5 * t).toFixed(3);
        const blur = Math.round(1.6 * t * 2) / 2;
        s.style.filter = `blur(${blur}px) saturate(${(1 - 0.3 * t).toFixed(2)})`;
        if (ov) ov.style.opacity = Math.max(0, 1 - t * 1.6).toFixed(2);
      });

      vis.forEach((s, k) => s.classList.toggle("center", k === i));

      const w = 100 / vis.length;
      if (barRef.current) {
        barRef.current.style.width = `${w}%`;
        barRef.current.style.left = `${i * w}%`;
      }
      if (countRef.current) {
        countRef.current.textContent = `${String(i + 1).padStart(2, "0")} / ${String(
          vis.length,
        ).padStart(2, "0")}`;
      }
    };

    const schedulePaint = () => {
      cancelAnimationFrame(rafPaint);
      rafPaint = requestAnimationFrame(paint);
    };
    repaintRef.current = schedulePaint;

    // Wheel: both axes feed horizontal travel, momentum via the glide. Must be a
    // native non-passive listener — React's synthetic onWheel can't preventDefault.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      go(target + e.deltaY + e.deltaX);
      snapSoon();
    };
    // Native drag/scroll: keep target in sync so the glide never fights a hand,
    // and request a paint frame for the new position.
    const onScroll = () => {
      if (!gliding) {
        target = strip.scrollLeft;
        snapSoon();
      }
      schedulePaint();
    };
    // Arrow keys step one slide. Ignore events aimed at form fields.
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const vis = slides();
      if (!vis.length) return;
      const i = nearest(vis);
      if (e.key === "ArrowRight") go(centerOf(vis[Math.min(i + 1, vis.length - 1)]), 0.09);
      if (e.key === "ArrowLeft") go(centerOf(vis[Math.max(i - 1, 0)]), 0.09);
    };
    // Click a neighbouring photo to glide to it (chips/buttons keep their own behaviour).
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("button")) return;
      const slide = el.closest<HTMLElement>("[data-slide]");
      if (slide && !slide.classList.contains("center")) go(centerOf(slide), 0.09);
    };
    // Edge padding sized in JS so the first/last slides can reach viewport
    // center — with static padding alone, centerOf(first) is negative and
    // clamp() rounds it to 0, so the edge slides mathematically can never
    // center. offsetWidth is valid before images load (slides carry
    // aspect-ratio + a fixed height). Order matters: padding shifts
    // offsetLeft, so it must be applied before centerOf. Then start centered
    // on the nearest slide (slide 0 on a fresh mount/filter) — crisp, full
    // caption, no drift; a resize shouldn't animate either.
    const settleLayout = () => {
      const vis = slides();
      if (!vis.length) return;
      const first = vis[0];
      const last = vis[vis.length - 1];
      strip.style.paddingLeft = `${Math.max(
        0,
        (strip.clientWidth - first.offsetWidth) / 2,
      )}px`;
      strip.style.paddingRight = `${Math.max(
        0,
        (strip.clientWidth - last.offsetWidth) / 2,
      )}px`;
      target = clamp(centerOf(vis[nearest(vis)]));
      strip.scrollLeft = target;
      paint();
    };
    const onResize = settleLayout;

    strip.addEventListener("wheel", onWheel, { passive: false });
    strip.addEventListener("scroll", onScroll);
    strip.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    settleLayout();

    return () => {
      strip.removeEventListener("wheel", onWheel);
      strip.removeEventListener("scroll", onScroll);
      strip.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      if (idleTimer) clearTimeout(idleTimer);
      cancelAnimationFrame(rafPaint);
      cancelAnimationFrame(rafGlide);
      repaintRef.current = () => {};
    };
  }, [filtered]);

  return (
    <div className="gallery-feed">
      {/* Tag rail — interactive, so it lives here. Right-aligned within the same
          max-w gutter as the header so it reads as the header's right side;
          on small screens it just wraps below the title. Collapsed by default:
          a single trigger chip expands the full set of pills. */}
      <div className="mx-auto max-w-5xl px-6 pb-8 lg:-mt-14">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Collapsed + filtered: surface the active tag so the strip's
              filtered state is never a mystery, with an inline clear. */}
          {!tagsOpen && activeTag && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-3.5 py-1.5 font-mono text-[11px] lowercase text-white">
              {activeTag}
              <button
                type="button"
                onClick={() => selectTag(null)}
                aria-label={`Clear ${activeTag} filter`}
                className="-mr-0.5 text-[13px] leading-none opacity-80 transition-opacity hover:opacity-100"
              >
                ×
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => setTagsOpen((o) => !o)}
            aria-expanded={tagsOpen}
            aria-controls="tag-rail"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono text-[11px] lowercase transition-colors ${
              tagsOpen || activeTag
                ? "border-[color:var(--fg)] text-[color:var(--fg)]"
                : "border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            }`}
          >
            <span>tags</span>
            <span className="text-[color:var(--muted)]">{allTags.length}</span>
            <svg
              viewBox="0 0 10 6"
              width="10"
              height="6"
              aria-hidden="true"
              className={`transition-transform duration-300 motion-reduce:transition-none ${
                tagsOpen ? "rotate-180" : ""
              }`}
            >
              <path
                d="M1 1l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Expanding panel: a grid-rows 0fr→1fr transition (respects
            prefers-reduced-motion via CSS) keeps the reveal in the same motion
            family as the strip. `inert` when closed pulls the clipped pills out
            of the tab order and the a11y tree. */}
        <div id="tag-rail" className="gallery-tagrail" data-open={tagsOpen}>
          <nav
            className="min-h-0 overflow-hidden"
            aria-label="Filter by tag"
            inert={tagsOpen ? undefined : true}
          >
            <div className="flex flex-wrap justify-end gap-2 pt-3">
              <button
                onClick={() => selectTag(null)}
                className={`rounded-full border px-3.5 py-1.5 font-mono text-[11px] lowercase transition-colors ${
                  activeTag === null
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                    : "border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                }`}
              >
                all
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => selectTag(tag)}
                  className={`rounded-full border px-3.5 py-1.5 font-mono text-[11px] lowercase transition-colors ${
                    tag === activeTag
                      ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                      : "border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>

      {/* Stale ?tag= with nothing to show — mirror the page's empty state. */}
      {activeTag && filtered.length === 0 ? (
        <div className="mx-auto max-w-5xl px-6">
          <div className="border-t border-[color:var(--border)] pt-10">
            <p className="max-w-md leading-relaxed text-[color:var(--muted)]">
              No photos tagged{" "}
              <span className="font-mono text-[color:var(--fg)]">{activeTag}</span>.{" "}
              <button onClick={() => selectTag(null)} className="link-underline">
                Clear the filter
              </button>{" "}
              to see everything.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Full-bleed horizontal scroller. */}
          <div
            ref={stripRef}
            className="gallery-strip"
            tabIndex={0}
            aria-label="Photo scroller — scroll, drag, or use arrow keys"
          >
            {filtered.map((item, idx) => (
              <figure key={item.id} data-slide="" className="gallery-slide">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.caption || "Gallery photo"}
                  width={item.w}
                  height={item.h}
                  loading={idx === 0 ? "eager" : "lazy"}
                  onLoad={() => repaintRef.current()}
                  style={
                    item.w && item.h
                      ? { aspectRatio: `${item.w} / ${item.h}` }
                      : undefined
                  }
                />
                <figcaption
                  data-overlay=""
                  className="gallery-overlay"
                >
                  {item.caption && (
                    <p className="mb-1.5 text-[0.92rem] leading-snug text-white">
                      {item.caption}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-white/65">
                      {formatMonth(item.date)}
                    </span>
                    {item.tags?.map((tag) => (
                      <button
                        key={tag}
                        data-chip=""
                        onClick={() => selectTag(tag)}
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] lowercase transition-colors ${
                          tag === activeTag
                            ? "bg-[color:var(--accent)] text-white"
                            : "bg-white/15 text-white/90 hover:bg-white/25"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>

          {/* Footer: mono hint · thin progress track with an accent segment · counter. */}
          <div className="mx-auto mt-6 flex max-w-5xl items-center gap-6 px-6">
            <span className="font-mono text-[11px] text-[color:var(--muted)]">
              scroll · drag · ← →
            </span>
            <div className="relative h-px flex-1 bg-[color:var(--border)]">
              <i
                ref={barRef}
                className="absolute -top-px left-0 h-[3px] w-0 rounded-full bg-[color:var(--accent)] transition-[width,left] duration-200 motion-reduce:transition-none"
              />
            </div>
            <span
              ref={countRef}
              className="font-mono text-[11px] tracking-[0.08em] text-[color:var(--muted)] tabular-nums"
            >
              01 / {String(filtered.length).padStart(2, "0")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
