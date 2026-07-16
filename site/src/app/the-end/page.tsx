import type { Metadata } from "next";
import TheEndFrame from "./TheEndFrame";

export const metadata: Metadata = {
  title: "The End · Aiden Lee",
  description:
    "A Minecraft End scene rendered from scratch in WebGL, with no engine and no three.js.",
};

export default function TheEndPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 pt-20 pb-24 sm:pt-28">
      <header className="mb-10">
        <p className="eyebrow mb-5">Interactive / WebGL</p>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.055em] leading-[0.95] max-w-4xl">
          The End<span className="text-[color:var(--accent)]">?</span>
        </h1>
        <p className="mt-6 text-[color:var(--muted)] max-w-2xl leading-relaxed">
          Graphics is hard man. I built this for my CS 351 Graphics final
          project, it&apos;s a from scratch WebGL project so there&apos;s no
          modern nice three.js or anything. The whole scene is hand-rolled over
          the course of a quarter and all the assets were collected from free
          online sources and stitched together. For how buggy and bad this is
          it took hilariously long to implement, so I&apos;m just gonna say any
          and all bugs are intended features :D
        </p>
        <p className="mt-4 font-mono text-xs text-[color:var(--muted)]">
          this project requires a real keyboard so phone interactions
          won&apos;t work :/
        </p>
      </header>

      {/* The scene — controls and instructions live inside the embed */}
      <section className="mb-8">
        <TheEndFrame />
      </section>
    </div>
  );
}
