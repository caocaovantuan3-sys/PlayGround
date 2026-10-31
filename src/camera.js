import * as THREE from 'three';

const DEG = Math.PI / 180;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const damp = (current, target, lambda, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));

const MODE_DEFAULTS = {
  free: {
    target: new THREE.Vector3(0, 30, -120),
    yaw: 0.02,
    pitch: -0.055,
    radius: 248,
    fov: 67,
  },
  ground: {
    position: new THREE.Vector3(0, 4.5, 168),
    yaw: 0,
    pitch: 0.06,
    fov: 68,
  },
  cinematic: {
    target: new THREE.Vector3(0, 70, -126),
    yaw: 0,
    pitch: -0.08,
    radius: 250,
    fov: 58,
  },
};

export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.mode = 'free';
    this.autoOrbit = true;
    this.shakeEnabled = true;
    this.onViewChange = null;
    this.onInteract = null;

    this.target = MODE_DEFAULTS.free.target.clone();
    this.desiredTarget = MODE_DEFAULTS.free.target.clone();
    this.yaw = MODE_DEFAULTS.free.yaw;
    this.pitch = MODE_DEFAULTS.free.pitch;
    this.radius = MODE_DEFAULTS.free.radius;
    this.fov = MODE_DEFAULTS.free.fov;

    this.desiredYaw = this.yaw;
    this.desiredPitch = this.pitch;
    this.desiredRadius = this.radius;
    this.desiredFov = this.fov;

    this.groundPos = MODE_DEFAULTS.ground.position.clone();
    this.desiredGroundPos = this.groundPos.clone();
    this.groundYaw = MODE_DEFAULTS.ground.yaw;
    this.groundPitch = MODE_DEFAULTS.ground.pitch;
    this.desiredGroundYaw = this.groundYaw;
    this.desiredGroundPitch = this.groundPitch;

    this.cinematicClock = 0;
    this.cinematicRadius = 220;
    this.trauma = 0;
    this.time = 0;
    this.dragging = false;
    this.moved = 0;

    this.pointers = new Map();
    this.pinchStart = 0;
    this.pinchStartRadius = 0;
    this.pinchStartFov = 0;
    this.lastTapTime = 0;
    this.lastTapX = 0;
    this.lastTapY = 0;

    this.shakeOffset = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this._tempDir = new THREE.Vector3();
    this._tempRight = new THREE.Vector3();

    this.bindEvents();
    this.applyImmediate();
  }

  bindEvents() {
    const el = this.domElement;

    this._onPointerDown = (e) => {
      if (e.button !== undefined && e.button > 0) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.dragging = true;
      this.moved = 0;
      if (this.pointers.size === 2) {
        const points = Array.from(this.pointers.values());
        this.pinchStart = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        this.pinchStartRadius = this.desiredRadius;
        this.pinchStartFov = this.desiredFov;
      }

      const now = performance.now();
      if (now - this.lastTapTime < 310 && Math.hypot(e.clientX - this.lastTapX, e.clientY - this.lastTapY) < 28) {
        this.recenter();
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = now;
        this.lastTapX = e.clientX;
        this.lastTapY = e.clientY;
      }
    };

    this._onPointerMove = (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size >= 2) {
        const points = Array.from(this.pointers.values());
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (this.pinchStart > 0) {
          const ratio = this.pinchStart / Math.max(20, distance);
          if (this.mode === 'ground') {
            this.desiredFov = clamp(this.pinchStartFov * ratio, 32, 82);
          } else {
            this.desiredRadius = clamp(this.pinchStartRadius * ratio, 72, 430);
          }
        }
        this.moved += Math.abs(dx) + Math.abs(dy);
        return;
      }

      this.moved += Math.abs(dx) + Math.abs(dy);
      if (Math.abs(dx) + Math.abs(dy) < 0.1) return;

      if (this.mode === 'cinematic') {
        this.setMode('free', false);
      }

      if (this.mode === 'ground') {
        this.desiredGroundYaw -= dx * 0.0042;
        this.desiredGroundPitch = clamp(this.desiredGroundPitch - dy * 0.0038, -0.72, 1.08);
      } else {
        this.desiredYaw -= dx * 0.0043;
        this.desiredPitch = clamp(this.desiredPitch + dy * 0.0034, -0.68, 0.9);
      }

      if (this.autoOrbit) {
        this.autoOrbit = false;
        this.onViewChange?.({ autoOrbit: false, mode: this.mode, reason: 'drag' });
      }
      this.onInteract?.();
    };

    this._onPointerUp = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        this.dragging = false;
        this.pinchStart = 0;
      }
      if (this.pointers.size === 1) {
        const point = Array.from(this.pointers.values())[0];
        this.pinchStart = 0;
        this.pointers.set(Array.from(this.pointers.keys())[0], point);
      }
    };

    this._onWheel = (e) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.0011);
      if (this.mode === 'ground') {
        this.desiredFov = clamp(this.desiredFov * factor, 32, 82);
      } else {
        this.desiredRadius = clamp(this.desiredRadius * factor, 72, 430);
      }
      if (this.mode === 'cinematic') this.setMode('free', false);
      this.onInteract?.();
    };

    this._onContext = (e) => e.preventDefault();

    el.addEventListener('pointerdown', this._onPointerDown, { passive: true });
    el.addEventListener('pointermove', this._onPointerMove, { passive: true });
    el.addEventListener('pointerup', this._onPointerUp, { passive: true });
    el.addEventListener('pointercancel', this._onPointerUp, { passive: true });
    el.addEventListener('wheel', this._onWheel, { passive: false });
    el.addEventListener('contextmenu', this._onContext);
  }

  setMode(mode, notify = true) {
    if (!MODE_DEFAULTS[mode]) return;
    if (mode === this.mode) return;
    if (mode === 'cinematic') {
      this.cinematicClock = 0;
      this.desiredTarget.copy(this.target);
      this.desiredRadius = this.radius;
      this.desiredPitch = this.pitch;
      this.desiredYaw = this.yaw;
    }
    if (mode === 'free') {
      this.desiredTarget.copy(MODE_DEFAULTS.free.target);
      this.desiredYaw = this.yaw;
      this.desiredPitch = this.pitch;
      this.desiredRadius = this.radius;
    }
    if (mode === 'ground') {
      this.desiredGroundYaw = this.groundYaw;
      this.desiredGroundPitch = this.groundPitch;
      this.desiredGroundPos.copy(MODE_DEFAULTS.ground.position);
    }
    this.mode = mode;
    if (notify) this.onViewChange?.({ mode, autoOrbit: this.autoOrbit, reason: 'mode' });
  }

  setAutoOrbit(on) {
    this.autoOrbit = !!on;
    this.onViewChange?.({ mode: this.mode, autoOrbit: this.autoOrbit, reason: 'auto' });
  }

  setFov(value) {
    this.desiredFov = clamp(value, 32, 82);
  }

  getFov() {
    return this.fov;
  }

  recenter() {
    if (this.mode === 'ground') {
      this.desiredGroundYaw = 0;
      this.desiredGroundPitch = 0.06;
      this.desiredFov = 68;
      this.desiredGroundPos.copy(MODE_DEFAULTS.ground.position);
    } else {
      this.desiredTarget.copy(MODE_DEFAULTS.free.target);
      this.desiredYaw = 0.02;
      this.desiredPitch = -0.055;
      this.desiredRadius = this.mode === 'cinematic' ? 250 : 248;
      this.desiredFov = this.mode === 'cinematic' ? 58 : 67;
    }
    if (this.mode === 'cinematic') {
      this.cinematicClock = 0;
    }
  }

  aimAtShow() {
    if (this.mode === 'ground') {
      this.desiredGroundPitch = Math.max(this.desiredGroundPitch, 0.09);
      this.desiredFov = Math.min(this.desiredFov, 70);
    } else {
      this.desiredPitch = Math.min(this.desiredPitch, 0.01);
      this.desiredRadius = Math.min(this.desiredRadius, 262);
    }
  }

  addShake(amount) {
    if (!this.shakeEnabled) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.time += safeDt;
    const cinematic = this.mode === 'cinematic';
    if (cinematic) {
      this.cinematicClock += safeDt;
      const t = this.cinematicClock;
      this.desiredYaw = 0.03 + Math.sin(t * 0.075) * 0.52 + t * 0.017;
      this.desiredPitch = -0.12 + Math.sin(t * 0.092 + 0.6) * 0.15;
      this.desiredRadius = 228 + Math.sin(t * 0.063) * 50;
      this.desiredTarget.set(
        Math.sin(t * 0.11) * 28,
        74 + Math.sin(t * 0.086) * 18,
        -128 + Math.cos(t * 0.073) * 20,
      );
      this.desiredFov = 56 + Math.sin(t * 0.045) * 4;
    } else if (this.autoOrbit && !this.dragging) {
      // Sway around the current framing instead of drifting away from the city.
      if (this.mode === 'free') {
        this.desiredYaw += Math.sin(this.time * 0.3) * safeDt * 0.055;
      } else {
        this.desiredGroundYaw += Math.sin(this.time * 0.27 + 1.2) * safeDt * 0.032;
      }
    }

    this.yaw = damp(this.yaw, this.desiredYaw, 7.5, safeDt);
    this.pitch = damp(this.pitch, this.desiredPitch, 7.5, safeDt);
    this.radius = damp(this.radius, this.desiredRadius, 6.4, safeDt);
    this.fov = damp(this.fov, this.desiredFov, 7, safeDt);
    this.target.lerp(this.desiredTarget, 1 - Math.exp(-5.5 * safeDt));
    this.groundYaw = damp(this.groundYaw, this.desiredGroundYaw, 9, safeDt);
    this.groundPitch = damp(this.groundPitch, this.desiredGroundPitch, 9, safeDt);
    this.groundPos.lerp(this.desiredGroundPos, 1 - Math.exp(-5.5 * safeDt));

    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    if (this.mode === 'ground') {
      this.camera.position.copy(this.groundPos);
      const cp = Math.cos(this.groundPitch);
      this.lookTarget.set(
        this.groundPos.x - Math.sin(this.groundYaw) * cp * 100,
        this.groundPos.y + Math.sin(this.groundPitch) * 100,
        this.groundPos.z - Math.cos(this.groundYaw) * cp * 100,
      );
    } else {
      const cp = Math.cos(this.pitch);
      this.camera.position.set(
        this.target.x + Math.sin(this.yaw) * cp * this.radius,
        this.target.y + Math.sin(this.pitch) * this.radius,
        this.target.z + Math.cos(this.yaw) * cp * this.radius,
      );
      this.lookTarget.copy(this.target);
    }

    this.camera.lookAt(this.lookTarget);

    // Impact shake decays quickly so it never makes the show uncomfortable.
    this.trauma = Math.max(0, this.trauma - safeDt * 1.55);
    if (this.trauma > 0.001) {
      const power = this.trauma * this.trauma;
      const t = this.time * 38;
      this.shakeOffset.set(
        Math.sin(t * 1.23) * power * 0.65,
        Math.sin(t * 1.71 + 1.2) * power * 0.45,
        Math.sin(t * 2.11 + 0.4) * power * 0.55,
      );
      this.camera.position.add(this.shakeOffset);
      this.camera.rotateZ(Math.sin(t * 1.37) * power * 0.0035);
    }

    this.camera.updateMatrixWorld();
  }

  applyImmediate() {
    this.yaw = this.desiredYaw;
    this.pitch = this.desiredPitch;
    this.radius = this.desiredRadius;
    this.fov = this.desiredFov;
    this.target.copy(this.desiredTarget);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.radius,
      this.target.y + Math.sin(this.pitch) * this.radius,
      this.target.z + Math.cos(this.yaw) * cp * this.radius,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
