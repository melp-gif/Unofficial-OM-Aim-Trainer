import { GAME } from '../config/gameConfig.js';

/**
 * Style-point rules. A bonus is awarded ONLY when its condition is actually
 * met by live gameplay values — no speculative stacking. Each hit runs the
 * rule list once and each rule can fire at most once per hit event.
 */
export const STYLE_RULES = [
  {
    id: 'long_range',
    label: 'Long-Range',
    points: 100,
    test: (ctx) => ctx.distance >= GAME.style.longRangeDistance
  },
  {
    id: 'moving_target',
    label: 'Moving-Target Hit',
    points: 75,
    test: (ctx) => (ctx.targetSpeed ?? 0) >= GAME.style.movingTargetMinSpeed
  },
  {
    id: 'interrupted_attack',
    label: 'Attack-Interrupt',
    points: 125,
    test: (ctx) => !!ctx.targetWasWindingUp
  },
  {
    id: 'approaching',
    label: 'Approaching-EXE Hit',
    points: 60,
    test: (ctx) => (ctx.approachSpeed ?? 0) > 3
  },
  {
    id: 'precision',
    label: 'Precision Hit',
    points: 90,
    test: (ctx) => (ctx.hitOffset ?? 99) <= ctx.aimTolerance
  },
  {
    id: 'near_max_range',
    label: 'Near-Max-Range',
    points: 110,
    test: (ctx) => ctx.abilityRange > 0 && ctx.distance >= ctx.abilityRange * GAME.style.precisionNearMaxRangeFraction
  },
  {
    id: 'skillshot_travel',
    label: 'Travel-Time Lead',
    points: 80,
    test: (ctx) => (ctx.travelTime ?? 0) >= 0.45 && !!ctx.targetWasMoving
  },
  {
    id: 'rapid_switch',
    label: 'Rapid Target Switch',
    points: 95,
    test: (ctx) => ctx.lastHitDummyId != null && ctx.lastHitDummyId !== ctx.dummyId && (ctx.timeSinceLastHit ?? 99) <= GAME.style.rapidSwitchSeconds
  },
  {
    id: 'combo',
    label: 'Stun Chain',
    points: 0, // dynamic: 25 * combo
    test: (ctx) => ctx.combo >= 2,
    dynamic: (ctx) => 25 * ctx.combo
  }
];

export class StyleScorer {
  constructor() {
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lastHitAt = -999;
    this.lastHitDummyId = null;
    this.lastEvents = [];
  }

  /**
   * @param ctx { distance, targetSpeed, targetWasWindingUp, approachSpeed,
   *              hitOffset, aimTolerance, abilityRange, travelTime,
   *              targetWasMoving, dummyId, gameTime, basePoints }
   */
  evaluateHit(ctx) {
    const timeSinceLastHit = ctx.gameTime - this.lastHitAt;
    const fullCtx = {
      ...ctx,
      timeSinceLastHit,
      lastHitDummyId: this.lastHitDummyId,
      combo: 0 // filled after combo update
    };

    // combo update
    if (timeSinceLastHit <= GAME.style.comboWindowSeconds && timeSinceLastHit >= 0) {
      this.combo += 1;
    } else {
      this.combo = 1;
    }
    fullCtx.combo = this.combo;
    this.bestCombo = Math.max(this.bestCombo, this.combo);

    const bonuses = [];
    let total = ctx.basePoints ?? 100;

    for (const rule of STYLE_RULES) {
      if (rule.id === 'combo') {
        if (rule.test(fullCtx)) {
          const pts = rule.dynamic(fullCtx);
          bonuses.push({ id: rule.id, label: rule.label, points: pts });
          total += pts;
        }
        continue;
      }
      if (rule.test(fullCtx)) {
        bonuses.push({ id: rule.id, label: rule.label, points: rule.points });
        total += rule.points;
      }
    }

    this.score += total;
    this.lastHitAt = ctx.gameTime;
    this.lastHitDummyId = ctx.dummyId;

    const summary = {
      total,
      base: ctx.basePoints ?? 100,
      bonuses,
      combo: this.combo
    };
    this.lastEvents.unshift({ ...summary, at: ctx.gameTime, distance: ctx.distance, ability: ctx.abilityName });
    if (this.lastEvents.length > 30) this.lastEvents.pop();
    return summary;
  }

  resetSessionScore() {
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lastHitAt = -999;
    this.lastHitDummyId = null;
    this.lastEvents = [];
  }
}

/** Build the human-readable shot classification string. */
export function classifyShot(ctx) {
  const tags = [];
  if (ctx.distance >= GAME.style.longRangeDistance) tags.push('Long-Range');
  else if (ctx.distance < 15) tags.push('Point-Blank');
  if ((ctx.targetSpeed ?? 0) >= GAME.style.movingTargetMinSpeed) tags.push('Moving Target');
  if (ctx.targetWasWindingUp) tags.push('Windup Punish');
  if ((ctx.travelTime ?? 0) >= 0.45) tags.push('Lead Shot');
  if (ctx.hitOffset != null && ctx.hitOffset <= (ctx.aimTolerance ?? 1.2)) tags.push('Precision');
  if (tags.length === 0) tags.push('Standard Hit');
  return tags.join(' + ');
}
