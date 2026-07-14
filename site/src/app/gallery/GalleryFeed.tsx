"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GalleryItem } from "@/lib/gallery";

// One slide as fed to the strip. A lone photo is a group of one; photos sharing
// a `group` collapse into a single stacked slide. `key` is stable across the
// motion engine's rebuilds. The imperative engine only ever sees [data-slide] —
// it neither knows nor cares that a slide holds several photos.
type Slide = { key: string; items: GalleryItem[] };

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

// Cascade slots for the peeking backs — a diagonal collage rather than a tight
// pile: alternating left/right with a progressive drop (up-left, mid-right,
// down-left, …) so every print is clearly visible and invites a click. Offsets
// are % of the slide box, tuned so on desktop the overflow stays within ~½ the
// 4vw inter-slide gap; deeper prints scale down to read as further back. On
// phone widths the slide spans ~86vw, so the same offsets would sprawl into
// the neighbouring slide — the CSS `--peek` factor (see .gallery-stack-print)
// squeezes the whole arrangement toward "tucked in" there.
const CASCADE = [
  { x: -12, y: -9, r: -2.5, s: 0.86 },
  { x: 13, y: 4, r: 2, s: 0.83 },
  { x: -10, y: 14, r: -3, s: 0.8 },
  { x: 11, y: 8, r: 2.5, s: 0.8 },
];
// Every print in a stack renders persistently and is merely assigned a slot —
// top, back depth d, or hidden — per the active index. Slots are handed to CSS
// as variables (not a literal transform) so a single transition on the
// transform glides a print between slots whenever roles shift, and the phone
// breakpoint can rescale the fan without JS knowing the viewport. A tiny
// index-keyed rotation jitter keeps the scrapbook feel from looking stamped.
function printStyle(i: number, idx: number, n: number): React.CSSProperties {
  const isTop = i === idx;
  // depth behind the top in cycle order (0 = next up)
  const d = (i - idx - 1 + n) % n;
  const c = isTop ? { x: 0, y: 0, r: 0, s: 1 } : CASCADE[Math.min(d, CASCADE.length - 1)];
  const jitter = (i % 3) - 1; // -1 | 0 | 1, stable per original index
  return {
    "--tx": `${c.x}%`,
    "--ty": `${c.y}%`,
    "--rot": `${(isTop ? 0 : c.r + jitter * 0.6).toFixed(2)}deg`,
    "--shrink": (1 - c.s).toFixed(2),
    // top above all cascade backs (max z 3); below overlay/chip (z 5/6)
    zIndex: isTop ? 4 : Math.max(0, 3 - d),
    // prints beyond the visible fan sit in the deepest slot, faded out
    opacity: isTop || d < CASCADE.length ? 1 : 0,
  } as React.CSSProperties;
}

// A single strip slide. For a lone photo it renders exactly as before; for a
// group it stacks the prints and cycles the active one on tap/click/chip. The
// [data-slide] figure stays the unit the per-frame engine transforms — cycling
// is plain local state, invisible to that engine.
function GallerySlide({
  items,
  activeTag,
  onSelectTag,
  onImgLoad,
  eager,
}: {
  items: GalleryItem[];
  activeTag: string | null;
  onSelectTag: (tag: string) => void;
  onImgLoad: () => void;
  eager: boolean;
}) {
  const [active, setActive] = useState(0);
  // The just-demoted print plays the swing-out exit (see @keyframes
  // gallery-tuck); cleared on animation end so a later role change doesn't
  // replay it. Rapid taps simply move the class to the newest demotee.
  const [tucking, setTucking] = useState<number | null>(null);
  const figRef = useRef<HTMLElement>(null);
  const isStack = items.length > 1;
  // Caption/date/tags are shared across the group. The FIRST photo defines the
  // slide box (its aspect never changes, so cycling can't shift layout); other
  // prints fill that box with object-fit: cover. Guard the index in case a
  // filter/edit shrank the group.
  const meta = items[0];
  const idx = Math.min(active, items.length - 1);

  const advance = () => {
    setTucking(idx);
    setActive((idx + 1) % items.length);
  };

  // Extend today's click behaviour: an off-center slide is centered by the
  // engine's own listener; a click on the ALREADY-centered stack cycles it. We
  // read the engine's .center class rather than tracking centeredness in React.
  // A drag never fires a click (native semantics), so a swipe can't cycle.
  const onClick = (e: React.MouseEvent) => {
    if (!isStack) return;
    if ((e.target as HTMLElement).closest("button")) return; // chip / tag pills
    if (figRef.current?.classList.contains("center")) advance();
  };

  return (
    <figure
      ref={figRef}
      data-slide=""
      className={`gallery-slide${isStack ? " gallery-stack" : ""}`}
      onClick={isStack ? onClick : undefined}
    >
      {/* Stack prints — ALL of them render persistently with stable keys, and
          cycling only reassigns slots (top / back depth / hidden) through CSS
          vars, so one CSS transition glides every print between slots. No
          remount, no re-entrance animation, no layout shift: the first print
          stays in flow as the sizer (its aspect fixes the box), the rest fill
          the box absolutely with object-fit: cover. The visible fan is capped
          at 4 backs by the hidden slot — the chip communicates the true count. */}
      {isStack ? (
        items.map((it, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={it.id}
            className={`gallery-stack-print${i === 0 ? " gallery-stack-sizer" : ""}${
              i === tucking ? " gallery-stack-tucking" : ""
            }`}
            src={it.url}
            alt={i === idx ? meta.caption || "Gallery photo" : ""}
            aria-hidden={i === idx ? undefined : true}
            width={i === 0 ? it.w : undefined}
            height={i === 0 ? it.h : undefined}
            loading={eager && i === idx ? "eager" : "lazy"}
            onLoad={i === 0 ? onImgLoad : undefined}
            onAnimationEnd={i === tucking ? () => setTucking(null) : undefined}
            style={{
              ...printStyle(i, idx, items.length),
              ...(i === 0 && it.w && it.h
                ? { aspectRatio: `${it.w} / ${it.h}` }
                : undefined),
            }}
          />
        ))
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.url}
          alt={meta.caption || "Gallery photo"}
          width={meta.w}
          height={meta.h}
          loading={eager ? "eager" : "lazy"}
          onLoad={onImgLoad}
          style={
            meta.w && meta.h
              ? { aspectRatio: `${meta.w} / ${meta.h}` }
              : undefined
          }
        />
      )}
      <figcaption data-overlay="" className="gallery-overlay">
        {meta.caption && (
          <p className="mb-1.5 text-[0.92rem] leading-snug text-white">
            {meta.caption}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-white/65">
            {formatMonth(meta.date)}
          </span>
          {meta.tags?.map((tag) => (
            <button
              key={tag}
              data-chip=""
              onClick={() => onSelectTag(tag)}
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
      {/* Discoverable advance affordance on desktop + touch. A real button, so
          the engine's click handler ignores it; stopPropagation keeps the
          figure's own onClick from double-advancing. */}
      {isStack && (
        <button
          type="button"
          className="gallery-stack-chip"
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
          aria-label={`Show next photo in this stack (${idx + 1} of ${items.length})`}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <rect x="2.5" y="0.5" width="8" height="8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1" />
            <rect x="0.5" y="2.5" width="8" height="8" rx="1.2" fill="currentColor" opacity="0.85" />
          </svg>
          {idx + 1} / {items.length}
        </button>
      )}
    </figure>
  );
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

  // Collapse groups into stacked slides. Group by `group` id (not adjacency) to
  // be safe, and hold each group's sort position at its FIRST member so the
  // stack lands where its newest photo would. Filtering happens upstream on
  // `filtered`: since group members share tags, a tag filter keeps or drops a
  // whole group together — the stack never fractures. This is the single memo
  // the render and the progress counter both read, so groups count as one slide
  // everywhere automatically.
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    const at = new Map<string, number>();
    for (const it of filtered) {
      if (it.group) {
        const i = at.get(it.group);
        if (i === undefined) {
          at.set(it.group, out.length);
          out.push({ key: `g:${it.group}`, items: [it] });
        } else {
          out[i].items.push(it);
        }
      } else {
        out.push({ key: it.id, items: [it] });
      }
    }
    return out;
  }, [filtered]);

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

    // Touch gesture anchor: the centered slide index and scrollLeft captured the
    // moment a finger lands. iOS momentum keeps firing scroll events after
    // touchend, so this must outlive the release — it's only cleared once the
    // idle settle actually runs. null means no live touch gesture, and the
    // settle falls back to plain nearest (wheel/keys/click never set it).
    let anchorIdx = 0;
    let anchorLeft: number | null = null;

    // Follow-the-hand motion is quick; the idle settle is a slow drift. A
    // directional commit sits between — snap-ish but still eased. `ease` is
    // re-set by whichever motion is in charge.
    const FOLLOW = 0.14;
    const SETTLE = 0.04;
    const COMMIT = 0.11;
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
        if (!vis.length) return;
        const near = nearest(vis);
        // Default (tap, wheel, wiggle): a drift so slow it reads as the strip
        // exhaling — never a snap — onto whatever slide sits nearest center.
        let idx = near;
        let speed = SETTLE;
        // A touch gesture is live. Commit in the swipe's direction so a partial
        // swipe always advances at least one slide and never snaps back against
        // the finger, while a momentum fling that already sailed past keeps its
        // extra distance (max/min, not a hard anchor±1).
        if (anchorLeft !== null) {
          const disp = strip.scrollLeft - anchorLeft;
          // Below this it's a tap or accidental wiggle — keep plain nearest.
          const commit = Math.max(40, strip.clientWidth * 0.08);
          if (disp > commit) {
            idx = Math.max(near, anchorIdx + 1);
            speed = COMMIT;
          } else if (disp < -commit) {
            idx = Math.min(near, anchorIdx - 1);
            speed = COMMIT;
          }
          idx = Math.max(0, Math.min(idx, vis.length - 1));
          anchorLeft = null; // gesture consumed — next settle is nearest again
        }
        go(centerOf(vis[idx]), speed);
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
      anchorLeft = null; // definitively not-touch — drop any stale touch anchor
      go(target + e.deltaY + e.deltaX);
      snapSoon();
    };
    // A finger lands: snapshot where we're centered and the raw scroll position
    // so the idle settle can commit in the swipe's direction. Passive — we never
    // block native touch scrolling.
    const onTouchStart = () => {
      // A finger always wins over any programmatic glide. Kill an in-flight
      // glide (e.g. the seconds-long SETTLE exhale) and hand the strip to the
      // hand — otherwise glide() keeps stepping scrollLeft toward the stale
      // pre-gesture target and drags the strip back out from under the finger.
      // Clearing gliding also lets onScroll re-arm the idle settle so the
      // directional commit actually runs on release.
      cancelAnimationFrame(rafGlide);
      gliding = false;
      target = strip.scrollLeft;
      const vis = slides();
      anchorIdx = vis.length ? nearest(vis) : 0;
      anchorLeft = strip.scrollLeft;
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
    // center. offsetWidth is valid before images load (each <img> carries
    // width/height attrs + an inline aspect-ratio, so its box shrink-wraps to a
    // stable size under the CSS max-width/max-height caps). Order matters: padding shifts
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
    strip.addEventListener("touchstart", onTouchStart, { passive: true });
    strip.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    settleLayout();

    return () => {
      strip.removeEventListener("wheel", onWheel);
      strip.removeEventListener("scroll", onScroll);
      strip.removeEventListener("touchstart", onTouchStart);
      strip.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      if (idleTimer) clearTimeout(idleTimer);
      cancelAnimationFrame(rafPaint);
      cancelAnimationFrame(rafGlide);
      repaintRef.current = () => {};
    };
    // Keyed on `slides`, not `filtered`: the engine measures [data-slide]
    // elements, and a group changes the slide count, so it must rebuild when the
    // collapsed set changes (identity changes exactly when `filtered` does).
  }, [slides]);

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
            aria-label="Photo scroller: scroll, drag, or use arrow keys"
          >
            {slides.map((slide, idx) => (
              <GallerySlide
                key={slide.key}
                items={slide.items}
                activeTag={activeTag}
                onSelectTag={selectTag}
                onImgLoad={() => repaintRef.current()}
                eager={idx === 0}
              />
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
              01 / {String(slides.length).padStart(2, "0")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
