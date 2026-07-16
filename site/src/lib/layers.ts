export const LAYERS = ["LC", "LB", "LA", "IR", "L3", "L2", "L1", "S"] as const;
export type Layer = (typeof LAYERS)[number];

export const LAYER_LABEL: Record<Layer, string> = {
  LC: "LC",
  LB: "LB",
  LA: "LA",
  IR: "IR",
  L3: "L3",
  L2: "L2",
  L1: "L1",
  S: "x86-64",
};

export const LAYER_TAGLINE: Record<Layer, string> = {
  LC: "Top of the tower, the most C-like layer: if/else, while, do-while, for, break/continue, nested scopes",
  LB: "Control flow starts naming its targets: if and while jump to explicit labels; scopes and loops remain",
  LA: "Scopes and loops lowered away: straight-line code with conditional br to labels, plus 1-D and n-D array primitives",
  IR: "SSA intermediate representation: φ-nodes, cleaned CFG, where all the optimization passes live",
  L3: "Post-SSA linear IR: three-address ops, calls, memory as loads/stores",
  L2: "Register-abstract IR: infinite virtual regs, right before register allocation",
  L1: "Register-concrete IR: after graph-coloring reg alloc + spilling",
  S: "x86-64 assembly (AT&T syntax): the final artifact your CPU actually runs",
};
