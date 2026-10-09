import { TAROT_CARDS, TAROT_CARD_ORDER, AMY_BASE_STUN } from '../config/tarotCards.js';
import { rand, pick } from '../utils/math.js';

/**
 * Amy's Tarot Card deck (verified OM passive).
 * Holds 2 active cards; each applies its buff/debuff to the player's live
 * combat stats. Reroll redraws both. The Moon rolls random modifiers at draw.
 */
export class TarotDeck {
  constructor(events) {
    this.events = events;
    this.cards = []; // [{ card, rolledEffects }]
  }

  drawInitial() {
    this.cards = [];
    this._drawOne();
    this._drawOne();
    this.events.emit('tarot_changed', this.getState());
    return this.getState();
  }

  reroll() {
    this.cards = [];
    this._drawOne();
    this._drawOne();
    this.events.emit('tarot_rerolled', this.getState());
    return this.getState();
  }

  _drawOne() {
    const key = pick(TAROT_CARD_ORDER);
    const card = TAROT_CARDS[key];
    const rolled = this._rollEffects(card);
    this.cards.push({ card, rolled });
    return { card, rolled };
  }

  _rollEffects(card) {
    const e = card.effects;
    const rolled = {
      speedAdd: e.speedAdd ?? 0,
      stunOverride: e.stunOverride ?? null,
      damageMult: e.damageMult ?? 1,
      revealRadius: e.revealRadius ?? 0,
      healPerSecond: e.healPerSecond ?? 0,
      hammerKnockbackBonus: e.hammerKnockbackBonus ?? 0,
      visionLoss: false
    };
    if (card.random) {
      // The Moon: verified as a random roll
      rolled.speedAdd = pick(e.speedPool);
      rolled.damageMult = pick(e.damagePool);
      rolled.visionLoss = Math.random() < (e.visionLossChance ?? 0.45);
      if (rolled.visionLoss) rolled.speedAdd = Math.abs(rolled.speedAdd) * 0.5;
    }
    return rolled;
  }

  getState() {
    return this.cards.map((c) => ({
      id: c.card.id,
      name: c.card.name,
      depicted: c.card.depicted,
      colorCss: c.card.colorCss,
      good: c.card.good,
      bad: c.card.bad,
      flavour: c.card.flavour,
      rolled: c.rolled
    }));
  }

  /** Sum of all live modifiers from the held cards. */
  getModifiers() {
    let speedAdd = 0;
    let damageMult = 1;
    let healPerSecond = 0;
    let stunOverride = null;
    let revealRadius = 0;
    let hammerKnockbackBonus = 0;
    let visionLoss = false;
    for (const { rolled } of this.cards) {
      speedAdd += rolled.speedAdd;
      damageMult *= rolled.damageMult;
      healPerSecond += rolled.healPerSecond;
      revealRadius = Math.max(revealRadius, rolled.revealRadius);
      hammerKnockbackBonus += rolled.hammerKnockbackBonus || 0;
      if (rolled.visionLoss) visionLoss = true;
      if (rolled.stunOverride != null) {
        // If two cards both set stun, the shorter/longer one wins per OM's
        // "highest achievable" note — here the LAST drawn override applies,
        // matching how card pairs resolve in wiki-documented combos.
        stunOverride = rolled.stunOverride;
      }
    }
    return { speedAdd, damageMult, healPerSecond, stunOverride, revealRadius, hammerKnockbackBonus, visionLoss };
  }

  /** Resolve the actual stun duration for Amy's hammer-family abilities. */
  getHammerStunSeconds(baseSeconds = AMY_BASE_STUN) {
    const mods = this.getModifiers();
    return mods.stunOverride != null ? mods.stunOverride : baseSeconds;
  }

  applyToPlayer(player) {
    const mods = this.getModifiers();
    player.speedAdd = mods.speedAdd;
    player.damageMult = mods.damageMult;
    player.visionLoss = mods.visionLoss;
    player.revealRadius = mods.revealRadius;
    player.healPerSecondBonus = mods.healPerSecond;
  }
}
