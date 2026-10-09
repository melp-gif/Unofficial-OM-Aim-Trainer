import * as THREE from 'three';
import { ABILITIES } from '../config/abilities.js';
import { CHARACTERS } from '../config/characters.js';
import { TAILS_LASERS } from '../config/abilities.js';
import { VERIFY, GAME } from '../config/gameConfig.js';
import { horizontalDistance, distance3, deg2rad } from '../utils/math.js';

/**
 * Runtime slot layout per character. Slot 0 is always the primary ranged
 * attack (M1 / Fire). Keys shown in the HUD come from here.
 */
export const SLOT_LAYOUT = {
  amy: [
    { abilityId: 'amy_tarot_toss', label: 'Card Toss', key: 'M1 / Fire', inputKeys: { KeyQ: 0, KeyE: 2, KeyX: 3, Digit1: 0, Digit2: 2, Digit3: 3 } },
    { abilityId: 'amy_hammer_throw', label: 'Hammer Throw', key: 'Q' },
    { abilityId: 'amy_hammer', label: 'Hammer', key: 'E' },
    { abilityId: 'amy_reroll', label: 'Reroll', key: 'X' }
  ],
  tails: [
    { abilityId: 'tails_laser_beam', label: 'Laser Cannon', key: 'M1 / E', inputKeys: { KeyQ: 0, KeyE: 0, KeyX: 1, KeyC: 1, KeyR: 2, Digit1: 0, Digit2: 1, Digit3: 2 } },
    { abilityId: 'tails_switch', label: 'Switch Laser', key: 'X / C' },
    { abilityId: 'tails_glide', label: 'Glide', key: 'R' }
  ],
  silver: [
    { abilityId: 'silver_rock', label: 'Rock', key: 'M1 / Q', inputKeys: { KeyQ: 0, KeyE: 1, KeyX: 1, KeyR: 1, Digit1: 0, Digit2: 1 } },
    { abilityId: 'silver_suspension', label: 'Suspension', key: 'E' }
  ],
  blaze: [
    { abilityId: 'blaze_javelin', label: 'Javelin', key: 'M1 / Q', inputKeys: { KeyQ: 0, KeyE: 1, KeyX: 1, KeyR: 1, Digit1: 0, Digit2: 1 } },
    { abilityId: 'blaze_kick', label: 'Kick', key: 'E' }
  ]
};

/**
 * CombatDirector — owns ability activation state machines, cooldown policy,
 * firing, and the hit → stun → style → feedback pipeline.
 *
 * NO-COOLDOWN POLICY (training): cooldowns are skipped entirely, but windups,
 * charge-ups, hammer return and animation locks remain unless the matching
 * clearly-labelled practice variation is enabled.
 */
export class CombatDirector {
  constructor({ scene, player, projectiles, beams, stunSystem, feedback, analytics, tarot, spawner, audio, events }) {
    this.scene = scene;
    this.player = player;
    this.projectiles = projectiles;
    this.beams = beams;
    this.stunSystem = stunSystem;
    this.feedback = feedback;
    this.analytics = analytics;
    this.tarot = tarot;
    this.spawner = spawner;
    this.audio = audio;
    this.events = events;

    this.characterId = 'amy';
    this.slots = [];          // runtime state per ability slot
    this.noCooldown = true;   // training default
    this.instantCharge = false;   // labelled practice variation
    this.instantHammerRecall = false; // labelled practice variation
    this.laserModeIndex = 0;  // Tails
    this.hammerThrownUntil = 0; // Amy: hammer unavailable until return
    this.gameTime = 0;
    this._castStunKeys = new Set();
    this.holdingFire = false;
    this._autoFireTimer = 0;
    this._setCharacter('amy');
  }

  _setCharacter(charId) {
    this.characterId = charId;
    const layout = SLOT_LAYOUT[charId] || SLOT_LAYOUT.amy;
    this.slots = layout.map((entry) => ({
      abilityId: entry.abilityId,
      ability: ABILITIES[entry.abilityId],
      label: entry.label,
      key: entry.key,
      state: 'ready',         // ready | windup | charging | charged | active | recover | cooldown
      timer: 0,
      cooldownLeft: 0
    }));
    this.hammerThrownUntil = 0;
    this.laserModeIndex = 0;
  }

  setCharacter(charId) {
    this._setCharacter(charId);
    this.events.emit('loadout_changed', this.getLoadoutState());
  }

  getLoadoutState() {
    return {
      characterId: this.characterId,
      slots: this.slots.map((s, i) => ({
        index: i,
        abilityId: s.abilityId,
        name: s.ability.name,
        shortName: s.label || s.ability.shortName,
        control: s.key || s.ability.control,
        verified: s.ability.verified,
        state: s.state,
        cooldownLeft: s.cooldownLeft,
        canStun: !!s.ability.stun?.canStun
      })),
      laserMode: TAILS_LASERS[this.laserModeIndex],
      laserModes: TAILS_LASERS,
      noCooldown: this.noCooldown,
      instantCharge: this.instantCharge,
      instantHammerRecall: this.instantHammerRecall
    };
  }

  setNoCooldown(v) {
    this.noCooldown = v;
    if (v) for (const s of this.slots) s.cooldownLeft = 0;
    this.events.emit('cooldown_policy_changed', { noCooldown: v });
    this.events.emit('loadout_changed', this.getLoadoutState());
  }

  setInstantCharge(v) {
    this.instantCharge = v;
    this.events.emit('loadout_changed', this.getLoadoutState());
  }

  setInstantHammerRecall(v) {
    this.instantHammerRecall = v;
    this.events.emit('loadout_changed', this.getLoadoutState());
  }

  cycleLaserMode(dir = 1) {
    this.laserModeIndex = (this.laserModeIndex + dir + TAILS_LASERS.length) % TAILS_LASERS.length;
    this.audio.play('mode_change');
    this.events.emit('laser_mode_changed', {
      modeId: TAILS_LASERS[this.laserModeIndex],
      ability: ABILITIES[ TAILS_LASERS[this.laserModeIndex] ],
      index: this.laserModeIndex
    });
    this.events.emit('loadout_changed', this.getLoadoutState());
    return TAILS_LASERS[this.laserModeIndex];
  }

  setLaserMode(modeId) {
    const idx = TAILS_LASERS.indexOf(modeId);
    if (idx >= 0) {
      this.laserModeIndex = idx;
      this.audio.play('mode_change');
      this.events.emit('laser_mode_changed', { modeId, ability: ABILITIES[modeId], index: idx });
      this.events.emit('loadout_changed', this.getLoadoutState());
    }
  }

  /* ================================================================
     ACTIVATION
     ================================================================ */

  /** Primary fire button (M1 / touch). */
  fire() {
    // Tails: fire the charged laser; never cancels the charge (that's E)
    if (this.characterId === 'tails') {
      const chargeSlot = this.slots.find((s) => s.abilityId === 'tails_laser_beam');
      if (chargeSlot && chargeSlot.state === 'charged') {
        this._fireLaser();
        return true;
      }
      if (chargeSlot && chargeSlot.state === 'charging') {
        this.audio.play('denied');
        this.events.emit('combat_feed', { kind: 'info', text: 'Laser Cannon still charging…', at: performance.now() });
        return false;
      }
      return this.activateSlot(0, { fromFire: true });
    }
    // everyone else: primary ranged is slot 0
    return this.activateSlot(0, { fromFire: true });
  }

  /** Keyboard/panel ability slot activation (0..N). */
  activateSlot(index, opts = {}) {
    const slot = this.slots[index];
    if (!slot) return false;

    const a = slot.ability;

    // Amy: hammer family locked while the thrown hammer is out (verified)
    if (this.characterId === 'amy' && (a.id === 'amy_hammer' || a.id === 'amy_hammer_throw')) {
      if (this.gameTime < this.hammerThrownUntil && a.id === 'amy_hammer') {
        this.audio.play('denied');
        this.events.emit('combat_feed', {
          kind: 'info',
          text: 'Hammer is still thrown out — it returns automatically (verified 8s) or walk over it.',
          at: performance.now()
        });
        return false;
      }
    }

    // Tails: laser key toggles charge / cancel / fire
    if (a.id === 'tails_laser_beam') {
      if (slot.state === 'charging') {
        if (opts.fromFire) {
          this.audio.play('denied');
          this.events.emit('combat_feed', { kind: 'info', text: 'Laser Cannon still charging…', at: performance.now() });
          return false;
        }
        this._cancelLaserCharge(slot);
        return true;
      }
      if (slot.state === 'charged') {
        this._fireLaser();
        return true;
      }
      if (slot.state !== 'ready' && slot.state !== 'cooldown') return false;
      return this._beginTailsCharge(slot);
    }

    // Tails: Switch (verified — usable even while charging)
    if (a.id === 'tails_switch') {
      this.cycleLaserMode();
      return true;
    }

    // Tails: Glide (verified mobility)
    if (a.id === 'tails_glide') {
      return this._toggleGlide(slot);
    }

    if (slot.state !== 'ready') return false;
    if (slot.cooldownLeft > 0 && !this.noCooldown) {
      this.audio.play('denied');
      return false;
    }

    // ---- instant utility (Reroll / mode switch) ----
    if (a.category === 'utility') {
      slot.state = 'windup';
      slot.timer = a.windup || 0.15;
      this.analytics.recordShot({ abilityId: a.id, characterId: this.characterId });
      this.analytics.recordHit({ abilityId: a.id, characterId: this.characterId, movementMode: this._movementMode() });
      this.audio.play(a.sound || 'ui_click');
      return true;
    }

    slot.state = 'windup';
    slot.timer = a.windup || 0.2;
    slot.pendingFire = true;
    if (a.sound) this.audio.play(a.sound);
    if (a.id === 'amy_hammer') this.audio.play('hammer_windup');
    this.events.emit('ability_activated', { abilityId: a.id, name: a.name, state: 'windup' });
    return true;
  }

  _beginTailsCharge(slot) {
    slot.state = 'charging';
    slot.timer = this.instantCharge ? 0.01 : slot.ability.charge || 5;
    this.player.slowMult = 0.45; // verified: Tails is slowed while charging
    this.audio.play('laser_charge');
    this.events.emit('ability_activated', { abilityId: slot.abilityId, name: slot.ability.name, state: 'charging' });
    this.events.emit('combat_feed', {
      kind: 'info',
      text: `Laser Cannon charging (${slot.timer.toFixed(1)}s) — Fire to shoot${this.instantCharge ? ' [INSTANT-CHARGE VARIATION]' : ''}, press the key again to cancel`,
      at: performance.now()
    });
    return true;
  }

  _toggleGlide(slot) {
    const gl = slot.ability.glide;
    if (this.player.gliding) {
      if (this.player.glideElapsed < gl.minCancelTime) {
        this.audio.play('denied');
        this.events.emit('combat_feed', {
          kind: 'info',
          text: `Glide can be cancelled after ${gl.minCancelTime.toFixed(0)}s (verified)`,
          at: performance.now()
        });
        return false;
      }
      this.player.stopGlide();
      slot.state = 'ready';
      this.audio.play('ui_click');
      return true;
    }
    if (slot.cooldownLeft > 0 && !this.noCooldown) {
      this.audio.play('denied');
      return false;
    }
    this.player.startGlide(gl.duration, gl.gravityScale, gl.liftAcceleration);
    slot.state = 'active';
    slot.timer = gl.duration;
    slot.cooldownLeft = this.noCooldown ? 0 : (slot.ability.cooldown || 35);
    this.audio.play('laser_charge');
    this.events.emit('combat_feed', {
      kind: 'info',
      text: 'Glide active — hold Jump to float up, press again after 2s to cancel (verified)',
      at: performance.now()
    });
    this.events.emit('loadout_changed', this.getLoadoutState());
    return true;
  }

  _cancelLaserCharge(slot) {
    slot.state = 'cooldown';
    slot.cooldownLeft = this.noCooldown ? 0 : (slot.ability.cancelCooldown || 15);
    this.player.slowMult = 1;
    this.audio.play('denied');
    this.events.emit('combat_feed', {
      kind: 'info',
      text: `Laser charge cancelled — ${this.noCooldown ? 'no cooldown in training' : `${slot.cooldownLeft.toFixed(0)}s cooldown`}`,
      at: performance.now()
    });
    this.events.emit('loadout_changed', this.getLoadoutState());
  }

  /* ================================================================
     LASER FIRING (all Tails modes)
     ================================================================ */

  _fireLaser() {
    const modeId = TAILS_LASERS[this.laserModeIndex];
    const a = ABILITIES[modeId];
    const chargeSlot = this.slots.find((s) => s.abilityId === 'tails_laser_beam');
    if (chargeSlot) {
      chargeSlot.state = 'recover';
      chargeSlot.timer = a.recover || 0.25;
      chargeSlot.cooldownLeft = this.noCooldown ? 0 : (a.cooldown || 45);
    }
    this.player.slowMult = 1;

    this.analytics.recordShot({ abilityId: a.id, characterId: 'tails' });
    const origin = this.player.muzzleWorld.clone();
    const dir = this._aimDirFromMuzzle();
    const movementMode = this._movementMode();

    if (a.category === 'beam') {
      this.audio.play('laser_beam');
      this.beams.fireBeam({
        ability: a,
        origin,
        direction: dir,
        width: a.beam.width,
        range: a.beam.range,
        duration: a.beam.duration,
        pushbackSpeed: a.beam.pushbackSpeed,
        color: 0xffe066,
        onFirstHit: (hit) => this._onBeamFirstHit(hit, movementMode),
        onContact: () => {}
      });
    } else if (a.category === 'shockwave') {
      this.audio.play('laser_burst');
      const center = a.shockwave.forward
        ? this.player.position.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 6)
        : this.player.position.clone();
      this.beams.fireShockwave({
        ability: a,
        center,
        radius: a.shockwave.radius,
        expandSpeed: a.shockwave.expandSpeed,
        duration: a.shockwave.duration,
        forward: a.shockwave.forward,
        direction: dir,
        color: 0xffcc44,
        onFirstHit: (hit) => this._onWaveHit(hit, movementMode)
      });
    } else if (a.category === 'aoe') {
      this.audio.play('laser_blast');
      this.projectiles.fire({
        ability: a,
        from: origin,
        direction: dir,
        style: 'blast',
        speed: a.projectile.speed,
        radius: a.projectile.radius,
        lifetime: a.projectile.lifetime,
        spin: 0,
        onHit: (hit) => {
          this._onProjectileHit(hit, movementMode, { explodeRadius: a.aoe?.radius || 18 });
        },
        onExpire: this._missHandler(a, movementMode)
      });
    } else if (a.category === 'projectile') {
      this.audio.play('laser_orbs');
      const cast = { hit: false };
      const count = a.burst?.count || 1;
      const spread = deg2rad(a.burst?.spreadDegrees || 0);
      for (let i = 0; i < count; i++) {
        const off = count > 1 ? (i / (count - 1) - 0.5) * spread : 0;
        const d2 = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), off);
        this.projectiles.fire({
          ability: a,
          from: origin,
          direction: d2,
          style: 'orb',
          speed: a.projectile.speed,
          radius: a.projectile.radius,
          lifetime: a.projectile.lifetime,
          onHit: (hit) => {
            if (cast.hit) {
              // same cast already scored — no duplicate stun event
              return;
            }
            cast.hit = true;
            this._onProjectileHit(hit, movementMode, { sharedCast: cast });
          }
        });
      }
      // one miss report per cast
      setTimeout(() => {
        if (!cast.hit) this._onCastMiss(a, movementMode);
      }, (a.projectile.lifetime + 0.1) * 1000);
    }

    this.events.emit('loadout_changed', this.getLoadoutState());
  }

  /* ================================================================
     UPDATE LOOP
     ================================================================ */

  update(dt, gameTime) {
    this.gameTime = gameTime;

    // hold-to-fire repeat for rapid primaries (card toss / rock / javelin)
    if (this.holdingFire && this.characterId !== 'tails') {
      this._autoFireTimer -= dt;
      const slot = this.slots[0];
      if (this._autoFireTimer <= 0 && slot && slot.state === 'ready' && slot.cooldownLeft <= 0) {
        this._autoFireTimer = 0.22;
        this.activateSlot(0, { fromFire: true });
      }
    }

    for (const slot of this.slots) {
      const a = slot.ability;

      if (slot.cooldownLeft > 0 && !this.noCooldown) {
        slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
        if (slot.cooldownLeft === 0 && slot.state === 'cooldown') {
          slot.state = 'ready';
          this.events.emit('loadout_changed', this.getLoadoutState());
        }
      } else if (slot.cooldownLeft > 0 && this.noCooldown) {
        slot.cooldownLeft = 0;
        if (slot.state === 'cooldown') slot.state = 'ready';
      }

      if (slot.state === 'charging') {
        slot.timer -= dt;
        if (slot.timer <= 0) {
          slot.state = 'charged';
          this.audio.play('ui_open');
          this.events.emit('combat_feed', {
            kind: 'info',
            text: 'Laser Cannon CHARGED — press Fire to unleash!',
            at: performance.now()
          });
          this.events.emit('loadout_changed', this.getLoadoutState());
        }
        continue;
      }

      if (slot.state === 'windup') {
        slot.timer -= dt;
        if (slot.timer <= 0) {
          this._execute(slot);
        }
        continue;
      }

      if (slot.state === 'active') {
        slot.timer -= dt;
        if (slot.timer <= 0) {
          slot.state = 'recover';
          slot.timer = a.recover || 0.2;
        }
        continue;
      }

      if (slot.state === 'recover') {
        slot.timer -= dt;
        if (slot.timer <= 0) {
          slot.state = slot.cooldownLeft > 0 && !this.noCooldown ? 'cooldown' : 'ready';
          this.events.emit('loadout_changed', this.getLoadoutState());
        }
      }
    }
  }

  _execute(slot) {
    const a = slot.ability;
    switch (a.id) {
      case 'amy_tarot_toss': this._fireAmyToss(slot); break;
      case 'amy_hammer': this._fireAmyHammer(slot); break;
      case 'amy_hammer_throw': this._fireAmyHammerThrow(slot); break;
      case 'amy_reroll': this._fireReroll(slot); break;
      case 'silver_rock': this._fireSilverRock(slot); break;
      case 'silver_suspension': this._fireSilverSuspension(slot); break;
      case 'blaze_javelin': this._fireBlazeJavelin(slot); break;
      case 'blaze_kick': this._fireBlazeKick(slot); break;
      default: slot.state = 'ready'; break;
    }
  }

  /* ================================================================
     ABILITY IMPLEMENTATIONS
     ================================================================ */

  _fireAmyToss(slot) {
    const a = slot.ability;
    const movementMode = this._movementMode();
    this.analytics.recordShot({ abilityId: a.id, characterId: 'amy' });
    const cardIds = this.tarot?.cards?.map((c) => c.card.id) || [];
    const style = 'card';
    this.projectiles.fire({
      ability: a,
      from: this.player.muzzleWorld.clone(),
      direction: this._aimDirFromMuzzle(),
      style,
      speed: a.projectile.speed,
      radius: a.projectile.radius,
      gravity: a.projectile.gravity,
      lifetime: a.projectile.lifetime,
      spin: a.projectile.spin,
      knockback: a.stun.knockback,
      cardIds,
      onHit: (hit) => this._onProjectileHit(hit, movementMode),
      onExpire: this._missHandler(a, movementMode)
    });
    slot.state = 'recover';
    slot.timer = a.recover;
    slot.cooldownLeft = this.noCooldown ? 0 : (a.cooldown || 0);
  }

  _fireAmyHammer(slot) {
    const a = slot.ability;
    const movementMode = this._movementMode();
    this.analytics.recordShot({ abilityId: a.id, characterId: 'amy' });
    slot.state = 'active';
    slot.timer = 0.45; // swing duration

    // verified: 8-stud swing radius around Amy
    const range = a.melee.range;
    let hitAny = false;
    for (const dummy of this.spawner.dummies) {
      if (!dummy.alive) continue;
      const dist = horizontalDistance(this.player.position, dummy.position);
      if (dist <= range) {
        hitAny = true;
        this._resolveMeleeHit(a, dummy, dist, movementMode);
      }
    }
    if (!hitAny) this._onCastMiss(a, movementMode);
    this.audio.play('hammer_swing');
  }

  _fireAmyHammerThrow(slot) {
    const a = slot.ability;
    const movementMode = this._movementMode();
    this.analytics.recordShot({ abilityId: a.id, characterId: 'amy' });
    const recallAt = this.instantHammerRecall ? 0.5 : a.projectile.returnAfter;
    this.projectiles.fire({
      ability: a,
      from: this.player.muzzleWorld.clone(),
      direction: this._aimDirFromMuzzle(),
      style: 'hammer',
      speed: a.projectile.speed,
      radius: a.projectile.radius,
      gravity: a.projectile.gravity,
      lifetime: Math.max(a.projectile.lifetime, recallAt + 1),
      spin: a.projectile.spin,
      knockback: a.stun.knockback,
      returnAfter: recallAt,
      manualPickup: a.projectile.manualPickup && !this.instantHammerRecall,
      targetPosition: this.player.position.clone(),
      onHit: (hit) => {
        this._onProjectileHit(hit, movementMode);
        // hammer remains out until return (verified) — even after a hit
        this.hammerThrownUntil = this.gameTime + recallAt;
      },
      onExpire: (info) => {
        // returned / picked up / expired → Amy regains her hammer (verified)
        this.hammerThrownUntil = Math.min(this.hammerThrownUntil, this.gameTime);
        if (info?.reason === 'picked_up') {
          this.events.emit('combat_feed', {
            kind: 'info',
            text: 'Hammer retrieved — Hammer ability restored early (verified manual pickup)',
            at: performance.now()
          });
        }
        if (!info?.projectile?.hitSomething) this._onCastMiss(a, movementMode);
        this.events.emit('loadout_changed', this.getLoadoutState());
      }
    });
    // hammer is gone until it returns (verified)
    this.hammerThrownUntil = this.gameTime + recallAt;
    this.audio.play('hammer_throw');
    slot.state = 'recover';
    slot.timer = a.recover;
    slot.cooldownLeft = this.noCooldown ? 0 : (a.cooldown || 28);
  }

  _fireReroll(slot) {
    const a = slot.ability;
    this.tarot.reroll();
    this.tarot.applyToPlayer(this.player);
    slot.state = 'recover';
    slot.timer = a.recover;
    slot.cooldownLeft = this.noCooldown ? 0 : (a.cooldown || 23);
    this.audio.play('card_shuffle');
    this.events.emit('combat_feed', {
      kind: 'info',
      text: `Reroll: ${this.tarot.getState().map((c) => c.name).join(' + ')}`,
      at: performance.now()
    });
    this.events.emit('loadout_changed', this.getLoadoutState());
  }

  _fireSilverRock(slot) {
    const a = slot.ability;
    const movementMode = this._movementMode();
    this.analytics.recordShot({ abilityId: a.id, characterId: 'silver' });
    this.projectiles.fire({
      ability: a,
      from: this.player.muzzleWorld.clone(),
      direction: this._aimDirFromMuzzle(),
      style: 'rock',
      speed: a.projectile.speed,
      radius: a.projectile.radius,
      gravity: a.projectile.gravity,
      lifetime: a.projectile.lifetime,
      spin: a.projectile.spin,
      onHit: (hit) => this._onProjectileHit(hit, movementMode),
      onExpire: this._missHandler(a, movementMode)
    });
    slot.state = 'recover';
    slot.timer = a.recover;
    slot.cooldownLeft = this.noCooldown ? 0 : (a.cooldown || 6);
    this.audio.play('rock_throw');
  }

  _fireSilverSuspension(slot) {
    const a = slot.ability;
    const movementMode = this._movementMode();
    this.analytics.recordShot({ abilityId: a.id, characterId: 'silver' });
    this.audio.play('suspension');
    this.beams.fireBeam({
      ability: a,
      origin: this.player.muzzleWorld.clone(),
      direction: this._aimDirFromMuzzle(),
      width: a.beam.width,
      range: a.beam.range,
      duration: a.beam.duration,
      pushbackSpeed: 0,
      color: 0x66d9ff,
      onFirstHit: (hit) => this._onBeamFirstHit(hit, movementMode)
    });
    slot.state = 'recover';
    slot.timer = a.recover;
    slot.cooldownLeft = this.noCooldown ? 0 : (a.cooldown || 18);
  }

  _fireBlazeJavelin(slot) {
    const a = slot.ability;
    const movementMode = this._movementMode();
    this.analytics.recordShot({ abilityId: a.id, characterId: 'blaze' });
    this.projectiles.fire({
      ability: a,
      from: this.player.muzzleWorld.clone(),
      direction: this._aimDirFromMuzzle(),
      style: 'javelin',
      speed: a.projectile.speed,
      radius: a.projectile.radius,
      lifetime: a.projectile.lifetime,
      spin: a.projectile.spin,
      knockback: a.stun.knockback,
      onHit: (hit) => this._onProjectileHit(hit, movementMode),
      onExpire: this._missHandler(a, movementMode)
    });
    slot.state = 'recover';
    slot.timer = a.recover;
    slot.cooldownLeft = this.noCooldown ? 0 : (a.cooldown || 10);
    this.audio.play('javelin_throw');
  }

  _fireBlazeKick(slot) {
    const a = slot.ability;
    const movementMode = this._movementMode();
    this.analytics.recordShot({ abilityId: a.id, characterId: 'blaze' });
    slot.state = 'active';
    slot.timer = 0.35;
    let hitAny = false;
    for (const dummy of this.spawner.dummies) {
      if (!dummy.alive) continue;
      const dist = horizontalDistance(this.player.position, dummy.position);
      if (dist <= a.melee.range) {
        hitAny = true;
        this._resolveMeleeHit(a, dummy, dist, movementMode);
      }
    }
    if (!hitAny) this._onCastMiss(a, movementMode);
    this.audio.play('kick');
  }

  /* ================================================================
     HIT RESOLUTION → STUN → STYLE → FEEDBACK
     ================================================================ */

  _movementMode() {
    return this.spawner.selected?.mode || this.spawner.config.mode || 'full';
  }

  /**
   * Fire direction: from the muzzle toward the crosshair's aim point, so
   * projectiles/beams always converge on the crosshair (no muzzle divergence).
   */
  _aimDirFromMuzzle() {
    const origin = this.player.muzzleWorld.clone();
    return this.player.getAimPoint(260).sub(origin).normalize();
  }

  /** Standard expire handler: counts a miss only if the projectile never hit. */
  _missHandler(a, movementMode) {
    return (info) => {
      if (info?.projectile?.hitSomething) return;
      this._onCastMiss(a, movementMode);
    };
  }

  _stunSecondsFor(a) {
    // Amy's hammer-family stun is rewritten by held tarot cards (verified)
    if (a.id === 'amy_hammer' || a.id === 'amy_hammer_throw' || a.id === 'amy_tarot_toss') {
      return this.tarot.getHammerStunSeconds(a.stun.base);
    }
    return a.stun.base;
  }

  _onProjectileHit(hit, movementMode, extra = {}) {
    const a = hit.ability;
    const dummy = hit.dummy;
    const playerPos = this.player.position;
    const distance = horizontalDistance(playerPos, dummy.position);
    const castKey = `${hit.castId}:${dummy.id}`;
    const alreadyStunnedThisCast = this._castStunKeys.has(castKey);

    this.analytics.recordHit({ abilityId: a.id, characterId: this.characterId, movementMode });

    // AOE explosion (laser blast) also hits nearby dummies exactly once
    if (extra.explodeRadius) {
      this.beams.fireAoe({
        ability: a,
        center: dummy.position.clone().setY(2),
        radius: extra.explodeRadius,
        color: 0xff8844,
        onFirstHit: (h) => {
          if (h.dummy.id !== dummy.id) this._applyAbilityToDummy(a, h.dummy, hit.travelTime, movementMode, distance);
        }
      });
    }

    this._applyAbilityToDummy(a, dummy, hit.travelTime, movementMode, distance, hit, alreadyStunnedThisCast);
  }

  _onBeamFirstHit(hit, movementMode) {
    const a = hit.ability;
    const dummy = hit.dummy;
    const distance = horizontalDistance(this.player.position, dummy.position);
    this.analytics.recordHit({ abilityId: a.id, characterId: this.characterId, movementMode });
    this._applyAbilityToDummy(a, dummy, 0, movementMode, distance, { knockback: 0 }, false);
  }

  _onWaveHit(hit, movementMode) {
    const a = hit.ability;
    const dummy = hit.dummy;
    const distance = horizontalDistance(this.player.position, dummy.position);
    this.analytics.recordHit({ abilityId: a.id, characterId: this.characterId, movementMode });
    this._applyAbilityToDummy(a, dummy, 0, movementMode, distance, { knockback: a.stun?.knockback || 0 }, false);
  }

  _resolveMeleeHit(a, dummy, distance, movementMode) {
    this.analytics.recordHit({ abilityId: a.id, characterId: this.characterId, movementMode });
    this._applyAbilityToDummy(a, dummy, 0, movementMode, distance, { knockback: a.stun.knockback }, false);
    this.audio.play('hit');
  }

  _applyAbilityToDummy(a, dummy, travelTime, movementMode, distance, hitInfo = {}, skipDuplicate = false) {
    if (!dummy.alive) return;

    // PRE-HIT live conditions — must be sampled BEFORE knockback/stun alter them
    const preHitSpeed = dummy.currentSpeed();
    const preHitApproach = dummy.approachSpeedTo(this.player.position);
    const preHitWindingUp = dummy.attackState === 'windup';

    // Silver Rock: verified behaviour is slow + ability lock, NOT a full stun
    if (a.stun.canStun === false && a.stun.slow) {
      dummy.slowFactor = a.stun.slow.factor;
      dummy.slowUntil = this.gameTime + a.stun.slow.duration;
      dummy.abilityLockUntil = this.gameTime + (a.stun.abilityLock || 0);
      dummy.applyDamage(0);
      this.events.emit('combat_feed', {
        kind: 'stun_start',
        text: `🪨 ${a.name} connected — EXE slowed + ability-locked for ${a.stun.slow.duration.toFixed(1)}s (verified behaviour, duration unverified)`,
        at: performance.now()
      });
      // still counts as a "hit" but never a stun scoring event
      return;
    }

    if (!a.stun.canStun) return;

    const stunSeconds = this._stunSecondsFor(a);
    const isRanged = a.category === 'projectile' || a.category === 'beam' || a.category === 'aoe' || a.category === 'shockwave';

    const record = this.stunSystem.applyStun(dummy, stunSeconds, {
      abilityId: a.id,
      abilityName: a.name,
      characterId: this.characterId,
      verified: a.verified,
      distance,
      travelTime,
      isRanged
    });

    if (!record) {
      if (dummy.canParry) {
        this.feedback.reportParry(a.name);
        this.analytics.recordParry();
      }
      return;
    }

    if (skipDuplicate && a.id !== 'tails_laser_beam') {
      // safety: same cast already scored a stun on this dummy
    }

    this._castStunKeys.add(`${dummy.id}:${a.id}:${record.id}`);

    // knockback
    const kb = (hitInfo.knockback ?? a.stun.knockback ?? 0);
    if (kb > 0) {
      const dirAway = dummy.position.clone().sub(this.player.position).setY(0).normalize();
      dummy.position.addScaledVector(dirAway, Math.min(kb, 18));
    }

    // actual live conditions for style bonuses (pre-hit samples)
    const targetSpeed = preHitSpeed;
    const ctx = {
      distance,
      targetSpeed,
      targetWasWindingUp: preHitWindingUp,
      targetWasMoving: targetSpeed > 1.5,
      approachSpeed: preHitApproach,
      travelTime,
      hitOffset: hitInfo.hitOffset ?? 0.8,
      aimTolerance: 1.6,
      abilityRange: a.range || (a.beam?.range ? Math.min(a.beam.range, 260) : 0),
      gameTime: this.gameTime,
      basePoints: a.stun.base >= 4 ? 140 : 100,
      characterName: CHARACTERS[this.characterId]?.name || this.characterId
    };

    this.feedback.reportHit({ record, ctx, dummy });
    this.analytics.recordStun(record, movementMode);
    this.audio.play('hit');

    if (dummy.attackState === 'windup') {
      dummy.attackState = 'idle';
      dummy.attackTimer = 0;
      dummy.attackCooldownTimer = 1.2;
    }
    dummy.rage = Math.min(1, dummy.rage + 0.22);
  }

  _onCastMiss(a, movementMode) {
    this.feedback.reportMiss(a.name);
    this.analytics.recordMiss({ abilityId: a.id, characterId: this.characterId, movementMode });
    this.events.emit('loadout_changed', this.getLoadoutState());
  }

  /** Clear per-cast bookkeeping when the session resets. */
  resetSession() {
    this._castStunKeys.clear();
    this.hammerThrownUntil = 0;
    this.player.slowMult = 1;
    for (const s of this.slots) {
      s.state = 'ready';
      s.timer = 0;
      s.cooldownLeft = this.noCooldown ? 0 : 0;
    }
    this.events.emit('loadout_changed', this.getLoadoutState());
  }
}
