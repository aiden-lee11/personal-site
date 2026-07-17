"use client";

import { useState } from "react";
import type { OptExample } from "@/data/compiler";
import PassCinema from "./PassCinema";

export default function PassExplorer({ examples }: { examples: OptExample[] }) {
  const [activeId, setActiveId] = useState<OptExample["id"]>(examples[0]?.id ?? "licm");
  // Playback speed lives here (not in PassCinema) so it survives the remount
  // that a pass switch triggers — the chosen multiplier carries across passes.
  const [speed, setSpeed] = useState(1);
  const active = examples.find((e) => e.id === activeId) ?? examples[0];

  return (
    <div className="grid lg:grid-cols-[16rem_1fr] gap-6">
      <nav className="hidden lg:block space-y-2">
        {examples.map((e) => {
          const isActive = e.id === activeId;
          return (
            <button
              key={e.id}
              onClick={() => setActiveId(e.id)}
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
        {/* Mobile: a compact dropdown replaces the stacked card nav so the
            animation stays at the top of the content without scrolling. */}
        <label className="lg:hidden block mb-4">
          <span className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            Pass
          </span>
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value as OptExample["id"])}
            className="mt-1 block w-full rounded border border-[color:var(--border)] bg-[color:var(--bg)] px-2 py-1 font-mono text-xs focus:border-[color:var(--accent)] focus:outline-none"
          >
            {examples.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.fullName}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-4">
          <p className="text-2xl font-semibold tracking-tight leading-tight">{active.fullName}</p>
          <p className="text-[color:var(--muted)] mt-1">{active.tagline}</p>
        </div>

        <p className="text-sm text-[color:var(--muted)] leading-relaxed mb-4 max-w-2xl">
          {active.what}
        </p>

        {/* One looping animated explainer replaces the static before/after panes. */}
        <PassCinema key={active.id} example={active} speed={speed} onSpeedChange={setSpeed} />
      </div>
    </div>
  );
}
