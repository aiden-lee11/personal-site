// Minimal typings for the Emscripten MODULARIZE=1 / EXPORT_ES6=1 factories
// emitted into /public/wasm/<L>.js. We only use FS.writeFile/readFile and
// callMain, so we don't pull in the full Emscripten type surface.

export interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string, opts: { encoding: "utf8" }): string;
  readFile(path: string, opts?: { encoding?: "binary" }): Uint8Array;
  unlink(path: string): void;
  analyzePath(path: string): { exists: boolean };
}

export interface LayerModule {
  FS: EmscriptenFS;
  /** Runs main() with the given argv (argv[0] is supplied by the runtime). */
  callMain(args: string[]): number;
}

export interface LayerModuleOptions {
  print?: (text: string) => void;
  printErr?: (text: string) => void;
  locateFile?: (path: string, prefix: string) => string;
  noInitialRun?: boolean;
}

/** Emscripten factory: calling it instantiates a fresh module instance. */
export type LayerFactory = (opts?: LayerModuleOptions) => Promise<LayerModule>;
