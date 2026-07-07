/**
 * One tiny LA program per IR optimization pass, sized so the "before" IR is
 * small enough that the effect of the pass shows up on-screen without paging.
 *
 * Each demo is designed so that:
 *   - with the target pass OFF, the emitted L3+ has redundant/dead code
 *   - with the target pass ON, that code disappears or is folded
 *
 * `combo` demonstrates several passes together — LICM hoists, DCE strips the
 * unused computation, SCCP proves the false branch unreachable.
 */

export type PassDemoId =
  | "dce"
  | "licm"
  | "sccp"
  | "gvn"
  | "copy-prop"
  | "algebra"
  | "peephole"
  | "vra-bce"
  | "simplify-cfg"
  | "cmov-synth"
  | "loop-dse"
  | "combo";

export const PASS_DEMOS: Record<PassDemoId, string> = {
  dce: `// Dead Code Elimination — 'unused' is never read again.
// With DCE off, the multiplication survives all the way to x86.
void main () {
  int64 x
  int64 y
  int64 unused
  int64 result
  x <- 3
  y <- 4
  unused <- x * y * 100
  result <- x + y
  print(result)
  return
}`,

  licm: `// Loop-Invariant Code Motion — 'off <- n * 8' does not depend on i,
// so LICM hoists it into a preheader that runs once instead of every iter.
void main () {
  int64 n
  int64 i
  int64 sum
  int64 off
  int64 cont
  n <- 100
  i <- 0
  sum <- 0
:loop
  off <- n * 8
  sum <- sum + off
  i <- i + 1
  cont <- i < 10
  br cont :loop :done
:done
  print(sum)
  return
}`,

  sccp: `// Sparse Conditional Constant Propagation — 'c' is provably 1, so the
// false arm is unreachable and the constant arithmetic folds to 20.
void main () {
  int64 c
  int64 result
  c <- 1
  br c :taken :dead
:taken
  result <- 2 + 3
  result <- result * 4
  print(result)
  return
:dead
  print(-1)
  return
}`,

  gvn: `// Global Value Numbering — 'a' and 'b' compute the identical expression.
// GVN replaces b with a copy of a.
void main () {
  int64 x
  int64 a
  int64 b
  x <- 7
  a <- x * x
  a <- a + 3
  b <- x * x
  b <- b + 3
  print(a + b)
  return
}`,

  "copy-prop": `// Copy Propagation — a chain of pure assignments collapses so print(c)
// becomes print(5) once constant folding chases the copies.
void main () {
  int64 a
  int64 b
  int64 c
  a <- 5
  b <- a
  c <- b
  print(c)
  return
}`,

  algebra: `// Algebraic Simplification — x*1 => x, y+0 => y, z<<0 => z.
// Without this pass those trivial ops survive to the final assembly.
void main () {
  int64 x
  int64 y
  x <- 42
  y <- x * 1
  y <- y + 0
  y <- y << 0
  print(y)
  return
}`,

  peephole: `// Peephole — small local rewrites (redundant moves, trivial jumps, etc.)
// that reduce instruction count layer by layer.
void main () {
  int64 x
  int64 y
  x <- 10
  y <- x
  y <- y + 0
  y <- y * 2
  print(y)
  return
}`,

  "vra-bce": `// Value Range Analysis / Branch-Check Elimination — the compiler proves
// 'i' stays in [0, len) so it can strip the array-bounds check per access.
void main () {
  int64[] a
  int64 i
  int64 sum
  int64 cont
  a <- new Array(64)
  i <- 0
  sum <- 0
:loop
  a[i] <- i
  sum <- sum + i
  i <- i + 1
  cont <- i < 64
  br cont :loop :done
:done
  print(sum)
  return
}`,

  "simplify-cfg": `// CFG Simplification — the entry block just falls through to :main_body
// and :done is empty. Both collapse in the cleaned control-flow graph.
void main () {
  int64 x
:entry
  br :main_body
:main_body
  x <- 7
  print(x)
  br :done
:done
  return
}`,

  "cmov-synth": `// Conditional-Move Synthesis — a branchy 'max' turns into a single cmov
// on x86, eliminating the pipeline hazard from the mispredictable jump.
void main () {
  int64 a
  int64 b
  int64 m
  int64 cmp
  a <- 42
  b <- 17
  cmp <- a > b
  br cmp :pick_a :pick_b
:pick_a
  m <- a
  br :done
:pick_b
  m <- b
  br :done
:done
  print(m)
  return
}`,

  "loop-dse": `// Loop Dead-Store Elim — 'tmp[i] <- something' inside the loop is
// overwritten before it can be read, so the store is dead.
void main () {
  int64[] tmp
  int64[] out
  int64 i
  int64 cont
  tmp <- new Array(32)
  out <- new Array(32)
  i <- 0
:loop
  tmp[i] <- i * 999
  tmp[i] <- i
  out[i] <- tmp[i]
  i <- i + 1
  cont <- i < 32
  br cont :loop :done
:done
  print(out[0])
  return
}`,

  combo: `// A combo that exercises SCCP + LICM + DCE together.
//  - SCCP proves ':never' unreachable
//  - LICM hoists n*8 out of the loop
//  - DCE strips 'unused' entirely
void main () {
  int64 flag
  int64 n
  int64 i
  int64 sum
  int64 off
  int64 unused
  int64 c
  flag <- 1
  n <- 50
  br flag :run :never
:run
  i <- 0
  sum <- 0
:loop
  off <- n * 8
  unused <- i * 999
  sum <- sum + off
  i <- i + 1
  c <- i < 5
  br c :loop :done
:done
  print(sum)
  return
:never
  print(0)
  return
}`,
};
