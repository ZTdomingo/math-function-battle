import { ci, digamma, erf, fresnelC, fresnelS, gamma, si, trigamma } from "./special";

export type FnName =
  | "sin" | "cos" | "tan" | "sec" | "csc" | "cot"
  | "asin" | "acos" | "atan"
  | "sinh" | "cosh" | "tanh" | "sech" | "csch" | "coth"
  | "asinh" | "acosh" | "atanh"
  | "exp" | "ln" | "log10" | "log2"
  | "sqrt" | "cbrt" | "abs" | "sign" | "floor" | "ceil"
  | "sinc" | "erf" | "Si" | "Ci" | "gamma" | "digamma" | "trigamma" | "heaviside" | "dirac"
  | "fresnelS" | "fresnelC" | "sigmoid";

export type Expr =
  | { t: "n"; v: number }
  | { t: "x" }
  | { t: "add"; xs: Expr[] }
  | { t: "mul"; xs: Expr[] }
  | { t: "pow"; b: Expr; e: number }
  | { t: "fn"; f: FnName; u: Expr }
  | { t: "int"; u: Expr };

export const EX: Expr = { t: "x" };
export const num = (v: number): Expr => ({ t: "n", v });
export const add = (...xs: Expr[]): Expr => ({ t: "add", xs });
export const mul = (...xs: Expr[]): Expr => ({ t: "mul", xs });
export const pow = (b: Expr, e: number): Expr => ({ t: "pow", b, e });
export const call = (f: FnName, u: Expr): Expr => ({ t: "fn", f, u });
export const neg = (u: Expr): Expr => mul(num(-1), u);

const N0: Expr = { t: "n", v: 0 };
const N1: Expr = { t: "n", v: 1 };

export function snap(v: number): number {
  if (!Number.isFinite(v)) return v;
  if (Math.abs(v) < 1e-10) return 0;
  if (Math.abs(v - Math.round(v)) < 1e-8) return Math.round(v);
  for (let d = 2; d <= 16; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v - n / d) < 1e-8) return n / d;
  }
  return Math.round(v * 1e8) / 1e8;
}

type Atom =
  | { k: "x"; e: number }
  | { k: "fn"; f: FnName; u: Expr; e: number }
  | { k: "op"; expr: Expr; e: number };

interface Term {
  coeff: number;
  atoms: Atom[];
}

function atomSortKey(a: Atom): string {
  if (a.k === "x") return `0:${a.e.toFixed(6)}`;
  if (a.k === "fn") return `1:${a.f}:${canon(a.u)}:${a.e.toFixed(6)}`;
  return `2:${canon(a.expr)}:${a.e.toFixed(6)}`;
}

function sortAtoms(atoms: Atom[]): Atom[] {
  return [...atoms].sort((a, b) => atomSortKey(a).localeCompare(atomSortKey(b)));
}

function atomKey(atoms: Atom[]): string {
  return sortAtoms(atoms).map(atomSortKey).join("*");
}

function canon(e: Expr): string {
  switch (e.t) {
    case "n":
      return `n${snap(e.v)}`;
    case "x":
      return "x";
    case "add":
      return `+(${e.xs.map(canon).join(",")})`;
    case "mul":
      return `*(${e.xs.map(canon).join(",")})`;
    case "pow":
      return `^(${canon(e.b)},${e.e})`;
    case "fn":
      return `${e.f}(${canon(e.u)})`;
    case "int":
      return `int(${canon(e.u)})`;
  }
}

export function exprKey(e: Expr): string {
  return canon(simplify(e));
}

function termToExpr(term: Term): Expr {
  const factors: Expr[] = [];
  const c = snap(term.coeff);
  const atoms = sortAtoms(term.atoms).filter((a) => Math.abs(a.e) > 1e-12);
  if (atoms.length === 0) return num(c);
  if (Math.abs(c - 1) > 1e-12) factors.push(num(c));
  for (const a of atoms) factors.push(atomToExpr(a));
  if (factors.length === 1) return factors[0];
  return { t: "mul", xs: factors };
}

function atomToExpr(a: Atom): Expr {
  if (a.k === "x") {
    if (Math.abs(a.e - 1) < 1e-12) return EX;
    return { t: "pow", b: EX, e: a.e };
  }
  if (a.k === "fn") {
    const base = call(a.f, a.u);
    if (Math.abs(a.e - 1) < 1e-12) return base;
    return { t: "pow", b: base, e: a.e };
  }
  if (Math.abs(a.e - 1) < 1e-12) return a.expr;
  return { t: "pow", b: a.expr, e: a.e };
}

function rebuild(terms: Term[]): Expr {
  const merged = merge(terms);
  if (merged.length === 0) return N0;
  if (merged.length === 1) return termToExpr(merged[0]);
  return { t: "add", xs: merged.map(termToExpr) };
}

function xDegree(atoms: Atom[]): number {
  let d = 0;
  let any = false;
  for (const a of atoms) {
    if (a.k === "x") {
      d += a.e;
      any = true;
    }
  }
  return any ? d : -1000;
}

function merge(terms: Term[]): Term[] {
  const map = new Map<string, Term>();
  for (const raw of terms) {
    const reduced = reduceTerm(raw);
    for (const t of reduced) {
      const c = snap(t.coeff);
      if (!Number.isFinite(c) || Math.abs(c) < 1e-10) continue;
      const atoms = sortAtoms(t.atoms).filter((a) => Math.abs(a.e) > 1e-12);
      const k = atomKey(atoms);
      const prev = map.get(k);
      if (prev) prev.coeff = snap(prev.coeff + c);
      else map.set(k, { coeff: c, atoms });
    }
  }
  const out: Term[] = [];
  for (const t of map.values()) {
    if (Math.abs(t.coeff) >= 1e-10) out.push(t);
  }
  out.sort((a, b) => {
    const d = xDegree(b.atoms) - xDegree(a.atoms);
    if (Math.abs(d) > 1e-9) return d;
    return atomKey(a.atoms).localeCompare(atomKey(b.atoms));
  });
  return out;
}

/** sign(x)/|x| = 1/x, and drop zero exponents. */
function reduceTerm(term: Term): Term[] {
  let atoms = term.atoms.map((a) => ({ ...a })) as Atom[];
  let coeff = term.coeff;
  let guard = 0;
  while (guard++ < 4) {
    const signIdx = atoms.findIndex((a) => a.k === "fn" && a.f === "sign" && Math.abs(a.e - 1) < 1e-12);
    if (signIdx < 0) break;
    const s = atoms[signIdx];
    if (s.k !== "fn") break;
    const absIdx = atoms.findIndex(
      (a) => a.k === "fn" && a.f === "abs" && Math.abs(a.e + 1) < 1e-12 && canon(a.u) === canon(s.u),
    );
    if (absIdx < 0) break;
    atoms = atoms.filter((_, i) => i !== signIdx && i !== absIdx);
    const inv = powOne(s.u, -1);
    coeff = snap(coeff * inv.coeff);
    atoms = mulAtoms(atoms, inv.atoms);
  }
  return [{ coeff, atoms }];
}

function powOne(u: Expr, p: number): Term {
  const base = norm(u);
  if (base.length === 1) {
    const [t] = powTerm(base[0], p);
    return t;
  }
  return { coeff: 1, atoms: [{ k: "op", expr: { t: "pow", b: rebuild(base), e: p }, e: 1 }] };
}

function mulAtoms(a: Atom[], b: Atom[]): Atom[] {
  const out: Atom[] = a.map((x) => ({ ...x })) as Atom[];
  for (const atom of b) {
    let found = false;
    for (const o of out) {
      if (o.k === "x" && atom.k === "x") {
        o.e += atom.e;
        found = true;
        break;
      }
      if (o.k === "fn" && atom.k === "fn" && o.f === atom.f && canon(o.u) === canon(atom.u)) {
        o.e += atom.e;
        found = true;
        break;
      }
      if (o.k === "op" && atom.k === "op" && canon(o.expr) === canon(atom.expr)) {
        o.e += atom.e;
        found = true;
        break;
      }
    }
    if (!found) out.push({ ...atom });
  }
  return out.filter((a) => Math.abs(a.e) > 1e-12);
}

function mulTermLists(a: Term[], b: Term[]): Term[] {
  const out: Term[] = [];
  for (const i of a) {
    for (const j of b) {
      const c = snap(i.coeff * j.coeff);
      if (!Number.isFinite(c) || c === 0) continue;
      out.push({ coeff: c, atoms: mulAtoms(i.atoms, j.atoms) });
    }
  }
  return out;
}

function powTerm(term: Term, p: number): Term[] {
  if (Math.abs(p) < 1e-15) return [{ coeff: 1, atoms: [] }];
  if (Math.abs(p) > 16) {
    return [{ coeff: 1, atoms: [{ k: "op", expr: { t: "pow", b: termToExpr(term), e: p }, e: 1 }] }];
  }
  if (term.atoms.length === 0) {
    if (term.coeff < 0 && Math.abs(p - Math.round(p)) > 1e-9) {
      return [{ coeff: 1, atoms: [{ k: "op", expr: { t: "pow", b: num(term.coeff), e: p }, e: 1 }] }];
    }
    const c = term.coeff ** p;
    if (!Number.isFinite(c)) return [{ coeff: 1, atoms: [{ k: "op", expr: num(term.coeff), e: p }] }];
    return [{ coeff: snap(c), atoms: [] }];
  }
  if (term.coeff < 0 && Math.abs(p - Math.round(p)) > 1e-9) {
    return [{ coeff: 1, atoms: [{ k: "op", expr: { t: "pow", b: termToExpr(term), e: p }, e: 1 }] }];
  }
  const c = term.coeff ** p;
  if (!Number.isFinite(c)) {
    return [{ coeff: 1, atoms: [{ k: "op", expr: { t: "pow", b: termToExpr(term), e: p }, e: 1 }] }];
  }
  return [{ coeff: snap(c), atoms: term.atoms.map((a) => ({ ...a, e: a.e * p })) as Atom[] }];
}

function expandPow(terms: Term[], p: number): Term[] {
  const n = Math.round(p);
  if (n === 0) return [{ coeff: 1, atoms: [] }];
  let acc: Term[] = [{ coeff: 1, atoms: [] }];
  for (let i = 0; i < n; i++) {
    acc = mulTermLists(acc, terms);
    if (acc.length > 48) {
      return [{ coeff: 1, atoms: [{ k: "op", expr: { t: "pow", b: rebuild(terms), e: n }, e: 1 }] }];
    }
  }
  return acc;
}

function norm(e: Expr): Term[] {
  switch (e.t) {
    case "n":
      return Math.abs(e.v) < 1e-12 ? [] : [{ coeff: snap(e.v), atoms: [] }];
    case "x":
      return [{ coeff: 1, atoms: [{ k: "x", e: 1 }] }];
    case "add": {
      let acc: Term[] = [];
      for (const x of e.xs) acc = acc.concat(norm(x));
      return merge(acc);
    }
    case "mul": {
      let acc: Term[] = [{ coeff: 1, atoms: [] }];
      for (const x of e.xs) acc = mulTermLists(acc, norm(x));
      return merge(acc);
    }
    case "pow": {
      const base = norm(e.b);
      const p = e.e;
      if (Math.abs(p - Math.round(p)) < 1e-9 && p >= 0 && p <= 8 && base.length >= 1) {
        return merge(expandPow(base, Math.round(p)));
      }
      if (base.length === 1) return merge(powTerm(base[0], p));
      if (base.length === 0) return [];
      return [{ coeff: 1, atoms: [{ k: "op", expr: { t: "pow", b: rebuild(base), e: p }, e: 1 }] }];
    }
    case "fn": {
      const u = rebuild(norm(e.u));
      return [{ coeff: 1, atoms: [{ k: "fn", f: e.f, u, e: 1 }] }];
    }
    case "int": {
      const u = rebuild(norm(e.u));
      return [{ coeff: 1, atoms: [{ k: "op", expr: { t: "int", u }, e: 1 }] }];
    }
  }
}

export function simplify(e: Expr): Expr {
  return rebuild(norm(e));
}

export function isZeroExpr(e: Expr): boolean {
  return norm(e).length === 0;
}

function diffRaw(e: Expr): Expr {
  switch (e.t) {
    case "n":
      return N0;
    case "x":
      return N1;
    case "add":
      return { t: "add", xs: e.xs.map(diffRaw) };
    case "mul":
      return {
        t: "add",
        xs: e.xs.map((_, i) => ({
          t: "mul" as const,
          xs: e.xs.map((f, j) => (j === i ? diffRaw(f) : f)),
        })),
      };
    case "pow": {
      if (Math.abs(e.e) < 1e-15) return N0;
      return { t: "mul", xs: [num(e.e), { t: "pow", b: e.b, e: e.e - 1 }, diffRaw(e.b)] };
    }
    case "fn":
      return diffFn(e.f, e.u);
    case "int":
      return e.u;
  }
}

function chain(outer: Expr, u: Expr): Expr {
  return mul(outer, diffRaw(u));
}

function diffFn(f: FnName, u: Expr): Expr {
  switch (f) {
    case "sin":
      return chain(call("cos", u), u);
    case "cos":
      return chain(neg(call("sin", u)), u);
    case "tan":
      return chain(pow(call("sec", u), 2), u);
    case "sec":
      return chain(mul(call("sec", u), call("tan", u)), u);
    case "csc":
      return chain(neg(mul(call("csc", u), call("cot", u))), u);
    case "cot":
      return chain(neg(pow(call("csc", u), 2)), u);
    case "asin":
      return chain(pow(add(N1, neg(pow(u, 2))), -0.5), u);
    case "acos":
      return chain(neg(pow(add(N1, neg(pow(u, 2))), -0.5)), u);
    case "atan":
      return chain(pow(add(N1, pow(u, 2)), -1), u);
    case "sinh":
      return chain(call("cosh", u), u);
    case "cosh":
      return chain(call("sinh", u), u);
    case "tanh":
      return chain(pow(call("sech", u), 2), u);
    case "sech":
      return chain(neg(mul(call("sech", u), call("tanh", u))), u);
    case "csch":
      return chain(neg(mul(call("csch", u), call("coth", u))), u);
    case "coth":
      return chain(neg(pow(call("csch", u), 2)), u);
    case "asinh":
      return chain(pow(add(pow(u, 2), N1), -0.5), u);
    case "acosh":
      return chain(pow(add(pow(u, 2), num(-1)), -0.5), u);
    case "atanh":
      return chain(pow(add(N1, neg(pow(u, 2))), -1), u);
    case "exp":
      return chain(call("exp", u), u);
    case "ln":
    case "log10":
    case "log2": {
      const scale = f === "ln" ? 1 : f === "log10" ? 1 / Math.LN10 : 1 / Math.LN2;
      return mul(num(scale), chain(pow(u, -1), u));
    }
    case "sqrt":
      return chain(mul(num(0.5), pow(u, -0.5)), u);
    case "cbrt":
      return chain(mul(num(1 / 3), pow(u, -2 / 3)), u);
    case "abs":
      return chain(call("sign", u), u);
    case "sign":
    case "floor":
    case "ceil":
    case "dirac":
      return N0;
    case "heaviside":
      return chain(call("dirac", u), u);
    case "sinc":
      return diffRaw(mul(call("sin", u), pow(u, -1)));
    case "erf":
      return chain(mul(num(2 / Math.sqrt(Math.PI)), call("exp", neg(pow(u, 2)))), u);
    case "Si":
      return chain(call("sinc", u), u);
    case "Ci":
      return chain(mul(call("cos", u), pow(u, -1)), u);
    case "gamma":
      return chain(mul(call("gamma", u), call("digamma", u)), u);
    case "digamma":
      return chain(call("trigamma", u), u);
    case "trigamma":
      return N0;
    case "sigmoid":
      return chain(mul(call("sigmoid", u), add(N1, neg(call("sigmoid", u)))), u);
    case "fresnelS":
      return chain(call("sin", mul(num(Math.PI / 2), pow(u, 2))), u);
    case "fresnelC":
      return chain(call("cos", mul(num(Math.PI / 2), pow(u, 2))), u);
    default:
      return N0;
  }
}

export function differentiate(e: Expr): Expr {
  return simplify(diffRaw(simplify(e)));
}

interface Linear {
  a: number;
  b: number;
}

function asLinear(e: Expr): Linear | null {
  const terms = norm(e);
  let a = 0;
  let b = 0;
  for (const t of terms) {
    if (t.atoms.length === 0) b += t.coeff;
    else if (t.atoms.length === 1 && t.atoms[0].k === "x" && Math.abs(t.atoms[0].e - 1) < 1e-9) a += t.coeff;
    else return null;
  }
  if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return null;
  return { a: snap(a), b: snap(b) };
}

function isXPow(atoms: Atom[], p: number): boolean {
  return atoms.length === 1 && atoms[0].k === "x" && Math.abs(atoms[0].e - p) < 1e-9;
}

function fnAtom(atoms: Atom[], f: FnName, exp = 1): Extract<Atom, { k: "fn" }> | null {
  if (atoms.length !== 1) return null;
  const a = atoms[0];
  if (a.k === "fn" && a.f === f && Math.abs(a.e - exp) < 1e-9) return a;
  return null;
}

function linearCall(f: FnName, lin: Linear): Expr {
  const u = rebuild(norm(add(mul(num(lin.a), EX), num(lin.b))));
  return call(f, u);
}

function integrateTerm(term: Term): Expr | null {
  const c = term.coeff;
  const atoms = term.atoms;
  if (atoms.length === 0) return mul(num(c), EX);

  if (atoms.length === 1 && atoms[0].k === "x") {
    const p = atoms[0].e;
    if (Math.abs(p + 1) < 1e-9) return mul(num(c), call("ln", call("abs", EX)));
    const np = p + 1;
    return mul(num(c / np), pow(EX, np));
  }

  const trig = (f: FnName, integral: FnName, sign: number) => {
    const a = fnAtom(atoms, f, 1);
    if (!a) return null;
    const lin = asLinear(a.u);
    if (!lin || Math.abs(lin.a) < 1e-12) return null;
    return mul(num((c * sign) / lin.a), linearCall(integral, lin));
  };

  const s = trig("sin", "cos", -1) ?? trig("cos", "sin", 1);
  if (s) return s;
  const sh = trig("sinh", "cosh", 1) ?? trig("cosh", "sinh", 1);
  if (sh) return sh;

  const expA = fnAtom(atoms, "exp", 1);
  if (expA && atoms.length === 1) {
    const lin = asLinear(expA.u);
    if (lin && Math.abs(lin.a) > 1e-12) return mul(num(c / lin.a), linearCall("exp", lin));
    const quad = asQuadMonomial(expA.u);
    if (quad && Math.abs(quad.k + 1) < 1e-9 && Math.abs(quad.pow - 2) < 1e-9) {
      return mul(num(c * Math.sqrt(Math.PI) / 2), call("erf", EX));
    }
  }

  // ∫ x * exp(k x^n) — n = 2 handled
  if (atoms.length === 2) {
    const xAt = atoms.find((a) => a.k === "x" && Math.abs(a.e - 1) < 1e-9);
    const eAt = atoms.find((a) => a.k === "fn" && a.f === "exp" && Math.abs(a.e - 1) < 1e-9) as
      | Extract<Atom, { k: "fn" }>
      | undefined;
    if (xAt && eAt) {
      const quad = asQuadMonomial(eAt.u);
      if (quad && Math.abs(quad.pow - 2) < 1e-9 && Math.abs(quad.k) > 1e-12) {
        return mul(num(c / (2 * quad.k)), call("exp", eAt.u));
      }
    }
    // sinc: sin(x) / x
    const sinA = atoms.find((a) => a.k === "fn" && a.f === "sin" && Math.abs(a.e - 1) < 1e-9) as
      | Extract<Atom, { k: "fn" }>
      | undefined;
    const inv = atoms.find((a) => a.k === "x" && Math.abs(a.e + 1) < 1e-9);
    if (sinA && inv && canon(sinA.u) === "x") return mul(num(c), call("Si", EX));
  }

  const sec2 = fnAtom(atoms, "sec", 2);
  if (sec2) {
    const lin = asLinear(sec2.u);
    if (lin && Math.abs(lin.a) > 1e-12) return mul(num(c / lin.a), linearCall("tan", lin));
  }
  const csc2 = fnAtom(atoms, "csc", 2);
  if (csc2) {
    const lin = asLinear(csc2.u);
    if (lin && Math.abs(lin.a) > 1e-12) return mul(num(-c / lin.a), linearCall("cot", lin));
  }
  const sech2 = fnAtom(atoms, "sech", 2);
  if (sech2) {
    const lin = asLinear(sech2.u);
    if (lin && Math.abs(lin.a) > 1e-12) return mul(num(c / lin.a), linearCall("tanh", lin));
  }

  // 1/(1+x^2), 1/sqrt(1-x^2), etc. are often a single opaque or pow atom.
  const rebuilt = termToExpr(term);
  const classic = integrateClassic(rebuilt);
  if (classic) return mul(num(1), classic);
  return null;
}

function asQuadMonomial(e: Expr): { k: number; pow: number } | null {
  const terms = norm(e);
  if (terms.length !== 1) return null;
  const t = terms[0];
  if (t.atoms.length === 1 && t.atoms[0].k === "x") return { k: t.coeff, pow: t.atoms[0].e };
  return null;
}

function integrateClassic(e: Expr): Expr | null {
  // Patterns on an already-simplified single expression, coefficient included.
  const terms = norm(e);
  if (terms.length !== 1) return null;
  const t = terms[0];
  if (t.atoms.length !== 1 || t.atoms[0].k !== "op") return null;
  const op = t.atoms[0];
  if (op.expr.t !== "pow") return null;
  const baseTerms = norm(op.expr.b);
  const p = op.expr.e;
  // (1+x^2)^{-1}
  if (Math.abs(p + 1) < 1e-9 && isOnePlusX2(baseTerms)) return mul(num(t.coeff), call("atan", EX));
  // (1-x^2)^{-1/2}
  if (Math.abs(p + 0.5) < 1e-9 && isOneMinusX2(baseTerms)) return mul(num(t.coeff), call("asin", EX));
  // (1+x^2)^{-1/2}
  if (Math.abs(p + 0.5) < 1e-9 && isOnePlusX2(baseTerms)) return mul(num(t.coeff), call("asinh", EX));
  // (x^2-1)^{-1/2}
  if (Math.abs(p + 0.5) < 1e-9 && isX2MinusOne(baseTerms)) return mul(num(t.coeff), call("acosh", EX));
  // (1-x^2)^{-1}
  if (Math.abs(p + 1) < 1e-9 && isOneMinusX2(baseTerms)) return mul(num(t.coeff), call("atanh", EX));
  return null;
}

function isOnePlusX2(terms: Term[]): boolean {
  if (terms.length !== 2) return false;
  const has1 = terms.some((t) => t.atoms.length === 0 && Math.abs(t.coeff - 1) < 1e-9);
  const hasX2 = terms.some((t) => isXPow(t.atoms, 2) && Math.abs(t.coeff - 1) < 1e-9);
  return has1 && hasX2;
}
function isOneMinusX2(terms: Term[]): boolean {
  if (terms.length !== 2) return false;
  const has1 = terms.some((t) => t.atoms.length === 0 && Math.abs(t.coeff - 1) < 1e-9);
  const hasX2 = terms.some((t) => isXPow(t.atoms, 2) && Math.abs(t.coeff + 1) < 1e-9);
  return has1 && hasX2;
}
function isX2MinusOne(terms: Term[]): boolean {
  if (terms.length !== 2) return false;
  const has1 = terms.some((t) => t.atoms.length === 0 && Math.abs(t.coeff + 1) < 1e-9);
  const hasX2 = terms.some((t) => isXPow(t.atoms, 2) && Math.abs(t.coeff - 1) < 1e-9);
  return has1 && hasX2;
}

export function integrate(e: Expr): Expr {
  const terms = norm(simplify(e));
  if (terms.length === 0) return N0;
  const parts: Expr[] = [];
  for (const t of terms) {
    const part = integrateTerm(t);
    if (!part) parts.push({ t: "int", u: termToExpr(t) });
    else parts.push(part);
  }
  return simplify(parts.length === 1 ? parts[0] : { t: "add", xs: parts });
}

function intPow(base: number, p: number): number | null {
  if (Math.abs(base) < 1e-12 && p < 0) return null;
  if (Math.abs(p - Math.round(p)) < 1e-9) {
    const r = Math.round(p);
    if (r === 0) return 1;
    if (r > 0) {
      const y = base ** r;
      return Number.isFinite(y) ? y : null;
    }
    const y = 1 / base ** -r;
    return Number.isFinite(y) ? y : null;
  }
  if (base < 0) return null;
  const y = base ** p;
  return Number.isFinite(y) ? y : null;
}

export function evalExpr(e: Expr, x: number): number | null {
  switch (e.t) {
    case "n":
      return e.v;
    case "x":
      return x;
    case "add": {
      let s = 0;
      for (const p of e.xs) {
        const y = evalExpr(p, x);
        if (y === null) return null;
        s += y;
      }
      return Number.isFinite(s) ? s : null;
    }
    case "mul": {
      let s = 1;
      for (const p of e.xs) {
        const y = evalExpr(p, x);
        if (y === null) return null;
        s *= y;
      }
      return Number.isFinite(s) ? s : null;
    }
    case "pow": {
      const b = evalExpr(e.b, x);
      if (b === null) return null;
      return intPow(b, e.e);
    }
    case "fn":
      return evalFn(e.f, e.u, x);
    case "int":
      return evalIntegral(e.u, x);
  }
}

const integralCache = new WeakMap<Expr, Map<number, number | null>>();

function evalIntegral(u: Expr, x: number): number | null {
  let cache = integralCache.get(u);
  if (!cache) {
    cache = new Map();
    integralCache.set(u, cache);
  }
  const key = Math.round(x * 200);
  if (cache.has(key)) return cache.get(key) ?? null;
  // Cumulative trapezoid from 0, reusing nearby cache when possible.
  const steps = Math.max(4, Math.min(80, Math.ceil(Math.abs(x) * 16)));
  let acc = 0;
  let prevX = 0;
  let prevY = evalExpr(u, 0);
  if (prevY === null) prevY = 0;
  for (let i = 1; i <= steps; i++) {
    const cx = (x * i) / steps;
    const y = evalExpr(u, cx);
    if (y === null || prevY === null) {
      prevX = cx;
      prevY = y;
      continue;
    }
    acc += ((y + prevY) / 2) * (cx - prevX);
    prevX = cx;
    prevY = y;
  }
  if (!Number.isFinite(acc)) {
    cache.set(key, null);
    return null;
  }
  cache.set(key, acc);
  return acc;
}

function evalFn(f: FnName, u: Expr, x: number): number | null {
  if (f === "sinc") {
    const v = evalExpr(u, x);
    if (v === null) return null;
    if (Math.abs(v) < 1e-8) return 1;
    return Math.sin(v) / v;
  }
  const v = evalExpr(u, x);
  if (v === null || !Number.isFinite(v)) return null;
  switch (f) {
    case "sin":
      return Math.sin(v);
    case "cos":
      return Math.cos(v);
    case "tan":
      if (Math.abs(Math.cos(v)) < 0.02) return null;
      return Math.tan(v);
    case "sec": {
      const c = Math.cos(v);
      if (Math.abs(c) < 0.02) return null;
      return 1 / c;
    }
    case "csc": {
      const s = Math.sin(v);
      if (Math.abs(s) < 0.02) return null;
      return 1 / s;
    }
    case "cot": {
      const s = Math.sin(v);
      if (Math.abs(s) < 0.02) return null;
      return Math.cos(v) / s;
    }
    case "asin":
      return v >= -1 && v <= 1 ? Math.asin(v) : null;
    case "acos":
      return v >= -1 && v <= 1 ? Math.acos(v) : null;
    case "atan":
      return Math.atan(v);
    case "sinh":
      return Math.sinh(v);
    case "cosh":
      return Math.cosh(v);
    case "tanh":
      return Math.tanh(v);
    case "sech":
      return 1 / Math.cosh(v);
    case "csch":
      return Math.abs(Math.sinh(v)) < 1e-6 ? null : 1 / Math.sinh(v);
    case "coth":
      return Math.abs(Math.tanh(v)) < 1e-6 ? null : 1 / Math.tanh(v);
    case "asinh":
      return Math.asinh(v);
    case "acosh":
      return v >= 1 ? Math.acosh(v) : null;
    case "atanh":
      return v > -1 && v < 1 ? Math.atanh(v) : null;
    case "exp":
      return Math.abs(v) > 40 ? null : Math.exp(v);
    case "ln":
      return v > 1e-8 ? Math.log(v) : null;
    case "log10":
      return v > 1e-8 ? Math.log(v) / Math.LN10 : null;
    case "log2":
      return v > 1e-8 ? Math.log(v) / Math.LN2 : null;
    case "sqrt":
      return v >= 0 ? Math.sqrt(v) : null;
    case "cbrt":
      return Math.cbrt(v);
    case "abs":
      return Math.abs(v);
    case "sign":
      return Math.sign(v);
    case "floor":
      return Math.floor(v);
    case "ceil":
      return Math.ceil(v);
    case "erf":
      return erf(v);
    case "Si":
      return si(v);
    case "Ci":
      return ci(v);
    case "gamma":
      return gamma(v);
    case "digamma":
      return digamma(v);
    case "trigamma":
      return trigamma(v);
    case "heaviside":
      return v >= 0 ? 1 : 0;
    case "dirac":
      return null;
    case "fresnelS":
      return fresnelS(v);
    case "fresnelC":
      return fresnelC(v);
    case "sigmoid": {
      if (v > 40) return 1;
      if (v < -40) return 0;
      return 1 / (1 + Math.exp(-v));
    }
    default:
      return null;
  }
}

const FN_LATEX: Record<FnName, string> = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
  sec: "\\sec",
  csc: "\\csc",
  cot: "\\cot",
  asin: "\\arcsin",
  acos: "\\arccos",
  atan: "\\arctan",
  sinh: "\\sinh",
  cosh: "\\cosh",
  tanh: "\\tanh",
  sech: "\\operatorname{sech}",
  csch: "\\operatorname{csch}",
  coth: "\\coth",
  asinh: "\\operatorname{asinh}",
  acosh: "\\operatorname{acosh}",
  atanh: "\\operatorname{atanh}",
  exp: "e",
  ln: "\\ln",
  log10: "\\log_{10}",
  log2: "\\log_{2}",
  sqrt: "\\sqrt",
  cbrt: "\\sqrt[3]",
  abs: "abs",
  sign: "\\operatorname{sgn}",
  floor: "floor",
  ceil: "ceil",
  sinc: "\\operatorname{sinc}",
  erf: "\\operatorname{erf}",
  Si: "\\operatorname{Si}",
  Ci: "\\operatorname{Ci}",
  gamma: "\\Gamma",
  digamma: "\\psi",
  trigamma: "\\psi_{1}",
  heaviside: "H",
  dirac: "\\delta",
  fresnelS: "S",
  fresnelC: "C",
  sigmoid: "\\sigma",
};

const FN_SHORT: Record<FnName, string> = {
  sin: "sin",
  cos: "cos",
  tan: "tan",
  sec: "sec",
  csc: "csc",
  cot: "cot",
  asin: "asin",
  acos: "acos",
  atan: "atan",
  sinh: "sinh",
  cosh: "cosh",
  tanh: "tanh",
  sech: "sech",
  csch: "csch",
  coth: "coth",
  asinh: "asinh",
  acosh: "acosh",
  atanh: "atanh",
  exp: "e",
  ln: "ln",
  log10: "log10",
  log2: "log2",
  sqrt: "√",
  cbrt: "∛",
  abs: "abs",
  sign: "sgn",
  floor: "floor",
  ceil: "ceil",
  sinc: "sinc",
  erf: "erf",
  Si: "Si",
  Ci: "Ci",
  gamma: "Γ",
  digamma: "ψ",
  trigamma: "ψ₁",
  heaviside: "H",
  dirac: "δ",
  fresnelS: "S",
  fresnelC: "C",
  sigmoid: "σ",
};

const SUP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
  ".": "·",
};

function superscript(n: number): string {
  const s = String(snap(n));
  return [...s].map((ch) => SUP[ch] ?? ch).join("");
}

function prettyConst(v: number, latex: boolean): string | null {
  const items: [number, string, string][] = [
    [Math.PI, "\\pi", "π"],
    [Math.E, "e", "e"],
    [Math.SQRT2, "\\sqrt{2}", "√2"],
    [(1 + Math.sqrt(5)) / 2, "\\varphi", "φ"],
    [Math.LN2, "\\ln 2", "ln2"],
    [Math.LN10, "\\ln 10", "ln10"],
    [Math.SQRT2 / 2, "\\frac{\\sqrt{2}}{2}", "√2/2"],
  ];
  for (const [n, l, u] of items) {
    if (Math.abs(v - n) < 1e-8) return latex ? l : u;
    if (Math.abs(v + n) < 1e-8) return latex ? `-${l}` : `-${u}`;
  }
  for (const [a, b] of [
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 6],
    [2, 3],
    [3, 2],
    [3, 4],
    [5, 6],
  ] as const) {
    if (Math.abs(v - (a * Math.PI) / b) < 1e-8) {
      return latex ? (a === 1 ? `\\frac{\\pi}{${b}}` : `\\frac{${a}\\pi}{${b}}`) : `${a}π/${b}`;
    }
    if (Math.abs(v + (a * Math.PI) / b) < 1e-8) {
      return latex ? (a === 1 ? `-\\frac{\\pi}{${b}}` : `-\\frac{${a}\\pi}{${b}}`) : `-${a}π/${b}`;
    }
  }
  return null;
}

function latexNum(v: number): string {
  const known = prettyConst(v, true);
  if (known) return known;
  const s = snap(v);
  if (Math.abs(s - Math.round(s)) < 1e-9) return String(Math.round(s));
  for (let d = 2; d <= 16; d++) {
    const n = Math.round(s * d);
    if (Math.abs(s - n / d) < 1e-8) {
      const sign = n < 0 ? "-" : "";
      return `${sign}\\frac{${Math.abs(n)}}{${d}}`;
    }
  }
  return String(Math.round(s * 1000) / 1000);
}

function shortNum(v: number): string {
  const known = prettyConst(v, false);
  if (known) return known;
  const s = snap(v);
  if (Math.abs(s - Math.round(s)) < 1e-9) return String(Math.round(s));
  const map: Record<string, string> = {
    "0.5": "½",
    "0.25": "¼",
    "0.75": "¾",
    "0.2": "⅕",
    "0.125": "⅛",
    [String(snap(1 / 3))]: "⅓",
    [String(snap(2 / 3))]: "⅔",
  };
  const sign = s < 0 ? "-" : "";
  const hit = map[String(Math.abs(s))];
  if (hit) return sign + hit;
  return String(Math.round(s * 1000) / 1000);
}

function needsParens(e: Expr): boolean {
  return e.t === "add" || (e.t === "n" && e.v < 0) || (e.t === "mul" && e.xs[0]?.t === "n" && e.xs[0].v < 0);
}

function isSimpleArg(e: Expr): boolean {
  if (e.t === "x") return true;
  if (e.t === "n") return true;
  if (e.t === "mul" && e.xs.length === 2 && e.xs[0].t === "n" && e.xs[1].t === "x") return true;
  if (e.t === "pow" && e.b.t === "x") return true;
  return false;
}

export function toLatex(e: Expr): string {
  return latex(simplify(e));
}

function latex(e: Expr): string {
  switch (e.t) {
    case "n":
      return latexNum(e.v);
    case "x":
      return "x";
    case "add": {
      if (e.xs.length === 0) return "0";
      let s = latex(e.xs[0]);
      for (let i = 1; i < e.xs.length; i++) {
        const p = latex(e.xs[i]);
        s += p.startsWith("-") ? p : `+${p}`;
      }
      return s;
    }
    case "mul":
      return latexMul(e.xs);
    case "pow":
      return latexPow(e.b, e.e);
    case "fn":
      return latexFn(e.f, e.u, 1);
    case "int":
      return `\\int ${needsParens(e.u) ? `(${latex(e.u)})` : latex(e.u)}\\,dx`;
  }
}

function latexMul(xs: Expr[]): string {
  if (xs.length === 0) return "1";
  let i = 0;
  let coeff = "";
  if (xs[0].t === "n") {
    const v = xs[0].v;
    if (xs.length === 1) return latexNum(v);
    if (Math.abs(v + 1) < 1e-9) coeff = "-";
    else if (Math.abs(v - 1) > 1e-9) {
      coeff = latexNum(v);
      if (/\\ln|\\sqrt|\\frac\{\\sqrt/.test(coeff)) coeff = `(${coeff})`;
    }
    i = 1;
  }
  let body = "";
  for (; i < xs.length; i++) body += latexFactor(xs[i]);
  return coeff + body;
}

function latexFactor(e: Expr): string {
  if (e.t === "add" || (e.t === "n" && e.v < 0) || (e.t === "mul" && e.xs[0]?.t === "n" && (e.xs[0] as { v: number }).v < 0)) {
    return `(${latex(e)})`;
  }
  if (e.t === "pow") return latexPow(e.b, e.e);
  if (e.t === "fn") return latexFn(e.f, e.u, 1);
  return latex(e);
}

function latexPow(b: Expr, e: number): string {
  if (Math.abs(e) < 1e-12) return "1";
  if (Math.abs(e - 1) < 1e-12) return latex(b);
  if (b.t === "fn" && Math.abs(e - Math.round(e)) < 1e-9 && e > 0 && e <= 6 && isOperatorName(b.f)) {
    return latexFn(b.f, b.u, Math.round(e));
  }
  if (Math.abs(e + 1) < 1e-9) {
    return `\\frac{1}{${latexDenom(b)}}`;
  }
  if (Math.abs(e + 0.5) < 1e-9) return `\\frac{1}{\\sqrt{${latex(b)}}}`;
  if (Math.abs(e - 0.5) < 1e-9) return `\\sqrt{${latex(b)}}`;
  if (Math.abs(e - 1 / 3) < 1e-9) return `\\sqrt[3]{${latex(b)}}`;
  const base = b.t === "x" || b.t === "n" || (b.t === "fn" && isSimpleArg(b.u)) ? latex(b) : `(${latex(b)})`;
  const exp = latexNum(e);
  const expBody = exp.startsWith("-") || exp.includes("frac") ? `{${exp}}` : exp.length === 1 ? exp : `{${exp}}`;
  return `${base}^{${expBody}}`;
}

function latexDenom(b: Expr): string {
  if (b.t === "x" || b.t === "n") return latex(b);
  if (b.t === "fn") return latex(b);
  if (b.t === "pow" && b.e > 0) return latex(b);
  return `(${latex(b)})`;
}

function isOperatorName(f: FnName): boolean {
  return [
    "sin", "cos", "tan", "sec", "csc", "cot", "sinh", "cosh", "tanh", "sech", "csch", "coth",
  ].includes(f);
}

function latexFn(f: FnName, u: Expr, power: number): string {
  const powMark = power === 1 ? "" : `^{${power}}`;
  if (f === "exp") {
    const arg = latex(u);
    return power === 1 ? `e^{${arg}}` : `(e^{${arg}})^{${power}}`;
  }
  if ((f === "ln" || f === "log10" || f === "log2") && u.t === "fn" && u.f === "abs") {
    return `${FN_LATEX[f]}${power === 1 ? "" : `^{${power}}`} \\left|${latex(u.u)}\\right|`;
  }
  if (f === "sqrt") return `\\sqrt{${latex(u)}}`;
  if (f === "cbrt") return `\\sqrt[3]{${latex(u)}}`;
  if (f === "abs") return `\\left|${latex(u)}\\right|`;
  if (f === "floor") return `\\lfloor ${latex(u)} \\rfloor`;
  if (f === "ceil") return `\\lceil ${latex(u)} \\rceil`;
  const name = FN_LATEX[f];
  const arg = latexArg(u);
  if (isOperatorName(f) || f === "ln" || f === "log10" || f === "log2") return `${name}${powMark} ${arg}`;
  return `${name}${powMark}\\!\\left(${latex(u)}\\right)`;
}

function latexArg(u: Expr): string {
  if (isSimpleArg(u) && u.t !== "pow") return latex(u);
  if (u.t === "pow" && u.b.t === "x" && u.e > 0 && u.e <= 4 && Number.isInteger(u.e)) return `(${latex(u)})`;
  return `\\left(${latex(u)}\\right)`;
}

export function toShort(e: Expr): string {
  return short(simplify(e));
}

function short(e: Expr): string {
  switch (e.t) {
    case "n":
      return shortNum(e.v);
    case "x":
      return "x";
    case "add": {
      if (e.xs.length === 0) return "0";
      let s = short(e.xs[0]);
      for (let i = 1; i < e.xs.length; i++) {
        const p = short(e.xs[i]);
        s += p.startsWith("-") ? p : `+${p}`;
      }
      return s;
    }
    case "mul":
      return shortMul(e.xs);
    case "pow":
      return shortPow(e.b, e.e);
    case "fn":
      return shortFn(e.f, e.u, 1);
    case "int":
      return `∫${short(e.u)}`;
  }
}

function shortMul(xs: Expr[]): string {
  if (xs.length === 0) return "1";
  let i = 0;
  let coeff = "";
  if (xs[0].t === "n") {
    const v = xs[0].v;
    if (xs.length === 1) return shortNum(v);
    if (Math.abs(v + 1) < 1e-9) coeff = "-";
    else if (Math.abs(v - 1) > 1e-9) coeff = shortNum(v);
    i = 1;
  }
  let body = "";
  for (; i < xs.length; i++) {
    const p = xs[i];
    if (p.t === "add" || (p.t === "mul" && p.xs[0]?.t === "n" && p.xs[0].v < 0)) body += `(${short(p)})`;
    else body += short(p);
  }
  return coeff + body;
}

function shortPow(b: Expr, e: number): string {
  if (Math.abs(e - 1) < 1e-9) return short(b);
  if (Math.abs(e - 0.5) < 1e-9) return `√${b.t === "x" || b.t === "n" ? short(b) : `(${short(b)})`}`;
  if (Math.abs(e + 1) < 1e-9) return `1/${b.t === "x" ? "x" : `(${short(b)})`}`;
  if (b.t === "fn" && isOperatorName(b.f) && Math.abs(e - Math.round(e)) < 1e-9) return shortFn(b.f, b.u, Math.round(e));
  const base = b.t === "x" || b.t === "n" ? short(b) : `(${short(b)})`;
  return `${base}${superscript(e)}`;
}

function shortFn(f: FnName, u: Expr, power: number): string {
  const mark = power === 1 ? "" : superscript(power);
  if (f === "exp") return power === 1 ? `e^${shortArg(u)}` : `(e^${shortArg(u)})${mark}`;
  if (f === "sqrt") return `√${shortArg(u)}`;
  if (f === "abs") return `|${short(u)}|`;
  const name = FN_SHORT[f];
  if (isOperatorName(f) || ["ln", "log10", "log2"].includes(f)) {
    return `${name}${mark} ${shortArg(u)}`;
  }
  return `${name}${mark}(${short(u)})`;
}

function shortArg(u: Expr): string {
  if (u.t === "x" || (u.t === "mul" && u.xs.length === 2 && u.xs[0].t === "n" && u.xs[1].t === "x")) return short(u);
  if (u.t === "n") return short(u);
  return `(${short(u)})`;
}

export interface PoleBreak {
  x: number;
}

/** x-values where a polyline must break: poles and jumps inside [-world, world]. */
export function discontinuityBreaks(e: Expr, world: number): number[] {
  const found: number[] = [];
  walkBreaks(simplify(e), world, found);
  found.sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of found) {
    if (x < -world - 1e-9 || x > world + 1e-9) continue;
    if (out.length === 0 || Math.abs(x - out[out.length - 1]) > 0.02) out.push(x);
  }
  return out;
}

function walkBreaks(e: Expr, world: number, out: number[]): void {
  switch (e.t) {
    case "n":
    case "x":
      return;
    case "add":
    case "mul":
      e.xs.forEach((x) => walkBreaks(x, world, out));
      return;
    case "pow":
      walkBreaks(e.b, world, out);
      if (e.e < 0) addZerosOf(e.b, world, out);
      return;
    case "int":
      walkBreaks(e.u, world, out);
      return;
    case "fn":
      walkBreaks(e.u, world, out);
      addFnBreaks(e.f, e.u, world, out);
  }
}

function addZerosOf(e: Expr, _world: number, out: number[]): void {
  const lin = asLinear(e);
  if (lin && Math.abs(lin.a) > 1e-9) {
    out.push(-lin.b / lin.a);
    return;
  }
  if (e.t === "x") out.push(0);
}

function addFnBreaks(f: FnName, u: Expr, world: number, out: number[]): void {
  const lin = asLinear(u);
  const pushSolved = (targets: number[]) => {
    if (!lin || Math.abs(lin.a) < 1e-9) return;
    for (const target of targets) out.push((target - lin.b) / lin.a);
  };
  if (f === "tan" || f === "sec") {
    const targets: number[] = [];
    for (let n = -8; n <= 8; n++) targets.push(Math.PI / 2 + n * Math.PI);
    pushSolved(targets);
  }
  if (f === "csc" || f === "cot" || f === "csch" || f === "coth") {
    const targets: number[] = [];
    for (let n = -8; n <= 8; n++) targets.push(n * Math.PI);
    pushSolved(targets);
  }
  if (f === "floor" || f === "ceil") {
    if (lin && Math.abs(lin.a) > 1e-9) {
      for (let k = -12; k <= 12; k++) out.push((k - lin.b) / lin.a);
    } else {
      for (let k = Math.ceil(-world); k <= Math.floor(world); k++) out.push(k);
    }
  }
  if (f === "sign" || f === "heaviside" || f === "dirac") {
    pushSolved([0]);
    if (u.t === "x") out.push(0);
  }
  if (f === "gamma" || f === "digamma" || f === "trigamma") {
    const targets: number[] = [];
    for (let k = 0; k >= -10; k--) targets.push(k);
    pushSolved(targets);
  }
  if (f === "ln" || f === "log10" || f === "log2" || f === "Ci") {
    pushSolved([0]);
  }
  if (f === "atanh") {
    pushSolved([-1, 1]);
  }
}

/** If the expression is c·δ(x), return c so the plotter can draw a spike instead of a gap. */
export function diracScale(e: Expr): number | null {
  const terms = norm(simplify(e));
  if (terms.length !== 1 || terms[0].atoms.length !== 1) return null;
  const a = terms[0].atoms[0];
  if (a.k !== "fn" || a.f !== "dirac" || Math.abs(a.e - 1) > 1e-9) return null;
  const lin = asLinear(a.u);
  if (!lin || Math.abs(lin.a - 1) > 1e-9 || Math.abs(lin.b) > 1e-9) return null;
  return terms[0].coeff;
}

/** Drop a numeric coefficient so replica balls can read x² while the HUD reads 3x². */
export function toShortUnit(e: Expr): string {
  const s = simplify(e);
  if (s.t === "n") return s.v < 0 ? "-1" : "1";
  if (s.t === "mul" && s.xs[0].t === "n" && s.xs.length > 1) {
    const sign = s.xs[0].v < 0 ? "-" : "";
    const rest = s.xs.slice(1);
    const body: Expr = rest.length === 1 ? rest[0] : { t: "mul", xs: rest };
    return sign + toShort(body);
  }
  return toShort(s);
}

export function monomialPieces(e: Expr): number {
  const terms = norm(simplify(e));
  if (terms.length !== 1) return 1;
  const t = terms[0];
  const c = Math.round(t.coeff);
  if (Math.abs(t.coeff - c) > 1e-6) return 1;
  const abs = Math.abs(c);
  if (abs < 2 || abs > 6) return 1;
  if (t.atoms.length === 0) return abs;
  if (t.atoms.length === 1 && t.atoms[0].k === "x" && t.atoms[0].e >= 1 && Number.isInteger(t.atoms[0].e)) return abs;
  return 1;
}
