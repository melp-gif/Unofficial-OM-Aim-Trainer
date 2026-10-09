import * as THREE from 'three';
import { rand, clamp, lerp, horizontalDistance, deg2rad } from '../utils/math.js';

/**
 * EXE AI: the four required dummy behaviours (Stationary / Moving /
 * Attacking / Full-Movement). Telegraphed windups give real vulnerability
 * windows that the Attack-Windup practice mode scores against.
 */
export class ExeAI {
  constructor(dummy, audio, events) {
    this.dummy = dummy;
    this.audio = audio;
    this.events = events;
    this.attackWindupTotal = dummy.type.windup;
  }

  update(dt, player, gameTime) {
    const d = this.dummy;
    d.beginFrame(dt);
    d.playerPos = player.position;

    // stunned: frozen in place until measured duration elapses
    if (d.stunState === 'stunned') {
      if (gameTime >= d.stunEndsAt) {
        this.events.emit('dummy_stun_expired', d);
      }
      d.updateLabel();
      return;
    }

    if (!d.alive) return;

    switch (d.mode) {
      case 'stationary': this._stationary(dt, player); break;
      case 'moving': this._moving(dt, player); break;
      case 'attacking': this._attacking(dt, player, gameTime); break;
      case 'full': this._full(dt, player, gameTime); break;
      default: this._stationary(dt, player); break;
    }

    this._applyMotion(dt, player);
    this._animate(dt);
    d.updateLabel();
  }

  /* ---------------- stationary ---------------- */
  _stationary(dt, player) {
    const d = this.dummy;
    d.speedNow = 0;
    // configurable facing
    if (d.config.facing === -1) {
      this._faceToward(player.position);
    } else {
      d.facingYaw = deg2rad(d.config.facing ?? 0);
      d.group.rotation.y = lerp(d.group.rotation.y, d.facingYaw, Math.min(1, dt * 6));
    }
  }

  /* ---------------- moving patterns ---------------- */
  _moving(dt, player) {
    const d = this.dummy;
    const baseSpeed = (d.type.speed * d.speedMult * this._difficultySpeed());
    let dir = new THREE.Vector3();

    const t = d._aiTime = (d._aiTime || 0) + dt;

    switch (d.pattern) {
      case 'straight': {
        // shuttle along a FIXED axis (independent of visual facing)
        const span = d.config.areaRadius || 45;
        const phase = Math.sin(t * 0.35 * d.speedMult);
        const target = d.homePosition.clone();
        target.x += Math.cos(d.patternAxisYaw) * phase * span;
        target.z += Math.sin(d.patternAxisYaw) * phase * span;
        dir.copy(target).sub(d.position).setY(0);
        if (dir.lengthSq() > 1) dir.normalize();
        break;
      }
      case 'strafe': {
        // orbit the home point
        d.strafeTimer -= dt;
        if (d.strafeTimer <= 0) {
          d.strafeTimer = rand(2.5, 5);
          if (Math.random() < 0.35) d.strafeDir *= -1;
        }
        const toHome = d.homePosition.clone().sub(d.position).setY(0);
        const distHome = toHome.length();
        const tangent = new THREE.Vector3(-toHome.z, 0, toHome.x).normalize().multiplyScalar(d.strafeDir);
        const radial = distHome > (d.config.areaRadius || 45) ? toHome.normalize() : toHome.multiplyScalar(0.15);
        dir.copy(tangent).add(radial).normalize();
        break;
      }
      case 'wander': {
        if (d.position.distanceTo(d.wanderTarget) < 4) {
          const r = d.config.areaRadius || 45;
          d.wanderTarget.copy(d.homePosition).add(
            new THREE.Vector3(rand(-r, r), 0, rand(-r, r))
          );
        }
        dir.copy(d.wanderTarget).sub(d.position).setY(0).normalize();
        break;
      }
      case 'zigzag': {
        d.strafeTimer -= dt;
        if (d.strafeTimer <= 0) {
          d.strafeTimer = rand(0.6, 1.4);
          d.strafeDir *= -1;
        }
        const toPlayer = player.position.clone().sub(d.position).setY(0).normalize();
        const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(d.strafeDir * 0.9);
        const radial = d.homePosition.clone().sub(d.position).setY(0).normalize().multiplyScalar(0.25);
        dir.copy(toPlayer).multiplyScalar(0.5).add(side).add(radial).normalize();
        break;
      }
      case 'random':
      default: {
        if (Math.random() < dt * 0.6) {
          const r = d.config.areaRadius || 45;
          d.wanderTarget.copy(d.position).add(new THREE.Vector3(rand(-r * 0.5, r * 0.5), 0, rand(-r * 0.5, r * 0.5)));
        }
        dir.copy(d.wanderTarget).sub(d.position).setY(0);
        if (dir.lengthSq() > 1) dir.normalize();
        break;
      }
    }

    d.velocity.copy(dir).multiplyScalar(baseSpeed);
    d.speedNow = baseSpeed;
    if (dir.lengthSq() > 0.01) this._faceToward(d.position.clone().add(dir));
  }

  /* ---------------- attacking (telegraph drills) ---------------- */
  _attacking(dt, player, gameTime) {
    const d = this.dummy;
    // keep distance-ish: patrol near home, occasionally attack when in range
    const dist = horizontalDistance(d.position, player.position);
    const range = d.type.attackRange;

    if (d.attackState === 'windup') {
      d.attackTimer -= dt;
      d.velocity.multiplyScalar(0.82);
      d.speedNow = 0;
      this._faceToward(player.position);
      if (d.attackTimer <= 0) {
        d.attackState = 'strike';
        d.attackTimer = 0.16;
        this._resolveAttack(player);
      }
      return;
    }
    if (d.attackState === 'strike') {
      d.attackTimer -= dt;
      if (d.attackTimer <= 0) {
        d.attackState = 'cooldown';
        d.attackCooldownTimer = d.type.attackCooldown * (1.4 - d.aggression * 0.7);
      }
      return;
    }
    if (d.attackState === 'cooldown') {
      d.attackCooldownTimer -= dt;
      if (d.attackCooldownTimer <= 0) d.attackState = 'idle';
    }

    // approach or orbit the player at attack range
    const toPlayer = player.position.clone().sub(d.position).setY(0);
    const distP = toPlayer.length() || 1;
    toPlayer.normalize();

    if (distP > range * 1.25) {
      d.velocity.copy(toPlayer).multiplyScalar(d.type.speed * d.speedMult * 0.75 * this._difficultySpeed());
    } else {
      const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(d.strafeDir);
      d.velocity.copy(side).multiplyScalar(d.type.speed * 0.4 * d.speedMult);
      d.strafeTimer -= dt;
      if (d.strafeTimer <= 0) {
        d.strafeTimer = rand(1.2, 2.6);
        d.strafeDir *= -1;
      }
    }
    d.speedNow = d.velocity.length();
    this._faceToward(player.position);

    if (distP <= range && d.attackState === 'idle' && d.attackCooldownTimer <= 0) {
      const chance = (0.6 + d.aggression * 1.6) * dt;
      if (Math.random() < chance) this._startWindup(player);
    }
  }

  /* ---------------- full movement (chase AI) ---------------- */
  _full(dt, player, gameTime) {
    const d = this.dummy;
    const dist = horizontalDistance(d.position, player.position);
    const range = d.type.attackRange;

    // attack states shared with _attacking
    if (d.attackState === 'windup' || d.attackState === 'strike' || d.attackState === 'cooldown') {
      this._attacking(dt, player, gameTime);
      return;
    }

    // rage mode: 2011X-style — being stunned builds rage → speed bursts (verified trait)
    const rageBoost = 1 + d.rage * 0.35;

    const toPlayer = player.position.clone().sub(d.position).setY(0);
    const distP = toPlayer.length() || 1;
    toPlayer.normalize();

    // pursuit with occasional reposition strafes (never predictable in a straight line)
    d.strafeTimer -= dt;
    if (d.strafeTimer <= 0) {
      d.strafeTimer = rand(0.9, 2.2);
      d.strafeDir = Math.random() > 0.5 ? 1 : -1;
    }
    const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(d.strafeDir * 0.35 * (1 - d.aggression * 0.5));
    const chaseDir = toPlayer.add(side).normalize();
    const speed = d.type.speed * d.speedMult * (0.8 + d.aggression * 0.6) * rageBoost * this._difficultySpeed();

    d.velocity.copy(chaseDir).multiplyScalar(distP > range ? speed : speed * 0.45);
    d.speedNow = d.velocity.length();
    this._faceToward(player.position);

    if (distP <= range && d.attackCooldownTimer <= 0 && d.attackState === 'idle') {
      const chance = (0.9 + d.aggression * 2.2) * dt;
      if (Math.random() < chance) this._startWindup(player);
    }
    if (d.attackCooldownTimer > 0) d.attackCooldownTimer -= dt;
  }

  /* ---------------- shared ---------------- */
  _startWindup(player) {
    const d = this.dummy;
    // Silver Rock's verified effect: EXE cannot use abilities while locked
    if (d.abilityLockUntil && (d._gameTime || 0) < d.abilityLockUntil) return;
    d.attackState = 'windup';
    // difficulty affects windup length (longer = easier to punish)
    const diffScale = d.config.difficulty === 'easy' ? 1.5 : d.config.difficulty === 'hard' ? 0.72 : 1;
    d.attackTimer = d.type.windup * diffScale;
    this.attackWindupTotal = d.attackTimer;
    d.targetWasWindingUp = true;
    this.audio.play('exe_attack');
    this.events.emit('exe_windup', { dummy: d, windupSeconds: d.attackTimer });
  }

  _resolveAttack(player) {
    const d = this.dummy;
    const dist = horizontalDistance(d.position, player.position);
    if (dist <= d.type.attackRange * 1.15 && d.config.canDamagePlayer && player.alive) {
      const dealt = player.applyDamage(d.config.damage ?? d.type.damage);
      this.events.emit('exe_hit_player', { dummy: d, damage: dealt, playerDistance: dist });
      this.audio.play('player_hurt');
    }
    this.events.emit('exe_strike', { dummy: d, distance: dist });
  }

  _applyMotion(dt, player) {
    const d = this.dummy;
    // Silver Rock slow: scales movement while active
    const slowActive = d.slowUntil && (d._gameTime || 0) < d.slowUntil;
    const slowScale = slowActive ? (d.slowFactor ?? 1) : 1;
    if (d.speedNow > 0.01 || d.velocity.lengthSq() > 0.01) {
      d.position.x += d.velocity.x * slowScale * dt;
      d.position.z += d.velocity.z * slowScale * dt;
    }
    // keep dummies inside the arena & out of the player's body
    d.position.x = clamp(d.position.x, -268, 268);
    d.position.z = clamp(d.position.z, -268, 268);
    const dist = horizontalDistance(d.position, player.position);
    if (dist < 2.2 && dist > 0.001) {
      const push = player.position.clone().sub(d.position).setY(0).normalize().multiplyScalar((2.2 - dist));
      d.position.sub(push);
    }
    d.rage = Math.max(0, d.rage - dt * 0.05);
  }

  _difficultySpeed() {
    const d = this.dummy.config.difficulty;
    return d === 'easy' ? 0.8 : d === 'hard' ? 1.25 : 1;
  }

  _faceToward(target) {
    const d = this.dummy;
    const dx = target.x - d.position.x;
    const dz = target.z - d.position.z;
    const want = Math.atan2(dx, dz);
    let diff = want - d.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    d.group.rotation.y += diff * 0.12;
    d.facingYaw = want;
  }

  _animate(dt) {
    const d = this.dummy;
    const parts = d.group.userData.parts;
    if (!parts) return;
    const t = (d._animT = (d._animT || 0) + dt * (2 + d.speedNow * 0.35));
    const swing = Math.sin(t) * clamp(d.speedNow * 0.055, 0, 0.85);
    if (parts.legL) parts.legL.rotation.x = swing;
    if (parts.legR) parts.legR.rotation.x = -swing;
    if (parts.armL) parts.armL.rotation.x = -swing;

    if (d.attackState === 'windup') {
      // telegraph: raise arm, lean back
      const p = 1 - clamp(d.attackTimer / Math.max(0.01, this.attackWindupTotal), 0, 1);
      if (parts.armR) parts.armR.rotation.x = lerp(0.2, -2.4, p);
      d.group.rotation.x = lerp(0, -0.18, Math.sin(p * Math.PI));
      // flash the aura red as a telegraph
      if (parts.aura) parts.aura.material.opacity = 0.07 + p * 0.35;
    } else {
      if (parts.armR) parts.armR.rotation.x = lerp(parts.armR.rotation.x, swing * 0.7, 0.15);
      d.group.rotation.x = lerp(d.group.rotation.x, 0, 0.15);
      if (parts.aura) {
        const stunned = d.stunState === 'stunned';
        parts.aura.material.opacity = stunned ? 0.3 : 0.07 + d.rage * 0.12;
      }
    }

    // stunned look: slump
    if (d.stunState === 'stunned') {
      d.group.rotation.x = lerp(d.group.rotation.x, 0.22, 0.1);
    }
  }
}
