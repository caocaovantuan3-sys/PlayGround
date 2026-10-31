import * as THREE from 'three';
import { World } from './world.js';
import { CameraRig } from './camera.js';
import { FireworksSystem, FIREWORK_SHAPES } from './fireworks.js';
import { PostFX } from './postfx.js';
import { AudioEngine } from './audio.js';
import { MODES, ShowDirector, shapeLabel } from './shows.js';

const PLAY_ICON = `<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>`;
const PAUSE_ICON = `<svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor"/></svg>`;

const QUALITY_PRESETS = {
  low: {
    maxDpr: 1,
    effects: { bloom: false, dof: false, reflection: false },
  },
  medium: {
    maxDpr: 1.5,
    effects: { bloom: true, dof: false, reflection: true },
  },
  high: {
    maxDpr: 2,
    effects: { bloom: true, dof: true, reflection: true },
  },
  ultra: {
    maxDpr: 2.5,
    effects: { bloom: true, dof: true, reflection: true },
  },
};

const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class FireworksApp {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.mode = 'free';
    this.autoRepeat = true;
    this.cameraOverride = null;
    this.sequence = [];
    this.selectedShape = 'peony';
    this.selectedColor = '#ff5f8f';
    this.burstDelay = 1.2;
    this.slowmoRemaining = 0;
    this.manualSlowmo = false;
    this.paused = false;
    this.simTime = 0;
    this.realTime = 0;
    this.targetFps = 60;
    this.qualityMode = 'auto';
    this.autoQuality = 'high';
    this.resolvedQuality = 'high';
    this.effects = { bloom: true, dof: true, reflection: true, shake: true };
    this.idleClock = 0;
    this.nextIdleAt = 2.8;
    this.recording = false;
    this.mediaRecorder = null;
    this.recChunks = [];
    this.recTimer = null;
    this.recStartedAt = 0;
    this.endTimer = null;
    this.previewTimer = null;
    this.toastTimer = null;
    this.photoMode = false;
    this.fpsFrames = 0;
    this.fpsWindowStart = performance.now();
    this.fpsValue = 60;
    this.lowFpsSamples = 0;
    this.highFpsSamples = 0;
    this.adaptCooldown = 0;
    this.lastRenderAt = 0;
    this._focusPoint = new THREE.Vector3(0, 120, -120);
    this._tmp = new THREE.Vector3();
    this.isMobile =
      window.matchMedia('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      window.innerWidth < 720;
    this.autoQuality = this.detectInitialQuality();
    this.resolvedQuality = this.qualityMode === 'auto' ? this.autoQuality : this.resolvedQuality;

    this.initThree();
    this.initScene();
    this.initAudio();
    this.bindUI();
    this.bindKeyboard();
    this.bindGlobalEvents();
    this.setQualityMode('auto', true);
    this.applyModeMeta('free');
    this.updatePlaybackUI({ playing: false, paused: false, ended: false });
    this.exposeDebugApi();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
    setTimeout(() => this.hideLoader(), 800);
  }

  detectInitialQuality() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const dpr = window.devicePixelRatio || 1;
    if (this.isMobile) {
      if (cores >= 8 && memory >= 6 && dpr <= 3) return 'high';
      if (cores >= 6) return 'medium';
      return 'low';
    }
    if (cores >= 10 && memory >= 8) return 'high';
    if (cores >= 6) return 'high';
    return 'medium';
  }

  initThree() {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch (error) {
      this.showFatal(error);
      return;
    }
    this.renderer.setClearColor(0x02030a, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = true;
    this.renderer.info.autoReset = false;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = this.pixelRatioFor(this.resolvedQuality);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.4, 2600);
    this.camera.position.set(0, 68, 90);

    this.rig = new CameraRig(this.camera, this.canvas);
    this.rig.onViewChange = (info) => this.handleViewChange(info);
    this.rig.onInteract = () => this.hideHint();
  }

  initScene() {
    if (!this.renderer) return;
    this.world = new World(this.scene, this.renderer, this.resolvedQuality);
    this.world.setPixelRatio(this.renderer.getPixelRatio());

    this.fireworks = new FireworksSystem(this.scene, this.camera, this.world, {
      onLaunch: (data) => {
        this.audio.launch(data.position);
      },
      onExplode: (data) => {
        this.audio.boom(data.position, data.power);
        const distance = this.camera.position.distanceTo(data.position);
        const proximity = clamp(1 - distance / 760, 0.06, 1);
        this.rig.addShake(clamp(data.power * 0.085 * proximity, 0.01, 0.2));
        if (data.slowmo && this.slowmoRemaining <= 0.05) {
          this.triggerSlowmo(2.4);
        }
      },
    });
    this.fireworks.setQuality(this.resolvedQuality);

    this.postfx = new PostFX(
      this.renderer,
      this.scene,
      this.camera,
      window.innerWidth,
      window.innerHeight,
    );
    this.postfx.setPixelRatio(this.renderer.getPixelRatio());
    this.postfx.applyQuality(this.resolvedQuality);
    this.postfx.setCinemaMode(false);

    this.director = new ShowDirector({
      onCue: (cue) => this.spawnCue(cue),
      onState: (state) => this.handleDirectorState(state),
      onTick: (tick) => this.updateProgress(tick),
      onEnd: () => this.handleShowEnd(),
    });

    this.resize();
  }

  initAudio() {
    this.audio = new AudioEngine();
    this.audio.setVolume(0.72);
  }

  pixelRatioFor(quality) {
    const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
    return Math.min(window.devicePixelRatio || 1, preset.maxDpr);
  }

  /* ------------------------------------------------------------------ */
  /* rendering                                                           */
  /* ------------------------------------------------------------------ */

  animate(now) {
    requestAnimationFrame(this.animate);
    if (!this.renderer) return;

    const minInterval = 1000 / this.targetFps;
    if (this.lastRenderAt && now - this.lastRenderAt < minInterval - 0.6) return;

    const rawDt = this.lastRenderAt ? Math.min(0.065, (now - this.lastRenderAt) / 1000) : 0.016;
    this.lastRenderAt = now;
    this.realTime += rawDt;

    if (!this.paused) {
      if (this.slowmoRemaining > 0) this.slowmoRemaining = Math.max(0, this.slowmoRemaining - rawDt);
    }

    const slowmoActive = this.slowmoRemaining > 0 && !this.paused;
    const showDt = this.paused ? 0 : slowmoActive ? rawDt * 0.25 : rawDt;
    const worldDt = this.paused ? 0 : slowmoActive ? rawDt * 0.45 : rawDt;
    this.simTime += worldDt;

    if (this.director) this.director.update(showDt);
    if (this.fireworks) this.fireworks.update(showDt, this.simTime);
    if (this.world) this.world.update(worldDt, this.simTime, this.paused);
    if (this.rig) this.rig.update(this.paused ? 0 : slowmoActive ? rawDt * 0.5 : rawDt);

    if (!this.paused && (!this.director?.playing || this.director?.paused)) {
      this.updateIdle(rawDt);
    }

    this.audio.updateListener(this.camera);
    this.updateSlowmoUI();

    this.postfx.setFocus(
      Math.max(60, this.camera.position.distanceTo(this._focusPoint)),
    );
    this.renderer.info.reset();
    this.postfx.render(rawDt, this.simTime);

    this.measurePerformance(now, rawDt);
    this.updateLiveStats(now);
    this.updateFovFromRig();
  }

  updateIdle(dt) {
    if (this.photoMode && this.recording) return;
    this.idleClock += dt;
    if (this.idleClock < this.nextIdleAt) return;
    this.idleClock = 0;
    this.nextIdleAt = 5.5 + Math.random() * 6.5;
    if (this.director?.playing) return;
    if (document.hidden) return;

    const info = MODES[this.mode] || MODES.free;
    const types = ['peony', 'willow', 'ring', 'chrysanthemum', 'star', 'glitter'];
    const type = types[Math.floor(Math.random() * types.length)];
    const color = info.palette[Math.floor(Math.random() * info.palette.length)];
    this.fireworks.spawn({
      type,
      color,
      target: {
        x: (Math.random() - 0.5) * 150,
        y: 105 + Math.random() * 60,
        z: -80 - Math.random() * 100,
      },
      scale: 0.85 + Math.random() * 0.3,
    });
  }

  updateSlowmoUI() {
    const active = this.slowmoRemaining > 0 && !this.paused;
    document.getElementById('slowmoBadge').classList.toggle('is-visible', active);
    document.getElementById('slowmoBtn').classList.toggle('is-active', active);
  }

  triggerSlowmo(seconds = 5) {
    if (this.paused) return;
    this.slowmoRemaining = Math.max(this.slowmoRemaining, seconds);
    this.manualSlowmo = true;
    this.hideHint();
  }

  toggleSlowmo() {
    if (this.slowmoRemaining > 0.2) {
      this.slowmoRemaining = 0;
      this.manualSlowmo = false;
      this.showToast('SLOW MOTION OFF');
    } else {
      this.triggerSlowmo(6);
      this.showToast('SLOW MOTION · 0.25×');
    }
  }

  measurePerformance(now, dt) {
    this.fpsFrames++;
    const span = now - this.fpsWindowStart;
    if (span >= 1000) {
      this.fpsValue = Math.round((this.fpsFrames * 1000) / span);
      this.fpsFrames = 0;
      this.fpsWindowStart = now;

      if (this.qualityMode === 'auto' && !this.paused) {
        if (this.fpsValue < 44) this.lowFpsSamples++;
        else this.lowFpsSamples = 0;

        if (this.fpsValue > 56) this.highFpsSamples++;
        else this.highFpsSamples = 0;

        if (this.lowFpsSamples >= 2 && now > this.adaptCooldown) {
          const idx = QUALITY_ORDER.indexOf(this.autoQuality);
          if (idx > 0) {
            this.autoQuality = QUALITY_ORDER[idx - 1];
            this.resolvedQuality = this.autoQuality;
            this.lowFpsSamples = 0;
            this.adaptCooldown = now + 6500;
            this.applyQuality(this.autoQuality, true);
            this.showToast(`AUTO QUALITY · ${this.autoQuality.toUpperCase()}`);
          }
        }

        if (
          !this.isMobile &&
          this.highFpsSamples >= 18 &&
          now > this.adaptCooldown &&
          this.fpsValue > 57
        ) {
          const idx = QUALITY_ORDER.indexOf(this.autoQuality);
          if (idx >= 0 && idx < QUALITY_ORDER.length - 1) {
            this.autoQuality = QUALITY_ORDER[idx + 1];
            this.resolvedQuality = this.autoQuality;
            this.highFpsSamples = 0;
            this.adaptCooldown = now + 18000;
            this.applyQuality(this.autoQuality, true);
          }
        }
      } else {
        this.lowFpsSamples = 0;
        this.highFpsSamples = 0;
      }
    }
  }

  updateLiveStats(now) {
    if (!this._lastUiUpdate) this._lastUiUpdate = 0;
    if (now - this._lastUiUpdate < 330) return;
    this._lastUiUpdate = now;

    document.getElementById('fpsValue').textContent = this.fpsValue;
    document.getElementById('qualityValue').textContent = this.resolvedQuality.toUpperCase();
    document.getElementById('particleValue').textContent = `${this.fireworks?.particleCount || 0} PTS`;
    const info = this.renderer?.info;
    if (info) {
      document.getElementById('drawCalls').textContent = info.render.calls;
      document.getElementById('renderResolution').textContent =
        `${Math.round(window.innerWidth * this.renderer.getPixelRatio())}×${Math.round(window.innerHeight * this.renderer.getPixelRatio())}`;
    }
    document.getElementById('activeParticles').textContent =
      (this.fireworks?.particleCount || 0).toLocaleString('en-US');
  }

  updateFovFromRig() {
    if (!this.rig) return;
    const slider = document.getElementById('fovSlider');
    if (slider && document.activeElement !== slider) {
      const value = String(Math.round(this.rig.getFov()));
      if (slider.value !== value) slider.value = value;
    }
  }

  resize() {
    if (!this.renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.postfx?.setSize(width, height);
  }

  /* ------------------------------------------------------------------ */
  /* show flow                                                           */
  /* ------------------------------------------------------------------ */

  applyModeMeta(mode) {
    const info = MODES[mode] || MODES.free;
    document.getElementById('showTitle').textContent = info.title;
    document.getElementById('showSubtitle').textContent = info.subtitle;
    document.getElementById('locationLabel').textContent = info.location;
    document.getElementById('modeLabel').textContent = info.label;
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mode === mode);
    });
    document.body.classList.remove('mode-free', 'mode-festival', 'mode-cinematic', 'mode-city', 'mode-lake', 'mode-galaxy', 'mode-custom');
    document.body.classList.add(`mode-${mode}`);
    this.world?.setTheme(info.theme);
    this.postfx?.setCinemaMode(mode === 'cinematic');
  }

  applyShowMeta(show) {
    if (!show?.info) return;
    const info = show.info;
    document.getElementById('showTitle').textContent = info.title;
    document.getElementById('showSubtitle').textContent = info.subtitle;
    document.getElementById('locationLabel').textContent = info.location;
    document.getElementById('modeLabel').textContent = info.label;
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mode === show.mode);
    });
    if (show.mode === 'custom') {
      document.body.classList.remove('mode-free', 'mode-festival', 'mode-cinematic', 'mode-city', 'mode-lake', 'mode-galaxy');
      document.body.classList.add('mode-custom');
    } else {
      this.mode = show.mode;
      this.applyModeMeta(show.mode);
    }
    this.world?.setTheme(info.theme);
  }

  spawnCue(cue) {
    if (!this.fireworks) return;
    this.fireworks.spawn({
      type: cue.type,
      color: cue.color,
      color2: cue.color2,
      target: cue.target,
      scale: cue.scale,
      slowmo: cue.slowmo,
      label: cue.label,
    });
  }

  applyModeCamera(mode) {
    if (this.cameraOverride) return;
    if (mode === 'cinematic') {
      this.rig.setMode('cinematic');
      this.rig.setAutoOrbit(true);
      this.rig.setFov(54);
      this.rig.aimAtShow();
    } else if (mode === 'lake') {
      this.rig.setMode('free');
      this.rig.setAutoOrbit(true);
      this.rig.desiredTarget.set(0, 38, -126);
      this.rig.desiredRadius = 242;
      this.rig.desiredPitch = 0.09;
      this.rig.desiredYaw = 0.02;
      this.rig.setFov(70);
    } else if (mode === 'city') {
      this.rig.setMode('free');
      this.rig.setAutoOrbit(true);
      this.rig.desiredTarget.set(0, 55, -138);
      this.rig.desiredRadius = 268;
      this.rig.desiredPitch = -0.08;
      this.rig.desiredYaw = -0.16;
      this.rig.setFov(63);
    } else if (mode === 'galaxy') {
      this.rig.setMode('free');
      this.rig.setAutoOrbit(true);
      this.rig.desiredTarget.set(0, 92, -126);
      this.rig.desiredRadius = 246;
      this.rig.desiredPitch = -0.16;
      this.rig.desiredYaw = 0.02;
      this.rig.setFov(60);
    } else {
      this.rig.setMode('free');
      this.rig.setAutoOrbit(true);
      this.rig.desiredTarget.set(0, 30, -126);
      this.rig.desiredRadius = 248;
      this.rig.desiredPitch = -0.055;
      this.rig.setFov(67);
      this.rig.aimAtShow();
    }
    this.updateViewUI();
  }

  startShow(options = {}) {
    if (!this.renderer) return;
    this.hideHint();
    this.cancelEndTimer();
    this.ensureAudio();
    this.audio.setPaused(false);
    this.paused = false;
    this.audio.startMusic();
    this.fireworks.clear();
    if (this.slowmoRemaining > 0) this.slowmoRemaining = 0;

    let mode = this.mode;
    if (options.customSequence) {
      mode = 'custom';
      this.mode = 'custom';
    }
    this.applyModeCamera(mode);
    this.director.start(options.customSequence ? 'custom' : mode, {
      customSequence: options.customSequence,
    });
    this.updatePlaybackUI({ playing: true, paused: false, ended: false });
  }

  pauseShow() {
    if (!this.director) return;
    if (this.director.playing && !this.director.paused) {
      this.director.pause();
      this.paused = true;
      this.audio.setPaused(true);
      document.body.classList.add('is-paused');
      this.showToast('PAUSED · TAP PLAY TO CONTINUE');
    } else if (this.director.playing && this.director.paused) {
      this.resumeShow();
    }
  }

  resumeShow() {
    if (!this.director?.playing) return;
    this.director.resume();
    this.paused = false;
    this.audio.setPaused(false);
    document.body.classList.remove('is-paused');
    document.getElementById('playLabel').textContent = 'PAUSE';
    document.getElementById('playIcon').innerHTML = PAUSE_ICON;
  }

  togglePlayback() {
    if (!this.director) return;
    if (this.director.playing && !this.director.paused) {
      this.pauseShow();
    } else if (this.director.playing && this.director.paused) {
      this.resumeShow();
    } else {
      this.startShow(
        this.director.mode === 'custom' && this.sequence.length
          ? { customSequence: this.sequence }
          : {},
      );
    }
  }

  replayShow() {
    if (!this.director) return;
    this.cancelEndTimer();
    this.ensureAudio();
    this.audio.setPaused(false);
    this.audio.startMusic();
    this.paused = false;
    this.slowmoRemaining = 0;
    this.fireworks.clear();
    document.body.classList.remove('is-paused');
    if (this.director.mode === 'custom' && this.director.customSequence) {
      this.applyModeCamera('custom');
      this.director.start('custom', { customSequence: this.director.customSequence });
    } else {
      this.applyModeCamera(this.director.mode);
      this.director.replay();
    }
    this.showToast('REPLAY');
  }

  handleDirectorState(state) {
    if (state.show) this.applyShowMeta(state.show);
    if (state.paused) this.paused = true;
    if (state.playing && !state.paused) this.paused = false;
    this.updatePlaybackUI(state);
  }

  updatePlaybackUI(state) {
    const playLabel = document.getElementById('playLabel');
    const playIcon = document.getElementById('playIcon');
    const showState = document.getElementById('showState');
    const pauseBtn = document.getElementById('pauseBtn');
    const isPlaying = state.playing && !state.paused;
    const isPaused = state.playing && state.paused;

    document.body.classList.toggle('is-paused', isPaused);
    if (isPlaying) {
      playLabel.textContent = 'PAUSE';
      playIcon.innerHTML = PAUSE_ICON;
      showState.textContent = 'LIVE PERFORMANCE';
      pauseBtn.classList.add('is-active');
    } else if (isPaused) {
      playLabel.textContent = 'RESUME';
      playIcon.innerHTML = PLAY_ICON;
      showState.textContent = 'PAUSED';
      pauseBtn.classList.remove('is-active');
    } else if (state.ended) {
      playLabel.textContent = 'REPLAY SHOW';
      playIcon.innerHTML = PLAY_ICON;
      showState.textContent = 'SHOW COMPLETE';
      pauseBtn.classList.remove('is-active');
    } else {
      playLabel.textContent = 'START SHOW';
      playIcon.innerHTML = PLAY_ICON;
      showState.textContent = this.photoMode ? 'PHOTO MODE' : 'LIVE SKY';
      pauseBtn.classList.remove('is-active');
    }
  }

  updateProgress(tick) {
    document.getElementById('progressFill').style.width = `${tick.progress * 100}%`;
    document.getElementById('showClock').textContent = this.formatTime(tick.elapsed);
  }

  handleShowEnd() {
    this.cancelEndTimer();
    if (this.autoRepeat) {
      this.endTimer = window.setTimeout(() => {
        this.endTimer = null;
        if (this.autoRepeat && !this.paused) {
          if (this.director.mode === 'custom' && this.director.customSequence) {
            this.director.start('custom', { customSequence: this.director.customSequence });
          } else {
            this.director.replay();
          }
          this.audio.setPaused(false);
          this.audio.startMusic();
        }
      }, 3400);
    }
  }

  cancelEndTimer() {
    if (this.endTimer) {
      window.clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }

  switchMode(mode) {
    if (!MODES[mode]) return;
    const wasPlaying = this.director?.playing;
    this.cancelEndTimer();
    this.previewTimer && window.clearTimeout(this.previewTimer);
    this.mode = mode;
    this.applyModeMeta(mode);
    if (this.director) this.director.mode = mode;
    this.cameraOverride = null;
    this.applyModeCamera(mode);
    if (wasPlaying) {
      this.fireworks.clear();
      this.audio.setPaused(false);
      this.director.start(mode);
      this.paused = false;
      this.audio.startMusic();
    } else {
      this.fireworks.clear();
      this.paused = false;
      this.updatePlaybackUI({ playing: false, paused: false, ended: false });
      document.getElementById('progressFill').style.width = '0%';
      document.getElementById('showClock').textContent = '00:00';
      this.previewTimer = window.setTimeout(() => this.previewModeBurst(), 420);
    }
    this.showToast(`${MODES[mode].label} · SELECTED`);
  }

  previewModeBurst() {
    if (this.director?.playing) return;
    const info = MODES[this.mode] || MODES.free;
    const presets = {
      free: ['peony', 'willow'],
      festival: ['chrysanthemum', 'peony'],
      cinematic: ['heart', 'star'],
      city: ['chrysanthemum', 'ring'],
      lake: ['ring', 'star'],
      galaxy: ['star', 'ring'],
    };
    const types = presets[this.mode] || presets.free;
    types.forEach((type, i) => {
      this.fireworks.spawn({
        type,
        color: info.palette[i % info.palette.length],
        target: { x: (i - 0.5) * 58, y: 122 + i * 16, z: -110 - i * 20 },
        scale: 1.06,
      });
    });
  }

  formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  /* ------------------------------------------------------------------ */
  /* quality                                                             */
  /* ------------------------------------------------------------------ */

  setQualityMode(mode, silent = false) {
    this.qualityMode = mode;
    if (mode === 'auto') {
      this.resolvedQuality = this.autoQuality;
    } else {
      this.autoQuality = mode;
      this.resolvedQuality = mode;
    }
    const preset = QUALITY_PRESETS[this.resolvedQuality];
    this.effects = {
      bloom: preset.effects.bloom,
      dof: preset.effects.dof,
      reflection: preset.effects.reflection,
      shake: this.effects.shake,
    };
    this.applyQuality(this.resolvedQuality, false);
    this.updateQualityUI();
    if (!silent && mode !== 'auto') this.showToast(`QUALITY · ${mode.toUpperCase()}`);
  }

  applyQuality(quality, fromAuto = false) {
    this.resolvedQuality = quality;
    if (!this.renderer) return;
    const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
    const dpr = this.pixelRatioFor(quality);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.postfx?.setPixelRatio(dpr);
    this.postfx?.setSize(window.innerWidth, window.innerHeight);
    this.postfx?.applyQuality(quality);
    this.world?.setQuality(quality);
    this.world?.setPixelRatio(dpr);
    this.fireworks?.setQuality(quality);
    this.fireworks?.setPixelRatio(dpr);
    this.applyEffects();
    this.updateQualityUI();
    if (fromAuto) {
      // Keep the control surface honest when adaptive quality changes.
      this.effects = {
        bloom: preset.effects.bloom,
        dof: preset.effects.dof,
        reflection: preset.effects.reflection,
        shake: this.effects.shake,
      };
      this.applyEffects();
      this.refreshToggleUI();
    }
  }

  applyEffects() {
    this.postfx?.setBloomEnabled(this.effects.bloom);
    this.postfx?.setDofEnabled(this.effects.dof);
    this.world?.setReflection(this.effects.reflection);
    if (this.rig) this.rig.shakeEnabled = this.effects.shake;
  }

  updateQualityUI() {
    document.getElementById('qualityValue').textContent = this.resolvedQuality.toUpperCase();
    document.getElementById('qualityBadge').textContent =
      this.qualityMode === 'auto'
        ? `AUTO · ${this.resolvedQuality.toUpperCase()}`
        : this.resolvedQuality.toUpperCase();
    document.querySelectorAll('#qualitySegment button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.quality === this.qualityMode);
    });
    this.refreshToggleUI();
  }

  refreshToggleUI() {
    document.querySelectorAll('[data-toggle]').forEach((btn) => {
      const key = btn.dataset.toggle;
      btn.classList.toggle('is-on', !!this.effects[key]);
      btn.setAttribute('aria-pressed', String(!!this.effects[key]));
    });
  }

  /* ------------------------------------------------------------------ */
  /* ui wiring                                                           */
  /* ------------------------------------------------------------------ */

  bindUI() {
    document.getElementById('playBtn').addEventListener('click', () => this.togglePlayback());
    document.getElementById('pauseBtn').addEventListener('click', () => this.pauseShow());
    document.getElementById('replayBtn').addEventListener('click', () => this.replayShow());
    document.getElementById('slowmoBtn').addEventListener('click', () => this.toggleSlowmo());
    document.getElementById('createBtn').addEventListener('click', () => this.openPanel('custom'));

    document.getElementById('autoToggle').addEventListener('click', () => {
      this.autoRepeat = !this.autoRepeat;
      const btn = document.getElementById('autoToggle');
      btn.classList.toggle('is-on', this.autoRepeat);
      btn.setAttribute('aria-pressed', String(this.autoRepeat));
      this.showToast(this.autoRepeat ? 'AUTO REPLAY ON' : 'AUTO REPLAY OFF');
    });

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
    });

    document.querySelectorAll('[data-panel]').forEach((btn) => {
      btn.addEventListener('click', () => this.openPanel(btn.dataset.panel));
    });

    document.getElementById('closeSheetBtn').addEventListener('click', () => this.closePanel());
    document.getElementById('sheetBackdrop').addEventListener('click', () => this.closePanel());

    document.querySelectorAll('#viewGrid .view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.cameraOverride = view;
        this.rig.setMode(view);
        this.rig.setAutoOrbit(view !== 'ground');
        if (view === 'ground') this.rig.desiredGroundPitch = 0.09;
        this.updateViewUI();
        this.showToast(`CAMERA · ${view.toUpperCase()}`);
      });
    });

    document.getElementById('autoOrbitSwitch').addEventListener('click', () => {
      this.rig.setAutoOrbit(!this.rig.autoOrbit);
      this.updateViewUI();
    });

    document.getElementById('fovSlider').addEventListener('input', (e) => {
      this.rig.setFov(Number(e.target.value));
    });

    document.getElementById('resetCameraBtn').addEventListener('click', () => {
      this.cameraOverride = null;
      this.applyModeCamera(this.mode);
      this.rig.recenter();
      this.updateViewUI();
      this.showToast('CAMERA RESET');
    });

    document.getElementById('slowmoPanelBtn').addEventListener('click', () => {
      this.toggleSlowmo();
    });

    document.querySelectorAll('#qualitySegment button').forEach((btn) => {
      btn.addEventListener('click', () => this.setQualityMode(btn.dataset.quality));
    });

    document.querySelectorAll('#fpsSegment button').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.targetFps = Number(btn.dataset.fps) || 60;
        document.querySelectorAll('#fpsSegment button').forEach((b) => {
          b.classList.toggle('is-active', b === btn);
        });
        this.showToast(`FRAME RATE TARGET · ${this.targetFps} FPS`);
      });
    });

    document.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.toggle;
        this.effects[key] = !this.effects[key];
        this.applyEffects();
        this.refreshToggleUI();
      });
    });

    document.querySelectorAll('[data-audio]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.audio;
        const on = !btn.classList.contains('is-on');
        btn.classList.toggle('is-on', on);
        if (key === 'music') this.audio.setMusicEnabled(on);
        if (key === 'ambient') this.audio.setAmbientEnabled(on);
        if (key === 'sfx') this.audio.setSfxEnabled(on);
        this.showToast(`${key.toUpperCase()} ${on ? 'ON' : 'OFF'}`);
      });
    });

    document.getElementById('volumeSlider').addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      this.audio.setVolume(v);
      this.audio.setMuted(v === 0);
    });

    document.querySelectorAll('.shape-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedShape = btn.dataset.shape;
        document.querySelectorAll('.shape-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });

    document.querySelectorAll('.swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedColor = btn.dataset.color;
        document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('is-active', b === btn));
        document.querySelector('.color-custom').style.borderColor = 'rgba(255,255,255,0.11)';
      });
    });

    document.getElementById('customColor').addEventListener('input', (e) => {
      this.selectedColor = e.target.value;
      document.querySelectorAll('.swatch').forEach((b) => b.classList.remove('is-active'));
      document.querySelector('.color-custom').style.borderColor = this.selectedColor;
    });

    document.getElementById('delaySlider').addEventListener('input', (e) => {
      this.burstDelay = Number(e.target.value);
      document.getElementById('delayValue').textContent = `${this.burstDelay.toFixed(1)}s`;
    });

    document.getElementById('fireNowBtn').addEventListener('click', () => {
      this.ensureAudio();
      this.fireworks.spawn({
        type: this.selectedShape,
        color: this.selectedColor,
        target: {
          x: (Math.random() - 0.5) * 100,
          y: 118 + Math.random() * 54,
          z: -100 - Math.random() * 50,
        },
        scale: this.selectedShape === 'mega' ? 1.3 : 1.06,
        slowmo: this.selectedShape === 'mega' || this.selectedShape === 'heart',
      });
      this.showToast(`✦ ${shapeLabel(this.selectedShape)} LAUNCHED`);
    });

    document.getElementById('addBurstBtn').addEventListener('click', () => this.addBurstToSequence());
    document.getElementById('clearSequenceBtn').addEventListener('click', () => {
      this.sequence = [];
      this.renderSequence();
      this.showToast('SEQUENCE CLEARED');
    });
    document.getElementById('playCustomBtn').addEventListener('click', () => {
      if (!this.sequence.length) return;
      this.closePanel();
      this.startShow({ customSequence: this.sequence });
    });
    document.getElementById('sequenceList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      this.sequence.splice(Number(btn.dataset.remove), 1);
      this.renderSequence();
    });

    document.getElementById('photoBtn').addEventListener('click', () => this.enterPhotoMode());
    document.getElementById('captureBtn').addEventListener('click', () => this.capturePhoto());
    document.getElementById('exitPhotoBtn').addEventListener('click', () => this.exitPhotoMode());
    document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());

    this.renderSequence();
    this.updateViewUI();
    this.refreshToggleUI();
  }

  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayback();
      } else if (e.key.toLowerCase() === 'r') {
        this.replayShow();
      } else if (e.key.toLowerCase() === 's') {
        this.toggleSlowmo();
      } else if (e.key.toLowerCase() === 'p') {
        if (this.photoMode) this.capturePhoto();
        else this.enterPhotoMode();
      } else if (e.key === 'Escape') {
        if (this.photoMode) this.exitPhotoMode();
        else this.closePanel();
      } else if (e.key.toLowerCase() === 'c') {
        this.openPanel('camera');
      } else if (/^[1-6]$/.test(e.key)) {
        const modes = ['free', 'festival', 'cinematic', 'city', 'lake', 'galaxy'];
        this.switchMode(modes[Number(e.key) - 1]);
      }
    });
  }

  bindGlobalEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 260));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.director?.playing && !this.paused) {
        // Stop scheduling delayed audio while the tab is in the background.
        this.audio.setPaused(true);
      } else if (!document.hidden) {
        this.audio.setPaused(this.paused);
      }
    });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener(
      'pointerdown',
      () => {
        this.hideHint();
        this.ensureAudio();
      },
      { once: true, passive: true },
    );
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.showToast('RENDERER PAUSED · RELOAD THE PAGE', 6000);
    });
    setTimeout(() => this.hideHint(), 7200);
  }

  ensureAudio() {
    if (!this.audio) return Promise.resolve(false);
    return this.audio.ensure().then((ok) => {
      if (ok) this.audio.startMusic();
      return ok;
    });
  }

  /* ------------------------------------------------------------------ */
  /* panels                                                              */
  /* ------------------------------------------------------------------ */

  openPanel(type) {
    const sheet = document.getElementById('sheet');
    const backdrop = document.getElementById('sheetBackdrop');
    const panels = ['camera', 'settings', 'custom'];
    panels.forEach((p) => {
      const el = document.getElementById(`${p}Panel`);
      if (el) el.hidden = p !== type;
    });
    const titles = {
      camera: ['CAMERA DECK', 'CAMERA'],
      settings: ['CONTROL DECK', 'SETTINGS'],
      custom: ['DIRECTOR’S DESK', 'CUSTOM SHOW'],
    };
    const title = titles[type] || titles.camera;
    document.getElementById('sheetEyebrow').textContent = title[0];
    document.getElementById('sheetTitle').textContent = title[1];
    sheet.classList.add('is-open');
    backdrop.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.querySelectorAll('[data-panel]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.panel === type);
    });
    document.getElementById('createBtn').classList.toggle('is-active', type === 'custom');
    this.updateViewUI();
    if (type === 'custom') this.renderSequence();
  }

  closePanel() {
    document.getElementById('sheet').classList.remove('is-open');
    document.getElementById('sheetBackdrop').classList.remove('is-open');
    document.getElementById('sheet').setAttribute('aria-hidden', 'true');
    document.querySelectorAll('[data-panel]').forEach((btn) => btn.classList.remove('is-active'));
    document.getElementById('createBtn').classList.remove('is-active');
  }

  updateViewUI() {
    if (!this.rig) return;
    document.querySelectorAll('#viewGrid .view-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.view === this.rig.mode);
    });
    const autoSwitch = document.getElementById('autoOrbitSwitch');
    autoSwitch.classList.toggle('is-on', this.rig.autoOrbit);
    autoSwitch.setAttribute('aria-pressed', String(this.rig.autoOrbit));
  }

  handleViewChange(info) {
    if (info.reason === 'drag') {
      this.cameraOverride = info.mode;
    }
    this.updateViewUI();
  }

  /* ------------------------------------------------------------------ */
  /* custom show                                                         */
  /* ------------------------------------------------------------------ */

  addBurstToSequence() {
    if (this.sequence.length >= 16) {
      this.showToast('SEQUENCE FULL · 16 CUES MAX');
      return;
    }
    this.sequence.push({
      type: this.selectedShape,
      color: this.selectedColor,
      delay: this.burstDelay,
    });
    this.renderSequence();
    this.showToast(`+ ${shapeLabel(this.selectedShape)} ADDED`);
  }

  renderSequence() {
    const list = document.getElementById('sequenceList');
    const count = document.getElementById('sequenceCount');
    const play = document.getElementById('playCustomBtn');
    if (!list) return;
    count.textContent = this.sequence.length;
    play.disabled = this.sequence.length === 0;
    if (!this.sequence.length) {
      list.innerHTML = `<div class="sequence-empty">No cues yet. Pick a shape, a color and add the first burst.</div>`;
      return;
    }
    list.innerHTML = this.sequence
      .map(
        (item, index) => `
        <div class="seq-chip" style="--chip-color:${item.color}">
          <i></i>
          <span>${String(index + 1).padStart(2, '0')} ${shapeLabel(item.type)}</span>
          <button type="button" data-remove="${index}" aria-label="Remove cue">×</button>
        </div>`,
      )
      .join('');
  }

  /* ------------------------------------------------------------------ */
  /* photo / video                                                       */
  /* ------------------------------------------------------------------ */

  enterPhotoMode() {
    if (this.photoMode) return;
    this.closePanel();
    this.photoMode = true;
    document.body.classList.add('photo-mode');
    this.showToast('PHOTO MODE · CLEAN FRAME');
  }

  exitPhotoMode() {
    this.photoMode = false;
    document.body.classList.remove('photo-mode');
    this.showToast('PHOTO MODE OFF');
  }

  capturePhoto() {
    try {
      this.postfx.render(0.016, this.simTime);
      const dataUrl = this.canvas.toDataURL('image/png');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      this.downloadDataUrl(dataUrl, `fireworks-3d-${stamp}.png`);
      this.flashScreen();
      this.showToast('PHOTO SAVED · PNG');
    } catch (error) {
      this.showToast('PHOTO CAPTURE FAILED');
    }
  }

  flashScreen() {
    const flash = document.createElement('div');
    flash.className = 'capture-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 340);
  }

  downloadDataUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    this.downloadDataUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async toggleRecording() {
    if (this.recording) {
      this.stopRecording();
      return;
    }
    if (!this.canvas.captureStream || !window.MediaRecorder) {
      this.showToast('VIDEO RECORDING IS NOT SUPPORTED ON THIS BROWSER', 3500);
      return;
    }
    await this.ensureAudio();
    try {
      const stream = this.canvas.captureStream(60);
      this.mediaStream = stream;
      const audioStream = this.audio.getStream();
      if (audioStream) {
        for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
      }
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
      this.mediaRecorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 9_000_000,
        audioBitsPerSecond: 128_000,
      });
      this.recChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) this.recChunks.push(event.data);
      };
      this.mediaRecorder.onstop = () => {
        const type = this.mediaRecorder?.mimeType || 'video/webm';
        const blob = new Blob(this.recChunks, { type });
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        this.downloadBlob(blob, `fireworks-3d-${stamp}.${ext}`);
        this.showToast('VIDEO SAVED · CLEAN CANVAS');
        this.recChunks = [];
        this.mediaRecorder = null;
        this.mediaStream?.getVideoTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      };
      this.mediaRecorder.start(900);
      this.recording = true;
      this.recStartedAt = performance.now();
      document.getElementById('recordBtn').classList.add('is-recording');
      document.getElementById('recordBtn').querySelector('span').textContent = 'STOP';
      document.getElementById('recBadge').classList.add('is-visible');
      this.updateRecTimer();
      this.recTimer = window.setInterval(() => this.updateRecTimer(), 500);
      this.showToast('RECORDING STARTED · CANVAS + 3D AUDIO');
    } catch (error) {
      this.showToast('RECORDING COULD NOT START');
    }
  }

  stopRecording() {
    if (!this.recording || !this.mediaRecorder) return;
    try {
      this.mediaRecorder.stop();
    } catch {
      /* ignore */
    }
    this.recording = false;
    if (this.recTimer) window.clearInterval(this.recTimer);
    this.recTimer = null;
    document.getElementById('recordBtn').classList.remove('is-recording');
    document.getElementById('recordBtn').querySelector('span').textContent = 'REC';
    document.getElementById('recBadge').classList.remove('is-visible');
  }

  updateRecTimer() {
    const elapsed = Math.floor((performance.now() - this.recStartedAt) / 1000);
    document.getElementById('recTime').textContent = this.formatTime(elapsed);
  }

  /* ------------------------------------------------------------------ */
  /* utility                                                             */
  /* ------------------------------------------------------------------ */

  hideLoader() {
    document.getElementById('loader')?.classList.add('is-done');
    document.body.dataset.ready = 'true';
  }

  hideHint() {
    document.getElementById('hint')?.classList.add('is-hidden');
  }

  showToast(message, duration = 2300) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      this.toastTimer = null;
    }, duration);
  }

  showFatal(error) {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.innerHTML = `<div class="loader-title">WEBGL UNAVAILABLE</div><div class="loader-sub" style="max-width:280px;text-align:center;line-height:1.8">THIS DEVICE COULD NOT START THE 3D ENGINE.<br>PLEASE ENABLE HARDWARE ACCELERATION.</div>`;
    }
    console.error(error);
  }

  exposeDebugApi() {
    window.FIREWORKS = {
      app: this,
      start: () => this.startShow(),
      pause: () => this.pauseShow(),
      resume: () => this.resumeShow(),
      replay: () => this.replayShow(),
      mode: (mode) => this.switchMode(mode),
      spawn: (type = 'peony', color = '#ffd08a') =>
        this.fireworks.spawn({
          type,
          color,
          target: {
            x: (Math.random() - 0.5) * 90,
            y: 120 + Math.random() * 40,
            z: -110,
          },
          scale: 1.1,
        }),
      capture: () => this.capturePhoto(),
      photoMode: (on) => (on ? this.enterPhotoMode() : this.exitPhotoMode()),
      sparkle: () => this.previewModeBurst(),
      state: () => ({
        mode: this.mode,
        quality: this.resolvedQuality,
        fps: this.fpsValue,
        playing: this.director?.playing,
        paused: this.paused,
        particles: this.fireworks?.particleCount,
        camera: this.rig?.mode,
        showProgress: this.director?.getTickState()?.progress,
      }),
    };
  }
}

new FireworksApp();
