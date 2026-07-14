import type { Metadata } from "next";
import { OPT_EXAMPLES } from "@/data/compiler";
import PassExplorer from "./PassExplorer";

export const metadata: Metadata = {
  title: "Compiler Passes · Aiden Lee",
  description: "A closer look at the compiler's optimizations.",
};

export default function CompilerPassesPage() {
  return (
    <div>
      <header className="mb-12">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
          What each pass does
        </h1>
        <p className="mt-4 text-[color:var(--muted)] max-w-2xl leading-relaxed">
          Small examples of what each optimization changes. Use{" "}
          <span className="text-[color:var(--fg)]">run live</span> to open an
          example in the playground.
        </p>
      </header>

      <PassExplorer examples={OPT_EXAMPLES} />
    </div>
  );
}
