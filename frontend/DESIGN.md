# ChainChit — Design System

Dark-mode-native fintech surface. Direction: **refined dark fintech glass** —
deep slate void, indigo/violet signal color used as identity marker (not
decoration), layered glass materials with rim light, motion that only signals
state. Layer B inspiration: Supabase's border-hierarchy depth philosophy,
adapted to ChainChit's existing indigo brand (no hue swap).

## 0. Research Log

- Loaded: `design/README.md` (gates/routing), `design/redesign-skill.md`
  (audit-first workflow), `design/interaction-skill.md` (motion mechanics),
  `design/supabase.md` (Layer B token source — border-defined depth, weight
  restraint, translucent layering).
- Skipped lazyweb/imagen lanes: this is an audit-and-polish pass on a shipped
  product with locked layouts, not greenfield. Existing UI is the reference.
- React dev tooling gate (react-grab/scan/doctor): **accepted debt** — skipped
  for this pass; installing dev dependencies immediately before a submission
  deadline mutates the lockfile the CI pipeline pins. Revisit post-L5.

## 1. Color Tokens

| Token | Value | Role |
|---|---|---|
| `--bg` | `#030712` | Page void (never pure black) |
| `--surface-1` | `rgba(17,24,39,0.45)` | Glass card base |
| `--surface-2` | `rgba(17,24,39,0.7)` | Solid card / raised |
| `--border-1` | `rgba(255,255,255,0.05)` | Resting card edge |
| `--border-2` | `rgba(255,255,255,0.09)` | Interactive hover edge |
| `--accent` | `#6366f1` | Brand indigo — links, active states |
| `--accent-soft` | `rgba(99,102,241,α)` | Glows/borders at 8–30% α |
| `--text` / `--muted` | `#f9fafb` / `#9ca3af` | Primary / secondary text |

Rules: one accent family (indigo→violet ramp). Semantic greens/rozes only for
success/error states. Depth via border hierarchy + tinted shadows
(`indigo-950`-based), never pure black shadows.

## 2. Typography

| Role | Font | Notes |
|---|---|---|
| Display | Sora (600–800) | Tight tracking `-0.02em`, hero line-height ≤1.1 |
| Body | Inter (400–500) | Max ~65ch measure, line-height 1.5+ |
| Mono/labels | JetBrains Mono | Uppercase micro-labels, `tracking-wider` |
| Metrics | Inter + `tabular-nums` | All counters, balances, percentages |

## 3. Material Recipes

**Glass card (`.glass-card`)** — layered, not single-blur:
1. base: `linear-gradient(180deg, rgba(30,41,59,0.5), rgba(17,24,39,0.35))`
2. backdrop: `blur(16px) saturate(140%)`
3. rim light: `inset 0 1px 0 rgba(255,255,255,0.07)`
4. edge: `1px solid var(--border-1)`
5. shadow: `0 8px 32px rgba(2,6,23,0.55)` (tinted, bg-hue)
Hover: border → accent-soft 25%, shadow deepens w/ indigo tint, translateY(-2px).

**Primary button**: solid deep-indigo base + inset top rim highlight +
hover glow bloom (`shadow-indigo-500/40`) + press `scale(0.98)`.

**Grain**: fixed full-page SVG-noise overlay at 2.5% opacity,
pointer-events-none.

## 4. Motion & Interaction

GPU-composited only (`transform`, `opacity`, `filter`). Springs over tweens
for spatial movement; short eased fades for color/blur.

| Token | Value | Use |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16,1,0.3,1)` | Entrances |
| `--dur-enter` | 500ms | fade-in-up entrances |
| `--stagger-step` | 70ms | sibling cascade |
| `--dur-micro` | 200ms | hovers, presses, color shifts |

Patterns:
- **Staggered entrance** — lists/grids cascade children by nth-child delay.
- **Card lift** — hover translateY(-2px) + border/shadow shift (existing).
- **Press feedback** — `active:scale-[0.98]` on all buttons (existing).
- **Focus ring** — `focus-visible: ring-2 ring-indigo-400/60 ring-offset-2
  ring-offset-[#030712]`; replaces bare `outline-none`.
- **Reduced motion** — global `prefers-reduced-motion: reduce` kills all
  animation/transitions to near-zero duration.
- Signature moment: landing hero aurora glow (slow conic drift behind
  gradient headline). One per page; everything else stays quiet.

Slop ban: no decorative loops, no hover-that-changes-nothing, no emoji icons.

## 5. Primitives

| Primitive | States | Used in |
|---|---|---|
| `.glass-card` | rest / hover / focus-within | cards everywhere |
| `.btn-primary/.btn-secondary/.btn-danger` | rest / hover / active / focus-visible / disabled | all actions |
| `.animate-fade-in-up` + stagger children | enter | page sections, grids |
| Metric number | static, tabular-nums | dashboard stats, pool sizes |
| Phase/timeline chip | done / live / queued | CycleProgress, steppers |

## 6. Accepted Debt

- No react-scan/react-grab/react-doctor (deadline lockfile freeze).
- Primitive showcase harness skipped; verification = production build + full-
  page screenshots at 1280px on changed routes + reduced-motion spot check.
- Cursor-tracked spotlight borders deferred (needs per-card JS; low value vs cost).
