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
 *   trace     — the pass's focus tokens light up everywhere they occur
 *   transform — removed lines strike through + collapse, added lines grow in,
 *               unchanged lines glide to their new spots
 *   after     — the result, dims lift
 *
 * It autoplays only while on-screen (IntersectionObserver), pauses on
 * hover/focus like a GIF you can inspect, and degrades to a static aligned
 * diff under prefers-reduced-motion.
 */

type Phase = "before" | "spot" | "trace" | "transform" | "after";

const DURATION: Record<Phase, number> = {
  before: 2000,
  spot: 3000,
  trace: 3200,
  transform: 1800,
  after: 3000,
};

const EASE = [0.22, 1, 0.36, 1] as const;
// --accent (#a684f5) as rgba so we can animate to/from transparent.
const ADD_TINT = "rgba(166, 132, 245, 0.18)";
const ADD_TINT_OFF = "rgba(166, 132, 245, 0)";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

type RowKind = "same" | "del" | "add";
type Row = { key: string; kind: RowKind; text: string };

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

/** Split a line into text + highlighted-token nodes. */
function renderTokens(
  text: string,
  re: RegExp | null,
  variant: "pill" | "accent",
): React.ReactNode {
  if (!re) return text;
  re.lastIndex = 0;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      variant === "pill" ? (
        <span key={key++} className="pass-pill">
          {m[0]}
        </span>
      ) : (
        <span key={key++} style={{ color: "var(--accent)" }}>
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
  const tokenRe = useMemo(() => buildTokenRegex(tokens), [tokens]);

  const phases = useMemo<Phase[]>(
    () => ["before", "spot", ...(tokens.length ? (["trace"] as Phase[]) : []), "transform", "after"],
    [tokens.length],
  );

  const captions = useMemo<Record<Phase, string>>(
    () => ({
      before: "before",
      spot: example.story?.spot ?? example.tagline,
      trace: example.story?.trace ?? "tracing the values involved",
      transform: example.story?.transform ?? "applying the transform",
      after: "after",
    }),
    [example.story, example.tagline],
  );

  const maxLines = useMemo(
    () => Math.max(example.before.split("\n").length, example.after.split("\n").length),
    [example.before, example.after],
  );

  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [phaseIdx, setPhaseIdx] = useState(0);
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
    const phase = phases[phaseIdx] ?? "before";
    const id = window.setTimeout(() => {
      setPhaseIdx((prev) => {
        const next = (prev + 1) % phases.length;
        if (next === 0) setLoopCount((c) => c + 1);
        return next;
      });
    }, DURATION[phase]);
    return () => window.clearTimeout(id);
  }, [reduced, playing, inView, hovered, phaseIdx, phases]);

  if (reduced) return <StaticDiff rows={rows} minLines={maxLines} />;

  const phase = phases[phaseIdx] ?? "before";
  const showCallout = phase === "spot" || phase === "trace" || phase === "transform";

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
                <RowLine key={row.key} row={row} phase={phase} tokenRe={tokenRe} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {showCallout && (
            <motion.div
              key={phase}
              className="pass-callout font-mono"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              aria-hidden
            >
              {renderTokens(captions[phase], tokenRe, "accent")}
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
          {phases.map((p, i) => {
            const isActive = i === phaseIdx;
            return (
              <button
                key={p}
                role="tab"
                aria-selected={isActive}
                aria-label={p}
                onClick={() => setPhaseIdx(i)}
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
            setPhaseIdx(0);
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

/** Height/opacity targets for a row in a given phase. */
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

function RowLine({
  row,
  phase,
  tokenRe,
}: {
  row: Row;
  phase: Phase;
  tokenRe: RegExp | null;
}) {
  const target = rowTarget(row.kind, phase);
  const strike = row.kind === "del" && phase === "transform";
  const addBg =
    row.kind === "add"
      ? phase === "transform"
        ? ADD_TINT
        : ADD_TINT_OFF
      : TRANSPARENT;
  const showPills = tokenRe !== null && phase === "trace";
  const { indent, code, comment } = splitLine(row.text || " ");
  const hasCode = code.trim() !== "";
  // Each removed line gets its own tight outline during spot/trace — no
  // group-spanning shapes, and never an empty box around a blank line.
  const marked = row.kind === "del" && hasCode && (phase === "spot" || phase === "trace");

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
            {renderTokens(code, showPills ? tokenRe : null, "pill")}
          </motion.span>
        )}
        {renderTokens(comment, showPills ? tokenRe : null, "pill")}
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
