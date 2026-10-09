import { CHARACTERS, CHARACTER_ORDER, DOCUMENTED_SURVIVORS } from '../config/characters.js';
import { ABILITIES } from '../config/abilities.js';
import { VERIFY_LABEL, VERIFY, GAME } from '../config/gameConfig.js';
import { TRAINING_MODES } from '../training/modes.js';
import { TAROT_CARDS, TAROT_CARD_ORDER } from '../config/tarotCards.js';

const VERIFIED_CLASS = {
  [VERIFY.VERIFIED]: 'badge-verified',
  [VERIFY.ANNOUNCED]: 'badge-announced',
  [VERIFY.UNVERIFIED]: 'badge-unverified',
  [VERIFY.VARIANT]: 'badge-variant'
};

/** Screen navigation, character/mode selection, research page, settings. */
export class Menus {
  constructor(game) {
    this.game = game;
    this.selectedChar = 'amy';
    this.selectedMode = 'precision';
    this._bindNav();
    this._buildCharacterGrid();
    this._buildModeGrid();
    this._buildResearch();
    this._bindSettings();
  }

  /* ---------------- navigation ---------------- */
  showScreen(id) {
    for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
    document.getElementById(id)?.classList.remove('hidden');
  }

  _bindNav() {
    document.getElementById('btn-play').addEventListener('click', () => {
      this.game.audio.play('ui_open');
      this.showScreen('screen-character');
    });
    document.getElementById('btn-freepractice').addEventListener('click', () => {
      this.game.audio.play('ui_open');
      this.selectedChar = 'amy';
      this.selectedMode = 'custom';
      this._launchGame();
    });
    document.getElementById('btn-howto').addEventListener('click', () => {
      this.game.audio.play('ui_click');
      this.showScreen('screen-howto');
    });
    document.getElementById('btn-research').addEventListener('click', () => {
      this.game.audio.play('ui_click');
      this.showScreen('screen-research');
    });
    document.getElementById('btn-settings').addEventListener('click', () => {
      this.game.audio.play('ui_click');
      this.showScreen('screen-settings');
    });

    for (const btn of document.querySelectorAll('[data-back]')) {
      btn.addEventListener('click', () => {
        this.game.audio.play('ui_click');
        this.showScreen(btn.dataset.back);
      });
    }

    document.getElementById('btn-char-continue').addEventListener('click', () => {
      this.game.audio.play('ui_open');
      this.showScreen('screen-mode');
    });
    document.getElementById('btn-mode-start').addEventListener('click', () => {
      this._launchGame();
    });
  }

  _launchGame() {
    this.game.audio.play('ui_click');
    this.showScreen('__none__'); // hide all screens
    document.getElementById('hud').classList.remove('hidden');
    this.game.setActiveCharacter(this.selectedChar);
    this.game.start(this.selectedMode);
  }

  /* ---------------- character grid ---------------- */
  _buildCharacterGrid() {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';
    for (const id of CHARACTER_ORDER) {
      const c = CHARACTERS[id];
      const card = document.createElement('div');
      card.className = 'select-card' + (id === this.selectedChar ? ' selected' : '');
      card.innerHTML = `
        <img class="card-portrait" src="./${c.portrait}" alt="${c.name}"
             onerror="this.style.display='none'" />
        <div class="card-icon" style="background:${c.accentCss}22;color:${c.accentCss}">${c.id === 'amy' ? '🌹' : c.id === 'tails' ? '🦊' : c.id === 'silver' ? '🔮' : '🔥'}</div>
        <h3>${c.name}</h3>
        <div class="card-sub">${c.role}</div>
        <div class="card-desc">${c.title}</div>
      `;
      card.addEventListener('click', () => {
        this.game.audio.play('ui_click');
        this.selectedChar = id;
        for (const el of grid.children) el.classList.remove('selected');
        card.classList.add('selected');
        this._showCharacterDetail(id);
      });
      grid.appendChild(card);
    }
    this._showCharacterDetail(this.selectedChar);
  }

  _showCharacterDetail(id) {
    const c = CHARACTERS[id];
    document.getElementById('char-detail-name').textContent = `${c.name} — ${c.title}`;
    document.getElementById('char-detail-blurb').textContent = c.blurb;
    document.getElementById('char-detail-kit').innerHTML = `Verified OM kit: ${c.verifiedKit} &nbsp;·&nbsp; ${c.stunNote}`;

    const list = document.getElementById('char-abilities');
    list.innerHTML = '';
    for (const abId of c.abilityIds) {
      const a = ABILITIES[abId];
      const row = document.createElement('div');
      row.className = 'ability-row';
      const stunInfo = a.stun.canStun
        ? `<span class="stat-chip">stun <b>${a.stun.base.toFixed(1)}s</b></span>`
        : a.stun.slow
          ? `<span class="stat-chip">slow + ability lock</span>`
          : `<span class="stat-chip">no stun</span>`;
      row.innerHTML = `
        <div class="ab-head">
          <div class="ab-name">${a.name}</div>
          <span class="badge ${VERIFIED_CLASS[a.verified]}">${VERIFY_LABEL[a.verified]}</span>
        </div>
        <div class="ab-control">${a.control} · ${a.category}${a.cooldown ? ` · OM cooldown ${a.cooldown}s (training: none)` : ''}</div>
        <div class="ab-desc">${a.sourceNote}</div>
        <div class="ab-stats">
          ${stunInfo}
          ${a.projectile ? `<span class="stat-chip">speed <b>${a.projectile.speed}</b> studs/s</span><span class="stat-chip">hitbox r <b>${a.projectile.radius}</b></span>` : ''}
          ${a.beam ? `<span class="stat-chip">beam width <b>${a.beam.width}</b></span><span class="stat-chip">duration <b>${a.beam.duration}s</b></span>` : ''}
          ${a.melee ? `<span class="stat-chip">range <b>${a.melee.range}</b> studs</span>` : ''}
          ${a.range ? `<span class="stat-chip">max range <b>${a.range}</b></span>` : ''}
          ${a.stun.knockback ? `<span class="stat-chip">knockback <b>${a.stun.knockback}</b></span>` : ''}
        </div>
      `;
      list.appendChild(row);
    }
  }

  /* ---------------- mode grid ---------------- */
  _buildModeGrid() {
    const grid = document.getElementById('mode-grid');
    grid.innerHTML = '';
    for (const mode of TRAINING_MODES) {
      const card = document.createElement('div');
      card.className = 'select-card' + (mode.id === this.selectedMode ? ' selected' : '');
      card.innerHTML = `
        <div class="card-icon">🎯</div>
        <h3>${mode.name}</h3>
        <div class="card-desc">${mode.desc}</div>
      `;
      card.addEventListener('click', () => {
        this.game.audio.play('ui_click');
        this.selectedMode = mode.id;
        for (const el of grid.children) el.classList.remove('selected');
        card.classList.add('selected');
      });
      grid.appendChild(card);
    }
  }

  /* ---------------- research page ---------------- */
  _buildResearch() {
    const root = document.getElementById('research-content');
    const cardRows = TAROT_CARD_ORDER.map((k) => {
      const c = TAROT_CARDS[k];
      return `<tr>
        <td><b style="color:${c.colorCss}">${c.name}</b><br/><span style="font-size:10px">depicted: ${c.depicted}</span></td>
        <td>${c.good}</td>
        <td>${c.bad}</td>
      </tr>`;
    }).join('');

    root.innerHTML = `
      <div class="research-block">
        <h3>WHAT IS OUTCOME MEMORIES?</h3>
        Outcome Memories (OM) is a Roblox asymmetrical horror game (developer: 1sobbe) inspired by
        <i>Sonic.EXE: The Disaster</i>. Survivors (Sonic characters) must survive until the escape ring appears
        while Executioners (EXEs) hunt them down. Ranged stunners interrupt chases; every stun has a real duration
        that feeds the EXE's recovery frames. This trainer isolates the ranged-stun combat loop for practice.
      </div>

      <div class="research-block">
        <h3>VERIFIED MECHANICS REPRODUCED HERE</h3>
        <table>
          <tr><th>Mechanic</th><th>Verified behaviour</th><th>Source</th></tr>
          <tr><td>Global stun cap</td><td>Executioner stuns are capped at <b>8 seconds</b> maximum.</td><td>OM update log 8/9/2025 ("Added stun cap on Executioners: 8 seconds maximum")</td></tr>
          <tr><td>Stun Recovery Frame</td><td>After a stun, EXEs briefly cannot be re-stunned by some attacks.</td><td>OM v0.2 patch notes (approximated as ${GAME.stunRecoverySeconds}s, configurable)</td></tr>
          <tr><td>Amy — Tarot Cards</td><td>Passive deck of 2 of 6 cards, redrawn with Reroll; cards rewrite her stun duration, speed and durability.</td><td>fandom / miraheze / namu.wiki Amy pages</td></tr>
          <tr><td>Amy — Hammer</td><td>2s stance windup (chime + flash), ~8 stud hit range, mid-air Hammer Bounce variant, brief i-frames.</td><td>namu.wiki + miraheze Amy pages</td></tr>
          <tr><td>Amy — Throw Hammer</td><td>Thrown at the cursor at high speed; hit pushes back + stuns; hammer gone <b>8s</b> then returns (manual pickup possible); Hammer unusable meanwhile.</td><td>namu.wiki + miraheze Amy pages</td></tr>
          <tr><td>Tails — Laser Cannon</td><td>5s charge (slowed), ~4s plasma beam, infinite range, graze stuns ~5–6s and pushes the EXE back (no stun extension). Cancel after charge → 15s CD; full CD 45s.</td><td>fandom Tails page + outcomememories.miraheze.org</td></tr>
          <tr><td>Tails — Burst mode</td><td>Ground shockwave at Tails' feet: 2.2s stun + Burn status; verified to pierce EXE i-frames.</td><td>fandom Tails page (v0.1 Switch modes)</td></tr>
          <tr><td>Tails — announced modes</td><td>Orbs, Blast, Shockwave and a laser rework ("hold on the EXE for higher stun") are announced.</td><td>fandom Tails trivia + dev ability-retake post</td></tr>
          <tr><td>Silver — Rock</td><td>Long-range thrown rock: hit <b>slows</b> the EXE and locks their abilities briefly (not a full stun).</td><td>TV Tropes OM characters page</td></tr>
          <tr><td>Silver — Suspension scoring</td><td>+5 score per survivor within 30 studs on hit, +15 for assisting a teammate's stun.</td><td>OM update log 10/7/2026</td></tr>
          <tr><td>Blaze — Kick</td><td>Deals <b>15 damage</b>.</td><td>OM update log 9/2/2026</td></tr>
          <tr><td>V1 EXE — Parry</td><td>Parries non-ranged stuns; only ranged stuns (e.g. Laser Cannon) or counters connect.</td><td>TV Tropes OM characters page</td></tr>
          <tr><td>Tripwire EXE</td><td>Stunning her while a victim is grabbed punishes the attacker and reduces the stun to 2s.</td><td>TV Tropes OM characters page</td></tr>
        </table>
      </div>

      <div class="research-block">
        <h3>AMY'S TAROT CARDS (VERIFIED PASSIVE)</h3>
        <table>
          <tr><th>Card</th><th>Benefit</th><th>Cost</th></tr>
          ${cardRows}
        </table>
        Note: exact numeric values differ between documented OM versions (e.g. The Fool stun override is 1s in one source and 2s in another;
        Strength is 3.5s vs 5s). Values here are configurable in <code>src/config/tarotCards.js</code> and are never presented as the single "official" figure.
        <br/><br/>
        <b>Tarot Card Toss</b> (the thrown-card ranged attack used for aim practice) is a
        <span class="badge badge-variant">PRACTICE VARIANT — NOT OFFICIAL OM</span> — in the real game the cards are a passive deck, not a projectile.
      </div>

      <div class="research-block">
        <h3>LASER TYPES — WHAT IS ACTUALLY VERIFIED?</h3>
        <b>Verified current modes:</b> Default (plasma beam) and Burst (ground shockwave), switchable with the Switch ability (X in OM).
        <b>Announced rework modes:</b> Orbs, Blast, Shockwave (behaviour reconstructed from announcement posts — every numeric value is approximate and configurable).
        Nothing else is claimed to be an official laser variant.
      </div>

      <div class="research-block">
        <h3>ASSETS &amp; LICENSING</h3>
        Original OM/Roblox models, animations and audio are not redistributable. This trainer therefore ships
        <b>original replacement assets</b>: procedural 3D models built in-engine (matching each character's silhouette and weapon),
        procedurally synthesized audio (WebAudio), and original UI art. If you own licensed assets, the model builders in
        <code>src/characters/models.js</code> are the documented swap-in points.
      </div>

      <div class="research-block">
        <h3>OTHER OM SURVIVORS DISCOVERED (NOT PLAYABLE — NO INVENTED KITS)</h3>
        <table>
          <tr><th>Survivor</th><th>Verified kit</th><th>Ranged?</th></tr>
          ${DOCUMENTED_SURVIVORS.map((s) => `<tr><td>${s.name}</td><td>${s.kit}</td><td>${s.ranged}</td></tr>`).join('')}
        </table>
      </div>

      <div class="research-block">
        <h3>HONEST LIMITATIONS</h3>
        <ul>
          <li>Roblox client physics (networked hit registration, exact Roblox stud/s speeds, original animations) cannot be reproduced 1:1 in a browser trainer — all uncertain values are exposed in the config files and labelled.</li>
          <li>EXE attack animations here are original telegraph approximations of the verified archetypes (2011X / Kolossus / Tripwire / V1), not ripped OM animations.</li>
          <li>Stun durations shown are always measured live; where OM sources disagree on a nominal value, the configurable default is labelled with its version spread.</li>
        </ul>
      </div>

      <div class="research-block">
        <h3>SOURCES</h3>
        <ul>
          <li><a href="https://the-unofficial-outcome-memories.fandom.com/wiki/Tails" target="_blank" rel="noopener">the-unofficial-outcome-memories.fandom.com — Tails</a></li>
          <li><a href="https://the-unofficial-outcome-memories.fandom.com/wiki/Amy" target="_blank" rel="noopener">the-unofficial-outcome-memories.fandom.com — Amy</a></li>
          <li><a href="https://the-unofficial-outcome-memories.fandom.com/wiki/Updates" target="_blank" rel="noopener">the-unofficial-outcome-memories.fandom.com — Updates (stun cap, balance patches)</a></li>
          <li><a href="https://theunofficialoutcomememories.miraheze.org/wiki/Amy" target="_blank" rel="noopener">theunofficialoutcomememories.miraheze.org — Amy</a></li>
          <li><a href="https://outcomememories.miraheze.org/wiki/Miles_%22Tails%22_Prower" target="_blank" rel="noopener">outcomememories.miraheze.org — Tails</a></li>
          <li><a href="https://tvtropes.org/pmwiki/pmwiki.php/Characters/OutcomeMemoriesRoblox" target="_blank" rel="noopener">TV Tropes — Characters in Outcome Memories</a></li>
          <li><a href="https://en.namu.wiki/w/Amy(Outcome%20Memories)" target="_blank" rel="noopener">namu.wiki — Amy (Outcome Memories)</a></li>
        </ul>
      </div>
    `;
  }

  /* ---------------- settings ---------------- */
  _bindSettings() {
    const g = this.game;
    const bindRange = (id, fn) => {
      const el = document.getElementById(id);
      const val = document.getElementById(`${id}-val`);
      el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        if (val) val.textContent = v.toFixed(id === 'set-fov' ? 0 : 2);
        fn(v);
      });
    };
    bindRange('set-sensitivity', (v) => {
      g.input.sensitivity = v;
    });
    bindRange('set-fov', (v) => {
      g.rendererEngine.setFov(v);
    });
    bindRange('set-volume', (v) => {
      g.audio.setVolume(v);
    });

    document.getElementById('set-mute').addEventListener('change', (e) => {
      g.audio.setMuted(e.target.checked);
    });
    document.getElementById('set-nocooldown').addEventListener('change', (e) => {
      g.combat.setNoCooldown(e.target.checked);
    });
    document.getElementById('set-instant-charge').addEventListener('change', (e) => {
      g.combat.setInstantCharge(e.target.checked);
    });
    document.getElementById('set-instant-recall').addEventListener('change', (e) => {
      g.combat.setInstantHammerRecall(e.target.checked);
    });
    document.getElementById('set-damage').addEventListener('change', (e) => {
      g.spawner.setConfig({ canDamagePlayer: e.target.checked });
      const cb = document.getElementById('sp-can-damage');
      if (cb) cb.checked = e.target.checked;
    });
    document.getElementById('set-aimguide').addEventListener('change', (e) => {
      document.getElementById('aim-guide').style.display = e.target.checked ? '' : 'none';
    });
  }
}
