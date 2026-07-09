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

/** Run the transform pipeline in the worker. Resolves with the route-shaped result. */
export function runTransform(input: PipelineInput): Promise<PipelineResult> {
  const w = ensureWorker();
  const id = nextId++;
  return new Promise<PipelineResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, input } satisfies WorkerRequest);
  });
}
