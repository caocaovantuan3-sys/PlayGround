import { UPGRADES, RANKS } from './config.js';

const KEY = 'titan-slayer-save-v1';

function defaults() {
  const upgrades = {};
  for (const k of Object.keys(UPGRADES)) upgrades[k] = 0;
  return {
    version: 1,
    coins: 120,
    xp: 0,
    kills: 0,
    deaths: 0,
    missions: 0,
    bestSurvival: 0,
    bestSquad: 0,
    storyProgress: 0,
    storyDone: [],
    tutorialDone: false,
    upgrades,
    settings: {
      quality: 'high',
      fps: 60,
      sensitivity: 1,
      sound: true,
      music: true,
      vibration: true,
      invertY: false,
      showFps: true,
      shake: true,
      autoLock: true
    },
    seenIntro: false
  };
}

export const Save = {
  data: defaults(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return this.data;
      const parsed = JSON.parse(raw);
      const base = defaults();
      this.data = {
        ...base, ...parsed,
        upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
        settings: { ...base.settings, ...(parsed.settings || {}) },
        storyDone: Array.isArray(parsed.storyDone) ? parsed.storyDone : []
      };
      this.data.coins = Number(this.data.coins) || 0;
      this.data.xp = Number(this.data.xp) || 0;
    } catch (e) {
      console.warn('Save load failed', e);
      this.data = defaults();
    }
    return this.data;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ }
  },
  reset() {
    this.data = defaults();
    this.save();
  },
  get settings() { return this.data.settings; },
  get upgrades() { return this.data.upgrades; },
  upgradeCost(key) {
    const u = UPGRADES[key];
    const lvl = this.data.upgrades[key] || 0;
    return Math.round(u.baseCost * Math.pow(u.growth, lvl));
  },
  buy(key) {
    const u = UPGRADES[key];
    const lvl = this.data.upgrades[key] || 0;
    if (lvl >= u.max) return { ok: false, reason: 'max' };
    const cost = this.upgradeCost(key);
    if (this.data.coins < cost) return { ok: false, reason: 'coins' };
    this.data.coins -= cost;
    this.data.upgrades[key] = lvl + 1;
    this.save();
    return { ok: true, cost, level: lvl + 1 };
  },
  stats() {
    const u = this.data.upgrades;
    const s = {
      damage: 1, gas: 100, reel: 1, hookRange: 120, hp: 100, regen: 1.2,
      armor: 1, comboWindow: 1.25, finisher: 1
    };
    for (const key of Object.keys(UPGRADES)) {
      const applied = UPGRADES[key].apply(u[key] || 0);
      Object.assign(s, applied);
    }
    return s;
  },
  addXp(n) {
    this.data.xp += Math.max(0, Math.round(n));
    this.save();
  },
  addCoins(n) {
    this.data.coins += Math.max(0, Math.round(n));
    this.save();
  },
  rank() {
    let out = RANKS[0];
    for (const r of RANKS) if (this.data.xp >= r.xp) out = r;
    return out;
  },
  rankProgress() {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (this.data.xp >= RANKS[i].xp) idx = i;
    const cur = RANKS[idx], next = RANKS[idx + 1];
    if (!next) return { pct: 1, cur, next: null };
    return { pct: (this.data.xp - cur.xp) / (next.xp - cur.xp), cur, next };
  },
  completeStory(index, reward) {
    if (!this.data.storyDone.includes(index)) this.data.storyDone.push(index);
    this.data.storyProgress = Math.max(this.data.storyProgress, Math.min(5, index + 1));
    this.data.coins += reward;
    this.data.missions += 1;
    this.save();
  },
  settingsChanged() { this.save(); }
};
