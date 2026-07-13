import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

// One photo in the gallery. The image bytes live in a Railway Storage Bucket
// (S3-compatible, private-only); this metadata lives in a single manifest.json
// object that the API read-modify-writes on each upload.
export type GalleryItem = {
  id: string;
  /** Object key in the bucket, e.g. "gallery/photos/<id>.webp". */
  key: string;
  /**
   * Serving URL the UI renders. Buckets are private, so we never hand out an
   * object URL — instead we proxy bytes through /api/gallery/photo/<id>. Filled
   * in on read; NOT persisted in the manifest (it's derivable from the id).
   */
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

/** What actually gets written to manifest.json — the serving url is derived, not stored. */
export type StoredItem = Omit<GalleryItem, "url">;

// Fixed key (no random suffix) so the manifest is always at a known location.
export const MANIFEST_KEY = "gallery/manifest.json";
// Where the actual image objects are stored.
export const PHOTOS_PREFIX = "gallery/photos/";

/** Buckets are private — the UI reads photos through this proxy route by id. */
export function photoUrl(id: string): string {
  return `/api/gallery/photo/${id}`;
}

// Railway's "Add to Service" injects the bucket credentials under these
// AWS-conventional names (AWS_ENDPOINT_URL, AWS_S3_BUCKET_NAME,
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION). We read those
// first and fall back to the bare names so both conventions work.
const ENV = {
  endpoint: () => process.env.AWS_ENDPOINT_URL ?? process.env.ENDPOINT,
  bucket: () => process.env.AWS_S3_BUCKET_NAME ?? process.env.BUCKET,
  accessKeyId: () =>
    process.env.AWS_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID,
  secretAccessKey: () =>
    process.env.AWS_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY,
  region: () =>
    process.env.AWS_DEFAULT_REGION ?? process.env.REGION ?? "auto",
};

/** Reading/writing the bucket needs all four S3 credentials to be present. */
export function storageConfigured(): boolean {
  return (
    !!ENV.endpoint() &&
    !!ENV.bucket() &&
    !!ENV.accessKeyId() &&
    !!ENV.secretAccessKey()
  );
}

/** Uploads also require an upload password on top of the bucket credentials. */
export function uploadsConfigured(): boolean {
  return storageConfigured() && !!process.env.UPLOAD_PASSWORD;
}

// Lazily-built singleton so a missing-credentials import never throws at load.
let _client: S3Client | null = null;
export function s3(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: ENV.region(),
    endpoint: ENV.endpoint(),
    credentials: {
      accessKeyId: ENV.accessKeyId() ?? "",
      secretAccessKey: ENV.secretAccessKey() ?? "",
    },
    // Railway buckets use virtual-hosted-style URLs (bucket as subdomain), so
    // leave forcePathStyle unset (the default).
  });
  return _client;
}

/** The bucket name to target on every command. */
export function bucketName(): string {
  return ENV.bucket() ?? "";
}

/**
 * Load the manifest from the bucket. Returns [] on any failure (unconfigured,
 * no manifest yet, missing key, parse error) so callers can always render
 * something. Each item gets a fresh serving url derived from its id.
 */
export async function readManifest(): Promise<GalleryItem[]> {
  if (!storageConfigured()) return [];
  try {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: bucketName(), Key: MANIFEST_KEY }),
    );
    const body = await res.Body?.transformToString();
    if (!body) return [];
    const data = JSON.parse(body) as unknown;
    if (!Array.isArray(data)) return [];
    return (data as StoredItem[]).map((it) => ({ ...it, url: photoUrl(it.id) }));
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
