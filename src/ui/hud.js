import { VERIFY_LABEL, VERIFY } from '../config/gameConfig.js';
import { ABILITIES, TAILS_LASERS } from '../config/abilities.js';
import { CHARACTERS } from '../config/characters.js';

const ICONS = {
  amy_tarot_toss: '🃏',
  amy_hammer: '🔨',
  amy_hammer_throw: '🪃',
  amy_reroll: '🎴',
  tails_laser_beam: '📡',
  tails_laser_burst: '💥',
  tails_laser_blast: '🌟',
  tails_laser_orbs: '🔮',
  tails_laser_shockwave: '🌊',
  tails_switch: '🔄',
  tails_glide: '🪽',
  silver_rock: '🪨',
  silver_suspension: '🌀',
  blaze_javelin: '🔥',
  blaze_kick: '👟'
};

/** HUD controller: crosshair state, ability bar, stun popup, combat feed, floating text. */
export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      hpFill: document.getElementById('hud-hp-fill'),
      hpText: document.getElementById('hud-hp-text'),
      charName: document.getElementById('hud-char-name'),
      tarot: document.getElementById('hud-tarot'),
      mode: document.getElementById('hud-mode'),
      badgeNoCd: document.getElementById('badge-nocooldown'),
      badgeRange: document.getElementById('badge-range'),
      score: document.getElementById('hud-score'),
      combo: document.getElementById('hud-combo'),
      acc: document.getElementById('hud-acc'),
      abilityBar: document.getElementById('ability-bar'),
      laserPanel: document.getElementById('laser-panel'),
      laserButtons: document.getElementById('laser-buttons'),
      laserProps: document.getElementById('laser-props'),
      laserActiveName: document.getElementById('laser-active-name'),
      feed: document.getElementById('combat-feed'),
      stunPopup: document.getElementById('stun-popup'),
      floatLayer: document.getElementById('float-layer'),
      aimGuide: document.getElementById('aim-guide')
    };

    this._slotEls = [];
    this._buildAbilityBar();
    this._buildLaserPanel();
    this._bindEvents();
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }
  hide() {
    this.el.hud.classList.add('hidden');
  }

  _buildAbilityBar() {
    this.el.abilityBar.innerHTML = '';
    this._slotEls = [];
  }

  refreshAbilityBar(loadout) {
    const bar = this.el.abilityBar;
    if (this._slotEls.length !== loadout.slots.length) {
      bar.innerHTML = '';
      this._slotEls = loadout.slots.map((slot, i) => {
        const div = document.createElement('div');
        div.className = 'ability-slot';
        div.innerHTML = `
          <div class="as-icon">${ICONS[slot.abilityId] || '✦'}</div>
          <div class="as-name">${slot.shortName}</div>
          <div class="as-key">${slot.control}</div>
          <div class="as-state ready">READY</div>
        `;
        div.addEventListener('click', () => this.game.combat.activateSlot(i));
        bar.appendChild(div);
        return div;
      });
    }
    loadout.slots.forEach((slot, i) => {
      const div = this._slotEls[i];
      if (!div) return;
      const stateEl = div.querySelector('.as-state');
      const canStun = slot.canStun;
      div.classList.toggle('stunned-ok', canStun);
      div.classList.toggle('on-cooldown', slot.state === 'cooldown');
      let label = 'READY';
      let cls = 'ready';
      if (slot.state === 'charging') { label = 'CHARGING'; cls = 'charging'; }
      else if (slot.state === 'charged') { label = 'FIRE!'; cls = 'charging'; }
      else if (slot.state === 'windup') { label = 'WINDUP'; cls = ''; }
      else if (slot.state === 'active') { label = 'ACTIVE'; cls = ''; }
      else if (slot.state === 'recover') { label = 'RECOVER'; cls = ''; }
      else if (slot.state === 'cooldown') {
        label = loadout.noCooldown ? 'READY' : `${slot.cooldownLeft.toFixed(0)}s`;
        cls = loadout.noCooldown ? 'ready' : '';
      }
      stateEl.textContent = label;
      stateEl.className = `as-state ${cls}`;
    });
  }

  _buildLaserPanel() {
    this.el.laserButtons.innerHTML = '';
    for (const modeId of TAILS_LASERS) {
      const a = ABILITIES[modeId];
      const btn = document.createElement('button');
      btn.className = 'laser-btn';
      btn.dataset.mode = modeId;
      const tag = a.verified === VERIFY.VERIFIED ? '✓' : a.verified === VERIFY.ANNOUNCED ? '◎' : '?';
      btn.innerHTML = `${tag} ${a.shortName}`;
      btn.addEventListener('click', () => this.game.combat.setLaserMode(modeId));
      this.el.laserButtons.appendChild(btn);
    }
  }

  updateLaserPanel(loadout) {
    const isTails = loadout.characterId === 'tails';
    this.el.laserPanel.classList.toggle('hidden', !isTails);
    if (!isTails) return;
    const modeId = loadout.laserMode;
    this.el.laserActiveName.textContent = ABILITIES[modeId].name.replace('Laser Cannon — ', '');
    for (const btn of this.el.laserButtons.children) {
      btn.classList.toggle('active', btn.dataset.mode === modeId);
    }
    const a = ABILITIES[modeId];
    this.el.laserProps.innerHTML = `
      <div>${VERIFY_LABEL[a.verified]}</div>
      <div>Stun: <b>${a.stun.base.toFixed(1)}s</b>${a.stun.pierceIframes ? ' · pierces i-frames' : ''}${a.stun.burn ? ' · Burn' : ''}</div>
      <div>${a.beam ? `Beam width ${a.beam.width} · ${a.beam.duration}s` : a.shockwave ? `Radius ${a.shockwave.radius} studs` : a.projectile ? `Speed ${a.projectile.speed} studs/s` : ''}</div>
    `;
  }

  _bindEvents() {
    const g = this.game;

    g.events.on('hud_tick', (state) => {
      const s = state;
      this.el.hpFill.style.width = `${(s.health / s.maxHealth) * 100}%`;
      this.el.hpFill.style.background = s.health < 35
        ? 'linear-gradient(90deg,#ff4455,#c2283c)'
        : 'linear-gradient(90deg,#45e08a,#2fbf6c)';
      this.el.hpText.textContent = `${Math.round(s.health)} / ${s.maxHealth}${s.alive ? '' : ' — DOWN'}`;

      const char = CHARACTERS[s.characterId];
      this.el.charName.textContent = char ? char.name : s.characterId;
      this.el.charName.style.color = char ? char.accentCss : '#fff';

      this.el.mode.textContent = this._modeLabel(s.modeId);
      this.el.badgeNoCd.textContent = s.loadout.noCooldown ? 'NO-COOLDOWN' : 'COOLDOWNS ON';
      this.el.badgeNoCd.className = s.loadout.noCooldown ? 'badge badge-verified' : 'badge';

      if (s.selectedDummy) {
        this.el.badgeRange.textContent = `target: ${s.selectedDummy.distance.toFixed(0)} studs${s.selectedDummy.stunned ? ' · STUNNED' : ''}`;
      } else {
        this.el.badgeRange.textContent = 'target: —';
      }

      this.el.score.textContent = s.styleScore.toLocaleString();
      this.el.combo.textContent = `combo x${s.combo} (best ${s.bestCombo})`;
      const acc = s.summary.shots > 0 ? (s.summary.hits / s.summary.shots) * 100 : 0;
      this.el.acc.textContent = `acc ${acc.toFixed(0)}% · ${s.summary.hits}/${s.summary.shots}`;

      // tarot chips
      if (s.tarot && s.tarot.length) {
        this.el.tarot.innerHTML = s.tarot.map((c) =>
          `<span class="tarot-chip" style="border-color:${c.colorCss}55;color:${c.colorCss}">${c.name}</span>`
        ).join('');
      } else {
        this.el.tarot.innerHTML = '';
      }

      this.refreshAbilityBar(s.loadout);
      this.updateLaserPanel(s.loadout);
    });

    g.events.on('stun_report', (report) => this._showStunPopup(report));

    g.events.on('stun_measured', (record) => {
      this._feed(`✓ Measured stun: ${record.actualSeconds.toFixed(2)}s`, 'stun_measured');
    });

    g.events.on('combat_feed', ({ text, kind }) => this._feed(text, kind));

    g.events.on('character_changed', (char) => {
      this._feed(`Selected ${char.name} — ${char.verifiedKit}`, 'info');
    });

    g.events.on('mode_changed', (mode) => {
      this._feed(`Mode: ${mode.name}`, 'info');
    });
  }

  _modeLabel(id) {
    const names = {
      precision: 'Precision Practice', tracking: 'Tracking Practice',
      reaction: 'Reaction Practice', windup: 'Attack-Windup Practice',
      maxrange: 'Maximum-Range Testing', travel: 'Projectile Travel Practice',
      laser: 'Laser Practice', amy: 'Amy Ability Practice',
      combat: 'Full Combat Practice', custom: 'Custom Practice'
    };
    return names[id] || id;
  }

  _feed(text, kind = 'info') {
    const div = document.createElement('div');
    div.className = `feed-line ${kind}`;
    div.textContent = text;
    this.el.feed.prepend(div);
    while (this.el.feed.children.length > 8) this.el.feed.lastChild.remove();
    setTimeout(() => {
      div.style.transition = 'opacity 0.6s';
      div.style.opacity = '0.25';
    }, 7000);
  }

  _showStunPopup(report) {
    const p = this.el.stunPopup;
    const measured = report.measuredSeconds;
    p.innerHTML = `
      <div class="sp-title">STUN CONFIRMED!</div>
      <div class="sp-grid">
        <div class="k">Stun Duration</div><div class="v">${report.appliedSeconds.toFixed(2)} s applied${measured != null ? ` · ${measured.toFixed(2)} s measured` : ' · measuring…'}</div>
        <div class="k">Impact Distance</div><div class="v">${report.distance != null ? report.distance.toFixed(1) + ' studs' : '—'}</div>
        <div class="k">Style Points</div><div class="v sp-style">+${report.stylePoints}</div>
        <div class="k">Classification</div><div class="v">${report.classification}</div>
        <div class="k">Ability</div><div class="v">${report.characterName} — ${report.abilityName}</div>
        ${report.travelTime ? `<div class="k">Travel Time</div><div class="v">${report.travelTime.toFixed(2)} s</div>` : ''}
        <div class="k">Source</div><div class="v" style="font-size:10px">${report.verifiedLabel}</div>
      </div>
      ${report.styleBreakdown.length ? `<div style="margin-top:8px;font-size:11px;color:#9a94ac">Bonuses: ${report.styleBreakdown.map((b) => `${b.label} +${b.points}`).join(' · ')}</div>` : ''}
      ${report.capped ? '<div style="margin-top:6px;font-size:10.5px;color:#ffd23e">⚠ Stun capped at the verified 8.00s maximum</div>' : ''}
    `;
    p.classList.remove('hidden');
    clearTimeout(this._popupTimer);
    this._popupTimer = setTimeout(() => p.classList.add('hidden'), 4200);

    this._spawnFloatingText(report);
    this._renderResults(report);
  }

  _spawnFloatingText(report) {
    const div = document.createElement('div');
    div.className = 'float-text';
    div.textContent = `STUN +${report.stylePoints} · ${report.distance != null ? report.distance.toFixed(0) + ' studs' : ''}`;
    const sub = document.createElement('div');
    sub.className = 'float-text sub';
    sub.textContent = report.classification;
    const x = 50 + (Math.random() * 16 - 8);
    const y = 38 + (Math.random() * 10 - 5);
    div.style.left = `${x}%`;
    div.style.top = `${y}%`;
    sub.style.left = `${x}%`;
    sub.style.top = `${y + 4}%`;
    this.el.floatLayer.append(div, sub);
    setTimeout(() => { div.remove(); sub.remove(); }, 1700);
  }

  _renderResults(report) {
    const body = document.getElementById('results-body');
    if (!body) return;
    body.innerHTML = `
      <div class="results-title">STUN CONFIRMED!</div>
      <div class="results-grid">
        <div class="k">Requested duration</div><div class="v">${report.requestedSeconds.toFixed(2)} s</div>
        <div class="k">Applied duration</div><div class="v">${report.appliedSeconds.toFixed(2)} s${report.capped ? ' (capped at 8.00s)' : ''}</div>
        <div class="k">Measured duration</div><div class="v">${report.measuredSeconds != null ? report.measuredSeconds.toFixed(2) + ' s' : 'measuring…'}</div>
        <div class="k">Impact distance</div><div class="v">${report.distance != null ? report.distance.toFixed(1) + ' studs' : '—'}</div>
        <div class="k">Distance method</div><div class="v">horizontal, player → target at impact</div>
        <div class="k">Style points</div><div class="v" style="color:#ffd23e">+${report.stylePoints} (combo x${report.combo})</div>
        <div class="k">Classification</div><div class="v">${report.classification}</div>
        <div class="k">Character / Ability</div><div class="v">${report.characterName} — ${report.abilityName}</div>
        ${report.travelTime ? `<div class="k">Projectile travel</div><div class="v">${report.travelTime.toFixed(2)} s</div>` : ''}
        <div class="k">Verification</div><div class="v" style="font-size:11px">${report.verifiedLabel}</div>
      </div>
      ${report.styleBreakdown.length ? `
        <h3>STYLE BREAKDOWN</h3>
        <div class="results-grid">
          <div class="k">Base</div><div class="v">+${report.styleBreakdown.length ? report.stylePoints - report.styleBreakdown.reduce((a, b) => a + b.points, 0) : report.stylePoints}</div>
          ${report.styleBreakdown.map((b) => `<div class="k">${b.label}</div><div class="v">+${b.points}</div>`).join('')}
        </div>` : ''}
      <div class="results-note">
        All values are computed from live gameplay: the stun timer runs in real time and reports the elapsed duration when the EXE recovers;
        impact distance uses the player→target horizontal distance at the moment of impact.
        Style bonuses only fire when their conditions are actually met.
      </div>
    `;
  }
}
