# Unofficial OM Aim Trainer

A fully playable **3D ranged-stun practice trainer** inspired by **Outcome Memories** (the Roblox
asymmetrical horror game by 1sobbe). Practice Amy's Hammer Throw and Tarot kit, master Tails'
Laser Cannon modes, measure real stun durations and impact distances, and train against EXE
dummies in four behaviour modes — on PC and mobile.

> **Unofficial fan project.** Not affiliated with SEGA, Roblox, or the Outcome Memories
> developers. All models, audio and UI art in this repo are **original stand-ins** — the
> original OM/Roblox assets are not redistributable.

---

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
```

Production build: `npm run build` → `dist/`
Tests: `npm test` (16 unit tests + 8 headless gameplay-simulation scenarios)

---

## Research-first development

Every mechanic is tagged in-game and in `src/config/` with a verification status:

| Tag | Meaning |
| --- | --- |
| **VERIFIED IN OM** | Mechanic *and* value documented in OM wikis / patch notes / gameplay docs |
| **ANNOUNCED IN OM** | Mechanic officially announced (Tails rework posts), values approximated & configurable |
| **IN OM — VALUES UNVERIFIED** | Mechanic confirmed to exist; numbers not documented → configurable |
| **PRACTICE VARIANT** | Custom training tool, clearly not an official OM mechanic |

### Verified mechanics reproduced (with sources)

- **Global 8-second stun cap** on Executioners — OM update log 8/9/2025.
- **Stun Recovery Frame** — post-stun immunity window (v0.2 patch notes; configured at 0.75s).
- **Amy — Tarot Cards**: passive deck of 2/6 cards (The World, The Fool, Strength, The Emperor,
  The Sun, The Moon) that rewrite her **stun duration, speed and durability**; Reroll redraws
  both. The Moon is a verified *random* effect (can cut vision entirely).
- **Amy — Hammer**: 2s stance windup with chime + flash, ~8-stud swing range, mid-air
  **Hammer Bounce**, brief i-frames. **Strength** card adds knockback (patch note).
- **Amy — Throw Hammer**: thrown at the crosshair at high speed; hit pushes back + stuns; the
  hammer is **gone for 8 seconds** then returns automatically (or she can walk over it —
  verified manual pickup); Hammer ability locked meanwhile.
- **Tails — Laser Cannon (Default)**: 5s charge (Tails is slowed; cancel → 15s CD), ~4s plasma
  beam, infinite range, **graze stuns ~5–6s** and pushes the EXE back without extending the stun.
- **Tails — Burst mode** (verified Switch): ground shockwave, **2.2s stun + Burn**, pierces i-frames.
- **Tails — announced modes**: Orbs / AOE Blast / Shockwave (labelled ANNOUNCED, configurable).
- **Silver — Rock**: long-range throw that **slows + ability-locks** the EXE (not a full stun).
- **Silver — Suspension scoring**: +5 per survivor within 30 studs, +15 assist (update log 10/7/2026).
- **Blaze — Kick**: 15 damage (update log 9/2/2026); **Sol Javelin** projectile (patch note).
- **V1 EXE**: parries everything except **ranged** stuns. **Tripwire**: punishes stuns mid-grab.

Full source list and the honest-limitations log live in the in-game **Research & Verification**
screen. Where OM sources disagree (e.g. Fool stun override 1s vs 2s, Strength 3.5s vs 5s), the
value is configurable in `src/config/tarotCards.js` and never presented as a single official figure.

### Asset policy

Roblox/OM models, animations and audio cannot be redistributed, so this trainer ships:

- **Procedural 3D models** (silhouette + weapon accurate) built in `src/characters/models.js` —
  documented swap-in points for licensed assets.
- **Procedural WebAudio SFX** — zero copyrighted audio.
- **Generated original portrait/key art** in `public/assets/` (AI-generated, original replacements).

---

## Features

- **4 playable survivors** (Amy, Tails, Silver, Blaze) — every OM survivor with a verified
  ranged option. Other OM survivors are *documented*, never given invented kits.
- **Amy's Tarot deck live during practice** — your held cards really rewrite your stun
  duration (Fool/Strength/World…), so every STUN CONFIRMED report reflects the real state.
- **Tails' laser panel** — switch all 5 cannon types instantly; each keeps its own verified
  behaviour (beam pushback, Burst i-frame pierce, Burn, …).
- **STUN CONFIRMED feedback** on every stun: *measured* duration (timed live, never hardcoded),
  impact distance in studs (player→target horizontal at impact), style points, classification,
  character/ability, projectile travel time — in a popup, combat feed, and detailed panel.
- **Style scoring with condition gating**: long-range, moving-target, attack-interrupt,
  approaching-EXE, precision, near-max-range, travel-time lead, rapid switch, stun chains.
  A bonus only fires when its condition is actually met; one primary scoring event per stun.
- **EXE dummy spawner**: 4 EXE archetypes × 4 behaviour modes (Stationary / Moving / Attacking /
  Full-Movement), movement patterns (straight / strafe / wander / zigzag / random), speed,
  aggression, difficulty (windup length), health, damage, facing, count (up to 12), auto-respawn,
  reset-after-stun, health/stun/distance labels. Spawn / Remove Selected / Remove All /
  Reset Position / Respawn / Select Next / Clear Session.
- **10 training modes** — precision, tracking, reaction, attack-windup, max-range, projectile
  travel, laser comparison, Amy drills, full combat, custom — switchable live.
- **Analytics**: shots/hits/misses/accuracy, stuns, avg measured stun duration, avg & longest
  distance, per-character/per-ability/per-movement-mode accuracy, combo records, and a
  20-entry persisted session history for cross-attempt comparison.
- **No-cooldown training** (default on): reuse instantly — but windups, charge-ups, and the
  hammer's 8s return are preserved (they are mechanics, not cooldowns). Optional
  clearly-labelled practice variations: instant laser charge, instant hammer recall.
- **PC + mobile**: pointer-lock mouse aim + WASD on desktop; touch joystick, drag-look,
  full ability/fire/jump/run buttons on phones/tablets. Landscape-friendly, every feature
  touch-reachable.
- **Stun mechanics honesty**: 8s global cap enforced and reported ("capped from X"), post-stun
  recovery frame rejects immediate re-stuns exactly like OM's recovery-frame patch.

---

## Controls

| Action | PC | Mobile |
| --- | --- | --- |
| Move / Sprint / Jump | WASD / Shift / Space | joystick / RUN / JUMP |
| Aim | Mouse (click to lock) | drag on right half |
| Fire primary | M1 (hold = auto) | FIRE button |
| Ability 1–4 | per-character keys shown on the ability bar (Q/E/X/R) | AB1–AB4 |
| Tails laser type | X / C or the laser panel | laser panel |
| Pause / panels | Esc / HUD buttons | HUD buttons |

Amy's keys follow OM's verified keybinds (Q = Throw Hammer, E = Hammer, X = Reroll).

---

## Project layout (multi-file architecture)

```
index.html
vite.config.js
public/assets/            original portrait & key art
src/
  main.js                 bootstrap
  game.js                 orchestrator + frame loop
  config/
    gameConfig.js         global rules (stun cap, distance method, …)
    abilities.js          CONFIGURABLE ABILITY DATABASE (every stat + source note)
    characters.js         roster + documented-only survivors
    exes.js               EXE archetypes + spawn defaults
    tarotCards.js         the 6 verified tarot cards + card-effect resolution
  engine/                 renderer, unified PC+touch input, procedural audio
  world/arena.js          3D training range with stud-marked distance rings
  characters/             player controller + procedural 3D model builders
  abilities/              abilitySystem (combat director) + tarot deck runtime
  combat/                 projectiles (swept-sphere), beams/shockwaves, stun measurement, feedback
  exe/                    dummy entity + AI (4 behaviour modes) + spawner
  training/modes.js       the 10 training modes
  scoring/                style-point rules + analytics/session history
  ui/                     styles, HUD, menus, panels, mobile controls
tests/
  run-tests.mjs           16 unit tests (math, stun, scoring, analytics, database)
  gameplay-sim.mjs        8 headless gameplay scenarios against the real combat pipeline
```

## Distance & duration methodology

- **Impact distance** = horizontal (XZ) distance from the player's position to the target's
  root at the moment of impact (studs; 1 world unit = 1 stud).
- **Stun duration** = wall-clock measured from stun application to the EXE's actual recovery —
  the display updates to the measured value when the stun ends. Requested, applied (capped) and
  measured values are all shown.

## Known limitations (stated honestly)

- Roblox client physics/networking and original animations cannot be reproduced 1:1 in a
  browser. All uncertain values are exposed in `src/config/*` with source notes.
- EXE attack telegraphs are original approximations of the verified archetypes, not ripped OM
  animations. This sandbox has no browser to run live manual QA in — the gameplay logic is
  verified by the headless simulation suite instead (`npm test`).
