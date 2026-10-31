import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, damp, rand } from './config.js';
import { createSoldierModel, animateSoldier } from './models.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

export class Player {
  constructor(scene, world, effects, stats, opts = {}) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.stats = stats;
    this.model = createSoldierModel({
      cape: opts.cape ?? 0x2f6b47,
      jacket: 0x6b5a41,
      hair: 0x241c16,
      scarf: 0x8e2a22,
      blade: 0xe4edf3,
      bladeGlow: 0x2a4050
    });
    this.group = this.model.group;
    this.pos = this.group.position;
    this.pos.copy(opts.position || new THREE.Vector3(0, 0, 40));
    this.pos.y = world.groundHeightAt(this.pos.x, this.pos.z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.group.rotation.y = this.yaw;

    this.maxHp = stats.hp; this.hp = this.maxHp;
    this.maxGas = stats.gas; this.gas = this.maxGas;
    this.maxBlade = 100; this.blade = 100;

    this.cameraYaw = opts.cameraYaw ?? 0;
    this.cameraPitch = 0.18;
    this.cameraDist = 7.2;
    this.cameraPos = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.shake = 0;
    this.fov = 70;

    this.onGround = true;
    this.dead = false;
    this.invuln = 0;
    this.deadTimer = 0;
    this.landTimer = 0;
    this.walkTime = 0;
    this.speed = 0;

    this.hook = { active: false, point: new THREE.Vector3(), time: 0, anchorType: '' };
    this.hookCd = 0;
    this.extraAnchors = [];

    this.attacking = false;
    this.attackTimer = 0;
    this.attackPhase = 0;
    this.attackCd = 0;
    this.attackHitDone = false;
    this.comboIndex = 0;
    this.comboTimer = 0;
    this.combo = 0;
    this.comboHits = 0;
    this.queuedAttack = false;
    this.lastAttackCrit = false;

    this.dodgeCd = 0;
    this.dodgeTimer = 0;
    this.boosting = false;
    this.boostTime = 0;
    this.airTime = 0;

    this.lockTarget = null;
    this.onAttackHit = null;
    this.onToast = null;
    this.onDeath = null;
    this.onHookFail = null;
    this.onHook = null;
    this.onDamage = null;
    this.audio = null;
    this.game = null;
  }

  get moveSpeed() {
    if (this.onGround) return this.stats.speed || 8.2;
    return 8;
  }

  addShake(n) { this.shake = Math.min(1.2, this.shake + n); }

  toggleHook(forward) {
    if (this.dead) return;
    if (this.hook.active) { this.releaseHook(); return; }
    if (this.hookCd > 0) return;
    const f = forward ? forward.clone() : this.getAimDirection();
    const extra = this.extraAnchors || [];
    const anchor = this.world.findAnchor(this.pos, f, this.stats.hookRange, extra);
    if (!anchor) {
      this.onHookFail?.('Không có điểm móc trong tầm nhìn');
      this.audio?.play('release');
      return;
    }
    this.hook.active = true;
    this.hook.point.copy(anchor);
    this.hook.time = 0;
    this.hookCd = 0.25;
    this.onGround = false;
    this.audio?.play('grapple');
    this.onHook?.(anchor);
    this.effects?.sparks(anchor, 6, 0xd9e8f3);
  }

  releaseHook(silent = false) {
    if (!this.hook.active) return;
    this.hook.active = false;
    this.hookCd = 0.22;
    this.effects?.hideLine();
    if (!silent) this.audio?.play('release');
  }

  getAimDirection() {
    return _v.set(
      -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      -Math.sin(this.cameraPitch),
      -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
    ).normalize().clone();
  }

  updateCamera(dt, input) {
    const look = input.consumeLook();
    const sens = 0.0023 * (input.sensitivity || 1);
    this.cameraYaw -= look.x * sens;
    this.cameraPitch += look.y * sens * (input.invertY ? -1 : 1);
    this.cameraPitch = clamp(this.cameraPitch, -0.42, 1.12);
    const wheel = input.consumeWheel();
    if (wheel) this.cameraDist = clamp(this.cameraDist + wheel * 0.55, 4.2, 12);

    this.cameraTarget.copy(this.pos);
    this.cameraTarget.y += 1.55;
    const d = this.cameraDist;
    const cp = Math.cos(this.cameraPitch);
    const desired = _v2.set(
      this.cameraTarget.x + Math.sin(this.cameraYaw) * d * cp,
      this.cameraTarget.y + Math.sin(this.cameraPitch) * d + 0.4,
      this.cameraTarget.z + Math.cos(this.cameraYaw) * d * cp
    );
    const ground = this.world.groundHeightAt(desired.x, desired.z, 0.1);
    if (desired.y < ground + 0.6) desired.y = ground + 0.6;
    const safe = this.world.cameraBoom(this.cameraTarget, desired);
    if (!this.cameraInit) { this.cameraPos.copy(safe); this.cameraInit = true; }
    const k = 1 - Math.exp(-12 * dt);
    this.cameraPos.lerp(safe, k);
    if (this.cameraPos.lengthSq() < 0.001) this.cameraPos.copy(safe);

    // shake
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.6);
      const s = this.shake * this.shake * 0.55;
      this.cameraPos.x += rand(-s, s);
      this.cameraPos.y += rand(-s, s);
      this.cameraPos.z += rand(-s, s);
    }
    // fov by speed
    const sp = this.vel.length();
    const targetFov = 70 + clamp((sp - 12) * .42, 0, 22);
    this.fov = damp(this.fov, targetFov, 4, dt);
    return { pos: this.cameraPos, target: this.cameraTarget, fov: this.fov };
  }

  update(dt, input, game) {
    this.game = game;
    this.audio = game.audio;
    input.sensitivity = game.settings.sensitivity;
    input.invertY = game.settings.invertY;
    this.extraAnchors = game.getTitanAnchors(this.pos);

    if (this.dead) {
      this.deadTimer += dt;
      const k = Math.min(1, this.deadTimer / .9);
      this.group.rotation.z = Math.PI * .5 * k;
      this.group.position.y = Math.max(0, this.pos.y);
      return;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.hookCd = Math.max(0, this.hookCd - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.combo = this.comboTimer > 0 ? this.combo : 0;
    this.comboHits = this.comboTimer > 0 ? this.comboHits : 0;
    this.landTimer = Math.max(0, this.landTimer - dt);

    const mv = input.moveVector;
    const boostHeld = !!input.down.boost;
    this.boosting = false;

    // actions
    if (input.consume('jump')) this.jump();
    if (input.consume('attack')) this.attack();
    if (input.consume('hook')) this.toggleHook();
    if (input.consume('dodge')) this.dodge(mv);

    if (this.attacking) {
      this.attackTimer += dt;
      this.attackPhase = clamp(this.attackTimer / 0.42, 0, 1);
      if (!this.attackHitDone && this.attackTimer >= 0.17) {
        this.attackHitDone = true;
        this.resolveHit();
      }
      if (this.attackTimer >= 0.42) {
        this.attacking = false;
        if (this.queuedAttack) {
          this.queuedAttack = false;
          this.attack();
        }
      }
    }

    // camera-relative movement direction
    const camF = _fwd.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const camR = _right.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const wish = _v3.set(0, 0, 0).addScaledVector(camF, -mv.y).addScaledVector(camR, mv.x);
    if (wish.lengthSq() > 1) wish.normalize();
    const wishLen = Math.min(1, Math.hypot(mv.x, mv.y));

    if (this.hook.active) {
      this.updateHookPhysics(dt, wish, wishLen, boostHeld);
      this.onGround = false;
      this.airTime += dt;
    } else if (this.onGround) {
      this.airTime = 0;
      const sprint = boostHeld && this.gas > 0;
      if (sprint && wishLen > 0.1) {
        this.gas = Math.max(0, this.gas - 7 * dt);
        if (Math.random() < dt * 8) this.effects?.dust(this.pos.clone().setY(this.pos.y + .2), 1, 0xb9ad97);
      }
      const targetSpeed = this.moveSpeed * (sprint ? 1.5 : 1) * wishLen;
      const desiredVx = wish.x * targetSpeed;
      const desiredVz = wish.z * targetSpeed;
      const accel = this.invuln > 0 && this.dodgeTimer > 0 ? 26 : 18;
      this.vel.x = damp(this.vel.x, desiredVx, accel, dt);
      this.vel.z = damp(this.vel.z, desiredVz, accel, dt);
      if (wishLen > .05) {
        const desiredYaw = Math.atan2(wish.x, wish.z);
        this.yaw += this.angleTo(this.yaw, desiredYaw) * Math.min(1, dt * 12);
      }
      this.vel.y -= 26 * dt;
    } else {
      this.airTime += dt;
      // air control: preserve momentum, steer with acceleration
      if (wishLen > .05) {
        const airAccel = this.airTime < .35 ? 24 : 15;
        this.vel.x += wish.x * airAccel * dt;
        this.vel.z += wish.z * airAccel * dt;
      }
      this.vel.x *= (1 - 0.18 * dt);
      this.vel.z *= (1 - 0.18 * dt);
      if (boostHeld && this.gas > 0) {
        this.boosting = true;
        this.boostTime += dt;
        this.gas = Math.max(0, this.gas - 19 * dt);
        this.vel.x += camF.x * 22 * dt;
        this.vel.z += camF.z * 22 * dt;
        this.vel.y += 10 * dt;
        if (Math.random() < dt * 22) {
          this.effects?.burst(this.pos.clone().setY(this.pos.y + 1.1), 0xbfd8e6, 2, 5, .28, .4, -2);
        }
        if (Math.random() < dt * 3) this.audio?.play('gas');
      }
      this.vel.y -= 22 * dt;
    }

    // attack lunge
    if (this.attacking && this.attackTimer > .05 && this.attackTimer < .2) {
      const lunge = this.hook.active ? 15 : 9;
      if (this.lockTarget && !this.lockTarget.dead) {
        _v.subVectors(this.lockTarget.getCenter(_v2), this.pos).setY(0).normalize();
        this.vel.addScaledVector(_v, lunge * dt * 6);
      } else {
        this.vel.addScaledVector(wish.lengthSq() > .1 ? wish : camF, lunge * dt * 3);
      }
    }

    // cap speed
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const maxSp = this.hook.active ? 58 : (this.boosting ? 34 : 24);
    if (sp > maxSp) { this.vel.x = this.vel.x / sp * maxSp; this.vel.z = this.vel.z / sp * maxSp; }

    // integrate
    this.pos.addScaledVector(this.vel, dt);

    // bounds
    const B = 665;
    if (this.pos.x < -B) { this.pos.x = -B; this.vel.x = Math.abs(this.vel.x) * .2; }
    if (this.pos.x > B) { this.pos.x = B; this.vel.x = -Math.abs(this.vel.x) * .2; }
    if (this.pos.z < -B) { this.pos.z = -B; this.vel.z = Math.abs(this.vel.z) * .2; }
    if (this.pos.z > B) { this.pos.z = B; this.vel.z = -Math.abs(this.vel.z) * .2; }

    // collision + ground
    this.world.resolveCircle(this.pos, 0.5);
    const gh = this.world.groundHeightAt(this.pos.x, this.pos.z, 0.3);
    if (this.pos.y <= gh) {
      const wasAir = !this.onGround;
      this.pos.y = gh;
      if (this.vel.y < 0) {
        if (wasAir && this.vel.y < -14) {
          this.audio?.play('land');
          this.effects?.dust(this.pos.clone(), 8, 0xb5a890);
          this.addShake(Math.min(.35, -this.vel.y * .008));
        }
        this.vel.y = 0;
      }
      this.onGround = true;
      this.landTimer = .12;
    } else {
      this.onGround = false;
    }

    // gas / blade / hp regen
    if (this.onGround) {
      this.gas = Math.min(this.maxGas, this.gas + 25 * dt);
      this.blade = Math.min(this.maxBlade, this.blade + 20 * dt);
      this.hp = Math.min(this.maxHp, this.hp + this.stats.regen * dt);
    } else if (!this.hook.active && !this.boosting) {
      this.gas = Math.min(this.maxGas, this.gas + 3 * dt);
    }

    // hook tether visual
    if (this.hook.active) {
      const from = this.pos.clone().add(new THREE.Vector3(0, 1.0, 0));
      this.effects?.setLine(from, this.hook.point);
      this.hook.time += dt;
      if (this.gas <= 0) this.releaseHook();
      const d = this.pos.distanceTo(this.hook.point);
      if (d < 4.5) this.releaseHook();
    } else {
      this.effects?.hideLine();
    }

    // animation
    this.walkTime += dt * (1 + this.speed * .12);
    this.speed = this.vel.length();
    animateSoldier(this.model, this.walkTime, this.onGround ? this.speed : 9, !this.onGround, this.attacking, this.attackPhase, dt);
    if (this.attacking) {
      this.model.arms[0].rotation.z = -0.5 * Math.sin(this.attackPhase * Math.PI);
      this.model.arms[1].rotation.z = 0.5 * Math.sin(this.attackPhase * Math.PI);
    }
    // facing in air
    if (!this.onGround && !this.hook.active && this.vel.lengthSq() > 9) {
      const dy = Math.atan2(this.vel.x, this.vel.z);
      this.yaw += this.angleTo(this.yaw, dy) * Math.min(1, dt * 5);
    }
    this.group.rotation.y = this.yaw;
    this.group.rotation.z = this.hook.active ? clamp(-this.vel.x * .004, -.28, .28) : 0;

    // lock target validity
    if (this.lockTarget && (this.lockTarget.dead || this.pos.distanceTo(this.lockTarget.getCenter(_v2)) > 180)) {
      this.lockTarget = null;
    }
  }

  updateHookPhysics(dt, wish, wishLen, boost) {
    const to = _v.subVectors(this.hook.point, this.pos);
    const dist = to.length();
    to.normalize();
    const reel = (boost ? 66 : 36) * this.stats.reel;
    this.vel.addScaledVector(to, reel * dt);
    // gas lift keeps the tether hoisting the soldier upward, not dragging on the ground
    this.vel.y += 7 * dt;
    // tangential steering
    if (wishLen > .05) {
      this.vel.x += wish.x * 14 * dt;
      this.vel.z += wish.z * 14 * dt;
    }
    // pendulum gravity
    this.vel.y -= 11 * dt;
    // rope constraint: remove outward radial velocity when taut
    const radial = this.vel.dot(to);
    if (radial < 0) this.vel.addScaledVector(to, -radial * 0.75);
    // damping
    this.vel.multiplyScalar(1 - 0.11 * dt);
    this.gas = Math.max(0, this.gas - (boost ? 13 : 2.2) * dt);
    this.boosting = boost;
    if (boost) {
      this.vel.y += 4.5 * dt;
      if (Math.random() < dt * 18) this.effects?.burst(this.pos.clone().setY(this.pos.y + 1), 0xc8dce7, 2, 4, .25, .35, 0);
      if (Math.random() < dt * 2.5) this.audio?.play('gas');
    }
    if (Math.random() < dt * 10) this.effects?.burst(this.hook.point, 0xd8e2ea, 1, 1.5, .18, .3, -2);
  }

  jump() {
    if (this.dead) return;
    if (this.hook.active) {
      this.releaseHook();
      this.vel.y += 8;
      this.audio?.play('jump');
      return;
    }
    if (this.onGround) {
      this.vel.y = 12;
      this.onGround = false;
      this.audio?.play('jump');
      this.effects?.dust(this.pos.clone(), 4, 0xb5a890);
    }
  }

  dodge(mv) {
    if (this.dodgeCd > 0 || this.dead) return;
    this.dodgeCd = 1.15;
    this.dodgeTimer = .38;
    this.invuln = Math.max(this.invuln, .42);
    const dir = _v.set(0, 0, 0);
    if (Math.hypot(mv.x, mv.y) > .15) {
      dir.addScaledVector(_fwd.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw)), -mv.y);
      dir.addScaledVector(_right.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw)), mv.x);
      dir.normalize();
    } else {
      dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    }
    this.vel.x += dir.x * 20;
    this.vel.z += dir.z * 20;
    if (!this.onGround) this.vel.y += 4;
    this.audio?.play('dodge');
    this.effects?.dust(this.pos.clone(), 6, 0xcfc4ae);
  }

  attack() {
    if (this.dead) return;
    if (this.attacking) { this.queuedAttack = true; return; }
    if (this.attackCd > 0) return;
    this.attacking = true;
    this.attackTimer = 0;
    this.attackPhase = 0;
    this.attackHitDone = false;
    this.attackCd = .3;
    if (this.comboTimer > 0) this.comboIndex = (this.comboIndex % 3) + 1;
    else this.comboIndex = 1;
    this.comboTimer = this.stats.comboWindow;
    this.blade = Math.max(0, this.blade - 5);
    this.audio?.play('swing');
    // slash visual in front
    const front = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 2.2, 1.1, Math.cos(this.yaw) * 2.2));
    this.effects?.slash(front, 4.2, 0xe9f3fa, this.comboIndex === 2);
  }

  resolveHit() {
    const titans = this.game?.titans?.titans || [];
    let target = null;
    let best = Infinity;
    if (this.lockTarget && !this.lockTarget.dead) {
      const d = this.pos.distanceTo(this.lockTarget.getCenter(_v2));
      if (d <= 24) target = this.lockTarget;
    }
    if (!target) {
      for (const t of titans) {
        if (t.dead) continue;
        const chest = t.getChestPoint(_v2);
        const d = this.pos.distanceTo(chest);
        const reach = t.type.key === 'dummy' ? 5.5 : 6.2 + t.height * .12;
        if (d < reach && d < best) { best = d; target = t; }
      }
    }
    if (!target) return;
    const center = target.getCenter(_v2);
    const nape = target.getNapePoint(_v3);
    const distNape = this.pos.distanceTo(nape);
    const behind = target.isBehind(this.pos);
    const high = this.pos.y > target.height * 0.38;
    const crit = (distNape < 8.5 && behind && high) || (this.comboIndex === 3 && behind && distNape < 11);
    const finisher = this.comboIndex === 3 ? this.stats.finisher : 1;
    const base = 30 * this.stats.damage * finisher * (crit ? 2.75 : 1);
    const bladeFactor = this.blade <= 0 ? .42 : (this.blade < 20 ? .72 : 1);
    const dmg = target.damage(base * bladeFactor, { crit, heavy: this.comboIndex === 3, source: this, sourceKind: 'player' });
    this.lastAttackCrit = crit;
    const hitPos = crit ? nape.clone() : center.clone();
    this.effects?.slash(hitPos, crit ? 8 : 5.2, crit ? 0xffcf6e : 0xffffff, Math.random() < .5);
    this.effects?.sparks(hitPos, crit ? 18 : 9, crit ? 0xffd06e : 0xffe1a3);
    this.effects?.number(hitPos, (crit ? 'GÁY! ' : '') + Math.round(dmg), crit ? 'crit' : '');
    this.audio?.play(crit ? 'crit' : 'hit');
    this.addShake(crit ? .35 : .12);
    if (crit) this.game?.toast('CHÉM GÁY! Sát thương chí mạng', 'gold');
    if (this.blade <= 0) this.onToast?.('Lưỡi kiếm đã mòn — hạ cánh để mài lại');
    this.combo += 1;
    this.comboHits = this.combo;
    this.comboTimer = this.stats.comboWindow;
    this.onAttackHit?.(target, dmg, crit);
  }

  takeDamage(amount, source) {
    if (this.dead || this.invuln > 0) return;
    const dmg = Math.max(1, amount * this.stats.armor);
    this.hp -= dmg;
    this.invuln = .65;
    this.addShake(.5);
    this.audio?.play('hurt');
    this.onDamage?.(dmg);
    this.game?.flashDamage();
    this.effects?.burst(this.pos.clone().setY(this.pos.y + 1.2), 0xb3271c, 12, 5, .35, .8, -8);
    if (source && source.group) {
      _v.subVectors(this.pos, source.group.position).setY(0).normalize();
      this.vel.addScaledVector(_v, 9);
      this.vel.y += 4;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deadTimer = 0;
      this.releaseHook(true);
      this.audio?.play('death');
      this.onDeath?.(source);
    }
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  angleTo(a, b) {
    let d = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
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
