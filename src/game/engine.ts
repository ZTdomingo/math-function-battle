import { getEntry, type PlotKind, type Special } from "../data/roster";
import {
  call,
  differentiate,
  exprKey,
  EX,
  integrate,
  isZeroExpr,
  monomialPieces,
  mul,
  num,
  simplify,
  toLatex,
  toShort,
  toShortUnit,
  type Expr,
} from "../math/expr";
import { sampleCircle, sampleExpr, sampleHeart, type Polyline } from "../math/sample";

export const WORLD = 4;

export type Mode = "duel" | "calculus" | "boss";
export type Control = "none" | "left" | "ddx" | "int" | "challenger";

export interface BattleConfig {
  mode: Mode;
  leftId: string;
  rightId: string;
  targetId: string;
  bossId: string;
  challengerIds: string[];
  control: Control;
}

export interface Input {
  ax: number;
  ay: number;
  summon: boolean;
}

export interface SfxEvent {
  name: "count" | "fight" | "summon" | "hurt" | "diff" | "dead" | "fanfare" | "explode" | "fusion";
  tone?: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  life: number;
  size: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
  r: number;
}

type HazardKind = "graph" | "triangle" | "sector" | "ring" | "asymptote";

export interface Hazard {
  uid: number;
  ownerUid: number;
  team: number;
  color: string;
  kind: HazardKind;
  segs: Polyline[];
  revealMode: "x" | "index";
  age: number;
  life: number;
  reveal: number;
  damage: number;
  nextHit: Map<number, number>;
  ignore: number[];
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  radius: number;
}

interface Along {
  pts: { x: number; y: number }[];
  cum: number[];
  s: number;
  dir: number;
}

export interface Fighter {
  uid: number;
  rosterId: string;
  name: string;
  latex: string;
  short: string;
  color: string;
  team: number;
  role: "duelist" | "ddx" | "integral" | "function" | "piece" | "boss" | "minion" | "challenger";
  hp: number;
  maxHp: number;
  attack: number;
  cooldown: number;
  cooldownLeft: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alive: boolean;
  expr: Expr | null;
  plot: PlotKind;
  special: Special | null;
  tanLevel: number;
  status: string;
  statusUntil: number;
  fusionUntil: number;
  burstUntil: number;
  trapIn: number;
  dashUntil: number;
  hitLatch: boolean;
  parentUid: number | null;
  along: Along | null;
  trail: { x: number; y: number }[];
  phase: number;
  summonCount: number;
  bossDiffIn: number;
  hurt: number;
}

export interface Winner {
  name: string;
  latex: string;
  hp: number;
  color: string;
}

export class Battle {
  readonly mode: Mode;
  readonly control: Control;
  fighters: Fighter[] = [];
  hazards: Hazard[] = [];
  popups: Popup[] = [];
  particles: Particle[] = [];
  phase: "countdown" | "fight" | "victory" = "countdown";
  phaseT = 0;
  time = 0;
  shake = 0;
  winner: Winner | null = null;
  liveLatex = "";
  events: SfxEvent[] = [];

  private seq = 1;
  private countdownStep = -1;
  private fightCue = false;
  private fusionLock = 0;
  private lastAttacker = -1;
  private playerUid = -1;

  constructor(cfg: BattleConfig) {
    this.mode = cfg.mode;
    this.control = cfg.control;
    if (cfg.mode === "duel") {
      const left = this.spawnRoster(cfg.leftId, 0, "duelist", -2.15, 1.15, {});
      const right = this.spawnRoster(cfg.rightId, 1, "duelist", 2.15, -1.05, {});
      this.kick(left, 2.35);
      this.kick(right, 2.35);
      if (cfg.control === "left") this.playerUid = left.uid;
    } else if (cfg.mode === "calculus") {
      const ddx = this.spawnCustom({
        rosterId: "ddx",
        name: "d/dx",
        latex: "\\dfrac{d}{dx}",
        short: "d/dx",
        color: "#00838f",
        team: 0,
        role: "ddx",
        hp: 120,
        attack: 18,
        cooldown: 0.95,
        x: -2.45,
        y: 1.35,
        r: 0.4,
        expr: null,
        plot: "expr",
        special: null,
      });
      const entry = getEntry(cfg.targetId);
      const fn = this.spawnRoster(entry.id, 1, "function", 0.1, -0.35, { hp: entry.hp, attack: entry.attack });
      const integ = this.spawnCustom({
        rosterId: "int",
        name: "∫",
        latex: "\\int",
        short: "∫",
        color: "#6a1b9a",
        team: 2,
        role: "integral",
        hp: 120,
        attack: 12,
        cooldown: 2.8,
        x: 2.45,
        y: 1.2,
        r: 0.4,
        expr: null,
        plot: "expr",
        special: null,
      });
      this.syncPieces(fn);
      this.liveLatex = fn.latex;
      if (cfg.control === "ddx") this.playerUid = ddx.uid;
      if (cfg.control === "int") this.playerUid = integ.uid;
    } else {
      const boss = this.spawnRoster(cfg.bossId, 0, "boss", -1.35, 0.7, { hp: 300, maxHp: 300, attack: 22, cooldown: 2.35, r: 0.48 });
      boss.bossDiffIn = 6.5;
      const slots = [
        [2.35, 1.7],
        [2.35, 0.55],
        [2.35, -0.6],
        [2.35, -1.75],
      ];
      cfg.challengerIds.slice(0, 4).forEach((id, i) => {
        const [x, y] = slots[i];
        const c = this.spawnRoster(id, 1, "challenger", x, y, { hp: 50, maxHp: 50, r: 0.32 });
        this.kick(c, 2.05);
        if (i === 0 && cfg.control === "challenger") this.playerUid = c.uid;
      });
      this.kick(boss, 1.7);
    }
    for (const f of this.fighters) {
      if (f.special === "triangle") f.trapIn = 2.6;
      if (f.special === "exp-burst") f.trapIn = 3.2;
    }
  }

  consumeEvents(): SfxEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  update(dt: number, input: Input): void {
    dt = Math.min(0.05, dt);
    this.time += dt;
    this.phaseT += dt;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    for (const f of this.fighters) f.hurt = Math.max(0, f.hurt - dt);

    if (this.phase === "countdown") {
      const step = Math.min(3, Math.floor(this.phaseT));
      if (step !== this.countdownStep && step < 3) {
        this.countdownStep = step;
        this.events.push({ name: "count", tone: step });
      }
      if (this.phaseT >= 3 && !this.fightCue) {
        this.fightCue = true;
        this.events.push({ name: "fight" });
      }
      if (this.phaseT >= 4) {
        this.phase = "fight";
        this.phaseT = 0;
        for (const f of this.fighters) {
          if (!f.alive) continue;
          f.cooldownLeft = f.role === "ddx" || f.role === "integral" ? 0.55 : 0.3;
        }
      }
      this.tickDecor(dt);
      return;
    }

    if (this.phase === "victory") {
      this.tickDecor(dt);
      return;
    }

    this.move(dt, input);
    this.specials(dt);
    this.attacks(dt, input);
    this.tickHazards(dt);
    this.collisions();
    this.tickDecor(dt);
    this.checkWin();
  }

  statusOf(f: Fighter): string {
    if (!f.alive) return "[DEAD]";
    if (f.statusUntil > this.time && f.status) return f.status;
    if (this.phase !== "fight") return "[READY]";
    if (f.cooldownLeft > 0.12) return `[Cooldown ${Math.ceil(f.cooldownLeft)}s]`;
    return "[READY]";
  }

  banner(): { kind: "num" | "fight"; text: string } | null {
    if (this.phase === "countdown") {
      if (this.phaseT < 3) return { kind: "num", text: String(3 - Math.floor(this.phaseT)) };
      return { kind: "fight", text: "FIGHT!" };
    }
    if (this.phase === "fight" && this.phaseT < 0.75) return { kind: "fight", text: "FIGHT!" };
    return null;
  }

  private spawnRoster(
    id: string,
    team: number,
    role: Fighter["role"],
    x: number,
    y: number,
    over: Partial<Fighter>,
  ): Fighter {
    const entry = getEntry(id);
    return this.spawnCustom({
      rosterId: entry.id,
      name: entry.name,
      latex: entry.latex,
      short: entry.expr ? toShort(entry.expr) : entry.name,
      color: entry.color,
      team,
      role,
      hp: over.hp ?? entry.hp,
      attack: over.attack ?? entry.attack,
      cooldown: over.cooldown ?? entry.cooldown,
      x,
      y,
      r: over.r ?? (role === "boss" ? 0.48 : 0.36),
      expr: entry.expr ? simplify(entry.expr) : null,
      plot: entry.plot,
      special: entry.special,
      ...over,
    });
  }

  private spawnCustom(p: {
    rosterId: string;
    name: string;
    latex: string;
    short: string;
    color: string;
    team: number;
    role: Fighter["role"];
    hp: number;
    attack: number;
    cooldown: number;
    x: number;
    y: number;
    r: number;
    expr: Expr | null;
    plot: PlotKind;
    special: Special | null;
    maxHp?: number;
  }): Fighter {
    const f: Fighter = {
      uid: this.seq++,
      rosterId: p.rosterId,
      name: p.name,
      latex: p.latex,
      short: p.short,
      color: p.color,
      team: p.team,
      role: p.role,
      hp: p.hp,
      maxHp: p.maxHp ?? p.hp,
      attack: p.attack,
      cooldown: p.cooldown,
      cooldownLeft: 0,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      r: p.r,
      alive: true,
      expr: p.expr,
      plot: p.plot,
      special: p.special,
      tanLevel: 1,
      status: "[READY]",
      statusUntil: 0,
      fusionUntil: 0,
      burstUntil: 0,
      trapIn: 99,
      dashUntil: 0,
      hitLatch: false,
      parentUid: null,
      along: null,
      trail: [],
      phase: Math.random() * Math.PI * 2,
      summonCount: 0,
      bossDiffIn: 99,
      hurt: 0,
    };
    this.fighters.push(f);
    return f;
  }

  private kick(f: Fighter, speed: number): void {
    const a = Math.random() * Math.PI * 2;
    f.vx = Math.cos(a) * speed;
    f.vy = Math.sin(a) * speed;
  }

  private isPlayer(f: Fighter): boolean {
    return f.uid === this.playerUid;
  }

  private move(dt: number, input: Input): void {
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const dashing = f.dashUntil > this.time;
      if (f.along && !dashing) {
        this.advanceAlong(f, dt);
        this.clamp(f);
        this.remember(f);
        continue;
      }
      if (!dashing && this.isPlayer(f)) {
        const len = Math.hypot(input.ax, input.ay);
        const speed = 3.15;
        if (len > 0.08) {
          f.vx = (input.ax / len) * speed;
          f.vy = (input.ay / len) * speed;
        } else {
          f.vx *= 0.9;
          f.vy *= 0.9;
        }
      } else if (!dashing && (f.role === "ddx" || f.role === "integral")) {
        this.home(f, dt);
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      this.clamp(f);
      this.remember(f);
    }
  }

  private home(f: Fighter, dt: number): void {
    const target = this.nearestHostile(f);
    if (!target) return;
    let dx = target.x - f.x;
    let dy = target.y - f.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const raw = Math.hypot(target.x - f.x, target.y - f.y);
    const bias = raw < 1.35 ? 0.12 : Math.sin(this.time * 2.1 + f.phase) * 0.55;
    const speed = f.role === "ddx" ? 3.15 : 2.45;
    const tvx = (dx - dy * bias) * speed;
    const tvy = (dy + dx * bias) * speed;
    const k = Math.min(1, dt * 3.2);
    f.vx += (tvx - f.vx) * k;
    f.vy += (tvy - f.vy) * k;
  }

  private advanceAlong(f: Fighter, dt: number): void {
    const path = f.along;
    if (!path || path.cum.length < 2) return;
    const total = path.cum[path.cum.length - 1];
    if (total < 0.2) return;
    path.s += path.dir * 1.7 * dt;
    if (path.s >= total) {
      path.s = total;
      path.dir = -1;
    } else if (path.s <= 0) {
      path.s = 0;
      path.dir = 1;
    }
    const p = pointOn(path, path.s);
    f.x = p.x;
    f.y = p.y;
  }

  private clamp(f: Fighter): void {
    const lim = WORLD - f.r * 0.35;
    if (f.x < -lim) {
      f.x = -lim;
      f.vx = Math.abs(f.vx);
    } else if (f.x > lim) {
      f.x = lim;
      f.vx = -Math.abs(f.vx);
    }
    if (f.y < -lim) {
      f.y = -lim;
      f.vy = Math.abs(f.vy);
    } else if (f.y > lim) {
      f.y = lim;
      f.vy = -Math.abs(f.vy);
    }
  }

  private remember(f: Fighter): void {
    f.trail.push({ x: f.x, y: f.y });
    if (f.trail.length > 8) f.trail.shift();
  }

  private attacks(dt: number, input: Input): void {
    for (const f of this.fighters) {
      if (!f.alive || f.role === "piece") continue;
      if (this.isPlayer(f) && input.summon) f.cooldownLeft = 0;
      if (f.cooldownLeft > 0) f.cooldownLeft = Math.max(0, f.cooldownLeft - dt);
      if (f.role === "ddx" || f.role === "integral") {
        if (f.dashUntil > this.time) this.tryCalculusHit(f);
        else f.hitLatch = false;
        if (f.cooldownLeft <= 0 && f.dashUntil <= this.time) this.startDash(f);
        continue;
      }
      if (f.cooldownLeft <= 0) this.summon(f);
    }
  }

  private startDash(f: Fighter): void {
    const target = this.nearestHostile(f);
    if (target) {
      const dx = target.x - f.x;
      const dy = target.y - f.y;
      const len = Math.hypot(dx, dy) || 1;
      f.vx = (dx / len) * 5.6;
      f.vy = (dy / len) * 5.6;
    }
    f.dashUntil = this.time + 0.55;
    f.cooldownLeft = f.cooldown;
    f.hitLatch = false;
    f.status = "[Dashing]";
    f.statusUntil = this.time + 0.42;
    this.events.push({ name: "summon" });
  }

  private tryCalculusHit(op: Fighter): void {
    if (op.hitLatch) return;
    const fn = this.fighters.find((f) => f.role === "function" && f.alive);
    const bodies = fn ? [fn, ...this.fighters.filter((p) => p.parentUid === fn.uid && p.alive)] : [];
    for (const t of bodies) {
      if (dist(op, t) < op.r + t.r + 0.22) {
        op.hitLatch = true;
        this.knock(op, t);
        this.applyCalculus(op, fn!);
        return;
      }
    }
    for (const other of this.fighters) {
      if (!other.alive || other.uid === op.uid) continue;
      if (other.role !== "ddx" && other.role !== "integral") continue;
      if (dist(op, other) < op.r + other.r) {
        op.hitLatch = true;
        this.knock(op, other);
        this.hurt(other, 10, op, true);
        return;
      }
    }
  }

  private knock(a: Fighter, b: Fighter): void {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const len = Math.hypot(dx, dy) || 1;
    a.x += (dx / len) * 0.42;
    a.y += (dy / len) * 0.42;
    this.clamp(a);
  }

  private applyCalculus(op: Fighter, fn: Fighter): void {
    if (!fn.expr) {
      this.hurt(fn, op.attack, op, true);
      return;
    }
    const next = op.role === "ddx" ? differentiate(fn.expr) : integrate(fn.expr);
    const changed = exprKey(next) !== exprKey(fn.expr);
    this.setExpr(fn, next);
    this.popup(fn.x, fn.y + 0.15, toShort(next), op.color, op.role === "ddx" ? 28 : 24);
    this.events.push({ name: "diff" });
    this.burst(fn.x, fn.y, op.color);
    this.shake = Math.min(1, this.shake + 0.4);
    if (isZeroExpr(next)) {
      this.kill(fn, op);
      return;
    }
    this.hurt(fn, op.role === "ddx" ? 16 : 12, op, false);
    fn.status = changed ? `[${toShort(next)}]` : op.role === "ddx" ? "[same derivative]" : "[same integral]";
    fn.statusUntil = this.time + 1.35;
    this.liveLatex = fn.latex;
  }

  private setExpr(f: Fighter, expr: Expr): void {
    const s = simplify(expr);
    f.expr = s;
    f.latex = toLatex(s);
    const many = monomialPieces(s) > 1;
    f.short = many ? toShortUnit(s) : toShort(s);
    if (f.role === "function") {
      this.liveLatex = f.latex;
      this.syncPieces(f);
    }
  }

  private syncPieces(parent: Fighter): void {
    this.fighters = this.fighters.filter((f) => f.parentUid !== parent.uid);
    if (!parent.expr || this.mode !== "calculus") {
      parent.along = null;
      return;
    }
    const n = Math.max(1, monomialPieces(parent.expr));
    const many = n > 1;
    parent.short = many ? toShortUnit(parent.expr) : toShort(parent.expr);
    parent.along = this.makeAlong(parent.expr, 0, n);
    if (!parent.along && Math.hypot(parent.vx, parent.vy) < 0.2) this.kick(parent, 2.1);
    for (let i = 1; i < n; i++) {
      const piece: Fighter = {
        ...parent,
        uid: this.seq++,
        role: "piece",
        parentUid: parent.uid,
        along: this.makeAlong(parent.expr, i / n, n),
        trail: [],
        phase: parent.phase + i,
        vx: 0,
        vy: 0,
        r: parent.r * 0.92,
        hitLatch: false,
      };
      if (!piece.along) this.kick(piece, 2);
      this.fighters.push(piece);
    }
  }

  private makeAlong(expr: Expr, offset: number, count: number): Along | null {
    const segs = visiblePolylines(sampleExpr(expr, WORLD));
    if (!segs.length) return null;
    const seg = segs[Math.floor(offset * count) % segs.length] ?? segs[0];
    if (seg.length < 2) return null;
    const cum = [0];
    for (let i = 1; i < seg.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(seg[i].x - seg[i - 1].x, seg[i].y - seg[i - 1].y));
    }
    const total = cum[cum.length - 1];
    if (total < 0.15) return null;
    return { pts: seg, cum, s: (offset % 1) * total, dir: offset % 2 < 1 ? 1 : -1 };
  }

  private summon(f: Fighter): void {
    f.cooldownLeft = f.cooldown * (f.tanLevel > 1 ? Math.max(0.62, 1 - (f.tanLevel - 1) * 0.12) : 1);
    f.summonCount += 1;
    if (f.special === "tan-upgrade" && f.summonCount > 1 && f.summonCount % 3 === 0 && f.tanLevel < 3) {
      f.tanLevel += 1;
      f.attack += 3;
      const expr = simplify(call("tan", f.tanLevel === 1 ? EX : mul(num(f.tanLevel), EX)));
      f.expr = expr;
      f.latex = `\\tan ${f.tanLevel === 1 ? "x" : f.tanLevel + "x"}`;
      f.short = f.tanLevel === 1 ? "tan x" : `tan ${f.tanLevel}x`;
      f.status = `[y = tan ${f.tanLevel}x]`;
      f.statusUntil = this.time + 2;
      this.popup(f.x, f.y + 0.2, f.short, f.color, 22);
    } else {
      f.status = "[Graph summoned!]";
      f.statusUntil = this.time + 1.15;
    }
    this.events.push({ name: "summon" });
    const fused = f.fusionUntil > this.time && (f.rosterId === "ln" || f.rosterId === "lnabs" || f.rosterId === "exp" || f.special === "fusion-ln" || f.special === "fusion-exp");
    const scaled = this.mode === "calculus" && f.role === "function" ? Math.max(4, Math.round(f.attack * 0.45)) : f.attack;
    const dmg = scaled * (f.burstUntil > this.time ? 2 : 1);
    const life = f.role === "boss" ? 2.25 : 3.15;
    if (f.plot === "sector" || f.special === "pi-sector") {
      this.addHazard({
        owner: f,
        kind: "sector",
        segs: [],
        revealMode: "index",
        life: 2.1,
        damage: Math.max(8, f.attack),
        tx: f.x,
        ty: f.y,
        radius: Math.PI,
      });
      return;
    }
    if (fused) {
        const partner = this.fighters.find(
          (o) => o.alive && o.uid !== f.uid && (o.rosterId === "ln" || o.rosterId === "lnabs" || o.rosterId === "exp"),
        );
      this.addHazard({
        owner: f,
        kind: "graph",
        segs: sampleExpr(EX, WORLD),
        revealMode: "x",
        life: 2.4,
        damage: f.attack + 6,
        ignoreExtra: partner ? [partner.uid] : [],
      });
      return;
    }
    if (f.plot === "circle") {
      this.addHazard({
        owner: f,
        kind: "graph",
        segs: sampleCircle(0, 0, 1.7),
        revealMode: "index",
        life,
        damage: dmg,
      });
      return;
    }
    if (f.plot === "heart") {
      this.addHazard({
        owner: f,
        kind: "graph",
        segs: sampleHeart(),
        revealMode: "index",
        life,
        damage: dmg,
      });
      return;
    }
    if (!f.expr) return;
    this.addHazard({
      owner: f,
      kind: "graph",
      segs: sampleExpr(f.expr, WORLD),
      revealMode: "x",
      life,
      damage: dmg,
    });
    if (f.special === "hyperbola") {
      this.addHazard({
        owner: f,
        kind: "asymptote",
        segs: [],
        revealMode: "index",
        life: 0.55,
        damage: 0,
        tx: 0,
      });
    }
  }

  private addHazard(p: {
    owner: Fighter;
    kind: HazardKind;
    segs: Polyline[];
    revealMode: "x" | "index";
    life: number;
    damage: number;
    tx?: number;
    ty?: number;
    sx?: number;
    sy?: number;
    radius?: number;
    ignoreExtra?: number[];
  }): void {
    this.hazards.push({
      uid: this.seq++,
      ownerUid: p.owner.uid,
      team: p.owner.team,
      color: p.owner.color,
      kind: p.kind,
      segs: p.segs,
      revealMode: p.revealMode,
      age: 0,
      life: p.life,
      reveal: 0,
      damage: p.damage,
      nextHit: new Map(),
      ignore: [p.owner.uid, ...(p.ignoreExtra ?? [])],
      tx: p.tx ?? p.owner.x,
      ty: p.ty ?? p.owner.y,
      sx: p.sx ?? (p.owner.x > 1.3 ? -1 : 1),
      sy: p.sy ?? (p.owner.y > 1.3 ? -1 : 1),
      radius: p.radius ?? 1,
    });
  }

  private specials(dt: number): void {
    const ln = this.fighters.find((f) => f.alive && (f.special === "fusion-ln" || f.rosterId === "ln" || f.rosterId === "lnabs"));
    const ex = this.fighters.find((f) => f.alive && (f.special === "fusion-exp" || f.rosterId === "exp"));
    if (ln && ex && this.time >= this.fusionLock) {
      const close =
        dist(ln, ex) < ln.r + ex.r + 0.7 ||
        this.bodyOnOwnerGraph(ln, ex.uid) ||
        this.bodyOnOwnerGraph(ex, ln.uid);
      if (close) {
        this.fusionLock = this.time + 8;
        ln.fusionUntil = this.time + 5.6;
        ex.fusionUntil = this.time + 5.6;
        ln.status = "[Fusion: y = x]";
        ex.status = "[ln(e^x) = x]";
        ln.statusUntil = this.time + 5.6;
        ex.statusUntil = this.time + 5.6;
        this.popup((ln.x + ex.x) / 2, (ln.y + ex.y) / 2 + 0.2, "ln(eˣ) = x", "#5e35b1", 24);
        this.events.push({ name: "fusion" });
        this.burst((ln.x + ex.x) / 2, (ln.y + ex.y) / 2, "#7e57c2");
        this.addHazard({
          owner: ln,
          kind: "graph",
          segs: sampleExpr(EX, WORLD),
          revealMode: "x",
          life: 5.6,
          damage: 12,
          ignoreExtra: [ex.uid],
        });
      }
    }

    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (f.special === "exp-burst") {
        f.trapIn -= dt;
        if (f.trapIn <= 0) {
          f.trapIn = 8.2;
          f.burstUntil = this.time + 1.7;
          f.status = "[Explosion!]";
          f.statusUntil = this.time + 1.7;
          this.popup(f.x, f.y + 0.35, "Exponential Explosion!", f.color, 18);
          this.events.push({ name: "explode" });
          this.burst(f.x, f.y, f.color);
          if (f.expr) {
            this.addHazard({
              owner: f,
              kind: "graph",
              segs: sampleExpr(f.expr, WORLD),
              revealMode: "x",
              life: 1.7,
              damage: f.attack * 2 + 6,
            });
          }
          this.addHazard({
            owner: f,
            kind: "ring",
            segs: [],
            revealMode: "index",
            life: 0.9,
            damage: 10,
            tx: f.x,
            ty: f.y,
            radius: 2.3,
          });
        }
      }
      if (f.special === "triangle") {
        f.trapIn -= dt;
        if (f.trapIn <= 0) {
          f.trapIn = 7.4;
          f.vx *= 0.15;
          f.vy *= 0.15;
          f.status = "[√2 trap]";
          f.statusUntil = this.time + 2.3;
          this.events.push({ name: "summon" });
          this.addHazard({
            owner: f,
            kind: "triangle",
            segs: [],
            revealMode: "index",
            life: 2.5,
            damage: 16,
            tx: f.x,
            ty: f.y,
          });
        }
      }
    }

    const boss = this.fighters.find((f) => f.role === "boss" && f.alive);
    if (boss?.expr) {
      boss.bossDiffIn -= dt;
      if (boss.bossDiffIn <= 0) {
        boss.bossDiffIn = 7;
        const next = differentiate(boss.expr);
        if (!isZeroExpr(next) && exprKey(next) !== exprKey(boss.expr)) {
          const prev = boss.short;
          this.setExpr(boss, next);
          boss.status = `[d/dx(${prev}) = ${boss.short}]`;
          boss.statusUntil = this.time + 2.3;
          this.popup(boss.x, boss.y + 0.35, boss.short, boss.color, 20);
          this.events.push({ name: "diff" });
          const minions = this.fighters.filter((m) => m.role === "minion" && m.alive);
          if (minions.length < 4) {
            const m = this.spawnCustom({
              rosterId: boss.rosterId,
              name: boss.short,
              latex: boss.latex,
              short: boss.short,
              color: boss.color,
              team: 0,
              role: "minion",
              hp: 40,
              attack: 14,
              cooldown: 2.6,
              x: boss.x + (minions.length - 1.5) * 0.15,
              y: boss.y - 0.7,
              r: 0.28,
              expr: boss.expr,
              plot: "expr",
              special: null,
            });
            this.kick(m, 2.2);
          }
        }
      }
    }
  }

  private bodyOnOwnerGraph(body: Fighter, ownerUid: number): boolean {
    for (const h of this.hazards) {
      if (h.ownerUid !== ownerUid || h.kind !== "graph") continue;
      if (circleHitsGraph(body.x, body.y, body.r + 0.28, h)) return true;
    }
    return false;
  }

  private tickHazards(dt: number): void {
    for (const h of this.hazards) {
      h.age += dt;
      h.reveal = Math.min(1, h.reveal + dt / 0.5);
    }
    this.hazards = this.hazards.filter((h) => h.age < h.life);
  }

  private collisions(): void {
    for (const h of this.hazards) {
      if (h.damage <= 0 || h.reveal < 0.25) continue;
      for (const f of this.fighters) {
        if (!f.alive || f.role === "piece") continue;
        if (h.ignore.includes(f.uid) || f.team === h.team) continue;
        if (!hits(f, h, this.time)) continue;
        const ready = h.nextHit.get(f.uid) ?? 0;
        if (this.time < ready) continue;
        h.nextHit.set(f.uid, this.time + 0.5);
        const owner = this.fighters.find((o) => o.uid === h.ownerUid) ?? f;
        this.hurt(f, h.damage, owner, true);
      }
    }
  }

  private hurt(target: Fighter, amount: number, source: Fighter, show: boolean): void {
    const real = target.parentUid ? (this.fighters.find((f) => f.uid === target.parentUid) ?? target) : target;
    if (!real.alive) return;
    if ((real.role === "ddx" || real.role === "integral") && real.dashUntil > this.time) {
      amount = Math.max(1, Math.round(amount * 0.4));
    }
    real.hp = Math.max(0, real.hp - amount);
    real.hurt = 0.18;
    this.shake = Math.min(1, this.shake + Math.min(0.45, amount / 70));
    if (show) {
      this.popup(target.x, target.y, `-${Math.round(amount)}`, source.color, amount >= 16 ? 26 : 20);
      this.events.push({ name: "hurt" });
    }
    this.lastAttacker = source.uid;
    if (real.hp <= 0) this.kill(real, source);
  }

  private kill(f: Fighter, source: Fighter): void {
    if (!f.alive) return;
    f.alive = false;
    f.hp = 0;
    f.status = "[DEAD]";
    f.statusUntil = Number.POSITIVE_INFINITY;
    this.lastAttacker = source.uid;
    this.events.push({ name: "dead" });
    this.burst(f.x, f.y, f.color);
    if (f.role === "function" || f.role === "boss") {
      for (const p of this.fighters) {
        if ((p.parentUid === f.uid || (f.role === "boss" && p.role === "minion")) && p.alive) {
          p.alive = false;
          p.hp = 0;
          p.status = "[DEAD]";
        }
      }
    }
  }

  private checkWin(): void {
    if (this.phase !== "fight") return;
    if (this.mode === "duel") {
      const left = this.fighters.some((f) => f.role === "duelist" && f.team === 0 && f.alive);
      const right = this.fighters.some((f) => f.role === "duelist" && f.team === 1 && f.alive);
      if (left && right) return;
      const winner = this.fighters.find((f) => f.role === "duelist" && f.alive);
      if (winner) this.crown(winner, winner.hp);
      else this.crown(this.fighters[0], 0);
      return;
    }
    if (this.mode === "calculus") {
      const ddx = this.fighters.find((f) => f.role === "ddx")!;
      const integ = this.fighters.find((f) => f.role === "integral")!;
      const fn = this.fighters.find((f) => f.role === "function")!;
      if (!fn.alive) {
        const killer = this.fighters.find((f) => f.uid === this.lastAttacker && f.alive);
        const winner = killer ?? [ddx, integ].find((o) => o.alive) ?? ddx;
        this.crown(winner, winner.hp);
        return;
      }
      if (!ddx.alive && !integ.alive) this.crown(fn, fn.hp);
      return;
    }
    const boss = this.fighters.find((f) => f.role === "boss")!;
    const chs = this.fighters.filter((f) => f.role === "challenger");
    if (!boss.alive) {
      const alive = chs.filter((c) => c.alive);
      const hp = alive.reduce((s, c) => s + c.hp, 0);
      this.winner = {
        name: "Challengers",
        latex: alive[0]?.latex ?? "1",
        hp: Math.round(hp),
        color: alive[0]?.color ?? "#43a047",
      };
      this.phase = "victory";
      this.phaseT = 0;
      this.events.push({ name: "fanfare" });
      return;
    }
    if (chs.length > 0 && chs.every((c) => !c.alive)) this.crown(boss, boss.hp);
  }

  private crown(f: Fighter, hp: number): void {
    this.phase = "victory";
    this.phaseT = 0;
    const name = f.role === "function" ? f.short : f.name;
    this.winner = { name, latex: f.latex, hp: Math.max(0, Math.round(hp)), color: f.color };
    this.events.push({ name: "fanfare" });
  }

  private nearestHostile(f: Fighter): Fighter | null {
    let best: Fighter | null = null;
    let bestD = Infinity;
    for (const o of this.fighters) {
      if (!o.alive || o.uid === f.uid || o.team === f.team) continue;
      if (o.role === "piece" && f.role !== "ddx" && f.role !== "integral") continue;
      const d = dist(f, o);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private popup(x: number, y: number, text: string, color: string, size: number): void {
    this.popups.push({ x, y, text, color, age: 0, life: 1.15, size });
  }

  private burst(x: number, y: number, color: string): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2;
      const s = 0.8 + Math.random() * 2.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        age: 0,
        life: 0.45 + Math.random() * 0.25,
        color,
        r: 2 + Math.random() * 2.5,
      });
    }
  }

  private tickDecor(dt: number): void {
    for (const p of this.popups) {
      p.age += dt;
      p.y += dt * 0.55;
    }
    this.popups = this.popups.filter((p) => p.age < p.life);
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= dt * 0.4;
    }
    this.particles = this.particles.filter((p) => p.age < p.life).slice(-240);
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function visiblePolylines(segs: Polyline[]): Polyline[] {
  const lim = WORLD * 0.96;
  const out: Polyline[] = [];
  for (const seg of segs) {
    let cur: Polyline | null = null;
    for (const p of seg) {
      if (Math.abs(p.x) <= lim && Math.abs(p.y) <= lim) {
        if (!cur) {
          cur = [];
          out.push(cur);
        }
        cur.push(p);
      } else cur = null;
    }
  }
  return out.filter((s) => s.length >= 2);
}

function pointOn(path: Along, s: number): { x: number; y: number } {
  const { pts, cum } = path;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo] || 1;
  const t = (s - cum[lo]) / span;
  return {
    x: pts[lo].x + (pts[hi].x - pts[lo].x) * t,
    y: pts[lo].y + (pts[hi].y - pts[lo].y) * t,
  };
}

export function triangleVerts(h: Hazard): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const g = Math.min(1, h.age / 0.65);
  const L = 0.35 + 1.6 * g;
  return [
    { x: h.tx, y: h.ty },
    { x: h.tx + h.sx * L, y: h.ty },
    { x: h.tx, y: h.ty + h.sy * L },
  ];
}

function hits(f: Fighter, h: Hazard, time: number): boolean {
  if (h.kind === "graph") return circleHitsGraph(f.x, f.y, 0.34, h);
  if (h.kind === "triangle") {
    const [a, b, c] = triangleVerts(h);
    return pointInTri(f.x, f.y, a, b, c);
  }
  if (h.kind === "sector") {
    const r = Math.PI * Math.min(1, h.age / 0.4);
    return inSector(f.x, f.y, h.tx, h.ty, r, 0, Math.PI);
  }
  if (h.kind === "ring") {
    const rad = h.radius * Math.min(1, h.age / h.life);
    const d = Math.hypot(f.x - h.tx, f.y - h.ty);
    return Math.abs(d - rad) < f.r + 0.2;
  }
  void time;
  return false;
}

function circleHitsGraph(x: number, y: number, rad: number, h: Hazard): boolean {
  for (const seg of h.segs) {
    const shown = revealedCount(seg, h);
    for (let i = 1; i < shown; i++) {
      if (distToSeg(x, y, seg[i - 1].x, seg[i - 1].y, seg[i].x, seg[i].y) <= rad) return true;
    }
  }
  return false;
}

export function revealedCount(seg: { x: number; y: number }[], h: Hazard): number {
  if (h.reveal >= 1) return seg.length;
  if (h.revealMode === "index") return Math.max(2, Math.floor(seg.length * h.reveal));
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of seg) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  const limit = minX + (maxX - minX) * h.reveal;
  let n = 0;
  for (const p of seg) {
    if (p.x <= limit + 1e-6) n += 1;
  }
  return Math.max(2, n);
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-8) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointInTri(
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  const sign = (p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number) =>
    (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
  const d1 = sign(px, py, a.x, a.y, b.x, b.y);
  const d2 = sign(px, py, b.x, b.y, c.x, c.y);
  const d3 = sign(px, py, c.x, c.y, a.x, a.y);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function inSector(px: number, py: number, cx: number, cy: number, r: number, a0: number, a1: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d > r) return false;
  let ang = Math.atan2(dy, dx);
  if (ang < 0) ang += Math.PI * 2;
  return ang >= a0 && ang <= a1;
}
