import { list } from "@vercel/blob";

// One photo in the gallery. Images live in Vercel Blob; this metadata lives in
// a single manifest.json blob that the API read-modify-writes on each upload.
export type GalleryItem = {
  id: string;
  url: string;
  caption: string;
  /** ISO date (YYYY-MM-DD) the photo is *about* — user-supplied, drives sort. */
  date: string;
  /** Natural pixel dimensions, sent by the client, used to avoid layout shift. */
  w?: number;
  h?: number;
  /** When it was uploaded (ISO timestamp) — tiebreaker for same-day photos. */
  uploadedAt: string;
};

// Fixed pathname (no random suffix) so the manifest is always at a known key.
export const MANIFEST_PATH = "gallery/manifest.json";
// Where the actual image blobs are stored.
export const PHOTOS_PREFIX = "gallery/photos/";

/** Uploads only work when a Blob token AND an upload password are configured. */
export function uploadsConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN && !!process.env.UPLOAD_PASSWORD;
}

/** Reading the gallery just needs the Blob token. */
export function blobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Load the manifest from Blob. Returns [] on any failure (unconfigured, no
 * manifest yet, transient error) so callers can always render something.
 */
export async function readManifest(): Promise<GalleryItem[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return [];
  try {
    const { blobs } = await list({ prefix: MANIFEST_PATH, token });
    const manifest = blobs.find((b) => b.pathname === MANIFEST_PATH);
    if (!manifest) return [];
    // no-store: the manifest is overwritten in place, so we must never serve a
    // cached copy or a fresh upload would appear to vanish on the next load.
    const res = await fetch(manifest.url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as GalleryItem[]) : [];
  } catch {
    return [];
  }
}

/** Newest first, by the photo's own date, then by upload time. */
export function sortItems(items: GalleryItem[]): GalleryItem[] {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.uploadedAt < b.uploadedAt ? 1 : -1;
  });
}
