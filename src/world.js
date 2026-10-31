import * as THREE from '../vendor/three/three.module.min.js';
import { QUALITY, ZONES, rand, randInt, pick, clamp } from './config.js';

const MAP = 1400;
const HALF = MAP / 2;
const CITY = { x1: -210, x2: 210, z1: -180, z2: 180 };
const WALL_H = 26;

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeFacadeTexture() {
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#9aa0a3'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let y = 0; y < s; y += 16) ctx.fillRect(0, y, s, 2);
    for (let y = 6; y < s - 8; y += 16) {
      for (let x = 8; x < s - 8; x += 18) {
        const lit = Math.random() < 0.28;
        ctx.fillStyle = lit ? 'rgba(255,214,148,.72)' : 'rgba(36,44,50,.82)';
        ctx.fillRect(x, y, 9, 7);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (let x = 0; x < s; x += 32) ctx.fillRect(x, 0, 1, s);
  });
}

function makeStoneTexture() {
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#9d988b'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(55,52,46,.45)'; ctx.lineWidth = 2;
    for (let y = 0; y < s; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      const off = (y / 16) % 2 ? 16 : 0;
      for (let x = off; x < s; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.stroke();
      }
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(${randInt(40, 80)},${randInt(38, 70)},${randInt(32, 60)},${rand(.03, .12)})`;
      ctx.fillRect(rand(0, s), rand(0, s), rand(1, 7), rand(1, 5));
    }
  });
}

function makeGroundTexture(quality) {
  const size = quality === 'low' ? 1024 : 2048;
  const tex = canvasTexture(size, (ctx, s) => {
    const px = x => (x + HALF) / MAP * s;
    const pz = z => (z + HALF) / MAP * s;
    // base grassland
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#6c8450'); g.addColorStop(.45, '#768d58'); g.addColorStop(1, '#647c4b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

    // wasteland west
    const wg = ctx.createLinearGradient(0, 0, px(-180), 0);
    wg.addColorStop(0, '#9c7a54'); wg.addColorStop(.7, '#a9855e'); wg.addColorStop(1, 'rgba(155,122,84,0)');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, px(-180), s);
    for (let i = 0; i < 380; i++) {
      const x = rand(0, px(-180)), y = rand(0, s);
      ctx.fillStyle = `rgba(${randInt(80, 150)},${randInt(60, 110)},${randInt(40, 80)},${rand(.03, .14)})`;
      ctx.beginPath(); ctx.ellipse(x, y, rand(6, 42), rand(4, 24), rand(0, 6.3), 0, 6.3); ctx.fill();
    }

    // forest north-east
    ctx.fillStyle = 'rgba(45,74,45,.55)';
    ctx.fillRect(px(0), 0, s - px(0), pz(-195));
    for (let i = 0; i < 260; i++) {
      const x = rand(px(0), s), y = rand(0, pz(-195));
      ctx.fillStyle = `rgba(${randInt(35, 68)},${randInt(60, 95)},${randInt(35, 62)},${rand(.04, .16)})`;
      ctx.beginPath(); ctx.arc(x, y, rand(8, 40), 0, 6.3); ctx.fill();
    }

    // city slab
    ctx.fillStyle = '#7c8081';
    ctx.fillRect(px(CITY.x1), pz(CITY.z1), px(CITY.x2) - px(CITY.x1), pz(CITY.z2) - pz(CITY.z1));
    ctx.fillStyle = 'rgba(30,32,34,.13)';
    for (let i = 0; i < 500; i++) ctx.fillRect(rand(px(CITY.x1), px(CITY.x2)), rand(pz(CITY.z1), pz(CITY.z2)), rand(2, 12), rand(2, 8));

    // city roads
    ctx.strokeStyle = '#4b4f52'; ctx.lineWidth = Math.max(6, s / 120);
    for (let x = -200; x <= 200; x += 34) {
      ctx.beginPath(); ctx.moveTo(px(x), pz(CITY.z1)); ctx.lineTo(px(x), pz(CITY.z2)); ctx.stroke();
    }
    for (let z = -170; z <= 170; z += 34) {
      ctx.beginPath(); ctx.moveTo(px(CITY.x1), pz(z)); ctx.lineTo(px(CITY.x2), pz(z)); ctx.stroke();
    }
    ctx.strokeStyle = '#55595b'; ctx.lineWidth = Math.max(12, s / 62);
    ctx.beginPath(); ctx.moveTo(px(0), pz(CITY.z1)); ctx.lineTo(px(0), pz(CITY.z2)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(CITY.x1), pz(20)); ctx.lineTo(px(CITY.x2), pz(20)); ctx.stroke();

    // plaza
    ctx.fillStyle = '#8d8f8a';
    ctx.beginPath(); ctx.arc(px(0), pz(20), (38 / MAP) * s, 0, 6.3); ctx.fill();
    ctx.strokeStyle = 'rgba(50,50,48,.35)'; ctx.lineWidth = 2;
    for (let r = 8; r < 36; r += 7) { ctx.beginPath(); ctx.arc(px(0), pz(20), (r / MAP) * s, 0, 6.3); ctx.stroke(); }

    // south road out of gate
    ctx.strokeStyle = '#6b6150'; ctx.lineWidth = Math.max(12, s / 70);
    ctx.beginPath(); ctx.moveTo(px(0), pz(CITY.z2)); ctx.lineTo(px(0), s); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,62,48,.5)'; ctx.lineWidth = Math.max(4, s / 220);
    ctx.beginPath(); ctx.moveTo(px(0), pz(CITY.z2)); ctx.lineTo(px(0), s); ctx.stroke();

    // forest trails
    ctx.strokeStyle = 'rgba(100,82,58,.55)'; ctx.lineWidth = Math.max(4, s / 260);
    ctx.beginPath(); ctx.moveTo(px(20), pz(-190)); ctx.quadraticCurveTo(px(100), pz(-300), px(160), pz(-430)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(160), pz(-430)); ctx.quadraticCurveTo(px(260), pz(-460), px(420), pz(-420)); ctx.stroke();

    // grass speckles
    for (let i = 0; i < 2600; i++) {
      const x = rand(0, s), y = rand(0, s);
      ctx.fillStyle = `rgba(${randInt(60, 130)},${randInt(80, 150)},${randInt(45, 90)},${rand(.04, .16)})`;
      ctx.fillRect(x, y, rand(1, 4), rand(1, 4));
    }
  });
  tex.anisotropy = 8;
  return tex;
}

function makeSky() {
  const geo = new THREE.SphereGeometry(1800, 24, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2d4a63) },
      mid: { value: new THREE.Color(0x8fa6ae) },
      bottom: { value: new THREE.Color(0xd6c5a8) },
      sunDir: { value: new THREE.Vector3(0.5, 0.42, 0.35).normalize() }
    },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top,mid,bottom,sunDir;
      void main(){ vec3 d=normalize(vP); float h=clamp(d.y*1.15+.02,0.,1.);
      vec3 c=mix(bottom,mid,smoothstep(0.,.3,h)); c=mix(c,top,smoothstep(.22,.9,h));
      float sun=pow(max(dot(d,normalize(sunDir)),0.),180.); c+=vec3(1.,.82,.55)*sun*.55;
      float haze=pow(1.-abs(d.y),8.)*.08; c+=vec3(.9,.8,.65)*haze;
      gl_FragColor=vec4(c,1.); }`
  });
  return new THREE.Mesh(geo, mat);
}

export class World {
  constructor(scene, renderer, qualityKey = 'high') {
    this.scene = scene;
    this.renderer = renderer;
    this.qualityKey = qualityKey;
    this.colliders = [];
    this.anchors = [];
    this.trees = [];
    this.gate = null;
    this.clouds = [];
    this.dust = null;
    this.time = 0;
    this.build();
  }

  build() {
    const q = QUALITY[this.qualityKey] || QUALITY.high;
    this.q = q;
    this.scene.fog = new THREE.Fog(0xaeb9b4, q.fog[0], q.fog[1]);
    this.scene.background = new THREE.Color(0x9fb1b4);
    this.scene.add(makeSky());

    // lights
    const hemi = new THREE.HemisphereLight(0xc4d6e4, 0x4d4634, 1.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe0b6, 2.25);
    sun.position.set(220, 300, 150);
    sun.castShadow = q.shadows;
    if (q.shadows) {
      sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      sun.shadow.camera.near = 20;
      sun.shadow.camera.far = 900;
      const s = 420;
      sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
      sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
      sun.shadow.bias = -0.0007;
      sun.shadow.normalBias = 0.35;
    }
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.hemi = hemi;

    // ground
    const groundTex = makeGroundTexture(this.qualityKey);
    const groundMat = new THREE.MeshLambertMaterial({ map: groundTex, color: 0xffffff });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = q.shadows;
    this.scene.add(ground);
    this.ground = ground;

    // distant mountains
    const mountainMat = new THREE.MeshLambertMaterial({ color: 0x6e8084, flatShading: true });
    const mountCount = this.qualityKey === 'low' ? 12 : 22;
    for (let i = 0; i < mountCount; i++) {
      const a = (i / mountCount) * Math.PI * 2 + rand(-.08, .08);
      const r = rand(800, 1080);
      const h = rand(90, 250);
      const m = new THREE.Mesh(new THREE.ConeGeometry(rand(100, 240), h, 5), mountainMat);
      m.position.set(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r);
      m.rotation.y = rand(0, 6.3);
      this.scene.add(m);
    }

    this.buildCity(q);
    this.buildWalls(q);
    this.buildForest(q);
    this.buildGrass(q);
    this.buildWasteland(q);
    this.buildClouds(q);

    // ambient dust in wasteland
    if (q.dust > 0) {
      const pos = new Float32Array(q.dust * 3);
      for (let i = 0; i < q.dust; i++) {
        pos[i * 3] = rand(-620, -230);
        pos[i * 3 + 1] = rand(0.4, 12);
        pos[i * 3 + 2] = rand(-600, 600);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0xd3b58d, size: 0.55, transparent: true, opacity: 0.5, depthWrite: false });
      this.dust = new THREE.Points(g, m);
      this.scene.add(this.dust);
    }
  }

  buildCity(q) {
    const facade = makeFacadeTexture();
    const mat = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.86, metalness: 0.04 });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const maxBuildings = q.buildings;
    const placements = [];
    for (let gx = -5; gx <= 5; gx++) {
      for (let gz = -4; gz <= 4; gz++) {
        if (gx === 0 && gz === 0) continue;
        const cx = gx * 36 + rand(-3, 3);
        const cz = gz * 36 + rand(-3, 3) + 15;
        if (cz > 128 && Math.abs(cx) < 30) continue;
        if (Math.abs(cx) < 16 && Math.abs(cz - 20) < 26) continue;
        const n = Math.random() < 0.34 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const w = rand(13, 24), d = rand(13, 23);
          const px = cx + (n === 2 ? (k ? 10 : -10) : 0) + rand(-1, 1);
          const pz = cz + rand(-2, 2);
          const landmark = Math.abs(gx) <= 2 && Math.abs(gz) <= 2 && Math.random() < 0.14;
          const h = landmark ? rand(48, 86) : rand(9, 34);
          placements.push({ x: px, z: pz, w, d, h });
          if (placements.length >= maxBuildings) break;
        }
        if (placements.length >= maxBuildings) break;
      }
      if (placements.length >= maxBuildings) break;
    }
    // guarantee a couple of towers near center for ODM
    placements.push({ x: -58, z: 4, w: 20, d: 20, h: 68 });
    placements.push({ x: 62, z: -46, w: 18, d: 22, h: 74 });
    placements.push({ x: -78, z: -96, w: 22, d: 18, h: 56 });

    const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
    mesh.castShadow = q.shadows;
    mesh.receiveShadow = q.shadows;
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const palette = [0x9b9488, 0xa8a093, 0x8c8f8b, 0xb0a89a, 0x938f86, 0xa39b8b];
    placements.forEach((b, i) => {
      m4.makeScale(b.w, b.h, b.d);
      m4.setPosition(b.x, b.h / 2, b.z);
      mesh.setMatrixAt(i, m4);
      col.setHex(pick(palette)).multiplyScalar(rand(.88, 1.06));
      mesh.setColorAt(i, col);
      const c = {
        minX: b.x - b.w / 2, maxX: b.x + b.w / 2,
        minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2,
        top: b.h, type: 'building'
      };
      this.colliders.push(c);
      this.anchors.push(
        new THREE.Vector3(b.x, b.h + 0.5, b.z),
        new THREE.Vector3(b.x - b.w / 2, b.h + 0.5, b.z - b.d / 2),
        new THREE.Vector3(b.x + b.w / 2, b.h + 0.5, b.z + b.d / 2),
        new THREE.Vector3(b.x - b.w / 2, b.h + 0.5, b.z + b.d / 2),
        new THREE.Vector3(b.x + b.w / 2, b.h + 0.5, b.z - b.d / 2)
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.cityMesh = mesh;

    // rooftop water tanks / chimneys for silhouette
    const tankGeo = new THREE.CylinderGeometry(1.4, 1.4, 3.4, 6);
    const tankMat = new THREE.MeshLambertMaterial({ color: 0x5c5145 });
    const tanks = new THREE.InstancedMesh(tankGeo, tankMat, Math.min(70, placements.length));
    let ti = 0;
    for (const b of placements) {
      if (ti >= tanks.count) break;
      if (b.h > 30 || Math.random() < 0.35) {
        m4.makeTranslation(b.x + rand(-3, 3), b.h + 1.7, b.z + rand(-3, 3));
        tanks.setMatrixAt(ti++, m4);
      }
    }
    tanks.count = ti;
    tanks.instanceMatrix.needsUpdate = true;
    tanks.castShadow = q.shadows;
    this.scene.add(tanks);
    this.tanks = tanks;

    // street props: crates and lamps
    const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x71563c });
    const crates = new THREE.InstancedMesh(crateGeo, crateMat, 60);
    for (let i = 0; i < crates.count; i++) {
      m4.makeRotationY(rand(0, 6.3));
      m4.setPosition(rand(-190, 190), 0.8, rand(-160, 160));
      crates.setMatrixAt(i, m4);
    }
    crates.instanceMatrix.needsUpdate = true;
    crates.castShadow = q.shadows;
    this.scene.add(crates);

    const lampGeo = new THREE.CylinderGeometry(0.12, 0.15, 6, 5);
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x3b3a36 });
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 40);
    for (let i = 0; i < lamps.count; i++) {
      m4.makeTranslation(rand(-190, 190), 3, rand(-150, 150));
      lamps.setMatrixAt(i, m4);
    }
    lamps.instanceMatrix.needsUpdate = true;
    this.scene.add(lamps);
  }

  addBox(collider, mat, shadow) {
    const w = collider.maxX - collider.minX;
    const d = collider.maxZ - collider.minZ;
    const h = collider.top;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set((collider.minX + collider.maxX) / 2, h / 2, (collider.minZ + collider.maxZ) / 2);
    mesh.castShadow = shadow; mesh.receiveShadow = shadow;
    this.scene.add(mesh);
    return mesh;
  }

  buildWalls(q) {
    const stone = makeStoneTexture();
    stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
    stone.repeat.set(3, 1.4);
    const mat = new THREE.MeshStandardMaterial({ map: stone, color: 0xbdb6a6, roughness: 0.95, metalness: 0.02 });
    const T = 7;
    const segments = [
      { minX: -210, maxX: 210, minZ: -183, maxZ: -176, top: WALL_H }, // north
      { minX: -210, maxX: -12, minZ: 176, maxZ: 183, top: WALL_H },   // south west
      { minX: 12, maxX: 210, minZ: 176, maxZ: 183, top: WALL_H },     // south east
      { minX: 206, maxX: 213, minZ: -176, maxZ: 176, top: WALL_H },   // east
      { minX: -213, maxX: -206, minZ: -176, maxZ: 176, top: WALL_H }  // west
    ];
    for (const s of segments) {
      this.colliders.push({ ...s, type: 'wall' });
      this.addBox(s, mat, q.shadows);
    }
    // anchors along wall
    for (let x = -200; x <= 200; x += 18) {
      this.anchors.push(new THREE.Vector3(x, WALL_H + 1, -180));
      if (Math.abs(x) > 14) this.anchors.push(new THREE.Vector3(x, WALL_H + 1, 180));
    }
    for (let z = -170; z <= 170; z += 18) {
      this.anchors.push(new THREE.Vector3(210, WALL_H + 1, z));
      this.anchors.push(new THREE.Vector3(-210, WALL_H + 1, z));
    }
    // battlements
    const merlonGeo = new THREE.BoxGeometry(3, 2.4, 3.2);
    const merlonMat = new THREE.MeshLambertMaterial({ color: 0xa9a292 });
    const spots = [];
    for (let x = -205; x <= 205; x += 7) {
      spots.push([x, -180]); if (Math.abs(x) > 14) spots.push([x, 180]);
    }
    for (let z = -172; z <= 172; z += 7) { spots.push([210, z]); spots.push([-210, z]); }
    const merlons = new THREE.InstancedMesh(merlonGeo, merlonMat, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach((p, i) => { m4.makeTranslation(p[0], WALL_H + 1.2, p[1]); merlons.setMatrixAt(i, m4); });
    merlons.instanceMatrix.needsUpdate = true;
    merlons.castShadow = q.shadows;
    this.scene.add(merlons);

    // gate
    const gateGroup = new THREE.Group();
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x4b3524, roughness: 0.8, metalness: 0.25 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(24, 17, 1.6), gateMat);
    door.position.set(0, 8.5, 180);
    door.castShadow = q.shadows;
    gateGroup.add(door);
    const barMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.45 });
    for (let i = -9; i <= 9; i += 3) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 16, 0.5), barMat);
      bar.position.set(i, 8.4, 180.9);
      gateGroup.add(bar);
    }
    const arch = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 3), mat);
    arch.position.set(0, 18.5, 180);
    gateGroup.add(arch);
    this.scene.add(gateGroup);
    const gateCol = { minX: -12, maxX: 12, minZ: 177.5, maxZ: 182.5, top: 17, type: 'gate' };
    this.colliders.push(gateCol);
    this.gate = {
      group: gateGroup, door, collider: gateCol, hp: 100, maxHp: 100,
      position: new THREE.Vector3(0, 0, 180), alive: true
    };
    // banners
    const bannerMat = new THREE.MeshLambertMaterial({ color: 0x8e2a22, side: THREE.DoubleSide });
    for (const sx of [-30, 30]) {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(6, 11), bannerMat);
      banner.position.set(sx, 13, 176.4);
      this.scene.add(banner);
    }
  }

  buildForest(q) {
    const count = q.trees;
    const trunkGeo = new THREE.CylinderGeometry(0.55, 0.85, 8, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4b3826 });
    const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x395c35, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const qrot = new THREE.Quaternion();
    const e = new THREE.Euler();
    const scale = new THREE.Vector3();
    let idx = 0;
    let guard = 0;
    while (idx < count && guard++ < count * 12) {
      let x, z;
      if (Math.random() < 0.78) { x = rand(-10, 570); z = rand(-600, -215); }
      else { x = rand(250, 590); z = rand(-180, 560); }
      if (x > -230 && x < 230 && z > -200 && z < 200) continue;
      const h = rand(0.8, 1.55);
      const cr = rand(2.4, 4.8) * h;
      e.set(0, rand(0, 6.3), 0);
      qrot.setFromEuler(e);
      scale.set(h, h, h);
      m4.compose(new THREE.Vector3(x, 4 * h, z), qrot, scale);
      trunks.setMatrixAt(idx, m4);
      m4.compose(new THREE.Vector3(x, 8 * h + cr * 0.35, z), qrot, new THREE.Vector3(cr, cr * rand(.9, 1.3), cr));
      canopies.setMatrixAt(idx, m4);
      col.setHex(pick([0x35582f, 0x3f6636, 0x2f4d2c, 0x466c3a])).multiplyScalar(rand(.88, 1.08));
      canopies.setColorAt(idx, col);
      this.colliders.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - 1.1, maxZ: z + 1.1, top: 6 * h, type: 'tree' });
      this.trees.push({ x, z, h });
      if (idx % 2 === 0) this.anchors.push(new THREE.Vector3(x, 8 * h + cr, z));
      idx++;
    }
    trunks.count = idx; canopies.count = idx;
    trunks.instanceMatrix.needsUpdate = true; canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    trunks.castShadow = q.shadows; canopies.castShadow = q.shadows;
    trunks.receiveShadow = q.shadows; canopies.receiveShadow = q.shadows;
    this.scene.add(trunks, canopies);
    this.trunks = trunks; this.canopies = canopies;
  }

  buildGrass(q) {
    if (q.grass <= 0) return;
    const geo = new THREE.ConeGeometry(0.16, 1.35, 3);
    geo.translate(0, 0.67, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x7d9a52, flatShading: true, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, q.grass);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const e = new THREE.Euler();
    const qr = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (let i = 0; i < q.grass; i++) {
      let x, z;
      if (Math.random() < 0.55) { x = rand(230, 610); z = rand(-150, 610); }
      else if (Math.random() < 0.5) { x = rand(-600, 610); z = rand(210, 610); }
      else { x = rand(-600, 610); z = rand(-600, -190); }
      if (x > -220 && x < 220 && z > -190 && z < 190) { x = rand(230, 500); z = rand(-100, 500); }
      const s = rand(0.6, 1.5);
      e.set(rand(-.16, .16), rand(0, 6.3), rand(-.16, .16));
      qr.setFromEuler(e); sc.set(s, s * rand(.8, 1.5), s);
      m4.compose(new THREE.Vector3(x, 0, z), qr, sc);
      mesh.setMatrixAt(i, m4);
      col.setHex(pick([0x7d9a52, 0x8da95c, 0x6f8c49, 0x91a965]));
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = q.grassShadows;
    this.scene.add(mesh);
    this.grassMesh = mesh;
  }

  buildWasteland(q) {
    const count = q.rocks;
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a7460, flatShading: true });
    const rocks = new THREE.InstancedMesh(geo, mat, count);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const e = new THREE.Euler();
    const qr = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const x = rand(-620, -240);
      const z = rand(-600, 600);
      const s = rand(1.2, 7);
      e.set(rand(0, 3), rand(0, 6.3), rand(0, 3));
      qr.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, s * 0.34, z), qr, new THREE.Vector3(s, s * rand(.4, .9), s));
      rocks.setMatrixAt(i, m4);
      col.setHex(pick([0x806b57, 0x937c65, 0x74604f, 0x9b846b]));
      rocks.setColorAt(i, col);
      if (s > 3.2) this.colliders.push({ minX: x - s * .55, maxX: x + s * .55, minZ: z - s * .55, maxZ: z + s * .55, top: s * .8, type: 'rock' });
    }
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.castShadow = q.shadows;
    this.scene.add(rocks);
    this.rocks = rocks;

    // ruined walls
    const ruinMat = new THREE.MeshStandardMaterial({ color: 0x726b5f, roughness: 1 });
    const ruins = [];
    for (let i = 0; i < 18; i++) {
      const x = rand(-600, -250), z = rand(-560, 560);
      const w = rand(6, 20), d = rand(2, 5), h = rand(3, 15);
      ruins.push({ x, z, w, d, h });
    }
    const ruinMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ruinMat, ruins.length);
    ruins.forEach((r, i) => {
      m4.makeScale(r.w, r.h, r.d);
      m4.setPosition(r.x, r.h / 2, r.z);
      ruinMesh.setMatrixAt(i, m4);
      this.colliders.push({ minX: r.x - r.w / 2, maxX: r.x + r.w / 2, minZ: r.z - r.d / 2, maxZ: r.z + r.d / 2, top: r.h, type: 'ruin' });
      this.anchors.push(new THREE.Vector3(r.x, r.h + .5, r.z));
    });
    ruinMesh.instanceMatrix.needsUpdate = true;
    ruinMesh.castShadow = q.shadows;
    this.scene.add(ruinMesh);
  }

  buildClouds(q) {
    const size = 128;
    const tex = canvasTexture(size, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,.9)');
      g.addColorStop(.45, 'rgba(255,255,255,.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    });
    const n = this.qualityKey === 'low' ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: rand(.13, .26), depthWrite: false, fog: false });
      const sp = new THREE.Sprite(mat);
      sp.position.set(rand(-900, 900), rand(130, 260), rand(-900, 900));
      sp.scale.set(rand(140, 360), rand(40, 100), 1);
      this.scene.add(sp);
      this.clouds.push(sp);
    }
  }

  update(dt) {
    this.time += dt;
    if (this.dust) this.dust.rotation.y += dt * 0.004;
    for (const c of this.clouds) {
      c.position.x += dt * 1.1;
      if (c.position.x > 1000) c.position.x = -1000;
    }
  }

  // --- collision helpers ---
  groundHeightAt(x, z, radius = 0) {
    let h = 0;
    for (const c of this.colliders) {
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      if (c.top > h) h = c.top;
    }
    return h;
  }

  resolveCircle(pos, radius = 0.55) {
    let hit = false;
    for (const c of this.colliders) {
      if (pos.y >= c.top - 0.15) continue;
      if (c.type === 'gate' && !this.gate?.alive) continue;
      const nx = clamp(pos.x, c.minX, c.maxX);
      const nz = clamp(pos.z, c.minZ, c.maxZ);
      let dx = pos.x - nx, dz = pos.z - nz;
      let d = Math.hypot(dx, dz);
      if (d >= radius) continue;
      hit = true;
      if (d < 0.0001) {
        // inside the box: push out along shortest axis
        const left = pos.x - c.minX, right = c.maxX - pos.x;
        const front = pos.z - c.minZ, back = c.maxZ - pos.z;
        const m = Math.min(left, right, front, back);
        if (m === left) pos.x = c.minX - radius;
        else if (m === right) pos.x = c.maxX + radius;
        else if (m === front) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      } else {
        const push = (radius - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
    return hit;
  }

  pointInSolid(p, pad = 0) {
    for (const c of this.colliders) {
      if (c.type === 'gate' && !this.gate?.alive) continue;
      if (p.x > c.minX - pad && p.x < c.maxX + pad && p.z > c.minZ - pad && p.z < c.maxZ + pad && p.y < c.top + pad) return true;
    }
    return false;
  }

  cameraBoom(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.01) return to.clone();
    dir.normalize();
    const steps = 10;
    let last = from.clone();
    for (let i = 1; i <= steps; i++) {
      const p = from.clone().addScaledVector(dir, dist * i / steps);
      if (this.pointInSolid(p, 0.35)) return last;
      last = p;
    }
    return to;
  }

  findAnchor(pos, forward, range = 120, extra = []) {
    let best = null, bestScore = -Infinity;
    const all = extra.length ? this.anchors.concat(extra) : this.anchors;
    for (const a of all) {
      const dx = a.x - pos.x, dy = a.y - pos.y, dz = a.z - pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 5 || d > range) continue;
      if (dy < 2.5) continue;
      const inv = 1 / d;
      const dot = (dx * inv) * forward.x + (dy * inv) * forward.y + (dz * inv) * forward.z;
      if (dot < -0.12) continue;
      const score = dot * 2.4 - d / range * 1.1 + (a.y > pos.y + 10 ? 0.15 : 0);
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  isInsideWalls(pos) {
    return pos.x > CITY.x1 && pos.x < CITY.x2 && pos.z > CITY.z1 && pos.z < CITY.z2;
  }

  getZone(pos) {
    if (this.isInsideWalls(pos)) {
      const dw = Math.min(Math.abs(pos.x - CITY.x1), Math.abs(pos.x - CITY.x2), Math.abs(pos.z - CITY.z1), Math.abs(pos.z - CITY.z2));
      if (dw < 18) return ZONES[1];
      return ZONES[0];
    }
    const dw = Math.min(
      Math.abs(pos.x - CITY.x1), Math.abs(pos.x - CITY.x2),
      Math.abs(pos.z - CITY.z1), Math.abs(pos.z - CITY.z2)
    );
    if (dw < 30) return ZONES[1];
    if (pos.x > -20 && pos.z < -195) return ZONES[2];
    if (pos.x < -235) return ZONES[4];
    return ZONES[3];
  }

  spawnPoint(zoneKey, playerPos, minDist = 55) {
    for (let i = 0; i < 40; i++) {
      let x, z;
      if (zoneKey === 'city') { x = rand(-180, 180); z = rand(-150, 150); }
      else if (zoneKey === 'forest') { x = rand(10, 520); z = rand(-560, -230); }
      else if (zoneKey === 'waste') { x = rand(-580, -250); z = rand(-520, 520); }
      else if (zoneKey === 'walls') { x = rand(-80, 80); z = rand(210, 310); }
      else { x = rand(250, 560); z = rand(-150, 540); }
      if (!playerPos || Math.hypot(x - playerPos.x, z - playerPos.z) > minDist) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(rand(-200, 200), 0, rand(220, 300));
  }

  damageGate(n) {
    if (!this.gate?.alive) return;
    this.gate.hp = Math.max(0, this.gate.hp - n);
    if (this.gate.hp <= 0) this.breakGate();
  }

  breakGate() {
    if (!this.gate?.alive) return;
    this.gate.alive = false;
    this.gate.group.visible = false;
    this.colliders = this.colliders.filter(c => c !== this.gate.collider);
    this.gate.hp = 0;
  }

  resetGate() {
    if (!this.gate) return;
    this.gate.alive = true;
    this.gate.hp = this.gate.maxHp;
    this.gate.group.visible = true;
    if (!this.colliders.includes(this.gate.collider)) this.colliders.push(this.gate.collider);
  }

  dispose() {
    this.scene.traverse(o => {
      if (o === this.scene) return;
      if (o.isMesh || o.isPoints || o.isSprite) {
        if (o.geometry) o.geometry.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { if (m?.map) m.map.dispose?.(); m?.dispose?.(); }
      }
    });
    // clear only world-ish children (scene also holds entities, caller handles)
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
    this.colliders = []; this.anchors = []; this.trees = []; this.clouds = [];
  }
}
