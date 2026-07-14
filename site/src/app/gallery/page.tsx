import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { readManifest, sortItems, storageConfigured } from "@/lib/gallery";
import GalleryFeed from "./GalleryFeed";

export const metadata: Metadata = {
  title: "Gallery · Aiden Lee",
  description: "Photos, moments, and things worth remembering, off the clock.",
};

// The manifest changes whenever a photo is added, so render on every request.
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const items = sortItems(await readManifest());

  return (
    <div className="pt-20 pb-24 sm:pt-28">
      {/* Header (and the empty state) stay in the reading column; the strip below
          breaks out to full width, so it lives outside this max-w container. */}
      <div className="mx-auto max-w-5xl px-6">
        <header>
          <p className="eyebrow">Off the clock</p>
          <h1 className="mt-6 text-5xl sm:text-7xl font-semibold tracking-[-0.05em] leading-[0.95]">
            Gallery
          </h1>
        </header>

        {items.length === 0 && (
          <div className="mt-16 border-t border-[color:var(--border)] pt-10">
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
        )}
      </div>

      {items.length > 0 && (
        // Full-bleed: rendered outside the max-w container. Suspense boundary
        // required: GalleryFeed reads useSearchParams (?tag=).
        <div className="mt-10">
          <Suspense fallback={null}>
            <GalleryFeed items={items} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
