import { VERIFY } from './gameConfig.js';

/**
 * CONFIGURABLE ABILITY DATABASE
 * =============================
 * Every projectile speed, hitbox size, range, stun duration and cooldown used
 * by the game is declared here. Nothing is hardcoded in gameplay modules.
 *
 * `verified` documents where each mechanic comes from:
 *   - VERIFY.VERIFIED   : mechanic AND value documented in OM wikis / patch notes
 *   - VERIFY.ANNOUNCED  : mechanic announced in OM (rework posts / patch notes), value approximated
 *   - VERIFY.UNVERIFIED : mechanic confirmed to exist in OM, exact value not documented
 *   - VERIFY.VARIANT    : custom practice variation — NOT an official OM mechanic
 *
 * Primary sources:
 *   - the-unofficial-outcome-memories.fandom.com (Amy, Tails, Updates pages)
 *   - theunofficialoutcomememories.miraheze.org (Tails, Amy)
 *   - outcomememories.miraheze.org / outcomememoriesdisasterpedia.miraheze.org
 *   - TV Tropes "Characters in Outcome Memories (Roblox)"
 *   - namu.wiki "Amy (Outcome Memories)"
 */
export const ABILITIES = {
  /* ================================================================
     AMY ROSE
     ================================================================ */

  amy_tarot_toss: {
    id: 'amy_tarot_toss',
    character: 'amy',
    name: 'Tarot Card Toss',
    shortName: 'Card Toss',
    control: 'M1 / Fire',
    category: 'projectile',
    verified: VERIFY.VARIANT,
    sourceNote:
      "OM's verified Tarot Cards are a PASSIVE deck (2 cards of 6, rerolled with Reroll) — they are not a thrown attack. This card-toss projectile is a clearly-labelled practice variation so players can train card-style ranged aim; it borrows each real card's identity for its visuals.",
    officialCooldown: 0,
    cooldown: 0, // passive in OM; toss variant has no cooldown in training
    windup: 0.22,
    recover: 0.18,
    projectile: {
      speed: 140,          // studs/s — UNVERIFIED practice value (configurable)
      radius: 1.1,         // studs
      gravity: 0,
      lifetime: 2.2,
      spin: 14
    },
    stun: {
      base: 2.0,           // matches Amy's default hammer/card stun window (2s)
      canStun: true,
      knockback: 6
    },
    range: 220,
    hitEffect: 'card_burst',
    sound: 'card_throw'
  },

  amy_hammer: {
    id: 'amy_hammer',
    character: 'amy',
    name: 'Hammer',
    shortName: 'Hammer',
    control: 'E / Ability 2',
    category: 'melee',
    verified: VERIFY.VERIFIED,
    sourceNote:
      'Verified: 2s attack stance with chime + flash, hits Executioners within ~8 studs, default stun 2–3s (wiki versions differ → configurable), 0.1s i-frames on use. Mid-air use becomes Hammer Bounce (verified). Strength card adds knockback (patch note).',
    officialCooldown: 24,
    cooldown: 24,
    windup: 2.0,           // verified 2s stance
    recover: 0.35,
    melee: {
      range: 8,            // verified ~8 studs
      radius: 8,
      arcDegrees: 110
    },
    stun: {
      base: 3.0,           // configurable; wiki reports 2s (namu) / 3s (miraheze)
      canStun: true,
      knockback: 14
    },
    iframeSeconds: 0.1,
    airborneVariant: 'Hammer Bounce (verified): landing bounce forward, same stun window',
    hitEffect: 'hammer_slam',
    sound: 'hammer_swing'
  },

  amy_hammer_throw: {
    id: 'amy_hammer_throw',
    character: 'amy',
    name: 'Throw Hammer',
    shortName: 'Hammer Throw',
    control: 'Q / Ability 1',
    category: 'projectile',
    verified: VERIFY.VERIFIED,
    sourceNote:
      'Verified: Amy aims at the cursor (no slow during prep), throws the Piko Piko Hammer at high speed. A hit pushes the EXE back and stuns (default 2–3s, card-modified). After throwing, she cannot use Hammer for 8s until the hammer returns to her automatically (or she picks it up).',
    officialCooldown: 28,
    cooldown: 28,
    windup: 0.55,
    recover: 0.2,
    projectile: {
      speed: 110,          // "high speed" — exact value unverified → configurable
      radius: 2.2,
      gravity: 0,
      lifetime: 8.0,       // hammer exists until return
      spin: 22,
      returnAfter: 8.0,    // verified 8s recall
      manualPickup: true   // verified: she can retrieve it directly
    },
    stun: {
      base: 3.0,
      canStun: true,
      knockback: 22
    },
    disarms: ['amy_hammer'], // cannot use Hammer while thrown (verified)
    hitEffect: 'hammer_impact',
    sound: 'hammer_throw'
  },

  amy_reroll: {
    id: 'amy_reroll',
    character: 'amy',
    name: 'Reroll',
    shortName: 'Reroll',
    control: 'X / Ability 3',
    category: 'utility',
    verified: VERIFY.VERIFIED,
    sourceNote:
      'Verified: Reroll redraws Amy\'s two Tarot Cards. Wiki cooldowns differ by version (15s–23s) → configurable. No combat projectile.',
    officialCooldown: 23,
    cooldown: 23,
    windup: 0.3,
    recover: 0.1,
    stun: { base: 0, canStun: false },
    sound: 'card_shuffle'
  },

  /* ================================================================
     TAILS — Laser Cannon family (verified Default + Burst; announced rest)
     ================================================================ */

  tails_laser_beam: {
    id: 'tails_laser_beam',
    character: 'tails',
    name: 'Laser Cannon — Plasma Beam',
    shortName: 'Plasma Beam',
    control: 'E to charge, M1 to fire, X to switch mode',
    category: 'beam',
    verified: VERIFY.VERIFIED,
    sourceNote:
      'Verified: 5s charge (Tails is slowed; cancel after charging → 15s CD), then fires a giant plasma beam for ~4s with infinite range. Grazing the EXE stuns ~5s (some sources 6s; global stun cap 8s) and pushes them back while beamed — the push does NOT extend the stun. Beam fires once per charge; the charge itself cannot be cancelled mid-beam.',
    officialCooldown: 45,
    cooldown: 45,
    cancelCooldown: 15,
    charge: 5.0,
    windup: 0,
    recover: 0.25,
    beam: {
      width: 3.2,
      range: 1000,        // "infinite range" — large practical value
      duration: 4.0,
      pushbackSpeed: 12,
      pierceIframes: false
    },
    stun: {
      base: 5.0,          // wiki 5s (fandom) / 6s (disasterpedia + miraheze)
      canStun: true,
      oncePerCast: true,  // first valid hit only scores one stun event
      knockback: 0        // continuous push handled by beam
    },
    hitEffect: 'beam_burn',
    sound: 'laser_beam'
  },

  tails_laser_burst: {
    id: 'tails_laser_burst',
    character: 'tails',
    name: 'Laser Cannon — Burst',
    shortName: 'Burst',
    control: 'E to charge, M1 to fire (ground shockwave)',
    category: 'shockwave',
    verified: VERIFY.VERIFIED,
    sourceNote:
      'Verified (v0.1 Switch modes): Burst fires on the ground around Tails, sending a small shockwave from where he stands. A hit stuns 2.2s and applies Burn. Verified to pierce Executioner i-frames.',
    officialCooldown: 45,
    cooldown: 45,
    charge: 5.0,
    windup: 0,
    recover: 0.3,
    shockwave: {
      radius: 16,
      expandSpeed: 30,
      duration: 0.9
    },
    stun: {
      base: 2.2,          // verified 2.2s
      canStun: true,
      burn: true,         // verified Burn status
      pierceIframes: true,// verified
      knockback: 4
    },
    hitEffect: 'ground_shock',
    sound: 'laser_burst'
  },

  tails_laser_blast: {
    id: 'tails_laser_blast',
    character: 'tails',
    name: 'Laser Cannon — AOE Blast',
    shortName: 'AOE Blast',
    control: 'E to charge, M1 to fire (explosive blast)',
    category: 'aoe',
    verified: VERIFY.ANNOUNCED,
    sourceNote:
      "ANNOUNCED (Tails rework / dev ability-retake post): 'AOE Blast — an AOE blast, if an Executioner is close to that blast, it will still hit them.' Exact radius/speed unrecorded → approximate, configurable, and labelled ANNOUNCED.",
    officialCooldown: 45,
    cooldown: 45,
    charge: 3.5,
    windup: 0,
    recover: 0.35,
    projectile: {
      speed: 95,
      radius: 2.4,
      gravity: 0,
      lifetime: 2.5
    },
    aoe: {
      radius: 18,
      falloff: false
    },
    stun: {
      base: 3.0,
      canStun: true,
      knockback: 12
    },
    hitEffect: 'plasma_explosion',
    sound: 'laser_blast'
  },

  tails_laser_orbs: {
    id: 'tails_laser_orbs',
    character: 'tails',
    name: 'Laser Cannon — Orbs',
    shortName: 'Orbs',
    control: 'E to charge, M1 to fire (spread of orbs)',
    category: 'projectile',
    verified: VERIFY.ANNOUNCED,
    sourceNote:
      "ANNOUNCED (Tails rework notes list 'Orbs' as a Laser Cannon mode; dev post calls a mode firing orb-like shots). Behaviour reconstructed from announcement only → approximate, configurable, labelled ANNOUNCED.",
    officialCooldown: 45,
    cooldown: 45,
    charge: 3.5,
    windup: 0,
    recover: 0.3,
    projectile: {
      speed: 85,
      radius: 1.8,
      gravity: 0,
      lifetime: 2.2
    },
    burst: { count: 5, spreadDegrees: 16 },
    stun: {
      base: 1.6,
      canStun: true,
      knockback: 6
    },
    hitEffect: 'orb_pop',
    sound: 'laser_orbs'
  },

  tails_laser_shockwave: {
    id: 'tails_laser_shockwave',
    character: 'tails',
    name: 'Laser Cannon — Shockwave',
    shortName: 'Shockwave',
    control: 'E to charge, M1 to fire (forward shockwave)',
    category: 'shockwave',
    verified: VERIFY.ANNOUNCED,
    sourceNote:
      "ANNOUNCED (Tails rework lists 'Shockwave' as a separate mode from Burst). Implemented as a forward ground-travelling wave; values approximate and configurable, labelled ANNOUNCED.",
    officialCooldown: 45,
    cooldown: 45,
    charge: 3.5,
    windup: 0,
    recover: 0.3,
    shockwave: {
      radius: 12,
      expandSpeed: 45,
      duration: 1.2,
      forward: true
    },
    stun: {
      base: 2.0,
      canStun: true,
      knockback: 16
    },
    hitEffect: 'ground_shock',
    sound: 'laser_burst'
  },

  tails_switch: {
    id: 'tails_switch',
    character: 'tails',
    name: 'Switch',
    shortName: 'Switch Laser',
    control: 'X / C',
    category: 'utility',
    verified: VERIFY.VERIFIED,
    sourceNote:
      "Verified: Tails' Switch swaps the Laser Cannon mode instantly (usable even while charging). In v0.1 the verified modes are Default and Burst; the rework adds more.",
    officialCooldown: 1,
    cooldown: 1,
    windup: 0.05,
    recover: 0.05,
    stun: { base: 0, canStun: false },
    sound: 'mode_change'
  },

  tails_glide: {
    id: 'tails_glide',
    character: 'tails',
    name: 'Glide',
    shortName: 'Glide',
    control: 'R / Ability 4',
    category: 'utility',
    verified: VERIFY.VERIFIED,
    sourceNote:
      'Verified: Tails glides on his twin tails for ~10s, slowly descending; holding jump floats him upward. Cancel by landing or (after 2s) pressing the ability again. Mobility tool — no stun.',
    officialCooldown: 35,
    cooldown: 35,
    windup: 0.1,
    recover: 0.1,
    glide: {
      duration: 10,
      gravityScale: 0.08,
      liftAcceleration: 26,
      minCancelTime: 2.0
    },
    stun: { base: 0, canStun: false },
    sound: 'ui_open'
  },

  /* ================================================================
     SILVER
     ================================================================ */

  silver_rock: {
    id: 'silver_rock',
    character: 'silver',
    name: 'Rock',
    shortName: 'Rock',
    control: 'Q / Ability 1',
    category: 'projectile',
    verified: VERIFY.UNVERIFIED,
    sourceNote:
      "Verified mechanic (TV Tropes / wiki): Silver rips a rock from the ground and throws it at the Executioner — 'If one connects, it slows the Executioner and stops them from using their abilities for a short amount of time.' It is a slow + ability lock, NOT a full stun. Duration/speed unverified → configurable. Costs Energy Meter charge in OM.",
    officialCooldown: 6,
    cooldown: 6,
    windup: 0.45,
    recover: 0.25,
    projectile: {
      speed: 105,
      radius: 2.0,
      gravity: 0,
      lifetime: 2.4,
      spin: 8
    },
    stun: {
      base: 0,
      canStun: false,
      slow: { factor: 0.35, duration: 3.0 }, // unverified values
      abilityLock: 3.0
    },
    energyCost: 25,
    range: 260,
    hitEffect: 'rock_shatter',
    sound: 'rock_throw'
  },

  silver_suspension: {
    id: 'silver_suspension',
    character: 'silver',
    name: 'Suspension',
    shortName: 'Suspension',
    control: 'E / Ability 2',
    category: 'beam',
    verified: VERIFY.UNVERIFIED,
    sourceNote:
      "Verified mechanic: Suspension psychokinetically holds the Executioner in place. Verified scoring from OM patch notes: +5 score per nearby survivor (radius 30 studs) when hitting the EXE, +15 for assisting a teammate's stun. Hold duration unverified → configurable.",
    officialCooldown: 18,
    cooldown: 18,
    windup: 0.4,
    recover: 0.3,
    beam: {
      width: 4.5,
      range: 120,
      duration: 2.6,
      pushbackSpeed: 0
    },
    stun: {
      base: 2.6,
      canStun: true,
      hold: true,
      knockback: 0
    },
    energyCost: 40,
    scorePerNearbySurvivor: 5, // verified scoring
    assistScore: 15,           // verified scoring
    nearbyRadius: 30,          // verified radius
    hitEffect: 'psych_hold',
    sound: 'suspension'
  },

  /* ================================================================
     BLAZE
     ================================================================ */

  blaze_javelin: {
    id: 'blaze_javelin',
    character: 'blaze',
    name: 'Sol Javelin',
    shortName: 'Javelin',
    control: 'Q / Ability 1',
    category: 'projectile',
    verified: VERIFY.UNVERIFIED,
    sourceNote:
      "Verified mechanic (patch notes: 'Javelin no longer clips EXE through surfaces' — a real projectile that interacts with EXEs). Exact stun/slow and speed unverified → configurable.",
    officialCooldown: 10,
    cooldown: 10,
    windup: 0.4,
    recover: 0.25,
    projectile: {
      speed: 130,
      radius: 1.4,
      gravity: 0,
      lifetime: 2.2,
      spin: 6
    },
    stun: {
      base: 2.0,
      canStun: true,
      knockback: 10
    },
    range: 240,
    hitEffect: 'sol_flare',
    sound: 'javelin_throw'
  },

  blaze_kick: {
    id: 'blaze_kick',
    character: 'blaze',
    name: 'Kick',
    shortName: 'Kick',
    control: 'E / Ability 2',
    category: 'melee',
    verified: VERIFY.VERIFIED,
    sourceNote: 'Verified patch note: Blaze kick deals 15 damage. Close-range attack; short stagger on EXE (stagger window unverified → configurable).',
    officialCooldown: 5,
    cooldown: 5,
    windup: 0.3,
    recover: 0.25,
    melee: {
      range: 6,
      radius: 6,
      arcDegrees: 90
    },
    stun: {
      base: 0.8,
      canStun: true,
      knockback: 18
    },
    damage: 15, // verified
    hitEffect: 'kick_flare',
    sound: 'kick'
  }
};

/** Flat, ordered lists used by the UI. */
export const AMY_ABILITIES = ['amy_tarot_toss', 'amy_hammer', 'amy_hammer_throw', 'amy_reroll'];
export const TAILS_LASERS = [
  'tails_laser_beam',
  'tails_laser_burst',
  'tails_laser_blast',
  'tails_laser_orbs',
  'tails_laser_shockwave'
];

export function getAbility(id) {
  const a = ABILITIES[id];
  if (!a) throw new Error('Unknown ability: ' + id);
  return a;
}
