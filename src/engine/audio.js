/**
 * Procedural WebAudio SFX engine — every sound is synthesized in-code so the
 * trainer ships with zero copyrighted audio assets and nothing to mis-licence.
 * (OM's original audio is not redistributable; these are original stand-ins.)
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.7;
    this._loops = new Map();
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  /** One-shot tone with envelope. */
  tone({ freq = 440, endFreq = freq, dur = 0.15, type = 'sine', gain = 0.5, delay = 0 }) {
    const ctx = this._ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  /** Short filtered noise burst (impacts, whooshes). */
  noise({ dur = 0.18, gain = 0.4, freq = 1200, q = 1.2, delay = 0 }) {
    const ctx = this._ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t0);
  }

  play(name) {
    switch (name) {
      case 'ui_click': this.tone({ freq: 660, endFreq: 520, dur: 0.07, type: 'triangle', gain: 0.25 }); break;
      case 'ui_open': this.tone({ freq: 420, endFreq: 620, dur: 0.12, type: 'triangle', gain: 0.28 }); break;
      case 'card_throw': this.noise({ dur: 0.12, gain: 0.3, freq: 3200 }); this.tone({ freq: 900, endFreq: 500, dur: 0.1, type: 'square', gain: 0.12 }); break;
      case 'card_shuffle': this.noise({ dur: 0.3, gain: 0.25, freq: 2600 }); this.tone({ freq: 700, endFreq: 900, dur: 0.18, type: 'triangle', gain: 0.15 }); break;
      case 'hammer_swing': this.noise({ dur: 0.22, gain: 0.4, freq: 700 }); this.tone({ freq: 180, endFreq: 90, dur: 0.22, type: 'sawtooth', gain: 0.22 }); break;
      case 'hammer_throw': this.noise({ dur: 0.3, gain: 0.35, freq: 900 }); this.tone({ freq: 300, endFreq: 140, dur: 0.28, type: 'triangle', gain: 0.22 }); break;
      case 'hammer_impact': this.tone({ freq: 140, endFreq: 60, dur: 0.3, type: 'square', gain: 0.35 }); this.noise({ dur: 0.25, gain: 0.4, freq: 500 }); break;
      case 'hammer_windup': this.tone({ freq: 620, endFreq: 880, dur: 0.5, type: 'triangle', gain: 0.22 }); break;
      case 'laser_charge': this.tone({ freq: 200, endFreq: 700, dur: 0.6, type: 'sawtooth', gain: 0.08 }); break;
      case 'laser_beam': this.tone({ freq: 520, endFreq: 320, dur: 0.5, type: 'sawtooth', gain: 0.12 }); this.noise({ dur: 0.5, gain: 0.22, freq: 1800 }); break;
      case 'laser_burst': this.tone({ freq: 240, endFreq: 80, dur: 0.4, type: 'square', gain: 0.3 }); this.noise({ dur: 0.4, gain: 0.35, freq: 800 }); break;
      case 'laser_blast': this.tone({ freq: 380, endFreq: 90, dur: 0.35, type: 'sawtooth', gain: 0.28 }); this.noise({ dur: 0.35, gain: 0.4, freq: 1100 }); break;
      case 'laser_orbs': for (let i = 0; i < 5; i++) this.tone({ freq: 700 + i * 90, endFreq: 400, dur: 0.1, type: 'sine', gain: 0.12, delay: i * 0.04 }); break;
      case 'rock_throw': this.noise({ dur: 0.25, gain: 0.35, freq: 600 }); this.tone({ freq: 160, endFreq: 90, dur: 0.2, type: 'triangle', gain: 0.2 }); break;
      case 'rock_shatter': this.noise({ dur: 0.3, gain: 0.45, freq: 900 }); break;
      case 'suspension': this.tone({ freq: 300, endFreq: 640, dur: 0.4, type: 'sine', gain: 0.2 }); this.tone({ freq: 450, endFreq: 900, dur: 0.5, type: 'sine', gain: 0.12 }); break;
      case 'javelin_throw': this.noise({ dur: 0.2, gain: 0.35, freq: 1500 }); this.tone({ freq: 520, endFreq: 240, dur: 0.18, type: 'triangle', gain: 0.16 }); break;
      case 'kick': this.noise({ dur: 0.15, gain: 0.35, freq: 1000 }); this.tone({ freq: 220, endFreq: 110, dur: 0.15, type: 'square', gain: 0.2 }); break;
      case 'hit': this.noise({ dur: 0.16, gain: 0.5, freq: 900 }); this.tone({ freq: 320, endFreq: 160, dur: 0.16, type: 'square', gain: 0.3 }); break;
      case 'stun_confirm':
        this.tone({ freq: 620, endFreq: 620, dur: 0.12, type: 'triangle', gain: 0.3 });
        this.tone({ freq: 820, endFreq: 820, dur: 0.14, type: 'triangle', gain: 0.3, delay: 0.09 });
        this.tone({ freq: 1040, endFreq: 1040, dur: 0.2, type: 'triangle', gain: 0.28, delay: 0.18 });
        break;
      case 'miss': this.tone({ freq: 220, endFreq: 140, dur: 0.12, type: 'sine', gain: 0.1 }); break;
      case 'player_hurt': this.tone({ freq: 180, endFreq: 70, dur: 0.25, type: 'sawtooth', gain: 0.3 }); this.noise({ dur: 0.2, gain: 0.3, freq: 500 }); break;
      case 'exe_attack': this.noise({ dur: 0.35, gain: 0.4, freq: 450 }); this.tone({ freq: 110, endFreq: 55, dur: 0.35, type: 'sawtooth', gain: 0.3 }); break;
      case 'spawn': this.tone({ freq: 160, endFreq: 320, dur: 0.35, type: 'sawtooth', gain: 0.18 }); break;
      case 'despawn': this.tone({ freq: 320, endFreq: 120, dur: 0.3, type: 'sawtooth', gain: 0.15 }); break;
      case 'mode_change': this.tone({ freq: 480, endFreq: 720, dur: 0.16, type: 'triangle', gain: 0.22 }); break;
      case 'denied': this.tone({ freq: 220, endFreq: 180, dur: 0.12, type: 'square', gain: 0.16 }); this.tone({ freq: 170, endFreq: 130, dur: 0.12, type: 'square', gain: 0.16, delay: 0.1 }); break;
      case 'combo_up': this.tone({ freq: 880, endFreq: 1180, dur: 0.12, type: 'triangle', gain: 0.2 }); break;
      default: break;
    }
  }

  /** Start a low ambient hum for the arena (stops on pause/reset). */
  startAmbience() {
    const ctx = this._ensure();
    if (!ctx || this._loops.has('amb')) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 48;
    g.gain.value = 0.035;
    lfo.frequency.value = 0.13;
    lfoG.gain.value = 8;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    osc.connect(g); g.connect(this.master);
    osc.start(); lfo.start();
    this._loops.set('amb', { osc, g, lfo });
  }
  stopAmbience() {
    const l = this._loops.get('amb');
    if (l) { try { l.osc.stop(); l.lfo.stop(); } catch (_) {} this._loops.delete('amb'); }
  }
}
