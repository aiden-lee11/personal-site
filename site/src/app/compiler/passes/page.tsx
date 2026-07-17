import type { Metadata } from "next";
import { OPT_EXAMPLES } from "@/data/compiler";
import PassExplorer from "./PassExplorer";

export const metadata: Metadata = {
  title: "Compiler Optimizations · Aiden Lee",
  description: "A closer look at the compiler's optimizations.",
};

export default function CompilerPassesPage() {
  return (
    <div>
      <header className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.035em] leading-tight">
          What each optimization does
        </h1>
        <p className="mt-4 text-[color:var(--muted)] max-w-2xl leading-relaxed">
          Small examples of what each optimization changes.
        </p>
      </header>

      <PassExplorer examples={OPT_EXAMPLES} />
    </div>
  );
}
