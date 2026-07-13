import type { Metadata } from "next";
import Link from "next/link";
import { readManifest, sortItems, storageConfigured } from "@/lib/gallery";
import GalleryBoard from "./GalleryBoard";

export const metadata: Metadata = {
  title: "Gallery · Aiden Lee",
  description: "Photos, moments, and things worth remembering — off the clock.",
};

// The manifest changes whenever a photo is added, so render on every request.
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const items = sortItems(await readManifest());

  return (
    <div className="mx-auto max-w-5xl px-6 pt-20 pb-24 sm:pt-28">
      <header className="grid gap-6 pb-16 lg:grid-cols-[1fr_18rem] lg:items-end">
        <div>
          <p className="eyebrow">Off the clock</p>
          <h1 className="mt-6 text-5xl sm:text-7xl font-semibold tracking-[-0.05em] leading-[0.95]">
            Gallery
          </h1>
        </div>
        <p className="text-[color:var(--muted)] lg:text-right">
          Photos, moments, and things worth remembering.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="border-t border-[color:var(--border)] pt-10">
          <p className="text-[color:var(--muted)] max-w-md leading-relaxed">
            No photos yet.{" "}
            {storageConfigured() ? (
              <>
                Head to the{" "}
                <Link href="/gallery/upload" className="link-underline">
                  upload page
                </Link>{" "}
                to add the first one.
              </>
            ) : (
              <span className="font-mono text-sm">
                Photo storage isn’t configured on this deployment yet.
              </span>
            )}
          </p>
        </div>
      ) : (
        <GalleryBoard items={items} />
      )}
    </div>
  );
}
