export class SoundEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.ambient = null
    this.peelNode = null
    this.ready = false
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.65
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 18
    comp.ratio.value = 4
    comp.attack.value = 0.003
    comp.release.value = 0.25
    this.master.connect(comp).connect(this.ctx.destination)
    this.noiseBuffer = this.makeNoise(3)
    this.ready = true
    this.startAmbient()
  }

  makeNoise(seconds = 2) {
    const length = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = 0.97 * last + 0.03 * white
      data[i] = white * 0.55 + last * 2.2
    }
    return buffer
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.04)
  }

  tone({ freq = 440, duration = 0.2, type = 'sine', gain = 0.1, attack = 0.005, decay = duration, detune = 0, delay = 0, pan = 0 }) {
    if (!this.ready || this.muted) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    const p = this.ctx.createStereoPanner()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.detune.setValueAtTime(detune, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    p.pan.value = pan
    osc.connect(g).connect(p).connect(this.master)
    osc.start(t)
    osc.stop(t + decay + 0.03)
  }

  noise({ duration = 0.3, gain = 0.08, type = 'bandpass', freq = 1200, q = 0.8, delay = 0, pan = 0, sweep = 0 }) {
    if (!this.ready || this.muted) return
    const t = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(freq, t)
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq + sweep), t + duration)
    filter.Q.value = q
    const g = this.ctx.createGain()
    const p = this.ctx.createStereoPanner()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, duration * 0.2))
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    p.pan.value = pan
    src.connect(filter).connect(g).connect(p).connect(this.master)
    src.start(t)
    src.stop(t + duration + 0.05)
  }

  click() {
    this.tone({ freq: 980, duration: 0.07, type: 'triangle', gain: 0.04 })
    this.tone({ freq: 1720, duration: 0.05, type: 'sine', gain: 0.018, delay: 0.01 })
  }

  hover() {
    this.tone({ freq: 1240, duration: 0.045, type: 'sine', gain: 0.012 })
  }

  thud() {
    this.tone({ freq: 92, duration: 0.45, type: 'sine', gain: 0.22, attack: 0.004, decay: 0.5 })
    this.tone({ freq: 56, duration: 0.6, type: 'sine', gain: 0.16, attack: 0.004, decay: 0.65 })
    this.noise({ duration: 0.16, gain: 0.055, type: 'lowpass', freq: 380 })
  }

  paper() {
    this.noise({ duration: 0.25, gain: 0.05, type: 'highpass', freq: 2600 })
    this.noise({ duration: 0.18, gain: 0.035, type: 'bandpass', freq: 1600, q: 1.4, delay: 0.05 })
  }

  lid() {
    this.noise({ duration: 0.5, gain: 0.035, type: 'bandpass', freq: 900, q: 0.8, sweep: 900 })
    this.tone({ freq: 210, duration: 0.3, type: 'sine', gain: 0.025, decay: 0.4 })
  }

  success() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => this.tone({ freq: f, duration: 0.65, type: 'sine', gain: 0.05, delay: i * 0.075, decay: 0.9 }))
  }

  sparkle() {
    const notes = [1320, 1760, 2093, 2637, 3136]
    notes.forEach((f, i) => this.tone({ freq: f, duration: 0.6, type: 'sine', gain: 0.026, delay: i * 0.045, decay: 0.8, pan: (i - 2) * 0.18 }))
    this.noise({ duration: 0.6, gain: 0.018, type: 'highpass', freq: 5200 })
  }

  boot() {
    this.tone({ freq: 110, duration: 1.2, type: 'sine', gain: 0.07, decay: 1.4 })
    const notes = [261.63, 329.63, 392, 523.25]
    notes.forEach((f, i) => this.tone({ freq: f, duration: 1.4, type: 'triangle', gain: 0.035, delay: i * 0.12, decay: 1.6 }))
    this.noise({ duration: 0.4, gain: 0.012, type: 'highpass', freq: 3200 })
  }

  shutter() {
    this.noise({ duration: 0.05, gain: 0.15, type: 'highpass', freq: 2400 })
    this.tone({ freq: 160, duration: 0.09, type: 'square', gain: 0.03 })
    this.noise({ duration: 0.07, gain: 0.1, type: 'bandpass', freq: 1200, delay: 0.075 })
  }

  swipe() {
    this.noise({ duration: 0.14, gain: 0.03, type: 'bandpass', freq: 1800, sweep: 1000 })
  }

  startPeel() {
    if (!this.ready || this.muted || this.peelNode) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1500
    filter.Q.value = 0.7
    const g = this.ctx.createGain()
    g.gain.value = 0.0001
    g.gain.setTargetAtTime(0.06, t, 0.04)
    const p = this.ctx.createStereoPanner()
    p.pan.value = 0
    src.connect(filter).connect(g).connect(p).connect(this.master)
    src.start(t)
    this.peelNode = { src, filter, g, p }
    this.peelTimer = setInterval(() => {
      if (!this.peelNode || this.muted) return
      const now = this.ctx.currentTime
      this.noise({ duration: 0.035, gain: 0.025 + Math.random() * 0.03, type: 'bandpass', freq: 2200 + Math.random() * 1800, q: 2 })
      this.tone({ freq: 300 + Math.random() * 240, duration: 0.03, type: 'square', gain: 0.004, delay: 0, pan: (Math.random() - 0.5) * 0.4 })
      this.peelNode.filter.frequency.setTargetAtTime(900 + Math.random() * 1600, now, 0.05)
    }, 55)
  }

  updatePeel(progress, pan = 0) {
    if (!this.peelNode) return
    const t = this.ctx.currentTime
    this.peelNode.g.gain.setTargetAtTime(0.035 + progress * 0.06, t, 0.04)
    this.peelNode.p.pan.setTargetAtTime(pan * 0.4, t, 0.05)
  }

  stopPeel() {
    if (!this.peelNode) return
    clearInterval(this.peelTimer)
    const t = this.ctx.currentTime
    this.peelNode.g.gain.setTargetAtTime(0.0001, t, 0.03)
    try { this.peelNode.src.stop(t + 0.25) } catch {}
    this.peelNode = null
  }

  startAmbient() {
    if (!this.ready || this.ambient) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 380
    filter.Q.value = 0.4
    const g = this.ctx.createGain()
    g.gain.value = 0.0001
    g.gain.setTargetAtTime(0.009, t, 1.2)
    src.connect(filter).connect(g).connect(this.master)
    src.start(t)
    this.ambient = { src, g, filter }
    const hum = this.ctx.createOscillator()
    const hg = this.ctx.createGain()
    hum.type = 'sine'
    hum.frequency.value = 58
    hg.gain.value = 0.001
    hum.connect(hg).connect(this.master)
    hum.start()
    this.ambientHum = { hum, hg }
  }

  setNight(night) {
    if (!this.ambient) return
    this.ambient.filter.frequency.setTargetAtTime(night ? 260 : 420, this.ctx.currentTime, 0.5)
    this.ambient.g.gain.setTargetAtTime(night ? 0.014 : 0.009, this.ctx.currentTime, 0.5)
  }
}
