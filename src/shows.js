import { FIREWORK_SHAPES } from './fireworks.js';

export const MODES = {
  free: {
    label: 'FREE MODE',
    short: 'FREE',
    title: 'OPEN SKY',
    subtitle: 'No rules. Just light, lake and a sky full of possibility.',
    location: 'MIRROR LAKE · SECTOR 7',
    theme: 'free',
    palette: ['#ffd27a', '#ff6f9c', '#7ef9ff', '#b58cff', '#ffffff'],
  },
  festival: {
    label: 'FESTIVAL MODE',
    short: 'FESTIVAL',
    title: 'RIVER OF FIRE',
    subtitle: 'Gold, crimson and a thousand voices under one sky.',
    location: 'RIVERFEST GROUNDS · 23:48',
    theme: 'festival',
    palette: ['#ff5f6d', '#ffd27a', '#ff875f', '#ffffff', '#ffb347'],
  },
  cinematic: {
    label: 'CINEMATIC MODE',
    short: 'CINEMATIC',
    title: 'MIDNIGHT OVERTURE',
    subtitle: 'A slow, widescreen ballet of light and silence.',
    location: 'CINE DECK · 35MM',
    theme: 'cinematic',
    palette: ['#fff1cf', '#ff6f9c', '#b58cff', '#8fd8ff', '#ffd27a'],
  },
  city: {
    label: 'NIGHT CITY MODE',
    short: 'NIGHT CITY',
    title: 'CITY AFTER DARK',
    subtitle: 'A skyline breathing in neon while the heavens answer back.',
    location: 'NEO HARBOR · DISTRICT 09',
    theme: 'city',
    palette: ['#ffb347', '#7ef9ff', '#ff5f8f', '#ffffff', '#6e9bff'],
  },
  lake: {
    label: 'LAKE MODE',
    short: 'LAKE',
    title: 'MIRROR BLOOM',
    subtitle: 'Twice the fire, twice the sky — mirrored on still water.',
    location: 'MIRROR LAKE · NORTH PIER',
    theme: 'lake',
    palette: ['#7ef9ff', '#ffffff', '#b58cff', '#ffd27a', '#6e9bff'],
  },
  galaxy: {
    label: 'GALAXY MODE',
    short: 'GALAXY',
    title: 'ORION BLOOM',
    subtitle: 'Fireworks at the edge of a galaxy, where the night turns violet.',
    location: 'ORION RIDGE · OBSERVATORY',
    theme: 'galaxy',
    palette: ['#b58cff', '#7ef9ff', '#ffffff', '#ff6f9c', '#9dff7a'],
  },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeRng(mode) {
  const base = {
    free: 913,
    festival: 2203,
    cinematic: 771,
    city: 1551,
    lake: 4409,
    galaxy: 9001,
    custom: 313,
  }[mode] || 101;
  return seededRandom(base + Math.floor(Date.now() / 1000) % 197);
}

function target(rng, opts = {}) {
  return {
    x: opts.x ?? (rng() - 0.5) * (opts.spread ?? 190),
    y: opts.y ?? 100 + rng() * (opts.height ?? 72),
    z: opts.z ?? -110 - rng() * (opts.depth ?? 90),
  };
}

function cue(at, type, color, targetPos, scale = 1, extra = {}) {
  return {
    at,
    type,
    color,
    target: targetPos,
    scale,
    slowmo: !!extra.slowmo,
    color2: extra.color2,
    label: extra.label,
  };
}

function finalShell(rng, palette, at, opts = {}) {
  const cues = [];
  const center = opts.center || [0, 128, -120];
  const spread = opts.spread ?? 90;
  const colors = palette;
  cues.push(cue(at, 'mega', colors[0], { x: center[0] - spread * 0.55, y: center[1] + 18, z: center[2] - 15 }, 1.52, { slowmo: true, label: 'MEGA SKY' }));
  cues.push(cue(at + 0.05, 'multi', colors[1] || colors[0], { x: center[0] + spread * 0.55, y: center[1] + 6, z: center[2] + 6 }, 1.32, { slowmo: true }));
  if (opts.thunder !== false) {
    cues.push(cue(at + 1.4, 'willow', colors[2] || colors[0], { x: center[0], y: center[1] + 34, z: center[2] - 32 }, 1.45, { slowmo: true }));
    cues.push(cue(at + 2.2, 'rainbow', colors[3] || colors[0], { x: center[0] + 30, y: center[1] + 10, z: center[2] - 55 }, 1.05));
  }
  return cues;
}

export function buildShow(mode) {
  const rng = makeRng(mode);
  const info = MODES[mode] || MODES.free;
  const p = info.palette;
  const cues = [];
  let duration = 48;

  if (mode === 'free') {
    duration = 52;
    cues.push(cue(0.2, 'peony', p[0], target(rng, { y: 118, spread: 120 }), 1.05));
    cues.push(cue(4.2, 'ring', p[2], target(rng, { y: 130 }), 1.0));
    cues.push(cue(7.6, 'willow', p[0], target(rng, { y: 142 }), 1.1));
    cues.push(cue(11.2, 'heart', p[1], target(rng, { y: 126, spread: 70 }), 1.05, { slowmo: false }));
    cues.push(cue(14.4, 'star', p[2], target(rng, { y: 138 }), 1.0));
    cues.push(cue(17.4, 'chrysanthemum', p[3], target(rng, { y: 150 }), 1.05));
    cues.push(cue(20.4, 'glitter', p[0], target(rng, { y: 128 }), 1.0));
    cues.push(cue(23.2, 'rainbow', p[1], target(rng, { y: 148, spread: 130 }), 1.08));
    cues.push(cue(26.2, 'multi', p[2], target(rng, { y: 142 }), 1.15));
    cues.push(cue(29.0, 'peony', p[4], target(rng, { y: 122 }), 0.92));
    cues.push(cue(30.4, 'peony', p[1], target(rng, { y: 144 }), 0.9));
    cues.push(cue(33.0, 'willow', p[0], target(rng, { y: 154 }), 1.2, { slowmo: true }));
    cues.push(cue(36.2, 'ring', p[3], target(rng, { y: 132 }), 1.0));
    cues.push(cue(38.8, 'star', p[2], target(rng, { y: 148 }), 1.05));
    cues.push(cue(41.2, 'heart', p[1], target(rng, { y: 140, spread: 60 }), 1.18, { slowmo: true }));
    cues.push(...finalShell(rng, p, 43.6, { center: [0, 142, -120], spread: 96 }));
  } else if (mode === 'festival') {
    duration = 41;
    for (let i = 0; i < 3; i++) {
      cues.push(cue(0.2 + i * 0.18, i === 1 ? 'ring' : 'peony', p[i % 3], target(rng, { x: (i - 1) * 88, y: 126 + i * 8, spread: 25 }), 1.15));
    }
    cues.push(cue(4.0, 'chrysanthemum', p[1], target(rng, { y: 146 }), 1.1));
    cues.push(cue(6.8, 'willow', p[2], target(rng, { y: 154, spread: 130 }), 1.2));
    cues.push(cue(9.2, 'heart', p[0], target(rng, { y: 132, spread: 70 }), 1.05));
    cues.push(cue(9.2, 'heart', p[3], target(rng, { y: 132, spread: 70 }), 1.0));
    cues.push(cue(12.2, 'multi', p[0], target(rng, { y: 150 }), 1.18));
    cues.push(cue(15.2, 'peony', p[1], target(rng, { y: 122, spread: 150 }), 0.96));
    cues.push(cue(15.6, 'peony', p[4], target(rng, { y: 146, spread: 150 }), 0.96));
    cues.push(cue(18.4, 'rainbow', p[2], target(rng, { y: 156, spread: 120 }), 1.12));
    cues.push(cue(21.2, 'glitter', p[0], target(rng, { y: 132 }), 1.1));
    cues.push(cue(23.2, 'star', p[3], target(rng, { y: 146 }), 1.05));
    cues.push(cue(25.6, 'willow', p[1], target(rng, { y: 158 }), 1.2, { slowmo: true }));
    cues.push(cue(27.6, 'ring', p[2], target(rng, { y: 136 }), 1.05));
    cues.push(cue(29.0, 'chrysanthemum', p[0], target(rng, { y: 150 }), 1.06));
    cues.push(...finalShell(rng, p, 31.0, { center: [0, 143, -130], spread: 110 }));
    duration = 42;
  } else if (mode === 'cinematic') {
    duration = 49;
    cues.push(cue(1.0, 'peony', p[0], target(rng, { y: 116, spread: 80 }), 0.9));
    cues.push(cue(6.2, 'chrysanthemum', p[3], target(rng, { y: 140, spread: 70 }), 0.94));
    cues.push(cue(11.6, 'heart', p[1], target(rng, { y: 128, spread: 46 }), 1.2, { slowmo: true }));
    cues.push(cue(17.6, 'ring', p[4], target(rng, { y: 142, spread: 52 }), 1.1, { slowmo: true }));
    cues.push(cue(23.0, 'willow', p[0], target(rng, { y: 152, spread: 90 }), 1.16));
    cues.push(cue(28.4, 'star', p[2], target(rng, { y: 132, spread: 54 }), 1.08));
    cues.push(cue(33.0, 'multi', p[1], target(rng, { y: 150, spread: 82 }), 1.25, { slowmo: true }));
    cues.push(cue(38.0, 'rainbow', p[3], target(rng, { y: 148, spread: 100 }), 1.15));
    cues.push(...finalShell(rng, p, 41.4, { center: [0, 146, -125], spread: 88, thunder: true }));
  } else if (mode === 'city') {
    duration = 41;
    cues.push(cue(0.6, 'peony', p[0], target(rng, { y: 112, spread: 160, depth: 70 }), 1.05));
    cues.push(cue(3.2, 'ring', p[1], target(rng, { y: 126, spread: 170 }), 1.0));
    cues.push(cue(5.8, 'chrysanthemum', p[2], target(rng, { y: 140, spread: 150 }), 1.02));
    cues.push(cue(8.2, 'peony', p[3], target(rng, { y: 120, spread: 210 }), 0.9));
    cues.push(cue(8.4, 'peony', p[0], target(rng, { x: 40, y: 138, spread: 20 }), 0.9));
    cues.push(cue(11.6, 'multi', p[4], target(rng, { y: 136 }), 1.13));
    cues.push(cue(14.4, 'glitter', p[1], target(rng, { y: 150 }), 1.05));
    cues.push(cue(17.0, 'heart', p[2], target(rng, { y: 124, spread: 60 }), 1.1));
    cues.push(cue(20.2, 'willow', p[0], target(rng, { y: 144 }), 1.15));
    cues.push(cue(23.2, 'star', p[1], target(rng, { y: 152 }), 1.05));
    cues.push(cue(26.2, 'rainbow', p[4], target(rng, { y: 146, spread: 140 }), 1.1));
    cues.push(cue(29.0, 'chrysanthemum', p[2], target(rng, { y: 132 }), 1.04));
    cues.push(...finalShell(rng, p, 31.4, { center: [0, 143, -115], spread: 112 }));
    duration = 42;
  } else if (mode === 'lake') {
    duration = 45;
    const mirrored = (type, color, y, spread, scale) => {
      const z = -110 - rng() * 70;
      cues.push(cue(0, type, color, { x: -spread, y, z }, scale));
      cues.push(cue(0.05, type, color, { x: spread, y, z }, scale));
    };
    const at = [];
    let t = 0.5;
    for (let i = 0; i < 8; i++) {
      t += 3.1;
      at.push(t);
    }
    const base = cue(0, 'peony', p[0], { x: 0, y: 128, z: -110 }, 1.08);
    cues.push(base);
    let idx = 0;
    mirrored('ring', p[1], 132, 62, 1.02);
    cues[cues.length - 2].at = at[idx++];
    cues[cues.length - 1].at = at[idx - 1] + 0.08;
    mirrored('heart', p[3], 128, 47, 1.12);
    cues[cues.length - 2].at = at[idx++];
    cues[cues.length - 1].at = at[idx - 1] + 0.08;
    mirrored('willow', p[0], 150, 80, 1.16);
    cues[cues.length - 2].at = at[idx++];
    cues[cues.length - 1].at = at[idx - 1] + 0.08;
    mirrored('star', p[2], 142, 56, 1.06);
    cues[cues.length - 2].at = at[idx++];
    cues[cues.length - 1].at = at[idx - 1] + 0.08;
    mirrored('chrysanthemum', p[4], 146, 70, 1.06);
    cues[cues.length - 2].at = at[idx++];
    cues[cues.length - 1].at = at[idx - 1] + 0.08;
    mirrored('glitter', p[1], 132, 48, 1.04);
    cues[cues.length - 2].at = at[idx++];
    cues[cues.length - 1].at = at[idx - 1] + 0.08;
    mirrored('rainbow', p[2], 152, 76, 1.08);
    cues[cues.length - 2].at = at[idx++];
    cues[cues.length - 1].at = at[idx - 1] + 0.08;
    cues.push(...finalShell(rng, p, at[7] + 2.8, { center: [0, 150, -120], spread: 100 }));
    duration = 46;
  } else if (mode === 'galaxy') {
    duration = 48;
    cues.push(cue(0.4, 'ring', p[2], target(rng, { y: 128, spread: 120 }), 1.0));
    cues.push(cue(3.2, 'chrysanthemum', p[0], target(rng, { y: 150, spread: 140 }), 1.1));
    cues.push(cue(6.4, 'heart', p[3], target(rng, { y: 130, spread: 60 }), 1.12));
    cues.push(cue(9.4, 'star', p[1], target(rng, { y: 148, spread: 90 }), 1.1));
    cues.push(cue(12.2, 'willow', p[0], target(rng, { y: 158 }), 1.2, { slowmo: true }));
    cues.push(cue(15.4, 'multi', p[2], target(rng, { y: 145 }), 1.2));
    cues.push(cue(18.4, 'glitter', p[1], target(rng, { y: 136 }), 1.0));
    cues.push(cue(21.4, 'rainbow', p[0], target(rng, { y: 152, spread: 140 }), 1.15));
    cues.push(cue(24.5, 'ring', p[3], target(rng, { y: 138 }), 1.1));
    cues.push(cue(27.4, 'heart', p[1], target(rng, { y: 132, spread: 80 }), 1.18, { slowmo: true }));
    cues.push(cue(31.0, 'star', p[2], target(rng, { y: 154 }), 1.08));
    cues.push(cue(34.0, 'chrysanthemum', p[0], target(rng, { y: 144 }), 1.08));
    cues.push(...finalShell(rng, p, 37.0, { center: [0, 146, -124], spread: 118 }));
    duration = 49;
  } else {
    duration = 48;
  }

  cues.sort((a, b) => a.at - b.at);
  return {
    mode,
    cues,
    duration,
    info,
  };
}

export function buildCustomShow(sequence) {
  const cues = [];
  let at = 0.15;
  sequence.forEach((item, index) => {
    at += index === 0 ? 0 : item.delay;
    const rng = seededRandom(8600 + index * 97 + Math.floor(performance.now()));
    const pos = {
      x: (rng() - 0.5) * 150,
      y: 108 + rng() * 58,
      z: -110 - rng() * 65,
    };
    if (index % 3 === 0) {
      pos.x *= 0.3;
      pos.y += 14;
    }
    cues.push({
      at,
      type: item.type,
      color: item.color,
      target: pos,
      scale: item.type === 'mega' ? 1.25 : 1,
      slowmo: item.type === 'mega' || item.type === 'heart' || item.type === 'willow',
      label: item.type,
    });
  });
  const last = cues[cues.length - 1]?.at || 0;
  return {
    mode: 'custom',
    cues,
    duration: last + 6,
    info: {
      label: 'CUSTOM SHOW',
      short: 'CUSTOM',
      title: 'YOUR SKY',
      subtitle: 'Every burst chosen by you. Press play and make it real.',
      location: 'CUSTOM STAGE · MIRROR LAKE',
      theme: 'free',
      palette: sequence.map((s) => s.color),
    },
  };
}

export class ShowDirector {
  constructor(callbacks = {}) {
    this.onCue = callbacks.onCue || (() => {});
    this.onState = callbacks.onState || (() => {});
    this.onTick = callbacks.onTick || (() => {});
    this.onEnd = callbacks.onEnd || (() => {});
    this.mode = 'free';
    this.show = null;
    this.cues = [];
    this.elapsed = 0;
    this.nextIndex = 0;
    this.duration = 1;
    this.playing = false;
    this.paused = false;
    this.ended = false;
    this.customSequence = null;
  }

  start(mode = null, options = {}) {
    if (options.customSequence) {
      this.customSequence = options.customSequence.map((x) => ({ ...x }));
      this.mode = 'custom';
      this.show = buildCustomShow(this.customSequence);
    } else {
      if (mode) this.mode = mode;
      if (this.mode === 'custom' && this.customSequence) {
        this.show = buildCustomShow(this.customSequence);
      } else {
        this.customSequence = null;
        this.show = buildShow(this.mode);
      }
    }
    this.cues = this.show.cues;
    this.duration = this.show.duration;
    this.elapsed = 0;
    this.nextIndex = 0;
    this.playing = true;
    this.paused = false;
    this.ended = false;
    this.onState({ playing: true, paused: false, ended: false, show: this.show, mode: this.mode });
    this.onTick(this.getTickState());
    this.dispatchReadyCues();
  }

  dispatchReadyCues() {
    while (this.nextIndex < this.cues.length && this.cues[this.nextIndex].at <= this.elapsed) {
      this.onCue(this.cues[this.nextIndex], this.nextIndex);
      this.nextIndex++;
    }
  }

  update(dt) {
    if (!this.playing || this.paused || this.ended) return;
    this.elapsed += dt;
    this.dispatchReadyCues();
    this.onTick(this.getTickState());
    if (this.elapsed >= this.duration && this.nextIndex >= this.cues.length) {
      this.ended = true;
      this.playing = false;
      this.onState({ playing: false, paused: false, ended: true, show: this.show, mode: this.mode });
      this.onEnd({ show: this.show, mode: this.mode });
    }
  }

  getTickState() {
    return {
      elapsed: this.elapsed,
      duration: this.duration,
      progress: clamp(this.elapsed / Math.max(0.001, this.duration), 0, 1),
      playing: this.playing,
      paused: this.paused,
      ended: this.ended,
      mode: this.mode,
    };
  }

  pause() {
    if (!this.playing || this.paused) return;
    this.paused = true;
    this.onState({ playing: true, paused: true, ended: false, show: this.show, mode: this.mode });
  }

  resume() {
    if (!this.playing || !this.paused) return;
    this.paused = false;
    this.onState({ playing: true, paused: false, ended: false, show: this.show, mode: this.mode });
  }

  toggle() {
    if (this.playing && !this.paused) this.pause();
    else if (this.playing && this.paused) this.resume();
  }

  replay() {
    if (this.mode === 'custom' && this.customSequence) {
      this.start('custom', { customSequence: this.customSequence });
    } else {
      this.start(this.mode);
    }
  }

  stop() {
    this.playing = false;
    this.paused = false;
    this.ended = true;
    this.onState({ playing: false, paused: false, ended: true, show: this.show, mode: this.mode });
  }

  forceCue(cueData) {
    this.onCue(cueData, -1);
  }
}

export function shapeLabel(type) {
  return FIREWORK_SHAPES[type]?.label || type.toUpperCase();
}
