"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LAYERS, LAYER_LABEL, type Layer } from "@/lib/layers";

/**
 * An animated walk down the compiler pipeline: eight mono node chips joined by
 * connector lines, with one node lit at a time and a one-line caption beneath.
 *
 * It autoplays once when it first scrolls into view (IntersectionObserver,
 * armed a single time so re-scrolling never restarts it), advancing one node
 * every STEP_MS and wrapping from x86-64 back to LC so the cycle loops forever.
 *
 * Each autoplay advance is a Tron-style arrival carved entirely OUT of STEP_MS
 * (never appended), split across three beats:
 *   • dwell (0 → STEP_MS - PULSE_MS - TRACE_MS): the current node holds lit.
 *   • t1 (STEP_MS - PULSE_MS): a pulse dot sweeps the connector to the next
 *     node over PULSE_MS.
 *   • t2 (STEP_MS - TRACE_MS): the dot vanishes and, in the same frame, two
 *     beams split from the next chip's LEFT-edge midpoint and line-draw at once
 *     — one over the top, one under the bottom — meeting at the RIGHT-edge
 *     midpoint over TRACE_MS. The dot's accent-soft color hands straight off
 *     into the beams it becomes.
 *   • t3 (STEP_MS): the node commits to its lit active state while the finished
 *     outline overlay pops to full brightness and fades out over ~450ms. That
 *     meet-flash overlaps the NEXT hold and is deliberately outside the budget.
 *
 * Hover or focus pauses the clock like a GIF you can inspect, and the ‹ ›
 * arrows step by hand (wrapping too, but instantly, no pulse or trace) without
 * permanently stopping the loop. Under prefers-reduced-motion it never
 * autoplays, all motion collapses to instant, but the arrows and caption still
 * work.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 4500;
// The pulse's travel time, carved OUT of STEP_MS (not added).
const PULSE_MS = 650;
// The outline-trace time, also carved OUT of STEP_MS. So a tick dwells for
// STEP_MS - PULSE_MS - TRACE_MS, the pulse travels for PULSE_MS, and the beams
// trace the next chip for TRACE_MS — landing exactly on STEP_MS.
const TRACE_MS = 380;

// --accent (#a684f5) as literals so the washes read the same in both themes.
const ACCENT = "#a684f5";
// --accent-soft (#c3aef8): the lighter beam/dot color, so the traveling dot
// hands off into the beams it becomes.
const ACCENT_SOFT = "#c3aef8";
const ACCENT_WASH = "rgba(166, 132, 245, 0.12)";
const ACCENT_SOFT_BORDER = "rgba(166, 132, 245, 0.35)";

// The two half-outline paths for one chip, ported from the demo's buildTraceSvg
// math. Both start at the left-edge midpoint: `top` runs clockwise over the top
// to the right-edge midpoint, `bottom` counterclockwise under the bottom to the
// same point, so the beams meet at the right. Stroke centered on the 1px border
// (inset 0.5), corner radius 5.5 (border-radius 6 minus the half-stroke inset).
function buildTracePaths(w: number, h: number) {
  const i = 0.5;
  const r = 5.5;
  const top =
    `M ${i} ${h / 2}` +
    ` L ${i} ${i + r}` +
    ` A ${r} ${r} 0 0 1 ${i + r} ${i}` +
    ` L ${w - i - r} ${i}` +
    ` A ${r} ${r} 0 0 1 ${w - i} ${i + r}` +
    ` L ${w - i} ${h / 2}`;
  const bottom =
    `M ${i} ${h / 2}` +
    ` L ${i} ${h - i - r}` +
    ` A ${r} ${r} 0 0 0 ${i + r} ${h - i}` +
    ` L ${w - i - r} ${h - i}` +
    ` A ${r} ${r} 0 0 0 ${w - i} ${h - i - r}` +
    ` L ${w - i} ${h / 2}`;
  return { top, bottom };
}

// The trace overlay: an SVG spanning the chip's border box, living INSIDE the
// chip div so the active 1.06 scale transforms overlay and chip together. Each
// half renders a blurred halo path UNDER a crisp beam path. While `meet` is
// false the two beams line-draw via framer-motion pathLength (no getTotalLength
// needed); when `meet` flips true (arrival committed) the paths hold complete
// and the whole svg does the demo's brightness pop → fade, then calls onDone.
function TraceOverlay({
  w,
  h,
  meet,
  onDone,
}: {
  w: number;
  h: number;
  meet: boolean;
  onDone: () => void;
}) {
  const { top, bottom } = buildTracePaths(w, h);
  const drawT = { duration: meet ? 0 : TRACE_MS / 1000, ease: EASE } as const;
  return (
    <motion.svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{
        position: "absolute",
        left: -1,
        top: -1,
        pointerEvents: "none",
        overflow: "visible",
      }}
      animate={
        meet
          ? {
              opacity: [1, 1, 0],
              filter: ["brightness(1.9)", "brightness(1.5)", "brightness(1)"],
            }
          : { opacity: 1 }
      }
      transition={
        meet
          ? { duration: 0.45, times: [0, 0.28, 1], ease: "easeOut" }
          : { duration: 0 }
      }
      onAnimationComplete={() => {
        if (meet) onDone();
      }}
    >
      {[top, bottom].map((d, k) => (
        <Fragment key={k}>
          <motion.path
            d={d}
            fill="none"
            stroke={ACCENT}
            strokeWidth={4}
            strokeLinecap="round"
            style={{ filter: "blur(2.5px)", opacity: 0.75 }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={drawT}
          />
          <motion.path
            d={d}
            fill="none"
            stroke={ACCENT_SOFT}
            strokeWidth={1.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={drawT}
          />
        </Fragment>
      ))}
    </motion.svg>
  );
}

// One-liners in the site voice, keyed by layer. Prefixed in the caption line by
// the layer's LAYER_LABEL (accent-colored).
const CAPTION: Record<Layer, string> = {
  LC: "the most C-like layer: if/else, loops, nested scopes",
  LB: "control flow starts naming its targets with explicit labels",
  LA: "scopes and loops lowered to straight-line code and branches",
  IR: "SSA form with φ-nodes, where all the optimizations live",
  L3: "linear three-address code, tiled into x86 instruction patterns",
  L2: "infinite virtual registers, right before allocation",
  L1: "concrete registers after graph coloring and spilling",
  S: "the final artifact your CPU actually runs",
};

const BTN =
  "font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors";

export default function PipelineChain() {
  const [reduced, setReduced] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  // The connector index (before node pulseIdx) currently carrying a travel
  // pulse, or null. Only ever set by the autoplay clock, so no pulse under
  // reduced motion or manual arrow steps.
  const [pulseIdx, setPulseIdx] = useState<number | null>(null);
  // The chip currently being outline-traced, plus the measured (unscaled) box
  // to draw its paths and a gen counter that forces a fresh overlay per firing.
  // Only ever set by the autoplay clock, so no trace under reduced motion or
  // manual arrow steps.
  const [trace, setTrace] = useState<{
    idx: number;
    gen: number;
    w: number;
    h: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const armedRef = useRef(false);
  const genRef = useRef(0);
  // True from the instant t3 commits the arrival until the meet-flash finishes.
  // It lets the trace overlay SURVIVE the clock effect's cleanup (which fires at
  // t3 because setActiveIdx changes a dep): cleanup only clears the trace when
  // this is false, so a committed arrival keeps its flash while a hover-pause or
  // manual arrow mid-pulse/mid-draw still tears the trace down cleanly.
  const arrivedRef = useRef(false);

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Arm the autoplay a single time, the first time we scroll into view. Reading
  // matchMedia live here (rather than the `reduced` state) sidesteps the initial
  // false→true settle, so a reduced-motion visitor never gets a running clock.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !armedRef.current) {
          armedRef.current = true;
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setPlaying(true);
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Autoplay clock: advance one node per tick, paused by hover/focus and never
  // running under reduced motion. Wraps from x86-64 back to LC so it loops
  // forever. A manual arrow step just moves activeIdx; because activeIdx is in
  // the deps this effect re-arms and the loop keeps going from there.
  //
  // Three chained timeouts split the tick into dwell → pulse → trace:
  //   t1 (STEP_MS-PULSE_MS-TRACE_MS): launch the pulse down the connector.
  //   t2 (STEP_MS-TRACE_MS): the dot vanishes and, measuring the next chip's
  //     unscaled box, the outline trace begins on it.
  //   t3 (STEP_MS): mark arrivedRef so the trace survives this cleanup, then
  //     commit setActiveIdx — the chip lights up and the overlay meet-flashes.
  // The wrap back to LC has no connector, so it skips both pulse and trace; t3
  // still advances. Cleanup clears every timer and nulls pulseIdx; it tears down
  // the trace ONLY when the arrival hasn't committed, so pausing or a manual
  // step mid-pulse/mid-draw strands nothing, while a committed flash lives on.
  useEffect(() => {
    if (reduced || !playing || hovered) return;
    const next = (activeIdx + 1) % LAYERS.length;
    const t1 = window.setTimeout(() => {
      if (next !== 0) setPulseIdx(next);
    }, STEP_MS - PULSE_MS - TRACE_MS);
    const t2 = window.setTimeout(() => {
      setPulseIdx(null);
      if (next !== 0) {
        const node = nodeRefs.current[next];
        if (node) {
          genRef.current += 1;
          setTrace({
            idx: next,
            gen: genRef.current,
            w: node.offsetWidth,
            h: node.offsetHeight,
          });
        }
      }
    }, STEP_MS - TRACE_MS);
    const t3 = window.setTimeout(() => {
      arrivedRef.current = true;
      setActiveIdx(next);
    }, STEP_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      setPulseIdx(null);
      if (!arrivedRef.current) setTrace(null);
    };
  }, [reduced, playing, hovered, activeIdx]);

  // Keep the active node in view inside the horizontal-scroll container by
  // nudging the CONTAINER's scrollLeft — never scrollIntoView, which could drag
  // the page vertically. Instant under reduced motion.
  useEffect(() => {
    const container = scrollRef.current;
    const node = nodeRefs.current[activeIdx];
    if (!container || !node) return;
    const left = node.offsetLeft - (container.clientWidth - node.offsetWidth) / 2;
    container.scrollTo({
      left: Math.max(0, left),
      behavior: reduced ? "auto" : "smooth",
    });
  }, [activeIdx, reduced]);

  const dur = reduced ? 0 : 0.4;
  const activeL = LAYERS[activeIdx];

  // Manual navigation (arrows and chip clicks): instant swap, no pulse or
  // trace. Both tear down any in-flight trace FIRST: without this, a step
  // during the meet-flash flips the overlay's `meet` prop back to false
  // (activeIdx moved), onDone never fires, and the clock cleanup skips
  // setTrace(null) because arrivedRef is still true — stranding a fully bright
  // outline on a non-active chip until the next tick replaces it. The clock
  // effect's cleanup already clears timers and pulseIdx when activeIdx changes,
  // then re-arms from the new index, so the loop continues from wherever you
  // land.
  const clearFlight = () => {
    arrivedRef.current = false;
    setTrace(null);
  };
  const jumpTo = (idx: number) => {
    clearFlight();
    setActiveIdx(idx);
  };
  const stepBy = (delta: number) => {
    clearFlight();
    setActiveIdx((i) => (i + delta + LAYERS.length) % LAYERS.length);
  };

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      {/* chain row — horizontal scroll on narrow screens, no visible scrollbar */}
      <div
        ref={scrollRef}
        style={{ overflowX: "auto", scrollbarWidth: "none" }}
      >
        {/* px/py so the active chip's 1.06 scale never clips at the edges */}
        <div className="flex items-center w-max sm:w-full px-1 py-1">
          {LAYERS.map((L, i) => {
            const state =
              i === activeIdx ? "active" : i < activeIdx ? "passed" : "future";
            return (
              <Fragment key={L}>
                {i > 0 && (
                  <div
                    className="h-px shrink-0 w-6 sm:flex-1"
                    style={{
                      position: "relative",
                      // 4px inset per side so the line stops cleanly short of
                      // both chips: the active chip's scale(1.06) is a pure
                      // transform (no layout effect), so without the gap its
                      // scaled edge overlaps the connector ends and the line
                      // shows through the translucent chip backgrounds.
                      marginLeft: 4,
                      marginRight: 4,
                      background:
                        i <= activeIdx ? ACCENT : "var(--border)",
                      transition: reduced
                        ? "none"
                        : "background-color 0.4s cubic-bezier(0.22,1,0.36,1)",
                    }}
                  >
                    {pulseIdx === i && (
                      <motion.span
                        style={{
                          position: "absolute",
                          top: -2.5,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: ACCENT_SOFT,
                          boxShadow: "0 0 9px 2px rgba(166, 132, 245, 0.65)",
                          pointerEvents: "none",
                        }}
                        initial={{ left: "0%", opacity: 0 }}
                        animate={{ left: "100%", opacity: [0, 1, 1, 0.9] }}
                        transition={{ duration: PULSE_MS / 1000, ease: EASE }}
                      />
                    )}
                  </div>
                )}
                <motion.button
                  ref={(el) => {
                    nodeRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => jumpTo(i)}
                  aria-label={`Jump to ${LAYER_LABEL[L]}`}
                  aria-current={state === "active" ? "step" : undefined}
                  animate={{ scale: state === "active" && !reduced ? 1.06 : 1 }}
                  transition={{ duration: dur, ease: EASE }}
                  className="font-mono text-sm rounded-md border px-3 py-1.5 cursor-pointer"
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    color:
                      state === "active"
                        ? ACCENT
                        : state === "passed"
                          ? "var(--fg)"
                          : "var(--muted)",
                    borderColor:
                      state === "active"
                        ? ACCENT
                        : state === "passed"
                          ? ACCENT_SOFT_BORDER
                          : "var(--border)",
                    backgroundColor:
                      state === "active" ? ACCENT_WASH : "transparent",
                    opacity:
                      state === "future" ? 0.55 : state === "passed" ? 0.75 : 1,
                    transition: reduced
                      ? "none"
                      : "color 0.4s, border-color 0.4s, background-color 0.4s, opacity 0.4s",
                  }}
                >
                  {LAYER_LABEL[L]}
                  {trace && trace.idx === i && (
                    <TraceOverlay
                      key={trace.gen}
                      w={trace.w}
                      h={trace.h}
                      meet={activeIdx === i}
                      onDone={() => {
                        arrivedRef.current = false;
                        setTrace(null);
                      }}
                    />
                  )}
                </motion.button>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* caption — fixed min-height so the layout never jumps between swaps */}
      <div className="mt-4" style={{ minHeight: "1.5rem" }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={activeL}
            className="font-mono text-[13px] text-[color:var(--muted)] text-center"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.25, ease: EASE }}
          >
            <span style={{ color: "var(--accent)" }}>{LAYER_LABEL[activeL]}</span>
            {" · "}
            {CAPTION[activeL]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* controls — just the step arrows, centered; both wrap and never disable */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          onClick={() => stepBy(-1)}
          className={BTN}
          aria-label="Previous layer"
        >
          ‹
        </button>

        <button
          onClick={() => stepBy(1)}
          className={BTN}
          aria-label="Next layer"
        >
          ›
        </button>
      </div>
    </div>
  );
}
