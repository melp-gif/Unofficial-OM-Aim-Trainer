/**
 * Side panels: EXE spawner controls (full configuration + action buttons),
 * live analytics + history, and the pause menu.
 */
export class Panels {
  constructor(game) {
    this.game = game;
    this._bindChrome();
    this._bindSpawner();
    this._bindStats();
    this._bindPause();
    this._bindGameEvents();
  }

  open(id) {
    document.getElementById(id)?.classList.remove('hidden');
    this.game.audio.play('ui_open');
    if (id === 'panel-stats') this.renderStats();
    if (id === 'panel-spawner') this.renderSpawnerStatus();
  }
  close(id) {
    document.getElementById(id)?.classList.add('hidden');
    this.game.audio.play('ui_click');
  }

  _bindChrome() {
    document.getElementById('btn-open-spawner').addEventListener('click', () => this.open('panel-spawner'));
    document.getElementById('btn-open-stats').addEventListener('click', () => this.open('panel-stats'));
    document.getElementById('btn-open-results').addEventListener('click', () => this.open('panel-results'));
    for (const btn of document.querySelectorAll('[data-close]')) {
      btn.addEventListener('click', () => this.close(btn.dataset.close));
    }
    document.getElementById('btn-pause').addEventListener('click', () => {
      this.game.togglePause();
    });
  }

  /* ---------------- spawner panel ---------------- */
  _bindSpawner() {
    const g = this.game;
    const $ = (id) => document.getElementById(id);

    $('sp-exe-type').addEventListener('change', (e) => g.spawner.setConfig({ exeType: e.target.value }));
    $('sp-mode').addEventListener('change', (e) => g.spawner.setConfig({ mode: e.target.value }));
    $('sp-pattern').addEventListener('change', (e) => g.spawner.setConfig({ pattern: e.target.value }));
    $('sp-difficulty').addEventListener('change', (e) => g.spawner.setConfig({ difficulty: e.target.value }));
    $('sp-facing').addEventListener('change', (e) => g.spawner.setConfig({ facing: parseFloat(e.target.value) }));

    const bindRange = (id, key, fmt = (v) => v) => {
      const el = $(id);
      const val = $(`${id}-val`);
      el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        if (val) val.textContent = fmt(v);
        g.spawner.setConfig({ [key]: v });
      });
    };
    bindRange('sp-distance', 'distance');
    bindRange('sp-speed', 'speed', (v) => `${v.toFixed(1)}x`);
    bindRange('sp-aggression', 'aggression', (v) => v.toFixed(2));
    bindRange('sp-health', 'health');
    bindRange('sp-damage', 'damage');
    bindRange('sp-count', 'count');
    bindRange('sp-area', 'areaRadius');

    $('sp-can-damage').addEventListener('change', (e) => g.spawner.setConfig({ canDamagePlayer: e.target.checked }));
    $('sp-auto-respawn').addEventListener('change', (e) => g.spawner.setConfig({ autoRespawn: e.target.checked }));
    $('sp-reset-stun').addEventListener('change', (e) => g.spawner.setConfig({ resetAfterStun: e.target.checked }));
    $('sp-show-health').addEventListener('change', (e) => g.spawner.setConfig({ showHealthBar: e.target.checked }));
    $('sp-show-stun').addEventListener('change', (e) => g.spawner.setConfig({ showStunStatus: e.target.checked }));
    $('sp-show-distance').addEventListener('change', (e) => g.spawner.setConfig({ showDistance: e.target.checked }));

    $('sp-spawn').addEventListener('click', () => {
      const count = parseInt($('sp-count').value, 10) || 1;
      g.spawner.spawnMultiple(g.player.position, g.player.yaw, count);
      this.renderSpawnerStatus();
    });
    $('sp-remove-selected').addEventListener('click', () => {
      g.spawner.removeSelected();
      this.renderSpawnerStatus();
    });
    $('sp-remove-all').addEventListener('click', () => {
      g.spawner.removeAll();
      this.renderSpawnerStatus();
    });
    $('sp-reset-pos').addEventListener('click', () => {
      g.spawner.resetSelectedPosition();
      this.renderSpawnerStatus();
    });
    $('sp-respawn').addEventListener('click', () => {
      g.spawner.respawnSelected();
      this.renderSpawnerStatus();
    });
    $('sp-select-next').addEventListener('click', () => {
      g.spawner.selectNext();
      this.renderSpawnerStatus();
    });
    $('sp-clear-session').addEventListener('click', () => {
      g.spawner.clearSession();
      g.resetSessionStats();
      this.renderSpawnerStatus();
      this.renderStats();
    });
  }

  renderSpawnerStatus() {
    const g = this.game;
    const el = document.getElementById('sp-status');
    if (!el) return;
    const sel = g.spawner.selected;
    el.innerHTML = `
      Active dummies: <b>${g.spawner.dummies.length}</b> / ${12}<br/>
      Selected: ${sel ? `<b>${sel.type.name}</b> (#${sel.id}) — ${sel.mode} mode, ${sel.health.toFixed(0)} HP${sel.stunState === 'stunned' ? ', <span style="color:#ffd23e">STUNNED</span>' : ''}` : 'none'}<br/>
      ${g.spawner.dummies.length >= 12 ? '<span style="color:#ff8fa0">Spawn cap reached (performance guard).</span>' : ''}
    `;
  }

  /* ---------------- stats panel ---------------- */
  _bindStats() {
    const g = this.game;
    document.getElementById('stats-save').addEventListener('click', () => {
      g.saveSession('');
      this.renderStats();
      g.audio.play('ui_click');
    });
    document.getElementById('stats-reset').addEventListener('click', () => {
      g.resetSessionStats();
      this.renderStats();
    });
    document.getElementById('stats-clear-history').addEventListener('click', () => {
      g.analytics.clearHistory();
      this.renderStats();
      g.audio.play('ui_click');
    });
  }

  renderStats() {
    const g = this.game;
    const s = g.analytics.getSummary();
    const live = document.getElementById('stats-live');
    if (!live) return;

    const perAbility = Object.entries(s.byAbility).map(([k, v]) =>
      `<div class="history-entry"><b>${k}</b> — ${v.hits}/${v.shots} hits · ${v.stuns} stuns</div>`
    ).join('') || '<div class="panel-status">No ability data yet.</div>';

    const perMovement = Object.entries(s.byMovement).map(([k, v]) =>
      `<div class="history-entry"><b>${k}</b> — ${v.hits}/${v.shots} hits</div>`
    ).join('') || '<div class="panel-status">No movement-mode data yet.</div>';

    live.innerHTML = `
      <div class="stats-grid">
        <div class="stats-cell"><div class="sv">${s.shots}</div><div class="sk">Shots fired</div></div>
        <div class="stats-cell"><div class="sv">${s.hits}</div><div class="sk">Hits</div></div>
        <div class="stats-cell"><div class="sv">${s.misses}</div><div class="sk">Misses</div></div>
        <div class="stats-cell"><div class="sv">${s.accuracy.toFixed(1)}%</div><div class="sk">Accuracy</div></div>
        <div class="stats-cell"><div class="sv">${s.stuns}</div><div class="sk">Stuns landed</div></div>
        <div class="stats-cell"><div class="sv">${s.bestCombo}</div><div class="sk">Highest combo</div></div>
        <div class="stats-cell"><div class="sv">${s.avgStunDuration.toFixed(2)}s</div><div class="sk">Avg measured stun</div></div>
        <div class="stats-cell"><div class="sv">${s.avgStunDistance.toFixed(1)}</div><div class="sk">Avg stun distance</div></div>
        <div class="stats-cell"><div class="sv">${s.longestHit.toFixed(1)}</div><div class="sk">Longest hit (studs)</div></div>
        <div class="stats-cell"><div class="sv">${s.totalStylePoints.toLocaleString()}</div><div class="sk">Style points</div></div>
      </div>
      <h3>ACCURACY BY ABILITY</h3>
      ${perAbility}
      <h3>ACCURACY BY EXE MOVEMENT MODE</h3>
      ${perMovement}
    `;

    const hist = document.getElementById('stats-history');
    hist.innerHTML = g.analytics.history.length
      ? g.analytics.history.map((h) => `
        <div class="history-entry">
          <b>${h.label}</b> · ${new Date(h.date).toLocaleString()}<br/>
          acc ${h.accuracy.toFixed(1)}% (${h.hits}/${h.shots}) · ${h.stuns} stuns ·
          avg stun ${h.avgStunDuration.toFixed(2)}s · longest ${h.longestHit.toFixed(0)} studs ·
          style ${h.totalStylePoints} · best combo ${h.bestCombo}
        </div>
      `).join('')
      : '<div class="panel-status">No saved sessions yet. Hit "Save Session" to compare attempts.</div>';
  }

  /* ---------------- pause ---------------- */
  _bindPause() {
    const g = this.game;
    const menu = document.getElementById('pause-menu');
    g.events.on('game_paused', (paused) => {
      menu.classList.toggle('hidden', !paused);
    });

    document.getElementById('pause-resume').addEventListener('click', () => {
      g.resume();
    });
    document.getElementById('pause-settings').addEventListener('click', () => {
      g.resume();
      g.stop();
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('screen-settings').classList.remove('hidden');
    });
    document.getElementById('pause-reset-session').addEventListener('click', () => {
      g.resetSessionStats();
      this.renderStats();
      g.resume();
    });
    document.getElementById('pause-exit').addEventListener('click', () => {
      g.stop();
      g.spawner.removeAll();
      g.projectiles.clear();
      g.beams.clear();
      g.combat.resetSession();
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('pause-menu').classList.add('hidden');
      document.getElementById('screen-main').classList.remove('hidden');
    });
  }

  _bindGameEvents() {
    const g = this.game;
    g.events.on('dummy_spawned', () => this.renderSpawnerStatus());
    g.events.on('dummy_removed', () => this.renderSpawnerStatus());
    g.events.on('spawner_limit', () => {
      const el = document.getElementById('sp-status');
      if (el) el.innerHTML = '<span style="color:#ff8fa0">Spawn cap reached — remove a dummy first (performance guard).</span>';
    });
    g.events.on('session_saved', (entry) => {
      g.events.emit('combat_feed', {
        kind: 'info',
        text: `Session saved: ${entry.accuracy.toFixed(1)}% accuracy, ${entry.stuns} stuns`,
        at: performance.now()
      });
    });
    g.events.on('stats_reset', () => {
      g.events.emit('combat_feed', { kind: 'info', text: 'Session statistics reset.', at: performance.now() });
    });
  }
}
