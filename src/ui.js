import * as THREE from '../vendor/three/three.module.min.js';
import { QUALITY, FPS_CAPS, UPGRADES, STORY, ZONES, RANKS, TIPS, fmt } from './config.js';
import { Save } from './save.js';

const $ = id => document.getElementById(id);
const _v = new THREE.Vector3();

export class UI {
  constructor(game) {
    this.game = game;
    this.boot = $('boot');
    this.menu = $('menu');
    this.hud = $('hud');
    this.overlay = $('overlay');
    this.card = $('overlay-card');
    this.toastEl = $('toasts');
    this.dmgLayer = $('damage-layer');
    this.minimap = $('minimap');
    this.mctx = this.minimap.getContext('2d');
    this.mapAcc = 0;
    this.markers = [];
    this.markerRoot = document.createElement('div');
    this.markerRoot.id = 'world-markers';
    this.hud.appendChild(this.markerRoot);
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div');
      el.className = 'titan-marker';
      el.style.display = 'none';
      el.innerHTML = '<div class="tm-top"><b></b><span></span></div><div class="tm-bar"><i></i></div><div class="tm-nape">GÁY</div>';
      this.markerRoot.appendChild(el);
      this.markers.push(el);
    }
    this.dialogueQueue = [];
    this.dialogueDone = null;
    this.dialogueActive = false;
    this.dialogueTyping = null;
    $('dlg-next').addEventListener('click', () => this.advanceDialogue());
    this.bindOverlay();
    this.menu.addEventListener('click', (e) => {
      const mode = e.target.closest('[data-mode]');
      if (mode) { this.game.audio?.play('confirm'); this.game.selectMode(mode.dataset.mode); return; }
      const open = e.target.closest('[data-open]');
      if (open) { this.game.audio?.play('ui'); this.game.openPanel(open.dataset.open); return; }
    });
    $('pause-btn').addEventListener('click', () => this.game.pause());
    $('btn-continue').addEventListener('click', () => {
      this.game.audio?.play('confirm');
      this.game.continueStory();
    });
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const c = this.minimap;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = c.clientWidth || 166;
    c.width = size * dpr; c.height = size * dpr;
    this.mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  bootProgress(pct, text) {
    $('boot-bar').style.width = Math.max(2, pct) + '%';
    if (text) $('boot-status').textContent = text;
  }
  hideBoot() { this.boot.classList.add('hidden'); }
  showMenu() {
    this.hideBoot();
    this.menu.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.overlay.classList.add('hidden');
    this.refreshMenu();
  }
  showHUD() {
    this.menu.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.overlay.classList.add('hidden');
    this.resize();
  }
  refreshMenu() {
    const d = Save.data;
    const rank = Save.rank();
    const rp = Save.rankProgress();
    $('profile-name').textContent = rank.name;
    $('profile-rank').textContent = `Cấp ${Math.floor(d.xp / 250) + 1} · ${fmt(d.xp)} XP`;
    $('menu-coins').textContent = fmt(d.coins);
    $('stat-kills').textContent = fmt(d.kills);
    $('stat-story').textContent = `${d.storyDone.length}/5`;
    $('stat-best').textContent = fmt(d.bestSurvival);
    const u = Save.stats();
    const bladeLvl = d.upgrades.blade || 0;
    const tier = ['I', 'I', 'II', 'II', 'III', 'III', 'IV', 'IV', 'V'][bladeLvl] || 'I';
    $('arsenal-summary').textContent = `Kiếm ${tier} · Gas ${u.gas} · Giáp ${Math.round((1 - u.armor) * 100)}%`;
    const continueBtn = $('btn-continue');
    if (d.storyProgress >= STORY.length) {
      continueBtn.innerHTML = 'CHIẾN DỊCH HOÀN THÀNH <span>✦</span>';
    } else {
      continueBtn.innerHTML = `TIẾP TỤC · CHƯƠNG ${d.storyProgress + 1} <span>▶</span>`;
    }
  }

  // ---------- HUD ----------
  setMission(kicker, title, obj) {
    $('mission-kicker').textContent = kicker;
    $('mission-title').textContent = title;
    $('mission-obj').textContent = obj;
  }
  setProgress(p) {
    $('mission-progress').style.width = Math.max(0, Math.min(1, p)) * 100 + '%';
  }
  setTitanCount(n, wave) {
    $('titan-count').textContent = n;
    $('wave-label').textContent = wave || '—';
  }
  setVitals(p) {
    $('hp-fill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    $('gas-fill').style.width = Math.max(0, p.gas / p.maxGas * 100) + '%';
    $('blade-fill').style.width = Math.max(0, p.blade / p.maxBlade * 100) + '%';
    $('hp-text').textContent = Math.ceil(p.hp);
    $('gas-text').textContent = Math.ceil(p.gas);
    $('blade-text').textContent = Math.ceil(p.blade);
    document.querySelector('.vital.hp').classList.toggle('low', p.hp / p.maxHp < .3);
  }
  setCombo(n, ratio, tag) {
    const wrap = $('combo-wrap');
    if (n > 1) {
      wrap.classList.remove('hidden');
      $('combo-num').textContent = n;
      $('combo-tag').textContent = tag || '';
      $('combo-fill').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
    } else wrap.classList.add('hidden');
  }
  setBoss(boss) {
    const el = $('boss-bar');
    if (!boss) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('boss-name').textContent = boss.type.name;
    $('boss-fill').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
  }
  setSquad(allies, show) {
    const panel = $('squad-panel');
    if (!show) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const list = $('squad-list');
    list.innerHTML = allies.map(a => {
      const cls = a.dead ? 'down' : (a.downed ? 'down' : '');
      const status = a.dead ? 'TỬ NẠN' : (a.downed ? `${Math.ceil(a.reviveTimer)}s` : `${Math.ceil(a.hp)}`);
      return `<div class="squad-row ${cls}"><span class="dot"></span><div>${a.name}<div class="bar"><div style="width:${a.dead ? 0 : Math.max(0, a.hp)}%"></div></div></div><small>${status}</small></div>`;
    }).join('');
  }
  setLock(target, camera, playerPos) {
    const el = $('lock-reticle');
    if (!target) { el.classList.add('hidden'); return; }
    target.getCenter(_v);
    _v.project(camera);
    if (_v.z > 1) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const x = (_v.x * .5 + .5) * innerWidth;
    const y = (-_v.y * .5 + .5) * innerHeight;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    $('lock-label').textContent = target.type.name + (target.boss ? ' ★' : '');
    $('lock-hp-fill').style.width = Math.max(0, target.hp / target.maxHp * 100) + '%';
    const d = playerPos.distanceTo(target.getCenter(_v));
    $('lock-dist').textContent = Math.round(d) + 'm';
  }
  setCrosshair(show) { $('crosshair').style.display = show ? 'block' : 'none'; }
  setInteract(label) {
    const el = $('interact-prompt');
    if (!label) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('interact-label').textContent = label;
  }
  setZone(zone) {
    const el = $('zone-banner');
    $('zone-name').textContent = zone.name;
    $('zone-desc').textContent = zone.desc;
    $('map-zone').textContent = zone.name;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'zoneIn 3.2s forwards';
    setTimeout(() => el.classList.add('hidden'), 3200);
  }
  setObjective(pos, label, playerPos) {
    const el = $('objective-beacon');
    if (!pos) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('beacon-label').textContent = label || 'MỤC TIÊU';
    $('beacon-dist').textContent = Math.round(pos.distanceTo(playerPos)) + 'm';
  }
  setFps(fps, show) {
    const el = $('fps-badge');
    el.classList.toggle('hidden', !show);
    if (show) el.textContent = `${Math.round(fps)} FPS`;
  }
  flashDamage() {
    const f = $('hitflash');
    f.style.opacity = '.85';
    setTimeout(() => { f.style.opacity = '0'; }, 130);
  }
  speedlines(on) { $('speedlines').classList.toggle('on', on); }
  danger(on) { $('vignette').classList.toggle('danger', on); }

  toast(text, cls = '', ms = 2600) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    this.toastEl.appendChild(el);
    while (this.toastEl.children.length > 5) this.toastEl.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
  }

  drawMinimap(player, titans, allies, objective) {
    const ctx = this.mctx;
    const w = this.minimap.clientWidth || 166;
    const h = this.minimap.clientHeight || 166;
    const R = 210;
    const cx = w / 2, cy = h / 2;
    const scale = (w * .44) / R;
    const px = player.pos ? player.pos.x : player.x;
    const pz = player.pos ? player.pos.z : player.z;
    const pyaw = player.yaw || 0;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, w / 2);
    grad.addColorStop(0, 'rgba(25,33,38,.94)');
    grad.addColorStop(1, 'rgba(5,8,10,.96)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 1, 0, 6.3); ctx.fill();

    const toMap = (x, z) => {
      const dx = x - px, dz = z - pz;
      return [cx + dx * scale, cy + dz * scale];
    };
    // city
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 2, 0, 6.3); ctx.clip();
    // zones blocks
    const [c1x, c1y] = toMap(-210, -180), [c2x, c2y] = toMap(210, 180);
    ctx.fillStyle = 'rgba(150,160,168,.1)';
    ctx.fillRect(c1x, c1y, c2x - c1x, c2y - c1y);
    ctx.strokeStyle = 'rgba(200,210,218,.32)'; ctx.lineWidth = 1.2;
    ctx.strokeRect(c1x, c1y, c2x - c1x, c2y - c1y);
    // gate
    const [gx, gy] = toMap(0, 180);
    ctx.fillStyle = '#e3bf78'; ctx.fillRect(gx - 2.5, gy - 1, 5, 2);
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, (w / 2 - 3) * (i + 1) / 6, 0, 6.3); ctx.stroke();
    }
    // objective
    if (objective) {
      const [ox, oy] = toMap(objective.x, objective.z);
      const ang = Math.atan2(oy - cy, ox - cx);
      const dist = Math.hypot(ox - cx, oy - cy);
      const rr = Math.min(dist, w / 2 - 9);
      const oxp = cx + Math.cos(ang) * rr, oyp = cy + Math.sin(ang) * rr;
      ctx.save(); ctx.translate(oxp, oyp); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#e3bf78'; ctx.fillRect(-2.6, -2.6, 5.2, 5.2); ctx.restore();
    }
    // titans
    for (const t of titans) {
      if (t.dead) continue;
      const [tx, ty] = toMap(t.group.position.x, t.group.position.z);
      const d = Math.hypot(tx - cx, ty - cy);
      if (d > w / 2 - 4) continue;
      ctx.fillStyle = t.boss ? '#ff8b68' : '#e04432';
      ctx.beginPath(); ctx.arc(tx, ty, t.boss ? 3.4 : 2.1, 0, 6.3); ctx.fill();
      if (t.boss) { ctx.strokeStyle = 'rgba(255,139,104,.4)'; ctx.beginPath(); ctx.arc(tx, ty, 6, 0, 6.3); ctx.stroke(); }
    }
    // allies
    for (const a of allies || []) {
      if (a.dead) continue;
      const [ax, ay] = toMap(a.group.position.x, a.group.position.z);
      if (Math.hypot(ax - cx, ay - cy) > w / 2 - 4) continue;
      ctx.fillStyle = a.downed ? '#e3bf78' : '#63d69b';
      ctx.beginPath(); ctx.arc(ax, ay, 2, 0, 6.3); ctx.fill();
    }
    // player arrow
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-pyaw + Math.PI);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 4); ctx.lineTo(0, 2); ctx.lineTo(-3.5, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // ring
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 1, 0, 6.3); ctx.stroke();
  }

  updateMarkers(titans, camera, playerPos) {
    const near = titans.filter(t => !t.dead && t.group.position.distanceTo(playerPos) < 140).slice(0, this.markers.length);
    for (let i = 0; i < this.markers.length; i++) {
      const el = this.markers[i];
      const t = near[i];
      if (!t) { el.style.display = 'none'; continue; }
      t.getCenter(_v);
      const dist = _v.distanceTo(playerPos);
      _v.project(camera);
      if (_v.z > 1 || _v.x < -1.15 || _v.x > 1.15 || _v.y < -1.15 || _v.y > 1.15) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.left = ((_v.x * .5 + .5) * innerWidth) + 'px';
      el.style.top = ((-_v.y * .5 + .5) * innerHeight) + 'px';
      el.classList.toggle('locked', t === this.game.player?.lockTarget);
      el.classList.toggle('boss', !!t.boss);
      el.querySelector('b').textContent = t.type.name;
      el.querySelector('span').textContent = Math.round(dist) + 'm';
      el.querySelector('.tm-bar i').style.width = Math.max(0, t.hp / t.maxHp * 100) + '%';
      const nape = t.getNapePoint(new THREE.Vector3());
      const nd = nape.distanceTo(playerPos);
      el.querySelector('.tm-nape').style.opacity = nd < 18 ? '1' : '0';
    }
  }

  updateHUD(dt, player, titans, allies, objective, boss, camera) {
    if (!player) return;
    this.setVitals(player);
    this.setCombo(player.combo, player.comboTimer / Math.max(.1, player.stats.comboWindow), player.combo >= 4 ? 'XUẤT SẮC' : player.combo >= 2 ? 'TỐT' : '');
    this.setLock(player.lockTarget, camera, player.pos);
    this.setCrosshair(!player.lockTarget);
    this.updateMarkers(titans, camera, player.pos);
    this.mapAcc += dt;
    if (this.mapAcc > .08) {
      this.mapAcc = 0;
      this.drawMinimap(player.pos, titans, allies, objective);
    }
    this.setBoss(boss);
    this.setFps(this.game.fps, this.game.settings.showFps);
    this.speedlines(player.hook.active && player.vel.length() > 26);
    this.danger(player.hp / player.maxHp < .3);
  }

  // ---------- OVERLAY ----------
  bindOverlay() {
    this.card.addEventListener('click', (e) => {
      const close = e.target.closest('[data-close]');
      if (close) { this.game.audio?.play('ui'); this.game.closeOverlay(); return; }
      const buy = e.target.closest('[data-buy]');
      if (buy) { this.game.buyUpgrade(buy.dataset.buy); return; }
      const story = e.target.closest('[data-story]');
      if (story) { this.game.startStory(parseInt(story.dataset.story, 10)); return; }
      const setting = e.target.closest('[data-setting]');
      if (setting) {
        const key = setting.dataset.setting;
        const val = setting.dataset.value;
        this.game.updateSetting(key, val);
        return;
      }
      const action = e.target.closest('[data-act]');
      if (action) { this.game.overlayAction(action.dataset.act); return; }
    });
    this.card.addEventListener('input', (e) => {
      const range = e.target.closest('[data-range]');
      if (!range) return;
      const key = range.dataset.range;
      this.game.updateSetting(key, parseFloat(range.value));
      const val = this.card.querySelector(`[data-val="${key}"]`);
      if (val) val.textContent = key === 'sensitivity' ? Number(range.value).toFixed(2) + 'x' : range.value;
    });
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay && this.game.overlayClosable) this.game.closeOverlay();
    });
  }

  open(html, closable = true) {
    this.overlayClosable = closable;
    this.card.innerHTML = html;
    this.overlay.classList.remove('hidden');
    this.card.scrollTop = 0;
  }
  close() { this.overlay.classList.add('hidden'); }

  panelSettings() {
    const s = Save.settings;
    const q = Object.entries(QUALITY).map(([k, v]) =>
      `<button data-setting="quality" data-value="${k}" class="${s.quality === k ? 'active' : ''}">${v.label}</button>`).join('');
    const fps = FPS_CAPS.map(v =>
      `<button data-setting="fps" data-value="${v}" class="${s.fps === v ? 'active' : ''}">${v}</button>`).join('');
    const toggle = (key, label, desc) =>
      `<div class="setting-row"><div class="lbl">${label}<small>${desc}</small></div><button class="toggle ${s[key] ? 'on' : ''}" data-setting="${key}" data-value="${!s[key]}"></button></div>`;
    return `<div class="ov-head"><div><div class="ov-kicker">CẤU HÌNH HỆ THỐNG</div><h2>Cài đặt</h2><p>Tinh chỉnh đồ họa, khung hình và điều khiển. Mọi thay đổi được lưu tự động.</p></div><button class="ov-close" data-close>✕</button></div>
      <div class="ov-body">
        <div class="settings-group"><h3>ĐỒ HỌA</h3>
          <div class="setting-row"><div class="lbl">Chất lượng đồ họa<small>Low → Extreme: bóng đổ, tầm nhìn, mật độ cây cỏ, hạt hiệu ứng</small></div><div class="seg">${q}</div></div>
          <div class="setting-row"><div class="lbl">Giới hạn FPS<small>30–120 FPS tùy cấu hình máy</small></div><div class="seg">${fps}</div></div>
          ${toggle('showFps', 'Hiển thị FPS', 'Bộ đếm khung hình ở góc màn hình')}
          ${toggle('shake', 'Rung camera', 'Rung khi chém trúng và nhận sát thương')}
        </div>
        <div class="settings-group"><h3>ĐIỀU KHIỂN</h3>
          <div class="setting-row"><div class="lbl">Độ nhạy camera<small>Kéo camera bằng chuột hoặc vuốt nửa phải màn hình</small></div><input type="range" min="0.35" max="2.2" step="0.05" value="${s.sensitivity}" data-range="sensitivity"><div class="setting-val" data-val="sensitivity">${Number(s.sensitivity).toFixed(2)}x</div></div>
          ${toggle('invertY', 'Đảo trục Y', 'Đảo chiều camera dọc')}
          ${toggle('vibration', 'Rung thiết bị', 'Phản hồi rung trên điện thoại (nếu hỗ trợ)')}
          ${toggle('autoLock', 'Tự khóa mục tiêu', 'Tự chọn Titan gần nhất khi không có mục tiêu')}
        </div>
        <div class="settings-group"><h3>ÂM THANH</h3>
          ${toggle('sound', 'Hiệu ứng âm thanh', 'Tiếng kiếm, Titan, ODM và giao diện')}
          ${toggle('music', 'Nhạc nền', 'Drone nền điện ảnh')}
        </div>
        <div class="settings-group"><h3>DỮ LIỆU</h3>
          <div class="setting-row"><div class="lbl">Xóa tiến trình<small>Đặt lại cấp độ, xu, nâng cấp và cốt truyện</small></div><button class="btn danger" data-act="reset" style="height:34px;font-size:8px">ĐẶT LẠI</button></div>
        </div>
      </div>
      <div class="ov-foot"><button class="btn ghost" data-close>ĐÓNG</button></div>`;
  }

  panelUpgrades() {
    const d = Save.data;
    const st = Save.stats();
    const cards = Object.entries(UPGRADES).map(([key, u]) => {
      const lvl = d.upgrades[key] || 0;
      const max = lvl >= u.max;
      const cost = Save.upgradeCost(key);
      const afford = d.coins >= cost;
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      return `<div class="up-card">
        <div class="up-top"><div class="up-icon">${u.icon}</div><div><div class="up-name">${u.name}</div><div class="up-lvl">CẤP ${lvl} / ${u.max} · ${u.stat(lvl)}</div></div></div>
        <div class="up-desc">${u.desc}</div>
        <div class="up-pips">${pips}</div>
        <button class="up-buy" data-buy="${key}" ${max || !afford ? 'disabled' : ''}>
          <span>${max ? 'ĐÃ TỐI ĐA' : `NÂNG CẤP · CẤP ${lvl + 1}`}</span><span>◈ ${max ? '—' : fmt(cost)}</span>
        </button>
      </div>`;
    }).join('');
    return `<div class="ov-head"><div><div class="ov-kicker">KHO VŨ KHÍ</div><h2>Nâng cấp trang bị</h2><p>Dùng xu nhận được từ nhiệm vụ để tăng sức mạnh. Nâng cấp áp dụng ngay trong trận kế tiếp.</p></div><button class="ov-close" data-close>✕</button></div>
      <div class="ov-body">
        <div class="up-stats">
          <div>SÁT THƯƠNG<b>+${Math.round((st.damage - 1) * 100)}%</b></div>
          <div>HP<b>${st.hp}</b></div>
          <div>GAS<b>${st.gas}</b></div>
          <div>GIẢM SÁT THƯƠNG<b>${Math.round((1 - st.armor) * 100)}%</b></div>
          <div>COMBO<b>${st.comboWindow.toFixed(2)}s</b></div>
          <div>XU<b style="color:var(--gold)">◈ ${fmt(d.coins)}</b></div>
        </div>
        <div class="upgrade-grid">${cards}</div>
      </div>
      <div class="ov-foot"><button class="btn ghost" data-close>ĐÓNG</button></div>`;
  }

  panelStory() {
    const d = Save.data;
    const chapters = STORY.map((c, i) => {
      const locked = i > d.storyProgress;
      const done = d.storyDone.includes(i);
      return `<button class="chapter ${locked ? 'locked' : ''} ${done ? 'done' : ''}" ${locked ? 'disabled' : `data-story="${i}"`}>
        <div class="num">${done ? '✓' : String(i + 1).padStart(2, '0')}</div>
        <div><b>${c.title}</b><span>${c.brief}</span></div>
        <div class="go ${locked ? 'locked' : ''}">${locked ? 'KHÓA' : done ? 'CHƠI LẠI' : 'BẮT ĐẦU'}</div>
      </button>`;
    }).join('');
    return `<div class="ov-head"><div><div class="ov-kicker">CHIẾN DỊCH</div><h2>Chọn chương</h2><p>Hoàn thành chương trước để mở khóa chương tiếp theo. Phần thưởng tăng dần theo độ khó.</p></div><button class="ov-close" data-close>✕</button></div>
      <div class="ov-body"><div class="story-list">${chapters}</div></div>
      <div class="ov-foot"><button class="btn ghost" data-close>ĐÓNG</button></div>`;
  }

  panelControls() {
    return `<div class="ov-head"><div><div class="ov-kicker">HƯỚNG DẪN</div><h2>Điều khiển</h2><p>Game hỗ trợ bàn phím + chuột trên máy tính và cảm ứng đa điểm trên điện thoại.</p></div><button class="ov-close" data-close>✕</button></div>
      <div class="ov-body">
        <div class="settings-group"><h3>BÀN PHÍM / CHUỘT</h3><div class="controls-grid">
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><span>Di chuyển</span></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>Space</kbd></div><span>Nhảy / thả móc</span><em>Nhấn lần nữa để nhảy</em></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>LMB</kbd></div><span>Chém kiếm</span><em>Combo 3 đòn</em></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>RMB</kbd></div><span>Móc ODM</span><em>Bấm lần nữa để thả</em></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>Shift</kbd></div><span>Gas / chạy nước rút</span><em>Giữ</em></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>Tab</kbd><kbd>L</kbd></div><span>Khóa mục tiêu</span></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>Q</kbd></div><span>Lộn né</span><em>Bất tử ngắn</em></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>E</kbd></div><span>Tương tác / giải cứu</span></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>P</kbd><kbd>Esc</kbd></div><span>Tạm dừng</span></div>
          <div class="ctrl-row"><div class="ctrl-keys"><kbd>Wheel</kbd></div><span>Thu phóng camera</span></div>
        </div></div>
        <div class="settings-group"><h3>CẢM ỨNG</h3><div class="controls-grid">
          <div class="ctrl-row"><div class="ctrl-keys">◐</div><span>Joystick trái</span><em>Di chuyển 3D</em></div>
          <div class="ctrl-row"><div class="ctrl-keys">◑</div><span>Vuốt nửa phải</span><em>Xoay camera</em></div>
          <div class="ctrl-row"><div class="ctrl-keys">⚔</div><span>Nút CHÉM</span><em>Combo</em></div>
          <div class="ctrl-row"><div class="ctrl-keys">⌁</div><span>Nút MÓC</span><em>ODM gear</em></div>
          <div class="ctrl-row"><div class="ctrl-keys">»</div><span>Nút GAS</span><em>Giữ để tăng tốc</em></div>
          <div class="ctrl-row"><div class="ctrl-keys">↑</div><span>Nút NHẢY</span></div>
          <div class="ctrl-row"><div class="ctrl-keys">◎</div><span>Nút KHÓA</span></div>
          <div class="ctrl-row"><div class="ctrl-keys">⟲</div><span>Nút NÉ</span></div>
        </div></div>
        <div class="settings-group"><h3>MẸO CHIẾN ĐẤU</h3>
          <p style="font-size:11px;line-height:1.7;color:#aab6bf">• Móc vào tòa nhà cao, giữ GAS để lấy đà rồi chém khi bay qua gáy Titan.<br/>
          • Titan Bọc Thép và Khổng Lồ chỉ nhận sát thương lớn khi chém GÁY từ phía sau, trên cao.<br/>
          • Khóa mục tiêu để đòn chém tự lao tới. Combo 3 đòn có đòn kết liễu mạnh hơn.<br/>
          • Hạ cánh để hồi HP, GAS và mài lưỡi kiếm. Đừng để cạn gas giữa không trung.</p>
        </div>
      </div>
      <div class="ov-foot"><button class="btn ghost" data-close>ĐÓNG</button></div>`;
  }

  panelPause() {
    const g = this.game;
    return `<div class="ov-head"><div><div class="ov-kicker">TẠM DỪNG</div><h2>${g.modeLabel || 'Trận chiến'}</h2><p>${g.missionTitle || 'Tự do khám phá'}</p></div><button class="ov-close" data-act="resume">✕</button></div>
      <div class="ov-body"><div class="pause-grid">
        <button class="btn primary" data-act="resume">TIẾP TỤC</button>
        <button class="btn ghost" data-act="restart">CHƠI LẠI</button>
        <button class="btn ghost" data-act="settings">CÀI ĐẶT</button>
        <button class="btn ghost" data-act="controls">ĐIỀU KHIỂN</button>
        <button class="btn ghost" data-act="upgrades">NÂNG CẤP</button>
        <button class="btn danger" data-act="quit">THOÁT VỀ MENU</button>
      </div>
      <div class="up-stats" style="margin-top:16px;margin-bottom:0">
        <div>TITAN ĐÃ HẠ<b>${g.stats.kills}</b></div>
        <div>SÁT THƯƠNG<b>${fmt(g.stats.damage)}</b></div>
        <div>COMBO CAO NHẤT<b>${g.stats.bestCombo}</b></div>
        <div>THỜI GIAN<b>${this.timeStr(g.stats.time)}</b></div>
      </div></div>`;
  }

  panelResult(win, title, sub, reward, extra) {
    const g = this.game;
    return `<div class="ov-head"><div><div class="ov-kicker">${win ? 'NHIỆM VỤ HOÀN THÀNH' : 'NHIỆM VỤ THẤT BẠI'}</div><h2 class="result-title ${win ? 'win' : 'lose'}">${title}</h2><p>${sub}</p></div></div>
      <div class="ov-body">
        <div class="result-stats">
          <div class="result-stat"><b>${g.stats.kills}</b><span>TITAN HẠ</span></div>
          <div class="result-stat"><b>${fmt(g.stats.damage)}</b><span>SÁT THƯƠNG</span></div>
          <div class="result-stat"><b>${g.stats.bestCombo}</b><span>COMBO CAO</span></div>
          <div class="result-stat"><b>${this.timeStr(g.stats.time)}</b><span>THỜI GIAN</span></div>
        </div>
        ${reward > 0 ? `<div class="reward-line"><span>PHẦN THƯỞNG NHẬN ĐƯỢC</span><b>◈ ${fmt(reward)}</b></div>` : ''}
        ${extra || ''}
      </div>
      <div class="ov-foot">
        <button class="btn ghost" data-act="quit">VỀ MENU</button>
        <button class="btn ghost" data-act="restart">CHƠI LẠI</button>
        ${win && g.canNextStory ? '<button class="btn primary" data-act="next">CHƯƠNG TIẾP</button>' : (win ? '<button class="btn primary" data-act="quit">TIẾP TỤC</button>' : '')}
      </div>`;
  }

  panelBriefing(mission, onStart) {
    const objectives = mission.objectives.map(o => `<div><i></i>${o.label}</div>`).join('');
    this.game.briefingStart = onStart;
    return `<div class="ov-head"><div><div class="ov-kicker">${mission.kicker || 'NHIỆM VỤ'}</div><h2>${mission.title}</h2><p>${mission.brief}</p></div></div>
      <div class="ov-body">
        <div class="brief-art"><b>${mission.artTitle || mission.title}</b><span>${mission.artSub || 'CHIẾN DỊCH TỰ DO'}</span></div>
        <div class="objective-list">${objectives}</div>
        <div class="up-stats"><div>ĐỊA ĐIỂM<b>${mission.zoneLabel || 'THÀNH PHỐ'}</b></div><div>PHẦN THƯỞNG<b style="color:var(--gold)">◈ ${fmt(mission.reward || 0)}</b></div><div>ĐỘ KHÓ<b>${mission.diff || 'THƯỜNG'}</b></div></div>
      </div>
      <div class="ov-foot"><button class="btn ghost" data-act="quit">HỦY</button><button class="btn primary" data-act="start">BẮT ĐẦU NHIỆM VỤ ▶</button></div>`;
  }

  showDialogue(lines, done) {
    this.dialogueQueue = lines.slice();
    this.dialogueDone = done;
    this.dialogueActive = true;
    const el = $('dialogue');
    el.classList.remove('hidden');
    this.renderDialogueLine();
  }
  renderDialogueLine() {
    const line = this.dialogueQueue[0];
    if (!line) { this.endDialogue(); return; }
    $('dlg-speaker').textContent = line.who;
    $('dlg-portrait').textContent = line.who.includes('BẠN') ? 'B' : line.who.includes('KAI') ? 'K' : 'S';
    const p = $('dlg-text');
    p.textContent = line.text;
    $('dlg-next').textContent = this.dialogueQueue.length > 1 ? 'TIẾP ▸' : 'BẮT ĐẦU ▸';
    if (this.game.settings.sound) this.game.audio?.play('ui');
  }
  advanceDialogue() {
    if (!this.dialogueActive) return;
    this.dialogueQueue.shift();
    if (!this.dialogueQueue.length) { this.endDialogue(); return; }
    this.renderDialogueLine();
  }
  endDialogue() {
    this.dialogueActive = false;
    $('dialogue').classList.add('hidden');
    const cb = this.dialogueDone;
    this.dialogueDone = null;
    cb?.();
  }

  timeStr(t) {
    const s = Math.floor(t || 0);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
}
