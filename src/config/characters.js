import { VERIFY } from './gameConfig.js';

/**
 * Character roster.
 *
 * Roster + kits were researched from the unofficial OM wikis
 * (the-unofficial-outcome-memories.fandom.com, theunofficialoutcomememories.miraheze.org,
 * outcomememories.miraheze.org), TV Tropes' OM character page and namu.wiki.
 *
 * Only characters with a verified RANGED option are playable here (Amy, Tails,
 * Silver, Blaze). Other OM survivors are listed in the Research panel with
 * their verified kits so nothing is invented.
 */
export const CHARACTERS = {
  amy: {
    id: 'amy',
    name: 'Amy Rose',
    title: 'The Piko Piko Wielder',
    role: 'Melee / Ranged Stunner',
    color: 0xff5fa8,
    accentCss: '#ff5fa8',
    portrait: 'assets/portraits/amy.png',
    health: 100,
    speed: 16,
    abilityIds: ['amy_tarot_toss', 'amy_hammer', 'amy_hammer_throw', 'amy_reroll'],
    verifiedKit: 'Tarot Cards (Passive), Hammer, Throw Hammer, Reroll',
    blurb:
      "Amy's verified OM kit is her Tarot Card deck (passive), the Piko Piko Hammer swing, Throw Hammer (ranged) and Reroll. She is OM's most versatile stunner: close-range hammer into a ranged hammer toss. The card deck actively rewrites her stun duration, speed and durability.",
    stunNote: 'Hammer / Throw Hammer stun is card-modified (verified range 1s–5s across cards/patches; default configurable).'
  },
  tails: {
    id: 'tails',
    name: 'Miles "Tails" Prower',
    title: 'The Backline Sniper',
    role: 'Ranged / Support',
    color: 0xffc233,
    accentCss: '#ffc233',
    portrait: 'assets/portraits/tails.png',
    health: 100,
    speed: 15,
    abilityIds: ['tails_laser_beam', 'tails_laser_burst', 'tails_laser_blast', 'tails_laser_orbs', 'tails_laser_shockwave', 'tails_switch', 'tails_glide'],
    verifiedKit: 'Animal Sense (Passive), Metal Support (Passive), Glide, Laser Cannon (Default / Burst modes, Switch)',
    blurb:
      "Tails is OM's ranged specialist. Laser Cannon charges (slowing him), then fires a huge plasma beam that stuns on a graze and pushes the Executioner back. Burst mode swaps to a ground shockwave that stuns briefly and applies Burn — and pierces i-frames. Announced rework modes (Orbs, Blast, Shockwave) are included and clearly labelled.",
    stunNote: 'Plasma Beam graze stun is wiki-documented at ~5–6s (global stun cap 8s). Burst stun 2.2s + Burn (verified).'
  },
  silver: {
    id: 'silver',
    name: 'Silver the Hedgehog',
    title: 'The Long-Range Staller',
    role: 'Support / Staller',
    color: 0x66d9ff,
    accentCss: '#66d9ff',
    portrait: 'assets/portraits/silver.png',
    health: 100,
    speed: 15,
    abilityIds: ['silver_rock', 'silver_suspension'],
    verifiedKit: 'Energy Meter (Passive), Flight (Passive), Suspension, Rock, Time Reversal',
    blurb:
      "Silver's verified ranged tool is Rock: he rips a boulder out of the ground and hurls it long-range. A connecting rock slows the Executioner and locks their abilities briefly. Suspension suspends an EXE in place and scores team-support points (verified scoring: 5 pts per survivor within 30 studs, 15 pts for an assist).",
    stunNote: 'Rock is a slow + ability-lock, not a full stun (verified behaviour; exact duration unverified → configurable). Suspension is a hold.'
  },
  blaze: {
    id: 'blaze',
    name: 'Blaze the Cat',
    title: 'The Javelin Fighter',
    role: 'Ranged Stunner',
    color: 0xc77dff,
    accentCss: '#c77dff',
    portrait: 'assets/portraits/blaze.png',
    health: 100,
    speed: 16,
    abilityIds: ['blaze_javelin', 'blaze_kick'],
    verifiedKit: 'Javelin, Kick (15 dmg verified), Sol Flame',
    blurb:
      "Blaze throws her Sol Javelin at range (a later patch stopped it clipping EXEs through surfaces, confirming it as a real projectile). Her kick deals a verified 15 damage. Sol Flame grants i-frames during its windup only.",
    stunNote: 'Javelin stun/slow duration is not documented in available sources → unverified and configurable.'
  }
};

export const CHARACTER_ORDER = ['amy', 'tails', 'silver', 'blaze'];

/**
 * Other OM survivors discovered during research — documented, not invented.
 * These exist in OM but do not have a clearly verified *ranged stun* kit, so
 * they are not playable in the trainer (no mechanics invented for them).
 */
export const DOCUMENTED_SURVIVORS = [
  { name: 'Sonic the Hedgehog', kit: 'Dropdash (stun), Peelout (carry survivors), high speed', ranged: 'No verified ranged stun' },
  { name: 'Knuckles the Echidna', kit: 'Punch (charged stun), Counter', ranged: 'No verified ranged stun' },
  { name: 'Dr. Eggman', kit: 'Double Jump, Metal Sonic: SUPPORT, Jetpack Boost, Energy Shield', ranged: 'Gadgets, no verified ranged stun' },
  { name: 'Metal Sonic', kit: 'Destructive Charge, self-sacrifice mechanics', ranged: 'No verified ranged stun' },
  { name: 'Cream the Rabbit', kit: 'Chao rock throws (slow fall / accurate), stealth, support', ranged: 'Rocks damage/slow — partial ranged kit' },
  { name: 'Shadow the Hedgehog', kit: 'Gun, Chaos Snap, Dash Boost', ranged: 'Gun exists; stun properties unverified' },
  { name: 'Rouge the Bat', kit: 'Grappling-Hook Pistol (upcoming)', ranged: 'Upcoming ability' }
];
