import * as THREE from 'three';
import { clamp, lerp } from '../utils/math.js';
import { GAME } from '../config/gameConfig.js';
import { buildSurvivor } from './models.js';

/**
 * Third-person survivor controller with over-the-shoulder camera,
 * matching OM's Roblox-style movement feel (walk/sprint/jump, responsive turn).
 */
export class Player {
  constructor(scene, camera, arena) {
    this.scene = scene;
    this.camera = camera;
    this.arena = arena;

    this.group = new THREE.Group();
    this.model = buildSurvivor('amy');
    this.group.add(this.model);
    scene.add(this.group);

    this.position = this.group.position;
    this.position.set(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI;          // facing -Z initially (toward dummy lane)
    this.pitch = -0.08;

    this.height = 3.2;           // eye height in studs
    this.radius = 1.6;
    this.grounded = true;

    this.health = GAME.player.maxHealth;
    this.maxHealth = GAME.player.maxHealth;
    this.alive = true;
    this.downedUntil = 0;

    // stat modifiers (from Amy's tarot cards)
    this.speedAdd = 0;
    this.damageMult = 1.0;
    this.slowMult = 1.0;       // charging laser slows Tails (verified)
    this.visionLoss = false;

    // Glide state (Tails — verified mobility)
    this.gliding = false;
    this.glideTimeLeft = 0;
    this.glideElapsed = 0;
    this._glideGravityScale = 1;
    this._glideLift = 0;

    this.walkSpeed = GAME.player.walkSpeed;
    this.sprintSpeed = GAME.player.sprintSpeed;

    this._camDist = 11.5;
    this._camHeight = 5.4;
    this._bobT = 0;

    // ability aim origin (for projectiles)
    this.muzzleWorld = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3(0, 0, -1);
  }

  setCharacter(charId) {
    this.group.remove(this.model);
    this.model = buildSurvivor(charId);
    this.group.add(this.model);
    this.walkSpeed = GAME.player.walkSpeed;
    this.sprintSpeed = GAME.player.sprintSpeed;
  }

  reset(pos = new THREE.Vector3(0, 0, 0)) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.alive = true;
    this.yaw = Math.PI;
    this.pitch = -0.08;
  }

  getTargetPosition() {
    return new THREE.Vector3(this.position.x, this.position.y + 1.4, this.position.z);
  }

  applyDamage(amount) {
    if (!this.alive) return;
    const dmg = amount * this.damageMult;
    this.health = Math.max(0, this.health - dmg);
    if (this.health <= 0) {
      this.alive = false;
    }
    return dmg;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    if (this.health > 0) this.alive = true;
  }

  startGlide(duration, gravityScale, liftAcceleration) {
    this.gliding = true;
    this.glideTimeLeft = duration;
    this.glideElapsed = 0;
    this._glideGravityScale = gravityScale;
    this._glideLift = liftAcceleration;
    if (this.velocity.y > 4) this.velocity.y = 4; // slow horizontal dive-in
  }

  stopGlide() {
    this.gliding = false;
    this.glideTimeLeft = 0;
    this.glideElapsed = 0;
  }

  update(dt, input, frozen = false) {
    const look = input.consumeLookDelta();
    if (!frozen) {
      this.yaw -= look.x;
      this.pitch = clamp(this.pitch - look.y, -1.15, 0.95);
    }

    // movement
    const speed = input.sprinting ? this.sprintSpeed : this.walkSpeed;
    const totalSpeed = Math.max(4, (speed + this.speedAdd) * this.slowMult);
    const mx = input.moveAxis.x;
    const mz = input.moveAxis.y;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    // camera-forward is (sinY, cosY); screen-right is (-cosY, sinY)
    const wishX = -mx * cosY + mz * sinY;
    const wishZ = mx * sinY + mz * cosY;

    if (!frozen && (Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01)) {
      const accel = GAME.player.acceleration * dt;
      this.velocity.x = lerp(this.velocity.x, wishX * totalSpeed, Math.min(1, accel / totalSpeed * 2.2));
      this.velocity.z = lerp(this.velocity.z, wishZ * totalSpeed, Math.min(1, accel / totalSpeed * 2.2));
    } else {
      const fr = Math.exp(-GAME.player.friction * dt);
      this.velocity.x *= fr;
      this.velocity.z *= fr;
    }

    // jump & gravity
    if (!frozen && input.jumping && this.grounded) {
      this.velocity.y = GAME.player.jumpVelocity;
      this.grounded = false;
      input.jumping = false;
    }

    if (this.gliding) {
      this.glideTimeLeft -= dt;
      this.glideElapsed += dt;
      // verified glide: slow descent; holding jump floats upward
      this.velocity.y -= GAME.player.gravity * this._glideGravityScale * dt;
      if (!frozen && input.jumping) {
        this.velocity.y += this._glideLift * dt;
      }
      this.velocity.y = clamp(this.velocity.y, -10, 14);
      if (this.glideTimeLeft <= 0 || this.grounded) this.stopGlide();
    } else {
      this.velocity.y -= GAME.player.gravity * dt;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }

    this.arena.collide(this.position, this.radius);

    // face movement direction (model yaw)
    const moving = Math.hypot(this.velocity.x, this.velocity.z) > 1.2;
    if (moving) {
      const targetModelYaw = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = targetModelYaw - this.model.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.model.rotation.y += diff * Math.min(1, dt * 10);
    } else {
      this.model.rotation.y = lerp(this.model.rotation.y, this.yaw, Math.min(1, dt * 8));
    }

    // simple run animation
    this._animateLimbs(dt, moving);

    // camera
    this._updateCamera(dt, input.sprinting && moving);

    // aim ray for abilities (matches camera-forward)
    this.aimDirection.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
    this.muzzleWorld.set(
      this.position.x + this.aimDirection.x * 2.2,
      this.position.y + 2.1 + this.aimDirection.y * 1.2,
      this.position.z + this.aimDirection.z * 2.2
    );

    // slow passive regen
    if (this.alive && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + GAME.player.regenPerSecond * dt);
    }
  }

  _animateLimbs(dt, moving) {
    const parts = this.model.userData.parts;
    if (!parts) return;
    this._bobT += dt * (moving ? 9 : 2);
    const swing = moving ? Math.sin(this._bobT) * 0.65 : Math.sin(this._bobT) * 0.06;
    if (parts.legL) parts.legL.rotation.x = swing;
    if (parts.legR) parts.legR.rotation.x = -swing;
    if (parts.armL) parts.armL.rotation.x = -swing * 0.8;
    if (parts.armR) {
      // right arm holds weapon toward aim direction
      const raise = moving ? 0.25 : 0.45;
      parts.armR.rotation.x = lerp(parts.armR.rotation.x, -raise - this.pitch * 0.7, Math.min(1, dt * 8));
    }
  }

  _updateCamera(dt, sprinting) {
    const dist = this._camDist + (sprinting ? 1.4 : 0);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const camX = this.position.x - Math.sin(this.yaw) * cp * dist;
    const camY = this.position.y + this._camHeight - sp * dist;
    const camZ = this.position.z - Math.cos(this.yaw) * cp * dist;
    const t = Math.min(1, dt * 14);
    this.camera.position.x = lerp(this.camera.position.x, camX, t);
    this.camera.position.y = lerp(this.camera.position.y, camY, t);
    this.camera.position.z = lerp(this.camera.position.z, camZ, t);

    // Look along the aim direction itself so the crosshair (screen centre)
    // always matches the projectile/beam aim ray.
    const fwd = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    this.camera.lookAt(
      this.camera.position.x + fwd.x * 30,
      this.camera.position.y + fwd.y * 30,
      this.camera.position.z + fwd.z * 30
    );
  }

  /** Aim ray from camera through crosshair (used for hit-scan aim). */
  getAimRay() {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin, direction: dir };
  }

  /**
   * The world point the crosshair is on, at the given distance.
   * Projectiles are fired from the muzzle TOWARD this point so shots always
   * land where the crosshair is (standard TPS muzzle convergence).
   */
  getAimPoint(distance = 220) {
    const { origin, direction } = this.getAimRay();
    return origin.addScaledVector(direction, distance);
  }
}
