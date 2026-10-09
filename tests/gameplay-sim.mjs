/**
 * HEADLESS GAMEPLAY SIMULATION
 * ============================
 * Runs the real combat pipeline (projectiles, beams, stun measurement, style
 * scoring, analytics, EXE AI) against a real THREE.Scene with jsdom-provided
 * DOM stubs. No WebGL required — this tests gameplay logic, not pixels.
 *
 * Scenarios:
 *   1. Amy Hammer Throw lands a stun at the expected distance; measured
 *      duration is real; exactly one scoring event.
 *   2. Tails Plasma Beam scores exactly ONE stun per cast even with multi-frame
 *      contact (no per-frame duplicate points).
 *   3. V1 parries the melee Hammer but not the ranged Laser (verified trait).
 *   4. No-cooldown training allows instant reuse while windups still apply.
 *   5. Style bonuses fire only when live conditions are met (moving target).
 *   6. Stun cap of 8s is enforced on a long beam stun request.
 *   7. EXE attack windup actually damages the player in Full-Movement mode.
 *
 * Run: npm test  (this file is run from tests/run-tests.mjs's sibling)
 */
import { JSDOM } from 'jsdom';

/* ---------- DOM / canvas stubs (before importing game modules) ---------- */
const dom = new JSDOM('<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>', {
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
try {
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
} catch { /* node 22 ships a navigator global */ }
// note: do NOT override global.performance — jsdom's Performance.now() would
// recurse through the node global and blow the stack.
global.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

const makeCtx2d = () => {
  const noop = () => {};
  return new Proxy({}, {
    get: (t, prop) => {
      if (prop === 'canvas') return { width: 256, height: 128 };
      if (prop === 'measureText') return () => ({ width: 40 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return noop;
    },
    set: () => true
  });
};
dom.window.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === '2d') return makeCtx2d();
  return null;
};

/* ---------- import real game modules ---------- */
const THREE = await import('three');
const { EventBus } = await import('../src/utils/events.js');
const { AudioEngine } = await import('../src/engine/audio.js');
const { Arena } = await import('../src/world/arena.js');
const { Player } = await import('../src/characters/player.js');
const { ProjectileSystem } = await import('../src/combat/projectiles.js');
const { BeamSystem } = await import('../src/combat/beams.js');
const { StunSystem } = await import('../src/combat/stunSystem.js');
const { FeedbackDirector } = await import('../src/combat/feedback.js');
const { StyleScorer } = await import('../src/scoring/stylePoints.js');
const { Analytics } = await import('../src/scoring/analytics.js');
const { TarotDeck } = await import('../src/abilities/tarot.js');
const { CombatDirector } = await import('../src/abilities/abilitySystem.js');
const { DummySpawner } = await import('../src/exe/spawner.js');
const { GAME } = await import('../src/config/gameConfig.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  ✓ ${name}`); })
    .catch((err) => { failed++; console.error(`  ✗ ${name}\n    ${err.message}`); });
}

/* ---------- fake input ---------- */
function mockInput() {
  return {
    moveAxis: { x: 0, y: 0 },
    jumping: false,
    sprinting: false,
    sensitivity: 1,
    isTouchDevice: false,
    consumeLookDelta: () => ({ x: 0, y: 0 }),
    isMovePressed: () => false
  };
}

/* ---------- build a full game stack (minus renderer) ---------- */
function buildStack() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 1200);
  const events = new EventBus();
  const audio = new AudioEngine();
  const arena = new Arena(scene);
  const player = new Player(scene, camera, arena);
  const projectiles = new ProjectileSystem(scene, audio);
  const beams = new BeamSystem(scene, audio);
  const stunSystem = new StunSystem(events);
  const styleScorer = new StyleScorer();
  const analytics = new Analytics();
  const feedback = new FeedbackDirector(events, styleScorer, analytics, audio);
  const tarot = new TarotDeck(events);
  const spawner = new DummySpawner(scene, audio, events);
  const combat = new CombatDirector({
    scene, player, projectiles, beams, stunSystem,
    feedback, analytics, tarot, spawner, audio, events
  });
  const input = mockInput();
  return { scene, camera, events, audio, arena, player, projectiles, beams, stunSystem, styleScorer, analytics, feedback, tarot, spawner, combat, input };
}

/** Step the simulation one fixed frame. */
function step(stack, dt, gameTime, steps = 1) {
  for (let i = 0; i < steps; i++) {
    stack.player.update(dt, stack.input, true /* frozen look/move for determinism */);
    stack.combat.update(dt, gameTime + i * dt);
    stack.stunSystem.update(dt);
    stack.spawner.update(dt, stack.player, gameTime + i * dt, stack.stunSystem);
    stack.projectiles.update(dt, stack.spawner.dummies, stack.player.position);
    stack.beams.update(dt, stack.spawner.dummies, stack.player.position);
  }
  return gameTime + steps * dt;
}

/** Put the crosshair on a target like a human player would (yaw + pitch). */
function aimAt(s, worldPos) {
  const dx = worldPos.x - s.player.position.x;
  const dz = worldPos.z - s.player.position.z;
  s.player.yaw = Math.atan2(dx, dz);
  const horiz = Math.hypot(dx, dz) || 1;
  const camY = s.player.position.y + 5.4;
  s.player.pitch = Math.atan2((worldPos.y ?? 2.1) - camY, horiz);
  s.player.update(1 / 60, s.input, true);
}

console.log('\n— gameplay simulation —');

await test('Hammer Throw: one stun event, correct distance, measured duration', () => {
  const s = buildStack();
  s.player.yaw = Math.PI; // facing -Z (dummy lane)
  s.player.update(1 / 60, s.input, true);

  s.spawner.setConfig({ mode: 'stationary', facing: -1, distance: 60, canDamagePlayer: false });
  const dummy = s.spawner.spawn(s.player.position, s.player.yaw);
  dummy.position.set(0, 0, -60);
  dummy.homePosition.copy(dummy.position);
  aimAt(s, dummy.getHitSphere().center);

  const reports = [];
  s.events.on('stun_report', (r) => reports.push(r));
  const started = [];
  s.events.on('stun_start', (r) => started.push(r));

  s.combat.setCharacter('amy');
  // fix the deck to a known stun value (The Fool = 2.0s override)
  s.tarot.cards = [{ card: { id: 'fool' }, rolled: { speedAdd: 1.5, stunOverride: 2.0, damageMult: 1, revealRadius: 0, healPerSecond: 0, hammerKnockbackBonus: 0, visionLoss: false } }];

  const ok = s.combat.activateSlot(1); // Hammer Throw (Q)
  if (!ok) throw new Error('activation failed');

  // windup 0.55s then projectile at 110 studs/s over 60 studs ≈ 0.55s
  let t = 0;
  for (let i = 0; i < 120 && reports.length === 0; i++) t = step(s, 1 / 60, t, 1);

  if (reports.length !== 1) throw new Error(`expected 1 stun report, got ${reports.length}`);
  const r = reports[0];
  if (Math.abs(r.distance - 60) > 2.5) throw new Error(`distance ${r.distance} != ~60`);
  if (Math.abs(r.requestedSeconds - 2.0) > 0.01) throw new Error(`requested ${r.requestedSeconds} != 2.0 (Fool override)`);
  if (started.length !== 1) throw new Error('stun_start not unique');
  if (dummy.stunState !== 'stunned') throw new Error('dummy not stunned');

  // run out the stun and check the MEASURED duration
  let measured = null;
  s.events.on('stun_measured', (rec) => { measured = rec.actualSeconds; });
  for (let i = 0; i < 300 && measured === null; i++) t = step(s, 1 / 60, t, 1);
  if (measured === null) throw new Error('no measured duration emitted');
  if (Math.abs(measured - 2.0) > 0.12) throw new Error(`measured ${measured.toFixed(2)}s != ~2.0s`);
});

await test('Plasma Beam: exactly one primary stun per cast despite multi-frame contact', () => {
  const s = buildStack();
  s.player.yaw = Math.PI;
  s.player.update(1 / 60, s.input, true);
  s.spawner.setConfig({ mode: 'stationary', facing: -1, canDamagePlayer: false });
  const dummy = s.spawner.spawn(s.player.position, s.player.yaw);
  dummy.position.set(0, 0, -120);
  dummy.homePosition.copy(dummy.position);
  aimAt(s, dummy.getHitSphere().center);

  const started = [];
  s.events.on('stun_start', (r) => started.push(r));
  const reports = [];
  s.events.on('stun_report', (r) => reports.push(r));

  s.combat.setCharacter('tails');
  s.combat.setNoCooldown(true);
  s.combat.setLaserMode('tails_laser_beam');
  s.combat.activateSlot(0); // begin charge (5s)

  let t = 0;
  t = step(s, 1 / 60, t, 320); // charge up
  s.combat.fire();             // fire the beam
  t = step(s, 1 / 60, t, 20);  // beam lives 4s; keep contact the whole time

  if (started.length !== 1) throw new Error(`beam produced ${started.length} stun events (must be 1)`);
  if (reports.length !== 1) throw new Error(`beam produced ${reports.length} score reports (must be 1)`);
  if (Math.abs(started[0].requestedSeconds - 5.0) > 0.01) throw new Error('beam stun should be 5s');
});

await test('V1 parry: melee Hammer is blocked, ranged Card Toss connects (verified)', () => {
  const s = buildStack();
  s.player.yaw = Math.PI;
  s.player.update(1 / 60, s.input, true);
  s.spawner.setConfig({ exeType: 'v1', mode: 'stationary', facing: -1, canDamagePlayer: false });
  const dummy = s.spawner.spawn(s.player.position, s.player.yaw);
  dummy.position.set(0, 0, -6);
  dummy.homePosition.copy(dummy.position);
  aimAt(s, dummy.getHitSphere().center);

  let parried = 0;
  s.events.on('stun_parry', () => parried++);

  s.combat.setCharacter('amy');
  s.combat.setNoCooldown(true);
  s.combat.activateSlot(2); // melee Hammer (in range: 6 studs)
  let t = step(s, 1 / 60, 0, 160); // 2s verified windup + swing resolves
  if (parried !== 1) throw new Error(`expected 1 parry, got ${parried}`);

  // ranged card toss must connect
  const reports = [];
  s.events.on('stun_report', (r) => reports.push(r));
  s.combat.activateSlot(0);
  for (let i = 0; i < 90 && reports.length === 0; i++) t = step(s, 1 / 60, t, 1);
  if (reports.length !== 1) throw new Error('ranged attack should bypass V1 parry');
});

await test('No-cooldown: instant reuse, but windup still enforced', () => {
  const s = buildStack();
  s.combat.setCharacter('amy');
  s.combat.setNoCooldown(true);
  s.player.yaw = Math.PI;
  s.player.update(1 / 60, s.input, true);

  // fire the card toss twice in the same instant — second should queue via windup
  const ok1 = s.combat.activateSlot(0);
  const ok2 = s.combat.activateSlot(0); // still in windup → refused
  if (!ok1) throw new Error('first activation must succeed');
  if (ok2) throw new Error('second activation during windup must be refused');

  let t = step(s, 1 / 60, 0, 30); // windup 0.22s + recover
  const ok3 = s.combat.activateSlot(0);
  if (!ok3) throw new Error('third activation after windup must succeed (no cooldown)');
});

await test('Style: moving-target bonus only when the dummy really moves', () => {
  // --- moving case: Blaze Javelin at a real zigzagging dummy ---
  const s = buildStack();
  s.player.yaw = Math.PI;
  s.player.update(1 / 60, s.input, true);
  s.spawner.setConfig({ mode: 'moving', pattern: 'straight', speed: 0.35, areaRadius: 60, canDamagePlayer: false });
  const dummy = s.spawner.spawn(s.player.position, s.player.yaw);
  dummy.position.set(0, 0, -15);
  dummy.homePosition.copy(dummy.position);

  let t = step(s, 1 / 60, 0, 8); // let it pick up real speed
  const speedAtFire = dummy.currentSpeed();

  const reports = [];
  s.events.on('stun_report', (r) => reports.push(r));
  s.combat.setCharacter('blaze');
  s.combat.setNoCooldown(true);
  // lead the shot like a player: windup 0.4s + travel ≈ 0.12s at 15 studs
  const flight = 0.4 + 15 / 130;
  const predicted = dummy.getHitSphere().center.clone().addScaledVector(dummy.velocity, flight);
  aimAt(s, predicted);
  s.combat.activateSlot(0); // fast javelin
  for (let i = 0; i < 90 && reports.length === 0; i++) t = step(s, 1 / 60, t, 1);
  if (reports.length !== 1) throw new Error('expected a stun report on the moving dummy');
  const hasMovingBonus = reports[0].styleBreakdown.some((b) => b.id === 'moving_target');
  if (speedAtFire >= GAME.style.movingTargetMinSpeed && !hasMovingBonus) {
    throw new Error(`dummy moving at ${speedAtFire.toFixed(1)} studs/s but no moving-target bonus`);
  }

  // --- stationary case: same attack, no moving-target bonus allowed ---
  const s2 = buildStack();
  s2.player.yaw = Math.PI;
  s2.player.update(1 / 60, s2.input, true);
  s2.spawner.setConfig({ mode: 'stationary', facing: -1, canDamagePlayer: false });
  const dummy2 = s2.spawner.spawn(s2.player.position, s2.player.yaw);
  dummy2.position.set(0, 0, -20);
  dummy2.homePosition.copy(dummy2.position);
  const reports2 = [];
  s2.events.on('stun_report', (r) => reports2.push(r));
  s2.combat.setCharacter('blaze');
  s2.combat.setNoCooldown(true);
  aimAt(s2, dummy2.getHitSphere().center);
  s2.combat.activateSlot(0);
  let t2 = 0;
  for (let i = 0; i < 90 && reports2.length === 0; i++) t2 = step(s2, 1 / 60, t2, 1);
  if (reports2.length !== 1) throw new Error('expected a stun report on the stationary dummy');
  if (reports2[0].styleBreakdown.some((b) => b.id === 'moving_target')) {
    throw new Error('stationary dummy wrongly earned the moving-target bonus');
  }
});

await test('Stun cap 8s enforced on long requests (verified OM rule)', () => {
  const s = buildStack();
  s.player.yaw = Math.PI;
  s.player.update(1 / 60, s.input, true);
  s.spawner.setConfig({ mode: 'stationary', facing: -1, canDamagePlayer: false });
  const dummy = s.spawner.spawn(s.player.position, s.player.yaw);
  dummy.position.set(0, 0, -100);
  dummy.homePosition.copy(dummy.position);

  const started = [];
  s.events.on('stun_start', (r) => started.push(r));
  s.combat.setCharacter('tails');
  s.combat.setNoCooldown(true);
  s.combat.setLaserMode('tails_laser_beam');
  // rig Strength card style override? Not applicable — beam stun 5s; instead
  // directly request 30s via the stun system to prove the cap.
  const rec = s.stunSystem.applyStun(dummy, 30, { abilityId: 'test', isRanged: true });
  if (rec.appliedSeconds !== GAME.stunCapSeconds) throw new Error(`cap failed: ${rec.appliedSeconds}`);
  if (rec.cappedFrom !== 30) throw new Error('cappedFrom not recorded');
});

await test('Full-Movement EXE windups damage the player', async () => {
  const s = buildStack();
  s.player.yaw = Math.PI;
  s.player.update(1 / 60, s.input, true);
  s.spawner.setConfig({ mode: 'full', aggression: 1, canDamagePlayer: true, damage: 25 });
  const dummy = s.spawner.spawn(s.player.position, s.player.yaw);
  dummy.position.set(0, 0, -8);
  dummy.homePosition.copy(dummy.position);

  const hpBefore = s.player.health;
  let t = 0;
  // run up to 20s of simulated time; the EXE must attack eventually
  for (let i = 0; i < 1200 && s.player.health >= hpBefore; i++) {
    t = step(s, 1 / 60, t, 1);
  }
  if (s.player.health >= hpBefore) throw new Error('EXE never damaged the player');
});

await test('Exactly one scoring event per stun, counted in analytics', () => {
  const s = buildStack();
  s.player.yaw = Math.PI;
  s.player.update(1 / 60, s.input, true);
  s.spawner.setConfig({ mode: 'stationary', facing: -1, canDamagePlayer: false });
  const dummy = s.spawner.spawn(s.player.position, s.player.yaw);
  dummy.position.set(0, 0, -50);
  dummy.homePosition.copy(dummy.position);
  aimAt(s, dummy.getHitSphere().center);

  s.combat.setCharacter('blaze');
  s.combat.setNoCooldown(true);
  s.combat.activateSlot(0); // javelin
  let t = 0;
  for (let i = 0; i < 120; i++) t = step(s, 1 / 60, t, 1);

  const sum = s.analytics.getSummary();
  if (sum.stuns !== 1) throw new Error(`analytics recorded ${sum.stuns} stuns (want 1)`);
  if (sum.hits !== 1) throw new Error(`analytics recorded ${sum.hits} hits (want 1)`);
  if (sum.shots !== 1) throw new Error(`analytics recorded ${sum.shots} shots (want 1)`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
