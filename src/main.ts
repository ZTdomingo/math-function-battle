import katex from "katex";
import "katex/dist/katex.min.css";
import "./style.css";
import { Sfx } from "./audio";
import { CATEGORIES, DEFAULTS, ROSTER, getEntry, type Category, type RosterEntry } from "./data/roster";
import { Battle, type BattleConfig, type Control, type Fighter, type Mode } from "./game/engine";
import { renderBattle } from "./game/render";

const app = document.querySelector<HTMLDivElement>("#app")!;
const sfx = new Sfx();

const state: BattleConfig = {
  mode: "duel",
  leftId: DEFAULTS.left,
  rightId: DEFAULTS.right,
  targetId: DEFAULTS.target,
  bossId: DEFAULTS.boss,
  challengerIds: [...DEFAULTS.challengers],
  control: "none",
};

let battle: Battle | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let viewW = 640;
let viewH = 640;
let last = 0;
let summonEdge = false;
let ax = 0;
let ay = 0;
let hudSig = "";
let cat: Category | "All" = "All";
let pickCb: ((id: string) => void) | null = null;

app.innerHTML = `
  <section id="menu" class="menu">
    <div class="top-row">
      <div>
        <p class="eyebrow">Arcade calculus</p>
        <h1>MATH<br/>FUNCTION<br/>BATTLE</h1>
        <p class="lede">Functions bounce across a grid and leave their graphs behind. Touch an enemy curve and you take the hit. Derivatives rewrite the fighter in real time.</p>
      </div>
      <button id="mute-menu" class="icon-btn" type="button" aria-label="Mute sound">Sound</button>
    </div>
    <div class="cards">
      <button class="card" type="button" data-mode="duel">
        <span class="icon-row"><i class="dot">tan</i><i class="dot">VS</i><i class="dot">1/x</i></span>
        <span class="kicker">1v1 Battle</span>
        <p>Pick any two functions, or hit random. Watch them duel, or steer the left fighter yourself.</p>
      </button>
      <button class="card" type="button" data-mode="calculus">
        <span class="icon-row"><i class="dot">d/dx</i><i class="dot">x³</i><i class="dot">∫</i></span>
        <span class="kicker">Derivative Attack</span>
        <p>d/dx and ∫ fight a function. Every clean hit rewrites it: x³ → 3x² → 6x → 6 → 0.</p>
      </button>
      <button class="card" type="button" data-mode="boss">
        <span class="icon-row"><i class="dot">sin</i><i class="dot">×4</i></span>
        <span class="kicker">Boss Battle</span>
        <p>One 300 HP boss against four 50 HP challengers. sin 2x differentiates itself and calls backup.</p>
      </button>
    </div>
    <p class="foot">WASD or arrows to steer when you take a fighter. Space summons or dashes early. Graphs never jump across asymptotes.</p>
  </section>
  <section id="setup" class="setup hidden"></section>
  <section id="battle" class="battle hidden">
    <div id="hud-top"></div>
    <div class="stage-wrap">
      <div class="float-controls">
        <button id="back" type="button">Back</button>
        <button id="mute-battle" type="button" aria-label="Mute sound">Sound</button>
      </div>
      <div id="stage">
        <canvas id="cv"></canvas>
        <div id="expr-pill" hidden><span class="k">f(x) =</span><span class="tex"></span></div>
        <div id="banner" hidden></div>
        <div id="hint" hidden>WASD steer · Space attack</div>
        <div id="victory" hidden>
          <div class="vcard">
            <h3 id="v-title"></h3>
            <p>Remaining HP <b id="v-hp"></b></p>
            <div class="row" style="justify-content:center">
              <button id="rematch" class="primary" type="button">Rematch</button>
              <button id="to-menu" type="button">Menu</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="hud-bot"></div>
  </section>
  <div id="picker" class="picker hidden">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pick-title">
      <h3 id="pick-title">Choose a function</h3>
      <input id="search" type="search" placeholder="Search sin, 1/x, gamma…" aria-label="Search functions" />
      <div id="cats" class="cats"></div>
      <div id="cards" class="grid"></div>
      <div class="row"><button id="pick-close" type="button">Close</button></div>
    </div>
  </div>
`;

const menu = document.querySelector<HTMLElement>("#menu")!;
const setupEl = document.querySelector<HTMLElement>("#setup")!;
const battleEl = document.querySelector<HTMLElement>("#battle")!;
const canvas = document.querySelector<HTMLCanvasElement>("#cv")!;
ctx = canvas.getContext("2d");

function tex(el: HTMLElement, latex: string): void {
  try {
    katex.render(latex, el, { throwOnError: false, displayMode: false });
  } catch {
    el.textContent = latex;
  }
}

function show(which: "menu" | "setup" | "battle"): void {
  menu.classList.toggle("hidden", which !== "menu");
  setupEl.classList.toggle("hidden", which !== "setup");
  battleEl.classList.toggle("hidden", which !== "battle");
}

function paintMute(): void {
  const label = sfx.muted ? "Muted" : "Sound";
  for (const id of ["mute-menu", "mute-battle"]) {
    const b = document.getElementById(id);
    if (b) b.textContent = label;
  }
}

function toggleMute(): void {
  sfx.unlock();
  sfx.setMuted(!sfx.muted);
  paintMute();
}

document.getElementById("mute-menu")!.addEventListener("click", toggleMute);
document.getElementById("mute-battle")!.addEventListener("click", toggleMute);
paintMute();

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sfx.unlock();
    state.mode = btn.dataset.mode as Mode;
    state.control = "none";
    renderSetup();
    show("setup");
  });
});

function renderSetup(): void {
  const mode = state.mode;
  const title = mode === "duel" ? "1v1 Battle" : mode === "calculus" ? "Derivative Attack" : "Boss Battle";
  setupEl.innerHTML = `
    <button id="setup-back" type="button">← Menu</button>
    <h2>${title}</h2>
    <div class="panel" id="setup-panel"></div>
  `;
  document.getElementById("setup-back")!.addEventListener("click", () => show("menu"));
  const panel = document.getElementById("setup-panel")!;
  if (mode === "duel") panel.append(duelSetup());
  else if (mode === "calculus") panel.append(calcSetup());
  else panel.append(bossSetup());
}

function slot(label: string, id: string, onPick: () => void): HTMLButtonElement {
  const entry = getEntry(id);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "slot";
  btn.innerHTML = `<span class="role">${label}</span><span class="nm"><i class="swatch" style="background:${entry.color}"></i>${entry.name}</span><span class="sub"></span>`;
  tex(btn.querySelector(".sub")!, entry.latex);
  btn.addEventListener("click", onPick);
  return btn;
}

function duelSetup(): HTMLElement {
  const wrap = document.createElement("div");
  const slots = document.createElement("div");
  slots.className = "slots";
  const refresh = () => {
    slots.replaceChildren(
      slot("Left", state.leftId, () => openPicker((id) => { state.leftId = id; refresh(); })),
      slot("Right", state.rightId, () => openPicker((id) => { state.rightId = id; refresh(); })),
    );
  };
  refresh();
  const showcases = document.createElement("div");
  showcases.className = "row";
  for (const [name, a, b] of [
    ["tan vs 1/x", "tan", "inv"],
    ["ln vs eˣ", "ln", "exp"],
    ["π vs √2", "pi", "sqrt2"],
    ["sin vs cos", "sin", "cos"],
  ] as const) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = name;
    btn.addEventListener("click", () => {
      state.leftId = a;
      state.rightId = b;
      refresh();
    });
    showcases.append(btn);
  }
  const controls = document.createElement("div");
  controls.className = "row";
  controls.append(
    action("Random both", () => {
      state.leftId = randomId();
      state.rightId = randomId();
      refresh();
    }),
    check("Play as the left fighter", state.control === "left", (on) => {
      state.control = on ? "left" : "none";
    }),
    go("Fight"),
  );
  wrap.append(slots, showcases, controls);
  return wrap;
}

function calcSetup(): HTMLElement {
  const wrap = document.createElement("div");
  const slots = document.createElement("div");
  slots.className = "slots";
  const refresh = () => {
    slots.replaceChildren(
      slot("Function", state.targetId, () =>
        openPicker((id) => {
          state.targetId = id;
          refresh();
        }, true),
      ),
    );
  };
  refresh();
  const controls = document.createElement("div");
  controls.className = "row";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Who you control");
  select.innerHTML = `<option value="none">Watch AI vs AI</option><option value="ddx">Play as d/dx</option><option value="int">Play as ∫</option>`;
  select.value = state.control === "ddx" || state.control === "int" ? state.control : "none";
  select.addEventListener("change", () => {
    state.control = select.value as Control;
  });
  controls.append(
    action("Random function", () => {
      const pool = ROSTER.filter((e) => e.expr);
      state.targetId = pool[Math.floor(Math.random() * pool.length)].id;
      refresh();
    }),
    select,
    go("Fight"),
  );
  const note = document.createElement("p");
  note.textContent = "d/dx differentiates on contact. ∫ integrates. The expression is shown live. Reducing a polynomial to 0 knocks it out.";
  wrap.append(slots, note, controls);
  return wrap;
}

function bossSetup(): HTMLElement {
  const wrap = document.createElement("div");
  const slots = document.createElement("div");
  slots.className = "slots";
  const refresh = () => {
    const nodes = [
      slot("Boss · 300 HP", state.bossId, () => openPicker((id) => { state.bossId = id; refresh(); })),
    ];
    state.challengerIds.forEach((id, i) => {
      nodes.push(
        slot(`Challenger ${i + 1} · 50 HP`, id, () =>
          openPicker((next) => {
            state.challengerIds[i] = next;
            refresh();
          }),
        ),
      );
    });
    slots.replaceChildren(...nodes);
  };
  refresh();
  const controls = document.createElement("div");
  controls.className = "row";
  controls.append(
    action("Random challengers", () => {
      state.challengerIds = [0, 1, 2, 3].map(() => randomId());
      refresh();
    }),
    check("Play as challenger 1", state.control === "challenger", (on) => {
      state.control = on ? "challenger" : "none";
    }),
    go("Fight"),
  );
  const note = document.createElement("p");
  note.textContent = "Default boss sin 2x self-differentiates (2 cos 2x, −4 sin 2x, …) and spawns those derivatives. Challengers bring their own specials: tan upgrades, eˣ explodes, ln fuses with eˣ, √2 drops a triangle trap.";
  wrap.append(slots, note, controls);
  return wrap;
}

function action(label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", fn);
  return b;
}

function go(label: string): HTMLButtonElement {
  const b = action(label, () => {});
  b.className = "primary";
  b.addEventListener("click", () => {
    sfx.unlock();
    startBattle();
  });
  return b;
}

function check(label: string, on: boolean, fn: (v: boolean) => void): HTMLLabelElement {
  const lab = document.createElement("label");
  lab.className = "check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = on;
  input.addEventListener("change", () => fn(input.checked));
  lab.append(input, document.createTextNode(label));
  return lab;
}

function randomId(): string {
  return ROSTER[Math.floor(Math.random() * ROSTER.length)].id;
}

function openPicker(cb: (id: string) => void, differentiableOnly = false): void {
  pickCb = cb;
  cat = "All";
  const search = document.querySelector<HTMLInputElement>("#search")!;
  search.value = "";
  const cats = document.getElementById("cats")!;
  cats.replaceChildren();
  const all = chip("All", true);
  all.addEventListener("click", () => {
    cat = "All";
    paintPicker(differentiableOnly);
  });
  cats.append(all);
  for (const c of CATEGORIES) {
    const b = chip(c, false);
    b.addEventListener("click", () => {
      cat = c;
      paintPicker(differentiableOnly);
    });
    cats.append(b);
  }
  search.oninput = () => paintPicker(differentiableOnly);
  paintPicker(differentiableOnly);
  document.getElementById("picker")!.classList.remove("hidden");
  search.focus();
}

function chip(label: string, on: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip" + (on ? " on" : "");
  b.textContent = label;
  return b;
}

function paintPicker(differentiableOnly: boolean): void {
  const q = document.querySelector<HTMLInputElement>("#search")!.value.trim().toLowerCase();
  document.querySelectorAll("#cats .chip").forEach((el) => {
    el.classList.toggle("on", el.textContent === (cat === "All" ? "All" : cat));
  });
  const cards = document.getElementById("cards")!;
  const list = ROSTER.filter((e) => {
    if (differentiableOnly && !e.expr) return false;
    if (cat !== "All" && e.category !== cat) return false;
    if (!q) return true;
    return `${e.name} ${e.id} ${e.category} ${e.latex}`.toLowerCase().includes(q);
  });
  cards.replaceChildren(...list.map((e) => card(e)));
}

function card(e: RosterEntry): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "fcard";
  const special = e.special ? `<span class="tag">${specialLabel(e.special)}</span>` : "";
  b.innerHTML = `
    <div class="top"><span class="nm"><i class="swatch" style="background:${e.color}"></i>${e.name}</span>${special}</div>
    <div class="sub"></div>
    <div class="meta">HP ${e.hp} · ATK ${e.attack} · CD ${e.cooldown}s</div>
  `;
  tex(b.querySelector(".sub")!, e.latex);
  b.addEventListener("click", () => {
    pickCb?.(e.id);
    closePicker();
  });
  return b;
}

function specialLabel(s: RosterEntry["special"]): string {
  switch (s) {
    case "tan-upgrade": return "upgrades";
    case "exp-burst": return "explosion";
    case "triangle": return "√2 trap";
    case "pi-sector": return "π sector";
    case "hyperbola": return "hyperbola";
    case "fusion-ln":
    case "fusion-exp": return "fusion";
    default: return "";
  }
}

function closePicker(): void {
  document.getElementById("picker")!.classList.add("hidden");
  pickCb = null;
}

document.getElementById("pick-close")!.addEventListener("click", closePicker);
document.getElementById("picker")!.addEventListener("click", (ev) => {
  if (ev.target === document.getElementById("picker")) closePicker();
});

function startBattle(): void {
  hudSig = "";
  battle = new Battle({ ...state, challengerIds: [...state.challengerIds] });
  show("battle");
  document.getElementById("hint")!.classList.toggle("hidden", state.control === "none");
  const vic0 = document.getElementById("victory")!;
  vic0.hidden = true;
  vic0.classList.remove("hidden");
  resize();
  syncHud(true);
}

document.getElementById("back")!.addEventListener("click", () => {
  battle = null;
  renderSetup();
  show("setup");
});
document.getElementById("to-menu")!.addEventListener("click", () => {
  battle = null;
  show("menu");
});
document.getElementById("rematch")!.addEventListener("click", () => startBattle());

function resize(): void {
  const stage = document.getElementById("stage")!;
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  viewW = Math.max(1, rect.width);
  viewH = Math.max(1, rect.height);
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

new ResizeObserver(() => resize()).observe(document.getElementById("stage")!);

function syncHud(force = false): void {
  if (!battle) return;
  const shown = battle.fighters.filter((f) => f.role !== "piece");
  const sig = `${battle.mode}|` + shown.map((f) => `${f.uid}:${f.latex}:${f.maxHp}:${f.alive}`).join(";");
  if (force || sig !== hudSig) {
    hudSig = sig;
    paintHud(battle, shown);
  }
  for (const f of shown) {
    const fill = document.getElementById(`fill-${f.uid}`) as HTMLElement | null;
    const num = document.getElementById(`num-${f.uid}`);
    const st = document.getElementById(`st-${f.uid}`);
    if (fill) fill.style.width = `${Math.max(0, (f.hp / f.maxHp) * 100)}%`;
    if (num) num.textContent = `${Math.max(0, Math.ceil(f.hp))} / ${f.maxHp}`;
    if (st) {
      const text = battle.statusOf(f);
      st.textContent = text;
      st.classList.toggle("dead", text === "[DEAD]");
    }
    const orb = document.getElementById(`orb-${f.uid}`);
    if (orb && orb.textContent !== f.short) orb.textContent = f.short;
  }
  const pill = document.getElementById("expr-pill")!;
  if (battle.mode === "calculus" && battle.liveLatex) {
    pill.hidden = false;
    const slot = pill.querySelector<HTMLElement>(".tex")!;
    if (slot.dataset.tex !== battle.liveLatex) {
      slot.dataset.tex = battle.liveLatex;
      tex(slot, battle.liveLatex);
    }
  } else pill.hidden = true;

  const banner = battle.banner();
  const bannerEl = document.getElementById("banner")!;
  if (!banner) bannerEl.hidden = true;
  else {
    bannerEl.hidden = false;
    const cls = banner.kind === "fight" ? "fight" : "num";
    if (bannerEl.dataset.k !== banner.text) {
      bannerEl.dataset.k = banner.text;
      bannerEl.innerHTML = `<div class="${cls}">${banner.text}</div>`;
    }
  }
  const vic = document.getElementById("victory")!;
  if (battle.winner) {
    vic.hidden = false;
    vic.classList.remove("hidden");
    const title = document.getElementById("v-title")!;
    title.textContent = `${battle.winner.name} wins!`;
    title.style.color = battle.winner.color;
    document.getElementById("v-hp")!.textContent = String(battle.winner.hp);
  } else vic.hidden = true;
}

function paintHud(b: Battle, shown: Fighter[]): void {
  const top = document.getElementById("hud-top")!;
  const bot = document.getElementById("hud-bot")!;
  if (b.mode === "boss") {
    const boss = shown.find((f) => f.role === "boss")!;
    const chs = shown.filter((f) => f.role === "challenger");
    top.innerHTML = "";
    const head = document.createElement("div");
    head.className = "boss-head";
    const panel = document.createElement("div");
    panel.className = "boss-panel";
    panel.append(orb(boss), barBlock(boss));
    const row = document.createElement("div");
    row.className = "ch-row";
    for (const c of chs) {
      const col = document.createElement("div");
      col.append(orb(c, true), barBlock(c));
      row.append(col);
    }
    head.append(panel, row);
    top.append(head);
    bot.innerHTML = "";
    return;
  }
  const order = b.mode === "calculus"
    ? ["ddx", "function", "integral"].map((role) => shown.find((f) => f.role === role)!)
    : shown.filter((f) => f.role === "duelist");
  top.innerHTML = "";
  const bar = document.createElement("div");
  bar.className = "topbar";
  order.forEach((f, i) => {
    if (i > 0) {
      const vs = document.createElement("div");
      vs.className = "vs";
      vs.textContent = "VS";
      bar.append(vs);
    }
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.append(orb(f));
    const sub = document.createElement("div");
    sub.className = "sub";
    tex(sub, f.latex);
    badge.append(sub);
    bar.append(badge);
  });
  top.append(bar);
  bot.innerHTML = "";
  const bars = document.createElement("div");
  bars.className = "bars";
  bars.style.setProperty("--cols", String(order.length));
  for (const f of order) bars.append(barBlock(f));
  bot.append(bars);
}

function orb(f: Fighter, small = false): HTMLElement {
  const el = document.createElement("div");
  el.className = "orb" + (small ? "" : "");
  if (small) el.style.width = "46px", el.style.height = "46px", el.style.fontSize = "11px";
  el.id = `orb-${f.uid}`;
  el.style.setProperty("--c", f.color);
  el.textContent = f.short;
  return el;
}

function barBlock(f: Fighter): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="track"><div class="fill" id="fill-${f.uid}" style="width:100%;background:${f.color}"></div><div class="hpnum" id="num-${f.uid}"></div></div>
    <div class="status" id="st-${f.uid}"></div>
  `;
  return wrap;
}

window.addEventListener("keydown", (ev) => {
  const k = ev.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(ev.key.toLowerCase()) || ev.key === " ") {
    if (!document.getElementById("picker")!.classList.contains("hidden")) {
      if (ev.key === "Escape") closePicker();
      return;
    }
    if (battle) ev.preventDefault();
  }
  if (ev.key === "Escape") closePicker();
  if (k === " " && battle) summonEdge = true;
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
    axayFromKeys(k, true);
  }
});

window.addEventListener("keyup", (ev) => {
  axayFromKeys(ev.key.toLowerCase(), false);
});

const down = new Set<string>();
function axayFromKeys(k: string, pressed: boolean): void {
  const map: Record<string, string> = {
    w: "y+",
    arrowup: "y+",
    s: "y-",
    arrowdown: "y-",
    d: "x+",
    arrowright: "x+",
    a: "x-",
    arrowleft: "x-",
  };
  const id = map[k];
  if (!id) return;
  if (pressed) down.add(id);
  else down.delete(id);
  ax = (down.has("x+") ? 1 : 0) - (down.has("x-") ? 1 : 0);
  ay = (down.has("y+") ? 1 : 0) - (down.has("y-") ? 1 : 0);
}

let dragging = false;
canvas.addEventListener("pointerdown", (ev) => {
  if (!battle || state.control === "none") return;
  dragging = true;
  canvas.setPointerCapture(ev.pointerId);
  steerFrom(ev);
});
canvas.addEventListener("pointermove", (ev) => {
  if (dragging) steerFrom(ev);
});
canvas.addEventListener("pointerup", () => {
  dragging = false;
  if (![...down].length) {
    ax = 0;
    ay = 0;
  }
});

function steerFrom(ev: PointerEvent): void {
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = ev.clientX - cx;
  const dy = cy - ev.clientY;
  const len = Math.hypot(dx, dy) || 1;
  ax = dx / len;
  ay = dy / len;
}

function frame(t: number): void {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
  last = t;
  sfx.update();
  if (!battle || document.hidden) return;
  battle.update(dt, { ax, ay, summon: summonEdge });
  summonEdge = false;
  for (const ev of battle.consumeEvents()) sfx.play(ev);
  if (ctx) renderBattle(ctx, battle, viewW, viewH);
  syncHud();
}

requestAnimationFrame(frame);
resize();
