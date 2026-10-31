import * as THREE from '../vendor/three/three.module.min.js';
import { rand } from './config.js';

function makeSlashTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(.35, 'rgba(255,255,255,.9)');
  g.addColorStop(.65, 'rgba(255,255,255,.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(128, 210, 112, Math.PI * 1.13, Math.PI * 1.87);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,220,190,.85)';
  ctx.beginPath();
  ctx.arc(128, 210, 100, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const VERT = `
attribute float size;
attribute vec3 color;
varying vec3 vColor;
varying float vAlpha;
attribute float alpha;
void main(){
  vColor = color; vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * (260.0 / max(1.0,-mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d);
  if(r > 0.5) discard;
  float a = smoothstep(0.5,0.05,r) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}`;

export class Effects {
  constructor(scene, camera, damageLayer) {
    this.scene = scene;
    this.camera = camera;
    this.layer = damageLayer;
    this.max = 900;
    this.particles = [];
    const geo = new THREE.BufferGeometry();
    this.posArr = new Float32Array(this.max * 3);
    this.colArr = new Float32Array(this.max * 3);
    this.sizeArr = new Float32Array(this.max);
    this.alphaArr = new Float32Array(this.max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colArr, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizeArr, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphaArr, 1));
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: THREE.NormalBlending
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
    this.geo = geo;

    this.lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({
      color: 0xdce9f2, transparent: true, opacity: 0.85, depthWrite: false
    }));
    this.line.visible = false;
    this.line.frustumCulled = false;
    scene.add(this.line);

    this.slashTex = makeSlashTexture();
    this.slashes = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.SpriteMaterial({
        map: this.slashTex, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
      });
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      scene.add(sp);
      this.slashes.push({ sprite: sp, life: 0, max: 0.22, scale: 1 });
    }

    this.numbers = [];
    for (let i = 0; i < 26; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num';
      el.style.display = 'none';
      damageLayer.appendChild(el);
      this.numbers.push({ el, life: 0, pos: new THREE.Vector3(), active: false });
    }
    this.tmp = new THREE.Vector3();
  }

  addParticle(x, y, z, vx, vy, vz, color, size, life, gravity = 0) {
    if (this.particles.length >= this.max) this.particles.shift();
    this.particles.push({
      x, y, z, vx, vy, vz,
      r: color.r, g: color.g, b: color.b,
      size, life, max: life, gravity
    });
  }

  burst(pos, colorHex, count = 12, speed = 5, size = 0.28, life = 0.7, gravity = -9) {
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), b = rand(-1, 1);
      const s = rand(speed * 0.25, speed);
      this.addParticle(
        pos.x + rand(-.25, .25), pos.y + rand(-.2, .4), pos.z + rand(-.25, .25),
        Math.cos(a) * Math.sqrt(1 - b * b) * s, b * s + speed * .22, Math.sin(a) * Math.sqrt(1 - b * b) * s,
        c, rand(size * .5, size * 1.5), rand(life * .5, life), gravity
      );
    }
  }

  steam(pos, count = 18, big = 1) {
    for (let i = 0; i < count; i++) {
      const c = new THREE.Color(Math.random() < .5 ? 0xe8e2d8 : 0xbdb6ac);
      this.addParticle(
        pos.x + rand(-big, big), pos.y + rand(0, big * 2), pos.z + rand(-big, big),
        rand(-1.2, 1.2), rand(1.2, 4.5), rand(-1.2, 1.2),
        c, rand(0.8, 2.4) * big, rand(1.2, 2.8), -0.6
      );
    }
  }

  dust(pos, count = 8, colorHex = 0xc9b28c) {
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      this.addParticle(
        pos.x + rand(-1, 1), pos.y + rand(0, .3), pos.z + rand(-1, 1),
        rand(-2, 2), rand(.2, 1.8), rand(-2, 2),
        c, rand(.5, 1.6), rand(.6, 1.4), -1
      );
    }
  }

  sparks(pos, count = 10, colorHex = 0xffd27a) {
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      this.addParticle(
        pos.x, pos.y, pos.z,
        rand(-7, 7), rand(-2, 8), rand(-7, 7),
        c, rand(.12, .35), rand(.2, .55), -14
      );
    }
  }

  slash(pos, scale = 5, colorHex = 0xffffff, flip = false) {
    const s = this.slashes.find(x => x.life <= 0) || this.slashes[0];
    s.life = s.max = 0.2;
    s.scale = scale;
    s.sprite.visible = true;
    s.sprite.position.copy(pos);
    s.sprite.material.color.setHex(colorHex);
    s.sprite.material.rotation = flip ? rand(-2.6, -1.2) : rand(-.8, .8);
    s.sprite.scale.set(scale, scale, 1);
  }

  number(pos, text, cls = '') {
    const n = this.numbers.find(x => !x.active) || this.numbers[0];
    n.active = true;
    n.life = 0.9;
    n.max = 0.9;
    n.pos.copy(pos);
    n.el.className = 'dmg-num ' + cls;
    n.el.textContent = text;
    n.el.style.display = 'block';
  }

  setLine(a, b) {
    if (!a || !b) { this.line.visible = false; return; }
    const arr = this.lineGeo.attributes.position.array;
    arr[0] = a.x; arr[1] = a.y; arr[2] = a.z;
    arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
    this.lineGeo.attributes.position.needsUpdate = true;
    this.line.visible = true;
  }

  hideLine() { this.line.visible = false; }

  update(dt) {
    // particles
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= 0.985; p.vz *= 0.985;
    }
    for (let i = 0; i < this.particles.length && n < this.max; i++, n++) {
      const p = this.particles[i];
      const a = Math.max(0, p.life / p.max);
      this.posArr[n * 3] = p.x; this.posArr[n * 3 + 1] = p.y; this.posArr[n * 3 + 2] = p.z;
      this.colArr[n * 3] = p.r; this.colArr[n * 3 + 1] = p.g; this.colArr[n * 3 + 2] = p.b;
      this.sizeArr[n] = p.size;
      this.alphaArr[n] = a;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;

    // slash sprites
    for (const s of this.slashes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const k = Math.max(0, s.life / s.max);
      s.sprite.material.opacity = k * 0.95;
      const sc = s.scale * (1.3 - k * 0.3);
      s.sprite.scale.set(sc, sc, 1);
      if (s.life <= 0) s.sprite.visible = false;
    }

    // numbers
    const w = innerWidth, h = innerHeight;
    for (const num of this.numbers) {
      if (!num.active) continue;
      num.life -= dt;
      if (num.life <= 0) { num.active = false; num.el.style.display = 'none'; continue; }
      this.tmp.copy(num.pos).project(this.camera);
      if (this.tmp.z > 1) { num.el.style.display = 'none'; continue; }
      num.el.style.display = 'block';
      num.el.style.left = ((this.tmp.x * .5 + .5) * w) + 'px';
      num.el.style.top = ((-this.tmp.y * .5 + .5) * h - (1 - num.life / num.max) * 40) + 'px';
      num.el.style.opacity = Math.min(1, num.life / num.max * 2.2);
    }
  }
}
