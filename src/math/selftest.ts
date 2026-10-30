import {
  call,
  differentiate,
  evalExpr,
  EX,
  exprKey,
  integrate,
  isZeroExpr,
  monomialPieces,
  mul,
  num,
  pow,
  simplify,
  toLatex,
  toShort,
} from "./expr.ts";
import { ci, erf, fresnelC, fresnelS, gamma, si } from "./special.ts";
import { sampleExpr, segmentCrosses } from "./sample.ts";

let failed = 0;

function check(cond: boolean, msg: string): void {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

function near(a: number | null, b: number, eps = 1e-3): boolean {
  return a !== null && Math.abs(a - b) < eps;
}

const x3 = pow(EX, 3);
let e = simplify(x3);
const chain: string[] = [toLatex(e)];
for (let i = 0; i < 4; i++) e = differentiate(e);
chain.push(toLatex(e));
// rebuild the reported chain explicitly
const steps = [toLatex(simplify(x3))];
let cur = simplify(x3);
for (let i = 0; i < 4; i++) {
  cur = differentiate(cur);
  steps.push(toLatex(cur));
}
check(steps.join(" -> ") === "x^{3} -> 3x^{2} -> 6x -> 6 -> 0", `x^3 chain: ${steps.join(" -> ")}`);
check(isZeroExpr(cur), "fourth derivative is zero");
check(monomialPieces(simplify(pow(EX, 3))) === 1, "x^3 is one piece");
check(monomialPieces(differentiate(simplify(x3))) === 3, "3x^2 is three pieces");
check(monomialPieces(differentiate(differentiate(simplify(x3)))) === 6, "6x is six pieces");

const integ = integrate(simplify(x3));
check(toLatex(integ) === "\\frac{1}{4}x^{4}", `∫ x^3 = ${toLatex(integ)}`);
check(exprKey(differentiate(integ)) === exprKey(simplify(x3)), "d/dx ∫ x^3 = x^3");

let s = call("sin", EX);
const scycle = [toLatex(s)];
for (let i = 0; i < 4; i++) {
  s = differentiate(s);
  scycle.push(toLatex(s));
}
check(
  scycle.join(" -> ") === "\\sin x -> \\cos x -> -\\sin x -> -\\cos x -> \\sin x",
  `sin cycle: ${scycle.join(" -> ")}`,
);

let s2 = call("sin", mul(num(2), EX));
const s2c = [toLatex(s2)];
s2 = differentiate(s2);
s2c.push(toLatex(s2));
s2 = differentiate(s2);
s2c.push(toLatex(s2));
s2 = differentiate(s2);
s2c.push(toLatex(s2));
check(
  s2c.join(" -> ") === "\\sin 2x -> 2\\cos 2x -> -4\\sin 2x -> -8\\cos 2x",
  `sin 2x chain: ${s2c.join(" -> ")}`,
);

const ln = call("ln", EX);
const dln = differentiate(ln);
check(toLatex(dln) === "\\frac{1}{x}" || toLatex(dln) === "x^{-1}", `d ln = ${toLatex(dln)}`);
const iln = integrate(dln);
check(toLatex(iln).includes("\\ln"), `∫ 1/x = ${toLatex(iln)}`);

const ex = call("exp", EX);
check(exprKey(differentiate(ex)) === exprKey(ex), "d/dx e^x = e^x");
check(toLatex(ex) === "e^{x}", `latex e^x = ${toLatex(ex)}`);

const tan = call("tan", EX);
const dtan = differentiate(tan);
check(toLatex(dtan).includes("\\sec") && toLatex(dtan).includes("2"), `d tan = ${toLatex(dtan)}`);
check(exprKey(integrate(dtan)) === exprKey(tan) || toLatex(integrate(dtan)).includes("\\tan"), `∫ sec^2 ~ tan (${toLatex(integrate(dtan))})`);

check(near(evalExpr(simplify(x3), 2), 8), "eval x^3 at 2");
check(near(evalExpr(call("sinc", EX), 0), 1), "sinc(0) = 1");
check(near(gamma(1), 1, 1e-6) && near(gamma(5), 24, 1e-4) && near(gamma(0.5), Math.sqrt(Math.PI), 1e-4), "gamma values");
check(near(erf(0), 0, 1e-6) && near(erf(1), 0.84270079, 1e-4), "erf values");
check(near(si(1), 0.946083, 2e-3), `Si(1) = ${si(1)}`);
const ci1 = ci(1);
check(ci1 !== null && Math.abs(ci1 - 0.337404) < 5e-3, `Ci(1) = ${ci1}`);
check(near(fresnelS(1), 0.438259, 2e-2), `S(1) = ${fresnelS(1)}`);
check(near(fresnelC(1), 0.779893, 2e-2), `C(1) = ${fresnelC(1)}`);

const inv = sampleExpr(pow(EX, -1), 4);
check(inv.length >= 2, `1/x has ${inv.length} branches`);
check(inv.every((seg) => !segmentCrosses(seg, 0)), "1/x does not cross x=0");

const tanSegs = sampleExpr(call("tan", EX), 4);
const pole = Math.PI / 2;
check(tanSegs.length >= 2, `tan branches: ${tanSegs.length}`);
check(tanSegs.every((seg) => !segmentCrosses(seg, pole) && !segmentCrosses(seg, -pole)), "tan skips its poles");

const step = sampleExpr(call("heaviside", EX), 4);
check(step.every((seg) => !segmentCrosses(seg, 0)), "Heaviside does not draw a vertical jump");

const floorSegs = sampleExpr(call("floor", EX), 4);
check(floorSegs.length >= 5, `floor segments ${floorSegs.length}`);
check(floorSegs.every((seg) => Math.abs(seg[0].y - seg[seg.length - 1].y) < 1e-6), "floor segments stay flat");

check(toShort(differentiate(simplify(x3))) === "3x²", `short 3x^2 = ${toShort(differentiate(simplify(x3)))}`);
check(toLatex(num(Math.PI)) === "\\pi", "pi latex");
check(toShort(num(Math.SQRT2)) === "√2", "sqrt2 short");

const gauss = call("exp", mul(num(-1), pow(EX, 2)));
const dg = differentiate(gauss);
check(toLatex(dg).includes("e^{") && toLatex(dg).includes("x"), `gauss' = ${toLatex(dg)}`);
const back = integrate(dg);
check(exprKey(back) === exprKey(simplify(gauss)), `∫ gauss' = ${toLatex(back)}`);

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall math checks passed");
