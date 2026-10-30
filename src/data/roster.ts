import {
  add,
  call,
  EX,
  mul,
  neg,
  num,
  pow,
  simplify,
  type Expr,
} from "../math/expr";

export type Category =
  | "Polynomials"
  | "Piecewise"
  | "Roots"
  | "Rational"
  | "Exponential"
  | "Logarithmic"
  | "Trigonometric"
  | "Reciprocal trig"
  | "Inverse trig"
  | "Hyperbolic"
  | "Inverse hyperbolic"
  | "Special"
  | "Parametric";

export type Special =
  | "tan-upgrade"
  | "exp-burst"
  | "triangle"
  | "pi-sector"
  | "hyperbola"
  | "fusion-ln"
  | "fusion-exp";

export type PlotKind = "expr" | "circle" | "heart" | "sector";

export interface RosterEntry {
  id: string;
  name: string;
  latex: string;
  category: Category;
  color: string;
  hp: number;
  attack: number;
  cooldown: number;
  expr: Expr | null;
  plot: PlotKind;
  special: Special | null;
}

export const CATEGORIES: Category[] = [
  "Polynomials",
  "Piecewise",
  "Roots",
  "Rational",
  "Exponential",
  "Logarithmic",
  "Trigonometric",
  "Reciprocal trig",
  "Inverse trig",
  "Hyperbolic",
  "Inverse hyperbolic",
  "Special",
  "Parametric",
];

const S = (e: Expr) => simplify(e);
const X = EX;

function R(
  p: Pick<RosterEntry, "id" | "name" | "latex" | "category" | "color"> &
    Partial<Pick<RosterEntry, "hp" | "attack" | "cooldown" | "expr" | "plot" | "special">>,
): RosterEntry {
  return {
    hp: 80,
    attack: 8,
    cooldown: 3,
    expr: null,
    plot: "expr",
    special: null,
    ...p,
  };
}

export const ROSTER: RosterEntry[] = [
  R({ id: "zero", name: "0", latex: "0", category: "Polynomials", color: "#546e7a", hp: 48, attack: 4, cooldown: 3.4, expr: num(0) }),
  R({ id: "one", name: "1", latex: "1", category: "Polynomials", color: "#6d4c41", hp: 64, attack: 6, cooldown: 3.2, expr: num(1) }),
  R({ id: "two", name: "2", latex: "2", category: "Polynomials", color: "#455a64", hp: 70, attack: 7, cooldown: 3.1, expr: num(2) }),
  R({ id: "econst", name: "e", latex: "e", category: "Polynomials", color: "#b71c1c", hp: 78, attack: 7, cooldown: 3, expr: num(Math.E) }),
  R({
    id: "pi",
    name: "π",
    latex: "\\pi",
    category: "Polynomials",
    color: "#1a237e",
    hp: 96,
    attack: 9,
    cooldown: 4,
    expr: num(Math.PI),
    plot: "sector",
    special: "pi-sector",
  }),
  R({
    id: "sqrt2",
    name: "√2",
    latex: "\\sqrt{2}",
    category: "Polynomials",
    color: "#00897b",
    hp: 76,
    attack: 6,
    cooldown: 3.3,
    expr: num(Math.SQRT2),
    special: "triangle",
  }),
  R({
    id: "phi",
    name: "φ",
    latex: "\\varphi",
    category: "Polynomials",
    color: "#8d6e63",
    hp: 74,
    attack: 7,
    cooldown: 3.1,
    expr: num((1 + Math.sqrt(5)) / 2),
  }),
  R({ id: "x", name: "x", latex: "x", category: "Polynomials", color: "#1565c0", hp: 80, attack: 8, cooldown: 2.7, expr: X }),
  R({ id: "2x", name: "2x", latex: "2x", category: "Polynomials", color: "#0277bd", hp: 82, attack: 9, cooldown: 2.8, expr: S(mul(num(2), X)) }),
  R({ id: "xplus1", name: "x+1", latex: "x+1", category: "Polynomials", color: "#00838f", expr: S(add(X, num(1))) }),
  R({ id: "negx", name: "−x", latex: "-x", category: "Polynomials", color: "#283593", expr: S(neg(X)) }),
  R({ id: "halfx", name: "x/2", latex: "\\tfrac{1}{2}x", category: "Polynomials", color: "#00695c", expr: S(mul(num(0.5), X)) }),
  R({ id: "x2", name: "x²", latex: "x^{2}", category: "Polynomials", color: "#ef6c00", hp: 84, attack: 10, cooldown: 2.9, expr: S(pow(X, 2)) }),
  R({ id: "x2p1", name: "x²+1", latex: "x^{2}+1", category: "Polynomials", color: "#e65100", expr: S(add(pow(X, 2), num(1))) }),
  R({ id: "xm1sq", name: "(x−1)²", latex: "(x-1)^{2}", category: "Polynomials", color: "#f4511e", expr: S(pow(add(X, num(-1)), 2)) }),
  R({
    id: "x3",
    name: "x³",
    latex: "x^{3}",
    category: "Polynomials",
    color: "#fb8c00",
    hp: 88,
    attack: 11,
    cooldown: 2.8,
    expr: S(pow(X, 3)),
  }),
  R({ id: "x3mx", name: "x³−x", latex: "x^{3}-x", category: "Polynomials", color: "#f9a825", hp: 86, attack: 10, cooldown: 2.9, expr: S(add(pow(X, 3), neg(X))) }),
  R({ id: "x4", name: "x⁴", latex: "x^{4}", category: "Polynomials", color: "#6a1b9a", hp: 90, attack: 12, cooldown: 3.2, expr: S(pow(X, 4)) }),
  R({ id: "x5", name: "x⁵", latex: "x^{5}", category: "Polynomials", color: "#4a148c", hp: 92, attack: 12, cooldown: 3.3, expr: S(pow(X, 5)) }),

  R({ id: "abs", name: "|x|", latex: "|x|", category: "Piecewise", color: "#37474f", hp: 78, attack: 8, cooldown: 2.8, expr: S(call("abs", X)) }),
  R({ id: "absxm1", name: "|x−1|", latex: "|x-1|", category: "Piecewise", color: "#455a64", expr: S(call("abs", add(X, num(-1)))) }),
  R({ id: "sign", name: "sgn x", latex: "\\operatorname{sgn} x", category: "Piecewise", color: "#5d4037", hp: 66, attack: 7, cooldown: 2.6, expr: S(call("sign", X)) }),
  R({ id: "floor", name: "⌊x⌋", latex: "\\lfloor x \\rfloor", category: "Piecewise", color: "#4e342e", hp: 70, attack: 7, cooldown: 2.7, expr: S(call("floor", X)) }),
  R({ id: "ceil", name: "⌈x⌉", latex: "\\lceil x \\rceil", category: "Piecewise", color: "#3e2723", hp: 70, attack: 7, cooldown: 2.7, expr: S(call("ceil", X)) }),
  R({ id: "frac", name: "{x}", latex: "\\{x\\}", category: "Piecewise", color: "#6d4c41", hp: 68, attack: 7, cooldown: 2.5, expr: S(add(X, neg(call("floor", X)))) }),
  R({ id: "heaviside", name: "H(x)", latex: "H(x)", category: "Piecewise", color: "#263238", hp: 72, attack: 9, cooldown: 2.9, expr: S(call("heaviside", X)) }),
  R({ id: "dirac", name: "δ(x)", latex: "\\delta(x)", category: "Piecewise", color: "#212121", hp: 58, attack: 16, cooldown: 3.4, expr: S(call("dirac", X)) }),

  R({ id: "sqrt", name: "√x", latex: "\\sqrt{x}", category: "Roots", color: "#2e7d32", hp: 76, attack: 8, cooldown: 2.9, expr: S(call("sqrt", X)) }),
  R({ id: "cbrt", name: "∛x", latex: "\\sqrt[3]{x}", category: "Roots", color: "#388e3c", expr: S(call("cbrt", X)) }),
  R({ id: "fourthrt", name: "x¼", latex: "x^{1/4}", category: "Roots", color: "#1b5e20", hp: 74, attack: 7, cooldown: 3.1, expr: S(pow(X, 0.25)) }),
  R({ id: "sqrtabs", name: "√|x|", latex: "\\sqrt{|x|}", category: "Roots", color: "#558b2f", expr: S(call("sqrt", call("abs", X))) }),

  R({
    id: "inv",
    name: "1/x",
    latex: "\\frac{1}{x}",
    category: "Rational",
    color: "#29b6f6",
    hp: 74,
    attack: 8,
    cooldown: 2.9,
    expr: S(pow(X, -1)),
    special: "hyperbola",
  }),
  R({ id: "inv2", name: "1/x²", latex: "\\frac{1}{x^{2}}", category: "Rational", color: "#039be5", hp: 72, attack: 9, cooldown: 3, expr: S(pow(X, -2)) }),
  R({ id: "inv3", name: "1/x³", latex: "\\frac{1}{x^{3}}", category: "Rational", color: "#0288d1", hp: 70, attack: 9, cooldown: 3.1, expr: S(pow(X, -3)) }),
  R({ id: "agnesi", name: "1/(1+x²)", latex: "\\frac{1}{1+x^{2}}", category: "Rational", color: "#0277bd", hp: 82, attack: 7, cooldown: 3, expr: S(pow(add(num(1), pow(X, 2)), -1)) }),
  R({ id: "bump", name: "x/(1+x²)", latex: "\\frac{x}{1+x^{2}}", category: "Rational", color: "#01579b", expr: S(mul(X, pow(add(num(1), pow(X, 2)), -1))) }),
  R({ id: "witch", name: "8/(x²+4)", latex: "\\frac{8}{x^{2}+4}", category: "Rational", color: "#006064", hp: 84, attack: 7, cooldown: 3.1, expr: S(mul(num(8), pow(add(pow(X, 2), num(4)), -1))) }),

  R({
    id: "exp",
    name: "eˣ",
    latex: "e^{x}",
    category: "Exponential",
    color: "#e53935",
    hp: 86,
    attack: 4,
    cooldown: 2.7,
    expr: S(call("exp", X)),
    special: "exp-burst",
  }),
  R({ id: "expneg", name: "e⁻ˣ", latex: "e^{-x}", category: "Exponential", color: "#c62828", hp: 82, attack: 6, cooldown: 2.8, expr: S(call("exp", neg(X))) }),
  R({ id: "exphalf", name: "e^{x/2}", latex: "e^{x/2}", category: "Exponential", color: "#d32f2f", expr: S(call("exp", mul(num(0.5), X))) }),
  R({ id: "exp2", name: "2ˣ", latex: "2^{x}", category: "Exponential", color: "#b71c1c", hp: 84, attack: 7, cooldown: 2.9, expr: S(call("exp", mul(num(Math.LN2), X))) }),
  R({ id: "exp10", name: "10ˣ", latex: "10^{x}", category: "Exponential", color: "#880e4f", hp: 80, attack: 8, cooldown: 3.2, expr: S(call("exp", mul(num(Math.LN10), X))) }),

  R({
    id: "ln",
    name: "ln x",
    latex: "\\ln x",
    category: "Logarithmic",
    color: "#757575",
    hp: 72,
    attack: 7,
    cooldown: 3,
    expr: S(call("ln", X)),
    special: "fusion-ln",
  }),
  R({ id: "lnabs", name: "ln|x|", latex: "\\ln|x|", category: "Logarithmic", color: "#616161", expr: S(call("ln", call("abs", X))) }),
  R({ id: "log10", name: "log₁₀ x", latex: "\\log_{10} x", category: "Logarithmic", color: "#9e9e9e", hp: 70, attack: 7, cooldown: 3.1, expr: S(call("log10", X)) }),
  R({ id: "log2", name: "log₂ x", latex: "\\log_{2} x", category: "Logarithmic", color: "#424242", hp: 70, attack: 7, cooldown: 3.1, expr: S(call("log2", X)) }),

  R({ id: "sin", name: "sin x", latex: "\\sin x", category: "Trigonometric", color: "#8e24aa", hp: 80, attack: 8, cooldown: 2.6, expr: S(call("sin", X)) }),
  R({ id: "cos", name: "cos x", latex: "\\cos x", category: "Trigonometric", color: "#5e35b1", hp: 80, attack: 8, cooldown: 2.6, expr: S(call("cos", X)) }),
  R({
    id: "tan",
    name: "tan x",
    latex: "\\tan x",
    category: "Trigonometric",
    color: "#43a047",
    hp: 78,
    attack: 6,
    cooldown: 3.1,
    expr: S(call("tan", X)),
    special: "tan-upgrade",
  }),
  R({
    id: "sin2",
    name: "sin 2x",
    latex: "\\sin 2x",
    category: "Trigonometric",
    color: "#6a1b9a",
    hp: 90,
    attack: 12,
    cooldown: 2.5,
    expr: S(call("sin", mul(num(2), X))),
  }),
  R({ id: "cos2", name: "cos 2x", latex: "\\cos 2x", category: "Trigonometric", color: "#7b1fa2", expr: S(call("cos", mul(num(2), X))) }),
  R({ id: "sincos", name: "sin+cos", latex: "\\sin x+\\cos x", category: "Trigonometric", color: "#aa00ff", hp: 84, attack: 9, cooldown: 2.8, expr: S(add(call("sin", X), call("cos", X))) }),
  R({ id: "versine", name: "1−cos", latex: "1-\\cos x", category: "Trigonometric", color: "#4a148c", expr: S(add(num(1), neg(call("cos", X)))) }),

  R({ id: "sec", name: "sec x", latex: "\\sec x", category: "Reciprocal trig", color: "#00796b", hp: 68, attack: 10, cooldown: 3.2, expr: S(call("sec", X)) }),
  R({ id: "csc", name: "csc x", latex: "\\csc x", category: "Reciprocal trig", color: "#00695c", hp: 68, attack: 10, cooldown: 3.2, expr: S(call("csc", X)) }),
  R({ id: "cot", name: "cot x", latex: "\\cot x", category: "Reciprocal trig", color: "#004d40", hp: 68, attack: 10, cooldown: 3.2, expr: S(call("cot", X)) }),

  R({ id: "asin", name: "arcsin", latex: "\\arcsin x", category: "Inverse trig", color: "#f06292", hp: 70, attack: 8, cooldown: 3, expr: S(call("asin", X)) }),
  R({ id: "acos", name: "arccos", latex: "\\arccos x", category: "Inverse trig", color: "#ec407a", expr: S(call("acos", X)) }),
  R({ id: "atan", name: "arctan", latex: "\\arctan x", category: "Inverse trig", color: "#d81b60", hp: 84, attack: 7, cooldown: 2.8, expr: S(call("atan", X)) }),
  R({ id: "acot", name: "arccot", latex: "\\operatorname{arccot} x", category: "Inverse trig", color: "#ad1457", expr: S(add(num(Math.PI / 2), neg(call("atan", X)))) }),

  R({ id: "sinh", name: "sinh", latex: "\\sinh x", category: "Hyperbolic", color: "#5e35b1", expr: S(call("sinh", X)) }),
  R({ id: "cosh", name: "cosh", latex: "\\cosh x", category: "Hyperbolic", color: "#512da8", hp: 84, attack: 8, cooldown: 2.9, expr: S(call("cosh", X)) }),
  R({ id: "tanh", name: "tanh", latex: "\\tanh x", category: "Hyperbolic", color: "#4527a0", hp: 78, attack: 7, cooldown: 2.7, expr: S(call("tanh", X)) }),
  R({ id: "sech", name: "sech", latex: "\\operatorname{sech} x", category: "Hyperbolic", color: "#311b92", hp: 74, attack: 7, cooldown: 3, expr: S(call("sech", X)) }),
  R({ id: "csch", name: "csch", latex: "\\operatorname{csch} x", category: "Hyperbolic", color: "#1a237e", hp: 66, attack: 9, cooldown: 3.2, expr: S(call("csch", X)) }),
  R({ id: "coth", name: "coth", latex: "\\coth x", category: "Hyperbolic", color: "#0d47a1", hp: 66, attack: 9, cooldown: 3.2, expr: S(call("coth", X)) }),

  R({ id: "asinh", name: "asinh", latex: "\\operatorname{asinh} x", category: "Inverse hyperbolic", color: "#00897b", expr: S(call("asinh", X)) }),
  R({ id: "acosh", name: "acosh", latex: "\\operatorname{acosh} x", category: "Inverse hyperbolic", color: "#00695c", hp: 72, attack: 8, cooldown: 3.1, expr: S(call("acosh", X)) }),
  R({ id: "atanh", name: "atanh", latex: "\\operatorname{atanh} x", category: "Inverse hyperbolic", color: "#004d40", hp: 70, attack: 9, cooldown: 3, expr: S(call("atanh", X)) }),

  R({ id: "sinc", name: "sinc", latex: "\\operatorname{sinc} x", category: "Special", color: "#3949ab", hp: 76, attack: 7, cooldown: 2.8, expr: S(call("sinc", X)) }),
  R({ id: "gaussian", name: "e^{−x²}", latex: "e^{-x^{2}}", category: "Special", color: "#c2185b", hp: 82, attack: 8, cooldown: 2.9, expr: S(call("exp", neg(pow(X, 2)))) }),
  R({ id: "sigmoid", name: "σ(x)", latex: "\\sigma(x)", category: "Special", color: "#7b1fa2", hp: 80, attack: 7, cooldown: 2.8, expr: S(call("sigmoid", X)) }),
  R({ id: "erf", name: "erf", latex: "\\operatorname{erf}(x)", category: "Special", color: "#0097a7", hp: 84, attack: 7, cooldown: 3, expr: S(call("erf", X)) }),
  R({ id: "gamma", name: "Γ(x)", latex: "\\Gamma(x)", category: "Special", color: "#6a1b9a", hp: 76, attack: 9, cooldown: 3.2, expr: S(call("gamma", X)) }),
  R({ id: "factorial", name: "x!", latex: "x!", category: "Special", color: "#4a148c", hp: 78, attack: 9, cooldown: 3.2, expr: S(call("gamma", add(X, num(1)))) }),
  R({ id: "Si", name: "Si", latex: "\\operatorname{Si}(x)", category: "Special", color: "#1565c0", hp: 80, attack: 7, cooldown: 3, expr: S(call("Si", X)) }),
  R({ id: "Ci", name: "Ci", latex: "\\operatorname{Ci}(x)", category: "Special", color: "#0d47a1", hp: 72, attack: 8, cooldown: 3.1, expr: S(call("Ci", X)) }),
  R({ id: "fresnelS", name: "S(x)", latex: "S(x)", category: "Special", color: "#ef6c00", hp: 76, attack: 8, cooldown: 3, expr: S(call("fresnelS", X)) }),
  R({ id: "fresnelC", name: "C(x)", latex: "C(x)", category: "Special", color: "#e65100", hp: 76, attack: 8, cooldown: 3, expr: S(call("fresnelC", X)) }),

  R({ id: "circle", name: "circle", latex: "x^{2}+y^{2}=1", category: "Parametric", color: "#c62828", hp: 88, attack: 10, cooldown: 3.2, plot: "circle" }),
  R({ id: "heart", name: "heart", latex: "\\heartsuit", category: "Parametric", color: "#d81b60", hp: 86, attack: 10, cooldown: 3.3, plot: "heart" }),
];

const BY_ID = new Map(ROSTER.map((e) => [e.id, e]));

export function getEntry(id: string): RosterEntry {
  return BY_ID.get(id) ?? BY_ID.get("x")!;
}

export const DEFAULTS = {
  left: "tan",
  right: "inv",
  target: "x3",
  boss: "sin2",
  challengers: ["tan", "exp", "ln", "sqrt2"],
};
