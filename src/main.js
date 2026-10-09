import { Game } from './game.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Panels } from './ui/panels.js';
import { MobileControls } from './ui/mobileControls.js';

/**
 * Unofficial OM Aim Trainer — bootstrap.
 * Creates every subsystem, runs a short loading sequence, then shows the menu.
 */
function boot() {
  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);
  const hud = new HUD(game);
  const menus = new Menus(game);
  const panels = new Panels(game);
  const mobile = new MobileControls(game);

  // expose for debugging / live config tweaks from the console
  window.__omTrainer = { game, hud, menus, panels, mobile };

  // keep the spawner panel in sync with settings toggles
  game.events.on('spawner_config', () => {
    panels.renderSpawnerStatus();
    panels.renderStats();
  });

  // loading sequence (shader warmup + first render)
  const fill = document.getElementById('loading-fill');
  const text = document.getElementById('loading-text');
  const steps = [
    [20, 'Building 3D models…'],
    [45, 'Loading ability database…'],
    [70, 'Calibrating hit detection…'],
    [92, 'Preparing training range…'],
    [100, 'Ready.']
  ];
  let i = 0;
  const step = () => {
    if (i < steps.length) {
      const [pct, label] = steps[i++];
      fill.style.width = `${pct}%`;
      text.textContent = label;
      setTimeout(step, 160);
    } else {
      // warm the renderer with one frame before revealing the menu
      game.rendererEngine.render();
      document.getElementById('screen-loading').classList.add('hidden');
      document.getElementById('screen-main').classList.remove('hidden');
    }
  };
  step();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
