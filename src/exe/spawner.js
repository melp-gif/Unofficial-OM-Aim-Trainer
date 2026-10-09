import * as THREE from 'three';
import { GAME } from '../config/gameConfig.js';
import { EXE_TYPES, defaultSpawnConfig } from '../config/exes.js';
import { ExeDummy } from './exeDummy.js';
import { ExeAI } from './exeAI.js';

/**
 * EXE dummy spawner: spawn / remove / reset / respawn controls, multi-dummy
 * target switching, config application and performance caps.
 */
export class DummySpawner {
  constructor(scene, audio, events) {
    this.scene = scene;
    this.audio = audio;
    this.events = events;
    this.dummies = [];
    this.aiByDummy = new Map();
    this.selectedId = null;
    this.config = defaultSpawnConfig();
    this.spawnCount = 0;
  }

  get selected() {
    return this.dummies.find((d) => d.id === this.selectedId) || null;
  }

  setConfig(partial) {
    Object.assign(this.config, partial);
    // live-apply to existing dummies
    for (const d of this.dummies) {
      if (partial.mode !== undefined) d.mode = this.config.mode;
      if (partial.pattern !== undefined) d.pattern = this.config.pattern;
      if (partial.speed !== undefined) d.speedMult = this.config.speed;
      if (partial.aggression !== undefined) d.aggression = this.config.aggression;
      if (partial.health !== undefined) {
        d.maxHealth = this.config.health;
        d.health = Math.min(d.health, d.maxHealth);
      }
      if (partial.damage !== undefined) d.config.damage = this.config.damage;
      if (partial.canDamagePlayer !== undefined) d.config.canDamagePlayer = this.config.canDamagePlayer;
      if (partial.showHealthBar !== undefined) d.config.showHealthBar = this.config.showHealthBar;
      if (partial.showStunStatus !== undefined) d.config.showStunStatus = this.config.showStunStatus;
      if (partial.showDistance !== undefined) d.config.showDistance = this.config.showDistance;
      if (partial.facing !== undefined) d.config.facing = this.config.facing;
      if (partial.difficulty !== undefined) d.config.difficulty = this.config.difficulty;
      if (partial.areaRadius !== undefined) d.config.areaRadius = this.config.areaRadius;
    }
    this.events.emit('spawner_config', this.config);
  }

  /** Spawn one dummy in front of the player at the configured distance. */
  spawn(playerPosition, yaw = Math.PI) {
    if (this.dummies.length >= GAME.maxDummies) {
      this.events.emit('spawner_limit', { max: GAME.maxDummies });
      this.audio.play('denied');
      return null;
    }
    const cfg = {
      ...this.config,
      mode: this.config.mode,
      pattern: this.config.pattern,
      speed: this.config.speed,
      aggression: this.config.aggression,
      health: this.config.health,
      damage: this.config.damage,
      canDamagePlayer: this.config.canDamagePlayer,
      showHealthBar: this.config.showHealthBar,
      showStunStatus: this.config.showStunStatus,
      showDistance: this.config.showDistance,
      facing: this.config.facing,
      difficulty: this.config.difficulty,
      areaRadius: this.config.areaRadius
    };

    const dummy = new ExeDummy(this.scene, this.config.exeType, cfg);
    const angle = yaw + Math.PI + (Math.random() - 0.5) * 0.35 + (this.dummies.length * 0.45);
    const dist = this.config.distance;
    dummy.position.set(
      playerPosition.x - Math.sin(angle) * dist,
      0,
      playerPosition.z - Math.cos(angle) * dist
    );
    dummy.homePosition.copy(dummy.position);
    dummy.wanderTarget.copy(dummy.position);
    this.dummies.push(dummy);
    const ai = new ExeAI(dummy, this.audio, this.events);
    this.aiByDummy.set(dummy.id, ai);
    this.selectedId = dummy.id;
    this.spawnCount++;
    this.audio.play('spawn');
    this.events.emit('dummy_spawned', dummy);
    return dummy;
  }

  spawnMultiple(playerPosition, yaw, count) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const d = this.spawn(playerPosition, yaw);
      if (d) spawned.push(d);
    }
    return spawned;
  }

  removeSelected() {
    const d = this.selected;
    if (!d) { this.audio.play('denied'); return; }
    this._remove(d);
  }

  removeAll() {
    for (const d of [...this.dummies]) this._remove(d);
    this.selectedId = null;
  }

  _remove(d) {
    this.aiByDummy.delete(d.id);
    d.dispose();
    const idx = this.dummies.indexOf(d);
    if (idx >= 0) this.dummies.splice(idx, 1);
    if (this.selectedId === d.id) this.selectedId = this.dummies[0]?.id ?? null;
    this.audio.play('despawn');
    this.events.emit('dummy_removed', d);
  }

  resetSelectedPosition() {
    const d = this.selected;
    if (!d) { this.audio.play('denied'); return; }
    d.resetPosition();
    this.audio.play('spawn');
    this.events.emit('dummy_reset', d);
  }

  respawnSelected() {
    const d = this.selected;
    if (!d) { this.audio.play('denied'); return; }
    d.respawn();
    this.audio.play('spawn');
    this.events.emit('dummy_respawned', d);
  }

  clearSession() {
    this.removeAll();
    this.events.emit('session_cleared');
    this.audio.play('despawn');
  }

  select(id) {
    if (this.dummies.some((d) => d.id === id)) {
      this.selectedId = id;
      this.events.emit('dummy_selected', this.selected);
    }
  }

  selectNext() {
    if (this.dummies.length === 0) return;
    const idx = this.dummies.findIndex((d) => d.id === this.selectedId);
    this.selectedId = this.dummies[(idx + 1) % this.dummies.length].id;
    this.events.emit('dummy_selected', this.selected);
  }

  /** Auto-respawn check (config.autoRespawn) + per-frame AI. */
  update(dt, player, gameTime, stunSystem) {
    for (const d of this.dummies) {
      const ai = this.aiByDummy.get(d.id);
      if (!ai) continue;

      if (!d.alive && this.config.autoRespawn) {
        d._respawnTimer = (d._respawnTimer || 0) + dt;
        if (d._respawnTimer > 3) {
          d._respawnTimer = 0;
          d.respawn();
          this.events.emit('dummy_respawned', d);
        }
        continue;
      }

      d._gameTime = gameTime;
      ai.update(dt, player, gameTime);

      // Stun expiry is resolved HERE so the measured-duration pipeline works
      // in any host (game, tests, tools) — measures real elapsed time.
      if (d.stunState === 'stunned' && d.stunRecord && gameTime >= d.stunEndsAt) {
        stunSystem.finishStun(d);
      }

      // reset-after-stun option returns the EXE to its home post
      if (this.config.resetAfterStun && d.stunState === 'recovering' && !d._resetFlag) {
        d._resetFlag = true;
        d.resetPosition();
      }
      if (d.stunState !== 'recovering') d._resetFlag = false;
    }
  }

  updateAllLabels() {
    for (const d of this.dummies) d.updateLabel();
  }
}
