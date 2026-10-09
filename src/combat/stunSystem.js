import { GAME, VERIFY } from '../config/gameConfig.js';

/**
 * StunSystem — applies stuns to EXE dummies and MEASURES the real elapsed
 * duration (never reports a hardcoded number): every stun records its own
 * start clock and computes actual elapsed time when the stunned state ends.
 *
 * Verified OM rule enforced: stun cap 8 seconds (update log 8/9/2025).
 * Approximation (configurable): post-stun "Stun Recovery Frame" during which
 * the EXE cannot be re-stunned.
 */
let stunIdCounter = 0;

export class StunSystem {
  constructor(events) {
    this.events = events;
    this.gameTime = 0;
    this.recentStuns = [];
  }

  update(dt) {
    this.gameTime += dt;
    // recovery timers are tracked on dummies themselves
  }

  /**
   * @param dummy   target EXE dummy
   * @param requestedSeconds nominal stun duration from the ability DB
   * @param meta    { abilityId, characterId, abilityName, verified, distance, travelTime, style }
   * @returns applied record or null if rejected (recovery frames / parry / etc.)
   */
  applyStun(dummy, requestedSeconds, meta = {}) {
    if (!dummy || !dummy.alive) return null;

    // V1-style parry: only ranged stuns connect (verified EXE trait)
    if (dummy.canParry && !meta.isRanged) {
      this.events.emit('stun_parry', { dummy, meta });
      return null;
    }

    // Stun Recovery Frame: EXE briefly immune right after a stun ends
    if (dummy.recoveryUntil && this.gameTime < dummy.recoveryUntil) {
      this.events.emit('stun_rejected', { dummy, meta, reason: 'recovery-frame' });
      return null;
    }

    // Cap the stun at the verified 8s maximum
    const capped = Math.min(requestedSeconds, GAME.stunCapSeconds);
    const wasStunned = dummy.stunState === 'stunned';

    const record = {
      id: ++stunIdCounter,
      dummyId: dummy.id,
      abilityId: meta.abilityId || 'unknown',
      abilityName: meta.abilityName || meta.abilityId || 'Unknown Ability',
      characterId: meta.characterId || 'unknown',
      verified: meta.verified || VERIFY.UNVERIFIED,
      requestedSeconds: requestedSeconds,
      appliedSeconds: capped,
      cappedFrom: requestedSeconds > GAME.stunCapSeconds ? requestedSeconds : null,
      startedAt: this.gameTime,
      endedAt: null,
      actualSeconds: null,
      distance: meta.distance ?? null,
      travelTime: meta.travelTime ?? null,
      isRanged: !!meta.isRanged,
      overlapRefresh: wasStunned
    };

    dummy.stunState = 'stunned';
    dummy.stunStartedAt = this.gameTime;
    dummy.stunEndsAt = this.gameTime + capped;
    dummy.stunRecord = record;
    dummy.stunRequestedSeconds = requestedSeconds;

    this.recentStuns.push(record);
    if (this.recentStuns.length > 200) this.recentStuns.shift();

    this.events.emit('stun_start', record);
    return record;
  }

  /** Call when a dummy's stun timer expires — measures ACTUAL elapsed duration. */
  finishStun(dummy) {
    const rec = dummy.stunRecord;
    if (!rec) return null;
    rec.endedAt = this.gameTime;
    rec.actualSeconds = rec.endedAt - rec.startedAt;
    dummy.stunState = 'recovering';
    dummy.stunRecord = null;
    dummy.recoveryUntil = this.gameTime + GAME.stunRecoverySeconds;
    dummy.stunFinishedCount = (dummy.stunFinishedCount || 0) + 1;
    this.events.emit('stun_end', rec);
    return rec;
  }

  /** Cancel stun without a scoring event (reset / despawn). */
  cancelStun(dummy) {
    if (dummy.stunRecord) {
      dummy.stunRecord.endedAt = this.gameTime;
      dummy.stunRecord.actualSeconds = dummy.stunRecord.endedAt - dummy.stunRecord.startedAt;
      dummy.stunRecord = null;
    }
    dummy.stunState = 'none';
    dummy.stunEndsAt = 0;
    dummy.recoveryUntil = 0;
  }
}
