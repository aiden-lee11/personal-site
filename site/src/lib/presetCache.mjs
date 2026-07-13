// Shared precompiled-preset cache logic — imported by BOTH the /api/compile
// route (bundled into the Next server) and the build-time generator
// (scripts/precompile-presets.mjs, run as plain `node`). Keeping the matching
// + fingerprint logic in one place is what guarantees a generated artifact and
// a live request agree on the cache key and on whether the cache is still
// valid for the shipped compiler.
//
// Plain ESM (.mjs, node builtins only) so the standalone generator can import
// it without a TS toolchain; the route imports it with allowJs.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Full pipeline (mirrors compile/route.ts CHAIN). Index defines fan-out.
export const CHAIN = ["LC", "LB", "LA", "IR", "L3", "L2", "L1", "S"];

// Stages whose binary writes a short-extension file instead of prog.<next>
// (LC -> prog.b, LB -> prog.a); renamed to canonical prog.<next> after run.
export const SHORT_OUTPUT = { LC: "prog.b", LB: "prog.a" };

// Every IR pass exposing a --no-<slug> flag (compiler-src/IR/src/compiler.cpp).
// Order is irrelevant to matching (the disabled set is sorted), but kept in the
// route's declared order for readability.
export const IR_PASSES = [
  "licm",
  "dce",
  "sccp",
  "gvn",
  "copy-prop",
  "peephole",
  "vra-bce",
  "simplify-cfg",
  "algebra",
  "cmov-synth",
  "loop-dse",
];

/**
 * Normalize opt flags to the sorted set of passes the compiler is told to turn
 * OFF. The route emits a `--no-<pass>` flag only for passes explicitly set to
 * `false`; undefined/true means the pass runs. So the disabled set is the sole
 * thing that changes the emitted code, and it is what we key on.
 * @param {Record<string, boolean>|undefined|null} optFlags
 * @returns {string[]}
 */
export function normalizeDisabledPasses(optFlags) {
  if (!optFlags) return [];
  const disabled = [];
  for (const p of IR_PASSES) if (optFlags[p] === false) disabled.push(p);
  disabled.sort();
  return disabled;
}

/**
 * The two configurations we precompute: "full" (nothing disabled) and "none"
 * (every pass disabled). Any other subset is "custom" and is never cached — it
 * falls through to the live compile path.
 * @param {string[]} disabled
 * @returns {"full"|"none"|"custom"}
 */
export function configId(disabled) {
  if (disabled.length === 0) return "full";
  if (disabled.length === IR_PASSES.length) return "none";
  return "custom";
}

/** The disabled-pass set for each cacheable config, for the generator. */
export const CACHEABLE_CONFIGS = {
  full: [],
  none: [...IR_PASSES].sort(),
};

/**
 * Stable cache key: source bytes + entry layer + normalized disabled-pass set.
 * Source is matched EXACTLY (a single edited character misses the cache and
 * recompiles live, which is the intended, safe behavior).
 * @param {string} source
 * @param {string} fromLayer
 * @param {string[]} disabled  already normalized/sorted
 * @returns {string} hex sha256
 */
export function cacheKey(source, fromLayer, disabled) {
  const h = crypto.createHash("sha256");
  h.update(source, "utf8");
  h.update("\x00");
  h.update(fromLayer);
  h.update("\x00");
  h.update(disabled.join(","));
  return h.digest("hex");
}

/** Root dir holding one subdir per cached (preset, config). */
export function cacheDir() {
  return (
    process.env.PRESET_CACHE_DIR ||
    path.join(process.cwd(), "precomputed-presets")
  );
}

export function entryDir(dir, key) {
  return path.join(dir, key);
}
export function manifestPath(dir, key) {
  return path.join(entryDir(dir, key), "manifest.json");
}
export function binaryPath(dir, key) {
  return path.join(entryDir(dir, key), "prog_exec");
}

/**
 * Resolve a stage's runnable binary: <L>/bin/<L>, else the prebuilt
 * <L>/.bin/<L> (where the LC/LB instructor ELFs live). Mirrors the route.
 * @param {string} binDir
 * @param {string} layer
 * @returns {string|null}
 */
export function stageBinary(binDir, layer) {
  const built = path.join(binDir, layer, "bin", layer);
  if (fs.existsSync(built)) return built;
  const prebuilt = path.join(binDir, layer, ".bin", layer);
  return fs.existsSync(prebuilt) ? prebuilt : null;
}

/**
 * Fingerprint of the exact compiler that must have produced a cached artifact:
 * the content hash of every stage binary + the linked C runtime. If any binary
 * changes (a rebuild, a different arch, a swapped instructor binary) the
 * fingerprint changes and stale artifacts are ignored in favor of live
 * compilation. Content-hashing ~50 MB is done once and memoized by the caller.
 * @param {string} binDir
 * @param {string} runtimeC
 * @returns {string} hex sha256
 */
export function compilerFingerprint(binDir, runtimeC) {
  const h = crypto.createHash("sha256");
  for (const L of CHAIN) {
    if (L === "S") continue;
    const bin = stageBinary(binDir, L);
    h.update(L);
    h.update("\x00");
    if (bin) {
      try {
        h.update(fs.readFileSync(bin));
      } catch {
        h.update("missing");
      }
    } else {
      h.update("absent");
    }
    h.update("\x00");
  }
  try {
    h.update(fs.readFileSync(runtimeC));
  } catch {
    h.update("no-runtime");
  }
  return h.digest("hex");
}

/**
 * Read a manifest by key; returns the parsed object or null when absent/broken.
 * @param {string} dir
 * @param {string} key
 * @returns {any|null}
 */
export function readManifest(dir, key) {
  try {
    const raw = fs.readFileSync(manifestPath(dir, key), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
