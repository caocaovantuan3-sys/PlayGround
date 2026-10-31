import * as THREE from 'three';

const midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const CHORDS = [
  [50, 53, 57, 62], // D minor
  [46, 50, 53, 58], // B flat
  [41, 45, 48, 53], // F
  [43, 47, 50, 55], // C
];

const ARP_PATTERN = [0, 2, 1, 3, 2, 1, 3, 2];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = 0.72;
    this.musicEnabled = true;
    this.ambientEnabled = true;
    this.sfxEnabled = true;
    this.musicOn = false;
    this.paused = false;
    this.pendingTimers = new Set();
    this.schedulerId = null;
    this.nextBarTime = 0;
    this.barIndex = 0;
    this.ambientStarted = false;
    this.chirpTimer = null;
    this._tmpForward = new THREE.Vector3();
    this._tmpUp = new THREE.Vector3();
    this.streamDest = null;
    this.impulse = null;
    this.noiseBuffer = null;
    this.lastCameraPosition = new THREE.Vector3();
  }

  async ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        try {
          await this.ctx.resume();
        } catch {
          /* ignore */
        }
      }
      return true;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    const ctx = new Context({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 5;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.24;

    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.streamDest = ctx.createMediaStreamDestination();
    this.limiter.connect(this.streamDest);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicEnabled ? 0.5 : 0;
    this.musicBus.connect(this.master);

    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = this.ambientEnabled ? 0.42 : 0;
    this.ambientBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.impulse = this.createImpulse(ctx, 3.4, 2.7);
    this.reverb.buffer = this.impulse;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.34;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.master);

    this.noiseBuffer = this.createNoiseBuffer(ctx, 3);

    this.ready = true;
    this.startAmbient();
    if (this.musicOn) this.startMusic();
    return true;
  }

  createImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const early = i < rate * 0.08 ? (Math.random() * 2 - 1) * 0.22 : 0;
        const env = Math.pow(1 - t, decay);
        const comb = Math.sin(i * 0.0013) * 0.15 + Math.sin(i * 0.0027 + ch) * 0.08;
        data[i] = ((Math.random() * 2 - 1) * 0.9 + early + comb) * env;
      }
    }
    return buffer;
  }

  createNoiseBuffer(ctx, seconds) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.88 + white * 0.12;
      data[i] = white * 0.65 + last * 0.8;
    }
    return buffer;
  }

  startAmbient() {
    if (!this.ready || this.ambientStarted) return;
    this.ambientStarted = true;
    const ctx = this.ctx;

    // Soft night wind.
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 0.5;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.04;
    wind.connect(windFilter).connect(windGain).connect(this.ambientBus);
    wind.start();

    const rumbleOsc = ctx.createOscillator();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.value = 46;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.008;
    rumbleOsc.connect(rumbleGain).connect(this.ambientBus);
    rumbleOsc.start();

    // Distant shore shimmer.
    const shimmer = ctx.createOscillator();
    shimmer.type = 'triangle';
    shimmer.frequency.value = 118;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.0026;
    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.frequency.value = 0.095;
    const shimmerLfoGain = ctx.createGain();
    shimmerLfoGain.gain.value = 18;
    shimmerLfo.connect(shimmerLfoGain).connect(shimmer.frequency);
    shimmer.connect(shimmerGain).connect(this.ambientBus);
    shimmer.start();
    shimmerLfo.start();

    const scheduleChirp = () => {
      if (!this.ready) return;
      if (this.ambientEnabled && !this.paused) this.chirp();
      this.chirpTimer = window.setTimeout(scheduleChirp, 2100 + Math.random() * 5600);
    };
    this.chirpTimer = window.setTimeout(scheduleChirp, 1800);
  }

  chirp() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime + Math.random() * 0.1;
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 25;
    panner.rolloffFactor = 1.5;
    panner.positionX.value = -180 + Math.random() * 360;
    panner.positionY.value = 2 + Math.random() * 3;
    panner.positionZ.value = 40 + Math.random() * 120;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const base = 2900 + Math.random() * 1500;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.18, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(base * 0.94, now + 0.11);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.007 + Math.random() * 0.006, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain).connect(panner).connect(this.ambientBus);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  startMusic() {
    this.musicOn = true;
    if (!this.ready) return;
    if (this.schedulerId) return;
    this.nextBarTime = this.ctx.currentTime + 0.18;
    this.barIndex = 0;
    this.schedulerId = window.setInterval(() => this.scheduleMusic(), 150);
    this.scheduleMusic();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.schedulerId) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  scheduleMusic() {
    if (!this.ready || !this.musicOn) return;
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    while (this.nextBarTime < now + 0.6) {
      this.scheduleBar(this.nextBarTime, this.barIndex);
      this.nextBarTime += 3.25;
      this.barIndex = (this.barIndex + 1) % CHORDS.length;
    }
  }

  scheduleBar(start, index) {
    const ctx = this.ctx;
    const chord = CHORDS[index];
    const bar = 3.25;

    // Cinematic pad: gently detuned saw pair, filtered.
    chord.forEach((midi, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(680 + i * 40, start);
      filter.frequency.linearRampToValueAtTime(1080 + i * 30, start + bar * 0.55);
      filter.frequency.linearRampToValueAtTime(600, start + bar);
      filter.Q.value = 0.65;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.0056, start + 1.15);
      gain.gain.linearRampToValueAtTime(0.004, start + bar * 0.72);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + bar - 0.08);
      filter.connect(gain).connect(this.musicBus);
      gain.connect(this.reverbSend);

      for (const detune of [-5 + i, 6 - i]) {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sawtooth';
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(start);
        osc.stop(start + bar);
      }
    });

    // Low root.
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(midiToHz(chord[0] - 12), start);
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.0001, start);
    bassGain.gain.linearRampToValueAtTime(0.026, start + 0.16);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, start + bar * 0.92);
    bass.connect(bassGain).connect(this.musicBus);
    bass.start(start);
    bass.stop(start + bar);

    // Glassy arpeggio.
    const step = bar / 8;
    ARP_PATTERN.forEach((noteIndex, i) => {
      if (i === 0 && index % 2 === 1) return;
      const t = start + i * step;
      const midi = chord[noteIndex % chord.length] + (i > 4 ? 24 : 12);
      this.pluck(midiToHz(midi), t, 0.34, 0.0072, this.musicBus);
    });

    // Soft timpani at the start of each bar.
    if (index % 2 === 0) {
      this.kick(start, 0.055);
    }
    // Brushed air texture at the end of the phrase.
    if (index === CHORDS.length - 1) {
      this.airSweep(start + bar * 0.3, bar * 0.62, 0.016);
    }
  }

  pluck(freq, time, duration, volume, destination) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(destination || this.musicBus);
    if (destination !== this.musicBus) gain.connect(this.reverbSend);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  kick(time, volume = 0.06) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(72, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.24);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);
    osc.connect(gain).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.65);
  }

  airSweep(time, duration, volume) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(480, time);
    filter.frequency.linearRampToValueAtTime(1800, time + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + duration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    noise.connect(filter).connect(gain).connect(this.musicBus);
    gain.connect(this.reverbSend);
    noise.start(time);
    noise.stop(time + duration + 0.05);
  }

  createPanner(position) {
    const ctx = this.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 70;
    panner.maxDistance = 2200;
    panner.rolloffFactor = 1.05;
    const t = ctx.currentTime;
    this.setPannerPosition(panner, position, t);
    panner.connect(this.sfxBus);
    panner.connect(this.reverbSend);
    return panner;
  }

  setPannerPosition(panner, position, time) {
    if (panner.positionX) {
      panner.positionX.setValueAtTime(position.x, time);
      panner.positionY.setValueAtTime(position.y, time);
      panner.positionZ.setValueAtTime(position.z, time);
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
  }

  launch(position) {
    if (!this.ready || !this.sfxEnabled || this.paused) return;
    const ctx = this.ctx;
    const panner = this.createPanner(position);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(1250, now + 0.7);
    osc.frequency.exponentialRampToValueAtTime(680, now + 1.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.004, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
    osc.connect(gain).connect(panner);
    osc.start(now);
    osc.stop(now + 1.3);
  }

  boom(position, power = 1) {
    if (!this.ready || !this.sfxEnabled || this.paused) return;
    const camera = this.lastCameraPosition;
    const distance = camera.distanceTo(position);
    const delayMs = Math.min(1000, (distance / 343) * 1000);
    const timer = window.setTimeout(() => {
      this.pendingTimers.delete(timer);
      if (!this.ready || this.paused) return;
      this.playBoom(position, power);
    }, delayMs);
    this.pendingTimers.add(timer);
  }

  playBoom(position, power) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const panner = this.createPanner(position);
    const volume = Math.min(0.5, 0.16 * Math.pow(power, 0.72));

    // Main body: filtered noise burst.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.playbackRate.value = 0.6 + Math.random() * 0.15;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800 + power * 500, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 1.4);
    filter.Q.value = 0.9;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    noiseGain.gain.exponentialRampToValueAtTime(volume * 0.22, now + 0.48);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    noise.connect(filter).connect(noiseGain).connect(panner);
    noise.start(now);
    noise.stop(now + 2.3);

    // Sub boom.
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(72 + Math.random() * 14, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.8);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.exponentialRampToValueAtTime(volume * 1.05, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
    sub.connect(subGain).connect(panner);
    sub.start(now);
    sub.stop(now + 1.4);

    // Crackle tail.
    const crackle = ctx.createBufferSource();
    crackle.buffer = this.noiseBuffer;
    crackle.loop = true;
    crackle.playbackRate.value = 1.8;
    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'highpass';
    crackleFilter.frequency.value = 2600;
    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(0.0001, now + 0.12);
    crackleGain.gain.linearRampToValueAtTime(volume * 0.11, now + 0.22);
    crackleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
    crackle.connect(crackleFilter).connect(crackleGain).connect(panner);
    crackle.start(now + 0.1);
    crackle.stop(now + 1.8);

    // A few bright embers pop after the initial blast.
    for (let i = 0; i < 5; i++) {
      const t = now + 0.18 + Math.random() * 0.8;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900 + Math.random() * 1500, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.005 + Math.random() * 0.005, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      osc.connect(g).connect(panner);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  updateListener(camera) {
    if (!this.ready) return;
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    const listener = ctx.listener;
    const p = camera.position;
    const t = ctx.currentTime;
    this.lastCameraPosition.copy(p);
    if (listener.positionX) {
      listener.positionX.setValueAtTime(p.x, t);
      listener.positionY.setValueAtTime(p.y, t);
      listener.positionZ.setValueAtTime(p.z, t);
    } else {
      listener.setPosition(p.x, p.y, p.z);
    }
    camera.getWorldDirection(this._tmpForward);
    this._tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (listener.forwardX) {
      listener.forwardX.setValueAtTime(this._tmpForward.x, t);
      listener.forwardY.setValueAtTime(this._tmpForward.y, t);
      listener.forwardZ.setValueAtTime(this._tmpForward.z, t);
      listener.upX.setValueAtTime(this._tmpUp.x, t);
      listener.upY.setValueAtTime(this._tmpUp.y, t);
      listener.upZ.setValueAtTime(this._tmpUp.z, t);
    } else {
      listener.setOrientation(
        this._tmpForward.x,
        this._tmpForward.y,
        this._tmpForward.z,
        this._tmpUp.x,
        this._tmpUp.y,
        this._tmpUp.z,
      );
    }
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) {
      for (const timer of this.pendingTimers) window.clearTimeout(timer);
      this.pendingTimers.clear();
    }
    if (this.musicBus && this.ctx) {
      const target = paused ? 0.12 : this.musicEnabled ? 0.5 : 0;
      this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicBus.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.35);
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime + 0.08);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this.setVolume(this.volume);
  }

  setMusicEnabled(on) {
    this.musicEnabled = on;
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.12);
    }
    if (on) this.startMusic();
  }

  setAmbientEnabled(on) {
    this.ambientEnabled = on;
    if (this.ambientBus && this.ctx) {
      this.ambientBus.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.12);
    }
    if (on) this.startAmbient();
  }

  setSfxEnabled(on) {
    this.sfxEnabled = on;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.08);
    }
  }

  getStream() {
    return this.streamDest?.stream || null;
  }

  destroy() {
    this.stopMusic();
    if (this.chirpTimer) window.clearTimeout(this.chirpTimer);
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
      this.ready = false;
    }
  }
}
