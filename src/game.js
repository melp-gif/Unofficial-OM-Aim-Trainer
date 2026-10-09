import * as THREE from 'three';
import { RendererEngine } from './engine/renderer.js';
import { InputManager } from './engine/input.js';
import { AudioEngine } from './engine/audio.js';
import { Arena } from './world/arena.js';
import { Player } from './characters/player.js';
import { ProjectileSystem } from './combat/projectiles.js';
import { BeamSystem } from './combat/beams.js';
import { StunSystem } from './combat/stunSystem.js';
import { FeedbackDirector } from './combat/feedback.js';
import { StyleScorer } from './scoring/stylePoints.js';
import { Analytics } from './scoring/analytics.js';
import { TarotDeck } from './abilities/tarot.js';
import { CombatDirector, SLOT_LAYOUT } from './abilities/abilitySystem.js';
import { DummySpawner } from './exe/spawner.js';
import { getMode } from './training/modes.js';
import { CHARACTERS } from './config/characters.js';
import { GAME } from './config/gameConfig.js';
import { EventBus } from './utils/events.js';
import { rand, horizontalDistance } from './utils/math.js';

/** Top-level game orchestrator: owns every subsystem and the frame loop. */
export class Game {
  constructor(canvas) {
    this.events = new EventBus();
    this.audio = new AudioEngine();
    this.rendererEngine = new RendererEngine(canvas);
    this.input = new InputManager(canvas);
    this.arena = new Arena(this.rendererEngine.scene);
    this.player = new Player(this.rendererEngine.scene, this.rendererEngine.camera, this.arena);

    this.projectiles = new ProjectileSystem(this.rendererEngine.scene, this.audio);
    this.beams = new BeamSystem(this.rendererEngine.scene, this.audio);
    this.stunSystem = new StunSystem(this.events);
    this.styleScorer = new StyleScorer();
    this.analytics = new Analytics();
    this.feedback = new FeedbackDirector(this.events, this.styleScorer, this.analytics, this.audio);
    this.tarot = new TarotDeck(this.events);
    this.spawner = new DummySpawner(this.rendererEngine.scene, this.audio, this.events);

    this.combat = new CombatDirector({
      scene: this.rendererEngine.scene,
      player: this.player,
      projectiles: this.projectiles,
      beams: this.beams,
      stunSystem: this.stunSystem,
      feedback: this.feedback,
      analytics: this.analytics,
      tarot: this.tarot,
      spawner: this.spawner,
      audio: this.audio,
      events: this.events
    });

    this.running = false;
    this.paused = false;
    this.gameTime = 0;
    this.currentModeId = 'custom';
    this.reactionDrill = false;
    this._reactionTimer = 0;
    this._lastFrame = performance.now();
    this._labelTimer = 0;

    this._bindInput();
    this._bindGameEvents();

    // initial character + deck
    this.setActiveCharacter('amy');
    this.tarot.drawInitial();
    this.tarot.applyToPlayer(this.player);
  }

  _bindInput() {
    this.input.on('ability', (slot) => {
      if (!this.running || this.paused) return;
      this.combat.activateSlot(slot);
    });
    this.input.on('fireStart', () => {
      if (!this.running || this.paused) return;
      this.combat.holdingFire = true;
      this.combat._autoFireTimer = 0.22;
      this.combat.fire();
    });
    this.input.on('fireEnd', () => {
      this.combat.holdingFire = false;
    });
    this.input.on('pause', () => {
      if (this.running) this.togglePause();
    });
  }

  _bindGameEvents() {
    // keep EXE able to attack only when not ability-locked (Silver Rock's verified effect)
    this.events.on('exe_windup', ({ dummy }) => {
      if (dummy.abilityLockUntil && this.gameTime < dummy.abilityLockUntil) {
        dummy.attackState = 'idle';
        this.events.emit('combat_feed', {
          kind: 'info',
          text: `${dummy.type.name} is ability-locked — attack cancelled (Rock effect)`,
          at: performance.now()
        });
      }
    });

    // when a stun ends, if using resetAfterStun the spawner handles position reset
    this.events.on('dummy_stun_expired', (dummy) => {
      const rec = this.stunSystem.finishStun(dummy);
      if (rec) {
        // recovery frame blocks immediate re-stun — surfaced in the feed
        this.events.emit('combat_feed', {
          kind: 'info',
          text: `${dummy.type.name} enters stun recovery (${GAME.stunRecoverySeconds}s) — further stuns briefly rejected`,
          at: performance.now()
        });
      }
    });
  }

  /* ---------------- lifecycle ---------------- */

  start(modeId = 'custom') {
    this.running = true;
    this.paused = false;
    this.audio.startAmbience();
    this.setMode(modeId);
    this._lastFrame = performance.now();
    if (!this._raf) this._raf = requestAnimationFrame((t) => this._frame(t));
    this.events.emit('game_started', { modeId });
  }

  togglePause() {
    this.paused = !this.paused;
    this.events.emit('game_paused', this.paused);
    if (this.paused) this.audio.stopAmbience();
    else this.audio.startAmbience();
  }

  resume() {
    if (this.paused) this.togglePause();
  }

  stop() {
    this.running = false;
    this.audio.stopAmbience();
    this.events.emit('game_stopped', {});
  }

  setMode(modeId) {
    const mode = getMode(modeId);
    this.currentModeId = mode.id;
    this.reactionDrill = mode.id === 'reaction';
    mode.setup(this);
    this.audio.play('mode_change');
    this.events.emit('mode_changed', mode);
    // character select auto-switch where the mode defines one
    if (mode.id === 'laser') this.setActiveCharacter('tails');
    if (mode.id === 'amy') this.setActiveCharacter('amy');
  }

  setActiveCharacter(charId) {
    if (!CHARACTERS[charId]) return;
    this.player.setCharacter(charId);
    this.combat.setCharacter(charId);
    // character-specific keyboard map (matches OM keybinds where documented)
    this.input.setAbilityKeyMap(SLOT_LAYOUT[charId]?.[0]?.inputKeys || null);
    if (charId === 'amy') {
      this.tarot.drawInitial();
      this.tarot.applyToPlayer(this.player);
    } else {
      this.player.speedAdd = 0;
      this.player.damageMult = 1;
    }
    this.events.emit('character_changed', CHARACTERS[charId]);
    this.events.emit('loadout_changed', this.combat.getLoadoutState());
    this.audio.play('ui_open');
  }

  resetSessionStats() {
    this.analytics.resetSession();
    this.styleScorer.resetSessionScore();
    this.combat.resetSession();
    this.events.emit('stats_reset', {});
    this.audio.play('ui_click');
  }

  saveSession(label) {
    const entry = this.analytics.saveToHistory(label);
    this.events.emit('session_saved', entry);
    return entry;
  }

  /* ---------------- frame loop ---------------- */

  _frame(now) {
    this._raf = requestAnimationFrame((t) => this._frame(t));
    let dt = (now - this._lastFrame) / 1000;
    this._lastFrame = now;
    dt = Math.min(dt, 0.05); // clamp to avoid tunneling on tab-switch

    if (!this.running) {
      this.rendererEngine.render();
      return;
    }

    if (!this.paused) {
      this.gameTime += dt;

      this.input.update();
      this.player.update(dt, this.input, false);

      // Amy's Sun card aura (verified heal-over-time) + card modifiers
      if (this.combat.characterId === 'amy') {
        const mods = this.tarot.getModifiers();
        if (mods.healPerSecond > 0) this.player.heal(mods.healPerSecond * dt);
      }

      this.combat.update(dt, this.gameTime);
      this.stunSystem.update(dt);
      this.spawner.update(dt, this.player, this.gameTime, this.stunSystem);
      this.projectiles.update(dt, this.spawner.dummies, this.player.position);
      this.beams.update(dt, this.spawner.dummies, this.player.position);

      // reaction drill: periodically teleport targets to new random stations
      if (this.reactionDrill) {
        this._reactionTimer += dt;
        if (this._reactionTimer > 4.5) {
          this._reactionTimer = 0;
          for (const d of this.spawner.dummies) {
            if (!d.alive) continue;
            const ang = rand(0, Math.PI * 2);
            const dist = rand(30, 120);
            d.position.set(
              this.player.position.x + Math.sin(ang) * dist,
              0,
              this.player.position.z + Math.cos(ang) * dist
            );
            d.homePosition.copy(d.position);
            d.resetPosition();
            this.audio.play('spawn');
          }
          this.events.emit('combat_feed', {
            kind: 'info',
            text: '🎯 Targets repositioned — react!',
            at: performance.now()
          });
        }
      }

      // player downed → auto-recover after 4s (training environment)
      if (!this.player.alive) {
        this.player.downedUntil = (this.player.downedUntil || 0) + dt;
        if (this.player.downedUntil > 4) {
          this.player.downedUntil = 0;
          this.player.reset(new THREE.Vector3(0, 0, 0));
          this.events.emit('combat_feed', {
            kind: 'info',
            text: 'You were defeated — auto-respawned at the training pad.',
            at: performance.now()
          });
        }
      }

      // 10 Hz label refresh (perf)
      this._labelTimer += dt;
      if (this._labelTimer > 0.1) {
        this._labelTimer = 0;
        this.spawner.updateAllLabels();
        this.events.emit('hud_tick', this.getHudState());
      }
    }

    this.rendererEngine.render();
  }

  getHudState() {
    return {
      gameTime: this.gameTime,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      alive: this.player.alive,
      styleScore: this.styleScorer.score,
      combo: this.styleScorer.combo,
      bestCombo: this.styleScorer.bestCombo,
      loadout: this.combat.getLoadoutState(),
      characterId: this.combat.characterId,
      modeId: this.currentModeId,
      dummyCount: this.spawner.dummies.length,
      selectedDummy: this.spawner.selected ? {
        id: this.spawner.selected.id,
        name: this.spawner.selected.type.name,
        mode: this.spawner.selected.mode,
        distance: horizontalDistance(this.player.position, this.spawner.selected.position),
        stunned: this.spawner.selected.stunState === 'stunned',
        health: this.spawner.selected.health,
        maxHealth: this.spawner.selected.maxHealth
      } : null,
      tarot: this.combat.characterId === 'amy' ? this.tarot.getState() : [],
      summary: this.analytics.getSummary()
    };
  }
}
