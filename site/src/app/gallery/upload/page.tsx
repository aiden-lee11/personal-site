"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GalleryItem } from "@/lib/gallery";

// Downscale + recompress in the browser so phone photos (often 5–12MB) arrive
// small: keeps storage cheap and stays well under the serverless body limit.
const MAX_DIM = 2400;
const WEBP_QUALITY = 0.82;

// `name`/`sig` carry the original file's identity through the recompress so the
// additive picker can label the selection and dedupe obvious re-adds.
type Compressed = { blob: Blob; w: number; h: number; previewUrl: string; name: string; sig: string };

const fileSig = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

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
    return {
      blob,
      w,
      h,
      previewUrl: canvas.toDataURL("image/webp", 0.5),
      name: file.name,
      sig: fileSig(file),
    };
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
  // Selected photos, in upload order. A single entry behaves like the old
  // single-file flow; more than one becomes a stack (shared caption/date/tags).
  const [files, setFiles] = useState<Compressed[]>([]);
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

  // ─── Feature 1: existing-tag chips ──────────────────────────────────────────
  // Every distinct tag already in the gallery, first-seen order. Clicking a chip
  // toggles it in the comma-separated input so near-duplicates ("project" vs
  // "projects") stop creeping in. Derivable client-side — items are already loaded.
  const knownTags = useMemo(() => {
    const seen: string[] = [];
    for (const it of items) {
      for (const t of it.tags ?? []) if (!seen.includes(t)) seen.push(t);
    }
    return seen;
  }, [items]);
  // The input parsed the way the API normalizes it (lowercased, trimmed), so a
  // chip lights up the instant its tag appears in the field as the user types.
  const currentTags = useMemo(
    () =>
      tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    [tags],
  );
  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => {
      const parts = prev.split(",").map((t) => t.trim()).filter(Boolean);
      const idx = parts.findIndex((p) => p.toLowerCase() === tag);
      if (idx >= 0) parts.splice(idx, 1);
      else parts.push(tag);
      return parts.join(", ");
    });
  }, []);

  const pickFiles = useCallback(
    async (list: File[]) => {
      setStatus(null);
      const imgs = list.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) {
        setStatus({ kind: "err", msg: "That’s not an image file." });
        return;
      }
      // Additive: new picks APPEND to the set (photos live far apart on disk, so
      // they're chosen one at a time). Dedupe obvious re-adds against what's
      // already selected so re-picking the same path is a silent no-op.
      const have = new Set(files.map((f) => f.sig));
      const fresh = imgs.filter((f) => !have.has(fileSig(f)));
      if (fresh.length === 0) return;
      // Same cap the API enforces (10). Fill the remaining room; if the pick
      // overflows, take what fits and say so rather than dropping silently.
      const room = 10 - files.length;
      if (room <= 0) {
        setStatus({ kind: "err", msg: "That’s the limit — 10 photos per stack." });
        return;
      }
      const capped = fresh.slice(0, room);
      if (fresh.length > room) {
        setStatus({ kind: "err", msg: `Only room for ${room} more — capped at 10.` });
      }
      // EXIF: read the ORIGINAL bytes (compress() re-encodes it away) and prefill
      // from the FIRST file across the accumulated set that yields a date. Earlier
      // files already scanned to nothing, so only these new ones can be that
      // first; skip once the user hand-edited or a photo date already stuck.
      if (!dateTouched.current && !dateFromPhoto) {
        for (const f of capped) {
          const exifDate = await extractExifDate(f);
          if (exifDate) {
            setDate(exifDate);
            setDateFromPhoto(true);
            break;
          }
        }
      }
      try {
        const compressed = await Promise.all(capped.map(compress));
        setFiles((prev) => [...prev, ...compressed]);
      } catch (e) {
        setStatus({ kind: "err", msg: (e as Error).message });
      }
    },
    [files, dateFromPhoto],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const list = Array.from(e.dataTransfer.files ?? []);
      if (list.length) pickFiles(list);
    },
    [pickFiles],
  );

  const submit = useCallback(async () => {
    if (files.length === 0) {
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
      // Repeated file/w/h in matching order; caption/date/tags shared for the set.
      for (const c of files) {
        fd.append("file", c.blob, "photo.webp");
        fd.append("w", String(c.w));
        fd.append("h", String(c.h));
      }
      fd.set("caption", caption);
      fd.set("tags", tags);
      fd.set("date", date);
      fd.set("password", password);
      const res = await fetch("/api/gallery", { method: "POST", body: fd });
      const data = (await res.json()) as {
        item?: GalleryItem;
        items?: GalleryItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      const created = data.items ?? (data.item ? [data.item] : []);
      setStatus({
        kind: "ok",
        msg: created.length > 1 ? `Uploaded ${created.length} ✓` : "Uploaded ✓",
      });
      setFiles([]);
      setCaption("");
      setTags("");
      setDate(today());
      dateTouched.current = false;
      setDateFromPhoto(false);
      if (inputRef.current) inputRef.current.value = "";
      if (created.length) setItems((prev) => [...created, ...prev]);
    } catch (e) {
      setStatus({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [files, password, caption, tags, date]);

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

  // Total compressed weight across the current selection.
  const kb = Math.round(files.reduce((s, f) => s + f.blob.size, 0) / 1024);
  // How many items each group has, so the manage list can badge stack members.
  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (it.group) m.set(it.group, (m.get(it.group) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const removeSelected = useCallback((i: number) => {
    setFiles((prev) => prev.filter((_, k) => k !== i));
  }, []);

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
        {files.length === 1 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={files[0].previewUrl}
            alt="preview"
            className="mx-auto max-h-72 w-auto rounded"
          />
        ) : files.length > 1 ? (
          // A stack in the making — thumbnails of every selected photo.
          <div className="flex flex-wrap justify-center gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.previewUrl}
                  alt={`selected ${i + 1}`}
                  className="h-24 w-24 rounded object-cover border border-[color:var(--border)]"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSelected(i);
                  }}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-black/75 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white hover:bg-red-600"
                  title="Remove from set"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            Drop photos here, or click to choose. Add them one at a time to build a
            stack.
          </p>
        )}
        {/* Once photos are in, the zone reads as additive — click/drop appends. */}
        {files.length > 0 && (
          <p className="mt-3 font-mono text-[11px] text-[color:var(--muted)]">
            {files.length >= 10 ? "10 photos — that’s the limit" : "+ add another photo"}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            // Reset so re-picking the SAME path fires change again — additive
            // picking leans on choosing files one at a time.
            e.target.value = "";
            if (list.length) pickFiles(list);
          }}
        />
      </div>
      {files.length > 0 && (
        <p className="mt-2 font-mono text-[11px] text-[color:var(--muted)] tabular">
          {files.length === 1
            ? `${files[0].name} → ${files[0].w}×${files[0].h}, ${kb} KB webp`
            : `${files.length} photos → stack, ${kb} KB webp total`}
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

      {/* Existing tags — click to toggle in the field above. Reuses the gallery
          rail's pill look; an active pill is one already present in the input. */}
      {knownTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {knownTags.map((tag) => {
            const active = currentTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 font-mono text-[11px] lowercase transition-colors ${
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                    : "border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={submit}
          disabled={busy || files.length === 0}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy
            ? "uploading…"
            : files.length > 1
              ? `Publish stack (${files.length})`
              : "Publish photo"}
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
                {/* Group members get a subtle badge so a stack is identifiable;
                    edit/delete still act on this one photo. */}
                {item.group && groupCounts.get(item.group)! > 1 && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                    stack · {groupCounts.get(item.group)}
                  </span>
                )}
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
