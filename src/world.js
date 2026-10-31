import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  makeCloudTexture,
  makeFlareTexture,
  makeGlowTexture,
  makeMoonTexture,
  makeRingTexture,
  makeSmokeTexture,
  makeSparkTexture,
  makeWindowTexture,
} from './textures.js';

const THEMES = {
  free: {
    top: 0x030612,
    horizon: 0x1a2b44,
    bottom: 0x050910,
    fog: 0x07101d,
    fogDensity: 0.00165,
    glow: 0x779de8,
    city: 0.9,
    stars: 1,
    galaxy: 0.02,
    moon: 1,
    cloud: 0x4b5f84,
    cloudAlpha: 0.14,
  },
  festival: {
    top: 0x070311,
    horizon: 0x381b2c,
    bottom: 0x09050c,
    fog: 0x120913,
    fogDensity: 0.00185,
    glow: 0xff9966,
    city: 1.25,
    stars: 0.88,
    galaxy: 0.015,
    moon: 1,
    cloud: 0x7e4b5c,
    cloudAlpha: 0.16,
  },
  cinematic: {
    top: 0x010208,
    horizon: 0x111d35,
    bottom: 0x020409,
    fog: 0x050b15,
    fogDensity: 0.00225,
    glow: 0x6282cb,
    city: 0.78,
    stars: 0.92,
    galaxy: 0.05,
    moon: 0.8,
    cloud: 0x344664,
    cloudAlpha: 0.2,
  },
  city: {
    top: 0x030612,
    horizon: 0x282237,
    bottom: 0x05050a,
    fog: 0x0c0b16,
    fogDensity: 0.0018,
    glow: 0xffb06d,
    city: 1.75,
    stars: 0.58,
    galaxy: 0,
    moon: 0.7,
    cloud: 0x584252,
    cloudAlpha: 0.13,
  },
  lake: {
    top: 0x020612,
    horizon: 0x17364d,
    bottom: 0x03080d,
    fog: 0x06121c,
    fogDensity: 0.00155,
    glow: 0x79d9ff,
    city: 0.84,
    stars: 1.18,
    galaxy: 0.04,
    moon: 1.38,
    cloud: 0x42617a,
    cloudAlpha: 0.12,
  },
  galaxy: {
    top: 0x04021a,
    horizon: 0x26124c,
    bottom: 0x03040d,
    fog: 0x0b0620,
    fogDensity: 0.0019,
    glow: 0x9b6dff,
    city: 0.35,
    stars: 1.4,
    galaxy: 1.35,
    moon: 0.55,
    cloud: 0x5f438b,
    cloudAlpha: 0.18,
  },
};

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.7 + 0.3 * sin(uTime * (0.7 + aPhase * 0.9) + aPhase * 19.0);
    vColor = aColor;
    vAlpha = uOpacity * twinkle;
    gl_PointSize = aSize * uPixelRatio * (220.0 / max(30.0, -mv.z));
    gl_PointSize = clamp(gl_PointSize, 0.7, 5.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const starFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.02, 0.5, d);
    a = pow(a, 1.7);
    gl_FragColor = vec4(vColor * (0.8 + a * 1.8), a * vAlpha);
  }
`;

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = normalize(world.xyz);
    vec4 pos = projectionMatrix * viewMatrix * world;
    gl_Position = pos.xyww;
  }
`;

const skyFragment = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uGlow;
  uniform float uTime;
  uniform float uGalaxy;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.02 + 17.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float y = vDir.y;
    float h = clamp(y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(h, 0.56));
    col = mix(uBottom, col, smoothstep(-0.16, 0.035, y));

    float horizonBand = exp(-pow(max(0.0, y) * 16.0, 1.2));
    col += uGlow * horizonBand * 0.14;

    vec2 p = vDir.xz / max(0.12, y + 0.18) * 1.15;
    float clouds = fbm(p * 1.1 + vec2(uTime * 0.0035, 0.0));
    float highVeil = smoothstep(0.48, 0.83, clouds) * smoothstep(0.02, 0.34, y);
    col += uGlow * highVeil * 0.016;

    // A soft galactic band that only awakens in GALAXY mode.
    float band = exp(-pow((y - 0.22 - sin(vDir.x * 2.1) * 0.10) / 0.16, 2.0));
    float nebula = fbm(vDir.xz * 2.6 + vDir.y * 3.0 + uTime * 0.0015);
    nebula = pow(nebula, 2.2) * 2.4;
    vec3 galaxyColor = mix(vec3(0.12, 0.08, 0.35), vec3(0.6, 0.25, 0.67), nebula);
    col += galaxyColor * band * nebula * uGalaxy * 0.58;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const waterOverlayVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const waterOverlayFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uTint;
  uniform vec3 uCityGlow;
  uniform float uOpacity;
  uniform float uReflection;

  float wave(vec2 p) {
    return sin(p.x * 1.5 + uTime * 0.42) * 0.5
      + sin(p.y * 3.1 - uTime * 0.31) * 0.3
      + sin((p.x + p.y) * 5.3 + uTime * 0.58) * 0.12;
  }

  void main() {
    vec2 p = vUv * vec2(24.0, 11.0);
    float w = wave(p);
    float nearShore = smoothstep(0.0, 0.22, vUv.y);
    float horizon = smoothstep(0.54, 0.82, vUv.y);
    vec3 color = mix(uDeep, uTint, 0.35 + w * 0.12 + horizon * 0.32);
    color += uCityGlow * horizon * 0.09;

    float streak = smoothstep(0.88, 1.0, sin(vUv.y * 260.0 + w * 8.0) * 0.5 + 0.5);
    float shimmer = (0.35 + 0.65 * sin(vUv.x * 190.0 + w * 4.0 + uTime * 0.2)) * 0.5 + 0.5;
    color += vec3(0.16, 0.24, 0.33) * streak * shimmer * 0.018;

    float alpha = uOpacity + (1.0 - uReflection) * 0.16 + (1.0 - nearShore) * 0.07;
    alpha *= 0.85 + w * 0.12;
    gl_FragColor = vec4(color, alpha);
  }
`;

const beamFrag = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float vertical = pow(1.0 - vUv.y, 2.2);
    float edge = sin(vUv.x * 3.14159265);
    float a = vertical * edge * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

const beamVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class World {
  constructor(scene, renderer, quality = 'high') {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.time = 0;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.reflectionEnabled = true;
    this.rand = seededRandom(2419);
    this.lights = [];
    this.themeName = 'free';
    this._tmp = new THREE.Vector3();
    this._clock = new THREE.Clock();

    this.glowTex = makeGlowTexture();
    this.flareTex = makeFlareTexture();
    this.ringTex = makeRingTexture();
    this.smokeTex = makeSmokeTexture();
    this.sparkTex = makeSparkTexture();
    this.cloudTex = makeCloudTexture();
    this.moonTex = makeMoonTexture();

    this.buildSky();
    this.buildStars();
    this.buildGalaxy();
    this.buildMoon();
    this.buildClouds();
    this.buildCity();
    this.buildTerrain();
    this.buildPier();
    this.buildLake();
    this.buildBeams();
    this.buildFallingStars();
    this.buildAmbientMotes();
    this.buildLights();
    this.setTheme('free');
    this.setQuality(quality);
  }

  buildSky() {
    this.skyUniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uTime: { value: 0 },
      uGalaxy: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1100, 40, 24), material);
    mesh.renderOrder = -100;
    mesh.frustumCulled = false;
    this.sky = mesh;
    this.scene.add(mesh);

    this.scene.fog = new THREE.FogExp2(0x07101d, 0.00165);
  }

  buildStars() {
    const count = 3300;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const rand = seededRandom(721);
    const c = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      const y = -0.03 + Math.pow(rand(), 0.62) * 0.98;
      const r = 780 + rand() * 170;
      const horiz = Math.sqrt(Math.max(0, 1 - y * y));
      positions[i * 3] = Math.cos(theta) * horiz * r;
      positions[i * 3 + 1] = y * r;
      positions[i * 3 + 2] = Math.sin(theta) * horiz * r;

      const tint = rand();
      if (tint > 0.91) c.setHSL(0.08, 0.55, 0.82);
      else if (tint > 0.78) c.setHSL(0.58, 0.45, 0.84);
      else c.setHSL(0.1, 0.06, 0.78 + rand() * 0.2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = 0.8 + Math.pow(rand(), 3.4) * 2.9;
      phases[i] = rand() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uPixelRatio: { value: this.pixelRatio },
      },
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    this.stars = new THREE.Points(geo, this.starMaterial);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -90;
    this.scene.add(this.stars);
  }

  buildGalaxy() {
    this.galaxyGroup = new THREE.Group();
    this.galaxyGroup.visible = true;

    const count = 5600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const rand = seededRandom(1337);
    const c = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const lat = (rand() + rand() + rand() - 1.5) * 0.24;
      const radius = 680 + rand() * 230;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (0.22 + lat + Math.sin(angle * 2.0) * 0.035) * 520;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const tint = rand();
      if (tint > 0.72) c.setHSL(0.77, 0.44, 0.63);
      else if (tint > 0.4) c.setHSL(0.62, 0.56, 0.55);
      else c.setHSL(0.55, 0.22, 0.76);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = 1.2 + Math.pow(rand(), 3.0) * 4.2;
      phases[i] = rand() * 20;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.galaxyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.02 },
        uPixelRatio: { value: this.pixelRatio },
      },
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    this.galaxyPoints = new THREE.Points(geo, this.galaxyMaterial);
    this.galaxyPoints.frustumCulled = false;
    this.galaxyPoints.renderOrder = -80;
    this.galaxyGroup.add(this.galaxyPoints);

    const nebulaMat = new THREE.SpriteMaterial({
      map: this.cloudTex,
      color: 0x7a4bd1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.nebulaSprites = [];
    for (let i = 0; i < 8; i++) {
      const mat = nebulaMat.clone();
      mat.opacity = 0;
      const sprite = new THREE.Sprite(mat);
      const a = (i / 8) * Math.PI * 2 + rand() * 0.5;
      sprite.position.set(Math.cos(a) * 720, 150 + rand() * 180, Math.sin(a) * 720);
      sprite.scale.set(430 + rand() * 380, 190 + rand() * 160, 1);
      sprite.material.rotation = rand() * Math.PI;
      sprite.renderOrder = -85;
      this.galaxyGroup.add(sprite);
      this.nebulaSprites.push(sprite);
    }

    this.scene.add(this.galaxyGroup);
  }

  buildMoon() {
    const group = new THREE.Group();
    group.position.set(-282, 246, -710);
    group.renderOrder = -70;

    const moonMat = new THREE.SpriteMaterial({
      map: this.moonTex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      color: 0xfff4dd,
    });
    const moon = new THREE.Sprite(moonMat);
    moon.scale.set(54, 54, 1);
    moon.renderOrder = -71;
    group.add(moon);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.flareTex,
        color: 0xffe4b5,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        toneMapped: false,
      }),
    );
    halo.scale.set(210, 210, 1);
    halo.renderOrder = -72;
    group.add(halo);

    const innerGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xfff4d5,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        toneMapped: false,
      }),
    );
    innerGlow.scale.set(64, 64, 1);
    group.add(innerGlow);

    this.moon = moon;
    this.moonHalo = halo;
    this.moonGroup = group;
    this.scene.add(group);
  }

  buildClouds() {
    this.clouds = [];
    const rand = seededRandom(409);
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.cloudTex,
        color: 0x4b5f84,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        depthTest: true,
        fog: false,
        blending: THREE.NormalBlending,
      });
      const sprite = new THREE.Sprite(mat);
      const x = (rand() - 0.5) * 1500;
      const y = 90 + rand() * 250;
      const z = -160 - rand() * 690;
      sprite.position.set(x, y, z);
      const sx = 220 + rand() * 460;
      sprite.scale.set(sx, sx * (0.22 + rand() * 0.16), 1);
      sprite.material.rotation = (rand() - 0.5) * 0.12;
      sprite.renderOrder = -40;
      sprite.userData = {
        drift: 0.8 + rand() * 2.2,
        baseX: x,
        phase: rand() * 10,
      };
      this.clouds.push(sprite);
      this.scene.add(sprite);
    }
  }

  buildCity() {
    this.cityGroup = new THREE.Group();
    this.cityGroup.position.set(0, 0, 0);

    const textures = [makeWindowTexture(3, 9, 28), makeWindowTexture(9, 8, 22), makeWindowTexture(14, 10, 30)];
    const mats = textures.map((map, i) =>
      new THREE.MeshStandardMaterial({
        map,
        color: i === 1 ? 0x0a101a : 0x080c14,
        emissive: i === 1 ? 0xffb36b : 0xffc477,
        emissiveMap: map,
        emissiveIntensity: 0.9,
        roughness: 0.84,
        metalness: 0.2,
        fog: true,
      }),
    );
    this.cityMaterials = mats;

    const rand = seededRandom(874);
    const buildings = [[], [], []];
    for (let i = 0; i < 112; i++) {
      const row = rand();
      const x = (rand() - 0.5) * 940;
      const z = -404 - rand() * 170;
      let h = 16 + Math.pow(rand(), 2.1) * 130;
      if (Math.abs(x) < 90) h *= 0.68;
      if (rand() > 0.93) h *= 1.6;
      const w = 9 + rand() * 26;
      const d = 9 + rand() * 25;
      buildings[i % 3].push({ x, y: h / 2, z, w, h, d, row, tone: rand() });
    }

    for (let m = 0; m < 3; m++) {
      const list = buildings[m];
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.InstancedMesh(geo, mats[m], list.length);
      const matrix = new THREE.Matrix4();
      const color = new THREE.Color();
      list.forEach((b, i) => {
        matrix.compose(
          new THREE.Vector3(b.x, b.y, b.z),
          new THREE.Quaternion(),
          new THREE.Vector3(b.w, b.h, b.d),
        );
        mesh.setMatrixAt(i, matrix);
        const warm = b.tone > 0.55;
        color.setHSL(warm ? 0.085 : 0.57, warm ? 0.4 : 0.16, 0.58);
        mesh.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.receiveShadow = false;
      mesh.castShadow = false;
      this.cityGroup.add(mesh);
    }

    // Rooftop antenna lights.
    const beaconPositions = [];
    const beaconColors = [];
    const beaconSizes = [];
    const beaconPhases = [];
    for (let i = 0; i < 32; i++) {
      const x = (rand() - 0.5) * 800;
      const z = -418 - rand() * 130;
      const h = 80 + rand() * 120;
      beaconPositions.push(x, h, z);
      beaconColors.push(1, 0.16, 0.12);
      beaconSizes.push(2.8 + rand() * 2);
      beaconPhases.push(rand() * 10);
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute('position', new THREE.Float32BufferAttribute(beaconPositions, 3));
    bgeo.setAttribute('aColor', new THREE.Float32BufferAttribute(beaconColors, 3));
    bgeo.setAttribute('aSize', new THREE.Float32BufferAttribute(beaconSizes, 1));
    bgeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(beaconPhases, 1));
    this.beaconMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.9 },
        uPixelRatio: { value: this.pixelRatio },
      },
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.beacons = new THREE.Points(bgeo, this.beaconMaterial);
    this.cityGroup.add(this.beacons);

    // Shoreline warm light field.
    const lightPos = [];
    const lightCol = [];
    const lightSize = [];
    const lightPhase = [];
    for (let i = 0; i < 520; i++) {
      const x = (rand() - 0.5) * 1080;
      const y = 1 + rand() * 20;
      const z = -376 - rand() * 30;
      lightPos.push(x, y, z);
      const c = new THREE.Color();
      c.setHSL(0.07 + rand() * 0.05, 0.7, 0.58 + rand() * 0.24);
      lightCol.push(c.r * 1.6, c.g * 1.6, c.b * 1.6);
      lightSize.push(1.5 + rand() * 4);
      lightPhase.push(rand() * 12);
    }
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
    lgeo.setAttribute('aColor', new THREE.Float32BufferAttribute(lightCol, 3));
    lgeo.setAttribute('aSize', new THREE.Float32BufferAttribute(lightSize, 1));
    lgeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(lightPhase, 1));
    this.cityLightMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uPixelRatio: { value: this.pixelRatio },
      },
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.cityLights = new THREE.Points(lgeo, this.cityLightMaterial);
    this.cityGroup.add(this.cityLights);

    // Low atmospheric glow above the skyline.
    this.cityGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xffa951,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        toneMapped: false,
      }),
    );
    this.cityGlow.position.set(0, 60, -520);
    this.cityGlow.scale.set(1150, 300, 1);
    this.cityGroup.add(this.cityGlow);

    // Small bridge silhouette with a line of lights.
    const bridgeMat = new THREE.MeshBasicMaterial({ color: 0x05070b, fog: true });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(360, 4, 8), bridgeMat);
    bridge.position.set(-445, 8, -365);
    this.cityGroup.add(bridge);
    const bridgeLightPos = [];
    const bridgeLightCol = [];
    const bridgeLightSize = [];
    const bridgeLightPhase = [];
    for (let i = 0; i < 24; i++) {
      bridgeLightPos.push(-610 + i * 14.5, 11, -365);
      bridgeLightCol.push(1.4, 0.82, 0.42);
      bridgeLightSize.push(2.2);
      bridgeLightPhase.push(i);
    }
    const brgeo = new THREE.BufferGeometry();
    brgeo.setAttribute('position', new THREE.Float32BufferAttribute(bridgeLightPos, 3));
    brgeo.setAttribute('aColor', new THREE.Float32BufferAttribute(bridgeLightCol, 3));
    brgeo.setAttribute('aSize', new THREE.Float32BufferAttribute(bridgeLightSize, 1));
    brgeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(bridgeLightPhase, 1));
    this.bridgeLights = new THREE.Points(brgeo, this.cityLightMaterial);
    this.cityGroup.add(this.bridgeLights);

    this.scene.add(this.cityGroup);
  }

  buildTerrain() {
    const farShore = new THREE.Mesh(
      new THREE.PlaneGeometry(1800, 240),
      new THREE.MeshStandardMaterial({
        color: 0x05070b,
        roughness: 1,
        metalness: 0,
      }),
    );
    farShore.rotation.x = -Math.PI / 2;
    farShore.position.set(0, -0.4, -470);
    this.scene.add(farShore);

    // Low distant ridge silhouette.
    const ridgeShape = new THREE.Shape();
    ridgeShape.moveTo(-900, -10);
    const rand = seededRandom(82);
    for (let x = -900; x <= 900; x += 45) {
      const h = 12 + rand() * 44 + Math.sin(x * 0.01) * 18;
      ridgeShape.lineTo(x, h);
    }
    ridgeShape.lineTo(900, -10);
    ridgeShape.closePath();
    const ridge = new THREE.Mesh(
      new THREE.ShapeGeometry(ridgeShape),
      new THREE.MeshBasicMaterial({ color: 0x04060b, fog: true }),
    );
    ridge.position.set(0, 0, -720);
    this.scene.add(ridge);

    const shore = new THREE.Mesh(
      new THREE.PlaneGeometry(2300, 500),
      new THREE.MeshStandardMaterial({ color: 0x030509, roughness: 1 }),
    );
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(0, -0.25, 520);
    this.scene.add(shore);
  }

  buildPier() {
    this.pierGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x17120f,
      roughness: 0.78,
      metalness: 0.06,
    });
    const darkWood = new THREE.MeshStandardMaterial({
      color: 0x0c0b0a,
      roughness: 0.9,
      metalness: 0.02,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.5,
      metalness: 0.55,
    });

    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), woodMat, 42);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 42; i++) {
      m.compose(
        new THREE.Vector3(0, 0.1, 82 + i * 2.45),
        new THREE.Quaternion(),
        new THREE.Vector3(13.5, 0.38, 2.1),
      );
      planks.setMatrixAt(i, m);
    }
    planks.instanceMatrix.needsUpdate = true;
    this.pierGroup.add(planks);

    const postGeo = new THREE.CylinderGeometry(0.17, 0.2, 3.5, 7);
    const posts = new THREE.InstancedMesh(postGeo, railMat, 20);
    let pi = 0;
    for (const x of [-6.3, 6.3]) {
      for (let i = 0; i < 10; i++) {
        m.compose(
          new THREE.Vector3(x, 1.8, 85 + i * 10.2),
          new THREE.Quaternion(),
          new THREE.Vector3(1, 1, 1),
        );
        posts.setMatrixAt(pi++, m);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    this.pierGroup.add(posts);

    const railGeo = new THREE.BoxGeometry(0.11, 0.11, 92);
    for (const x of [-6.3, 6.3]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(x, 3.25, 131);
      this.pierGroup.add(rail);
    }

    // Lanterns at the pier head.
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false });
    this.pierLamps = [];
    for (const x of [-5.4, 5.4]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), lampMat);
      lamp.position.set(x, 3.55, 181);
      this.pierGroup.add(lamp);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: 0xffbd76,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      glow.position.copy(lamp.position);
      glow.scale.set(8, 8, 1);
      this.pierGroup.add(glow);
      this.pierLamps.push(glow);
    }

    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.6, 8), darkWood);
    bollard.position.set(-5.4, 0.8, 76);
    this.pierGroup.add(bollard);

    this.scene.add(this.pierGroup);
  }

  buildLake() {
    const lakeGeo = new THREE.PlaneGeometry(1600, 760, 1, 1);
    const reflector = new Reflector(lakeGeo, {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x091018,
      multisample: 0,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(0, -0.06, 0);
    reflector.renderOrder = -5;
    this.reflector = reflector;
    this.scene.add(reflector);

    this.waterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x02070d) },
      uTint: { value: new THREE.Color(0x16384b) },
      uCityGlow: { value: new THREE.Color(0xff9b5c) },
      uOpacity: { value: 0.36 },
      uReflection: { value: 1 },
    };
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: waterOverlayVert,
      fragmentShader: waterOverlayFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(1600, 760), this.waterMat);
    overlay.rotation.x = -Math.PI / 2;
    overlay.position.set(0, 0.015, 0);
    overlay.renderOrder = -4;
    this.waterOverlay = overlay;
    this.scene.add(overlay);

    // Buoys mark the far edge of the firing zone and add reflected pinpoints.
    this.buoys = [];
    const buoyMat = new THREE.MeshBasicMaterial({ color: 0xffb763, toneMapped: false });
    for (let i = 0; i < 7; i++) {
      const x = -300 + i * 100;
      const z = -230 + (i % 2) * 14;
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), buoyMat);
      buoy.position.set(x, 0.35, z);
      this.scene.add(buoy);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: 0xffb25b,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      glow.position.set(x, 0.8, z);
      glow.scale.set(14, 14, 1);
      this.scene.add(glow);
      this.buoys.push(glow);
    }
  }

  buildBeams() {
    this.beams = [];
    const rand = seededRandom(52);
    const beamGeo = new THREE.ConeGeometry(32, 280, 28, 1, true);
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(i % 2 ? 0xffae70 : 0x75a8ff) },
          uOpacity: { value: 0.045 },
        },
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const beam = new THREE.Mesh(beamGeo, mat);
      beam.position.set(-420 + i * 210 + (rand() - 0.5) * 60, 140, -380);
      beam.rotation.z = (rand() - 0.5) * 0.18;
      beam.rotation.x = (rand() - 0.5) * 0.08;
      beam.userData.phase = rand() * 10;
      beam.userData.baseRot = beam.rotation.z;
      this.beams.push(beam);
      this.scene.add(beam);
    }
  }

  buildFallingStars() {
    const count = 140;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const rand = seededRandom(661);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * 800;
      positions[i * 3 + 1] = 70 + rand() * 260;
      positions[i * 3 + 2] = -40 - rand() * 340;
      c.setHSL(0.09 + rand() * 0.06, 0.5, 0.72);
      colors[i * 3] = c.r * 1.35;
      colors[i * 3 + 1] = c.g * 1.35;
      colors[i * 3 + 2] = c.b * 1.35;
      sizes[i] = 1.2 + rand() * 2.7;
      phases[i] = rand() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    this.fallingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.72 },
        uPixelRatio: { value: this.pixelRatio },
      },
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.fallingStars = new THREE.Points(geo, this.fallingMaterial);
    this.fallingStars.userData = { speeds: new Float32Array(count) };
    for (let i = 0; i < count; i++) this.fallingStars.userData.speeds[i] = 1.2 + rand() * 2.4;
    this.fallingStars.frustumCulled = false;
    this.scene.add(this.fallingStars);
  }

  buildAmbientMotes() {
    const count = 130;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const rand = seededRandom(91);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * 700;
      positions[i * 3 + 1] = 2 + rand() * 60;
      positions[i * 3 + 2] = -300 + rand() * 500;
      velocities[i * 3] = (rand() - 0.5) * 0.8;
      velocities[i * 3 + 1] = 0.2 + rand() * 0.6;
      velocities[i * 3 + 2] = (rand() - 0.5) * 0.7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: this.glowTex,
        color: 0xffc78a,
        size: 3.2,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.motes.frustumCulled = false;
    this.motes.userData.velocities = velocities;
    this.scene.add(this.motes);
  }

  buildLights() {
    this.ambient = new THREE.AmbientLight(0x22304f, 0.58);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0x506b9f, 0x07060a, 0.72);
    this.scene.add(this.hemi);

    this.moonLight = new THREE.DirectionalLight(0x9cb6e9, 0.62);
    this.moonLight.position.set(-260, 220, -520);
    this.scene.add(this.moonLight);

    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 800, 2);
      light.position.set(0, 100, -100);
      light.userData.energy = 0;
      this.scene.add(light);
      this.lights.push(light);
    }

    const pierLight = new THREE.PointLight(0xffb36b, 12, 70, 2);
    pierLight.position.set(0, 4.4, 181);
    this.scene.add(pierLight);
    this.pierLight = pierLight;
  }

  setTheme(name) {
    const theme = THEMES[name] || THEMES.free;
    this.themeName = name;
    this.theme = theme;
    this.skyUniforms.uTop.value.setHex(theme.top);
    this.skyUniforms.uHorizon.value.setHex(theme.horizon);
    this.skyUniforms.uBottom.value.setHex(theme.bottom);
    this.skyUniforms.uGlow.value.setHex(theme.glow);
    this.skyUniforms.uGalaxy.value = theme.galaxy;
    this.scene.fog.color.setHex(theme.fog);
    this.scene.fog.density = theme.fogDensity;
    this.starMaterial.uniforms.uOpacity.value = theme.stars;
    this.galaxyMaterial.uniforms.uOpacity.value = theme.galaxy > 0.3 ? 0.5 : 0.02;
    this.moonGroup.visible = theme.moon > 0.2;
    this.moonHalo.material.opacity = 0.18 + theme.moon * 0.18;
    this.moon.material.color.setScalar(0.65 + theme.moon * 0.35);
    this.cityMaterials.forEach((mat) => {
      mat.emissiveIntensity = theme.city;
    });
    this.cityGlow.material.opacity = 0.06 + theme.city * 0.065;
    this.clouds.forEach((cloud) => {
      cloud.material.color.setHex(theme.cloud);
      cloud.material.opacity = theme.cloudAlpha * (0.55 + cloud.userData.phase * 0.02);
    });
    this.nebulaSprites.forEach((sprite) => {
      sprite.material.opacity = theme.galaxy > 0.3 ? 0.035 + theme.galaxy * 0.022 : 0;
    });
    this.waterUniforms.uTint.value.setHex(theme.horizon).multiplyScalar(0.55);
    this.waterUniforms.uCityGlow.value.setHex(theme.glow);
    this.hemi.color.setHex(theme.glow);
    this.hemi.intensity = name === 'galaxy' ? 0.48 : 0.72;
    this.beams.forEach((beam, i) => {
      beam.material.uniforms.uColor.value.setHex(i % 2 ? theme.glow : 0x7097ff);
    });
    this.updateReflectionState();
  }

  setQuality(quality) {
    this.quality = quality;
    const cfg = {
      low: { reflection: false, water: 0.48, stars: 0.5 },
      medium: { reflection: true, water: 0.42, stars: 0.7 },
      high: { reflection: true, water: 0.36, stars: 1 },
      ultra: { reflection: true, water: 0.32, stars: 1.2 },
    }[quality] || { reflection: true, water: 0.36, stars: 1 };
    this.qualityCfg = cfg;
    if (this.reflector) {
      const size = quality === 'ultra' ? 2048 : quality === 'high' ? 1024 : 512;
      const target = this.reflector.getRenderTarget();
      if (target) target.setSize(size, size);
    }
    this.waterUniforms.uOpacity.value = cfg.water;
    this.updateReflectionState();
  }

  updateReflectionState() {
    if (!this.reflector) return;
    const on = this.reflectionEnabled && this.qualityCfg?.reflection !== false;
    this.reflector.visible = on;
    this.waterUniforms.uReflection.value = on ? 1 : 0;
  }

  setReflection(enabled) {
    this.reflectionEnabled = enabled;
    this.updateReflectionState();
  }

  setPixelRatio(ratio) {
    this.pixelRatio = ratio;
    this.starMaterial.uniforms.uPixelRatio.value = ratio;
    this.galaxyMaterial.uniforms.uPixelRatio.value = ratio;
    this.beaconMaterial.uniforms.uPixelRatio.value = ratio;
    this.cityLightMaterial.uniforms.uPixelRatio.value = ratio;
    this.fallingMaterial.uniforms.uPixelRatio.value = ratio;
  }

  flash(position, color, power = 1) {
    let light = this.lights.find((l) => l.userData.energy <= 0.01);
    if (!light) {
      light = this.lights.reduce((a, b) => (a.userData.energy < b.userData.energy ? a : b));
    }
    light.position.copy(position);
    light.color.set(color);
    light.userData.energy = Math.max(light.userData.energy, 0.18 + power * 0.6);
    light.intensity = 1200 * power;
    light.distance = 400 + power * 380;
    return light;
  }

  update(dt, time, paused = false) {
    const scaled = paused ? 0 : dt;
    this.time = time;
    this.skyUniforms.uTime.value = time;
    this.starMaterial.uniforms.uTime.value = time;
    this.galaxyMaterial.uniforms.uTime.value = time;
    this.beaconMaterial.uniforms.uTime.value = time;
    this.cityLightMaterial.uniforms.uTime.value = time;
    this.fallingMaterial.uniforms.uTime.value = time;
    this.waterUniforms.uTime.value = time;
    this.stars.rotation.y = time * 0.0012;
    this.galaxyPoints.rotation.y = time * 0.0018;

    this.clouds.forEach((cloud) => {
      const d = cloud.userData;
      cloud.position.x = d.baseX + Math.sin(time * 0.008 + d.phase) * 18 + time * d.drift * 0.18;
      if (cloud.position.x > 900) cloud.position.x = -900;
      cloud.position.y += Math.sin(time * 0.03 + d.phase) * 0.002;
    });

    this.beams.forEach((beam) => {
      beam.rotation.z = beam.userData.baseRot + Math.sin(time * 0.16 + beam.userData.phase) * 0.12;
      beam.material.uniforms.uOpacity.value = 0.018 + 0.028 * (0.5 + 0.5 * Math.sin(time * 0.4 + beam.userData.phase));
    });

    // Falling stars drift down and respawn at the top.
    const pos = this.fallingStars.geometry.attributes.position;
    const speeds = this.fallingStars.userData.speeds;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - speeds[i] * scaled;
      let x = pos.getX(i) + Math.sin(time * 0.21 + i) * scaled * 0.025;
      if (y < 22) {
        y = 300 + Math.random() * 50;
        x = (Math.random() - 0.5) * 800;
      }
      pos.setY(i, y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;

    const mp = this.motes.geometry.attributes.position;
    const mv = this.motes.userData.velocities;
    for (let i = 0; i < mp.count; i++) {
      mp.setX(i, mp.getX(i) + mv[i * 3] * scaled);
      mp.setY(i, mp.getY(i) + mv[i * 3 + 1] * scaled);
      mp.setZ(i, mp.getZ(i) + mv[i * 3 + 2] * scaled);
      if (mp.getY(i) > 72) {
        mp.setY(i, 1.5);
        mp.setX(i, (Math.random() - 0.5) * 700);
        mp.setZ(i, -300 + Math.random() * 500);
      }
    }
    mp.needsUpdate = true;

    this.lights.forEach((light) => {
      light.userData.energy = Math.max(0, light.userData.energy - dt * 1.65);
      const e = light.userData.energy;
      light.intensity = 2400 * e * e;
      light.visible = e > 0.008;
    });

    this.pierLamps.forEach((lamp, i) => {
      const flicker = 0.88 + Math.sin(time * (2.1 + i) + i) * 0.08;
      lamp.material.opacity = 0.42 * flicker;
      lamp.scale.setScalar(7.5 + Math.sin(time * 1.7 + i) * 0.6);
    });
    this.pierLight.intensity = 9 + Math.sin(time * 2.3) * 1.5;

    this.buoys.forEach((buoy, i) => {
      const flicker = 0.62 + Math.sin(time * 1.6 + i * 1.4) * 0.14;
      buoy.material.opacity = flicker;
      buoy.scale.setScalar(12 + Math.sin(time * 1.1 + i) * 1.2);
    });

    this.moonGroup.position.y = 246 + Math.sin(time * 0.015) * 1.2;
  }
}
