// Web Worker entry: runs the wasm compiler pipeline off the UI thread.
// Protocol: main thread posts { id, input }, worker replies { id, result }.

import { runPipeline, type PipelineInput, type PipelineResult } from "./pipeline";

export type WorkerRequest = { id: number; input: PipelineInput };
export type WorkerResponse =
  | { id: number; result: PipelineResult }
  | { id: number; error: string };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, input } = e.data;
  try {
    const result = await runPipeline(input);
    (self as unknown as Worker).postMessage({ id, result } satisfies WorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      error: (err as Error)?.message ?? "pipeline failed",
    } satisfies WorkerResponse);
  }
};
