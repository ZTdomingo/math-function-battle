# Math Function Battle

Arcade battles on a coordinate grid. Algebra and calculus functions bounce around the arena and draw their graphs as hazards. Touch an enemy curve and you take damage.

**Play:** [https://ztdomingo.github.io/math-function-battle/](https://ztdomingo.github.io/math-function-battle/)

After this project is on `main`, turn on Pages once: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow in `.github/workflows/pages.yml` publishes the Vite build. The site is served from `/math-function-battle/`.

## How to play

A 3-2-1 countdown, then **FIGHT!**. Fighters bounce off the walls. When a cooldown finishes they summon their graph, which stays on the grid as a hazard. HP is under (or above, in a boss fight) each fighter, with status text such as `[Cooldown 3s]`, `[READY]`, `[Graph summoned!]`, or `[DEAD]`.

The last one standing gets a victory card: **name wins!** and the remaining HP.

| Mode | What happens |
| --- | --- |
| **1v1 Battle** | Pick any two functions, or a showcase pair (tan vs 1/x, ln vs eˣ, π vs √2, sin vs cos). Watch, or steer the left fighter. |
| **Derivative Attack** | `d/dx` and `∫` fight one function. A derivative hit rewrites it in place (`x³ → 3x² → 6x → 6 → 0`). An integral hit goes the other way. The live expression sits on the arena. Hitting 0 knocks the function out. |
| **Boss Battle** | One boss with 300 HP versus four challengers with 50 HP each. The default boss, `sin 2x`, differentiates itself (`2cos 2x`, `−4sin 2x`, …) and spawns those forms. |

### Controls

- **Watch** is the default. Everyone is AI.
- **WASD** or **arrow keys** steer your fighter. Drag on the arena to steer with a pointer.
- **Space** fires your summon or dash immediately.
- **Sound** toggles 8-bit music and effects. The choice is remembered.

### Specials

- **tan x** tightens to `tan 2x`, then `tan 3x`.
- **eˣ** shouts **Exponential Explosion!** and dumps a heavier graph plus a shockwave.
- **ln x** meeting **eˣ** fuses: `ln(eˣ) = x`, and they draw the line `y = x` together.
- **√2** stops and grows a 1-1-√2 triangle trap (16 damage).
- **π** sweeps a semicircular sector of radius π.
- **1/x** draws both hyperbola branches and flashes its asymptote. Curves are not connected across discontinuities.

The roster is data-driven (`src/data/roster.ts`): constants, polynomials, absolute value, step functions, roots, rational functions, exponentials, logs, trig and reciprocal trig, inverse trig, hyperbolic functions, sinc, the Gaussian, the sigmoid, erf, Γ, Si, Ci, Fresnel integrals, a Dirac spike, plus a circle and a heart. The picker groups them by category and has search. Labels are set in KaTeX.

## Local development

```bash
npm install
npm test      # derivative chain, specials, discontinuity sampling
npm run dev   # http://localhost:5173/math-function-battle/
npm run build
npm run preview
```

`vite` `base` is `/math-function-battle/`, including in dev, so open that path rather than the site root.
