import { GAME } from '../config/gameConfig.js';

/**
 * Session analytics: shots, hits, misses, accuracy, stuns, measured stun
 * durations, distances, per-character/ability and per-movement-mode accuracy,
 * plus a persisted session history for cross-attempt comparison.
 */
export class Analytics {
  constructor() {
    this.resetSession();
    this.history = this._loadHistory();
  }

  resetSession() {
    this.session = {
      startedAt: Date.now(),
      shots: 0,
      hits: 0,
      misses: 0,
      stuns: 0,
      parries: 0,
      stunDurations: [],        // MEASURED actual seconds
      stunDistances: [],        // studs at impact
      travelTimes: [],
      longestHit: 0,
      byAbility: {},            // abilityId -> {shots, hits, stuns}
      byCharacter: {},          // charId -> {shots, hits, stuns}
      byMovement: {},           // movementMode -> {shots, hits}
      totalStylePoints: 0,
      bestCombo: 0
    };
  }

  _bucket(map, key) {
    if (!map[key]) map[key] = { shots: 0, hits: 0, stuns: 0 };
    return map[key];
  }

  recordShot({ abilityId, characterId }) {
    this.session.shots++;
    this._bucket(this.session.byAbility, abilityId).shots++;
    this._bucket(this.session.byCharacter, characterId).shots++;
  }

  recordMiss({ abilityId, characterId, movementMode }) {
    this.session.misses++;
    const b = movementMode ? this._bucket(this.session.byMovement, movementMode) : null;
    if (b) b.shots++;
  }

  recordHit({ abilityId, characterId, movementMode }) {
    this.session.hits++;
    this._bucket(this.session.byAbility, abilityId).hits++;
    this._bucket(this.session.byCharacter, characterId).hits++;
    if (movementMode) this._bucket(this.session.byMovement, movementMode).hits++;
  }

  recordStun(record, movementMode) {
    this.session.stuns++;
    this._bucket(this.session.byAbility, record.abilityId).stuns++;
    this._bucket(this.session.byCharacter, record.characterId).stuns++;
    if (typeof record.actualSeconds === 'number') {
      this.session.stunDurations.push(record.actualSeconds);
    }
    if (typeof record.distance === 'number') {
      this.session.stunDistances.push(record.distance);
      this.session.longestHit = Math.max(this.session.longestHit, record.distance);
    }
    if (typeof record.travelTime === 'number') {
      this.session.travelTimes.push(record.travelTime);
    }
    if (movementMode) {
      const b = this._bucket(this.session.byMovement, movementMode);
      b.stuns++;
    }
  }

  recordParry() { this.session.parries++; }

  recordStyle(points, combo) {
    this.session.totalStylePoints += points;
    this.session.bestCombo = Math.max(this.session.bestCombo, combo);
  }

  getSummary() {
    const s = this.session;
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      shots: s.shots,
      hits: s.hits,
      misses: s.misses,
      accuracy: s.shots > 0 ? (s.hits / s.shots) * 100 : 0,
      stuns: s.stuns,
      parries: s.parries,
      avgStunDuration: avg(s.stunDurations),
      avgStunDistance: avg(s.stunDistances),
      longestHit: s.longestHit,
      avgTravelTime: avg(s.travelTimes),
      totalStylePoints: s.totalStylePoints,
      bestCombo: s.bestCombo,
      byAbility: s.byAbility,
      byCharacter: s.byCharacter,
      byMovement: s.byMovement,
      startedAt: s.startedAt,
      elapsedSeconds: (Date.now() - s.startedAt) / 1000
    };
  }

  /** Save current session snapshot into the persistent history. */
  saveToHistory(label = '') {
    const summary = this.getSummary();
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      label: label || `Session ${this.history.length + 1}`,
      ...summary
    };
    this.history.unshift(entry);
    if (this.history.length > 20) this.history.length = 20;
    this._saveHistory();
    return entry;
  }

  clearHistory() {
    this.history = [];
    this._saveHistory();
  }

  _loadHistory() {
    try {
      const raw = localStorage.getItem(GAME.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveHistory() {
    try {
      localStorage.setItem(GAME.storageKey, JSON.stringify(this.history));
    } catch { /* storage may be unavailable — history stays in-memory */ }
  }
}
