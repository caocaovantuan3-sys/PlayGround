import * as THREE from '../vendor/three/three.module.min.js';
import { TITAN_TYPES, rand, clamp, angleDelta } from './config.js';
import { createTitanModel, createSoldierModel, animateSoldier } from './models.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Titan {
  constructor(typeKey, position, opts = {}) {
    this.typeKey = typeKey;
    this.type = TITAN_TYPES[typeKey] || TITAN_TYPES.normal;
    this.opts = opts;
    this.hpMult = opts.hpMult ?? 1;
    this.dmgMult = opts.dmgMult ?? 1;
    this.boss = !!opts.boss;
    this.height = this.type.height * (opts.scale || 1);
    this.maxHp = this.type.hp * this.hpMult * (opts.hpScale || 1);
    this.hp = this.maxHp;
    this.radius = Math.max(0.9, this.height * 0.17);
    this.model = createTitanModel(this.type);
    this.group = this.model.group;
    this.group.position.copy(position);
    this.group.position.y = 0;
    this.group.rotation.y = rand(0, Math.PI * 2);
    this.yaw = this.group.rotation.y;
    this.state = this.type.aggro ? 'idle' : 'dummy';
    this.stateTime = 0;
    this.time = rand(0, 10);
    this.dead = false;
    this.remove = false;
    this.deathTimer = 0;
    this.attackCd = rand(0.4, 1.6);
    this.attackWindup = 0;
    this.attackDone = false;
    this.stagger = 0;
    this.target = null;
    this.targetKind = null;
    this.chooseCd = rand(0, .4);
    this.wander = new THREE.Vector3(position.x + rand(-16, 16), 0, position.z + rand(-16, 16));
    this.wanderCd = rand(2, 6);
    this.roarCd = rand(4, 12);
    this.spawnPos = position.clone();
    this.hitFlash = 0;
    this.blockedTime = 0;
    this.sideStep = 0;
    this.scale = this.type.height / 4.4 * (opts.scale || 1);
    this._gateWp = new THREE.Vector3();
  }

  get alive() { return !this.dead; }

  getNapePoint(out = new THREE.Vector3()) {
    out.set(0, 3.48, -0.36);
    this.group.localToWorld(out);
    return out;
  }
  getChestPoint(out = new THREE.Vector3()) {
    out.set(0, 2.7, 0);
    this.group.localToWorld(out);
    return out;
  }
  getCenter(out = new THREE.Vector3()) {
    out.copy(this.group.position);
    out.y = this.height * 0.55;
    return out;
  }
  getTop(out = new THREE.Vector3()) {
    out.copy(this.group.position);
    out.y = this.height;
    return out;
  }

  isBehind(point) {
    // local Z of titan; nape is at negative Z, so a player behind has negative local z
    const dx = point.x - this.group.position.x;
    const dz = point.z - this.group.position.z;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    return (dx * fx + dz * fz) < 0.2;
  }

  damage(amount, info = {}) {
    if (this.dead) return 0;
    let dmg = amount;
    const crit = !!info.crit;
    if (!crit && this.type.armor) dmg *= (1 - this.type.armor);
    dmg = Math.max(1, dmg);
    this.hp -= dmg;
    this.hitFlash = 0.14;
    if (crit || info.heavy) this.stagger = crit ? 1.5 : 0.55;
    if (this.type.aggro && !this.target && info.source) {
      this.target = info.source;
      this.targetKind = info.sourceKind || 'player';
      this.state = 'chase';
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(info);
    }
    return dmg;
  }

  die(info = {}) {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.deathTimer = 0;
    this.killedBy = info.sourceKind || 'player';
    this.onKill?.(this);
    this.effects?.steam(this.getCenter(), this.boss ? 40 : 18, this.boss ? 2.4 : 1.2);
    this.effects?.burst(this.getChestPoint(), 0x8f3327, 14, 6, .5, 1.1, -6);
  }

  update(dt, ctx) {
    this.time += dt;
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const k = clamp(this.hitFlash / 0.14, 0, 1);
      this.model.skin.emissive?.setRGB(k * .5, k * .06, 0);
    } else if (this.model.skin.emissive) {
      this.model.skin.emissive.setRGB(0, 0, 0);
    }

    if (this.dead) {
      this.deathTimer += dt;
      const k = Math.min(1, this.deathTimer / 1.1);
      this.group.rotation.x = -Math.PI * .5 * (k * k);
      if (this.deathTimer > 2.4) this.group.position.y -= dt * 0.9;
      if (this.deathTimer > 4.6) {
        this.group.visible = false;
        this.remove = true;
      }
      if (this.type.key === 'colossal' && this.deathTimer < 2.4) {
        this.effects?.steam(this.getCenter(), 3, 2.2);
      }
      return;
    }

    if (this.state === 'dummy') {
      this.group.rotation.y += dt * 0.05;
      this.model.arms[0].rotation.x = Math.sin(this.time * 1.2) * .08 - .1;
      this.model.arms[1].rotation.x = -Math.sin(this.time * 1.2) * .08 - .1;
      this.model.napeHalo.material.opacity = .35 + Math.sin(this.time * 3) * .15;
      return;
    }

    if (this.stagger > 0) {
      this.stagger -= dt;
      this.group.rotation.z = Math.sin(this.time * 26) * .035;
      if (this.stagger <= 0) this.group.rotation.z = 0;
      return;
    }

    if (this.type.key === 'colossal' && Math.random() < dt * 2.2) {
      this.effects?.steam(this.getCenter(), 1, 1.8);
    }
    this.model.napeHalo.material.opacity = .4 + Math.sin(this.time * 4) * .18;
    if (this.model.glow) this.model.glow.intensity = 1 + Math.sin(this.time * 6) * .3;

    // target selection
    this.chooseCd -= dt;
    if (this.chooseCd <= 0) {
      this.chooseCd = 0.4;
      this.chooseTarget(ctx);
    }

    const targetPos = this.getTargetPos(ctx);
    if (targetPos) {
      const dist = Math.hypot(targetPos.x - this.group.position.x, targetPos.z - this.group.position.z);
      const detect = this.type.detect;
      if (dist < detect || this.state === 'chase' || this.state === 'attack' || this.targetKind === 'gate') {
        if (this.state !== 'attack') this.state = 'chase';
        this.face(targetPos, dt);
        const reach = this.type.attackRange;
        if (dist > reach * 0.82) {
          this.moveToward(targetPos, this.type.speed, dt, ctx.world);
        } else {
          this.state = 'attack';
          this.attackCd -= dt;
          if (this.attackCd <= 0 && this.attackWindup <= 0) {
            this.attackWindup = 0.72;
            this.attackDone = false;
            this.attackCd = rand(1.8, 2.8);
            if (Math.random() < 0.32) ctx.audio?.play('roar');
          }
        }
        if (this.attackWindup > 0) {
          this.attackWindup -= dt;
          const p = 1 - this.attackWindup / 0.72;
          this.model.arms[0].rotation.x = -2.6 * Math.sin(p * Math.PI * .85);
          this.model.arms[1].rotation.x = -2.6 * Math.sin(p * Math.PI * .85);
          this.model.arms[0].rotation.z = -.35 * Math.sin(p * Math.PI);
          this.model.arms[1].rotation.z = .35 * Math.sin(p * Math.PI);
          this.model.torso.rotation.x = -.22 * Math.sin(p * Math.PI);
          if (!this.attackDone && p > .58) {
            this.attackDone = true;
            this.strike(ctx, targetPos);
          }
          if (this.attackWindup <= 0) {
            this.model.arms[0].rotation.set(0, 0, 0);
            this.model.arms[1].rotation.set(0, 0, 0);
            this.model.torso.rotation.x = 0;
          }
        }
      } else {
        this.state = 'idle';
      }
    } else {
      this.state = 'idle';
    }

    if (this.state === 'idle') {
      this.wanderCd -= dt;
      if (this.wanderCd <= 0) {
        this.wanderCd = rand(3, 7);
        this.wander.set(this.spawnPos.x + rand(-22, 22), 0, this.spawnPos.z + rand(-22, 22));
      }
      const d = Math.hypot(this.wander.x - this.group.position.x, this.wander.z - this.group.position.z);
      if (d > 2) {
        this.face(this.wander, dt, .7);
        this.moveToward(this.wander, this.type.speed * .32, dt, ctx.world);
      }
    }

    // animation
    const moving = this.state === 'chase';
    const sw = Math.sin(this.time * (this.type.key === 'aberrant' ? 8.5 : 5.4)) * (moving ? 1 : .18);
    this.model.legs[0].rotation.x = sw * .55;
    this.model.legs[1].rotation.x = -sw * .55;
    this.model.lowerLegs[0].rotation.x = Math.max(0, -sw) * .45;
    this.model.lowerLegs[1].rotation.x = Math.max(0, sw) * .45;
    if (this.attackWindup <= 0) {
      this.model.arms[0].rotation.x = -sw * .32;
      this.model.arms[1].rotation.x = sw * .32;
      this.model.arms[0].rotation.z = .05;
      this.model.arms[1].rotation.z = -.05;
    }
    this.model.torso.rotation.z = Math.sin(this.time * 2.2) * .018;
  }

  chooseTarget(ctx) {
    if (!this.type.aggro) return;
    const p = ctx.player;
    let best = null, bestKind = null, bestD = Infinity;
    if (p && !p.dead) {
      const d = Math.hypot(p.pos.x - this.group.position.x, p.pos.z - this.group.position.z);
      if (d < bestD) { bestD = d; best = p; bestKind = 'player'; }
    }
    for (const a of ctx.allies || []) {
      if (a.downed || a.dead) continue;
      const d = Math.hypot(a.group.position.x - this.group.position.x, a.group.position.z - this.group.position.z);
      if (d < bestD * .9) { bestD = d; best = a; bestKind = 'ally'; }
    }
    if (ctx.gateActive) {
      const gd = Math.hypot(170 - this.group.position.z, this.group.position.x);
      const playerClose = bestKind === 'player' && bestD < 26;
      if ((!playerClose || gd < bestD * .6) && gd < 260) {
        best = ctx.gate; bestKind = 'gate'; bestD = gd;
      }
    }
    if (best) {
      this.target = best;
      this.targetKind = bestKind;
    } else {
      this.target = null;
      this.targetKind = null;
    }
  }

  getTargetPos(ctx) {
    if (this.targetKind === 'gate') {
      // route through the gate opening instead of walking into the wall
      if (this.group.position.z > 187 && Math.abs(this.group.position.x) > 7) {
        this._gateWp.set(0, 0, 214);
        return this._gateWp;
      }
      return ctx.gatePos || null;
    }
    if (this.targetKind === 'player' && ctx.player && !ctx.player.dead) return ctx.player.pos;
    if (this.targetKind === 'ally' && this.target && !this.target.downed && !this.target.dead) return this.target.group.position;
    return null;
  }

  face(pos, dt, speed = 1) {
    const desired = Math.atan2(pos.x - this.group.position.x, pos.z - this.group.position.z);
    this.yaw += angleDelta(this.yaw, desired) * Math.min(1, dt * 4.2 * speed);
    this.group.rotation.y = this.yaw;
  }

  moveToward(pos, speed, dt, world) {
    const dx = pos.x - this.group.position.x;
    const dz = pos.z - this.group.position.z;
    const d = Math.hypot(dx, dz) || 1;
    let mx = dx / d, mz = dz / d;
    if (this.sideStep > 0) {
      this.sideStep -= dt;
      mx = -dz / d; mz = dx / d;
    }
    const step = speed * dt;
    this.group.position.x += mx * step;
    this.group.position.z += mz * step;
    const beforeX = this.group.position.x, beforeZ = this.group.position.z;
    world.resolveCircle(this.group.position, this.radius);
    const moved = Math.hypot(this.group.position.x - beforeX, this.group.position.z - beforeZ);
    if (moved > step * .4 && this.sideStep <= 0) {
      this.blockedTime += dt;
      if (this.blockedTime > .35) {
        this.blockedTime = 0;
        this.sideStep = rand(.6, 1.2);
      }
    } else {
      this.blockedTime = Math.max(0, this.blockedTime - dt);
    }
  }

  strike(ctx, targetPos) {
    const reach = this.type.attackRange + 1.4;
    if (this.targetKind === 'gate') {
      if (ctx.gateActive) {
        ctx.onGateHit?.(this.type.damage * .55 * this.dmgMult, this);
        this.effects?.dust(ctx.gatePos || this.group.position, 10, 0xa89882);
      }
      return;
    }
    const t = this.target;
    if (this.targetKind === 'player') {
      const p = ctx.player;
      if (!p || p.dead) return;
      const d = Math.hypot(p.pos.x - this.group.position.x, p.pos.z - this.group.position.z);
      if (d < reach && Math.abs(p.pos.y - this.group.position.y) < this.height) {
        p.takeDamage(this.type.damage * this.dmgMult, this);
        this.effects?.burst(p.pos.clone().setY(p.pos.y + 1.1), 0xb3271c, 10, 4, .3, .7, -8);
      }
    } else if (this.targetKind === 'ally' && t && !t.downed) {
      const d = Math.hypot(t.group.position.x - this.group.position.x, t.group.position.z - this.group.position.z);
      if (d < reach + 3) t.damage(this.type.damage * this.dmgMult * .8);
    }
    ctx.audio?.play('swing');
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m?.dispose?.();
      }
    });
  }
}

export class TitanManager {
  constructor(scene, effects, world) {
    this.scene = scene;
    this.effects = effects;
    this.world = world;
    this.titans = [];
    this.onKill = null;
    this.killCount = 0;
  }
  spawn(type, pos, opts = {}) {
    const t = new Titan(type, pos, opts);
    t.effects = this.effects;
    t.onKill = (titan) => {
      this.killCount++;
      this.onKill?.(titan);
    };
    this.scene.add(t.group);
    this.titans.push(t);
    this.effects?.dust(pos, 6, 0xb8a98f);
    return t;
  }
  update(dt, ctx) {
    ctx.world = this.world;
    for (const t of this.titans) t.update(dt, ctx);
    for (let i = this.titans.length - 1; i >= 0; i--) {
      const t = this.titans[i];
      if (t.remove) {
        t.dispose(this.scene);
        this.titans.splice(i, 1);
      }
    }
  }
  get alive() { return this.titans.filter(t => !t.dead); }
  nearest(pos, maxDist = Infinity, filter = null) {
    let best = null, bd = maxDist;
    for (const t of this.titans) {
      if (t.dead) continue;
      if (filter && !filter(t)) continue;
      const d = Math.hypot(t.group.position.x - pos.x, t.group.position.z - pos.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  boss() { return this.titans.find(t => t.boss && !t.dead) || null; }
  clear() {
    for (const t of this.titans) t.dispose(this.scene);
    this.titans = [];
  }
}

export class Ally {
  constructor(name, position, opts = {}) {
    this.name = name;
    this.color = opts.color || '#63d69b';
    this.model = createSoldierModel({
      cape: opts.cape || 0x2f6b47,
      jacket: 0x6d5a3f,
      hair: opts.hair || 0x2a211a,
      scarf: opts.scarf || 0x7a2c25,
      blade: 0xcfe0ea
    });
    this.group = this.model.group;
    this.group.position.copy(position);
    this.group.position.y = Math.max(5, position.y);
    this.hp = 100; this.maxHp = 100;
    this.downed = false; this.dead = false; this.reviveTimer = 0;
    this.target = null;
    this.attackCd = rand(.5, 2.2);
    this.seed = rand(0, 100);
    this.time = rand(0, 5);
    this.speed = opts.speed || 18;
    this.damageVal = opts.damage || 22;
    this.offsetAngle = rand(0, 6.3);
    this.line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xcfdae2, transparent: true, opacity: .35 })
    );
    this.line.visible = false;
    this.group.add(this.line);
    this.effects = opts.effects;
  }

  get alive() { return !this.dead; }

  damage(n) {
    if (this.downed || this.dead) return;
    this.hp -= n;
    this.effects?.burst(this.group.position.clone(), 0xb3271c, 8, 3, .25, .6, -6);
    if (this.hp <= 0) {
      this.hp = 0;
      this.downed = true;
      this.reviveTimer = 28;
      this.group.rotation.z = Math.PI * .48;
      this.group.position.y = Math.max(0.2, this.group.position.y * .1);
      this.effects?.steam(this.group.position, 10, .8);
    }
  }

  revive() {
    if (!this.downed || this.dead) return false;
    this.downed = false;
    this.hp = 55;
    this.reviveTimer = 0;
    this.group.rotation.z = 0;
    this.group.position.y = 6;
    this.effects?.burst(this.group.position.clone(), 0x63d69b, 18, 4, .3, .9, 0);
    return true;
  }

  update(dt, ctx) {
    this.time += dt;
    if (this.dead) return;
    if (this.downed) {
      this.reviveTimer -= dt;
      if (this.reviveTimer <= 0) {
        this.dead = true;
        this.group.visible = false;
        ctx.onAllyDead?.(this);
      }
      this.model.arms[0].rotation.z = -1.1;
      this.model.arms[1].rotation.z = 1.1;
      return;
    }

    this.attackCd -= dt;
    let target = null, bd = 170;
    for (const t of ctx.titans) {
      if (t.dead) continue;
      const d = Math.hypot(t.group.position.x - this.group.position.x, t.group.position.z - this.group.position.z);
      if (d < bd) { bd = d; target = t; }
    }
    this.target = target;
    let desired = _v;
    if (target) {
      this.offsetAngle += dt * .45;
      const radius = 13 + Math.sin(this.time * .7 + this.seed) * 5;
      const ang = this.offsetAngle + this.seed;
      desired.set(
        target.group.position.x + Math.cos(ang) * radius,
        Math.max(5, target.height * .72 + 6 + Math.sin(this.time * 1.7 + this.seed) * 2),
        target.group.position.z + Math.sin(ang) * radius
      );
      const nape = target.getNapePoint(_v2);
      if (bd < 26 && this.attackCd <= 0) {
        this.attackCd = rand(1.6, 2.6);
        const dmg = target.damage(this.damageVal, { source: this, sourceKind: 'ally', crit: false });
        this.effects?.slash(nape, 4.5, 0xd8e6ef, Math.random() < .5);
        this.effects?.sparks(nape, 6, 0xffc86e);
        this.effects?.number(nape, String(Math.round(dmg)), '');
        ctx.audio?.play('hit');
      }
    } else {
      desired.copy(ctx.player.pos);
      desired.x += Math.cos(this.time * .5 + this.seed) * 9;
      desired.z += Math.sin(this.time * .5 + this.seed) * 9;
      desired.y = ctx.player.pos.y + 7;
    }
    this.group.position.lerp(desired, Math.min(1, dt * 2.4));
    this.group.position.y = Math.max(3.5, this.group.position.y);
    const faceTarget = target ? target.getCenter(_v2) : ctx.player.pos;
    const desiredYaw = Math.atan2(faceTarget.x - this.group.position.x, faceTarget.z - this.group.position.z);
    this.group.rotation.y += angleDelta(this.group.rotation.y, desiredYaw) * Math.min(1, dt * 5);
    animateSoldier(this.model, this.time, 10, true, false, 0, dt);
    if (target) {
      const arr = this.line.geometry.attributes.position.array;
      arr[0] = 0; arr[1] = 1.1; arr[2] = 0;
      const local = target.getCenter(new THREE.Vector3()).sub(this.group.position);
      arr[3] = local.x; arr[4] = local.y; arr[5] = local.z;
      this.line.geometry.attributes.position.needsUpdate = true;
      this.line.visible = true;
    } else this.line.visible = false;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) { o.geometry?.dispose?.(); const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) m?.dispose?.(); }
    });
  }
}
