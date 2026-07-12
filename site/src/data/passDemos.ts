/**
 * One tiny IR program per optimization pass, sized so the "before" code is
 * small enough that the effect of the pass shows up on-screen without paging.
 * The demos drop you straight into the IR — it's where every pass lives — so
 * the pipeline shows IR → L3 → L2 → L1 → x86-64, all in-browser via wasm.
 *
 * Each demo is designed so that:
 *   - with the demo's pass(es) OFF, the emitted L3/x86 has redundant/dead code
 *   - with them ON, that code disappears or is folded
 *
 * Each entry is the LA stage's faithful lowering of a hand-written program
 * (LA→IR applies no optimization passes), and was verified by running the IR
 * through the wasm chain twice — demo passes on vs all passes off — asserting
 * the outputs differ at the demo's preferred layer.
 *
 * `combo` demonstrates several passes together — LICM hoists, DCE strips the
 * unused computation, SCCP proves the false branch unreachable. loop-dse also
 * enables sccp + vra-bce (see DEMO_PASSES in the visualizer): it only sees
 * the fill loop once the stored constant is folded and the in-loop bounds
 * checks are stripped.
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
  dce: `// Dead Code Elimination — %unused is never read again.
// With DCE off, its multiplication survives all the way to x86.
define void @main (){
	:bb_0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %result
	%result <- 0
	int64 %unused
	%unused <- 0
	int64 %y
	%y <- 0
	int64 %x
	%x <- 0
	%x <- 3
	%y <- 4
	%unused <- %x*%y
	%unused <- %unused*100
	%result <- %x+%y
	%____fresh_tmp_name_enc_0 <- %result<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
}`,

  licm: `// Loop-Invariant Code Motion — %off <- %n * 8 does not depend on %i,
// so LICM hoists it into a preheader that runs once instead of every iter.
define void @main (){
	:done_0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %n
	%n <- 0
	int64 %sum
	%sum <- 0
	int64 %i
	%i <- 0
	int64 %cont
	%cont <- 0
	int64 %off
	%off <- 0
	%n <- 100
	%i <- 0
	%sum <- 0
	br :loop

	:loop
	%off <- %n*8
	%sum <- %sum+%off
	%i <- %i+1
	%cont <- %i<10
	br %cont :loop :done

	:done
	%____fresh_tmp_name_enc_0 <- %sum<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
}`,

  sccp: `// Sparse Conditional Constant Propagation — %c is provably 1, so the
// false arm is unreachable and the constant arithmetic folds to 20.
define void @main (){
	:taken_0
	int64 %____fresh_tmp_name_enc_1
	%____fresh_tmp_name_enc_1 <- 0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %result
	%result <- 0
	int64 %c
	%c <- 0
	%c <- 1
	br %c :taken :dead

	:taken
	%result <- 2+3
	%result <- %result*4
	%____fresh_tmp_name_enc_0 <- %result<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
	:dead
	%____fresh_tmp_name_enc_1 <- -1<<1
	%____fresh_tmp_name_enc_1 <- %____fresh_tmp_name_enc_1+1
	call print (%____fresh_tmp_name_enc_1)
	return
}`,

  gvn: `// Global Value Numbering — %a and %b compute the identical expression.
// GVN replaces the repeat with a copy of the first.
define void @main (){
	:bb_0
	int64 %s
	%s <- 0
	int64 %b
	%b <- 0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %a
	%a <- 0
	int64 %x
	%x <- 0
	%x <- 7
	%a <- %x*%x
	%a <- %a+3
	%b <- %x*%x
	%b <- %b+3
	%s <- %a+%b
	%____fresh_tmp_name_enc_0 <- %s<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
}`,

  "copy-prop": `// Copy Propagation — a chain of pure copies collapses so print(%c)
// becomes print of the original 5 once folding chases the copies.
define void @main (){
	:bb_0
	int64 %c
	%c <- 0
	int64 %b
	%b <- 0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %a
	%a <- 0
	%a <- 5
	%b <- %a
	%c <- %b
	%____fresh_tmp_name_enc_0 <- %c<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
}`,

  algebra: `// Algebraic Simplification — x*1 => x, y+0 => y, z<<0 => z.
// Without this pass those trivial ops survive to the final assembly.
define void @main (){
	:bb_0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %y
	%y <- 0
	int64 %x
	%x <- 0
	%x <- 42
	%y <- %x*1
	%y <- %y+0
	%y <- %y<<0
	%____fresh_tmp_name_enc_0 <- %y<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
}`,

  peephole: `// Peephole — ints are tagged as (x<<1)+1 at runtime boundaries, so
// decode/re-encode chains crop up everywhere. Peephole collapses the
// round-trip ((x<<1)+1)>>1 back to plain x.
define void @main (){
	:bb_0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %d
	%d <- 0
	int64 %e
	%e <- 0
	int64 %x
	%x <- 0
	%x <- 21
	%e <- %x<<1
	%e <- %e+1
	%d <- %e>>1
	%____fresh_tmp_name_enc_0 <- %d<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
}`,

  "vra-bce": `// Value Range Analysis / Branch-Check Elimination — the compiler proves
// %i stays in [0, len) so it can strip the array-bounds check per access.
define void @main (){
	:done_5
	int64 %____fresh_tmp_name_enc_10
	%____fresh_tmp_name_enc_10 <- 0
	int64 %____fresh_tmp_name_enc_7
	%____fresh_tmp_name_enc_7 <- 0
	int64 %____fresh_tmp_name_ge0_5
	%____fresh_tmp_name_ge0_5 <- 0
	int64 %____fresh_tmp_name_lt_6
	%____fresh_tmp_name_lt_6 <- 0
	int64 %____fresh_tmp_name_dec_4
	%____fresh_tmp_name_dec_4 <- 0
	int64 %____fresh_tmp_name_enc_9
	%____fresh_tmp_name_enc_9 <- 0
	int64 %____fresh_tmp_name_null_1
	%____fresh_tmp_name_null_1 <- 0
	int64 %____fresh_tmp_name_enc_8
	%____fresh_tmp_name_enc_8 <- 0
	int64[] %a
	%a <- 0
	int64 %____fresh_tmp_name_len_3
	%____fresh_tmp_name_len_3 <- 0
	int64 %cont
	%cont <- 0
	int64 %i
	%i <- 0
	int64 %sum
	%sum <- 0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %____fresh_tmp_name_enc_2
	%____fresh_tmp_name_enc_2 <- 0
	%____fresh_tmp_name_enc_0 <- 64<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	%a <- new Array(%____fresh_tmp_name_enc_0)
	%i <- 0
	%sum <- 0
	br :loop

	:loop
	%____fresh_tmp_name_null_1 <- %a=0
	br %____fresh_tmp_name_null_1 :done_0 :done_1

	:done_0
	%____fresh_tmp_name_enc_2 <- 10<<1
	%____fresh_tmp_name_enc_2 <- %____fresh_tmp_name_enc_2+1
	call tensor-error (%____fresh_tmp_name_enc_2)
	br :done_1

	:done_1
	%____fresh_tmp_name_len_3 <- length %a 0
	%____fresh_tmp_name_dec_4 <- %____fresh_tmp_name_len_3>>1
	%____fresh_tmp_name_ge0_5 <- %i>=0
	br %____fresh_tmp_name_ge0_5 :done_2 :done_3

	:done_2
	%____fresh_tmp_name_lt_6 <- %i<%____fresh_tmp_name_dec_4
	br %____fresh_tmp_name_lt_6 :done_4 :done_3

	:done_3
	%____fresh_tmp_name_enc_7 <- 10<<1
	%____fresh_tmp_name_enc_7 <- %____fresh_tmp_name_enc_7+1
	%____fresh_tmp_name_enc_8 <- %i<<1
	%____fresh_tmp_name_enc_8 <- %____fresh_tmp_name_enc_8+1
	call tensor-error (%____fresh_tmp_name_enc_7,%____fresh_tmp_name_len_3,%____fresh_tmp_name_enc_8)
	br :done_4

	:done_4
	%____fresh_tmp_name_enc_9 <- %i<<1
	%____fresh_tmp_name_enc_9 <- %____fresh_tmp_name_enc_9+1
	%a[%i] <- %____fresh_tmp_name_enc_9
	%sum <- %sum+%i
	%i <- %i+1
	%cont <- %i<64
	br %cont :loop :done

	:done
	%____fresh_tmp_name_enc_10 <- %sum<<1
	%____fresh_tmp_name_enc_10 <- %____fresh_tmp_name_enc_10+1
	call print (%____fresh_tmp_name_enc_10)
	return
}`,

  "simplify-cfg": `// CFG Simplification — the entry block just falls through and :done is
// empty. Both collapse in the cleaned control-flow graph.
define void @main (){
	:main_body_0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %x
	%x <- 0
	br :entry

	:entry
	br :main_body

	:main_body
	%x <- 7
	%____fresh_tmp_name_enc_0 <- %x<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	br :done

	:done
	return
}`,

  "cmov-synth": `// Conditional-Move Synthesis — this branchy relu(a - b) triangle becomes
// a single cmov on x86, eliminating the mispredictable jump.
define void @main (){
	:join_0
	int64 %m
	%m <- 0
	int64 %b
	%b <- 0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %cmp
	%cmp <- 0
	int64 %a
	%a <- 0
	%a <- 42
	%b <- 17
	%m <- 0
	%cmp <- %a>%b
	br %cmp :then :join

	:then
	%m <- %a-%b
	br :join

	:join
	%____fresh_tmp_name_enc_0 <- %m<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
}`,

  "loop-dse": `// Loop Dead-Store Elim — the first loop fills %tmp with a constant, but
// the second loop overwrites every cell before anything reads it, so the
// whole fill loop is deleted. (sccp + vra-bce are enabled too: the pass
// only sees the fill once the stored constant is folded and the in-loop
// bounds checks are stripped.)
define void @main (){
	:done_15
	int64 %____fresh_tmp_name_enc_27
	%____fresh_tmp_name_enc_27 <- 0
	int64 %____fresh_tmp_name_enc_26
	%____fresh_tmp_name_enc_26 <- 0
	int64 %____fresh_tmp_name_enc_25
	%____fresh_tmp_name_enc_25 <- 0
	int64 %____fresh_tmp_name_lt_24
	%____fresh_tmp_name_lt_24 <- 0
	int64 %____fresh_tmp_name_dec_22
	%____fresh_tmp_name_dec_22 <- 0
	int64 %____fresh_tmp_name_enc_20
	%____fresh_tmp_name_enc_20 <- 0
	int64 %____fresh_tmp_name_enc_18
	%____fresh_tmp_name_enc_18 <- 0
	int64 %____fresh_tmp_name_enc_16
	%____fresh_tmp_name_enc_16 <- 0
	int64 %____fresh_tmp_name_enc_7
	%____fresh_tmp_name_enc_7 <- 0
	int64 %____fresh_tmp_name_len_12
	%____fresh_tmp_name_len_12 <- 0
	int64 %____fresh_tmp_name_dec_4
	%____fresh_tmp_name_dec_4 <- 0
	int64 %____fresh_tmp_name_null_10
	%____fresh_tmp_name_null_10 <- 0
	int64 %____fresh_tmp_name_enc_11
	%____fresh_tmp_name_enc_11 <- 0
	int64 %____fresh_tmp_name_lt_6
	%____fresh_tmp_name_lt_6 <- 0
	int64 %____fresh_tmp_name_enc_8
	%____fresh_tmp_name_enc_8 <- 0
	int64 %____fresh_tmp_name_len_3
	%____fresh_tmp_name_len_3 <- 0
	int64 %j
	%j <- 0
	int64 %____fresh_tmp_name_dec_13
	%____fresh_tmp_name_dec_13 <- 0
	int64 %c
	%c <- 0
	int64 %____fresh_tmp_name_ge0_23
	%____fresh_tmp_name_ge0_23 <- 0
	int64[] %tmp
	%tmp <- 0
	int64 %____fresh_tmp_name_ge0_5
	%____fresh_tmp_name_ge0_5 <- 0
	int64 %____fresh_tmp_name_lt_15
	%____fresh_tmp_name_lt_15 <- 0
	int64 %____fresh_tmp_name_enc_9
	%____fresh_tmp_name_enc_9 <- 0
	int64 %____fresh_tmp_name_len_21
	%____fresh_tmp_name_len_21 <- 0
	int64 %____fresh_tmp_name_null_1
	%____fresh_tmp_name_null_1 <- 0
	int64 %r
	%r <- 0
	int64 %____fresh_tmp_name_ge0_14
	%____fresh_tmp_name_ge0_14 <- 0
	int64 %____fresh_tmp_name_null_19
	%____fresh_tmp_name_null_19 <- 0
	int64 %____fresh_tmp_name_enc_2
	%____fresh_tmp_name_enc_2 <- 0
	int64 %____fresh_tmp_name_enc_17
	%____fresh_tmp_name_enc_17 <- 0
	int64 %i
	%i <- 0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	%____fresh_tmp_name_enc_0 <- 32<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	%tmp <- new Array(%____fresh_tmp_name_enc_0)
	%i <- 0
	br :fill

	:fill
	%____fresh_tmp_name_null_1 <- %tmp=0
	br %____fresh_tmp_name_null_1 :done_0 :done_1

	:done_0
	%____fresh_tmp_name_enc_2 <- 10<<1
	%____fresh_tmp_name_enc_2 <- %____fresh_tmp_name_enc_2+1
	call tensor-error (%____fresh_tmp_name_enc_2)
	br :done_1

	:done_1
	%____fresh_tmp_name_len_3 <- length %tmp 0
	%____fresh_tmp_name_dec_4 <- %____fresh_tmp_name_len_3>>1
	%____fresh_tmp_name_ge0_5 <- %i>=0
	br %____fresh_tmp_name_ge0_5 :done_2 :done_3

	:done_2
	%____fresh_tmp_name_lt_6 <- %i<%____fresh_tmp_name_dec_4
	br %____fresh_tmp_name_lt_6 :done_4 :done_3

	:done_3
	%____fresh_tmp_name_enc_7 <- 10<<1
	%____fresh_tmp_name_enc_7 <- %____fresh_tmp_name_enc_7+1
	%____fresh_tmp_name_enc_8 <- %i<<1
	%____fresh_tmp_name_enc_8 <- %____fresh_tmp_name_enc_8+1
	call tensor-error (%____fresh_tmp_name_enc_7,%____fresh_tmp_name_len_3,%____fresh_tmp_name_enc_8)
	br :done_4

	:done_4
	%____fresh_tmp_name_enc_9 <- 7<<1
	%____fresh_tmp_name_enc_9 <- %____fresh_tmp_name_enc_9+1
	%tmp[%i] <- %____fresh_tmp_name_enc_9
	%i <- %i+1
	%c <- %i<32
	br %c :fill :mid

	:mid
	%j <- 0
	br :over

	:over
	%____fresh_tmp_name_null_10 <- %tmp=0
	br %____fresh_tmp_name_null_10 :done_5 :done_6

	:done_5
	%____fresh_tmp_name_enc_11 <- 17<<1
	%____fresh_tmp_name_enc_11 <- %____fresh_tmp_name_enc_11+1
	call tensor-error (%____fresh_tmp_name_enc_11)
	br :done_6

	:done_6
	%____fresh_tmp_name_len_12 <- length %tmp 0
	%____fresh_tmp_name_dec_13 <- %____fresh_tmp_name_len_12>>1
	%____fresh_tmp_name_ge0_14 <- %j>=0
	br %____fresh_tmp_name_ge0_14 :done_7 :done_8

	:done_7
	%____fresh_tmp_name_lt_15 <- %j<%____fresh_tmp_name_dec_13
	br %____fresh_tmp_name_lt_15 :done_9 :done_8

	:done_8
	%____fresh_tmp_name_enc_16 <- 17<<1
	%____fresh_tmp_name_enc_16 <- %____fresh_tmp_name_enc_16+1
	%____fresh_tmp_name_enc_17 <- %j<<1
	%____fresh_tmp_name_enc_17 <- %____fresh_tmp_name_enc_17+1
	call tensor-error (%____fresh_tmp_name_enc_16,%____fresh_tmp_name_len_12,%____fresh_tmp_name_enc_17)
	br :done_9

	:done_9
	%____fresh_tmp_name_enc_18 <- %j<<1
	%____fresh_tmp_name_enc_18 <- %____fresh_tmp_name_enc_18+1
	%tmp[%j] <- %____fresh_tmp_name_enc_18
	%j <- %j+1
	%c <- %j<32
	br %c :over :done

	:done
	%____fresh_tmp_name_null_19 <- %tmp=0
	br %____fresh_tmp_name_null_19 :done_10 :done_11

	:done_10
	%____fresh_tmp_name_enc_20 <- 22<<1
	%____fresh_tmp_name_enc_20 <- %____fresh_tmp_name_enc_20+1
	call tensor-error (%____fresh_tmp_name_enc_20)
	br :done_11

	:done_11
	%____fresh_tmp_name_len_21 <- length %tmp 0
	%____fresh_tmp_name_dec_22 <- %____fresh_tmp_name_len_21>>1
	%____fresh_tmp_name_ge0_23 <- 31>=0
	br %____fresh_tmp_name_ge0_23 :done_12 :done_13

	:done_12
	%____fresh_tmp_name_lt_24 <- 31<%____fresh_tmp_name_dec_22
	br %____fresh_tmp_name_lt_24 :done_14 :done_13

	:done_13
	%____fresh_tmp_name_enc_25 <- 22<<1
	%____fresh_tmp_name_enc_25 <- %____fresh_tmp_name_enc_25+1
	%____fresh_tmp_name_enc_26 <- 31<<1
	%____fresh_tmp_name_enc_26 <- %____fresh_tmp_name_enc_26+1
	call tensor-error (%____fresh_tmp_name_enc_25,%____fresh_tmp_name_len_21,%____fresh_tmp_name_enc_26)
	br :done_14

	:done_14
	%r <- %tmp[31]
	%r <- %r>>1
	%____fresh_tmp_name_enc_27 <- %r<<1
	%____fresh_tmp_name_enc_27 <- %____fresh_tmp_name_enc_27+1
	call print (%____fresh_tmp_name_enc_27)
	return
}`,

  combo: `// A combo that exercises SCCP + LICM + DCE together.
//  - SCCP proves :never unreachable
//  - LICM hoists n*8 out of the loop
//  - DCE strips %unused entirely
define void @main (){
	:never_0
	int64 %____fresh_tmp_name_enc_1
	%____fresh_tmp_name_enc_1 <- 0
	int64 %____fresh_tmp_name_enc_0
	%____fresh_tmp_name_enc_0 <- 0
	int64 %c
	%c <- 0
	int64 %n
	%n <- 0
	int64 %sum
	%sum <- 0
	int64 %unused
	%unused <- 0
	int64 %i
	%i <- 0
	int64 %off
	%off <- 0
	int64 %flag
	%flag <- 0
	%flag <- 1
	%n <- 50
	br %flag :run :never

	:run
	%i <- 0
	%sum <- 0
	br :loop

	:loop
	%off <- %n*8
	%unused <- %i*999
	%sum <- %sum+%off
	%i <- %i+1
	%c <- %i<5
	br %c :loop :done

	:done
	%____fresh_tmp_name_enc_0 <- %sum<<1
	%____fresh_tmp_name_enc_0 <- %____fresh_tmp_name_enc_0+1
	call print (%____fresh_tmp_name_enc_0)
	return
	:never
	%____fresh_tmp_name_enc_1 <- 0<<1
	%____fresh_tmp_name_enc_1 <- %____fresh_tmp_name_enc_1+1
	call print (%____fresh_tmp_name_enc_1)
	return
}`,
};
