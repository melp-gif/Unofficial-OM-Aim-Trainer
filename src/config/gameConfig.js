/**
 * Global game tunables. Every mechanical number lives here or in the
 * ability/character/exe databases so the game can be re-balanced without
 * rewriting gameplay code.
 *
 * UNIT CONVENTION: 1 world unit = 1 Roblox-style "stud". All distances in the
 * game (hit ranges, spawn distances, impact distance feedback) are measured
 * in studs on the horizontal plane unless noted otherwise.
 */
export const GAME = {
  title: 'Unofficial OM Aim Trainer',

  // --- Combat rules (verified against OM community sources where noted) ---
  /** Verified: OM update log 8/9/2025 — "Added stun cap on Executioners: 8 seconds maximum". */
  stunCapSeconds: 8.0,
  /** Approximation of OM's "Stun Recovery Frame": after a stun ends, the EXE
   *  briefly cannot be re-stunned (v0.2 patch: "Fixed EXE's Stun Recovery Frame
   *  (some Survivors can no longer attack EXE during it)"). Configurable. */
  stunRecoverySeconds: 0.75,
  /** Stun stack policy: a new stun never extends beyond cap and never fires a
   *  second primary scoring event for the same cast. */
  allowStunRefreshDuringStun: true,

  /** Distance measurement: horizontal (XZ-plane) distance, player chest
   *  position -> target root position at the moment of impact. */
  distanceMethod: 'horizontal-chest-to-root',

  /** Player movement (approximation of Roblox survivor walkspeed, in studs/s). */
  player: {
    walkSpeed: 16,
    sprintSpeed: 24,
    acceleration: 90,
    friction: 12,
    jumpVelocity: 32,
    gravity: 80,
    maxHealth: 100,
    regenPerSecond: 6
  },

  /** Performance guards for the dummy spawner. */
  maxDummies: 12,
  maxProjectiles: 64,

  /** Style scoring. */
  style: {
    longRangeDistance: 80,
    precisionNearMaxRangeFraction: 0.9,
    movingTargetMinSpeed: 4,
    rapidSwitchSeconds: 3.5,
    comboWindowSeconds: 6
  },

  /** Persistence key for session history (localStorage). */
  storageKey: 'om-aim-trainer-sessions-v1'
};

/** Verification status labels used across every data module. */
export const VERIFY = {
  VERIFIED: 'verified',           // confirmed from OM wiki / patch notes / gameplay docs
  ANNOUNCED: 'announced',         // officially announced/reworked in OM but numbers uncertain
  UNVERIFIED: 'unverified',       // mechanic exists in OM but exact numbers not documented
  VARIANT: 'practice-variant'     // NOT an official OM mechanic — custom training variation
};

export const VERIFY_LABEL = {
  verified: 'VERIFIED IN OM',
  announced: 'ANNOUNCED IN OM',
  unverified: 'IN OM — VALUES UNVERIFIED',
  'practice-variant': 'PRACTICE VARIANT — NOT OFFICIAL OM'
};
