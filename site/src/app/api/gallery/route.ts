import { NextResponse } from "next/server";
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import {
  MANIFEST_KEY,
  PHOTOS_PREFIX,
  bucketName,
  normalizeTags,
  photoUrl,
  readManifest,
  s3,
  sortItems,
  storageConfigured,
  uploadsConfigured,
  type GalleryItem,
  type StoredItem,
} from "@/lib/gallery";

export const runtime = "nodejs";
// Never cache the API — the manifest changes on every upload/edit/delete.
export const dynamic = "force-dynamic";

// Client compresses before sending, so anything over this is almost certainly
// a mistake. Also keeps us clear of the platform's request body ceiling.
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CAPTION = 280;
// Cap on files in one grouped (stack) upload — keeps the request body sane.
const MAX_GROUP = 10;

/** Constant-time password check so we don't leak length/prefix via timing. */
function passwordOk(supplied: string): boolean {
  const secret = process.env.UPLOAD_PASSWORD ?? "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(secret);
  if (a.length !== b.length || b.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function extFor(type: string): string {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export async function GET() {
  const items = sortItems(await readManifest());
  return NextResponse.json({ items, configured: storageConfigured() });
}

export async function POST(req: Request) {
  if (!uploadsConfigured()) {
    return NextResponse.json(
      { error: "Uploads aren’t configured on this deployment." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data." },
      { status: 400 },
    );
  }

  if (!passwordOk(String(form.get("password") ?? ""))) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  // One or many files: a "stack" upload sends several `file` entries (plus a
  // `w`/`h` pair each, in the same order). A single file is byte-identical to
  // the old single-upload path — no group field, `{ item }` response.
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (files.length > MAX_GROUP) {
    return NextResponse.json(
      { error: `Too many photos — ${MAX_GROUP} max per upload.` },
      { status: 400 },
    );
  }
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "That file isn’t an image." },
        { status: 400 },
      );
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large even after compression (8MB max)." },
        { status: 413 },
      );
    }
  }

  const caption = String(form.get("caption") ?? "")
    .slice(0, MAX_CAPTION)
    .trim();
  const rawDate = String(form.get("date") ?? "").slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : new Date().toISOString().slice(0, 10);
  // Per-file natural dimensions, positional to the file list.
  const ws = form.getAll("w");
  const hs = form.getAll("h");
  const tags = normalizeTags(String(form.get("tags") ?? ""));

  // Shared across the set: one group id (only when >1 file) and one upload
  // timestamp so the members sort adjacently in the feed.
  const group = files.length > 1 ? crypto.randomUUID() : undefined;
  const uploadedAt = new Date().toISOString();

  const created: GalleryItem[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = crypto.randomUUID();
    const key = `${PHOTOS_PREFIX}${id}.${extFor(file.type)}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await s3().send(
      new PutObjectCommand({
        Bucket: bucketName(),
        Key: key,
        Body: bytes,
        ContentType: file.type,
      }),
    );
    const stored: StoredItem = {
      id,
      key,
      caption,
      date,
      w: Number(ws[i]) || undefined,
      h: Number(hs[i]) || undefined,
      tags,
      ...(group ? { group } : {}),
      uploadedAt,
    };
    created.push({ ...stored, url: photoUrl(id) });
  }

  const items = await readManifest();
  items.push(...created);
  await writeManifest(items);

  // Multiple → `{ items }`; single → `{ item }` so existing clients are unchanged.
  return created.length > 1
    ? NextResponse.json({ items: created })
    : NextResponse.json({ item: created[0] });
}

export async function PATCH(req: Request) {
  if (!uploadsConfigured()) {
    return NextResponse.json(
      { error: "Uploads aren’t configured on this deployment." },
      { status: 503 },
    );
  }

  let body: {
    id?: string;
    password?: string;
    caption?: string;
    date?: string;
    tags?: string[] | string;
  };
  try {
    body = (await req.json()) as {
      id?: string;
      password?: string;
      caption?: string;
      date?: string;
      tags?: string[] | string;
    };
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  if (!passwordOk(String(body.password ?? ""))) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const items = await readManifest();
  const target = items.find((i) => i.id === id);
  if (!target) {
    return NextResponse.json({ error: "No such photo." }, { status: 404 });
  }

  // Only touch fields the caller supplied. Unlike POST, a bad or absent date
  // never falls back to today — the stored date stays as-is.
  if (body.caption !== undefined) {
    target.caption = String(body.caption).slice(0, MAX_CAPTION).trim();
  }
  const rawDate = String(body.date ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    target.date = rawDate;
  }
  // Tags: supplied (even "" or []) replaces the set; absent leaves it untouched.
  if (body.tags !== undefined) {
    target.tags = normalizeTags(body.tags);
  }
  await writeManifest(items);

  return NextResponse.json({ item: target });
}

export async function DELETE(req: Request) {
  if (!uploadsConfigured()) {
    return NextResponse.json(
      { error: "Uploads aren’t configured on this deployment." },
      { status: 503 },
    );
  }

  let body: { id?: string; password?: string };
  try {
    body = (await req.json()) as { id?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  if (!passwordOk(String(body.password ?? ""))) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const items = await readManifest();
  const target = items.find((i) => i.id === id);
  if (!target) {
    return NextResponse.json({ error: "No such photo." }, { status: 404 });
  }
  // Delete the image object first; if that fails we keep the manifest intact.
  try {
    await s3().send(
      new DeleteObjectCommand({ Bucket: bucketName(), Key: target.key }),
    );
  } catch {
    /* object may already be gone — fall through and prune the manifest anyway */
  }
  await writeManifest(items.filter((i) => i.id !== id));

  return NextResponse.json({ ok: true });
}

/**
 * Overwrite the manifest in place. CacheControl: "no-store" so the manifest is
 * never served from a cache — it's overwritten on every mutation, and a stale
 * copy would make a fresh upload appear to vanish on the next load. The url
 * field is derived, so we persist only the stored subset (key, not url).
 */
async function writeManifest(items: GalleryItem[]) {
  const stored: StoredItem[] = items.map((i) => ({
    id: i.id,
    key: i.key,
    caption: i.caption,
    date: i.date,
    w: i.w,
    h: i.h,
    tags: i.tags ?? [],
    // Only persist group when set — a single upload stays free of the field.
    ...(i.group ? { group: i.group } : {}),
    uploadedAt: i.uploadedAt,
  }));
  await s3().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: MANIFEST_KEY,
      Body: JSON.stringify(stored),
      ContentType: "application/json",
      CacheControl: "no-store",
    }),
  );
}
