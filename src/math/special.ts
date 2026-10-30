/** Real special functions used for graphing. Poles return null. */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** Digamma ψ(x) = Γ′(x)/Γ(x). */
export function digamma(x: number): number | null {
  if (!Number.isFinite(x)) return null;
  if (x <= 0 && Math.abs(x - Math.round(x)) < 1e-8) return null;
  let v = x;
  let acc = 0;
  let guard = 0;
  while (v < 8 && guard++ < 40) {
    if (Math.abs(v) < 1e-8) return null;
    acc -= 1 / v;
    v += 1;
  }
  const y =
    acc +
    Math.log(v) -
    1 / (2 * v) -
    1 / (12 * v * v) +
    1 / (120 * v ** 4) -
    1 / (252 * v ** 6);
  return Number.isFinite(y) ? y : null;
}

/** Trigamma ψ₁(x) = d/dx digamma(x). */
export function trigamma(x: number): number | null {
  if (!Number.isFinite(x)) return null;
  if (x <= 0 && Math.abs(x - Math.round(x)) < 1e-8) return null;
  let v = x;
  let acc = 0;
  let guard = 0;
  while (v < 12 && guard++ < 50) {
    if (Math.abs(v) < 1e-8) return null;
    acc += 1 / (v * v);
    v += 1;
  }
  const y = acc + 1 / v + 1 / (2 * v * v) + 1 / (6 * v ** 3) - 1 / (30 * v ** 5);
  return Number.isFinite(y) ? y : null;
}

export function gamma(z: number): number | null {
  if (!Number.isFinite(z)) return null;
  if (z <= 0 && Math.abs(z - Math.round(z)) < 1e-8) return null;
  if (z < 0.5) {
    const s = Math.sin(Math.PI * z);
    if (Math.abs(s) < 1e-10) return null;
    const g = gamma(1 - z);
    if (g === null || !Number.isFinite(g) || g === 0) return null;
    const y = Math.PI / (s * g);
    return Number.isFinite(y) && Math.abs(y) < 1e6 ? y : null;
  }
  const zz = z - 1;
  let x = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) x += LANCZOS[i] / (zz + i);
  const t = zz + 7.5;
  const y = Math.sqrt(2 * Math.PI) * t ** (zz + 0.5) * Math.exp(-t) * x;
  return Number.isFinite(y) && Math.abs(y) < 1e6 ? y : null;
}

/** Abramowitz & Stegun 7.1.26 */
export function erf(x: number): number {
  const sign = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a));
  return sign * y;
}

/** Sine integral Si(x) = ∫₀ˣ sin(t)/t dt */
export function si(x: number): number {
  if (x === 0) return 0;
  const ax = Math.abs(x);
  if (ax > 16) return Math.sign(x) * (Math.PI / 2 - Math.cos(x) / x);
  let sum = 0;
  let term = x;
  for (let n = 0; n < 40; n++) {
    sum += term / (2 * n + 1);
    term *= -(x * x) / ((2 * n + 2) * (2 * n + 3));
    if (Math.abs(term) < 1e-14) break;
  }
  return sum;
}

const EULER = 0.5772156649015329;

/** Cosine integral Ci(x), defined here for x > 0. */
export function ci(x: number): number | null {
  if (!(x > 0)) return null;
  if (x > 16) return Math.sin(x) / x;
  let sum = 0;
  let fact = 1;
  let pow = 1;
  for (let n = 1; n <= 40; n++) {
    fact *= (2 * n - 1) * (2 * n);
    pow *= x * x;
    const sign = n % 2 === 1 ? -1 : 1;
    const term = (sign * pow) / (2 * n * fact);
    sum += term;
    if (Math.abs(term) < 1e-14) break;
  }
  const y = EULER + Math.log(x) + sum;
  return Number.isFinite(y) ? y : null;
}

/** Fresnel S(x) = ∫₀ˣ sin(π t² / 2) dt */
export function fresnelS(x: number): number {
  const ax = Math.abs(x);
  if (ax === 0) return 0;
  if (ax > 3.6) {
    const half = 0.5 * Math.PI * x * x;
    return Math.sign(x) * (0.5 - Math.cos(half) / (Math.PI * ax));
  }
  const x4 = ax ** 4;
  const p2 = (Math.PI / 2) ** 2;
  let term = (Math.PI / 2) * ax ** 3 / 3;
  let sum = term;
  for (let n = 0; n < 60; n++) {
    term *= (-p2 * x4 * (4 * n + 3)) / ((2 * n + 2) * (2 * n + 3) * (4 * n + 7));
    sum += term;
    if (Math.abs(term) < 1e-14) break;
  }
  return Math.sign(x) * sum;
}

/** Fresnel C(x) = ∫₀ˣ cos(π t² / 2) dt */
export function fresnelC(x: number): number {
  const ax = Math.abs(x);
  if (ax === 0) return 0;
  if (ax > 3.6) {
    const half = 0.5 * Math.PI * x * x;
    return Math.sign(x) * (0.5 + Math.sin(half) / (Math.PI * ax));
  }
  const x4 = ax ** 4;
  const p2 = (Math.PI / 2) ** 2;
  let term = ax;
  let sum = term;
  for (let n = 0; n < 60; n++) {
    term *= (-p2 * x4 * (4 * n + 1)) / ((2 * n + 1) * (2 * n + 2) * (4 * n + 5));
    sum += term;
    if (Math.abs(term) < 1e-14) break;
  }
  return Math.sign(x) * sum;
}
