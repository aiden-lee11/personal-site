import type { Metadata } from "next";
import Link from "next/link";
import { readManifest, sortItems, blobConfigured } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Gallery · Aiden Lee",
  description: "Photos, moments, and things worth remembering — off the clock.",
};

// The manifest changes whenever a photo is added, so render on every request.
export const dynamic = "force-dynamic";

/** "2026-06-14" → "Jun 2026" — enough context without cluttering each caption. */
function formatMonth(date: string): string {
  const [y, m] = date.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return "";
  return `${months[mi]} ${y}`;
}

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
            {blobConfigured() ? (
              <>
                Head to the{" "}
                <Link href="/gallery/upload" className="link-underline">
                  upload page
                </Link>{" "}
                to add the first one.
              </>
            ) : (
              <span className="font-mono text-sm">
                Blob storage isn’t configured on this deployment yet.
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [column-fill:_balance]">
          {items.map((item) => (
            <figure
              key={item.id}
              className="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--subtle)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.caption || "Gallery photo"}
                width={item.w}
                height={item.h}
                loading="lazy"
                className="block w-full h-auto"
                style={
                  item.w && item.h
                    ? { aspectRatio: `${item.w} / ${item.h}` }
                    : undefined
                }
              />
              {(item.caption || item.date) && (
                <figcaption className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-[color:var(--fg)] leading-snug">
                    {item.caption}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)] tabular">
                    {formatMonth(item.date)}
                  </span>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
