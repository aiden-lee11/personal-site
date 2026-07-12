// Main-thread client for the compiler pipeline worker. Lazily spawns a single
// worker, multiplexes requests by id, and returns a Promise per transform.
"use client";

import type { PipelineInput, PipelineResult } from "./pipeline";
import type { WorkerRequest, WorkerResponse } from "./pipeline.worker";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (r: PipelineResult) => void; reject: (e: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./pipeline.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if ("error" in msg) entry.reject(new Error(msg.error));
    else entry.resolve(msg.result);
  };
  worker.onerror = (e) => {
    // A worker-level failure rejects every in-flight request.
    const err = new Error(e.message || "compiler worker crashed");
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
  };
  return worker;
}

// Message shown when the server-side LC/LB stages can't be reached (e.g. a
// static/dev deploy without the compiler runtime). Kept verbatim so the UI can
// explain why in-browser compilation stopped short of these layers.
const SERVER_ONLY_MSG =
  "LC/LB compilation runs server-side and isn't available on this deployment — start from LA or below to compile fully in-browser";

/**
 * Compile a LC/LB source via the server runtime. The wasm worker cannot run
 * the instructor reference binaries, so these layers are delegated to
 * /api/compile (transform only, run:false). The route's JSON shape already
 * matches PipelineResult.
 *
 * Failures split two ways:
 *   - runtime unreachable/absent (503, network failure, non-JSON reply) —
 *     ok:false with serverUnavailable:true so the UI can fall back to LA;
 *   - a genuine compiler error the route reported (e.g. a PEGTL parse error)
 *     — ok:false carrying the route's own error text verbatim.
 */
async function runServerTransform(
  input: PipelineInput,
): Promise<PipelineResult> {
  const unavailable = (): PipelineResult => ({
    ok: false,
    layers: { [input.fromLayer]: input.source },
    errors: {},
    layerMs: {},
    totalMs: 0,
    error: SERVER_ONLY_MSG,
    serverUnavailable: true,
  });

  try {
    const res = await fetch("/api/compile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: input.source,
        fromLayer: input.fromLayer,
        optFlags: input.optFlags,
        run: false,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | (Partial<PipelineResult> & { error?: string })
      | null;

    // 503 = route's "compiler runtime unavailable"; null data = a non-JSON
    // reply (e.g. a proxy error page). Both mean the runtime can't be used.
    if (res.status === 503 || !data) return unavailable();

    if (res.ok && data.ok) {
      return {
        ok: true,
        layers: data.layers ?? {},
        errors: data.errors ?? {},
        layerMs: data.layerMs ?? {},
        totalMs: data.totalMs ?? 0,
      };
    }

    // Route reached and reported a real failure (e.g. a parse error).
    // Surface its message; fall back to the server-only explanation when
    // there isn't one.
    return {
      ok: false,
      layers: data.layers ?? { [input.fromLayer]: input.source },
      errors: data.errors ?? {},
      layerMs: data.layerMs ?? {},
      totalMs: data.totalMs ?? 0,
      error: data.error || SERVER_ONLY_MSG,
    };
  } catch {
    // Network failure — no route response at all.
    return unavailable();
  }
}

/** Run the transform pipeline. Resolves with the route-shaped result. */
export function runTransform(input: PipelineInput): Promise<PipelineResult> {
  // LC/LB have no wasm module — delegate to the server runtime instead of the
  // worker (which would fail trying to load a nonexistent wasm module).
  if (input.fromLayer === "LC" || input.fromLayer === "LB") {
    return runServerTransform(input);
  }

  const w = ensureWorker();
  const id = nextId++;
  return new Promise<PipelineResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, input } satisfies WorkerRequest);
  });
}
