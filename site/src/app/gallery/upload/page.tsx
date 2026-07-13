"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryItem } from "@/lib/gallery";

// Downscale + recompress in the browser so phone photos (often 5–12MB) arrive
// small: keeps storage cheap and stays well under the serverless body limit.
const MAX_DIM = 2400;
const WEBP_QUALITY = 0.82;

type Compressed = { blob: Blob; w: number; h: number; previewUrl: string };

async function compress(file: File): Promise<Compressed> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image."));
      el.src = bitmapUrl;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable in this browser.");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob) throw new Error("Could not compress that image.");
    return { blob, w, h, previewUrl: canvas.toDataURL("image/webp", 0.5) };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── EXIF date extraction ───────────────────────────────────────────────────
// Hand-rolled, zero-dependency. Must run on the ORIGINAL File: the canvas
// recompression in compress() strips EXIF entirely. Every failure path returns
// null silently — a missing date just means no prefill, never an error.

/** EXIF "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD", with a sanity check. */
function exifToISODate(raw: string): string | null {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const yy = Number(y);
  const mm = Number(mo);
  const dd = Number(d);
  if (yy < 1900 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** Locate the TIFF header (the "II"/"MM" byte-order mark) inside the buffer.
 *  JPEG: walk marker segments to APP1's "Exif\0\0". Otherwise (HEIC, etc.):
 *  scan for the "Exif\0\0" signature and validate the byte-order mark. */
function findTiffOffset(view: DataView): number {
  if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) {
    let off = 2;
    while (off + 4 <= view.byteLength) {
      if (view.getUint8(off) !== 0xff) break; // out of sync with marker stream
      const marker = view.getUint8(off + 1);
      if (marker === 0xd8 || marker === 0xd9 || marker === 0xda) break; // SOI/EOI/SOS
      const size = view.getUint16(off + 2);
      if (size < 2) break;
      const segStart = off + 4;
      if (
        marker === 0xe1 && // APP1
        segStart + 6 <= view.byteLength &&
        view.getUint32(segStart) === 0x45786966 && // "Exif"
        view.getUint16(segStart + 4) === 0x0000 // "\0\0"
      ) {
        return segStart + 6;
      }
      off = segStart + (size - 2);
    }
  }
  // Container fallback: brute-scan for the Exif signature + valid TIFF mark.
  const limit = view.byteLength - 8;
  for (let i = 0; i < limit; i++) {
    if (view.getUint32(i) === 0x45786966 && view.getUint16(i + 4) === 0x0000) {
      const tiff = i + 6;
      const bo = view.getUint16(tiff);
      if (bo === 0x4949 || bo === 0x4d4d) return tiff;
    }
  }
  return -1;
}

/** Parse the TIFF structure at `tiff` and pull the first available date string:
 *  ExifIFD 0x9003 (DateTimeOriginal) → 0x9004 (CreateDate) → IFD0 0x0132. */
function readExifDate(view: DataView, tiff: number): string | null {
  const le = view.getUint16(tiff) === 0x4949; // "II" = little-endian, "MM" = big
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);

  if (u16(tiff + 2) !== 0x002a) return null; // TIFF magic
  const ifd0 = tiff + u32(tiff + 4);

  const readAscii = (entry: number): string | null => {
    const count = u32(entry + 4);
    if (count === 0 || count > 64) return null;
    const valOff = count <= 4 ? entry + 8 : tiff + u32(entry + 8);
    if (valOff < 0 || valOff + count > view.byteLength) return null;
    let s = "";
    for (let k = 0; k < count; k++) {
      const c = view.getUint8(valOff + k);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };

  // Walk an IFD's entries, returning either an ASCII value (want a tag's value)
  // or a sub-IFD pointer (want a pointer tag like 0x8769) via `asPointer`.
  const scanIfd = (ifd: number, tag: number, asPointer = false): string | number | null => {
    if (ifd < 0 || ifd + 2 > view.byteLength) return null;
    const n = u16(ifd);
    for (let e = 0; e < n; e++) {
      const entry = ifd + 2 + e * 12;
      if (entry + 12 > view.byteLength) break;
      if (u16(entry) === tag) return asPointer ? u32(entry + 8) : readAscii(entry);
    }
    return null;
  };

  const exifPtr = scanIfd(ifd0, 0x8769, true);
  if (typeof exifPtr === "number") {
    const exifIfd = tiff + exifPtr;
    const dto = scanIfd(exifIfd, 0x9003) ?? scanIfd(exifIfd, 0x9004);
    if (typeof dto === "string") return dto;
  }
  const dt = scanIfd(ifd0, 0x0132);
  return typeof dt === "string" ? dt : null;
}

/** Best-effort: read the first ~4MB (EXIF lives near the top) and extract the
 *  capture date as "YYYY-MM-DD", or null on any failure. */
async function extractExifDate(file: File): Promise<string | null> {
  try {
    const buf = await file.slice(0, 4 * 1024 * 1024).arrayBuffer();
    const view = new DataView(buf);
    const tiff = findTiffOffset(view);
    if (tiff < 0) return null;
    const raw = readExifDate(view, tiff);
    return raw ? exifToISODate(raw) : null;
  } catch {
    return null;
  }
}

export default function GalleryUploadPage() {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<Compressed | null>(null);
  const [origName, setOrigName] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [date, setDate] = useState(today());
  // True once the user hand-edits the date — gates EXIF auto-prefill so we never
  // clobber manual input. Auto-fill from a photo does NOT set this, so picking a
  // new file may replace an earlier auto-filled date. A ref (not state) keeps
  // pickFile's closure current without re-creating the callback.
  const dateTouched = useRef(false);
  const [dateFromPhoto, setDateFromPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);
  // Photo currently being edited (caption/date), or null when the form is closed.
  const [editing, setEditing] = useState<{ id: string; caption: string; date: string; tags: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Remember the password for the session so multi-upload doesn't retype it.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("gallery-pw");
      if (saved) setPassword(saved);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try {
      if (password) sessionStorage.setItem("gallery-pw", password);
    } catch { /* ignore */ }
  }, [password]);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const data = (await res.json()) as { items?: GalleryItem[] };
      setItems(data.items ?? []);
    } catch { /* best effort */ }
  }, []);
  useEffect(() => { loadItems(); }, [loadItems]);

  const pickFile = useCallback(async (f: File) => {
    setStatus(null);
    if (!f.type.startsWith("image/")) {
      setStatus({ kind: "err", msg: "That’s not an image file." });
      return;
    }
    setOrigName(f.name);
    // Read EXIF from the ORIGINAL bytes before compress() re-encodes it away.
    // Only prefill if the user hasn't typed a date of their own.
    setDateFromPhoto(false);
    const exifDate = await extractExifDate(f);
    if (exifDate && !dateTouched.current) {
      setDate(exifDate);
      setDateFromPhoto(true);
    }
    try {
      const c = await compress(f);
      setFile(c);
    } catch (e) {
      setStatus({ kind: "err", msg: (e as Error).message });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) pickFile(f);
    },
    [pickFile],
  );

  const submit = useCallback(async () => {
    if (!file) {
      setStatus({ kind: "err", msg: "Pick a photo first." });
      return;
    }
    if (!password) {
      setStatus({ kind: "err", msg: "Enter the upload password." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.set("file", file.blob, "photo.webp");
      fd.set("caption", caption);
      fd.set("tags", tags);
      fd.set("date", date);
      fd.set("w", String(file.w));
      fd.set("h", String(file.h));
      fd.set("password", password);
      const res = await fetch("/api/gallery", { method: "POST", body: fd });
      const data = (await res.json()) as { item?: GalleryItem; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setStatus({ kind: "ok", msg: "Uploaded ✓" });
      setFile(null);
      setOrigName("");
      setCaption("");
      setTags("");
      setDate(today());
      dateTouched.current = false;
      setDateFromPhoto(false);
      if (inputRef.current) inputRef.current.value = "";
      if (data.item) setItems((prev) => [data.item!, ...prev]);
    } catch (e) {
      setStatus({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [file, password, caption, tags, date]);

  const remove = useCallback(
    async (id: string) => {
      if (!password) {
        setStatus({ kind: "err", msg: "Enter the password to delete." });
        return;
      }
      if (!window.confirm("Delete this photo permanently?")) return;
      try {
        const res = await fetch("/api/gallery", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, password }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Delete failed.");
        setItems((prev) => prev.filter((i) => i.id !== id));
      } catch (e) {
        setStatus({ kind: "err", msg: (e as Error).message });
      }
    },
    [password],
  );

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    if (!password) {
      setStatus({ kind: "err", msg: "Enter the password to edit." });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/gallery", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          password,
          caption: editing.caption,
          date: editing.date,
          tags: editing.tags,
        }),
      });
      const data = (await res.json()) as { item?: GalleryItem; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Edit failed.");
      if (data.item) {
        setItems((prev) => prev.map((i) => (i.id === data.item!.id ? data.item! : i)));
      }
      setEditing(null);
      setStatus({ kind: "ok", msg: "Saved ✓" });
    } catch (e) {
      setStatus({ kind: "err", msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }, [editing, password]);

  const kb = file ? Math.round(file.blob.size / 1024) : 0;

  return (
    <div className="mx-auto max-w-3xl px-6 pt-20 pb-24 sm:pt-28">
      <header className="pb-10">
        <p className="eyebrow">Owner only</p>
        <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-[-0.05em] leading-[0.95]">
          Add a photo
        </h1>
        <p className="mt-5 text-[color:var(--muted)] max-w-xl leading-relaxed">
          Drop an image, give it a caption and a date, and it goes live on the{" "}
          <Link href="/gallery" className="link-underline">
            gallery
          </Link>
          . Photos are downscaled and compressed in your browser before upload.
        </p>
      </header>

      {/* Password */}
      <label className="block mb-6">
        <span className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
          Upload password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--accent)]"
        />
      </label>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-[color:var(--accent)] bg-[color:var(--subtle)]"
            : "border-[color:var(--border)] hover:border-[color:var(--fg)]"
        }`}
      >
        {file ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.previewUrl}
            alt="preview"
            className="mx-auto max-h-72 w-auto rounded"
          />
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            Drop a photo here, or click to choose one.
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
          }}
        />
      </div>
      {file && (
        <p className="mt-2 font-mono text-[11px] text-[color:var(--muted)] tabular">
          {origName} → {file.w}×{file.h}, {kb} KB webp
        </p>
      )}

      {/* Caption + date */}
      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="block">
          <span className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            Caption
          </span>
          <input
            type="text"
            value={caption}
            maxLength={280}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="A line about this moment…"
            className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
            Date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              dateTouched.current = true;
              setDateFromPhoto(false);
            }}
            className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--accent)]"
          />
          {dateFromPhoto && (
            <span className="mt-1.5 block font-mono text-[10px] text-[color:var(--accent)]">
              date from photo
            </span>
          )}
        </label>
      </div>

      {/* Tags — comma-separated; the API normalizes (lowercase, dedupe, cap 8). */}
      <label className="mt-4 block">
        <span className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
          Tags
        </span>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="friends, work, chicago"
          className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
        />
      </label>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={submit}
          disabled={busy || !file}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy ? "uploading…" : "Publish photo"}
        </button>
        {status && (
          <span
            className={`font-mono text-xs ${
              status.kind === "ok"
                ? "text-[color:var(--accent)]"
                : "text-red-400"
            }`}
          >
            {status.msg}
          </span>
        )}
      </div>

      {/* Manage existing */}
      {items.length > 0 && (
        <section className="mt-16 border-t border-[color:var(--border)] pt-8">
          <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-4">
            Manage ({items.length})
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {items.map((item) => (
              <li key={item.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.caption || "photo"}
                  className={`aspect-square w-full rounded object-cover border ${
                    editing?.id === item.id
                      ? "border-[color:var(--accent)]"
                      : "border-[color:var(--border)]"
                  }`}
                />
                <button
                  onClick={() =>
                    setEditing({
                      id: item.id,
                      caption: item.caption,
                      date: item.date,
                      tags: item.tags?.join(", ") ?? "",
                    })
                  }
                  className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[color:var(--accent)]"
                  title="Edit caption/date"
                >
                  ✎
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                  title="Delete"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {/* Inline editor — same fields as upload, targets the selected photo */}
          {editing && (
            <div className="mt-6 rounded-lg border border-[color:var(--border)] p-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <label className="block">
                  <span className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
                    Caption
                  </span>
                  <input
                    type="text"
                    value={editing.caption}
                    maxLength={280}
                    onChange={(e) =>
                      setEditing((prev) => prev && { ...prev, caption: e.target.value })
                    }
                    placeholder="A line about this moment…"
                    className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
                    Date
                  </span>
                  <input
                    type="date"
                    value={editing.date}
                    onChange={(e) =>
                      setEditing((prev) => prev && { ...prev, date: e.target.value })
                    }
                    className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)]">
                  Tags
                </span>
                <input
                  type="text"
                  value={editing.tags}
                  onChange={(e) =>
                    setEditing((prev) => prev && { ...prev, tags: e.target.value })
                  }
                  placeholder="friends, work, chicago"
                  className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                />
              </label>
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {saving ? "saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                >
                  cancel
                </button>
                {status && (
                  <span
                    className={`font-mono text-xs ${
                      status.kind === "ok"
                        ? "text-[color:var(--accent)]"
                        : "text-red-400"
                    }`}
                  >
                    {status.msg}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
