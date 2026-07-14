"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { diffArrays } from "diff";
import type { OptExample } from "@/data/compiler";

/**
 * A pre-baked, 3Blue1Brown-style animated explainer for a single optimization
 * pass. The whole timeline is computed once from `before`/`after` (via
 * diffArrays) and then played on a loop:
 *
 *   before    — the input, all lines lit
 *   spot      — the lines that will change get a tight rounded outline hugging
 *               just their instruction text, everything else dims
 *   step 1..N — a sequence of granular narrative beats. Each step pill-lights a
 *               small set of tokens and/or rings whole instruction lines, moving
 *               attention token-by-token; brightened lines pop while the rest
 *               dim, so the highlight reads as motion. (An example without
 *               authored `steps` falls back to a single focus-token `trace`.)
 *   transform — removed lines strike through + collapse, added lines grow in,
 *               unchanged lines glide to their new spots
 *   after     — the result, dims lift
 *
 * It autoplays only while on-screen (IntersectionObserver), pauses on
 * hover/focus like a GIF you can inspect, and degrades to a static aligned
 * diff under prefers-reduced-motion (steps don't appear there).
 */

type Phase = "before" | "spot" | "trace" | "transform" | "after";

const DURATION: Record<Phase, number> = {
  before: 2000,
  spot: 3000,
  trace: 3200,
  transform: 1800,
  after: 3000,
};
// Each authored step dwells long enough to read the caption and the highlight.
const STEP_DURATION = 2800;

const EASE = [0.22, 1, 0.36, 1] as const;
// --accent (#a684f5) as rgba so we can animate to/from transparent.
const ADD_TINT = "rgba(166, 132, 245, 0.18)";
const ADD_TINT_OFF = "rgba(166, 132, 245, 0)";
const TRANSPARENT = "rgba(0, 0, 0, 0)";
// Warm ember for the second-actor pills/callout tokens. The var may not be in
// :root yet, so the literal fallback is what actually paints today.
const EMBER = "var(--ember, #f2a65a)";
// Shared empty set for stages that have no warm (ember) tokens — avoids realloc.
const EMPTY_WARM: ReadonlySet<string> = new Set<string>();

type RowKind = "same" | "del" | "add";
type Row = { key: string; kind: RowKind; text: string };

/**
 * One beat of the timeline. Steps map onto the "trace" visual bucket (same
 * dimming semantics) but each carries its own pill tokens + outline set and its
 * own caption, and marks `isStep` so brightening is per-line rather than
 * blanket. before/spot/transform/after are the fixed framing beats.
 */
type Stage = {
  key: string;
  phase: Phase;
  caption?: string;
  // pillRe matches every token the step highlights (marks ∪ warm); warmSet says
  // which of those matches paint ember rather than purple.
  pillRe: RegExp | null;
  warmSet: ReadonlySet<string>;
  outline: string[];
  isStep: boolean;
  duration: number;
};

function buildRows(before: string, after: string): Row[] {
  const chunks = diffArrays(before.split("\n"), after.split("\n"));
  const rows: Row[] = [];
  const seen = new Map<string, number>();
  for (const c of chunks) {
    const kind: RowKind = c.removed ? "del" : c.added ? "add" : "same";
    for (const t of c.value) {
      // Key by kind + content + occurrence index so framer keeps stable
      // identities across phase changes (FLIP) and only remounts on loop.
      const base = `${kind}|${t}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      rows.push({ kind, text: t, key: `${base}|${n}` });
    }
  }
  return rows;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildTokenRegex(tokens: string[]): RegExp | null {
  if (!tokens.length) return null;
  const body = tokens
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join("|");
  // Custom boundaries: don't match inside a longer identifier, and don't let
  // "%t" match the "%t" prefix of "%tmp".
  return new RegExp(`(?<![\\w%:])(?:${body})(?![\\w])`, "g");
}

/** Whether a line contains at least one token this stage would pill. */
function lineHasToken(text: string, re: RegExp | null): boolean {
  if (!re) return false;
  re.lastIndex = 0;
  return re.test(text);
}

/** Whether a line should get a per-line ring this step (trimmed substring). */
function lineMatchesOutline(text: string, outline: string[]): boolean {
  if (!outline.length) return false;
  const t = text.trim();
  return outline.some((o) => t.includes(o));
}

/**
 * Split a line into text + highlighted-token nodes. `re` matches both purple
 * (marks) and ember (warm) tokens; `warmSet` decides, per match, which is which
 * — warm tokens paint ember (pill wash + text), the rest stay purple/accent, so
 * two contrasted actors read as visually distinct within the same step.
 */
function renderTokens(
  text: string,
  re: RegExp | null,
  variant: "pill" | "accent",
  warmSet: ReadonlySet<string> = EMPTY_WARM,
): React.ReactNode {
  if (!re) return text;
  re.lastIndex = 0;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = key++;
    const warm = warmSet.has(m[0]);
    out.push(
      variant === "pill" ? (
        // Keying on the matched text forces a remount (so the fade/scale-in
        // replays) whenever the token at this slot changes between steps.
        <motion.span
          key={`${k}-${m[0]}`}
          className={warm ? "pass-pill-warm" : "pass-pill"}
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          style={{
            display: "inline-block",
            verticalAlign: "baseline",
            color: warm ? EMBER : undefined,
          }}
        >
          {m[0]}
        </motion.span>
      ) : (
        <span key={k} style={{ color: warm ? EMBER : "var(--accent)" }}>
          {m[0]}
        </span>
      ),
    );
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  if (out.length === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const PANE_STYLE: React.CSSProperties = {
  background: "var(--code-bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "1rem 1.15rem",
  fontSize: "0.83rem",
  lineHeight: 1.6,
};

/* ── Animated cinema ─────────────────────────────────────────────────────── */

export default function PassCinema({ example }: { example: OptExample }) {
  const rows = useMemo(
    () => buildRows(example.before, example.after),
    [example.before, example.after],
  );
  const tokens = useMemo(() => example.focus ?? [], [example.focus]);
  // Focus-token regex — used only to accent-color tokens inside the callout.
  const tokenRe = useMemo(() => buildTokenRegex(tokens), [tokens]);

  const stages = useMemo<Stage[]>(() => {
    const list: Stage[] = [];
    list.push({
      key: "before",
      phase: "before",
      pillRe: null,
      warmSet: EMPTY_WARM,
      outline: [],
      isStep: false,
      duration: DURATION.before,
    });
    list.push({
      key: "spot",
      phase: "spot",
      caption: example.story?.spot ?? example.tagline,
      pillRe: null,
      warmSet: EMPTY_WARM,
      outline: [],
      isStep: false,
      duration: DURATION.spot,
    });
    if (example.steps?.length) {
      // Authored steps replace the single trace beat entirely. Purple marks and
      // ember warm tokens share one match regex; warmSet tags which are ember.
      example.steps.forEach((s, i) => {
        const marks = s.marks ?? [];
        const warm = s.warm ?? [];
        list.push({
          key: `step-${i}`,
          phase: "trace",
          caption: s.caption,
          pillRe: buildTokenRegex([...marks, ...warm]),
          warmSet: warm.length ? new Set(warm) : EMPTY_WARM,
          outline: s.outline ?? [],
          isStep: true,
          duration: STEP_DURATION,
        });
      });
    } else if (tokens.length) {
      list.push({
        key: "trace",
        phase: "trace",
        caption: example.story?.trace ?? "tracing the values involved",
        pillRe: tokenRe,
        warmSet: EMPTY_WARM,
        outline: [],
        isStep: false,
        duration: DURATION.trace,
      });
    }
    list.push({
      key: "transform",
      phase: "transform",
      caption: example.story?.transform ?? "applying the transform",
      pillRe: null,
      warmSet: EMPTY_WARM,
      outline: [],
      isStep: false,
      duration: DURATION.transform,
    });
    list.push({
      key: "after",
      phase: "after",
      pillRe: null,
      warmSet: EMPTY_WARM,
      outline: [],
      isStep: false,
      duration: DURATION.after,
    });
    return list;
  }, [example.steps, example.story, example.tagline, tokens.length, tokenRe]);

  const maxLines = useMemo(
    () => Math.max(example.before.split("\n").length, example.after.split("\n").length),
    [example.before, example.after],
  );

  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [stageIdx, setStageIdx] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Only churn while on-screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Autoplay clock.
  useEffect(() => {
    if (reduced || !playing || !inView || hovered) return;
    const dwell = stages[stageIdx]?.duration ?? DURATION.before;
    const id = window.setTimeout(() => {
      setStageIdx((prev) => {
        const next = (prev + 1) % stages.length;
        if (next === 0) setLoopCount((c) => c + 1);
        return next;
      });
    }, dwell);
    return () => window.clearTimeout(id);
  }, [reduced, playing, inView, hovered, stageIdx, stages]);

  if (reduced) return <StaticDiff rows={rows} minLines={maxLines} />;

  const stage = stages[stageIdx] ?? stages[0];
  const showCallout = stage.caption != null;
  // The callout legend mirrors the code: on an authored step, color its own
  // marks (accent) and warm (ember) tokens; on the framing beats, fall back to
  // the focus tokens as accent, exactly as before.
  const calloutRe = stage.isStep ? stage.pillRe : tokenRe;
  const calloutWarm = stage.isStep ? stage.warmSet : EMPTY_WARM;

  return (
    <div
      ref={rootRef}
      data-cinema
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      {/* pane + pinned spotlight callout */}
      <div style={{ position: "relative" }}>
        <div
          className="font-mono"
          style={{ ...PANE_STYLE, overflowX: "auto", overflowY: "visible" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={loopCount}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ minHeight: `${maxLines * 1.6}em` }}
            >
              {rows.map((row) => (
                <RowLine key={row.key} row={row} stage={stage} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {showCallout && (
            <motion.div
              key={stage.key}
              className="pass-callout font-mono"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              aria-hidden
            >
              {renderTokens(stage.caption ?? "", calloutRe, "accent", calloutWarm)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* controls */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚ pause" : "▸ play"}
        </button>

        <div className="flex items-center gap-1.5" role="tablist" aria-label="Animation steps">
          {stages.map((s, i) => {
            const isActive = i === stageIdx;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={isActive}
                aria-label={s.key}
                onClick={() => setStageIdx(i)}
                className="rounded-full transition-all"
                style={{
                  width: isActive ? 16 : 6,
                  height: 6,
                  background: isActive ? "var(--accent)" : "var(--border)",
                }}
              />
            );
          })}
        </div>

        <button
          onClick={() => {
            setStageIdx(0);
            setLoopCount((c) => c + 1);
            setPlaying(true);
          }}
          className="font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
          aria-label="Replay"
        >
          ↺ replay
        </button>
      </div>
    </div>
  );
}

/** Height/opacity targets for a row in a given (non-step) phase. */
function rowTarget(kind: RowKind, phase: Phase): { opacity: number; height: number | "auto" } {
  if (kind === "same") {
    const dim = phase === "spot" || phase === "trace";
    return { opacity: dim ? 0.32 : 1, height: "auto" };
  }
  if (kind === "del") {
    if (phase === "transform" || phase === "after") return { opacity: 0, height: 0 };
    return { opacity: 1, height: "auto" };
  }
  // add
  if (phase === "transform" || phase === "after") return { opacity: 1, height: "auto" };
  return { opacity: 0, height: 0 };
}

/**
 * Split a code line into leading indent, the instruction text, and a trailing
 * `;;` comment (with the whitespace before it). Only `code` gets the spotlight
 * outline, so the ring hugs the instruction and never the pane width or the
 * comment.
 */
function splitLine(text: string): { indent: string; code: string; comment: string } {
  const ci = text.indexOf(";;");
  const head = ci >= 0 ? text.slice(0, ci) : text;
  const comment = ci >= 0 ? text.slice(ci) : "";
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(head);
  const indent = m?.[1] ?? "";
  const code = m?.[2] ?? head;
  const trail = m?.[3] ?? "";
  return { indent, code, comment: trail + comment };
}

// Tight per-line spotlight ring (--accent #a684f5), animated on/off in place.
const MARK_VARIANTS: Variants = {
  off: {
    boxShadow: "0 0 0 1px rgba(166, 132, 245, 0)",
    backgroundColor: "rgba(166, 132, 245, 0)",
    scale: 1,
  },
  on: {
    boxShadow: "0 0 0 1px rgba(166, 132, 245, 0.85)",
    backgroundColor: "rgba(166, 132, 245, 0.12)",
    scale: [0.97, 1],
  },
};

function RowLine({ row, stage }: { row: Row; stage: Stage }) {
  const { phase, pillRe, warmSet, outline, isStep } = stage;
  const { indent, code, comment } = splitLine(row.text || " ");
  const hasCode = code.trim() !== "";
  const showPills = phase === "trace" && pillRe !== null;

  // Per-line ring: during a step it follows the step's `outline`; otherwise it
  // hugs the removed lines during spot / fallback-trace, exactly as before.
  const marked = isStep
    ? hasCode && lineMatchesOutline(row.text, outline)
    : row.kind === "del" && hasCode && (phase === "spot" || phase === "trace");

  // Within a step, only outlined lines and lines carrying a pilled token stay
  // fully lit; everything else dims so attention lands on the beat.
  const activeRow = isStep && (marked || lineHasToken(row.text, pillRe));

  let target = rowTarget(row.kind, phase);
  if (isStep) {
    target =
      row.kind === "add"
        ? { opacity: 0, height: 0 }
        : { opacity: activeRow ? 1 : 0.3, height: "auto" };
  }

  const strike = row.kind === "del" && phase === "transform";
  const addBg =
    row.kind === "add"
      ? phase === "transform"
        ? ADD_TINT
        : ADD_TINT_OFF
      : TRANSPARENT;

  return (
    <motion.div
      initial={{ ...rowTarget(row.kind, "before"), backgroundColor: TRANSPARENT }}
      animate={{ opacity: target.opacity, height: target.height, backgroundColor: addBg }}
      transition={{ duration: 0.55, ease: EASE }}
      style={{ overflow: "hidden", whiteSpace: "pre", borderRadius: 4 }}
    >
      <span
        style={{
          display: "inline-block",
          textDecoration: strike ? "line-through" : "none",
          opacity: strike ? 0.7 : 1,
        }}
      >
        {indent}
        {/* Wrap the instruction text only when there is some — a whitespace-only
            line never gets a mark span (so no empty outlined box, any phase). */}
        {hasCode && (
          <motion.span
            className="pass-mark"
            initial={false}
            animate={marked ? "on" : "off"}
            variants={MARK_VARIANTS}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {renderTokens(code, showPills ? pillRe : null, "pill", warmSet)}
          </motion.span>
        )}
        {renderTokens(comment, showPills ? pillRe : null, "pill", warmSet)}
      </span>
    </motion.div>
  );
}

/* ── Reduced-motion fallback: a static aligned diff ──────────────────────── */

function StaticDiff({ rows, minLines }: { rows: Row[]; minLines: number }) {
  const before = rows.filter((r) => r.kind !== "add");
  const after = rows.filter((r) => r.kind !== "del");

  const col = (list: Row[], side: "before" | "after") => (
    <div className="min-w-0">
      <p
        className={`font-mono text-[10px] tracking-widest uppercase mb-2 ${
          side === "after" ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]"
        }`}
      >
        {side}
      </p>
      <div
        className="font-mono"
        style={{ ...PANE_STYLE, overflowX: "auto", minHeight: `${minLines * 1.6}em` }}
      >
        {list.map((r, i) => {
          const bg =
            r.kind === "add"
              ? "rgba(166, 132, 245, 0.14)"
              : r.kind === "del"
                ? "rgba(131, 126, 145, 0.14)"
                : "transparent";
          const border =
            r.kind === "add"
              ? "2px solid var(--accent)"
              : r.kind === "del"
                ? "2px solid var(--muted)"
                : "2px solid transparent";
          return (
            <div
              key={i}
              style={{
                whiteSpace: "pre",
                background: bg,
                borderLeft: border,
                paddingLeft: 6,
                marginLeft: -6,
                opacity: r.kind === "same" ? 0.6 : 1,
              }}
            >
              {r.text || " "}
            </div>
          );
        })}
      </div>
    </div>
  );

  return <div className="grid md:grid-cols-2 gap-4 min-w-0">{col(before, "before")}{col(after, "after")}</div>;
}
