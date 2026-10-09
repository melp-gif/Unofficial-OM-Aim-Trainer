import { VERIFY } from './gameConfig.js';

/**
 * EXE (Executioner) archetypes for the training dummy spawner.
 *
 * OM's verified Executioner roster (researched): 2011X, Kolossus, Tripwire,
 * 2017X, Starved, Furnace, Suture, V1, Chara, KING, Fleetway Super Sonic,
 * The Shadow, Lil Jort, Bear5.  Only combat behaviour that is documented is
 * reproduced; attack names/damage numbers that are not documented are marked
 * UNVERIFIED and fully configurable in the spawner panel.
 *
 * Verified behaviours referenced:
 *  - 2011X: fast chaser, Charge attack that can grab/ragdoll, Invisibility,
 *    Rage Mode that grows as stuns land (stunning 2011X feeds Rage).
 *  - Kolossus: heavy grappler with Grab / Charge and a Block stance.
 *  - Tripwire: trap-laying killer; punishes stuns landed while a victim is
 *    grabbed (stun reduced to 2s, attacker damaged/shocked).
 *  - V1: PARRY — only ranged stuns (e.g. Laser Cannon) or counters connect.
 */
export const EXE_TYPES = {
  '2011x': {
    id: '2011x',
    name: '2011X',
    subtitle: 'Fast chaser archetype (verified EXE)',
    verified: VERIFY.VERIFIED,
    color: 0x1c1c28,
    accent: 0xff2233,
    speed: 22,
    health: 100,
    damage: 25,
    attackRange: 10,
    windup: 1.15,
    attackCooldown: 2.2,
    traits: ['Charge-style lunge attack (verified)', 'Rage Mode grows when stunned (verified)', 'Invisibility flicker (verified)'],
    canParry: false
  },
  kolossus: {
    id: 'kolossus',
    name: 'Kolossus',
    subtitle: 'Heavy grappler archetype (verified EXE)',
    verified: VERIFY.VERIFIED,
    color: 0x2a1420,
    accent: 0xff6622,
    speed: 15,
    health: 220,
    damage: 35,
    attackRange: 12,
    windup: 1.7,
    attackCooldown: 3.2,
    traits: ['Grab / Charge attacks (verified)', 'Block stance (verified)', 'Slow but brutal'],
    canParry: false
  },
  tripwire: {
    id: 'tripwire',
    name: 'Tripwire',
    subtitle: 'Trap & punish archetype (verified EXE)',
    verified: VERIFY.VERIFIED,
    color: 0x241826,
    accent: 0xff44aa,
    speed: 18,
    health: 120,
    damage: 20,
    attackRange: 9,
    windup: 1.3,
    attackCooldown: 2.6,
    traits: ['Reachout grab (verified)', 'Punishes stuns during grabs: stun cut to 2s (verified)'],
    canParry: false
  },
  v1: {
    id: 'v1',
    name: 'V1',
    subtitle: 'Parry duellist archetype (verified EXE)',
    verified: VERIFY.VERIFIED,
    color: 0x16202a,
    accent: 0x33ffcc,
    speed: 20,
    health: 140,
    damage: 22,
    attackRange: 9,
    windup: 1.0,
    attackCooldown: 2.0,
    traits: ['PARRY: melee stuns are blocked — only RANGED stuns connect (verified)'],
    canParry: true
  }
};

export const EXE_TYPE_ORDER = ['2011x', 'kolossus', 'tripwire', 'v1'];

/** Movement patterns for the Moving / Full-Movement dummy modes. */
export const MOVEMENT_PATTERNS = ['straight', 'strafe', 'wander', 'zigzag', 'random'];

/** The four required behaviour modes of the spawner. */
export const DUMMY_MODES = {
  stationary: {
    id: 'stationary',
    name: 'Stationary EXE',
    desc: 'Fixed position at an adjustable distance and facing. For projectile accuracy and max-range practice.'
  },
  moving: {
    id: 'moving',
    name: 'Moving EXE',
    desc: 'Moves around a configurable area (straight-line, strafing, wandering, zigzag) at an adjustable speed. For leading shots on moving targets.'
  },
  attacking: {
    id: 'attacking',
    name: 'Attacking EXE',
    desc: 'Telegraphed attacks with real windup windows and hitboxes. Practice landing stuns during attack windups (vulnerability windows).'
  },
  full: {
    id: 'full',
    name: 'Full-Movement EXE',
    desc: 'Fully active opponent: pursues, repositions, attacks, reacts to stuns. Challenging but never invulnerable — respects the selected difficulty.'
  }
};

/** Default spawner settings (everything exposed in the panel). */
export function defaultSpawnConfig() {
  return {
    exeType: '2011x',
    mode: 'full',
    count: 1,
    distance: 60,           // studs from player spawn
    speed: 1.0,             // multiplier
    aggression: 0.7,        // 0..1
    difficulty: 'normal',   // easy | normal | hard
    health: 100,
    damage: 25,
    canDamagePlayer: true,
    autoRespawn: true,
    resetAfterStun: true,
    showHealthBar: true,
    showStunStatus: true,
    showDistance: true,
    pattern: 'zigzag',
    areaRadius: 45,
    facing: 0               // degrees; -1 = face player
  };
}
