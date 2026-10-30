import { WORLD, triangleVerts, revealedCount, type Battle, type Hazard } from "./engine";

interface Metrics {
  ox: number;
  oy: number;
  s: number;
}

export function renderBattle(ctx: CanvasRenderingContext2D, battle: Battle, w: number, h: number): void {
  const mag = battle.shake * 6;
  const m = metrics(w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(Math.sin(battle.time * 41) * mag, Math.cos(battle.time * 37) * mag);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, m);
  ctx.save();
  roundedClip(ctx, m);
  for (const h of battle.hazards) drawHazard(ctx, m, h);
  for (const p of battle.particles) {
    const a = 1 - p.age / p.life;
    const [sx, sy] = toScreen(p.x, p.y, m);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  for (const f of battle.fighters) {
    if (!f.alive) continue;
    if (f.role === "ddx" || f.role === "integral") drawTrail(ctx, m, f.trail, f.color);
  }
  for (const f of battle.fighters) {
    if (!f.alive) continue;
    drawFighter(ctx, m, f);
  }
  for (const p of battle.popups) {
    const a = 1 - p.age / p.life;
    const [sx, sy] = toScreen(p.x, p.y, m);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `800 ${p.size}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.strokeText(p.text, sx, sy);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, sx, sy);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function metrics(w: number, h: number): Metrics {
  const pad = 18;
  const s = Math.min(w, h) - pad * 2;
  return { ox: (w - s) / 2, oy: (h - s) / 2, s };
}

function toScreen(x: number, y: number, m: Metrics): [number, number] {
  return [m.ox + ((x + WORLD) / (WORLD * 2)) * m.s, m.oy + ((WORLD - y) / (WORLD * 2)) * m.s];
}

function unit(m: Metrics): number {
  return m.s / (WORLD * 2);
}

function drawGrid(ctx: CanvasRenderingContext2D, m: Metrics): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.ox, m.oy, m.s, m.s);
  ctx.clip();
  ctx.strokeStyle = "#ece7dc";
  ctx.lineWidth = 1;
  for (let i = -WORLD; i <= WORLD; i++) {
    const [x1, y1] = toScreen(i, -WORLD, m);
    const [x2, y2] = toScreen(i, WORLD, m);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const [hx1, hy1] = toScreen(-WORLD, i, m);
    const [hx2, hy2] = toScreen(WORLD, i, m);
    ctx.beginPath();
    ctx.moveTo(hx1, hy1);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "#9a9488";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const [x0, yTop] = toScreen(0, WORLD, m);
  const [, yBot] = toScreen(0, -WORLD, m);
  ctx.moveTo(x0, yBot);
  ctx.lineTo(x0, yTop);
  const [xLeft, y0] = toScreen(-WORLD, 0, m);
  const [xRight] = toScreen(WORLD, 0, m);
  ctx.moveTo(xLeft, y0);
  ctx.lineTo(xRight, y0);
  ctx.stroke();

  arrow(ctx, x0, yTop, 0, -1);
  arrow(ctx, xRight, y0, 1, 0);

  ctx.fillStyle = "#6d675c";
  ctx.font = 'italic 15px Georgia, "Times New Roman", serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("y", x0 + 6, yTop + 4);
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("x", xRight - 8, y0 - 6);
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("O", x0 - 6, y0 + 4);

  ctx.strokeStyle = "#1c1b22";
  ctx.lineWidth = 2;
  ctx.strokeRect(m.ox + 0.5, m.oy + 0.5, m.s - 1, m.s - 1);
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number): void {
  const len = 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = "#9a9488";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-len, 4);
  ctx.lineTo(-len, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundedClip(ctx: CanvasRenderingContext2D, m: Metrics): void {
  ctx.beginPath();
  ctx.rect(m.ox + 2, m.oy + 2, m.s - 4, m.s - 4);
  ctx.clip();
}

function drawHazard(ctx: CanvasRenderingContext2D, m: Metrics, h: Hazard): void {
  const fade = h.age > h.life - 0.35 ? Math.max(0, (h.life - h.age) / 0.35) : 1;
  ctx.save();
  ctx.globalAlpha = 0.95 * fade;
  if (h.kind === "graph") drawGraph(ctx, m, h);
  else if (h.kind === "triangle") drawTriangle(ctx, m, h);
  else if (h.kind === "sector") drawSector(ctx, m, h);
  else if (h.kind === "ring") drawRing(ctx, m, h);
  else if (h.kind === "asymptote") drawAsymptote(ctx, m, h);
  ctx.restore();
}

function drawGraph(ctx: CanvasRenderingContext2D, m: Metrics, h: Hazard): void {
  ctx.lineWidth = 4.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = h.color;
  ctx.shadowColor = h.color;
  ctx.shadowBlur = 10;
  for (const seg of h.segs) {
    const n = Math.min(seg.length, revealedCount(seg, h));
    if (n < 2) continue;
    ctx.beginPath();
    const [x0, y0] = toScreen(seg[0].x, seg[0].y, m);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < n; i++) {
      const [x, y] = toScreen(seg[i].x, seg[i].y, m);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawTriangle(ctx: CanvasRenderingContext2D, m: Metrics, h: Hazard): void {
  const [a, b, c] = triangleVerts(h);
  const [ax, ay] = toScreen(a.x, a.y, m);
  const [bx, by] = toScreen(b.x, b.y, m);
  const [cx, cy] = toScreen(c.x, c.y, m);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = hexAlpha(h.color, 0.28);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = h.color;
  ctx.stroke();
}

function drawSector(ctx: CanvasRenderingContext2D, m: Metrics, h: Hazard): void {
  const r = Math.PI * Math.min(1, h.age / 0.4);
  const [cx, cy] = toScreen(h.tx, h.ty, m);
  const rad = r * unit(m);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  // Canvas y grows downward, so the upper half-plane is the anticlockwise arc.
  ctx.arc(cx, cy, rad, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = hexAlpha(h.color, 0.22);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = h.color;
  ctx.stroke();
}

function drawRing(ctx: CanvasRenderingContext2D, m: Metrics, h: Hazard): void {
  const rad = h.radius * Math.min(1, h.age / Math.max(0.2, h.life));
  const [cx, cy] = toScreen(h.tx, h.ty, m);
  ctx.beginPath();
  ctx.arc(cx, cy, rad * unit(m), 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = h.color;
  ctx.shadowColor = h.color;
  ctx.shadowBlur = 12;
  ctx.stroke();
}

function drawAsymptote(ctx: CanvasRenderingContext2D, m: Metrics, h: Hazard): void {
  const [x, y1] = toScreen(0, -WORLD, m);
  const [, y2] = toScreen(0, WORLD, m);
  ctx.globalAlpha *= 0.55;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = h.color;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTrail(ctx: CanvasRenderingContext2D, m: Metrics, trail: { x: number; y: number }[], color: string): void {
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const [sx, sy] = toScreen(p.x, p.y, m);
    ctx.globalAlpha = ((i + 1) / trail.length) * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, 7 * ((i + 1) / trail.length), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  m: Metrics,
  f: { x: number; y: number; r: number; color: string; short: string; hurt: number; role: string },
): void {
  const [sx, sy] = toScreen(f.x, f.y, m);
  const rad = Math.max(12, f.r * unit(m));
  ctx.save();
  ctx.shadowColor = f.color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(sx, sy, rad, 0, Math.PI * 2);
  ctx.fillStyle = f.hurt > 0 ? "#ffffff" : mix(f.color, "#ffffff", 0.78);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = f.color;
  ctx.stroke();
  ctx.fillStyle = mix(f.color, "#1a1a1a", 0.55);
  let size = Math.max(10, rad * 0.58);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  const label = f.short;
  while (size > 9 && ctx.measureText(label).width > rad * 1.65) {
    size -= 1;
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillText(label, sx, sy + 0.5);
  ctx.restore();
}

function mix(hex: string, other: string, t: number): string {
  const a = rgb(hex);
  const b = rgb(other);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function hexAlpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
