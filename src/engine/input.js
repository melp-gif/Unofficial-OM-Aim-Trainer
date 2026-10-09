import { clamp } from '../utils/math.js';

/**
 * Unified input manager: keyboard + mouse (pointer lock) on desktop, and
 * touch joystick / look-drag / on-screen buttons on phones & tablets.
 * Every core action is reachable from touch alone.
 */
export class InputManager {
  constructor(container) {
    this.container = container;
    this.keys = new Set();
    this.moveAxis = { x: 0, y: 0 };
    /** Ability slot per key — re-mapped per character (see abilitySystem SLOT_LAYOUT). */
    this.abilityKeyMap = { KeyQ: 0, KeyE: 1, KeyX: 2, KeyR: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
    this.lookDX = 0;
    this.lookDY = 0;
    this.sensitivity = 1.0;
    this.touchSensitivity = 1.6;
    this.firing = false;
    this.sprinting = false;
    this.jumping = false;
    this.pointerLocked = false;
    this.isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.handlers = { ability: [], fireStart: [], fireEnd: [], jump: [], pause: [], interact: [] };

    // Touch state
    this._moveTouchId = null;
    this._lookTouchId = null;
    this._moveOrigin = { x: 0, y: 0 };
    this._moveCurrent = { x: 0, y: 0 };
    this._lookLast = { x: 0, y: 0 };

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
  }

  on(evt, fn) { this.handlers[evt]?.push(fn); }
  _emit(evt, arg) { for (const fn of this.handlers[evt] || []) fn(arg); }

  setAbilityKeyMap(map) {
    // keep digits as fallbacks; override the named keys per character
    this.abilityKeyMap = {
      KeyQ: 0, KeyE: 1, KeyX: 2, KeyR: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
      ...(map || {})
    };
  }

  /* ---------------- keyboard ---------------- */
  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      this.keys.add(e.code);
      const slot = this.abilityKeyMap[e.code];
      switch (e.code) {
        case 'Space': this.jumping = true; this._emit('jump'); e.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': this.sprinting = true; break;
        case 'Escape': this._emit('pause'); break;
        case 'KeyF': this._emit('interact'); break;
        default:
          if (slot !== undefined) this._emit('ability', slot);
          break;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprinting = false;
      if (e.code === 'Space') this.jumping = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.sprinting = false;
      this.firing = false;
    });
  }

  /* ---------------- mouse ---------------- */
  _bindMouse() {
    const el = this.container;
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (!this.pointerLocked && !this.isTouchDevice && document.pointerLockElement !== el) {
          el.requestPointerLock?.();
        }
        this.firing = true;
        this._emit('fireStart');
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.firing = false;
        this._emit('fireEnd');
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === el;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.lookDX += e.movementX * 0.0022 * this.sensitivity;
      this.lookDY += e.movementY * 0.0022 * this.sensitivity;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---------------- touch ---------------- */
  _bindTouch() {
    const el = this.container;

    const findTouch = (list, id) => {
      for (const t of list) if (t.identifier === id) return t;
      return null;
    };

    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const isLeft = t.clientX < window.innerWidth * 0.44;
        if (isLeft && this._moveTouchId === null) {
          this._moveTouchId = t.identifier;
          this._moveOrigin.x = t.clientX;
          this._moveOrigin.y = t.clientY;
          this._moveCurrent.x = 0;
          this._moveCurrent.y = 0;
          this._emitTouchStick(true);
        } else if (!isLeft && this._lookTouchId === null) {
          this._lookTouchId = t.identifier;
          this._lookLast.x = t.clientX;
          this._lookLast.y = t.clientY;
        }
      }
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._moveTouchId) {
          this._moveCurrent.x = t.clientX - this._moveOrigin.x;
          this._moveCurrent.y = t.clientY - this._moveOrigin.y;
          this._emitTouchStick(false);
        } else if (t.identifier === this._lookTouchId) {
          this.lookDX += (t.clientX - this._lookLast.x) * 0.0042 * this.touchSensitivity * this.sensitivity;
          this.lookDY += (t.clientY - this._lookLast.y) * 0.0042 * this.touchSensitivity * this.sensitivity;
          this._lookLast.x = t.clientX;
          this._lookLast.y = t.clientY;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._moveTouchId) {
          this._moveTouchId = null;
          this._moveCurrent.x = 0;
          this._moveCurrent.y = 0;
          this._emitTouchStick(true);
        }
        if (t.identifier === this._lookTouchId) this._lookTouchId = null;
      }
    };
    el.addEventListener('touchend', endTouch);
    el.addEventListener('touchcancel', endTouch);
  }

  _emitTouchStick(released) {
    if (this.touchStickCb) this.touchStickCb(this._moveCurrent, released);
  }

  /* ---------------- polling API ---------------- */
  update() {
    // Keyboard movement
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

    // Touch joystick overrides/adds
    if (this._moveTouchId !== null) {
      const maxR = 70;
      const dx = clamp(this._moveCurrent.x / maxR, -1, 1);
      const dy = clamp(this._moveCurrent.y / maxR, -1, 1);
      x += dx;
      y -= dy;
    }
    const mag = Math.hypot(x, y);
    if (mag > 1) { x /= mag; y /= mag; }
    this.moveAxis.x = x;
    this.moveAxis.y = y;
  }

  consumeLookDelta() {
    const d = { x: this.lookDX, y: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return d;
  }

  isMovePressed() { return Math.abs(this.moveAxis.x) > 0.05 || Math.abs(this.moveAxis.y) > 0.05; }

  /** Virtual button API used by the mobile control DOM. */
  virtualFire(down) {
    this.firing = down;
    if (down) this._emit('fireStart'); else this._emit('fireEnd');
  }
  virtualAbility(slot) { this._emit('ability', slot); }
  virtualJump(down) {
    this.jumping = down;
    if (down) this._emit('jump');
  }
  virtualSprint(down) { this.sprinting = down; }
}
