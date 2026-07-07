"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { SectionTitle, PixelCard, PixelButton } from "@/components/Pixel";
import { workHistory } from "@/data/work";
import { projects } from "@/data/projects";

export default function Home() {
  return (
    <main className="py-10">
      <section className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-center gap-6">
        <div className="justify-self-center md:justify-self-start pixel-border bg-white dark:bg-black p-2">
          <Image
            src="/avatar.jpeg"
            alt="Pixel avatar"
            width={128}
            height={128}
            className="image-rendering-pixelated"
          />
        </div>
        <div>
          <h1 className="font-press text-[24px]">Aiden Lee</h1>
          <p className="font-vt text-[22px]">Engineer • Builder • Web performance enjoyer</p>
          <div className="mt-4 flex gap-3">
            <PixelButton onClick={() => (window.location.href = "/blog")}>Blog</PixelButton>
            <PixelButton className="bg-blue-600 border-blue-800 shadow-[0_6px_0_0_#1e3a8a]" onClick={() => (window.location.href = "/resume")}>Resume</PixelButton>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle>About</SectionTitle>
        <PixelCard>
          <p className="font-vt text-[20px] leading-6">
            I like building fast, delightful web apps. Recently: performance tuning, retro UI, and writing about what I learn.
          </p>
        </PixelCard>
      </section>

      <section className="mt-10">
        <SectionTitle>Work</SectionTitle>
        <div className="grid gap-4">
          {workHistory.map((job) => (
            <PixelCard key={job.company}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-press text-[14px]">{job.role} @ {job.company}</h3>
                <span className="font-vt text-[18px] text-neutral-500">{job.start} – {job.end}</span>
              </div>
              <ul className="list-disc pl-6 mt-2 font-vt text-[20px]">
                {job.highlights.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </PixelCard>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle>Projects</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <PixelCard key={p.name}>
              <h3 className="font-press text-[14px]">{p.name}</h3>
              <p className="font-vt text-[20px]">{p.description}</p>
              {p.link && <Link className="underline" href={p.link}>Link</Link>}
            </PixelCard>
          ))}
        </div>
      </section>
    </main>
  );
}
