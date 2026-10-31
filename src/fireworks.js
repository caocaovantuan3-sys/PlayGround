import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.9;

export const FIREWORK_SHAPES = {
  peony: {
    label: 'PEONY',
    count: 680,
    speed: 25,
    gravity: 5.2,
    drag: 0.82,
    life: [1.9, 2.8],
    size: [2.9, 6.2],
    trail: 0.09,
    twinkle: 0.16,
    flash: 0.9,
    smoke: 4,
  },
  chrysanthemum: {
    label: 'CHRYSANTHEMUM',
    count: 760,
    speed: 25.5,
    gravity: 4.8,
    drag: 0.66,
    life: [2.4, 3.5],
    size: [2.4, 5.3],
    trail: 0.24,
    twinkle: 0.24,
    flash: 1,
    smoke: 5,
  },
  willow: {
    label: 'GOLDEN WILLOW',
    count: 720,
    speed: 21,
    gravity: 8.8,
    drag: 0.58,
    life: [3.5, 5.4],
    size: [2.1, 4.8],
    trail: 0.38,
    twinkle: 0.32,
    flash: 0.85,
    smoke: 5,
  },
  heart: {
    label: 'HEART',
    count: 740,
    speed: 28,
    gravity: 0.7,
    drag: 1.28,
    life: [2.2, 3.1],
    size: [2.8, 6.2],
    trail: 0.045,
    twinkle: 0.1,
    flash: 1,
    smoke: 4,
    cameraFacing: true,
  },
  star: {
    label: 'STAR',
    count: 700,
    speed: 27,
    gravity: 0.9,
    drag: 1.12,
    life: [2.2, 3.2],
    size: [2.6, 5.8],
    trail: 0.055,
    twinkle: 0.17,
    flash: 1,
    smoke: 4,
    cameraFacing: true,
  },
  ring: {
    label: 'RING',
    count: 760,
    speed: 28,
    gravity: 0.9,
    drag: 1.06,
    life: [2.1, 3.0],
    size: [2.6, 5.8],
    trail: 0.08,
    twinkle: 0.12,
    flash: 0.95,
    smoke: 4,
    cameraFacing: true,
  },
  multi: {
    label: 'MULTI LAYER',
    count: 1380,
    speed: 27,
    gravity: 4.3,
    drag: 0.76,
    life: [2.3, 3.6],
    size: [2.3, 5.5],
    trail: 0.14,
    twinkle: 0.18,
    flash: 1.25,
    smoke: 6,
  },
  rainbow: {
    label: 'RAINBOW',
    count: 1080,
    speed: 26,
    gravity: 3.8,
    drag: 0.82,
    life: [2.2, 3.3],
    size: [2.4, 5.5],
    trail: 0.12,
    twinkle: 0.2,
    flash: 1.1,
    smoke: 5,
  },
  glitter: {
    label: 'GLITTER',
    count: 980,
    speed: 23,
    gravity: 2.9,
    drag: 0.86,
    life: [3.0, 4.8],
    size: [1.7, 4.2],
    trail: 0.13,
    twinkle: 0.9,
    flash: 0.9,
    smoke: 4,
  },
  mega: {
    label: 'MEGA SKY',
    count: 2500,
    speed: 35,
    gravity: 4.4,
    drag: 0.56,
    life: [2.8, 4.7],
    size: [2.6, 6.8],
    trail: 0.24,
    twinkle: 0.24,
    flash: 2.1,
    smoke: 12,
  },
};

const particleVertex = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * (350.0 / max(24.0, -mv.z)), 1.0, 64.0);
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`;

const particleFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float glow = pow(1.0 - smoothstep(0.02, 0.5, d), 2.2);
    float core = 1.0 - smoothstep(0.0, 0.16, d);
    vec3 color = vColor * (glow * 0.92 + core * 1.3);
    float alpha = clamp(glow + core * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

function basisFromCamera(center, camera) {
  const normal = new THREE.Vector3().subVectors(camera.position, center).normalize();
  let right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal);
  if (right.lengthSq() < 0.001) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  return { normal, right, up };
}

const HEART_POINTS = [];
for (let i = 0; i < 160; i++) {
  const t = (i / 160) * TAU;
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  HEART_POINTS.push([x / 17, y / 17]);
}

const STAR_POINTS = [];
for (let i = 0; i < 10; i++) {
  const angle = -Math.PI / 2 + (i / 10) * TAU;
  const radius = i % 2 === 0 ? 1 : 0.43;
  STAR_POINTS.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
}

function samplePolyline(points, closed = true) {
  const segments = closed ? points.length : points.length - 1;
  let idx = Math.floor(Math.random() * segments);
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  const t = Math.random();
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function linearColor(hexA, hexB, t, out) {
  const ca = new THREE.Color(hexA);
  const cb = new THREE.Color(hexB);
  out.copy(ca).lerp(cb, t);
  return out;
}

export class FireworksSystem {
  constructor(scene, camera, world, callbacks = {}) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.onExplode = callbacks.onExplode || null;
    this.onLaunch = callbacks.onLaunch || null;
    this.onShockwave = callbacks.onShockwave || null;
    this.fireworks = [];
    this.quality = 'high';
    this.countMultiplier = 1;
    this.trailMultiplier = 1;
    this.maxParticles = 15000;
    this.pixelRatio = 1;
    this.stats = { particles: 0, rockets: 0 };

    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
      },
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    this.trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });

    this.pointTexture = null;
  }

  setQuality(quality) {
    this.quality = quality;
    const factors = { low: 0.4, medium: 0.68, high: 1, ultra: 1.35 };
    this.countMultiplier = factors[quality] || 1;
    this.trailMultiplier = quality === 'low' ? 0.52 : quality === 'medium' ? 0.78 : 1;
    this.maxParticles = quality === 'low' ? 5200 : quality === 'medium' ? 9500 : quality === 'ultra' ? 23000 : 15000;
  }

  setPixelRatio(ratio) {
    this.pixelRatio = ratio;
    this.particleMaterial.uniforms.uPixelRatio.value = ratio;
  }

  get particleCount() {
    return this.fireworks.reduce((n, fw) => n + fw.liveParticleCount, 0);
  }

  get rocketCount() {
    return this.fireworks.reduce((n, fw) => n + (fw.state === 'launching' ? 1 : 0), 0);
  }

  spawn(options = {}) {
    const type = FIREWORK_SHAPES[options.type] ? options.type : 'peony';
    const target = options.target?.isVector3
      ? options.target.clone()
      : options.target
        ? new THREE.Vector3(options.target.x, options.target.y, options.target.z)
        : new THREE.Vector3(rand(-80, 80), rand(105, 160), rand(-185, -55));
    target.y = Math.max(55, target.y);
    const origin = options.origin?.isVector3
      ? options.origin.clone()
      : options.origin
        ? new THREE.Vector3(options.origin.x, options.origin.y, options.origin.z)
        : new THREE.Vector3(
            target.x * 0.18 + rand(-16, 16),
            1,
            rand(40, 104),
          );
    const fw = new Firework(this, {
      type,
      color: options.color || '#ffd08a',
      color2: options.color2,
      origin,
      target,
      scale: options.scale || 1,
      slowmo: !!options.slowmo,
      label: options.label,
    });
    this.fireworks.push(fw);
    this.onLaunch?.({
      position: origin.clone(),
      color: fw.color,
      type,
      slowmo: fw.slowmo,
    });
    return fw;
  }

  spawnAt(options = {}) {
    const fw = this.spawn(options);
    fw.position.copy(fw.target);
    fw.removeRocket();
    fw.explode();
    return fw;
  }

  update(dt, time) {
    let particles = 0;
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const fw = this.fireworks[i];
      fw.update(dt, time);
      particles += fw.liveParticleCount;
      if (fw.done) {
        fw.dispose();
        this.fireworks.splice(i, 1);
      }
    }
    this.stats.particles = particles;
    this.stats.rockets = this.rocketCount;
  }

  clear() {
    for (const fw of this.fireworks) {
      fw.dispose();
    }
    this.fireworks.length = 0;
    this.stats.particles = 0;
    this.stats.rockets = 0;
  }
}

export class Firework {
  constructor(system, opts) {
    this.system = system;
    this.scene = system.scene;
    this.type = opts.type;
    this.cfg = FIREWORK_SHAPES[this.type];
    this.color = opts.color || '#ffd08a';
    this.color2 = opts.color2 || null;
    this.origin = opts.origin.clone();
    this.target = opts.target.clone();
    this.scale = opts.scale || 1;
    this.slowmo = !!opts.slowmo;
    this.label = opts.label || this.cfg.label;
    this.state = 'launching';
    this.done = false;
    this.elapsed = 0;
    this.flightTime = 0;
    this.liveParticleCount = 0;
    this.effects = [];
    this.particles = null;
    this.rocketLight = null;

    this.setupRocket();
  }

  setupRocket() {
    const distance = this.origin.distanceTo(this.target);
    this.flightTime = clamp(1.05 + distance / 165, 1.25, 2.55);
    this.gravity = 9.4;
    const t = this.flightTime;
    this.velocity = new THREE.Vector3(
      (this.target.x - this.origin.x) / t,
      (this.target.y - this.origin.y + 0.5 * this.gravity * t * t) / t,
      (this.target.z - this.origin.z) / t,
    );
    this.position = this.origin.clone();

    this.rocketColor = new THREE.Color(this.color);
    this.rocketColor.offsetHSL(0, -0.14, 0.44);
    this.rocketColor.multiplyScalar(2.1);

    const spriteMat = new THREE.SpriteMaterial({
      map: this.system.world?.flareTex || null,
      color: this.rocketColor,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.rocketSprite = new THREE.Sprite(spriteMat);
    this.rocketSprite.scale.setScalar(8.4);
    this.rocketSprite.position.copy(this.position);
    this.rocketSprite.renderOrder = 11;
    this.scene.add(this.rocketSprite);

    this.rocketPositions = new Float32Array(20 * 3);
    this.rocketColors = new Float32Array(20 * 3);
    for (let i = 0; i < 20; i++) {
      this.rocketPositions[i * 3] = this.position.x;
      this.rocketPositions[i * 3 + 1] = this.position.y;
      this.rocketPositions[i * 3 + 2] = this.position.z;
      const fade = Math.pow(1 - i / 19, 2.3);
      this.rocketColors[i * 3] = this.rocketColor.r * fade;
      this.rocketColors[i * 3 + 1] = this.rocketColor.g * fade;
      this.rocketColors[i * 3 + 2] = this.rocketColor.b * fade;
    }
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(this.rocketPositions, 3).setUsage(THREE.DynamicDrawUsage));
    rgeo.setAttribute('color', new THREE.BufferAttribute(this.rocketColors, 3));
    this.rocketTrailGeo = rgeo;
    this.rocketTrail = new THREE.Line(
      rgeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.rocketTrail.frustumCulled = false;
    this.rocketTrail.renderOrder = 10;
    this.scene.add(this.rocketTrail);
  }

  updateRocket(dt) {
    this.velocity.y -= this.gravity * dt;
    this.position.addScaledVector(this.velocity, dt);
    this.elapsed += dt;

    this.rocketSprite.position.copy(this.position);
    this.rocketSprite.material.opacity = 0.8 + Math.random() * 0.2;
    const flicker = 0.9 + Math.random() * 0.25;
    this.rocketSprite.scale.setScalar((7.2 + Math.sin(this.elapsed * 31) * 1.1) * flicker);

    for (let i = 19; i > 0; i--) {
      this.rocketPositions[i * 3] = this.rocketPositions[(i - 1) * 3];
      this.rocketPositions[i * 3 + 1] = this.rocketPositions[(i - 1) * 3 + 1];
      this.rocketPositions[i * 3 + 2] = this.rocketPositions[(i - 1) * 3 + 2];
    }
    this.rocketPositions[0] = this.position.x;
    this.rocketPositions[1] = this.position.y;
    this.rocketPositions[2] = this.position.z;
    this.rocketTrailGeo.attributes.position.needsUpdate = true;

    if (this.elapsed >= this.flightTime) {
      this.explode();
    }
  }

  explode() {
    this.state = 'active';
    this.explosionCenter = this.position.clone();
    this.removeRocket();

    const cfg = this.cfg;
    const countScale = this.system.countMultiplier * clamp(this.scale * 0.84 + 0.16, 0.72, 1.7);
    const available = Math.max(200, this.system.maxParticles - this.system.particleCount);
    const count = Math.max(120, Math.round(Math.min(cfg.count * countScale, available)));
    this.buildParticles(count);

    this.addFlash();
    this.addShockwaves();
    this.addSmoke();
    this.addAura();
    this.addWaterReflection();

    this.system.world?.flash(
      this.explosionCenter,
      this.color,
      clamp(this.scale * (cfg.flash + 0.2), 0.4, 3),
    );

    this.system.onExplode?.({
      position: this.explosionCenter.clone(),
      color: this.color,
      type: this.type,
      scale: this.scale,
      slowmo: this.slowmo,
      power: cfg.flash * this.scale,
    });
  }

  buildParticles(count) {
    const cfg = this.cfg;
    const center = this.explosionCenter;
    const camera = this.system.camera;
    const basis = basisFromCamera(center, camera);
    const scale = this.scale;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities = new Float32Array(count * 3);
    const starts = new Float32Array(count * 3);
    const ends = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const maxLife = new Float32Array(count);
    const drags = new Float32Array(count);
    const gravities = new Float32Array(count);
    const baseSizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const twinkles = new Float32Array(count);
    const swirls = new Float32Array(count);
    const trailScales = new Float32Array(count);
    const layerMeta = new Uint8Array(count);

    const trailPositions = new Float32Array(count * 12);
    const trailColors = new Float32Array(count * 12);

    const base = new THREE.Color(this.color);
    const baseHsl = {};
    base.getHSL(baseHsl);
    const second = this.color2 ? new THREE.Color(this.color2) : base.clone().offsetHSL(0.13, 0, 0.03);
    const secondHsl = {};
    second.getHSL(secondHsl);

    const multiPalette = [
      base.clone().offsetHSL(0.02, -0.08, 0.18),
      second.clone().offsetHSL(-0.08, 0.06, 0.02),
      base.clone(),
    ];
    const tmpColor = new THREE.Color();
    const endColor = new THREE.Color();
    const dir = new THREE.Vector3();
    const randomSphere = () => {
      const z = Math.random() * 2 - 1;
      const phi = Math.random() * TAU;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      dir.set(Math.cos(phi) * r, z, Math.sin(phi) * r);
      return dir;
    };

    for (let i = 0; i < count; i++) {
      let layer = 0;
      let layerSpeed = 1;
      let layerSize = 1;
      let shapeRadius = 1;
      let pattern = this.type;

      if (this.type === 'multi' || this.type === 'mega') {
        const roll = Math.random();
        layer = roll < 0.42 ? 0 : roll < 0.78 ? 1 : 2;
        layerSpeed = [0.54, 0.78, 1][layer] * rand(0.93, 1.07);
        layerSize = [0.78, 0.92, 1.12][layer];
        layerMeta[i] = layer;
      }

      if (this.type === 'heart') {
        const point = samplePolyline(HEART_POINTS);
        const fill = Math.random() < 0.17 ? Math.pow(Math.random(), 0.32) * 0.72 : 1;
        shapeRadius = Math.hypot(point[0] * fill, point[1] * fill);
        dir
          .copy(basis.right)
          .multiplyScalar(point[0] * fill)
          .addScaledVector(basis.up, point[1] * fill)
          .addScaledVector(basis.normal, gauss() * 0.055);
        if (dir.lengthSq() < 0.0001) dir.copy(basis.up);
        dir.normalize();
      } else if (this.type === 'star') {
        const point = samplePolyline(STAR_POINTS);
        const fill = Math.random() < 0.12 ? Math.pow(Math.random(), 0.3) * 0.65 : 1;
        shapeRadius = Math.hypot(point[0] * fill, point[1] * fill);
        dir
          .copy(basis.right)
          .multiplyScalar(point[0] * fill)
          .addScaledVector(basis.up, point[1] * fill)
          .addScaledVector(basis.normal, gauss() * 0.045);
        if (dir.lengthSq() < 0.0001) dir.copy(basis.up);
        dir.normalize();
      } else if (this.type === 'ring') {
        const angle = Math.random() * TAU;
        const tilt = rand(-0.18, 0.18);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        dir
          .copy(basis.right)
          .multiplyScalar(cos)
          .addScaledVector(basis.up, sin)
          .addScaledVector(basis.normal, tilt * 0.12 + gauss() * 0.022);
        dir.normalize();
      } else if (this.type === 'willow') {
        dir.copy(randomSphere());
        dir.y = dir.y * 0.72 - 0.12;
        dir.normalize();
      } else {
        dir.copy(randomSphere());
      }

      const radial = 0.88 + Math.random() * 0.24;
      const isOutline = this.type === 'heart' || this.type === 'star' || this.type === 'ring';
      const shapeSpeed = isOutline
        ? cfg.speed * scale * shapeRadius * rand(0.975, 1.025)
        : cfg.speed * scale * radial * layerSpeed;
      const speed = shapeSpeed * (this.type === 'mega' ? 1.18 : 1);

      const p = center;
      const startJitter = this.type === 'willow' ? 1.9 : 1.2;
      positions[i * 3] = p.x + gauss() * startJitter * scale;
      positions[i * 3 + 1] = p.y + gauss() * startJitter * scale;
      positions[i * 3 + 2] = p.z + gauss() * startJitter * scale;

      velocities[i * 3] = dir.x * speed;
      velocities[i * 3 + 1] = dir.y * speed;
      velocities[i * 3 + 2] = dir.z * speed;

      // Colour design. Rainbow gets a full hue sweep around the shell.
      if (this.type === 'rainbow') {
        const az = Math.atan2(dir.z, dir.x) / TAU + 0.5;
        const hue = (az + dir.y * 0.1 + 1) % 1;
        tmpColor.setHSL(hue, 0.96, 0.62);
        endColor.setHSL((hue + 0.22) % 1, 0.95, 0.53);
      } else if (this.type === 'glitter') {
        if (Math.random() < 0.55) tmpColor.setHSL(0.1 + Math.random() * 0.04, 0.56, 0.72);
        else tmpColor.copy(base).offsetHSL(rand(-0.04, 0.04), 0, rand(-0.08, 0.18));
        endColor.copy(tmpColor).offsetHSL(0.04, 0, -0.1);
      } else if (this.type === 'multi' || this.type === 'mega') {
        tmpColor.copy(multiPalette[layer]).offsetHSL(rand(-0.025, 0.025), rand(-0.05, 0.07), rand(-0.05, 0.08));
        endColor.copy(tmpColor).offsetHSL(layer === 0 ? -0.12 : 0.11, 0, -0.1);
      } else if (this.type === 'willow') {
        tmpColor.setHSL(0.09 + Math.random() * 0.045, 0.9, 0.6 + Math.random() * 0.12);
        endColor.setHSL(0.055, 0.92, 0.34);
      } else {
        tmpColor.copy(base).offsetHSL(rand(-0.035, 0.035), rand(-0.03, 0.05), rand(-0.08, 0.1));
        endColor.copy(tmpColor).offsetHSL(rand(-0.1, 0.14), 0.03, -0.12);
      }

      const brightness =
        (this.type === 'glitter' ? rand(1.8, 3.2) : rand(1.85, 2.85)) *
        (this.type === 'multi' || this.type === 'mega' ? [1.15, 1, 0.9][layer] : 1);
      starts[i * 3] = tmpColor.r * brightness;
      starts[i * 3 + 1] = tmpColor.g * brightness;
      starts[i * 3 + 2] = tmpColor.b * brightness;
      ends[i * 3] = endColor.r * rand(0.55, 1.05);
      ends[i * 3 + 1] = endColor.g * rand(0.55, 1.05);
      ends[i * 3 + 2] = endColor.b * rand(0.55, 1.05);

      const l = cfg.life[0] + Math.random() * (cfg.life[1] - cfg.life[0]);
      const layerLife = this.type === 'multi' || this.type === 'mega' ? [1.12, 1, 0.86][layer] : 1;
      life[i] = l * layerLife;
      maxLife[i] = life[i];
      drags[i] = cfg.drag * rand(0.92, 1.08);
      gravities[i] = cfg.gravity * rand(0.82, 1.16);
      baseSizes[i] = (cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0])) * scale * layerSize;
      sizes[i] = baseSizes[i];
      phases[i] = Math.random() * TAU;
      twinkles[i] = cfg.twinkle * rand(0.55, 1.2);
      swirls[i] = rand(-0.9, 0.9);
      trailScales[i] = cfg.trail * 2.4 * this.system.trailMultiplier * rand(0.75, 1.25) * this.scale;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));

    const points = new THREE.Points(geo, this.system.particleMaterial);
    points.frustumCulled = false;
    points.renderOrder = 12;
    this.scene.add(points);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3).setUsage(THREE.DynamicDrawUsage));
    const trails = new THREE.LineSegments(trailGeo, this.system.trailMaterial);
    trails.frustumCulled = false;
    trails.renderOrder = 11;
    this.scene.add(trails);

    this.particles = {
      points,
      trails,
      geometry: geo,
      trailGeometry: trailGeo,
      count,
      positions,
      colors,
      sizes,
      velocities,
      starts,
      ends,
      life,
      maxLife,
      drags,
      gravities,
      baseSizes,
      phases,
      twinkles,
      swirls,
      trailScales,
      trailPositions,
      trailColors,
      layerMeta,
    };
    this.liveParticleCount = count;
  }

  updateParticles(dt, time) {
    const p = this.particles;
    if (!p) return;
    const pos = p.positions;
    const vel = p.velocities;
    const colors = p.colors;
    const sizes = p.sizes;
    const trailPos = p.trailPositions;
    const trailCol = p.trailColors;
    let alive = 0;

    for (let i = 0; i < p.count; i++) {
      if (p.life[i] <= 0) {
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        sizes[i] = 0;
        continue;
      }

      alive++;
      p.life[i] -= dt;
      const age = p.maxLife[i] - p.life[i];
      const dragFactor = Math.exp(-p.drags[i] * dt);
      vel[i * 3] *= dragFactor;
      vel[i * 3 + 1] *= dragFactor;
      vel[i * 3 + 2] *= dragFactor;
      vel[i * 3 + 1] -= p.gravities[i] * dt;

      // A tiny curl force makes long sparks arc naturally instead of falling in straight lines.
      const swirl = p.swirls[i];
      vel[i * 3] += Math.sin(time * 0.55 + p.phases[i]) * swirl * dt * 0.26;
      vel[i * 3 + 2] += Math.cos(time * 0.62 + p.phases[i] * 1.3) * swirl * dt * 0.22;

      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

      const remaining = p.life[i];
      const lifeRatio = clamp(remaining / p.maxLife[i], 0, 1);
      const fadeIn = clamp(age / 0.075, 0, 1);
      const fadeOut = clamp(remaining / (p.maxLife[i] * 0.42), 0, 1);
      const fade = fadeIn * Math.min(1, fadeOut * 1.55) * (0.9 + lifeRatio * 0.1);
      const mixT = clamp(age / (p.maxLife[i] * 0.78), 0, 1);

      let flicker = 1;
      if (p.twinkles[i] > 0.001) {
        const tw = 0.5 + 0.5 * Math.sin(time * 11.5 + p.phases[i]);
        flicker = 1 - p.twinkles[i] * 0.62 * Math.pow(tw, 5);
      }

      const r = (p.starts[i * 3] + (p.ends[i * 3] - p.starts[i * 3]) * mixT) * fade * flicker;
      const g = (p.starts[i * 3 + 1] + (p.ends[i * 3 + 1] - p.starts[i * 3 + 1]) * mixT) * fade * flicker;
      const b = (p.starts[i * 3 + 2] + (p.ends[i * 3 + 2] - p.starts[i * 3 + 2]) * mixT) * fade * flicker;
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;

      const sizePulse = 0.72 + 0.28 * fadeIn;
      sizes[i] = p.baseSizes[i] * sizePulse * (0.62 + 0.38 * lifeRatio);

      const trailScale = p.trailScales[i] * (0.45 + 0.55 * fadeOut);
      const vx = vel[i * 3] * trailScale;
      const vy = vel[i * 3 + 1] * trailScale;
      const vz = vel[i * 3 + 2] * trailScale;
      const px = pos[i * 3];
      const py = pos[i * 3 + 1];
      const pz = pos[i * 3 + 2];

      const t0 = i * 12;
      // Segment 1: head to mid, segment 2: mid to tail.
      trailPos[t0] = px;
      trailPos[t0 + 1] = py;
      trailPos[t0 + 2] = pz;
      trailPos[t0 + 3] = px - vx * 0.38;
      trailPos[t0 + 4] = py - vy * 0.38;
      trailPos[t0 + 5] = pz - vz * 0.38;
      trailPos[t0 + 6] = px - vx * 0.38;
      trailPos[t0 + 7] = py - vy * 0.38;
      trailPos[t0 + 8] = pz - vz * 0.38;
      trailPos[t0 + 9] = px - vx;
      trailPos[t0 + 10] = py - vy;
      trailPos[t0 + 11] = pz - vz;

      trailCol[t0] = r * 0.8;
      trailCol[t0 + 1] = g * 0.8;
      trailCol[t0 + 2] = b * 0.8;
      trailCol[t0 + 3] = r * 0.42;
      trailCol[t0 + 4] = g * 0.42;
      trailCol[t0 + 5] = b * 0.42;
      trailCol[t0 + 6] = r * 0.42;
      trailCol[t0 + 7] = g * 0.42;
      trailCol[t0 + 8] = b * 0.42;
      trailCol[t0 + 9] = r * 0.09;
      trailCol[t0 + 10] = g * 0.09;
      trailCol[t0 + 11] = b * 0.09;
    }

    p.geometry.attributes.position.needsUpdate = true;
    p.geometry.attributes.aColor.needsUpdate = true;
    p.geometry.attributes.aSize.needsUpdate = true;
    p.trailGeometry.attributes.position.needsUpdate = true;
    p.trailGeometry.attributes.color.needsUpdate = true;
    this.liveParticleCount = alive;

    if (alive === 0) {
      this.removeParticles();
    }
  }

  addFlash() {
    const cfg = this.cfg;
    const mat = new THREE.SpriteMaterial({
      map: this.system.world?.flareTex || null,
      color: this.color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(this.explosionCenter);
    const start = 1.8 * this.scale;
    const end = (14 + cfg.flash * 11) * this.scale;
    sprite.scale.setScalar(start);
    sprite.renderOrder = 14;
    this.scene.add(sprite);
    this.effects.push({
      type: 'flash',
      sprite,
      t: 0,
      life: 0.2 + cfg.flash * 0.065,
      start,
      end,
      baseOpacity: 0.8,
      rotate: false,
    });
  }

  addShockwaves() {
    const cfg = this.cfg;
    const count = cfg.flash > 1.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.system.world?.ringTex || null,
        color: this.color,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        rotation: Math.random() * TAU,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(this.explosionCenter);
      sprite.position.y += i * 1.6;
      sprite.scale.setScalar(4);
      sprite.renderOrder = 13;
      this.scene.add(sprite);
      this.effects.push({
        type: 'shock',
        sprite,
        t: -i * 0.08,
        life: 0.56 + i * 0.16,
        start: 4 * this.scale,
        end: (54 + cfg.flash * 28 + i * 16) * this.scale,
        rotate: true,
        rotationSpeed: (i % 2 ? -1 : 1) * 0.25,
      });
    }
    this.system.onShockwave?.({
      position: this.explosionCenter,
      color: this.color,
      scale: this.scale,
    });
  }

  addSmoke() {
    const count = Math.round(this.cfg.smoke * (0.55 + this.scale * 0.25));
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.system.world?.smokeTex || null,
        color: new THREE.Color(0x414b5d).offsetHSL(rand(-0.03, 0.03), 0, rand(-0.06, 0.08)),
        transparent: true,
        opacity: 0.04 + Math.random() * 0.03,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
        rotation: Math.random() * TAU,
      });
      const sprite = new THREE.Sprite(mat);
      const radius = rand(1.5, 15) * this.scale;
      const theta = Math.random() * TAU;
      sprite.position.copy(this.explosionCenter);
      sprite.position.x += Math.cos(theta) * radius;
      sprite.position.y += gauss() * radius * 0.55;
      sprite.position.z += Math.sin(theta) * radius;
      const s = rand(9, 24) * this.scale;
      sprite.scale.set(s, s * rand(0.7, 1.15), 1);
      sprite.renderOrder = 7;
      this.scene.add(sprite);
      this.effects.push({
        type: 'smoke',
        sprite,
        t: -Math.random() * 0.18,
        life: rand(3.0, 4.8),
        start: s * 0.65,
        end: s * rand(1.7, 2.5),
        velocity: new THREE.Vector3(
          Math.cos(theta) * rand(0.8, 2.6),
          rand(0.6, 2.2),
          Math.sin(theta) * rand(0.8, 2.6),
        ),
        baseOpacity: sprite.material.opacity,
        rotate: true,
        rotationSpeed: rand(-0.06, 0.06),
      });
    }
  }

  addWaterReflection() {
    const world = this.system.world;
    if (!world?.glowTex || !world.reflectionEnabled) return;
    const camera = this.system.camera;
    // A stylised mirror pool: pull the reflected glow toward the viewer so it
    // reads clearly below the burst instead of vanishing at the bottom edge.
    const blend = 0.06;
    const x = this.explosionCenter.x + (camera.position.x - this.explosionCenter.x) * blend;
    const z = this.explosionCenter.z + (camera.position.z - this.explosionCenter.z) * blend;
    const cfg = this.cfg;
    const width = (36 + cfg.flash * 18) * this.scale;
    const depth = (130 + cfg.flash * 85) * this.scale;
    const mat = new THREE.MeshBasicMaterial({
      map: world.glowTex,
      color: this.color,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.12, z);
    mesh.renderOrder = 6;
    this.scene.add(mesh);
    this.effects.push({
      type: 'water',
      sprite: mesh,
      geometry: geo,
      t: 0,
      life: 1.5 + cfg.flash * 0.22,
      width,
      depth,
      baseOpacity: 0.32,
      rotate: false,
    });
  }

  addAura() {
    const mat = new THREE.SpriteMaterial({
      map: this.system.world?.glowTex || null,
      color: this.color,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(this.explosionCenter);
    const s = 24 * this.scale;
    sprite.scale.setScalar(s);
    sprite.renderOrder = 8;
    this.scene.add(sprite);
    this.effects.push({
      type: 'aura',
      sprite,
      t: 0,
      life: 1.0,
      start: 16 * this.scale,
      end: 72 * this.scale,
      baseOpacity: 0.12,
      rotate: false,
    });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.t += dt;
      if (fx.t < 0) continue;
      const progress = clamp(fx.t / fx.life, 0, 1);
      const sprite = fx.sprite;
      if (fx.type === 'water') {
        const swell = 0.7 + progress * 0.42;
        sprite.scale.set(fx.width * swell, fx.depth * (0.85 + progress * 0.2), 1);
        sprite.material.opacity = fx.baseOpacity * Math.sin(Math.PI * progress) * 0.9;
      } else if (fx.type === 'smoke') {
        sprite.position.addScaledVector(fx.velocity, dt);
        fx.velocity.y += dt * 0.16;
        fx.velocity.multiplyScalar(Math.exp(-0.06 * dt));
        const scale = THREE.MathUtils.lerp(fx.start, fx.end, Math.pow(progress, 0.55));
        sprite.scale.set(scale, scale * 0.8, 1);
        sprite.material.opacity = fx.baseOpacity * Math.sin(Math.PI * progress) * (1 - progress * 0.2);
        if (fx.rotate) sprite.material.rotation += fx.rotationSpeed * dt;
      } else {
        const ease = fx.type === 'flash' ? Math.pow(progress, 0.28) : 1 - Math.pow(1 - progress, 2.4);
        const scale = THREE.MathUtils.lerp(fx.start, fx.end, ease);
        sprite.scale.setScalar(scale);
        const baseOpacity = fx.baseOpacity ?? 0.78;
        sprite.material.opacity = baseOpacity * (1 - progress) * (fx.type === 'flash' ? 1 - progress * 0.4 : 1);
        if (fx.type === 'shock') {
          sprite.material.rotation += (fx.rotationSpeed || 0) * dt;
          sprite.material.opacity *= 0.6;
        }
        if (fx.rotate && fx.type !== 'shock') sprite.material.rotation += (fx.rotationSpeed || 0) * dt;
      }

      if (fx.t >= fx.life) {
        this.scene.remove(sprite);
        sprite.material.dispose();
        fx.geometry?.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  removeRocket() {
    if (this.rocketSprite) {
      this.scene.remove(this.rocketSprite);
      this.rocketSprite.material.dispose();
      this.rocketSprite = null;
    }
    if (this.rocketTrail) {
      this.scene.remove(this.rocketTrail);
      this.rocketTrail.geometry.dispose();
      this.rocketTrail.material.dispose();
      this.rocketTrail = null;
      this.rocketTrailGeo = null;
    }
  }

  removeParticles() {
    if (!this.particles) return;
    this.scene.remove(this.particles.points);
    this.scene.remove(this.particles.trails);
    this.particles.geometry.dispose();
    this.particles.trailGeometry.dispose();
    this.particles = null;
    this.liveParticleCount = 0;
  }

  update(dt, time) {
    if (this.state === 'launching') {
      this.updateRocket(dt);
    }
    if (this.state === 'active' || this.state === 'launching') {
      if (this.particles) this.updateParticles(dt, time);
      this.updateEffects(dt);
    }
    if (this.state === 'active' && !this.particles && this.effects.length === 0) {
      this.done = true;
    }
  }

  dispose() {
    this.removeRocket();
    this.removeParticles();
    for (const fx of this.effects) {
      this.scene.remove(fx.sprite);
      fx.sprite.material.dispose();
      fx.geometry?.dispose();
    }
    this.effects.length = 0;
  }
}
