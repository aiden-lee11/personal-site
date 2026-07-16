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
 * Each autoplay advance reads as travel: an accent pulse sweeps the connector
 * from the current node to the next over PULSE_MS, and only on arrival does the
 * next node light up. Hover or focus pauses the clock like a GIF you can
 * inspect, and the ‹ › arrows step by hand (wrapping too, but instantly, no
 * pulse) without permanently stopping the loop. Under prefers-reduced-motion it
 * never autoplays, all motion collapses to instant, but the arrows and caption
 * still work.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 4500;
// The pulse's travel time, carved OUT of STEP_MS (not added): a tick dwells for
// STEP_MS - PULSE_MS on the lit node, then the pulse travels for PULSE_MS.
const PULSE_MS = 650;

// --accent (#a684f5) as literals so the washes read the same in both themes.
const ACCENT = "#a684f5";
const ACCENT_WASH = "rgba(166, 132, 245, 0.12)";
const ACCENT_SOFT_BORDER = "rgba(166, 132, 245, 0.35)";

// One-liners in the site voice, keyed by layer. Prefixed in the caption line by
// the layer's LAYER_LABEL (accent-colored).
const CAPTION: Record<Layer, string> = {
  LC: "the most C-like layer: if/else, loops, nested scopes",
  LB: "control flow starts naming its targets with explicit labels",
  LA: "scopes and loops lowered to straight-line code and branches",
  IR: "SSA form with φ-nodes, where all the optimizations live",
  L3: "linear three-address code: calls, loads, stores",
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

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const armedRef = useRef(false);

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
  // Two chained timeouts split the tick into dwell + travel: at STEP_MS-PULSE_MS
  // we launch the pulse down the connector to `next`, and at STEP_MS the node
  // lights up. The wrap back to LC has no connector, so it skips the pulse.
  // Cleanup clears both timers and nulls pulseIdx, so pausing (or a manual step,
  // which changes activeIdx) mid-pulse never strands a dot.
  useEffect(() => {
    if (reduced || !playing || hovered) return;
    const next = (activeIdx + 1) % LAYERS.length;
    const t1 = window.setTimeout(() => {
      if (next !== 0) setPulseIdx(next);
    }, STEP_MS - PULSE_MS);
    const t2 = window.setTimeout(() => {
      setActiveIdx(next);
      setPulseIdx(null);
    }, STEP_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setPulseIdx(null);
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
                          background: ACCENT,
                          boxShadow: "0 0 8px 2px rgba(166,132,245,0.55)",
                          pointerEvents: "none",
                        }}
                        initial={{ left: "0%", opacity: 0 }}
                        animate={{ left: "100%", opacity: [0, 1, 1, 0.9] }}
                        transition={{ duration: PULSE_MS / 1000, ease: EASE }}
                      />
                    )}
                  </div>
                )}
                <motion.div
                  ref={(el) => {
                    nodeRefs.current[i] = el;
                  }}
                  animate={{ scale: state === "active" && !reduced ? 1.06 : 1 }}
                  transition={{ duration: dur, ease: EASE }}
                  className="font-mono text-sm rounded-md border px-3 py-1.5"
                  style={{
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
                </motion.div>
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
          onClick={() =>
            setActiveIdx((i) => (i + LAYERS.length - 1) % LAYERS.length)
          }
          className={BTN}
          aria-label="Previous layer"
        >
          ‹
        </button>

        <button
          onClick={() => setActiveIdx((i) => (i + 1) % LAYERS.length)}
          className={BTN}
          aria-label="Next layer"
        >
          ›
        </button>
      </div>
    </div>
  );
}
