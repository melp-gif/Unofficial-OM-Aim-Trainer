import * as THREE from 'three';
import { clamp } from '../utils/math.js';

/**
 * Continuous-beam hit detection (Tails' Laser Cannon) + radial shockwaves
 * (Burst mode) + expanding AOE blasts.
 *
 * BEAM SCORING RULE (per project spec): a beam records ONE stun application
 * per cast — the first valid hit. Per-frame contact afterwards only applies
 * pushback; it never re-awards stun score.
 */
export class BeamSystem {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.activeBeams = [];
    this.activeWaves = [];
  }

  fireBeam({
    ability,
    origin,            // Vector3 — muzzle
    direction,         // normalized Vector3
    width = 3,
    range = 1000,
    duration = 4,
    pushbackSpeed = 12,
    color = 0xffe066,
    onFirstHit = null,
    onContact = null
  }) {
    const geo = new THREE.CylinderGeometry(width * 0.35, width * 0.6, 1, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);

    const beam = {
      ability,
      origin: origin.clone(),
      direction: direction.clone().normalize(),
      width,
      range,
      duration,
      age: 0,
      pushbackSpeed,
      mesh,
      hitOnce: new Set(),       // dummy ids that already scored
      onFirstHit,
      onContact
    };
    this._orientBeam(beam);
    this.activeBeams.push(beam);
    return beam;
  }

  _orientBeam(beam) {
    const mid = beam.origin.clone().addScaledVector(beam.direction, beam.range / 2);
    beam.mesh.position.copy(mid);
    beam.mesh.scale.set(1, beam.range, 1);
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, beam.direction);
    beam.mesh.quaternion.copy(quat);
  }

  /** Radial shockwave from a point along the ground (Burst mode / Shockwave mode). */
  fireShockwave({
    ability,
    center,
    radius = 16,
    expandSpeed = 30,
    duration = 1,
    forward = false,
    direction = null,
    color = 0xffcc44,
    onFirstHit = null
  }) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(center);
    mesh.position.y = 0.15;
    this.scene.add(mesh);

    this.activeWaves.push({
      ability, type: 'shockwave',
      center: center.clone(),
      direction: direction ? direction.clone().normalize() : null,
      forward,
      radius: 1,
      maxRadius: radius,
      expandSpeed,
      duration,
      age: 0,
      mesh,
      hitOnce: new Set(),
      onFirstHit
    });
  }

  /** Expanding AOE sphere (AOE Blast). */
  fireAoe({ ability, center, radius = 18, duration = 0.55, color = 0xff8844, onFirstHit = null }) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    mesh.position.copy(center);
    this.scene.add(mesh);
    this.activeWaves.push({
      ability, type: 'aoe',
      center: center.clone(),
      radius: 1,
      maxRadius: radius,
      expandSpeed: radius / duration,
      duration,
      age: 0,
      mesh,
      hitOnce: new Set(),
      onFirstHit
    });
  }

  update(dt, dummies, playerPos) {
    // ---- beams ----
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const b = this.activeBeams[i];
      b.age += dt;
      for (const dummy of dummies) {
        if (!dummy || !dummy.alive) continue;
        const info = this._beamDummyDistance(b, dummy);
        if (info.hit) {
          const isFirst = !b.hitOnce.has(dummy.id);
          b.hitOnce.add(dummy.id);
          const payload = {
            ability: b.ability,
            dummy,
            point: info.point,
            distance: playerPos ? dummy.position.distanceTo(playerPos) : null,
            isFirst,
            castHits: b.hitOnce.size,
            age: b.age
          };
          if (isFirst && b.onFirstHit) b.onFirstHit(payload);
          if (b.onContact) b.onContact(payload);
          if (b.pushbackSpeed > 0) {
            const push = b.direction.clone().multiplyScalar(b.pushbackSpeed * dt);
            push.y = 0;
            dummy.position.add(push);
          }
        }
      }
      if (b.age >= b.duration) {
        b.mesh.removeFromParent();
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.activeBeams.splice(i, 1);
      }
    }

    // ---- waves / aoe ----
    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const w = this.activeWaves[i];
      w.age += dt;
      const prevR = w.radius;
      w.radius = Math.min(w.maxRadius, w.radius + w.expandSpeed * dt);
      const t = w.age / w.duration;
      w.mesh.material.opacity = Math.max(0, 0.75 * (1 - t));
      const scale = Math.max(0.001, w.radius);
      w.mesh.scale.setScalar(scale);

      for (const dummy of dummies) {
        if (!dummy || !dummy.alive || w.hitOnce.has(dummy.id)) continue;
        const dx = dummy.position.x - w.center.x;
        const dz = dummy.position.z - w.center.z;
        const d = Math.hypot(dx, dz);
        const inRing = d <= w.radius + dummy.hitRadius && d >= prevR - dummy.hitRadius - 1.5;
        const inAoe = w.type === 'aoe' ? d <= w.radius + dummy.hitRadius : false;
        if (inRing || inAoe) {
          w.hitOnce.add(dummy.id);
          if (w.onFirstHit) {
            w.onFirstHit({
              ability: w.ability,
              dummy,
              point: dummy.position.clone(),
              distance: playerPos ? dummy.position.distanceTo(playerPos) : null,
              isFirst: true,
              castHits: w.hitOnce.size
            });
          }
        }
      }

      if (w.age >= w.duration) {
        w.mesh.removeFromParent();
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        this.activeWaves.splice(i, 1);
      }
    }
  }

  _beamDummyDistance(beam, dummy) {
    // distance from dummy center to the beam ray
    const target = dummy.getHitSphere();
    const oc = target.center.clone().sub(beam.origin);
    const t = clamp(oc.dot(beam.direction), 0, beam.range);
    const closest = beam.origin.clone().addScaledVector(beam.direction, t);
    const dist = closest.distanceTo(target.center);
    return {
      hit: dist <= beam.width + target.radius,
      point: closest,
      dist
    };
  }

  clear() {
    for (const b of this.activeBeams) {
      b.mesh.removeFromParent();
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
    }
    for (const w of this.activeWaves) {
      w.mesh.removeFromParent();
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
    }
    this.activeBeams.length = 0;
    this.activeWaves.length = 0;
  }
}
