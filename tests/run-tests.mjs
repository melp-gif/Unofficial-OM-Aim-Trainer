/**
 * Headless unit tests for the trainer's core combat math:
 * distance metrics, swept-sphere hit detection, stun measurement (cap,
 * recovery frames, parry), style-point condition gating, analytics math and
 * the tarot deck's stat resolution.
 *
 * Run: npm test
 */
import assert from 'node:assert/strict';
import { horizontalDistance, segmentSphereHit, closestPointOnSegment, clamp } from '../src/utils/math.js';
import { EventBus } from '../src/utils/events.js';
import { StunSystem } from '../src/combat/stunSystem.js';
import { StyleScorer, STYLE_RULES, classifyShot } from '../src/scoring/stylePoints.js';
import { Analytics } from '../src/scoring/analytics.js';
import { TarotDeck } from '../src/abilities/tarot.js';
import { GAME, VERIFY } from '../src/config/gameConfig.js';
import { ABILITIES, TAILS_LASERS } from '../src/config/abilities.js';
import { TAROT_CARDS } from '../src/config/tarotCards.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function makeDummy(overrides = {}) {
  return {
    id: 1,
    alive: true,
    position: { x: 0, y: 0, z: -80 },
    stunState: 'none',
    stunRecord: null,
    stunEndsAt: 0,
    recoveryUntil: 0,
    canParry: false,
    ...overrides
  };
}

console.log('\n— math —');
test('horizontalDistance ignores Y and matches 3-4-5', () => {
  const a = { x: 0, y: 50, z: 0 };
  const b = { x: 3, y: -20, z: 4 };
  assert.ok(Math.abs(horizontalDistance(a, b) - 5) < 1e-9);
});

test('closestPointOnSegment clamps to endpoints', () => {
  const p = { x: 0, y: 0, z: 10 };
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 0, y: 0, z: 1 };
  const c = closestPointOnSegment(p, a, b, { x: 0, y: 0, z: 0, t: 0 });
  assert.ok(Math.abs(c.z - 1) < 1e-9, 'should clamp to segment end b');
});

test('segmentSphereHit detects swept path (no tunneling)', () => {
  const a = { x: 0, y: 0, z: -5 };
  const b = { x: 0, y: 0, z: 5 };
  const center = { x: 0, y: 0, z: 0 };
  assert.ok(segmentSphereHit(a, b, center, 1), 'fast segment must still hit');
  assert.equal(segmentSphereHit(a, b, { x: 10, y: 0, z: 0 }, 1), null);
});

console.log('\n— stun system —');
test('stun cap: never applies more than 8s (verified OM rule)', () => {
  const events = new EventBus();
  const ss = new StunSystem(events);
  const dummy = makeDummy();
  const rec = ss.applyStun(dummy, 12, { abilityId: 'x', isRanged: true });
  assert.ok(rec);
  assert.equal(rec.appliedSeconds, GAME.stunCapSeconds);
  assert.equal(rec.cappedFrom, 12);
});

test('measured duration is computed live, not hardcoded', () => {
  const events = new EventBus();
  const ss = new StunSystem(events);
  const dummy = makeDummy();
  const rec = ss.applyStun(dummy, 2.5, { abilityId: 'x', isRanged: true });
  ss.update(1.0);
  ss.update(1.0);
  ss.update(0.5);
  const finished = ss.finishStun(dummy);
  assert.ok(finished.actualSeconds != null);
  assert.ok(Math.abs(finished.actualSeconds - 2.5) < 0.01, `measured ${finished.actualSeconds}`);
});

test('recovery frame rejects immediate re-stun', () => {
  const events = new EventBus();
  const ss = new StunSystem(events);
  const dummy = makeDummy();
  ss.applyStun(dummy, 1, { abilityId: 'x', isRanged: true });
  ss.update(1);
  ss.finishStun(dummy);
  const rejected = ss.applyStun(dummy, 1, { abilityId: 'x', isRanged: true });
  assert.equal(rejected, null);
  ss.update(GAME.stunRecoverySeconds + 0.1);
  const accepted = ss.applyStun(dummy, 1, { abilityId: 'x', isRanged: true });
  assert.ok(accepted);
});

test('V1 parry blocks non-ranged stuns only', () => {
  const events = new EventBus();
  const ss = new StunSystem(events);
  const dummy = makeDummy({ canParry: true });
  assert.equal(ss.applyStun(dummy, 2, { isRanged: false }), null);
  ss.update(2);
  assert.ok(ss.applyStun(dummy, 2, { isRanged: true }));
});

console.log('\n— style scoring —');
test('bonuses only fire when conditions are met', () => {
  const scorer = new StyleScorer();
  const plain = scorer.evaluateHit({
    distance: 20, targetSpeed: 0, targetWasWindingUp: false, approachSpeed: 0,
    hitOffset: 99, aimTolerance: 1.6, abilityRange: 0, travelTime: 0.05,
    targetWasMoving: false, dummyId: 1, gameTime: 10, basePoints: 100
  });
  assert.equal(plain.bonuses.length, 0, 'a plain shot earns no bonuses');
  assert.equal(plain.total, 100);

  const fancy = scorer.evaluateHit({
    distance: 95, targetSpeed: 12, targetWasWindingUp: true, approachSpeed: 8,
    hitOffset: 0.3, aimTolerance: 1.6, abilityRange: 100, travelTime: 0.6,
    targetWasMoving: true, dummyId: 2, gameTime: 12, basePoints: 100
  });
  const ids = fancy.bonuses.map((b) => b.id);
  for (const expected of ['long_range', 'moving_target', 'interrupted_attack', 'approaching', 'precision', 'near_max_range', 'skillshot_travel', 'rapid_switch']) {
    assert.ok(ids.includes(expected), `expected ${expected}`);
  }
  // each rule fires at most once
  assert.equal(new Set(ids).size, ids.length, 'no duplicate rules');
});

test('combo chain scales and resets outside the window', () => {
  const scorer = new StyleScorer();
  const mk = (gameTime, dummyId = 1) => scorer.evaluateHit({
    distance: 20, targetSpeed: 0, targetWasWindingUp: false, approachSpeed: 0,
    hitOffset: 99, aimTolerance: 1.6, abilityRange: 0, travelTime: 0,
    targetWasMoving: false, dummyId, gameTime, basePoints: 100
  });
  const h1 = mk(0);
  const h2 = mk(2);
  const h3 = mk(4);
  assert.equal(h1.combo, 1);
  assert.equal(h2.combo, 2);
  assert.equal(h3.combo, 3);
  assert.ok(h3.bonuses.some((b) => b.id === 'combo'));
  const h4 = mk(100);
  assert.equal(h4.combo, 1, 'combo resets after the window');
});

test('classification strings reflect live conditions', () => {
  const s = classifyShot({ distance: 120, targetSpeed: 10, travelTime: 0.6, hitOffset: 0.2, aimTolerance: 1.6 });
  assert.ok(s.includes('Long-Range'));
  assert.ok(s.includes('Moving Target'));
  assert.ok(s.includes('Lead Shot'));
  assert.ok(s.includes('Precision'));
});

console.log('\n— analytics —');
test('accuracy and averages compute from live records', () => {
  // stub localStorage absence — Analytics falls back to memory
  const an = new Analytics();
  an.resetSession();
  an.recordShot({ abilityId: 'a', characterId: 'amy' });
  an.recordHit({ abilityId: 'a', characterId: 'amy', movementMode: 'stationary' });
  an.recordStun({ abilityId: 'a', characterId: 'amy', actualSeconds: 2.5, distance: 80, travelTime: 0.5 }, 'stationary');
  an.recordShot({ abilityId: 'a', characterId: 'amy' });
  an.recordMiss({ abilityId: 'a', characterId: 'amy', movementMode: 'moving' });
  const s = an.getSummary();
  assert.equal(s.shots, 2);
  assert.equal(s.hits, 1);
  assert.equal(s.accuracy, 50);
  assert.equal(s.avgStunDuration, 2.5);
  assert.equal(s.longestHit, 80);
  assert.equal(s.byMovement.stationary.stuns, 1);
});

console.log('\n— tarot deck —');
test('tarot modifiers resolve and override hammer stun', () => {
  const deck = new TarotDeck(new EventBus());
  // deterministic rig: force two cards
  deck.cards = [
    { card: TAROT_CARDS.fool, rolled: { speedAdd: 1.5, stunOverride: 2.0, damageMult: 1, revealRadius: 0, healPerSecond: 0, hammerKnockbackBonus: 0, visionLoss: false } },
    { card: TAROT_CARDS.emperor, rolled: { speedAdd: 1, stunOverride: null, damageMult: 0.85, revealRadius: 0, healPerSecond: 0, hammerKnockbackBonus: 0, visionLoss: false } }
  ];
  const mods = deck.getModifiers();
  assert.equal(mods.speedAdd, 2.5);
  assert.ok(Math.abs(mods.damageMult - 0.85) < 1e-9);
  assert.equal(deck.getHammerStunSeconds(3.0), 2.0, 'The Fool overrides base stun');

  deck.cards = [
    { card: TAROT_CARDS.strength, rolled: { speedAdd: -3, stunOverride: 5.0, damageMult: 1.1, revealRadius: 0, healPerSecond: 0, hammerKnockbackBonus: 10, visionLoss: false } }
  ];
  assert.equal(deck.getHammerStunSeconds(3.0), 5.0);
  const m2 = deck.getModifiers();
  assert.equal(m2.hammerKnockbackBonus, 10);
});

test('The Moon rolls randomised effects (verified random card)', () => {
  const deck = new TarotDeck(new EventBus());
  let sawVariation = false;
  for (let i = 0; i < 40; i++) {
    const { rolled } = deck._drawOne();
    if (rolled.visionLoss || rolled.speedAdd !== 0) sawVariation = true;
  }
  assert.ok(sawVariation);
});

console.log('\n— ability database —');
test('every ability references valid stun config + verification label', () => {
  const valid = new Set(Object.values(VERIFY));
  for (const [id, a] of Object.entries(ABILITIES)) {
    assert.equal(a.id, id);
    assert.ok(valid.has(a.verified), `${id} verification label`);
    assert.ok(a.stun && typeof a.stun.canStun === 'boolean', `${id} stun config`);
    assert.ok(a.name && a.shortName, `${id} names`);
    assert.ok(a.sourceNote && a.sourceNote.length > 20, `${id} source note`);
  }
});

test('Tails laser modes include 2 verified + announced variants, all distinct', () => {
  assert.equal(TAILS_LASERS.length, 5);
  assert.equal(new Set(TAILS_LASERS).size, 5);
  const verified = TAILS_LASERS.filter((id) => ABILITIES[id].verified === VERIFY.VERIFIED);
  const announced = TAILS_LASERS.filter((id) => ABILITIES[id].verified === VERIFY.ANNOUNCED);
  assert.equal(verified.length, 2, 'Default + Burst are the verified current modes');
  assert.equal(announced.length, 3, 'Orbs/Blast/Shockwave are announced');
  assert.ok(ABILITIES.tails_laser_burst.stun.pierceIframes, 'Burst pierces i-frames (verified)');
  assert.ok(ABILITIES.tails_laser_beam.beam.duration > 0);
});

test('Amy hammer family preserves distinct mechanics', () => {
  assert.equal(ABILITIES.amy_hammer.category, 'melee');
  assert.equal(ABILITIES.amy_hammer_throw.category, 'projectile');
  assert.equal(ABILITIES.amy_hammer.windup, 2.0, 'verified 2s stance');
  assert.equal(ABILITIES.amy_hammer.melee.range, 8, 'verified 8 stud swing');
  assert.equal(ABILITIES.amy_hammer_throw.projectile.returnAfter, 8, 'verified 8s return');
  assert.deepEqual(ABILITIES.amy_hammer_throw.disarms, ['amy_hammer'], 'hammer locked while thrown (verified)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
