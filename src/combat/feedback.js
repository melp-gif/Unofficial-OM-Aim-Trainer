import { classifyShot } from '../scoring/stylePoints.js';
import { VERIFY_LABEL } from '../config/gameConfig.js';

/**
 * FeedbackDirector — turns real combat events into the three required
 * feedback surfaces: floating text near the target, the compact combat feed,
 * and the detailed results panel. Every number shown is measured from live
 * gameplay (measured stun duration, measured impact distance, travel time).
 */
export class FeedbackDirector {
  constructor(events, styleScorer, analytics, audio) {
    this.events = events;
    this.style = styleScorer;
    this.analytics = analytics;
    this.audio = audio;
    this.lastReport = null;
    this.reports = [];

    events.on('stun_start', (record) => this._onStunStart(record));
    events.on('stun_end', (record) => this._onStunEnd(record));
  }

  /**
   * Called by the combat director when a hit lands. Computes style bonuses
   * from live hit context and emits a full stun-confirmed report.
   */
  reportHit({ record, ctx, dummy }) {
    const styleSummary = this.style.evaluateHit({
      distance: ctx.distance,
      targetSpeed: ctx.targetSpeed,
      targetWasWindingUp: ctx.targetWasWindingUp,
      approachSpeed: ctx.approachSpeed,
      hitOffset: ctx.hitOffset,
      aimTolerance: ctx.aimTolerance ?? 1.6,
      abilityRange: ctx.abilityRange ?? 0,
      travelTime: ctx.travelTime,
      targetWasMoving: ctx.targetWasMoving,
      dummyId: dummy.id,
      gameTime: ctx.gameTime,
      basePoints: ctx.basePoints ?? 100,
      abilityName: record.abilityName
    });

    this.analytics.recordStyle(styleSummary.total, styleSummary.combo);

    const report = {
      type: 'stun_confirmed',
      title: 'STUN CONFIRMED!',
      abilityName: record.abilityName,
      characterId: record.characterId,
      characterName: ctx.characterName || record.characterId,
      requestedSeconds: record.requestedSeconds,
      appliedSeconds: record.appliedSeconds,
      measuredSeconds: record.actualSeconds, // null until stun completes
      distance: record.distance,
      travelTime: record.travelTime,
      stylePoints: styleSummary.total,
      styleBreakdown: styleSummary.bonuses,
      combo: styleSummary.combo,
      classification: classifyShot({
        distance: ctx.distance,
        targetSpeed: ctx.targetSpeed,
        targetWasWindingUp: ctx.targetWasWindingUp,
        travelTime: ctx.travelTime,
        hitOffset: ctx.hitOffset,
        aimTolerance: ctx.aimTolerance ?? 1.6
      }),
      verifiedLabel: VERIFY_LABEL[record.verified] || record.verified,
      capped: record.cappedFrom != null,
      dummyId: dummy.id,
      at: ctx.gameTime
    };

    this.lastReport = report;
    this.reports.unshift(report);
    if (this.reports.length > 50) this.reports.pop();

    this.audio.play('stun_confirm');
    this.events.emit('stun_report', report);
    return report;
  }

  _onStunStart(record) {
    this.events.emit('combat_feed', {
      kind: 'stun_start',
      text: `⚡ ${record.abilityName} — stun applied (${record.appliedSeconds.toFixed(2)}s requested)`,
      at: performance.now()
    });
  }

  _onStunEnd(record) {
    // Measured duration confirmed — update the report + feed
    const report = this.reports.find((r) => r.at != null && r.abilityName === record.abilityName && r.dummyId === record.dummyId);
    if (report) {
      report.measuredSeconds = record.actualSeconds;
    }
    this.events.emit('stun_measured', record);
    this.events.emit('combat_feed', {
      kind: 'stun_measured',
      text: `✓ Stun lasted ${record.actualSeconds.toFixed(2)}s (requested ${record.requestedSeconds.toFixed(2)}s${record.cappedFrom ? ', capped at 8s' : ''})`,
      at: performance.now()
    });
  }

  reportMiss(abilityName) {
    this.audio.play('miss');
    this.events.emit('combat_feed', {
      kind: 'miss',
      text: `✗ ${abilityName} missed`,
      at: performance.now()
    });
  }

  reportParry(abilityName) {
    this.events.emit('combat_feed', {
      kind: 'parry',
      text: `🛡 ${abilityName} was PARRIED — only ranged stuns connect (verified V1 trait)`,
      at: performance.now()
    });
  }
}
