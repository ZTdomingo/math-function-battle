import { diracScale, discontinuityBreaks, evalExpr, type Expr } from "./expr";

export interface PlotPoint {
  x: number;
  y: number;
}

export type Polyline = PlotPoint[];

const Y_SENTINEL = 80;

/**
 * Sample y = f(x) into polylines. Asymptotes and jumps become gaps:
 * no segment is allowed to cross a known discontinuity or a sign-flipping spike.
 */
export function sampleExpr(expr: Expr, world: number, steps = 640): Polyline[] {
  const spike = diracScale(expr);
  if (spike !== null) return diracSpike(spike, world);

  const breaks = discontinuityBreaks(expr, world);
  const intervals = splitIntervals(world, breaks);
  const segs: Polyline[] = [];
  for (const [a, b] of intervals) {
    const width = b - a;
    const n = Math.max(8, Math.round(steps * (width / (2 * world))));
    let cur: Polyline | null = null;
    let prev: PlotPoint | null = null;
    for (let i = 0; i <= n; i++) {
      const x = a + (width * i) / n;
      const y = evalExpr(expr, x);
      const ok = y !== null && Number.isFinite(y) && Math.abs(y) < Y_SENTINEL;
      if (!ok) {
        cur = null;
        prev = null;
        continue;
      }
      if (prev) {
        const dy = y - prev.y;
        const dx = x - prev.x;
        const slope = Math.abs(dy) / Math.max(1e-8, Math.abs(dx));
        const signFlip = Math.sign(y) !== 0 && Math.sign(prev.y) !== 0 && Math.sign(y) !== Math.sign(prev.y);
        if (signFlip && slope > 40 && Math.abs(dy) > world * 0.75) {
          cur = null;
        }
      }
      if (!cur) {
        cur = [];
        segs.push(cur);
      }
      cur.push({ x, y });
      prev = { x, y };
    }
  }
  return segs.filter((s) => s.length >= 2);
}

function splitIntervals(world: number, breaks: number[]): [number, number][] {
  const eps = 0.012;
  const raw = [-world, world, ...breaks].filter((b) => b >= -world - 1e-8 && b <= world + 1e-8);
  raw.sort((a, b) => a - b);
  const pts: number[] = [];
  for (const b of raw) {
    if (pts.length === 0 || Math.abs(b - pts[pts.length - 1]) > 1e-6) pts.push(b);
  }
  const isBreak = (x: number) => breaks.some((b) => Math.abs(b - x) < 1e-6);
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] + (isBreak(pts[i]) ? eps : 0);
    const b = pts[i + 1] - (isBreak(pts[i + 1]) ? eps : 0);
    if (b - a > 0.02) out.push([a, b]);
  }
  return out;
}

function diracSpike(scale: number, world: number): Polyline[] {
  const h = Math.max(0.6, Math.min(world * 0.85, Math.abs(scale) * 2.4));
  const sign = Math.sign(scale) || 1;
  const w = 0.16;
  return [
    [
      { x: -w * 2, y: 0 },
      { x: -w, y: 0 },
      { x: 0, y: sign * h },
      { x: w, y: 0 },
      { x: w * 2, y: 0 },
    ],
  ];
}

export function sampleCircle(cx: number, cy: number, r: number, steps = 96): Polyline[] {
  const pts: PlotPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return [pts];
}

/** Classic heart curve, scaled to sit inside a ±4 window. */
export function sampleHeart(): Polyline[] {
  const s = 0.16;
  const pts: PlotPoint[] = [];
  for (let i = 0; i <= 280; i++) {
    const t = (i / 280) * Math.PI * 2;
    const x = s * 16 * Math.sin(t) ** 3;
    const y = s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push({ x, y });
  }
  return [pts];
}

export function segmentCrosses(points: Polyline, x0: number): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].x;
    const b = points[i].x;
    if ((a < x0 && b > x0) || (b < x0 && a > x0)) return true;
  }
  return false;
}
