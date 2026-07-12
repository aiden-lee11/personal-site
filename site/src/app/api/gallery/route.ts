import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import crypto from "node:crypto";
import {
  MANIFEST_PATH,
  PHOTOS_PREFIX,
  readManifest,
  sortItems,
  uploadsConfigured,
  blobConfigured,
  type GalleryItem,
} from "@/lib/gallery";

export const runtime = "nodejs";
// Never cache the API — the manifest changes on every upload/delete.
export const dynamic = "force-dynamic";

// Client compresses before sending, so anything over this is almost certainly
// a mistake. Also keeps us clear of Vercel's request body ceiling.
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CAPTION = 280;

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
  return NextResponse.json({ items, configured: blobConfigured() });
}

export async function POST(req: Request) {
  if (!uploadsConfigured()) {
    return NextResponse.json(
      { error: "Uploads aren’t configured on this deployment." },
      { status: 503 },
    );
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN!;

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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "That file isn’t an image." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large even after compression (8MB max)." },
      { status: 413 },
    );
  }

  const caption = String(form.get("caption") ?? "")
    .slice(0, MAX_CAPTION)
    .trim();
  const rawDate = String(form.get("date") ?? "").slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : new Date().toISOString().slice(0, 10);
  const w = Number(form.get("w")) || undefined;
  const h = Number(form.get("h")) || undefined;

  const id = crypto.randomUUID();
  const { url } = await put(
    `${PHOTOS_PREFIX}${id}.${extFor(file.type)}`,
    file,
    { access: "public", token, contentType: file.type },
  );

  const item: GalleryItem = {
    id,
    url,
    caption,
    date,
    w,
    h,
    uploadedAt: new Date().toISOString(),
  };

  const items = await readManifest();
  items.push(item);
  await writeManifest(items, token);

  return NextResponse.json({ item });
}

export async function DELETE(req: Request) {
  if (!uploadsConfigured()) {
    return NextResponse.json(
      { error: "Uploads aren’t configured on this deployment." },
      { status: 503 },
    );
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN!;

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
  // Delete the image blob first; if that fails we keep the manifest intact.
  try {
    await del(target.url, { token });
  } catch {
    /* blob may already be gone — fall through and prune the manifest anyway */
  }
  await writeManifest(
    items.filter((i) => i.id !== id),
    token,
  );

  return NextResponse.json({ ok: true });
}

/** Overwrite the manifest in place, uncached, so reads always see it fresh. */
async function writeManifest(items: GalleryItem[], token: string) {
  await put(MANIFEST_PATH, JSON.stringify(items), {
    access: "public",
    token,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}
