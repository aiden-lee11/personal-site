"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { OptExample } from "@/data/compiler";
import { PASS_DEMOS } from "@/data/passDemos";

export default function PassExplorer({ examples }: { examples: OptExample[] }) {
  const [activeId, setActiveId] = useState<OptExample["id"]>(examples[0]?.id ?? "licm");
  const [showAfter, setShowAfter] = useState(false);
  const active = examples.find((e) => e.id === activeId) ?? examples[0];
  const hasDemo = active.id in PASS_DEMOS;

  return (
    <div className="grid lg:grid-cols-[16rem_1fr] gap-6">
      <nav className="space-y-2">
        {examples.map((e) => {
          const isActive = e.id === activeId;
          return (
            <button
              key={e.id}
              onClick={() => {
                setActiveId(e.id);
                setShowAfter(false);
              }}
              className={`w-full text-left rounded-lg border p-3 transition-all ${
                isActive
                  ? "border-[color:var(--accent)] bg-[color:var(--subtle)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--fg)]"
              }`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className={`font-mono text-xs ${
                    isActive ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  {e.name}
                </span>
              </div>
              <div className="text-sm">{e.fullName}</div>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-6 mb-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-serif text-2xl leading-tight">{active.fullName}</p>
            <p className="text-[color:var(--muted)] mt-1">{active.tagline}</p>
          </div>
          <div className="flex items-center gap-2">
            {hasDemo && (
              <Link
                href={`/compiler/playground?demo=${active.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--accent)] text-[color:var(--accent)] hover:bg-[color:var(--accent)] hover:text-[color:var(--bg)] transition-colors font-mono text-xs"
                title="Load a demo program into the playground with only this pass enabled"
              >
                ▸ run live
              </Link>
            )}
            {/* Mobile-only: desktop already shows both panes side-by-side */}
            <div
              className="inline-flex md:hidden items-center rounded-full border border-[color:var(--border)] p-0.5 font-mono text-xs"
              role="tablist"
              aria-label="Before/After toggle"
            >
              <button
                role="tab"
                aria-selected={!showAfter}
                onClick={() => setShowAfter(false)}
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  !showAfter
                    ? "bg-[color:var(--fg)] text-[color:var(--bg)]"
                    : "text-[color:var(--muted)]"
                }`}
              >
                before
              </button>
              <button
                role="tab"
                aria-selected={showAfter}
                onClick={() => setShowAfter(true)}
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  showAfter
                    ? "bg-[color:var(--accent)] text-[color:var(--bg)]"
                    : "text-[color:var(--muted)]"
                }`}
              >
                after
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm text-[color:var(--muted)] leading-relaxed mb-4 max-w-2xl">
          {active.what}
        </p>

        <div className="hidden md:grid md:grid-cols-2 gap-4 min-w-0">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--muted)] mb-2">
              Before
            </p>
            <pre className="code-pane max-h-[60vh]">
              <code>{active.before}</code>
            </pre>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-widest uppercase text-[color:var(--accent)] mb-2">
              After
            </p>
            <pre className="code-pane max-h-[60vh]">
              <code>{active.after}</code>
            </pre>
          </div>
        </div>
        <div className="md:hidden">
          <AnimatePresence mode="wait">
            <motion.pre
              key={showAfter ? "after" : "before"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="code-pane max-h-[60vh]"
            >
              <code>{showAfter ? active.after : active.before}</code>
            </motion.pre>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
