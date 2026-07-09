import type { Metadata } from "next";
import { OPT_EXAMPLES } from "@/data/compiler";
import PassExplorer from "./PassExplorer";

export const metadata: Metadata = {
  title: "Compiler Passes · Aiden Lee",
  description:
    "Every IR optimization pass in my compiler — SCCP, DCE, LICM, GVN, and more — each with a minimal before/after example and a live demo.",
};

export default function CompilerPassesPage() {
  return (
    <div>
      <header className="mb-12">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
          What each pass does
        </h1>
        <p className="mt-4 text-[color:var(--muted)] max-w-2xl leading-relaxed">
          Canonical illustrations of all {OPT_EXAMPLES.length} IR optimization
          passes, each at the scale of a single transformation. These are
          hand-crafted minimal examples in the compiler&apos;s own SSA syntax —
          hit <span className="text-[color:var(--fg)]">run live</span> on any
          pass to load a real program into the playground with only that pass
          enabled and see it work on actual output.
        </p>
      </header>

      <PassExplorer examples={OPT_EXAMPLES} />
    </div>
  );
}
