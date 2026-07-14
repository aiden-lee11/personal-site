import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Writing LC · Aiden Lee",
  description: "A quick reference for LC, the small C-like language in my compiler.",
};

/* ------------------------------------------------------------------ */
/* Grammar tokens — used only in the collapsed BNF pane at the bottom. */
/* Nonterminals are muted italics, terminals solid, literal punctuation */
/* dimmed; BNF notation (grouping parens, repetition marks) is accent.  */
/* ------------------------------------------------------------------ */

function Nt({ children }: { children: React.ReactNode }) {
  return <span className="italic text-[color:var(--muted)]">{children}</span>;
}
function Tm({ children }: { children: React.ReactNode }) {
  return <span className="text-[color:var(--fg)]">{children}</span>;
}
function Pn({ children }: { children: React.ReactNode }) {
  return <span className="text-[color:var(--fg)] opacity-45">{children}</span>;
}
function Gp({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[color:var(--accent)] opacity-80 font-light">
      {children}
    </span>
  );
}
function Rep({ children }: { children: React.ReactNode }) {
  return (
    <sup className="text-[color:var(--accent)] font-semibold text-[0.7em]">
      {children}
    </sup>
  );
}
function Bar() {
  return <span className="text-[color:var(--muted)] opacity-60 px-1.5">|</span>;
}
function Eps() {
  return <span className="italic text-[color:var(--muted)] opacity-70">ε</span>;
}

function Prod({ lhs, alts }: { lhs: string; alts: React.ReactNode[] }) {
  return (
    <div>
      {alts.map((alt, i) => (
        <div
          key={i}
          className="grid grid-cols-[3.5rem_1.75rem_1fr] items-baseline whitespace-nowrap"
        >
          <span className="text-[color:var(--accent)]">{i === 0 ? lhs : ""}</span>
          <span className="text-[color:var(--muted)] select-none">
            {i === 0 ? "::=" : "|"}
          </span>
          <span>{alt}</span>
        </div>
      ))}
    </div>
  );
}

/** An LC snippet — comments (`//` …) dim to muted. */
function LCExample({ code }: { code: string }) {
  return (
    <pre className="code-pane text-[0.8rem] leading-[1.7]">
      {code.split("\n").map((line, i) => {
        const idx = line.indexOf("//");
        const hasComment = idx >= 0;
        const codePart = hasComment ? line.slice(0, idx) : line;
        const comment = hasComment ? line.slice(idx) : "";
        return (
          <div key={i}>
            <span>{codePart === "" && !hasComment ? " " : codePart}</span>
            {hasComment && (
              <span className="text-[color:var(--muted)]">{comment}</span>
            )}
          </div>
        );
      })}
    </pre>
  );
}

/** Inline code token used inside prose. */
function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.85em] text-[color:var(--fg)] bg-[color:var(--code-bg)] rounded px-1 py-0.5">
      {children}
    </code>
  );
}

/* ------------------------------------------------------------------ */

const TEMPLATE = `// squares of 0..9 - a template to start from
void main () {
  int i, sq            // declare before use; ints only
  int[] squares        // arrays: int[], int[][], ...

  squares <- new Array(10)   // heap arrays, bounds-checked
  i <- 0
  while (i < 10) {           // a condition is one comparison
    sq <- i * i              // one operator per statement
    squares[i] <- sq
    i <- i + 1               // assignment is <-  (= compares)
  }
  if (i = 10) {              // else is always required
    print(squares)           // the built-in output
  } else {
    print(0)
  }
  return
}`;

const TOOLBOX: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: "Types",
    items: [
      ["int", "64-bit integer, the only scalar"],
      ["int[] / int[][]", "heap arrays; add brackets per dimension"],
      ["tuple", "heterogeneous heap record"],
      ["code", "a function you can store and call"],
    ],
  },
  {
    title: "Control flow",
    items: [
      ["if (c) { } else { }", "else is required"],
      ["while (c) { }", "also do { } while (c)"],
      ["for (init; c; step) { }", "each slot optional"],
      ["break / continue", "inside any loop"],
    ],
  },
  {
    title: "Operators",
    items: [
      ["+  -  *  &  <<  >>", "arithmetic, bitwise AND, shifts"],
      ["<  <=  =  >=  >", "comparisons that yield 1 or 0"],
      ["<-", "assignment (= is equality)"],
    ],
  },
  {
    title: "Built-ins",
    items: [
      ["print(x)", "output an int, array, or tuple"],
      ["new Array(d1, …)", "allocate an array, sizes at runtime"],
      ["new Tuple(n)", "allocate an n-slot tuple"],
      ["length arr d", "length of dimension d, no parens"],
    ],
  },
];

const RULES: React.ReactNode[] = [
  <>
    Assignment is <C>{"<-"}</C>; <C>=</C> is equality.
  </>,
  <>
    One operator per statement: no <C>x {"<-"} (a + b) * 2</C>. Split it up.
  </>,
  <>
    Conditions are one comparison: no <C>&amp;&amp;</C> / <C>||</C>; nest{" "}
    <C>if</C>s.
  </>,
  <>
    Declare before use: <C>int a, b</C> on its own line.
  </>,
  <>No strings, floats, or bools; ints only.</>,
  <>
    The entry point is exactly <C>void main ( )</C>.
  </>,
];

/* ------------------------------------------------------------------ */

export default function GrammarPage() {
  // Deep-link the template into the playground. The visualizer rehydrates
  // from `#s=<base64 source>&f=<layer>`; encodeURIComponent keeps the base64
  // `+`/`=` characters intact through URLSearchParams.
  const templateB64 = Buffer.from(TEMPLATE, "utf8").toString("base64");
  const playgroundHref = `/compiler/playground#s=${encodeURIComponent(templateB64)}&f=LC`;

  return (
    <div>
      {/* Hero + template — first viewport */}
      <header className="mb-8">
        <p className="eyebrow mb-5">Interactive / Compiler</p>
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1.02]">
          Writing LC
        </h1>
        <p className="mt-4 max-w-2xl text-[color:var(--muted)] leading-relaxed">
          LC is a small C-like language. Start with this template, change it,
          and see what the compiler does with it.
        </p>
      </header>

      <section>
        <div className="max-w-2xl">
          <LCExample code={TEMPLATE} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={playgroundHref} className="btn btn-primary">
            <span>Open it in the playground</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* What you have */}
      <section className="border-t border-[color:var(--border)] mt-12 pt-8">
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-6">
          What&apos;s available
        </h2>
        <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {TOOLBOX.map((group) => (
            <div key={group.title}>
              <p className="font-semibold tracking-tight mb-2.5">
                {group.title}
              </p>
              <ul className="space-y-1.5">
                {group.items.map(([code, note]) => (
                  <li
                    key={code}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                  >
                    <code className="font-mono text-[0.8rem] text-[color:var(--fg)] whitespace-nowrap">
                      {code}
                    </code>
                    <span className="text-sm text-[color:var(--muted)]">
                      {note}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* The rules that bite */}
      <section className="border-t border-[color:var(--border)] mt-12 pt-8">
        <h2 className="font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] mb-6">
          A few rules
        </h2>
        <ul className="grid gap-x-10 gap-y-2.5 sm:grid-cols-2 max-w-4xl">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-[color:var(--accent)]" />
              <span className="text-sm text-[color:var(--muted)] leading-relaxed">
                {r}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* The formal grammar — collapsed by default */}
      <section className="border-t border-[color:var(--border)] mt-12 pt-8 pb-4">
        <details className="group">
          <summary className="cursor-pointer list-none font-mono text-xs tracking-widest uppercase text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors">
            <span className="text-[color:var(--accent)] mr-2 inline-block transition-transform group-open:rotate-90">
              ▸
            </span>
            The formal grammar — for the curious
          </summary>
          <p className="mt-5 max-w-2xl text-sm text-[color:var(--muted)] leading-relaxed">
            <span className="italic">Italics</span> are rules, solid text is
            what you type; accent <Gp>( … )</Gp> only groups for a{" "}
            <Rep>+</Rep> / <Rep>*</Rep> / <Rep>?</Rep> (one-or-more,
            zero-or-more, optional) and is never typed; <Eps /> is empty.
          </p>
          <div className="mt-5 overflow-x-auto rounded-md border border-[color:var(--border)] bg-[color:var(--code-bg)] px-5 py-4 font-mono text-[0.8rem] sm:text-[0.85rem] leading-[1.9] space-y-3">
            <Prod
              lhs="p"
              alts={[
                <>
                  <Nt>f</Nt>
                  <Rep>+</Rep>
                </>,
              ]}
            />
            <Prod
              lhs="f"
              alts={[
                <>
                  <Nt>T</Nt> <Nt>name</Nt> <Pn>(</Pn>
                  <Nt>pars</Nt>
                  <Pn>)</Pn> <Nt>scope</Nt>
                </>,
              ]}
            />
            <Prod
              lhs="pars"
              alts={[
                <>
                  <Nt>type</Nt> <Nt>var</Nt>
                  <Bar />
                  <Nt>type</Nt> <Nt>var</Nt>
                  <Gp>(</Gp>
                  <Pn>,</Pn> <Nt>type</Nt> <Nt>var</Nt>
                  <Gp>)</Gp>
                  <Rep>*</Rep>
                  <Bar />
                  <Eps />
                </>,
              ]}
            />
            <Prod
              lhs="scope"
              alts={[
                <>
                  <Pn>{"{"}</Pn> <Nt>i</Nt>
                  <Rep>*</Rep> <Pn>{"}"}</Pn>
                </>,
              ]}
            />
            <Prod
              lhs="i"
              alts={[
                <>
                  <Nt>i1</Nt>
                  <Bar />
                  <Nt>i2</Nt>
                  <Bar />
                  <Nt>scope</Nt>
                </>,
              ]}
            />
            <Prod
              lhs="i1"
              alts={[
                <>
                  <Nt>name</Nt> <Tm>{"<-"}</Tm> <Nt>s</Nt>
                </>,
                <>
                  <Nt>name</Nt> <Tm>{"<-"}</Tm> <Nt>t</Nt> <Nt>op</Nt>{" "}
                  <Nt>t</Nt>
                </>,
                <>
                  <Nt>name</Nt> <Tm>{"<-"}</Tm> <Nt>name</Nt>
                  <Gp>(</Gp>
                  <Pn>[</Pn>
                  <Nt>t</Nt>
                  <Pn>]</Pn>
                  <Gp>)</Gp>
                  <Rep>+</Rep>
                </>,
                <>
                  <Nt>name</Nt>
                  <Gp>(</Gp>
                  <Pn>[</Pn>
                  <Nt>t</Nt>
                  <Pn>]</Pn>
                  <Gp>)</Gp>
                  <Rep>+</Rep> <Tm>{"<-"}</Tm> <Nt>s</Nt>
                </>,
                <>
                  <Nt>name</Nt> <Tm>{"<-"}</Tm> <Tm>length</Tm> <Nt>name</Nt>{" "}
                  <Nt>t</Nt>
                  <Rep>?</Rep>
                </>,
                <>
                  <Nt>name</Nt>
                  <Pn>(</Pn> <Nt>args</Nt>
                  <Rep>?</Rep> <Pn>)</Pn>
                </>,
                <>
                  <Nt>name</Nt> <Tm>{"<-"}</Tm> <Nt>name</Nt>
                  <Pn>(</Pn> <Nt>args</Nt>
                  <Rep>?</Rep> <Pn>)</Pn>
                </>,
                <>
                  <Nt>name</Nt> <Tm>{"<-"}</Tm> <Tm>new</Tm> <Tm>Array</Tm>
                  <Pn>(</Pn>
                  <Nt>args</Nt>
                  <Pn>)</Pn>
                </>,
                <>
                  <Nt>name</Nt> <Tm>{"<-"}</Tm> <Tm>new</Tm> <Tm>Tuple</Tm>
                  <Pn>(</Pn>
                  <Nt>t</Nt>
                  <Pn>)</Pn>
                </>,
              ]}
            />
            <Prod
              lhs="i2"
              alts={[
                <>
                  <Nt>type</Nt> <Nt>names</Nt>
                </>,
                <>
                  <Tm>if</Tm> <Pn>(</Pn>
                  <Nt>cond</Nt>
                  <Pn>)</Pn> <Nt>scope</Nt> <Tm>else</Tm> <Nt>scope</Nt>
                </>,
                <>
                  <Tm>return</Tm> <Nt>t</Nt>
                  <Rep>?</Rep>
                </>,
                <>
                  <Tm>while</Tm> <Pn>(</Pn>
                  <Nt>cond</Nt>
                  <Pn>)</Pn> <Nt>scope</Nt>
                </>,
                <>
                  <Tm>do</Tm> <Nt>scope</Nt> <Tm>while</Tm> <Pn>(</Pn>
                  <Nt>cond</Nt>
                  <Pn>)</Pn>
                </>,
                <>
                  <Tm>for</Tm> <Pn>(</Pn>
                  <Nt>i1</Nt>
                  <Rep>?</Rep> <Pn>;</Pn> <Nt>cond</Nt>
                  <Rep>?</Rep> <Pn>;</Pn> <Nt>i1</Nt>
                  <Rep>?</Rep>
                  <Pn>)</Pn> <Nt>scope</Nt>
                </>,
                <>
                  <Tm>continue</Tm>
                </>,
                <>
                  <Tm>break</Tm>
                </>,
              ]}
            />
            <Prod
              lhs="T"
              alts={[
                <>
                  <Nt>type</Nt>
                  <Bar />
                  <Tm>void</Tm>
                </>,
              ]}
            />
            <Prod
              lhs="type"
              alts={[
                <>
                  <Tm>int</Tm>
                  <Gp>(</Gp>
                  <Pn>[]</Pn>
                  <Gp>)</Gp>
                  <Rep>*</Rep>
                  <Bar />
                  <Tm>tuple</Tm>
                  <Bar />
                  <Tm>code</Tm>
                </>,
              ]}
            />
            <Prod
              lhs="args"
              alts={[
                <>
                  <Nt>t</Nt>
                  <Bar />
                  <Nt>t</Nt>
                  <Gp>(</Gp>
                  <Pn>,</Pn> <Nt>t</Nt>
                  <Gp>)</Gp>
                  <Rep>*</Rep>
                </>,
              ]}
            />
            <Prod
              lhs="names"
              alts={[
                <>
                  <Nt>name</Nt>
                  <Bar />
                  <Nt>name</Nt>
                  <Gp>(</Gp>
                  <Pn>,</Pn> <Nt>name</Nt>
                  <Gp>)</Gp>
                  <Rep>*</Rep>
                </>,
              ]}
            />
            <Prod
              lhs="s"
              alts={[
                <>
                  <Nt>t</Nt>
                  <Bar />
                  <Nt>name</Nt>
                </>,
              ]}
            />
            <Prod
              lhs="t"
              alts={[
                <>
                  <Nt>name</Nt>
                  <Bar />
                  <Nt>N</Nt>
                </>,
              ]}
            />
            <Prod
              lhs="N"
              alts={[
                <>
                  <Gp>(</Gp>
                  <Tm>+</Tm>
                  <Bar />
                  <Tm>-</Tm>
                  <Gp>)</Gp>
                  <Rep>?</Rep> <Pn>[0-9]</Pn>
                  <Rep>+</Rep>
                </>,
              ]}
            />
            <Prod
              lhs="cond"
              alts={[
                <>
                  <Nt>t</Nt> <Nt>cmp</Nt> <Nt>t</Nt>
                </>,
              ]}
            />
            <Prod
              lhs="op"
              alts={[
                <>
                  <Tm>+</Tm>
                  <Bar />
                  <Tm>-</Tm>
                  <Bar />
                  <Tm>*</Tm>
                  <Bar />
                  <Tm>&amp;</Tm>
                  <Bar />
                  <Tm>{"<<"}</Tm>
                  <Bar />
                  <Tm>{">>"}</Tm>
                  <Bar />
                  <Nt>cmp</Nt>
                </>,
              ]}
            />
            <Prod
              lhs="cmp"
              alts={[
                <>
                  <Tm>{"<"}</Tm>
                  <Bar />
                  <Tm>{"<="}</Tm>
                  <Bar />
                  <Tm>=</Tm>
                  <Bar />
                  <Tm>{">="}</Tm>
                  <Bar />
                  <Tm>{">"}</Tm>
                </>,
              ]}
            />
            <Prod
              lhs="name"
              alts={[
                <>
                  <Pn>[a-zA-Z_]</Pn>
                  <Pn>[a-zA-Z_0-9]</Pn>
                  <Rep>*</Rep>
                </>,
              ]}
            />
          </div>
        </details>
      </section>
    </div>
  );
}
