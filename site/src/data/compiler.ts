/**
 * Canonical, hand-crafted illustrations of the IR optimizations Aiden's
 * compiler actually implements (see compiler-src/IR/src/{licm,dce,sccp}.cpp).
 *
 * These aren't literal compiler output on/off (the CLI doesn't expose per-pass
 * flags) — they're minimal SSA fragments that show the transformation a pass
 * performs, in the same syntax the compiler emits. The point is to teach the
 * shape of each optimization, not to reproduce a specific benchmark.
 */

export type OptId = "licm" | "dce" | "sccp";

export type OptExample = {
  id: OptId;
  name: string;
  fullName: string;
  tagline: string;
  what: string;
  before: string;
  after: string;
  sourceFile: string;
};

export const OPT_EXAMPLES: OptExample[] = [
  {
    id: "licm",
    name: "LICM",
    fullName: "Loop-Invariant Code Motion",
    tagline: "Hoist computations whose inputs don't change inside the loop into the preheader.",
    what:
      "Every iteration of the loop was recomputing `n * 8` even though `n` never changes inside the loop. LICM moves it into a preheader block that runs once.",
    sourceFile: "compiler-src/IR/src/licm.cpp",
    before: `define void @sum_offsets (%arr, %n) {

  :entry
    %sum <- 0
    %i <- 0
    br :header

  :header
    %cond <- %i < %n
    br %cond :body :exit

  :body
    %off <- %n * 8              ;; loop-invariant — recomputed every iter
    %ptr <- %arr + %off
    %v <- load %ptr
    %sum <- %sum + %v
    %i <- %i + 1
    br :header

  :exit
    return %sum
}`,
    after: `define void @sum_offsets (%arr, %n) {

  :entry
    %sum <- 0
    %i <- 0
    br :preheader

  :preheader                    ;; runs once, before the loop
    %off <- %n * 8              ;; hoisted out of the loop
    %ptr <- %arr + %off
    br :header

  :header
    %cond <- %i < %n
    br %cond :body :exit

  :body
    %v <- load %ptr             ;; loop body is smaller and cheaper
    %sum <- %sum + %v
    %i <- %i + 1
    br :header

  :exit
    return %sum
}`,
  },
  {
    id: "dce",
    name: "DCE",
    fullName: "Dead Code Elimination",
    tagline: "Remove instructions whose results are never used.",
    what:
      "`%unused` and `%also_unused` are computed but their results never leave the function. DCE walks def-use chains and drops any instruction with no live consumer (and no side effect).",
    sourceFile: "compiler-src/IR/src/dce.cpp",
    before: `define void @f (%x) {

  :entry
    %a <- %x + 1
    %b <- %x * 2
    %unused <- %x * %x          ;; result never read
    %also_unused <- %a + %b     ;; feeds only more dead code
    %result <- %a + %b
    return %result
}`,
    after: `define void @f (%x) {

  :entry
    %a <- %x + 1
    %b <- %x * 2
    %result <- %a + %b
    return %result
}`,
  },
  {
    id: "sccp",
    name: "SCCP",
    fullName: "Sparse Conditional Constant Propagation",
    tagline: "Propagate constants through the SSA lattice and prune unreachable branches.",
    what:
      "SCCP tracks each variable's abstract value (top / constant / bottom) and simultaneously evaluates branch conditions. Because `%c` is known to be `1`, the false arm of `:maybe_taken` is unreachable and gets pruned along with the constant expressions folded into `%out`.",
    sourceFile: "compiler-src/IR/src/sccp.cpp",
    before: `define void @g () {

  :entry
    %c <- 1
    br %c :maybe_taken :never_taken

  :maybe_taken
    %x <- 2 + 3                 ;; folds to 5
    %y <- %x * 4                ;; folds to 20
    %out <- %y - 5              ;; folds to 15
    return %out

  :never_taken
    %z <- some_side_effect()    ;; unreachable — %c is always 1
    return %z
}`,
    after: `define void @g () {

  :entry
    br :maybe_taken             ;; branch replaced — %c proven constant

  :maybe_taken
    return 15                   ;; all ops folded to the final constant
}`,
  },
];
