/**
 * Canonical, hand-crafted illustrations of the IR optimizations Aiden's
 * compiler actually implements (see the IR stage's src/*.cpp in the private
 * compiler repo, site-fork branch, and the OptConfig mask in IR.h).
 *
 * These aren't literal compiler output on/off — they're minimal SSA fragments
 * that show the transformation a pass performs, in the same syntax the
 * compiler emits. The point is to teach the shape of each optimization.
 */

export type OptId =
  | "sccp"
  | "dce"
  | "licm"
  | "gvn"
  | "copy-prop"
  | "algebra"
  | "peephole"
  | "vra-bce"
  | "simplify-cfg"
  | "cmov-synth"
  | "loop-dse";

export type OptExample = {
  id: OptId;
  name: string;
  fullName: string;
  tagline: string;
  what: string;
  before: string;
  after: string;
  /**
   * Tokens at the heart of the pass. During the "trace" phase of the animated
   * explainer every occurrence of these across the whole fragment gets a soft
   * accent pill, so you can see (e.g. for DCE) that the circled dead line's
   * variable has no other live use. Single identifiers match most reliably.
   */
  focus?: string[];
  /**
   * Short, concrete captions shown under the animation for the spot / trace /
   * transform phases. Falls back to the tagline when omitted.
   */
  story?: { spot?: string; trace?: string; transform?: string };
};

export const OPT_EXAMPLES: OptExample[] = [
  {
    id: "sccp",
    name: "SCCP",
    fullName: "Sparse Conditional Constant Propagation",
    tagline: "Propagate constants through the SSA lattice and prune unreachable branches.",
    what:
      "SCCP tracks each variable's abstract value (top / constant / bottom) and simultaneously evaluates branch conditions. Because `%c` is known to be `1`, the false arm of `:maybe_taken` is unreachable and gets pruned along with the constant expressions folded into `%out`.",
    focus: ["%c"],
    story: {
      spot: "%c is proven to always be 1",
      trace: "so the false arm is unreachable",
      transform: "the branch and every fold collapse to one constant",
    },
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
  {
    id: "dce",
    name: "DCE",
    fullName: "Dead Code Elimination",
    tagline: "Remove instructions whose results are never used.",
    what:
      "`%unused` and `%also_unused` are computed but their results never leave the function. DCE walks def-use chains and drops any instruction with no live consumer (and no side effect).",
    focus: ["%unused", "%also_unused"],
    story: {
      spot: "these results are never read",
      trace: "%unused and %also_unused appear nowhere else",
      transform: "so the dead computations are deleted",
    },
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
    id: "licm",
    name: "LICM",
    fullName: "Loop-Invariant Code Motion",
    tagline: "Hoist computations whose inputs don't change inside the loop into the preheader.",
    what:
      "Every iteration of the loop was recomputing `n * 8` even though `n` never changes inside the loop. LICM moves it into a preheader block that runs once.",
    focus: ["%off", "%n"],
    story: {
      spot: "%off is recomputed every iteration",
      trace: "but %n never changes inside the loop",
      transform: "so %off is hoisted into a preheader that runs once",
    },
    before: `define void @sum_offsets (%arr, %n) {

  :entry
    %sum <- 0
    %i <- 0
    br :header

  :header
    %cond <- %i < %n
    br %cond :body :exit

  :body
    %off <- %n * 8       ;; invariant, recomputed
    %ptr <- %arr + %off
    %v   <- load %ptr
    %sum <- %sum + %v
    %i   <- %i + 1
    br :header

  :exit
    return %sum
}`,
    after: `define void @sum_offsets (%arr, %n) {

  :entry
    %sum <- 0
    %i <- 0
    br :preheader

  :preheader             ;; runs once
    %off <- %n * 8       ;; hoisted
    %ptr <- %arr + %off
    br :header

  :header
    %cond <- %i < %n
    br %cond :body :exit

  :body
    %v   <- load %ptr    ;; body is leaner
    %sum <- %sum + %v
    %i   <- %i + 1
    br :header

  :exit
    return %sum
}`,
  },
  {
    id: "gvn",
    name: "GVN",
    fullName: "Global Value Numbering",
    tagline: "Hash identical expressions to one value number and reuse the first result.",
    what:
      "`%a` and `%b` compute the same `x*x + 3`. GVN walks the dominator tree with expression hash maps and rewrites the second occurrence as a copy of the first, so the redundant arithmetic disappears.",
    focus: ["%t1", "%t2"],
    story: {
      spot: "%t2 recomputes what %t1 already holds",
      trace: "same inputs hash to the same value number",
      transform: "so %b just reuses %a",
    },
    before: `define void @dup (%x) {

  :entry
    %t1 <- %x * %x
    %a  <- %t1 + 3
    %t2 <- %x * %x       ;; same expression as %t1
    %b  <- %t2 + 3       ;; same expression as %a
    %out <- %a + %b
    return %out
}`,
    after: `define void @dup (%x) {

  :entry
    %t1 <- %x * %x
    %a  <- %t1 + 3
    %b  <- %a            ;; reused — identical value number
    %out <- %a + %b
    return %out
}`,
  },
  {
    id: "copy-prop",
    name: "CopyProp",
    fullName: "Copy Propagation",
    tagline: "Replace uses of a copied variable with the original source.",
    what:
      "A chain of pure assignments `%a ← 5; %b ← %a; %c ← %b` just renames the same value. Copy prop substitutes the source through the uses (and drops identity copies like `%x ← %x`), so later constant folding can chase the value all the way to the consumer.",
    focus: ["%a", "%b", "%c"],
    story: {
      spot: "%b and %c are pure copies of %a",
      trace: "every use traces straight back to %a",
      transform: "so the copies collapse into the source",
    },
    before: `define void @chain () {

  :entry
    %a <- 5
    %b <- %a             ;; pure copy
    %c <- %b             ;; another pure copy
    return %c
}`,
    after: `define void @chain () {

  :entry
    %a <- 5
    return %a            ;; copies collapsed; uses see the source
}`,
  },
  {
    id: "algebra",
    name: "AlgSimp",
    fullName: "Algebraic Simplification",
    tagline: "Rewrite trivial arithmetic identities into cheaper forms.",
    what:
      "Recognizes identities like `x * 1 → x`, `y + 0 → y`, `z << 0 → z`, `a - a → 0`, and `x & x → x`. Each match replaces the binary op with a copy or a constant so later DCE can finish the cleanup.",
    focus: ["1", "0"],
    story: {
      spot: "×1, +0 and <<0 are all no-ops",
      trace: "the identity operands don't change the value",
      transform: "so each op becomes a plain copy",
    },
    before: `define void @idents (%x) {

  :entry
    %a <- %x * 1         ;; ×1 is a no-op
    %b <- %a + 0         ;; +0 is a no-op
    %c <- %b << 0        ;; <<0 is a no-op
    return %c
}`,
    after: `define void @idents (%x) {

  :entry
    %a <- %x             ;; *1 → copy
    %b <- %a             ;; +0 → copy
    %c <- %b             ;; <<0 → copy
    return %c
}`,
  },
  {
    id: "peephole",
    name: "Peephole",
    fullName: "Peephole",
    tagline: "Local pattern rewrites that shrink instruction sequences in place.",
    what:
      "Scans short windows of SSA for idioms — chained `+ const` folds, compare-fed branches, redundant moves — and rewrites them into a tighter form without needing a full dataflow solve.",
    focus: ["1", "2", "0"],
    story: {
      spot: "a window of adds chains through constants",
      trace: "+1, +2 and +0 fold together",
      transform: "into a single %x + 3",
    },
    before: `define void @window (%x) {

  :entry
    %a <- %x + 1
    %b <- %a + 2         ;; chained +const
    %c <- %b + 0         ;; trivial add
    return %c
}`,
    after: `define void @window (%x) {

  :entry
    %b <- %x + 3         ;; +1 and +2 collapsed
    return %b            ;; +0 dropped
}`,
  },
  {
    id: "vra-bce",
    name: "VRA/BCE",
    fullName: "Value Range Analysis / Branch-Check Elimination",
    tagline: "Prove index ranges and strip redundant bounds checks.",
    what:
      "A lattice of integer ranges flows through the CFG. When the induction variable is proven to stay inside `[0, len)`, the per-access array bounds check is dead and gets deleted — the hot path no longer pays for a check the compiler already discharged.",
    focus: ["%ok"],
    story: {
      spot: "%ok is a per-access bounds check",
      trace: "but %i is proven to stay in [0, %len)",
      transform: "so the always-true check is removed",
    },
    before: `define void @fill (%a, %len) {

  :entry
    %i <- 0
    br :header

  :header
    %cond <- %i < %len
    br %cond :body :exit

  :body
    %ok <- %i < %len     ;; bounds check — always true here
    br %ok :store :trap

  :store
    store %a[%i], %i
    %i <- %i + 1
    br :header

  :trap
    call @bounds_error()
    return

  :exit
    return
}`,
    after: `define void @fill (%a, %len) {

  :entry
    %i <- 0
    br :header

  :header
    %cond <- %i < %len
    br %cond :body :exit

  :body
    store %a[%i], %i     ;; check proven redundant — gone
    %i <- %i + 1
    br :header

  :exit
    return
}`,
  },
  {
    id: "simplify-cfg",
    name: "CFGSimp",
    fullName: "CFG Simplification",
    tagline: "Collapse empty blocks, merge straight-line edges, and clean stale φs.",
    what:
      "Forwarding blocks (empty body, single unconditional branch) get spliced out, single-predecessor straight-line blocks merge into their pred, and conditional branches with identical targets become unconditional. φ-nodes are renormalized after the graph changes.",
    focus: [":mid", ":body"],
    story: {
      spot: ":mid and :body are empty forwarders",
      trace: "control just falls straight through them",
      transform: "so the blocks merge and the branch goes unconditional",
    },
    before: `define void @straight () {

  :entry
    br :mid              ;; empty forwarder

  :mid
    br :body             ;; another empty forwarder

  :body
    %x <- 7
    br %x :done :done    ;; both arms same target

  :done
    return %x
}`,
    after: `define void @straight () {

  :entry
    %x <- 7              ;; forwarders merged away
    br :done             ;; cond branch → unconditional

  :done
    return %x
}`,
  },
  {
    id: "cmov-synth",
    name: "CMovSynth",
    fullName: "Conditional-Move Synthesis",
    tagline: "Turn a branchy select into a single cmov, killing the mispredict.",
    what:
      "Matches a triangle CFG — conditional branch, a short side arm, and a join φ — and rewrites it as `cmov`. The side-arm instructions hoist into the entry block, the branch disappears, and the backend emits one predicated move instead of a pipeline hazard.",
    focus: ["%cmp", "%m"],
    story: {
      spot: "the branch selects between two values on %cmp",
      trace: "the join φ picks %m from the two arms",
      transform: "so the whole triangle becomes one cmov",
    },
    before: `define void @max (%a, %b) {

  :entry
    %cmp <- %a > %b
    br %cmp :pick_a :pick_b

  :pick_a
    br :join

  :pick_b
    br :join

  :join
    %m <- φ(%a :pick_a, %b :pick_b)
    return %m
}`,
    after: `define void @max (%a, %b) {

  :entry
    %cmp <- %a > %b
    %m <- cmov %cmp, %a, %b   ;; branch + φ → one select
    return %m
}`,
  },
  {
    id: "loop-dse",
    name: "LoopDSE",
    fullName: "Loop Dead-Store Elimination",
    tagline: "Drop stores inside a loop that are overwritten before any read.",
    what:
      "For counted loops, if a store to `tmp[i]` is always killed by a later store to the same address before any load observes it, the first store is dead. Loop DSE removes it so the body only writes the value that actually escapes.",
    focus: ["%t"],
    story: {
      spot: "this store is overwritten before any read",
      trace: "%t is never loaded — the next store kills it",
      transform: "so the dead store is dropped",
    },
    before: `define void @kill_store (%tmp, %out, %n) {

  :entry
    %i <- 0
    br :header

  :header
    %cond <- %i < %n
    br %cond :body :exit

  :body
    %t <- %i * 999
    store %tmp[%i], %t   ;; overwritten below — dead
    store %tmp[%i], %i   ;; kills the previous store
    %v <- load %tmp[%i]
    store %out[%i], %v
    %i <- %i + 1
    br :header

  :exit
    return
}`,
    after: `define void @kill_store (%tmp, %out, %n) {

  :entry
    %i <- 0
    br :header

  :header
    %cond <- %i < %n
    br %cond :body :exit

  :body
    store %tmp[%i], %i   ;; only the live store remains
    %v <- load %tmp[%i]
    store %out[%i], %v
    %i <- %i + 1
    br :header

  :exit
    return
}`,
  },
];
