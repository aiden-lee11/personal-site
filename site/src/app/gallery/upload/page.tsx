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

export default function GalleryUploadPage() {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<Compressed | null>(null);
  const [origName, setOrigName] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);
  // Photo currently being edited (caption/date), or null when the form is closed.
  const [editing, setEditing] = useState<{ id: string; caption: string; date: string } | null>(null);
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
      setDate(today());
      if (inputRef.current) inputRef.current.value = "";
      if (data.item) setItems((prev) => [data.item!, ...prev]);
    } catch (e) {
      setStatus({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [file, password, caption, date]);

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
            onChange={(e) => setDate(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--accent)]"
          />
        </label>
      </div>

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
                    setEditing({ id: item.id, caption: item.caption, date: item.date })
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
