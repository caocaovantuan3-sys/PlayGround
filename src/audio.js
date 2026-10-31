// Procedural WebAudio — no external assets, works offline.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = true;
    this.ambientStarted = false;
    this.last = {};
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.noiseBuf = this.makeNoise(2.2);
    this.startAmbient();
  }
  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.94 + w * 0.06;
      d[i] = last * 2.4;
    }
    return buf;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.035 : 0;
  }
  startAmbient() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const g = this.ctx.createGain(); g.gain.value = 0.055;
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.022;
    lfo.connect(lfoG).connect(g.gain); lfo.start();

    // low cinematic drone
    const mg = this.ctx.createGain(); mg.gain.value = this.musicOn ? 0.035 : 0;
    this.musicGain = mg;
    const lp2 = this.ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 180;
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.6;
    const o3 = this.ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 110;
    const g3 = this.ctx.createGain(); g3.gain.value = 0.28;
    o1.connect(lp2); o2.connect(lp2); o3.connect(g3).connect(lp2);
    lp2.connect(mg).connect(this.master);
    o1.start(); o2.start(); o3.start();
    const mlfo = this.ctx.createOscillator(); mlfo.frequency.value = 0.045;
    const mlg = this.ctx.createGain(); mlg.gain.value = 40;
    mlfo.connect(mlg).connect(lp2.frequency); mlfo.start();
  }
  env(gain, a, d, peak = 1) {
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  noise(dur = 0.2, filter = 'bandpass', freq = 900, q = 0.8, vol = 0.3) {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(); src.stop(t + dur + 0.05);
  }
  tone(freq, dur = 0.2, type = 'sine', vol = 0.2, slide = 1) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(); o.type = type;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(); o.stop(t + dur + 0.03);
  }
  play(name, opt = {}) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    const gate = { swing: 55, hit: 45, step: 220, ui: 40, slash: 60 }[name] || 30;
    if (this.last[name] && now - this.last[name] < gate) return;
    this.last[name] = now;
    switch (name) {
      case 'ui': this.tone(420, 0.06, 'triangle', 0.08, 1.4); break;
      case 'confirm': this.tone(330, 0.1, 'triangle', 0.1, 1.5); setTimeout(() => this.tone(660, 0.12, 'triangle', 0.07, 1.2), 55); break;
      case 'swing': this.noise(0.16, 'bandpass', 1400, 1.4, 0.22); break;
      case 'slash': this.noise(0.13, 'highpass', 1800, 1, 0.26); this.tone(240, 0.09, 'sawtooth', 0.08, 0.5); break;
      case 'hit': this.noise(0.09, 'lowpass', 700, 0.8, 0.34); this.tone(95, 0.12, 'square', 0.15, 0.6); break;
      case 'crit': this.noise(0.18, 'bandpass', 2100, 1, 0.4); this.tone(150, 0.25, 'sawtooth', 0.24, 0.35); break;
      case 'grapple': this.tone(720, 0.12, 'square', 0.1, 2.4); this.noise(0.1, 'highpass', 2600, 1, 0.14); break;
      case 'release': this.tone(540, 0.08, 'triangle', 0.07, 0.5); break;
      case 'jump': this.noise(0.14, 'highpass', 900, 0.7, 0.15); break;
      case 'land': this.noise(0.2, 'lowpass', 380, 0.8, 0.28); this.tone(62, 0.18, 'sine', 0.16, 0.6); break;
      case 'gas': this.noise(0.25, 'highpass', 1200, 0.5, 0.11); break;
      case 'hurt': this.tone(130, 0.3, 'sawtooth', 0.18, 0.45); this.noise(0.25, 'lowpass', 500, 0.7, 0.25); break;
      case 'roar': this.tone(72, 1.1, 'sawtooth', 0.2, 0.55); this.noise(1.0, 'lowpass', 320, 0.9, 0.24); break;
      case 'death': this.noise(1.2, 'lowpass', 600, 0.7, 0.22); this.tone(80, 1.0, 'sine', 0.1, 0.4); break;
      case 'coin': this.tone(880, 0.07, 'triangle', 0.09, 1.4); setTimeout(() => this.tone(1320, 0.1, 'triangle', 0.07, 1.1), 50); break;
      case 'upgrade': [440, 660, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.09, 1.1), i * 70)); break;
      case 'lock': this.tone(980, 0.06, 'square', 0.06, 0.7); setTimeout(() => this.tone(720, 0.06, 'square', 0.05, 0.7), 60); break;
      case 'wave': this.tone(180, 0.5, 'sawtooth', 0.12, 1.8); this.tone(90, 0.6, 'sine', 0.16, 1.2); break;
      case 'rescue': [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'sine', 0.08, 1.1), i * 90)); break;
      case 'dodge': this.noise(0.18, 'bandpass', 800, 0.7, 0.13); break;
      default: break;
    }
  }
  step() { this.play('step'); }
}
