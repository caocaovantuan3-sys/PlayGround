import { clamp } from './config.js';

const ACTION_KEYS = {
  Space: 'jump',
  ShiftLeft: 'boost', ShiftRight: 'boost',
  KeyJ: 'attack',
  KeyK: 'hook',
  KeyL: 'lock',
  Tab: 'lock',
  KeyQ: 'dodge',
  KeyE: 'interact',
  KeyP: 'pause', Escape: 'pause'
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.down = {};
    this.pressed = {};
    this.move = { x: 0, y: 0 };
    this.joy = { x: 0, y: 0, active: false, id: null };
    this.look = { x: 0, y: 0 };
    this.pointerLocked = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || innerWidth < 820;
    this.enabled = false;
    this.cameraDrag = null;
    this.onPause = null;
    this.onFirstGesture = null;
    this.gestured = false;
    this.attach();
    document.body.classList.toggle('touch', this.isTouch);
  }

  attach() {
    const canvas = document.getElementById('scene');
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joy-knob');

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const action = ACTION_KEYS[e.code];
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (action) {
        if (action === 'pause') { this.onPause?.(); return; }
        if (!this.down[action]) this.pressed[action] = true;
        this.down[action] = true;
      }
      this.keys.add(e.code);
    }, { passive: false });
    window.addEventListener('keyup', (e) => {
      const action = ACTION_KEYS[e.code];
      if (action) this.down[action] = false;
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      for (const k of Object.keys(this.down)) this.down[k] = false;
    });

    // Mouse look / pointer lock
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked && this.enabled && !this.isTouch) this.onPause?.();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.isTouch) return;
      if (!this.pointerLocked) {
        canvas.requestPointerLock?.();
        return;
      }
      if (e.button === 0) this.trigger('attack');
      if (e.button === 2) this.trigger('hook');
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.pointerLocked) return;
      this.look.x += e.movementX;
      this.look.y += e.movementY;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      this.wheel = clamp((this.wheel || 0) + Math.sign(e.deltaY), -2, 2);
    }, { passive: true });

    // Touch camera drag anywhere on the canvas / right side
    const startCamera = (e) => {
      if (!this.enabled || !this.isTouch) return;
      if (e.target.closest && e.target.closest('button, .joystick, .dialogue, .overlay-card')) return;
      this.cameraDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    };
    const moveCamera = (e) => {
      if (!this.cameraDrag || this.cameraDrag.id !== e.pointerId) return;
      this.look.x += (e.clientX - this.cameraDrag.x) * 1.55;
      this.look.y += (e.clientY - this.cameraDrag.y) * 1.55;
      this.cameraDrag.x = e.clientX; this.cameraDrag.y = e.clientY;
    };
    const endCamera = (e) => {
      if (this.cameraDrag && this.cameraDrag.id === e.pointerId) this.cameraDrag = null;
    };
    canvas.addEventListener('pointerdown', startCamera);
    window.addEventListener('pointermove', moveCamera);
    window.addEventListener('pointerup', endCamera);
    window.addEventListener('pointercancel', endCamera);

    // Joystick
    const joyMove = (e) => {
      if (this.joy.id !== e.pointerId) return;
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.bottom - 18 - 64;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = 46;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      this.joy.x = dx / max; this.joy.y = dy / max;
      this.joy.active = true;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    const joyEnd = (e) => {
      if (this.joy.id !== e.pointerId) return;
      this.joy.id = null; this.joy.x = 0; this.joy.y = 0; this.joy.active = false;
      knob.style.transform = 'translate(0,0)';
    };
    joy.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault(); e.stopPropagation();
      this.joy.id = e.pointerId;
      joy.setPointerCapture?.(e.pointerId);
      joyMove(e);
    });
    joy.addEventListener('pointermove', joyMove);
    joy.addEventListener('pointerup', joyEnd);
    joy.addEventListener('pointercancel', joyEnd);

    // Touch action buttons
    document.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        e.preventDefault(); e.stopPropagation();
        btn.classList.add('pressed');
        this.trigger(action);
        btn.setPointerCapture?.(e.pointerId);
      });
      const up = (e) => {
        btn.classList.remove('pressed');
        if (action === 'boost') this.down.boost = false;
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });

    const gesture = () => {
      if (this.gestured) return;
      this.gestured = true;
      this.onFirstGesture?.();
    };
    window.addEventListener('pointerdown', gesture, { once: true });
    window.addEventListener('keydown', gesture, { once: true });
    window.addEventListener('touchstart', gesture, { once: true, passive: true });
  }

  trigger(action) {
    if (!this.enabled) return;
    if (!this.down[action]) this.pressed[action] = true;
    this.down[action] = true;
    if (action === 'jump' || action === 'attack' || action === 'hook' || action === 'dodge' || action === 'lock' || action === 'interact') {
      setTimeout(() => { this.down[action] = false; }, 90);
    }
  }

  consume(action) {
    if (this.pressed[action]) { this.pressed[action] = false; return true; }
    return false;
  }
  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = 0; this.look.y = 0;
    return l;
  }
  consumeWheel() {
    const w = this.wheel || 0; this.wheel = 0; return w;
  }
  get moveVector() {
    let x = this.joy.x;
    let y = this.joy.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y = -1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y = 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x = -1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x = 1;
    if (this.keys.has('KeyW') && this.keys.has('KeyA')) { x = -0.707; y = -0.707; }
    if (this.keys.has('KeyW') && this.keys.has('KeyD')) { x = 0.707; y = -0.707; }
    if (this.keys.has('KeyS') && this.keys.has('KeyA')) { x = -0.707; y = 0.707; }
    if (this.keys.has('KeyS') && this.keys.has('KeyD')) { x = 0.707; y = 0.707; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len: Math.min(1, len) };
  }
  get sprint() { return this.down.boost; }
  requestLock(canvas) {
    if (!this.isTouch && this.enabled) canvas?.requestPointerLock?.();
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
  clear() {
    this.keys.clear();
    for (const k of Object.keys(this.down)) this.down[k] = false;
    for (const k of Object.keys(this.pressed)) this.pressed[k] = false;
    this.joy.x = 0; this.joy.y = 0; this.joy.active = false; this.joy.id = null;
    document.getElementById('joy-knob').style.transform = 'translate(0,0)';
  }
}
