import * as THREE from 'three';
import { rand, clamp, lerp, horizontalDistance } from '../utils/math.js';
import { GAME } from '../config/gameConfig.js';
import { EXE_TYPES } from '../config/exes.js';
import { buildExe } from '../characters/models.js';

let dummyIdCounter = 0;

/**
 * A single EXE training dummy: visual model + combat state + movement/attack
 * behaviours. Controlled by exeAI.js according to its selected mode.
 */
export class ExeDummy {
  constructor(scene, typeKey, config) {
    this.scene = scene;
    this.id = ++dummyIdCounter;
    this.typeKey = typeKey;
    this.type = EXE_TYPES[typeKey] || EXE_TYPES['2011x'];
    this.config = { ...config };

    this.group = buildExe(typeKey);
    this.group.position.set(0, 0, -40);
    scene.add(this.group);

    this.position = this.group.position;
    this.velocity = new THREE.Vector3();
    this.facingYaw = 0;
    this.hitRadius = 2.6;

    this.maxHealth = config.health ?? this.type.health;
    this.health = this.maxHealth;
    this.alive = true;

    this.mode = config.mode || 'full';
    this.pattern = config.pattern || 'zigzag';
    this.speedMult = config.speed ?? 1;
    this.aggression = config.aggression ?? 0.7;

    // stun state (managed by StunSystem)
    this.stunState = 'none'; // none | stunned | recovering
    this.stunStartedAt = 0;
    this.stunEndsAt = 0;
    this.stunRecord = null;
    this.recoveryUntil = 0;

    // attack state
    this.attackState = 'idle'; // idle | windup | strike | cooldown
    this.attackTimer = 0;
    this.attackCooldownTimer = 0;
    this.targetWasWindingUp = false;

    // movement state
    this.homePosition = this.position.clone();
    this.wanderTarget = this.position.clone();
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    this.speedNow = 0;
    // axis for straight-line shuttles — must NOT be clobbered by facing updates
    this.patternAxisYaw = 0;

    this.canParry = !!this.type.canParry;
    this.rage = 0; // 2011X-style rage builds when stunned (verified trait)

    // status effects from Silver's Rock (slow + ability lock)
    this.slowFactor = 1;
    this.slowUntil = 0;
    this.abilityLockUntil = 0;

    // floating label
    this.labelSprite = this._makeLabel();
    this.group.add(this.labelSprite);

    this._lastPosition = this.position.clone();
  }

  _makeLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(14, 7, 1);
    sprite.position.y = 6.2;
    sprite.userData.canvas = canvas;
    sprite.userData.tex = tex;
    return sprite;
  }

  updateLabel() {
    const sprite = this.labelSprite;
    if (!sprite) return;
    const show = this.config.showHealthBar || this.config.showStunStatus || this.config.showDistance;
    sprite.visible = !!show;
    if (!show) return;

    const canvas = sprite.userData.canvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);

    let y = 24;
    if (this.config.showHealthBar) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(48, y, 160, 18);
      ctx.fillStyle = this.stunState === 'stunned' ? '#ffd23e' : '#ff3344';
      ctx.fillRect(50, y + 2, 156 * clamp(this.health / this.maxHealth, 0, 1), 14);
      y += 26;
    }
    ctx.font = '700 22px system-ui';
    ctx.textAlign = 'center';
    if (this.config.showStunStatus) {
      ctx.fillStyle = this.stunState === 'stunned' ? '#ffd23e' : this.attackState === 'windup' ? '#ff8844' : '#eee';
      const status = this.stunState === 'stunned' ? 'STUNNED' : this.attackState === 'windup' ? 'WINDUP' : this.type.name;
      ctx.fillText(status, 128, y + 10);
      y += 26;
    }
    if (this.config.showDistance && this._playerPos) {
      ctx.fillStyle = '#8fd0ff';
      ctx.font = '600 20px system-ui';
      ctx.fillText(`${horizontalDistance(this.position, this._playerPos).toFixed(0)} studs`, 128, y + 8);
    }
    sprite.userData.tex.needsUpdate = true;
  }

  /** Hit capsule used by projectile/beam collision. */
  getHitSphere() {
    return {
      center: new THREE.Vector3(this.position.x, this.position.y + 2.1, this.position.z),
      radius: this.hitRadius
    };
  }

  applyDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.alive = false;
      this.group.visible = false;
    }
  }

  respawn() {
    this.health = this.maxHealth;
    this.alive = true;
    this.group.visible = true;
    this.stunState = 'none';
    this.stunRecord = null;
    this.attackState = 'idle';
    this.attackTimer = 0;
    this.attackCooldownTimer = 0;
    this.recoveryUntil = 0;
    this.rage = 0;
    this.group.position.copy(this.homePosition);
    this.velocity.set(0, 0, 0);
  }

  resetPosition() {
    this.group.position.copy(this.homePosition);
    this.velocity.set(0, 0, 0);
    this.stunState = 'none';
    this.stunRecord = null;
    this.attackState = 'idle';
    this.recoveryUntil = 0;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      }
    });
  }

  /** Instantaneous horizontal speed (studs/s) — feeds the "moving target" style check. */
  currentSpeed() {
    const dx = this.position.x - this._lastPosition.x;
    const dz = this.position.z - this._lastPosition.z;
    return Math.hypot(dx, dz) / Math.max(this._dt || 1 / 60, 1e-4);
  }

  /** Approach speed toward the player (>0 means closing distance). */
  approachSpeedTo(playerPos) {
    const dNow = horizontalDistance(this.position, playerPos);
    const dPrev = horizontalDistance(this._lastPosition, playerPos);
    return (dPrev - dNow) / Math.max(this._dt || 1 / 60, 1e-4);
  }

  beginFrame(dt) {
    this._dt = dt;
    this._lastPosition.copy(this.position);
  }

  get playerPos() { return this._playerPos; }
  set playerPos(v) { this._playerPos = v; }
}
