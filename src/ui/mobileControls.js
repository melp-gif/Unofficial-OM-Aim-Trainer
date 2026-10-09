/**
 * Mobile controls: virtual joystick visualization, ability/fire/jump/run
 * buttons. Every core feature is reachable through touch alone.
 */
export class MobileControls {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('mobile-controls');
    this.stickBase = document.getElementById('touch-stick-base');
    this.stickKnob = document.getElementById('touch-stick-knob');
    this.enabled = false;

    this._bindButtons();
    this._bindStick();

    // auto-enable on touch devices
    if (game.input.isTouchDevice) this.setEnabled(true);

    window.addEventListener('resize', () => this._relayoutStick());
    this._relayoutStick();
  }

  setEnabled(on) {
    this.enabled = on;
    this.root.classList.toggle('hidden', !on);
  }

  _bindStick() {
    const input = this.game.input;
    input.touchStickCb = (vec, released) => {
      const maxR = 70;
      const mag = Math.min(1, Math.hypot(vec.x, vec.y) / maxR);
      const ang = Math.atan2(vec.y, vec.x);
      const kx = Math.cos(ang) * mag * 34;
      const ky = Math.sin(ang) * mag * 34;
      this.stickKnob.style.transform = released
        ? 'translate(-50%, -50%)'
        : `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    };
  }

  _relayoutStick() {
    // keep the visual stick at the current left-bottom CSS position
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
  }

  _bindButtons() {
    const g = this.game;
    const $ = (id) => document.getElementById(id);

    const hold = (el, down, up) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); up?.(); }, { passive: false });
      el.addEventListener('mousedown', (e) => { e.stopPropagation(); down(); });
      el.addEventListener('mouseup', (e) => { e.stopPropagation(); up?.(); });
    };

    hold($('m-fire'), () => g.input.virtualFire(true), () => g.input.virtualFire(false));
    hold($('m-jump'), () => g.input.virtualJump(true), () => g.input.virtualJump(false));
    hold($('m-run'), () => g.input.virtualSprint(true), () => g.input.virtualSprint(false));

    const abBtns = [$('m-ab0'), $('m-ab1'), $('m-ab2'), $('m-ab3')];
    abBtns.forEach((btn, i) => {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        g.input.virtualAbility(i);
      }, { passive: false });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        g.input.virtualAbility(i);
      });
    });

    // keep labels in sync with the active loadout
    g.events.on('loadout_changed', (loadout) => {
      abBtns.forEach((btn, i) => {
        const s = loadout.slots[i];
        if (!btn) return;
        if (!s) {
          btn.style.display = 'none';
          return;
        }
        btn.style.display = '';
        btn.textContent = s.shortName.length > 9 ? s.shortName.slice(0, 8) + '…' : s.shortName;
        btn.style.borderColor = s.canStun ? 'rgba(255,68,85,0.55)' : '';
      });
    });
  }
}
