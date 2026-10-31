import * as THREE from '../vendor/three/three.module.min.js';
import { Save } from './save.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { TitanManager, Ally } from './entities.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import {
  QUALITY, DIFFICULTY, STORY, ZONES, TIPS, TITAN_TYPES,
  clamp, rand, pick, fmt, dist2D
} from './config.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const wait = ms => new Promise(r => setTimeout(r, ms));

export class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1400);
    this.settings = Save.settings;
    this.state = 'boot';
    this.mode = 'menu';
    this.paused = false;
    this.dialoguePaused = false;
    this.finished = false;
    this.fps = 60;
    this.frameInterval = 1000 / 60;
    this.lastRender = 0;
    this.hudAcc = 0;
    this.menuAngle = 0.8;
    this.overlayContext = null;
    this.overlayClosable = true;
    this.currentStory = 0;
    this.canNextStory = false;
    this.player = null;
    this.allies = [];
    this.crystals = [];
    this.objectives = [];
    this.respawnTimer = 0;
    this.roamSpawnCd = 20;
    this.audio = new AudioEngine();
    this.input = new Input();
    this.ui = new UI(this);
    this.stats = this.blankStats();
    this.input.onPause = () => this.pause();
    this.input.onFirstGesture = () => {
      this.audio.init();
      this.audio.setMuted(!this.settings.sound);
      this.audio.setMusic(this.settings.music);
    };
    this.tmp = new THREE.Vector3();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this.paused) this.pause();
    });
    this.boot();
  }

  blankStats() {
    return { kills: 0, damage: 0, bestCombo: 0, time: 0, wave: 0, intel: 0 };
  }

  async boot() {
    this.ui.bootProgress(6, 'Khởi tạo WebGL…');
    await wait(40);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // First-time device defaults
    let hasSave = false;
    try { hasSave = !!localStorage.getItem('titan-slayer-save-v1'); } catch (e) { /* ignore */ }
    if (!hasSave) {
      const touch = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
      Save.data.settings.quality = touch ? 'medium' : 'high';
      Save.save();
    }
    this.settings = Save.settings;

    this.ui.bootProgress(22, 'Dựng thành phố và tường thành…');
    await wait(40);
    this.world = new World(this.scene, this.renderer, this.settings.quality);
    this.ui.bootProgress(55, 'Tạo Titan, rừng cây và vùng đất hoang…');
    await wait(30);
    this.effects = new Effects(this.scene, this.camera, this.ui.dmgLayer);
    this.titans = new TitanManager(this.scene, this.effects, this.world);
    this.titans.onKill = t => this.onTitanKilled(t);
    this.ui.bootProgress(78, 'Nạp ODM gear và thanh kiếm…');
    await wait(30);
    this.applySettings(true);
    this.spawnMenuTitans();
    this.state = 'menu';
    this.ui.bootProgress(100, 'Sẵn sàng chiến đấu.');
    await wait(160);
    this.ui.hideBoot();
    this.ui.showMenu();
    this.ui.resize();
    this.lastRender = performance.now();
    requestAnimationFrame(this.loop);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(innerWidth, innerHeight);
    this.ui.resize();
  }

  applySettings(initial = false) {
    const q = QUALITY[this.settings.quality] || QUALITY.high;
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
      this.renderer.shadowMap.enabled = q.shadows;
    }
    if (this.world?.sun) {
      this.world.sun.castShadow = q.shadows;
      if (q.shadows) {
        this.world.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        if (this.world.sun.shadow.map) {
          this.world.sun.shadow.map.dispose();
          this.world.sun.shadow.map = null;
        }
      }
    }
    if (this.scene.fog) {
      this.scene.fog.near = q.fog[0];
      this.scene.fog.far = q.fog[1];
    }
    this.camera.far = 2400;
    this.camera.updateProjectionMatrix();
    if (this.world) {
      if (this.world.grassMesh) this.world.grassMesh.visible = q.grass > 0;
      if (this.world.dust) this.world.dust.visible = q.dust > 0;
      if (this.world.canopies) this.world.canopies.castShadow = q.shadows;
    }
    this.audio.setMuted(!this.settings.sound);
    this.audio.setMusic(this.settings.music);
    this.frameInterval = 1000 / (this.settings.fps || 60);
  }

  // ---------------- loop ----------------
  loop = (now) => {
    requestAnimationFrame(this.loop);
    if (!this.lastRender) this.lastRender = now;
    const elapsed = now - this.lastRender;
    if (elapsed < this.frameInterval - 1.2) return;
    const raw = Math.min(0.08, elapsed / 1000);
    this.lastRender = now;
    this.fps = this.fps * .9 + (1 / Math.max(0.001, raw)) * .1;
    const dt = Math.min(0.05, raw);
    this.update(dt, now);
    this.renderer.render(this.scene, this.camera);
  };

  update(dt, now) {
    this.world.update(dt);
    if (this.state === 'menu') {
      this.menuAngle += dt * 0.035;
      const r = 285;
      this.camera.fov = 55;
      this.camera.position.set(Math.cos(this.menuAngle) * r, 68 + Math.sin(this.menuAngle * .7) * 9, Math.sin(this.menuAngle) * r + 35);
      this.camera.lookAt(0, 16, 24);
      this.camera.updateProjectionMatrix();
      this.effects.update(dt);
      return;
    }
    if (this.state !== 'playing' || !this.player) return;

    if (!this.paused && !this.dialoguePaused) {
      this.updateGameplay(dt);
    } else {
      this.player.shake = 0;
    }
    this.updateCamera(dt, !this.paused && !this.dialoguePaused);
    this.effects.update(dt);

    this.hudAcc += dt;
    if (this.hudAcc > 0.08) {
      this.hudAcc = 0;
      this.updateHud();
    }
  }

  updateCamera(dt, allowLook) {
    if (!allowLook) {
      this.input.look.x = 0;
      this.input.look.y = 0;
      this.input.consumeLook();
    }
    if (!this.settings.shake) this.player.shake = 0;
    const cam = this.player.updateCamera(dt, this.input);
    this.camera.position.copy(cam.pos);
    this.camera.lookAt(cam.target);
    if (Math.abs(this.camera.fov - cam.fov) > 0.01) {
      this.camera.fov = cam.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  updateGameplay(dt) {
    const p = this.player;
    this.stats.time += dt;
    const prev = p.pos.clone();
    p.update(dt, this.input, this);
    if (this.world.sun) {
      this.world.sun.position.set(p.pos.x + 220, 300, p.pos.z + 150);
      this.world.sun.target.position.set(p.pos.x, 0, p.pos.z);
      this.world.sun.target.updateMatrixWorld();
    }

    if (p.hook.active) {
      const d = prev.distanceTo(p.pos);
      this.odmDistance = (this.odmDistance || 0) + d;
    }

    const gateActive = this.gateActive && this.world.gate?.alive;
    const ctx = {
      player: p,
      allies: this.allies,
      titans: this.titans.titans,
      gateActive,
      gatePos: this.world.gate?.position,
      gate: this.world.gate,
      onGateHit: (dmg) => this.onGateHit(dmg),
      onAllyDead: (a) => this.onAllyDead(a),
      audio: this.audio,
      world: this.world
    };
    this.titans.update(dt, ctx);

    for (const a of this.allies) a.update(dt, ctx);

    // body collision with titans
    if (!p.dead) {
      for (const t of this.titans.titans) {
        if (t.dead) continue;
        const dx = p.pos.x - t.group.position.x;
        const dz = p.pos.z - t.group.position.z;
        const min = t.radius + 0.45;
        const d = Math.hypot(dx, dz);
        if (d < min && d > 0.001 && p.pos.y < t.height * .9) {
          const push = (min - d) / d;
          p.pos.x += dx * push; p.pos.z += dz * push;
        }
      }
    }

    if (this.input.consume('lock')) this.cycleLock();

    this.updateObjectives(dt);
    this.updateInteractPrompt();
    this.updateCrystals(dt);
    this.updateZone();
    this.updateWave(dt);
    this.updateRoamSpawns(dt);
    this.updateAutoLock(dt);
    this.checkGate();
    this.checkDeath(dt);
  }

  updateHud() {
    const p = this.player;
    if (!p) return;
    this.ui.setVitals(p);
    this.ui.setCombo(p.combo, p.comboTimer / Math.max(.1, p.stats.comboWindow), p.combo >= 4 ? 'XUẤT SẮC' : p.combo >= 2 ? 'TỐT' : '');
    this.ui.setLock(p.lockTarget, this.camera, p.pos);
    this.ui.setCrosshair(!p.lockTarget);
    this.ui.updateMarkers(this.titans.titans, this.camera, p.pos);
    this.ui.mapAcc += 0.08;
    this.ui.drawMinimap(p, this.titans.titans, this.allies, this.objectivePosition);
    this.ui.setBoss(this.boss);
    this.ui.setFps(this.fps, this.settings.showFps);
    this.ui.speedlines(p.hook.active && p.vel.length() > 26);
    this.ui.danger(p.hp / p.maxHp < .3);
    this.ui.setTitanCount(this.titans.alive.length, this.waveLabel());
    this.ui.setSquad(this.allies, this.mode === 'squad');
    this.updateObjectivePosition();
    this.ui.setProgress(this.objectiveProgress());
    this.ui.setMission(this.missionKicker, this.missionTitle, this.objectiveText());
    const objPos = this.objectivePosition;
    this.ui.setObjective(objPos, this.objectiveLabel, p.pos);
  }

  // ---------------- modes ----------------
  selectMode(mode) {
    if (mode === 'story') { this.openPanel('story'); return; }
    if (mode === 'roam') this.startRoam();
    else if (mode === 'survival') this.startSurvival();
    else if (mode === 'training') this.startTraining();
    else if (mode === 'squad') this.startSquad();
  }

  continueStory() {
    if (Save.data.storyProgress >= STORY.length) { this.openPanel('story'); return; }
    this.startStory(Save.data.storyProgress);
  }

  startStory(index) {
    if (index < 0 || index >= STORY.length) return;
    if (index > Save.data.storyProgress) return;
    this.currentStory = index;
    const m = STORY[index];
    const brief = {
      kicker: `CỐT TRUYỆN · CHƯƠNG ${index + 1}`,
      title: m.title,
      brief: m.brief,
      objectives: m.objectives,
      reward: m.reward,
      zoneLabel: (ZONES.find(z => z.key === m.zone) || ZONES[0]).name,
      diff: index >= 3 ? 'KHÓ' : index >= 1 ? 'THƯỜNG' : 'DỄ',
      artTitle: `CHƯƠNG ${String(index + 1).padStart(2, '0')}`,
      artSub: 'CHIẾN DỊCH TỰ DO'
    };
    this.overlayContext = 'briefing';
    this.paused = this.state === 'playing';
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.open(this.ui.panelBriefing(brief, () => this.beginStory(index)), false);
  }

  beginStory(index) {
    const m = STORY[index];
    this.ui.close();
    this.overlayContext = null;
    this.currentStory = index;
    this.mode = 'story';
    this.modeLabel = `CỐT TRUYỆN · CHƯƠNG ${index + 1}`;
    this.missionTitle = m.title;
    this.missionKicker = `CỐT TRUYỆN · CHƯƠNG ${index + 1}`;
    const spawns = [
      new THREE.Vector3(0, 0, 22),
      new THREE.Vector3(0, 0, 142),
      new THREE.Vector3(66, 0, -238),
      new THREE.Vector3(92, 0, -282),
      new THREE.Vector3(-248, 0, -18)
    ];
    const yaws = [0, Math.PI, 0, 0, 0.9];
    this.startRun(spawns[index], yaws[index], false);
    this.objectives = m.objectives.map(o => {
      const target = o.amount ?? o.count ?? 1;
      if (o.type === 'kill') return { ...o, amount: target, count: 0, progress: 0, done: false };
      if (o.type === 'combo') return { ...o, count: target, progress: 0, done: false };
      if (o.type === 'move' || o.type === 'intel') return { ...o, amount: target, count: 0, progress: 0, done: false };
      return { ...o, count: 0, progress: 0, done: false };
    });
    this.gateActive = index === 1;
    if (this.gateActive) {
      this.world.resetGate();
      this.world.gate.hp = 100;
    }
    const diff = DIFFICULTY.story;
    for (const s of m.spawns) {
      const t = this.titans.spawn(s.type, new THREE.Vector3(s.at[0], 0, s.at[1]), {
        boss: !!s.boss, hpMult: diff.hp, dmgMult: diff.dmg
      });
      this.world.resolveCircle(t.group.position, t.radius);
      if (s.boss) this.boss = t;
    }
    if (index === 2) {
      const pos = new THREE.Vector3(120, 0, -300);
      const ally = new Ally('Trinh sát Linh', pos, { effects: this.effects, cape: 0x2f6b47, scarf: 0xb13a2d });
      ally.group.position.set(pos.x, 0.3, pos.z);
      ally.downed = true; ally.hp = 0; ally.reviveTimer = 999;
      ally.group.rotation.z = Math.PI * .48;
      this.scene.add(ally.group);
      this.allies.push(ally);
      this.rescueAlly = ally;
      this.rescued = false;
    }
    this.ui.setMission(this.missionKicker, this.missionTitle, this.objectiveText());
    this.ui.setZone(this.world.getZone(this.player.pos));
    this.dialoguePaused = true;
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.showDialogue(m.intro, () => {
      this.dialoguePaused = false;
      this.input.enabled = true;
      this.input.clear();
      this.input.requestLock(this.canvas);
      this.ui.toast('MỤC TIÊU: ' + this.objectiveText(), 'gold', 3200);
      this.audio.play('confirm');
    });
  }

  startTraining() {
    this.mode = 'training';
    this.modeLabel = 'HUẤN LUYỆN';
    this.missionTitle = 'Làm chủ ODM Gear';
    this.missionKicker = 'HUẤN LUYỆN · CƠ BẢN';
    this.startRun(new THREE.Vector3(0, 0, 34), 0, true);
    this.objectives = [
      { type: 'move', amount: 30, count: 0, progress: 0, done: false, label: 'Di chuyển 30m bằng ODM' },
      { type: 'kill', count: 0, amount: 3, done: false, label: 'Hạ 3 hình nộm', titan: 'dummy' },
      { type: 'combo', count: 3, progress: 0, done: false, label: 'Đạt combo 3 đòn' }
    ];
    const spots = [[24, 44], [-28, 34], [8, 66], [-12, 80]];
    for (const [x, z] of spots) this.titans.spawn('dummy', new THREE.Vector3(x, 0, z), { hpMult: 1, dmgMult: 0 });
    this.ui.setMission(this.missionKicker, this.missionTitle, this.objectiveText());
    this.ui.setZone(this.world.getZone(this.player.pos));
    this.ui.toast('Giữ joystick trái để di chuyển · nhấn MÓC vào tòa nhà', '', 3600);
    setTimeout(() => this.ui.toast('Nhấn CHÉM 3 lần liên tiếp để tạo combo', 'gold', 3600), 1800);
    setTimeout(() => this.ui.toast('Chém từ trên cao vào GÁY để nhận sát thương chí mạng', '', 3800), 4200);
    this.audio.play('wave');
  }

  startRoam() {
    this.mode = 'roam';
    this.modeLabel = 'TỰ DO';
    this.missionTitle = 'Khám phá thế giới';
    this.missionKicker = 'FREE ROAM · 5 VÙNG ĐẤT';
    this.startRun(new THREE.Vector3(0, 0, 30), 0, true);
    this.objectives = [
      { type: 'intel', count: 0, amount: 12, done: false, label: 'Thu thập thông tin' }
    ];
    const zones = ['city', 'city', 'forest', 'forest', 'waste', 'waste', 'grass', 'grass', 'walls', 'city'];
    for (const z of zones) {
      const pos = this.world.spawnPoint(z, this.player.pos, 55);
      const type = pick(z === 'waste' ? ['normal', 'armored', 'aberrant'] : z === 'forest' ? ['normal', 'aberrant'] : ['normal', 'normal', 'aberrant']);
      const t = this.titans.spawn(type, pos, { hpMult: 1, dmgMult: 1 });
      this.world.resolveCircle(t.group.position, t.radius);
    }
    this.spawnCrystals();
    this.ui.setMission(this.missionKicker, this.missionTitle, this.objectiveText());
    this.ui.setZone(this.world.getZone(this.player.pos));
    this.ui.toast('TỰ DO — khám phá thành phố, rừng, đồng cỏ và vùng đất hoang', 'green', 3600);
    setTimeout(() => this.ui.toast('Thu thập 12 khối thông tin màu xanh để nhận thưởng', 'gold', 3600), 1600);
    this.audio.play('wave');
  }

  startSurvival() {
    this.mode = 'survival';
    this.modeLabel = 'SINH TỒN';
    this.missionTitle = 'Sống sót vô tận';
    this.missionKicker = 'SURVIVAL · ĐỢT TITAN';
    this.startRun(new THREE.Vector3(0, 0, 20), 0, true);
    this.wave = 0;
    this.waveState = 'intermission';
    this.waveTimer = 2.4;
    this.ui.setMission(this.missionKicker, this.missionTitle, 'Chuẩn bị đợt 1…');
    this.ui.setZone(this.world.getZone(this.player.pos));
    this.ui.toast('SINH TỒN — các đợt Titan sẽ mạnh dần', 'green', 3200);
    this.audio.play('wave');
  }

  startSquad() {
    this.mode = 'squad';
    this.modeLabel = 'BIỆT ĐỘI 4P';
    this.missionTitle = 'Biệt đội 4 người';
    this.missionKicker = 'SQUAD 4P · BẠN + 3 ĐỒNG ĐỘI AI';
    this.startRun(new THREE.Vector3(0, 0, 20), 0, true);
    const defs = [
      { name: 'Linh', color: '#63d69b', cape: 0x2f6b47, scarf: 0x2f6b47, hair: 0x1e1712 },
      { name: 'Bảo', color: '#6fd6e8', cape: 0x24505c, scarf: 0x2d6f7d, hair: 0x30251c },
      { name: 'Vy', color: '#b79bf5', cape: 0x4b3a66, scarf: 0x6d4a8e, hair: 0x3a2a22 }
    ];
    defs.forEach((d, i) => {
      const a = new Ally(d.name, new THREE.Vector3(rand(-8, 8), 6, rand(8, 18) + i * 2), {
        effects: this.effects, cape: d.cape, scarf: d.scarf, hair: d.hair, damage: 20 + i * 2
      });
      this.scene.add(a.group);
      this.allies.push(a);
    });
    this.wave = 0;
    this.waveState = 'intermission';
    this.waveTimer = 2.2;
    this.ui.setMission(this.missionKicker, this.missionTitle, 'Chuẩn bị đợt 1…');
    this.ui.setZone(this.world.getZone(this.player.pos));
    this.ui.toast('BIỆT ĐỘI 4P — hồi sinh đồng đội bị gục bằng nút TƯƠNG TÁC', 'green', 4200);
    this.audio.play('wave');
  }

  startRun(pos, cameraYaw, lock = true) {
    this.resetRun();
    this.state = 'playing';
    this.paused = false;
    this.dialoguePaused = false;
    this.finished = false;
    this.overlayContext = null;
    this.ui.close();
    this.ui.showHUD();
    this.spawnPlayer(pos, cameraYaw);
    this.input.enabled = true;
    this.input.clear();
    this.ui.setBoss(null);
    this.ui.setInteract(null);
    this.ui.setCombo(0, 0);
    this.lastRender = performance.now();
    if (lock) this.input.requestLock(this.canvas);
    this.audio.init();
    this.audio.setMuted(!this.settings.sound);
    this.audio.setMusic(this.settings.music);
  }

  spawnPlayer(pos, cameraYaw) {
    const stats = Save.stats();
    stats.speed = 8.2;
    this.player = new Player(this.scene, this.world, this.effects, stats, {
      position: pos, cameraYaw
    });
    this.player.game = this;
    this.player.audio = this.audio;
    this.player.onDeath = (src) => this.onPlayerDeath(src);
    this.player.onToast = (t) => this.ui.toast(t);
    this.player.onHookFail = (t) => this.ui.toast(t, '', 1400);
    this.player.onAttackHit = (t, dmg, crit) => {
      this.stats.damage += dmg;
      this.maxCombo = Math.max(this.maxCombo || 0, this.player.combo);
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.player.combo);
    };
    this.scene.add(this.player.group);
    this.player.updateCamera(0.016, this.input);
    this.camera.position.copy(this.player.cameraPos);
    this.camera.lookAt(this.player.cameraTarget);
  }

  resetRun() {
    if (this.player) { this.player.dispose(this.scene); this.player = null; }
    if (this.titans) this.titans.clear();
    for (const a of this.allies) a.dispose(this.scene);
    this.allies = [];
    for (const c of this.crystals) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); }
    this.crystals = [];
    this.effects?.hideLine();
    this.world?.resetGate();
    this.stats = this.blankStats();
    this.runCoins = 0;
    this.runXp = 0;
    this.boss = null;
    this.bossKilled = false;
    this.rescueAlly = null;
    this.rescued = false;
    this.gateActive = false;
    this.wave = 0;
    this.waveState = 'idle';
    this.waveTimer = 0;
    this.deathTimer = 0;
    this.respawnTimer = 0;
    this.roamSpawnCd = 20;
    this.odmDistance = 0;
    this.maxCombo = 0;
    this.intel = 0;
    this.currentZone = null;
    this.visitedZones = new Set();
    this.roamComplete = false;
    this.objectives = [];
    this.objectivePosition = null;
    this.objectiveLabel = '';
    this.finished = false;
    this.rewardsGranted = false;
    this.autoLockCd = 0;
    this.hudAcc = 0;
    this.canNextStory = false;
  }

  spawnMenuTitans() {
    const a = this.titans.spawn('normal', new THREE.Vector3(58, 0, 248), { hpMult: 1 });
    a.group.rotation.y = Math.PI;
    const b = this.titans.spawn('aberrant', new THREE.Vector3(-72, 0, 265), { hpMult: 1 });
    b.group.rotation.y = Math.PI * .8;
  }

  // ---------------- gameplay systems ----------------
  getTitanAnchors(pos) {
    const arr = [];
    for (const t of this.titans.titans) {
      if (t.dead) continue;
      if (t.group.position.distanceTo(pos) > 100) continue;
      arr.push(t.getNapePoint(new THREE.Vector3()));
      arr.push(t.getChestPoint(new THREE.Vector3()));
    }
    return arr;
  }

  cycleLock() {
    const p = this.player;
    if (!p) return;
    const list = this.titans.titans.filter(t => !t.dead)
      .map(t => ({ t, d: t.group.position.distanceTo(p.pos) }))
      .filter(o => o.d < 150)
      .sort((a, b) => a.d - b.d);
    if (!list.length) { this.ui.toast('Không có Titan trong tầm khóa', '', 1300); return; }
    let idx = -1;
    if (p.lockTarget) idx = list.findIndex(o => o.t === p.lockTarget);
    const next = list[(idx + 1) % list.length].t;
    p.lockTarget = next;
    this.audio.play('lock');
    this.ui.toast('ĐÃ KHÓA: ' + next.type.name, 'gold', 1200);
  }

  updateAutoLock(dt) {
    const p = this.player;
    if (!p || p.dead || p.lockTarget || !this.settings.autoLock) return;
    this.autoLockCd -= dt;
    if (this.autoLockCd > 0) return;
    this.autoLockCd = 1.4;
    const fwd = p.getAimDirection();
    let best = null, bestScore = -Infinity;
    for (const t of this.titans.titans) {
      if (t.dead) continue;
      const d = t.group.position.distanceTo(p.pos);
      if (d > 110) continue;
      _v.subVectors(t.getCenter(_v2), p.pos).normalize();
      const dot = _v.dot(fwd);
      if (dot < .25) continue;
      const score = dot * 2 - d / 110;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    if (best) p.lockTarget = best;
  }

  onTitanKilled(t) {
    this.stats.kills++;
    Save.data.kills++;
    const mult = (DIFFICULTY[this.mode] || DIFFICULTY.roam).reward;
    const reward = Math.max(3, Math.round(t.type.reward * mult));
    this.runCoins += reward;
    this.runXp += Math.round(t.type.reward * .8 + 5);
    this.ui.toast(`HẠ ${t.type.name}  ·  +◈${reward}`, 'gold', 1900);
    this.audio.play('coin');
    if (t.boss) {
      this.boss = null;
      this.bossKilled = true;
      this.ui.setBoss(null);
      this.ui.toast('★ ĐÃ HẠ GỤC TRÙM — ' + t.type.name, 'gold', 3600);
      this.audio.play('wave');
    }
    for (const o of this.objectives) {
      if (o.type === 'kill' && !o.done) {
        if (o.titan && o.titan !== t.typeKey) continue;
        if (o.excludeBoss && t.boss) continue;
        o.count = (o.count || 0) + 1;
        if (o.count >= o.amount) o.done = true;
      }
      if (o.type === 'boss' && t.boss) { o.done = true; }
    }
    if ((this.mode === 'survival' || this.mode === 'squad') && this.waveState === 'active') {
      if (this.titans.alive.length === 0) this.completeWave();
    }
    if (this.mode === 'story' && this.currentStory === 4 && t.boss) {
      // final boss down; remaining guards still count
    }
    this.checkObjectives();
  }

  completeWave() {
    this.waveState = 'intermission';
    this.waveTimer = 5.5;
    const bonus = 30 + this.wave * 22;
    this.runCoins += bonus;
    this.runXp += 20 + this.wave * 8;
    this.ui.toast(`ĐỢT ${this.wave} HOÀN THÀNH  ·  +◈${bonus}`, 'green', 3000);
    this.audio.play('confirm');
    if (this.player && !this.player.dead) this.player.heal(this.player.maxHp * .28);
    if (this.mode === 'survival') Save.data.bestSurvival = Math.max(Save.data.bestSurvival || 0, this.wave);
    if (this.mode === 'squad') Save.data.bestSquad = Math.max(Save.data.bestSquad || 0, this.wave);
    Save.save();
  }

  updateWave(dt) {
    if (this.mode !== 'survival' && this.mode !== 'squad') return;
    if (this.finished) return;
    if (this.waveState === 'intermission') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave();
    }
  }

  startWave() {
    this.wave++;
    this.waveState = 'active';
    this.stats.wave = this.wave;
    const base = this.mode === 'squad' ? 3 : 4;
    const count = Math.min(14, base + this.wave * 2);
    const zoneKey = this.world.getZone(this.player.pos).key;
    const hpMult = 1 + (this.wave - 1) * .085;
    const dmgMult = 1 + (this.wave - 1) * .055;
    for (let i = 0; i < count; i++) {
      let type = 'normal';
      const r = Math.random();
      if (this.wave >= 5 && r < .1) type = 'colossal';
      else if (this.wave >= 3 && r < .28) type = 'armored';
      else if (r < .55) type = 'aberrant';
      const pos = this.world.spawnPoint(i % 4 === 0 ? 'walls' : zoneKey, this.player.pos, 60);
      const t = this.titans.spawn(type, pos, { hpMult, dmgMult });
      this.world.resolveCircle(t.group.position, t.radius);
    }
    this.ui.toast(`ĐỢT ${this.wave} — ${count} TITAN`, 'gold', 3200);
    this.audio.play('wave');
    this.ui.setTitanCount(this.titans.alive.length, this.waveLabel());
  }

  waveLabel() {
    if (this.mode === 'survival' || this.mode === 'squad') return `ĐỢT ${this.wave || 1}`;
    if (this.mode === 'story') return `CHƯƠNG ${this.currentStory + 1}/5`;
    if (this.mode === 'training') return 'HUẤN LUYỆN';
    return 'TỰ DO';
  }

  updateObjectives(dt) {
    if (!this.objectives.length) return;
    let allDone = true;
    let othersDone = true;
    for (const o of this.objectives) {
      if (o.type === 'move') {
        o.progress = Math.min(o.amount, this.odmDistance || 0);
        o.done = o.progress >= o.amount;
      } else if (o.type === 'kill') {
        o.done = (o.count || 0) >= o.amount;
      } else if (o.type === 'combo') {
        o.progress = Math.max(o.progress || 0, this.maxCombo || 0);
        o.done = o.progress >= o.count;
      } else if (o.type === 'rescue') {
        o.done = !!this.rescued;
      } else if (o.type === 'boss') {
        o.done = !!this.bossKilled;
      } else if (o.type === 'intel') {
        o.count = this.intel || 0;
        o.done = o.count >= o.amount;
      } else if (o.type === 'defend') {
        o.progress = this.world.gate ? this.world.gate.hp / this.world.gate.maxHp : 0;
      }
      if (o.type !== 'defend' && !o.done) othersDone = false;
      if (!o.done) allDone = false;
    }
    for (const o of this.objectives) {
      if (o.type === 'defend') {
        o.done = othersDone && this.world.gate?.alive;
        if (o.done) o.progress = 1;
      }
    }
    if (!othersDone) allDone = false;
    for (const o of this.objectives) if (!o.done) allDone = false;
    if (allDone && this.mode === 'story' && !this.finished) {
      this.finish(true);
    } else if (allDone && this.mode === 'training' && !this.finished) {
      this.finish(true);
    } else if (allDone && this.mode === 'roam' && !this.roamComplete) {
      this.roamComplete = true;
      this.runCoins += 150;
      this.ui.toast('ĐÃ THU THẬP ĐỦ THÔNG TIN  ·  +◈150', 'gold', 4000);
      this.audio.play('confirm');
    }
  }

  objectiveText() {
    if (!this.objectives.length) return this.mode === 'survival' || this.mode === 'squad' ? 'Sống sót qua các đợt Titan' : 'Tự do khám phá';
    const o = this.objectives.find(x => !x.done);
    if (!o) return 'Hoàn thành nhiệm vụ';
    if (o.type === 'kill') return `${o.label} (${o.count || 0}/${o.amount})`;
    if (o.type === 'move') return `${o.label} (${Math.floor(o.progress || 0)}/${o.amount}m)`;
    if (o.type === 'combo') return `${o.label} (${Math.min(o.count, o.progress || 0)}/${o.count})`;
    if (o.type === 'defend') return `${o.label} (${Math.round((this.world.gate?.hp || 0))}%)`;
    if (o.type === 'intel') return `${o.label} (${o.count || 0}/${o.amount})`;
    return o.label;
  }

  objectiveProgress() {
    if (!this.objectives.length) return 0;
    let sum = 0;
    for (const o of this.objectives) {
      if (o.type === 'kill') sum += Math.min(1, (o.count || 0) / o.amount);
      else if (o.type === 'move') sum += Math.min(1, (o.progress || 0) / o.amount);
      else if (o.type === 'combo') sum += Math.min(1, (o.progress || 0) / o.count);
      else if (o.type === 'intel') sum += Math.min(1, (o.count || 0) / o.amount);
      else if (o.type === 'defend') sum += Math.min(1, (this.world.gate?.hp || 0) / 100);
      else sum += o.done ? 1 : 0;
    }
    return sum / this.objectives.length;
  }

  updateObjectivePosition() {
    const p = this.player;
    if (!p) { this.objectivePosition = null; return; }
    const o = this.objectives.find(x => !x.done);
    this.objectiveLabel = o?.label || '';
    if (!o) { this.objectivePosition = null; return; }
    if (o.type === 'rescue' && o.position) {
      this.objectivePosition = _v.set(o.position[0], 0, o.position[1]);
    } else if (o.type === 'boss' && this.boss) {
      this.objectivePosition = this.boss.group.position;
    } else if (o.type === 'defend') {
      this.objectivePosition = this.world.gate.position;
    } else if (o.type === 'kill') {
      const t = this.titans.nearest(p.pos, 220, t => !o.titan || t.typeKey === o.titan);
      this.objectivePosition = t ? t.group.position : null;
    } else if (o.type === 'intel') {
      let best = null, bd = Infinity;
      for (const c of this.crystals) {
        if (c.collected) continue;
        const d = c.mesh.position.distanceTo(p.pos);
        if (d < bd) { bd = d; best = c; }
      }
      this.objectivePosition = best ? best.mesh.position : null;
    } else {
      this.objectivePosition = null;
    }
  }

  updateInteractPrompt() {
    const p = this.player;
    if (!p || p.dead) { this.ui.setInteract(null); return; }
    let label = null;
    let action = null;
    if (this.rescueAlly && this.rescueAlly.downed && p.pos.distanceTo(this.rescueAlly.group.position) < 5.5) {
      label = `Giải cứu ${this.rescueAlly.name}`;
      action = () => {
        if (this.rescueAlly.revive()) {
          this.rescued = true;
          this.ui.toast('ĐÃ GIẢI CỨU ' + this.rescueAlly.name.toUpperCase(), 'green', 3000);
          this.audio.play('rescue');
          this.ui.setInteract(null);
        }
      };
    }
    if (!label && this.allies.length) {
      let best = null, bd = 5.5;
      for (const a of this.allies) {
        if (!a.downed || a.dead) continue;
        const d = p.pos.distanceTo(a.group.position);
        if (d < bd) { bd = d; best = a; }
      }
      if (best) {
        label = `Hồi sinh ${best.name} (${Math.ceil(best.reviveTimer)}s)`;
        action = () => {
          if (best.revive()) {
            this.ui.toast('ĐÃ HỒI SINH ' + best.name.toUpperCase(), 'green', 2600);
            this.audio.play('rescue');
          }
        };
      }
    }
    if (!label && this.gateActive && this.world.gate?.alive && p.pos.distanceTo(this.world.gate.position) < 12 && this.world.gate.hp < 100) {
      label = `Sửa cổng thành (+15 HP)`;
      action = () => {
        this.world.gate.hp = Math.min(100, this.world.gate.hp + 15);
        this.ui.toast('ĐÃ SỬA CỔNG +15 HP', 'green', 1600);
        this.audio.play('upgrade');
      };
    }
    this.ui.setInteract(label);
    if (label && this.input.consume('interact')) action?.();
    this._interactAction = action;
  }

  doInteract() {
    this._interactAction?.();
  }

  updateCrystals(dt) {
    if (!this.crystals.length) return;
    const p = this.player;
    for (const c of this.crystals) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 1.3;
      c.mesh.position.y = c.baseY + Math.sin(performance.now() * .002 + c.seed) * .35;
      if (p && !p.dead && c.mesh.position.distanceTo(p.pos) < 4.2) {
        c.collected = true;
        c.mesh.visible = false;
        this.intel++;
        this.runCoins += 15;
        this.runXp += 8;
        this.ui.toast(`THÔNG TIN ${this.intel}/12  ·  +◈15`, 'gold', 1800);
        this.audio.play('coin');
        this.effects?.burst(c.mesh.position, 0x6fd6e8, 14, 4, .3, .8, 0);
        const obj = this.objectives.find(o => o.type === 'intel');
        if (obj) { obj.count = this.intel; }
      }
    }
  }

  spawnCrystals() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6fd6e8, emissive: 0x2b8fa8, emissiveIntensity: 1.6, roughness: .22, metalness: .5
    });
    const geo = new THREE.OctahedronGeometry(.55, 0);
    const zones = ['city', 'city', 'forest', 'forest', 'grass', 'grass', 'waste', 'waste', 'walls', 'city', 'forest', 'grass'];
    for (let i = 0; i < 12; i++) {
      const z = zones[i];
      const pos = this.world.spawnPoint(z, this.player.pos, 30);
      const y = this.world.groundHeightAt(pos.x, pos.z, .2) + 1.4;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, y, pos.z);
      this.scene.add(mesh);
      this.crystals.push({ mesh, baseY: y, seed: rand(0, 6.3), collected: false });
    }
  }

  updateRoamSpawns(dt) {
    if (this.mode !== 'roam') return;
    if (this.titans.alive.length >= 10) return;
    this.roamSpawnCd -= dt;
    if (this.roamSpawnCd > 0) return;
    this.roamSpawnCd = 16;
    const zone = pick(['city', 'forest', 'grass', 'waste', 'walls']);
    const pos = this.world.spawnPoint(zone, this.player.pos, 90);
    const type = pick(zone === 'waste' ? ['normal', 'armored', 'aberrant'] : ['normal', 'normal', 'aberrant']);
    const t = this.titans.spawn(type, pos, { hpMult: 1, dmgMult: 1 });
    this.world.resolveCircle(t.group.position, t.radius);
  }

  updateZone() {
    if (!this.player) return;
    const z = this.world.getZone(this.player.pos);
    if (!this.currentZone || z.key !== this.currentZone.key) {
      this.currentZone = z;
      this.visitedZones?.add(z.key);
      if (this.state === 'playing') this.ui.setZone(z);
    }
  }

  onGateHit(dmg) {
    if (!this.world.gate?.alive) return;
    this.world.damageGate(dmg);
    this.effects?.dust(this.world.gate.position.clone().setY(6), 8, 0x9f8f78);
    if (this.world.gate.hp <= 0) {
      this.ui.toast('CỔNG THÀNH ĐÃ BỊ PHÁ!', '', 3000);
      this.audio.play('death');
      this.checkGate();
    }
  }

  checkGate() {
    if (this.gateActive && this.world.gate && !this.world.gate.alive && !this.finished) {
      this.finish(false, 'Cổng thành đã bị phá hủy');
    }
  }

  onAllyDead(a) {
    this.ui.toast(`ĐỒNG ĐỘI ${a.name.toUpperCase()} ĐÃ TỬ NẠN`, '', 3000);
    if (this.mode === 'squad' && this.allies.every(x => x.dead) && !this.finished) {
      this.finish(false, 'Cả biệt đội đã gục ngã');
    }
  }

  onPlayerDeath() {
    this.ui.setInteract(null);
    this.input.exitLock();
    if (this.mode === 'roam') {
      this.ui.toast('BẠN ĐÃ GỤC NGÃ — hồi sinh tại thành phố…', '', 2800);
    } else {
      this.ui.toast('BẠN ĐÃ GỤC NGÃ', '', 1800);
    }
  }

  checkDeath(dt) {
    const p = this.player;
    if (!p || !p.dead) { this.deathTimer = 0; return; }
    this.deathTimer += dt;
    if (this.mode === 'roam') {
      if (this.deathTimer > 2.4) this.respawnRoam();
    } else if (this.deathTimer > 1.6 && !this.finished) {
      this.finish(false, 'Bạn đã gục ngã trên chiến trường');
    }
  }

  respawnRoam() {
    const p = this.player;
    p.dead = false;
    p.deadTimer = 0;
    p.group.rotation.z = 0;
    p.hp = Math.max(40, p.maxHp * .6);
    p.gas = p.maxGas;
    p.blade = p.maxBlade;
    p.pos.set(0, 0, 34);
    p.vel.set(0, 0, 0);
    p.cameraYaw = 0;
    p.invuln = 3;
    p.releaseHook(true);
    this.deathTimer = 0;
    this.input.requestLock(this.canvas);
    this.ui.toast('HỒI SINH TẠI THÀNH PHỐ — mất 20 xu', '', 3200);
    this.runCoins = Math.max(0, this.runCoins - 20);
    this.audio.play('rescue');
  }

  // ---------------- finish / menus ----------------
  finish(win, reason = '') {
    if (this.finished) return;
    this.finished = true;
    this.paused = true;
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.setInteract(null);
    this.ui.setBoss(null);
    this.ui.setLock(null, this.camera, this.player?.pos || new THREE.Vector3());

    let bonus = 0;
    let total = 0;
    const mode = this.mode;
    if (mode === 'story') {
      const m = STORY[this.currentStory];
      if (win) {
        Save.completeStory(this.currentStory, m.reward);
        Save.addCoins(this.runCoins);
        Save.addXp(110 + this.currentStory * 60 + this.runXp);
        total = m.reward + this.runCoins;
        this.canNextStory = this.currentStory < STORY.length - 1;
      } else {
        total = Math.round(this.runCoins * .5);
        Save.addCoins(total);
        Save.addXp(Math.round(this.runXp * .35));
      }
    } else if (mode === 'training') {
      if (win) {
        bonus = 60;
        total = bonus + this.runCoins;
        Save.addCoins(total);
        Save.addXp(80 + this.runXp);
        Save.data.tutorialDone = true;
      }
    } else if (mode === 'survival' || mode === 'squad') {
      bonus = 40 + (this.wave || 1) * (mode === 'squad' ? 35 : 30);
      total = bonus + this.runCoins;
      Save.addCoins(total);
      Save.addXp(40 + (this.wave || 1) * 20 + this.runXp);
      if (mode === 'survival') Save.data.bestSurvival = Math.max(Save.data.bestSurvival || 0, this.wave || 0);
      if (mode === 'squad') Save.data.bestSquad = Math.max(Save.data.bestSquad || 0, this.wave || 0);
    } else if (mode === 'roam') {
      total = this.runCoins;
      Save.addCoins(total);
      Save.addXp(20 + this.runXp);
    }
    if (win && mode !== 'story') Save.data.missions++;
    Save.data.kills = Math.max(Save.data.kills, 0);
    Save.save();
    this.rewardsGranted = true;

    let title = win ? 'NHIỆM VỤ HOÀN THÀNH' : 'BẠN ĐÃ GỤC NGÃ';
    let sub = win ? 'Bạn đã hoàn thành mục tiêu.' : reason || 'Hãy thử lại và chú ý hơn đến Titan.';
    if (mode === 'story') {
      title = win ? `CHƯƠNG ${this.currentStory + 1} HOÀN THÀNH` : `CHƯƠNG ${this.currentStory + 1} THẤT BẠI`;
      sub = win ? STORY[this.currentStory].title : (reason || 'Bạn đã gục ngã. Hãy thử lại chiến thuật khác.');
    }
    if (mode === 'survival') {
      title = 'KẾT THÚC SINH TỒN';
      sub = `Bạn sống sót đến đợt ${this.wave || 1}. Kỷ lục: đợt ${Save.data.bestSurvival}.`;
    }
    if (mode === 'squad') {
      title = 'KẾT THÚC BIỆT ĐỘI';
      sub = `Biệt đội trụ được đến đợt ${this.wave || 1}.`;
    }
    if (mode === 'training') {
      title = win ? 'HUẤN LUYỆN HOÀN THÀNH' : 'HUẤN LUYỆN THẤT BẠI';
      sub = win ? 'Bạn đã sẵn sàng ra chiến trường.' : 'Hãy thử lại các bước cơ bản.';
    }
    if (mode === 'roam') {
      title = 'KẾT THÚC TỰ DO';
      sub = `Bạn đã thu thập ${this.intel}/12 thông tin.`;
    }
    let extra = '';
    if (mode === 'survival' || mode === 'squad') {
      extra = `<div class="up-stats"><div>ĐỢT ĐẠT ĐƯỢC<b>${this.wave || 1}</b></div><div>KỶ LỤC<b>${mode === 'survival' ? Save.data.bestSurvival : Save.data.bestSquad}</b></div><div>ĐỒNG ĐỘI<b>${this.allies.filter(a => !a.dead).length}/3</b></div></div>`;
    }
    if (mode === 'roam') {
      extra = `<div class="up-stats"><div>THÔNG TIN<b>${this.intel}/12</b></div><div>VÙNG ĐÃ ĐẾN<b>${this.visitedZones?.size || 1}/5</b></div></div>`;
    }
    if (!win && reason) extra = `<div class="up-stats"><div>LÝ DO<b>${reason}</b></div></div>` + extra;
    this.overlayContext = 'result';
    this.ui.open(this.ui.panelResult(win, title, sub, total, extra), false);
    this.audio.play(win ? 'confirm' : 'death');
  }

  quitToMenu() {
    if (this.state === 'playing' && !this.rewardsGranted && !this.finished) {
      Save.addCoins(this.runCoins || 0);
      Save.addXp(this.runXp || 0);
      Save.save();
      this.rewardsGranted = true;
    }
    this.input.exitLock();
    this.input.enabled = false;
    this.paused = false;
    this.dialoguePaused = false;
    this.state = 'menu';
    this.mode = 'menu';
    this.finished = false;
    this.resetRun();
    this.ui.close();
    this.ui.showMenu();
    this.spawnMenuTitans();
    this.audio.play('ui');
  }

  pause() {
    if (this.state !== 'playing' || this.paused || this.finished) return;
    this.paused = true;
    this.input.enabled = false;
    this.input.exitLock();
    this.input.clear();
    this.overlayContext = 'pause';
    this.ui.open(this.ui.panelPause(), true);
    this.audio.play('ui');
  }

  resume() {
    if (this.state !== 'playing') return;
    this.ui.close();
    this.overlayContext = null;
    this.paused = false;
    this.finished = false;
    this.input.enabled = true;
    this.input.clear();
    this.input.requestLock(this.canvas);
    this.lastRender = performance.now();
    this.audio.play('ui');
  }

  openPanel(name) {
    const fromGame = this.state === 'playing';
    if (fromGame && !this.paused) {
      this.paused = true;
      this.input.enabled = false;
      this.input.exitLock();
    }
    this.overlayContext = fromGame ? 'pause' : 'menu';
    let html = '';
    if (name === 'settings') html = this.ui.panelSettings();
    else if (name === 'upgrades') html = this.ui.panelUpgrades();
    else if (name === 'story') html = this.ui.panelStory();
    else if (name === 'controls') html = this.ui.panelControls();
    else html = this.ui.panelSettings();
    this.ui.open(html, true);
    this.audio.play('ui');
  }

  closeOverlay() {
    this.ui.close();
    if (this.overlayContext === 'pause' && this.state === 'playing') {
      this.overlayContext = 'pause';
      this.ui.open(this.ui.panelPause(), true);
    } else {
      this.overlayContext = null;
    }
  }

  overlayAction(act) {
    if (act === 'resume') { this.resume(); return; }
    if (act === 'settings') { this.openPanel('settings'); return; }
    if (act === 'controls') { this.openPanel('controls'); return; }
    if (act === 'upgrades') { this.openPanel('upgrades'); return; }
    if (act === 'restart') {
      if (!this.rewardsGranted && this.state === 'playing') {
        Save.addCoins(this.runCoins || 0);
        Save.addXp(this.runXp || 0);
        Save.save();
        this.rewardsGranted = true;
      }
      this.ui.close();
      if (this.mode === 'story') this.beginStory(this.currentStory);
      else if (this.mode === 'roam') this.startRoam();
      else if (this.mode === 'survival') this.startSurvival();
      else if (this.mode === 'training') this.startTraining();
      else if (this.mode === 'squad') this.startSquad();
      else this.quitToMenu();
      return;
    }
    if (act === 'next') {
      const next = this.currentStory + 1;
      if (next < STORY.length) this.startStory(next);
      return;
    }
    if (act === 'start') {
      const fn = this.briefingStart;
      this.briefingStart = null;
      this.ui.close();
      this.overlayContext = null;
      fn?.();
      return;
    }
    if (act === 'quit') {
      if (this.overlayContext === 'briefing') {
        this.ui.close();
        this.overlayContext = null;
        this.ui.showMenu();
        return;
      }
      this.quitToMenu();
      return;
    }
    if (act === 'reset') {
      Save.reset();
      this.settings = Save.settings;
      this.applySettings();
      this.ui.refreshMenu();
      this.ui.open(this.ui.panelSettings(), true);
      this.ui.toast('Đã đặt lại toàn bộ tiến trình', 'green', 2400);
      return;
    }
  }

  buyUpgrade(key) {
    const res = Save.buy(key);
    if (!res.ok) {
      this.ui.toast(res.reason === 'max' ? 'Đã đạt cấp tối đa' : 'Không đủ xu', '', 1800);
      this.audio.play('ui');
      return;
    }
    this.audio.play('upgrade');
    this.ui.toast(`NÂNG CẤP ${key.toUpperCase()} → CẤP ${res.level}`, 'gold', 2400);
    if (this.player) {
      const old = this.player.stats;
      const ns = Save.stats();
      const hpGain = ns.hp - this.player.maxHp;
      this.player.maxHp = ns.hp;
      if (hpGain > 0) this.player.hp = Math.min(ns.hp, this.player.hp + hpGain);
      const gasGain = ns.gas - this.player.maxGas;
      this.player.maxGas = ns.gas;
      if (gasGain > 0) this.player.gas = Math.min(ns.gas, this.player.gas + gasGain);
      this.player.stats = ns;
      this.player.stats.speed = old.speed || 8.2;
    }
    this.ui.open(this.ui.panelUpgrades(), true);
    this.overlayContext = this.state === 'playing' ? 'pause' : 'menu';
  }

  updateSetting(key, value) {
    const s = Save.settings;
    const cur = s[key];
    if (typeof cur === 'boolean') value = value === true || value === 'true';
    else if (typeof cur === 'number') value = parseFloat(value);
    s[key] = value;
    Save.save();
    this.applySettings();
    const buttons = this.ui.card.querySelectorAll(`[data-setting="${key}"]`);
    buttons.forEach(b => {
      if (b.classList.contains('toggle')) b.classList.toggle('on', !!value);
      else b.classList.toggle('active', String(b.dataset.value) === String(value));
    });
    if (key === 'sound') {
      if (value) { this.audio.init(); this.audio.setMuted(false); this.audio.play('confirm'); }
      else this.audio.setMuted(true);
    }
    if (key === 'music') this.audio.setMusic(!!value);
  }

  toast(text, cls = '', ms = 2600) {
    this.ui.toast(text, cls, ms);
  }

  flashDamage() {
    this.ui.flashDamage();
    if (this.settings.vibration && navigator.vibrate) navigator.vibrate(60);
  }
}
