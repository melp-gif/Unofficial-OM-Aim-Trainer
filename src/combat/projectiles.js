import * as THREE from 'three';
import { segmentSphereHit, rand } from '../utils/math.js';
import { GAME } from '../config/gameConfig.js';

/**
 * Pooled projectile system with swept-sphere hit detection.
 * Guarantees: no duplicate hits from a single projectile, no orphaned meshes,
 * deterministic cleanup on reset.
 */
export class ProjectileSystem {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.pool = [];
    this.active = [];
    this.castCounter = 0;
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._tmpC = new THREE.Vector3();
  }

  nextCastId() { return ++this.castCounter; }

  _makeMesh(style) {
    const g = new THREE.Group();
    switch (style) {
      case 'hammer': {
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 1.9, 10),
          new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.55 })
        );
        handle.rotation.x = Math.PI / 2;
        const head = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 1.0, 14),
          new THREE.MeshStandardMaterial({ color: 0xd93a4a, roughness: 0.4, metalness: 0.25 })
        );
        head.rotation.x = Math.PI / 2;
        head.position.z = 1.15;
        g.add(handle, head);
        break;
      }
      case 'rock': {
        const rock = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.85, 0),
          new THREE.MeshStandardMaterial({ color: 0x6a6a7a, roughness: 0.95 })
        );
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(1.15, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.22 })
        );
        g.add(rock, glow);
        break;
      }
      case 'javelin': {
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 3.0, 8),
          new THREE.MeshStandardMaterial({ color: 0x4a2a6a, roughness: 0.5 })
        );
        shaft.rotation.x = Math.PI / 2;
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(0.3, 0.9, 10),
          new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8822, emissiveIntensity: 1.0 })
        );
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 1.8;
        g.add(shaft, tip);
        break;
      }
      case 'orb': {
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 14, 12),
          new THREE.MeshBasicMaterial({ color: 0xffe066 })
        );
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(1.15, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.25 })
        );
        g.add(orb, halo);
        break;
      }
      case 'blast': {
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(1.05, 14, 12),
          new THREE.MeshBasicMaterial({ color: 0xffee88 })
        );
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(1.7, 14, 12),
          new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.28 })
        );
        g.add(core, shell);
        break;
      }
      case 'card':
      default: {
        // tarot-style card (plane with painted back)
        const card = new THREE.Mesh(
          new THREE.BoxGeometry(1.35, 0.06, 1.9),
          new THREE.MeshStandardMaterial({
            color: 0xf2e8d8,
            roughness: 0.5,
            emissive: 0xff5fa8,
            emissiveIntensity: 0.35
          })
        );
        const pip = new THREE.Mesh(
          new THREE.CircleGeometry(0.38, 18),
          new THREE.MeshBasicMaterial({ color: 0xff5fa8 })
        );
        pip.rotation.x = -Math.PI / 2;
        pip.position.y = 0.05;
        g.add(card, pip);
        break;
      }
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  fire({
    ability,
    from,
    direction,
    owner = 'player',
    style = 'card',
    speed = 120,
    radius = 1.2,
    gravity = 0,
    lifetime = 2.5,
    spin = 12,
    knockback = 0,
    returnAfter = 0,          // >0 = hammer-style boomerang/return behaviour
    manualPickup = false,
    targetPosition = null,    // for auto-return pickup checks
    colorTint = null,
    onHit = null,
    onExpire = null
  }) {
    if (this.active.length >= GAME.maxProjectiles) {
      // recycle oldest to protect performance
      const old = this.active.shift();
      this._release(old);
    }
    let p = this.pool.pop();
    if (!p) {
      p = {
        mesh: this._makeMesh(style),
        position: new THREE.Vector3(),
        prevPosition: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        alive: false,
        style: 'card'
      };
    }
    if (p.style !== style) {
      p.mesh.removeFromParent();
      p.mesh = this._makeMesh(style);
      p.style = style;
    }
    this.scene.add(p.mesh);

    p.position.copy(from);
    p.prevPosition.copy(from);
    p.velocity.copy(direction).normalize().multiplyScalar(speed);
    p.ability = ability;
    p.owner = owner;
    p.radius = radius;
    p.gravity = gravity;
    p.lifetime = lifetime;
    p.age = 0;
    p.travelTime = 0;
    p.spin = spin;
    p.knockback = knockback;
    p.castId = this.nextCastId();
    p.hitSomething = false;
    p.returnAfter = returnAfter;
    p.returning = false;
    p.manualPickup = manualPickup;
    p.pickupPosition = targetPosition ? targetPosition.clone() : from.clone();
    p.onHit = onHit;
    p.onExpire = onExpire;
    p.alive = true;
    if (colorTint) {
      p.mesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && p.style !== 'card') {
          o.material = o.material.clone();
          o.material.color.multiplyScalar(1);
        }
      });
    }
    p.mesh.position.copy(p.position);
    p.mesh.visible = true;
    this.active.push(p);
    return p;
  }

  update(dt, dummies, playerPos) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.age += dt;
      p.travelTime += dt;

      // return-home behaviour (Hammer Throw: after returnAfter seconds it flies back)
      if (p.returnAfter > 0 && !p.returning && p.age >= p.returnAfter) {
        p.returning = true;
      }
      if (p.returning) {
        const toHome = this._tmpC.copy(p.pickupPosition).sub(p.position);
        const dist = toHome.length();
        if (dist < 3) {
          this._expire(p, i, 'returned');
          continue;
        }
        toHome.normalize().multiplyScalar(120);
        p.velocity.lerp(toHome, Math.min(1, dt * 6));
      } else if (p.gravity !== 0) {
        p.velocity.y -= p.gravity * dt;
      }

      p.prevPosition.copy(p.position);
      p.position.addScaledVector(p.velocity, dt);

      // spin
      if (p.spin) {
        p.mesh.rotation.x += p.spin * dt * 0.6;
        p.mesh.rotation.y += p.spin * dt;
      }
      p.mesh.position.copy(p.position);

      // manual pickup check (Amy retrieving hammer) — only after it has
      // actually left her hand, so it can't be "picked up" at the muzzle
      if (p.manualPickup && !p.returning && playerPos && p.age > 0.45) {
        const dx = p.position.x - playerPos.x;
        const dz = p.position.z - playerPos.z;
        if (dx * dx + dz * dz < 36) { // within 6 studs
          this._expire(p, i, 'picked_up');
          continue;
        }
      }

      // hit detection vs dummies (swept sphere)
      if (!p.returning && p.owner === 'player') {
        for (const dummy of dummies) {
          if (!dummy || !dummy.alive) continue;
          const hit = this._checkDummyHit(p, dummy);
          if (hit) {
            p.hitSomething = true;
            const result = {
              projectile: p,
              dummy,
              point: hit.point,
              distance: hit.distance,
              travelTime: p.travelTime,
              castId: p.castId,
              ability: p.ability,
              knockback: p.knockback
            };
            // hammer-like projectiles may persist after hit — but for scoring
            // integrity, one projectile = one impact event
            this._expire(p, i, 'hit');
            if (p.onHit) p.onHit(result);
            break;
          }
        }
      }

      if (p.age >= p.lifetime) {
        this._expire(p, i, 'expired');
      }
    }
  }

  _checkDummyHit(p, dummy) {
    const target = dummy.getHitSphere(); // {center, radius}
    const hit = segmentSphereHit(p.prevPosition, p.position, target.center, target.radius + p.radius);
    if (hit) {
      return {
        point: new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z),
        distance: null // filled by combat director (player→target)
      };
    }
    return null;
  }

  _expire(p, index, reason) {
    p.alive = false;
    p.mesh.visible = false;
    p.mesh.removeFromParent();
    this.pool.push(p);
    this.active.splice(index, 1);
    p.lastReason = reason;
    // Notify for every non-hit end of life (miss, return-home, manual pickup).
    // Handlers decide whether it counts as a miss (they check hitSomething).
    if (reason !== 'hit' && p.onExpire) {
      p.onExpire({ projectile: p, castId: p.castId, ability: p.ability, reason });
    }
  }

  clear() {
    for (const p of this.active) {
      p.mesh.visible = false;
      p.mesh.removeFromParent();
      this.pool.push(p);
    }
    this.active.length = 0;
  }
}
