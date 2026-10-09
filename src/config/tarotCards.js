/**
 * AMY'S TAROT CARD DECK (verified OM mechanic)
 * ============================================
 * In OM, Amy passively holds 2 of 6 Tarot Cards at a time (drawn at round
 * start, redrawn via Reroll). Cards carry real buffs AND debuffs — several
 * cards rewrite her STUN DURATION, which is core to the aim-trainer feedback.
 *
 * Verified card identities + effects (fandom wiki, miraheze wiki, namu.wiki;
 * numbers vary between game versions → all values configurable here):
 *   The World  (depicted: Sonic)   — reveals everyone; speed penalty
 *   The Fool   (depicted: Tails)   — speed bonus; stun reduced
 *   Strength   (depicted: Knuckles)— stun increased to 5s; speed penalty, damage taken up; extra hammer knockback (patch)
 *   The Emperor(depicted: Shadow)  — damage resistance + speed; NO downside
 *   The Sun    (depicted: Blaze)   — regenerative aura (slow heal); strengthened in LMS
 *   The Moon   (depicted: Tikal)   — random roll: speed/vision/durability swing ("I can't see!")
 */
export const TAROT_CARDS = {
  world: {
    id: 'world',
    name: 'The World',
    depicted: 'Sonic the Hedgehog',
    colorCss: '#4c7dff',
    icon: 'card-world',
    good: 'All Survivors & Executioners are revealed (later patch: EXE revealed within a radius only, highlighted pale red)',
    bad: 'Movement speed reduced (−2 walkspeed in wiki sources)',
    effects: {
      speedAdd: -2,
      stunOverride: null,
      damageMult: 1.0,
      revealRadius: 260, // pale-red EXE highlight radius (post-patch behaviour)
      healPerSecond: 0
    },
    flavour: 'The all-seeing world opens your eyes.'
  },
  fool: {
    id: 'fool',
    name: 'The Fool',
    depicted: 'Miles "Tails" Prower',
    colorCss: '#ffd233',
    icon: 'card-fool',
    good: 'Movement speed increased (+1.5 walkspeed)',
    bad: 'Hammer / Throw Hammer stun reduced (2s in one source, 1s in another)',
    effects: {
      speedAdd: 1.5,
      stunOverride: 2.0,
      damageMult: 1.0,
      revealRadius: 0,
      healPerSecond: 0
    },
    flavour: 'Run fast, hit soft.'
  },
  strength: {
    id: 'strength',
    name: 'Strength',
    depicted: 'Knuckles the Echidna',
    colorCss: '#ff4d4d',
    icon: 'card-strength',
    good: 'Hammer / Throw Hammer stun increased (5s in one source, 3.5s in another); extra hammer-swing knockback (patch note)',
    bad: 'Movement speed reduced (−3) and 10% extra damage taken',
    effects: {
      speedAdd: -3,
      stunOverride: 5.0,
      damageMult: 1.1,
      revealRadius: 0,
      healPerSecond: 0,
      hammerKnockbackBonus: 10
    },
    flavour: 'Hit like a truck, move like one too.'
  },
  emperor: {
    id: 'emperor',
    name: 'The Emperor',
    depicted: 'Shadow the Hedgehog',
    colorCss: '#b19cd9',
    icon: 'card-emperor',
    good: 'Damage resistance increased and speed slightly raised — the only card with no downside',
    bad: 'None',
    effects: {
      speedAdd: 1,
      stunOverride: null,
      damageMult: 0.85,
      revealRadius: 0,
      healPerSecond: 0
    },
    flavour: 'The only flawless card in the deck.'
  },
  sun: {
    id: 'sun',
    name: 'The Sun',
    depicted: 'Blaze the Cat',
    colorCss: '#ff9f43',
    icon: 'card-sun',
    good: 'Regenerative aura (verified: slowly heals Amy and nearby allies; strengthened during LMS)',
    bad: 'None to Amy herself (allies near her can suffer a vision drawback in OM)',
    effects: {
      speedAdd: 0,
      stunOverride: null,
      damageMult: 1.0,
      revealRadius: 0,
      healPerSecond: 2.2
    },
    flavour: 'Warmth for the whole team.'
  },
  moon: {
    id: 'moon',
    name: 'The Moon',
    depicted: 'Tikal',
    colorCss: '#5ad0ff',
    icon: 'card-moon',
    good: 'Random roll — can grant speed or damage resistance',
    bad: 'Random roll — can SEVERELY cut vision ("I can\'t see!") or apply damage vulnerability',
    random: true,
    effects: {
      // Rolled at draw time from these pools (verified: "the effect is random")
      speedPool: [2, -2],
      damagePool: [0.85, 1.2],
      visionLossChance: 0.45,
      stunOverride: null,
      revealRadius: 0,
      healPerSecond: 0
    },
    flavour: 'The Moon has a wicked sense of humour.'
  }
};

export const TAROT_CARD_ORDER = ['world', 'fool', 'strength', 'emperor', 'sun', 'moon'];

/** Base hammer stun before card overrides (wiki: 2s–3s depending on version). */
export const AMY_BASE_STUN = 3.0;
