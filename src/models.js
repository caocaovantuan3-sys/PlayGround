import * as THREE from '../vendor/three/three.module.min.js';
import { rand } from './config.js';

const skinMats = new Map();
function lambert(color) {
  if (!skinMats.has(color)) skinMats.set(color, new THREE.MeshLambertMaterial({ color }));
  return skinMats.get(color);
}
function std(color, rough = .8, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function limb(rTop, rBottom, len, mat) {
  const geo = new THREE.CapsuleGeometry((rTop + rBottom) / 2, len, 3, 6);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -len / 2;
  m.castShadow = true;
  return m;
}

export function createTitanModel(type) {
  const group = new THREE.Group();
  const H = 4.4;
  const skin = new THREE.MeshLambertMaterial({ color: type.color });
  const hair = new THREE.MeshLambertMaterial({ color: type.hair });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x5b4a3a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1b1512 });
  const tooth = new THREE.MeshLambertMaterial({ color: 0xd8cfb5 });
  const parts = { arms: [], legs: [], lowerArms: [], lowerLegs: [] };
  const mats = [skin, hair, cloth, dark];

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.34, 1.62, 0.78), skin);
  torso.position.y = 2.64; torso.castShadow = true;
  group.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), skin);
  belly.position.set(0, 2.12, 0.06); belly.scale.set(1.06, .62, .86);
  group.add(belly);
  const hip = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.5, 0.66), cloth);
  hip.position.y = 1.88; group.add(hip);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.26, .34, .3, 6), skin);
  neck.position.y = 3.47; group.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.46, 9, 7), skin);
  head.position.y = 3.83; head.scale.set(.94, 1.05, .96); head.castShadow = true;
  group.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.48, 8, 6, 0, Math.PI * 2, 0, Math.PI * .58), hair);
  hairCap.position.y = 3.9; hairCap.scale.set(1.02, 1.05, 1.02);
  group.add(hairCap);
  // eyes
  const eyeGeo = new THREE.SphereGeometry(.055, 5, 4);
  const e1 = new THREE.Mesh(eyeGeo, dark); e1.position.set(-.15, 3.9, .42); group.add(e1);
  const e2 = new THREE.Mesh(eyeGeo, dark); e2.position.set(.15, 3.9, .42); group.add(e2);
  // mouth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.4, .13, .06), dark);
  mouth.position.set(0, 3.68, .43); group.add(mouth);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(.34, .04, .02), tooth);
  teeth.position.set(0, 3.73, .46); group.add(teeth);

  // nape weak point (behind neck)
  const nape = new THREE.Mesh(new THREE.SphereGeometry(.14, 7, 5), new THREE.MeshBasicMaterial({ color: 0xff5b3a }));
  nape.position.set(0, 3.48, -.34);
  group.add(nape);
  parts.nape = nape;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xff6b45, transparent: true, opacity: .55, depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  halo.scale.set(1.1, 1.1, 1);
  halo.position.copy(nape.position);
  group.add(halo);
  parts.napeHalo = halo;

  // arms
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * .82, 3.24, 0);
    const upper = limb(.19, .15, 1.12, skin);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -1.08;
    const lower = limb(.14, .11, 1.08, skin);
    elbow.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.16, 6, 5), skin);
    hand.position.y = -1.08; elbow.add(hand);
    shoulder.add(elbow);
    group.add(shoulder);
    parts.arms.push(shoulder);
    parts.lowerArms.push(elbow);
    if (type.key === 'aberrant') { shoulder.rotation.z = side * 0.14; }
  }

  // legs
  for (const side of [-1, 1]) {
    const hipJ = new THREE.Group();
    hipJ.position.set(side * .36, 1.84, 0);
    const upper = limb(.24, .19, 1.0, skin);
    hipJ.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.98;
    const lower = limb(.18, .14, .9, skin);
    knee.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.34, .2, .58), skin);
    foot.position.set(0, -.95, .14); knee.add(foot);
    hipJ.add(knee);
    group.add(hipJ);
    parts.legs.push(hipJ);
    parts.lowerLegs.push(knee);
  }

  if (type.key === 'armored') {
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x7b7f7e, roughness: .55, metalness: .45 });
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.46, .9, .9), armorMat);
    chest.position.set(0, 3.0, 0); group.add(chest);
    const plates = [
      [0, 2.42, .44, 1.1, .34, .1], [0, 2.05, .48, .9, .2, .08],
      [-.86, 3.12, .1, .42, .26, .72], [.86, 3.12, .1, .42, .26, .72],
      [-.36, 1.42, .12, .38, .34, .42], [.36, 1.42, .12, .38, .34, .42]
    ];
    for (const p of plates) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), armorMat);
      m.position.set(p[0], p[1], p[2]); group.add(m);
    }
    const helm = new THREE.Mesh(new THREE.BoxGeometry(.66, .34, .52), armorMat);
    helm.position.set(0, 4.2, 0); group.add(helm);
  }
  if (type.key === 'colossal') {
    const muscle = new THREE.MeshLambertMaterial({ color: 0x8f3327, emissive: 0x3a0d07, emissiveIntensity: 1 });
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(.14, 1.3, .1), muscle);
      strip.position.set(side * .28, 2.7, .43); group.add(strip);
    }
    const glow = new THREE.PointLight(0xff5522, 1.2, 22, 2);
    glow.position.set(0, 4, 0); group.add(glow);
    parts.glow = glow;
  }
  if (type.key === 'dummy') {
    // straw dummy look with a target on the chest
    const targetMat = new THREE.MeshBasicMaterial({ color: 0xe8dcc0 });
    for (const r of [.52, .34, .16]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - .05, r, 16), targetMat);
      ring.position.set(0, 2.7, .44); group.add(ring);
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0x6c5236 }));
    post.position.set(0, .7, 0); group.add(post);
  }

  group.scale.setScalar(type.height / H);
  parts.group = group;
  parts.torso = torso;
  parts.head = head;
  parts.skin = skin;
  parts.mats = mats;
  parts.baseHeight = H;
  return parts;
}

export function createSoldierModel(opts = {}) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: opts.jacket || 0x6d5a3f, roughness: .82 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });
  const pants = new THREE.MeshLambertMaterial({ color: 0xe2ded2 });
  const boot = new THREE.MeshStandardMaterial({ color: 0x2e2722, roughness: .75 });
  const skin = new THREE.MeshLambertMaterial({ color: opts.skin || 0xe0b18e });
  const hair = new THREE.MeshLambertMaterial({ color: opts.hair || 0x2a211a });
  const capeMat = new THREE.MeshLambertMaterial({ color: opts.cape || 0x2f6b47, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({
    color: opts.blade || 0xdde7ee, roughness: .22, metalness: .9,
    emissive: opts.bladeGlow || 0x223344, emissiveIntensity: .35
  });
  const leather = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: .8 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x9a7c45, roughness: .5, metalness: .6 });
  const parts = { arms: [], legs: [], lowerArms: [], lowerLegs: [], blades: [] };

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(.36, .2, .22), leather);
  pelvis.position.y = .92; group.add(pelvis);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .38, 3, 7), jacket);
  torso.position.y = 1.24; torso.castShadow = true; group.add(torso);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(.42, .09, .25), leather);
  belt.position.y = 1.01; group.add(belt);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .1, 6), skin);
  neck.position.y = 1.51; group.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.145, 9, 7), skin);
  head.position.y = 1.65; head.scale.set(.92, 1.05, .95); head.castShadow = true; group.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.152, 8, 6, 0, Math.PI * 2, 0, Math.PI * .56), hair);
  hairCap.position.y = 1.675; hairCap.scale.set(1.01, 1.03, 1.01); group.add(hairCap);
  // scarf
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(.135, .045, 4, 9), new THREE.MeshLambertMaterial({ color: opts.scarf || 0x7a2c25 }));
  scarf.position.y = 1.53; scarf.rotation.x = Math.PI / 2; group.add(scarf);
  // eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x201a16 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.018, 4, 3), eyeMat);
    eye.position.set(s * .052, 1.67, .128); group.add(eye);
  }
  // ODM gear
  const gear = new THREE.Mesh(new THREE.BoxGeometry(.3, .18, .22), brass);
  gear.position.set(0, 1.02, -.12); group.add(gear);
  for (const s of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .34, 6), steel);
    tank.position.set(s * .18, .9, -.16); tank.rotation.x = .15; group.add(tank);
  }
  // cape
  const capeGeo = new THREE.PlaneGeometry(.5, .78, 1, 3);
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(0, 1.16, -.22);
  cape.rotation.x = .08;
  group.add(cape);
  parts.cape = cape;

  // arms
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * .245, 1.4, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.062, .22, 3, 6), jacket);
    upper.position.y = -.15; shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -.29;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(.05, .22, 3, 6), shirt);
    lower.position.y = -.14; elbow.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.055, 6, 5), skin);
    hand.position.y = -.3; elbow.add(hand);
    // blade hilt
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(.04, .2, .05), leather);
    hilt.position.set(0, -.36, .02); elbow.add(hilt);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.028, .95, .075), steel);
    blade.position.set(0, -.88, .02); blade.rotation.x = -.04;
    elbow.add(blade);
    parts.blades.push(blade);
    shoulder.add(elbow);
    group.add(shoulder);
    parts.arms.push(shoulder);
    parts.lowerArms.push(elbow);
  }
  // legs
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * .115, .92, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .28, 3, 6), pants);
    upper.position.y = -.19; hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -.4;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(.062, .28, 3, 6), pants);
    lower.position.y = -.18; knee.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.12, .09, .24), boot);
    foot.position.set(0, -.36, .05); knee.add(foot);
    hip.add(knee);
    group.add(hip);
    parts.legs.push(hip);
    parts.lowerLegs.push(knee);
  }
  parts.group = group;
  parts.torso = torso;
  parts.head = head;
  parts.mats = [jacket, shirt, pants, boot, skin, hair, capeMat, steel, leather, brass];
  return parts;
}

export function animateSoldier(parts, t, speed, airborne, attacking, attackPhase, dt) {
  const sw = Math.sin(t * (speed > 7 ? 13 : 9)) * Math.min(1, speed / 6);
  parts.legs[0].rotation.x = sw * .75;
  parts.legs[1].rotation.x = -sw * .75;
  parts.lowerLegs[0].rotation.x = Math.max(0, -sw) * .7;
  parts.lowerLegs[1].rotation.x = Math.max(0, sw) * .7;
  if (airborne) {
    parts.legs[0].rotation.x = .5; parts.legs[1].rotation.x = -.35;
    parts.lowerLegs[0].rotation.x = .9; parts.lowerLegs[1].rotation.x = .6;
    parts.arms[0].rotation.x = -.5; parts.arms[1].rotation.x = -.5;
    parts.arms[0].rotation.z = -.4; parts.arms[1].rotation.z = .4;
  } else if (attacking) {
    const ph = Math.sin(attackPhase * Math.PI);
    parts.arms[0].rotation.x = -2.3 * ph;
    parts.arms[1].rotation.x = -1.6 * ph;
    parts.arms[0].rotation.z = -0.5 * ph;
    parts.arms[1].rotation.z = 0.5 * ph;
    parts.arms[0].rotation.y = -0.7 * ph;
    parts.arms[1].rotation.y = 0.7 * ph;
  } else {
    parts.arms[0].rotation.x = -sw * .5;
    parts.arms[1].rotation.x = sw * .5;
    parts.arms[0].rotation.z = -.08;
    parts.arms[1].rotation.z = .08;
  }
  if (parts.cape) {
    parts.cape.rotation.x = .08 + (airborne ? .6 : Math.min(.4, speed * .025)) + Math.sin(t * 4) * .06;
    parts.cape.rotation.z = Math.sin(t * 3.1) * .04;
  }
}
