import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import {
  RoundedBoxGeometry, box, mesh, clamp, lerp, contactShadow, easeInOutCubic, easeOutCubic
} from './utils.js'
import {
  createWoodTexture, createPaperTexture, createVelvetTexture, createSealTexture,
  createBoxArtTexture, createBoxSideTexture, createCardboardBump, makeGradientSprite, FINISHES
} from './textures.js'
import { AccessorySet } from './accessories.js'

const BOX_W = 0.92
const BOX_H = 0.22
const BOX_D = 1.64
const LID_H = 0.105

class PeelSeal {
  constructor(side) {
    this.side = side
    this.group = new THREE.Group()
    this.group.name = `seal-${side > 0 ? 'right' : 'left'}`
    this.group.position.set(side * 0.29, BOX_H + LID_H + 0.003, BOX_D / 2 - 0.055)
    this.progress = 0
    this.removed = false
    const sealTex = createSealTexture()
    const sealMat = new THREE.MeshPhysicalMaterial({
      map: sealTex,
      metalness: 0.38,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.7,
      iridescenceIOR: 1.3,
      iridescenceThicknessMinimum: 100,
      iridescenceThicknessMaximum: 500,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.97,
      envMapIntensity: 1.7
    })
    this.material = sealMat

    const frontGeo = new THREE.PlaneGeometry(0.14, 0.2, 16, 24)
    this.frontGeo = frontGeo
    this.frontBase = Float32Array.from(frontGeo.attributes.position.array)
    this.front = new THREE.Mesh(frontGeo, sealMat)
    this.front.position.set(0, -0.105, 0.058)
    this.front.userData.action = 'seal'
    this.front.userData.side = side
    this.front.castShadow = true
    this.group.add(this.front)

    const topGeo = new THREE.PlaneGeometry(0.14, 0.11, 12, 10)
    this.topBase = Float32Array.from(topGeo.attributes.position.array)
    this.top = new THREE.Mesh(topGeo, sealMat.clone())
    this.top.rotation.x = -Math.PI / 2
    this.top.position.set(0, 0.002, 0)
    this.top.userData.action = 'seal'
    this.top.userData.side = side
    this.group.add(this.top)

    const tabMat = new THREE.MeshPhysicalMaterial({
      color: 0xd9b57c, metalness: 0.55, roughness: 0.24, transparent: true, opacity: 0.97,
      clearcoat: 1, side: THREE.DoubleSide
    })
    this.tab = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.045), tabMat)
    this.tab.position.set(side * 0.018, -0.213, 0.066)
    this.tab.rotation.z = side * 0.16
    this.tab.userData.action = 'seal'
    this.tab.userData.side = side
    this.group.add(this.tab)

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.018),
      new THREE.MeshBasicMaterial({ color: 0x17171a, transparent: true, opacity: 0.62, side: THREE.DoubleSide })
    )
    label.position.set(0, -0.14, 0.061)
    this.group.add(label)
    this.label = label

    this.group.userData.action = 'seal'
    this.group.userData.side = side
    this.homePosition = this.group.position.clone()
    this.homeRotation = this.group.rotation.clone()
  }

  reset() {
    this.progress = 0
    this.removed = false
    this.group.visible = true
    this.group.position.copy(this.homePosition)
    this.group.rotation.copy(this.homeRotation)
    this.material.opacity = 0.97
    this.top.material.opacity = 0.97
    this.setProgress(0)
  }

  setProgress(p) {
    this.progress = clamp(p)
    const e = easeInOutCubic(this.progress)
    this.group.rotation.x = -e * 1.12
    this.group.position.y = BOX_H + LID_H + 0.003 + e * 0.055
    this.group.position.z = BOX_D / 2 - 0.055 + e * 0.018
    this.group.position.x = this.side * (0.29 + e * 0.014)
    const pos = this.frontGeo.attributes.position
    const arr = pos.array
    const base = this.frontBase
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i]
      const y = base[i + 1]
      const t = clamp((0.1 - y) / 0.2)
      let z = base[i + 2]
      let ny = y
      let nx = x
      if (t < this.progress) {
        const local = (this.progress - t) / Math.max(0.001, this.progress)
        const angle = local * 2.2
        z += Math.sin(angle) * 0.052
        ny += (1 - Math.cos(angle)) * 0.036
        nx += Math.sin(angle * 1.7) * 0.006 * Math.sign(this.side)
      }
      arr[i] = nx
      arr[i + 1] = ny
      arr[i + 2] = z
    }
    pos.needsUpdate = true
    this.frontGeo.computeVertexNormals()

    const tpos = this.top.geometry.attributes.position
    const tarr = tpos.array
    for (let i = 0; i < tarr.length; i += 3) {
      const y = this.topBase[i + 1]
      const t = clamp((y + 0.055) / 0.11)
      tarr[i + 2] = this.topBase[i + 2] + Math.sin(t * Math.PI) * this.progress * 0.018
    }
    tpos.needsUpdate = true
    this.top.geometry.computeVertexNormals()
    this.top.material.opacity = 0.97 - this.progress * 0.1
    this.tab.rotation.x = -this.progress * 0.8
    this.tab.position.z = 0.066 + this.progress * 0.045
  }
}

class PhoneBox {
  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'phone-box'
    this.config = { finish: 'graphite', model: 'AURA X1 PRO', short: 'X1 PRO', boxColor: '#0b0c10', accent: '#c7a97c' }
    this.seals = [new PeelSeal(1), new PeelSeal(-1)]
    this.accessories = new AccessorySet()
    this.lidOpen = 0
    this.build()
  }

  build() {
    const paperTex = createPaperTexture()
    const cardboard = createCardboardBump()
    this.paperMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.config.boxColor),
      roughness: 0.64,
      metalness: 0.04,
      bumpMap: cardboard,
      bumpScale: 0.0012,
      clearcoat: 0.14,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.65
    })
    const innerPaper = new THREE.MeshPhysicalMaterial({
      color: 0x191a1e, roughness: 0.72, metalness: 0.03, clearcoat: 0.06
    })
    const velvetTex = createVelvetTexture()
    this.velvetMaterial = new THREE.MeshPhysicalMaterial({
      map: velvetTex, color: 0xffffff, roughness: 0.95, metalness: 0,
      sheen: 1, sheenRoughness: 0.75, sheenColor: new THREE.Color('#5b5e68')
    })

    this.base = new THREE.Group()
    this.base.name = 'box-base'
    const bottom = box(BOX_W, 0.032, BOX_D, this.paperMaterial, [0, 0.016, 0], 0.012)
    this.base.add(bottom)
    const wallT = 0.038
    const sideL = box(wallT, BOX_H - 0.02, BOX_D, this.paperMaterial, [-BOX_W / 2 + wallT / 2, BOX_H / 2 + 0.008, 0], 0.01)
    const sideR = box(wallT, BOX_H - 0.02, BOX_D, this.paperMaterial, [BOX_W / 2 - wallT / 2, BOX_H / 2 + 0.008, 0], 0.01)
    const front = box(BOX_W - wallT * 2, BOX_H - 0.02, wallT, this.paperMaterial, [0, BOX_H / 2 + 0.008, BOX_D / 2 - wallT / 2], 0.008)
    const back = box(BOX_W - wallT * 2, BOX_H - 0.02, wallT, this.paperMaterial, [0, BOX_H / 2 + 0.008, -BOX_D / 2 + wallT / 2], 0.008)
    this.base.add(sideL, sideR, front, back)
    const lip = box(BOX_W - 0.02, 0.016, BOX_D - 0.02, innerPaper, [0, BOX_H - 0.004, 0], 0.01)
    this.base.add(lip)

    const tray = box(BOX_W - 0.075, 0.02, BOX_D - 0.085, this.velvetMaterial, [0, 0.045, 0], 0.018)
    this.base.add(tray)
    const phoneRecess = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 1.56),
      new THREE.MeshPhysicalMaterial({ color: 0x09090b, roughness: 1, metalness: 0 })
    )
    phoneRecess.rotation.x = -Math.PI / 2
    phoneRecess.position.y = 0.057
    this.base.add(phoneRecess)
    this.phoneRecess = phoneRecess
    for (const x of [-0.39, 0.39]) {
      const rail = box(0.025, 0.025, 1.53, this.velvetMaterial, [x, 0.064, 0], 0.008)
      this.base.add(rail)
    }
    for (const z of [-0.76, 0.76]) {
      const rail = box(0.75, 0.025, 0.025, this.velvetMaterial, [0, 0.064, z], 0.008)
      this.base.add(rail)
    }

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.06),
      new THREE.MeshBasicMaterial({ map: this.makeInnerLabel(), transparent: true, opacity: 0.62 })
    )
    label.rotation.x = -Math.PI / 2
    label.position.set(0, 0.059, -0.71)
    this.base.add(label)

    this.group.add(this.base)
    this.accessories.group.position.y = 0.055
    this.accessories.group.visible = false
    this.group.add(this.accessories.group)

    this.lid = new THREE.Group()
    this.lid.name = 'box-lid'
    this.lid.position.y = BOX_H + LID_H / 2
    this.lidHome = this.lid.position.clone()
    const lidMesh = new THREE.Mesh(
      new RoundedBoxGeometry(BOX_W + 0.03, LID_H, BOX_D + 0.03, 6, 0.018),
      this.paperMaterial
    )
    lidMesh.castShadow = true
    lidMesh.receiveShadow = true
    lidMesh.userData.action = 'lid'
    lidMesh.name = 'box-lid-hit'
    this.lid.add(lidMesh)
    this.lidMesh = lidMesh

    this.topPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(BOX_W - 0.034, BOX_D - 0.034),
      new THREE.MeshPhysicalMaterial({
        map: createBoxArtTexture(this.config),
        roughness: 0.5,
        metalness: 0.04,
        clearcoat: 0.3,
        clearcoatRoughness: 0.42,
        envMapIntensity: 0.85
      })
    )
    this.topPlane.rotation.x = -Math.PI / 2
    this.topPlane.position.y = LID_H / 2 + 0.002
    this.topPlane.receiveShadow = true
    this.topPlane.userData.action = 'lid'
    this.lid.add(this.topPlane)

    const sideTex = createBoxSideTexture(this.config)
    const sideMat = new THREE.MeshPhysicalMaterial({
      map: sideTex, roughness: 0.55, metalness: 0.04, clearcoat: 0.2, envMapIntensity: 0.7
    })
    this.sideMat = sideMat
    const frontLabel = new THREE.Mesh(new THREE.PlaneGeometry(BOX_W - 0.04, LID_H - 0.018), sideMat)
    frontLabel.position.set(0, 0, (BOX_D + 0.03) / 2 + 0.001)
    frontLabel.userData.action = 'lid'
    this.lid.add(frontLabel)
    const backLabel = new THREE.Mesh(new THREE.PlaneGeometry(BOX_W - 0.04, LID_H - 0.018), sideMat)
    backLabel.rotation.y = Math.PI
    backLabel.position.set(0, 0, -(BOX_D + 0.03) / 2 - 0.001)
    backLabel.userData.action = 'lid'
    this.lid.add(backLabel)

    const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xc7a97c, metalness: 1, roughness: 0.25, envMapIntensity: 1.2 })
    const trimGeo = new THREE.BoxGeometry(0.006, 0.004, BOX_D + 0.025)
    for (const x of [-BOX_W / 2 - 0.012, BOX_W / 2 + 0.012]) {
      const trim = new THREE.Mesh(trimGeo, goldMat)
      trim.position.set(x, -LID_H / 2 + 0.01, 0)
      this.lid.add(trim)
    }
    const trimZGeo = new THREE.BoxGeometry(BOX_W + 0.025, 0.004, 0.006)
    for (const z of [-(BOX_D + 0.025) / 2, (BOX_D + 0.025) / 2]) {
      const trim = new THREE.Mesh(trimZGeo, goldMat)
      trim.position.set(0, -LID_H / 2 + 0.01, z)
      this.lid.add(trim)
    }

    this.group.add(this.lid)
    for (const seal of this.seals) this.group.add(seal.group)

    this.group.userData.box = this
    this.group.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }

  makeInnerLabel() {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 96
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 96)
    ctx.fillStyle = '#d6c6ac'
    ctx.font = '500 22px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '6px'
    ctx.fillText('AURA  ·  X1 PRO  ·  512GB', 256, 58)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  setStyle(config = {}) {
    Object.assign(this.config, config)
    const oldTop = this.topPlane.material.map
    this.topPlane.material.map = createBoxArtTexture(this.config)
    this.topPlane.material.needsUpdate = true
    oldTop?.dispose()
    const oldSide = this.sideMat.map
    this.sideMat.map = createBoxSideTexture(this.config)
    this.sideMat.needsUpdate = true
    oldSide?.dispose()
    this.paperMaterial.color.set(this.config.boxColor || '#0b0c10')
    this.phoneRecess.material.color.set(this.config.boxColor || '#09090b')
  }

  setLidProgress(p) {
    this.lidOpen = clamp(p)
    const e = easeInOutCubic(this.lidOpen)
    this.lid.position.y = this.lidHome.y + e * 0.55
    this.lid.position.z = this.lidHome.z + e * 0.12
    this.lid.rotation.z = Math.sin(e * Math.PI) * 0.035
    this.lid.rotation.x = e * 0.11
  }

  revealAccessories() {
    this.accessories.group.visible = true
  }

  setAccessoriesVisible(v) {
    this.accessories.group.visible = v
  }

  setSealProgress(p, side = 1) {
    const seal = this.seals.find(s => s.side === side) || this.seals[0]
    seal.setProgress(p)
  }

  setBothSeals(p) {
    for (const s of this.seals) s.setProgress(p)
  }

  removeSeal(side) {
    const seal = this.seals.find(s => s.side === side)
    if (seal) seal.removed = true
  }

  reset() {
    this.lidOpen = 0
    this.lid.visible = true
    this.lid.position.copy(this.lidHome)
    this.lid.rotation.set(0, 0, 0)
    for (const seal of this.seals) seal.reset()
    this.accessories.group.visible = false
    for (const item of this.accessories.items) {
      item.visible = true
      item.position.copy(item.userData.home)
      item.rotation.copy(item.userData.homeRotation)
      item.rotation.y = item.userData.homeRotation.y
      item.scale.setScalar(item.userData.homeScale || item.scale.x)
    }
  }
}

export class World {
  constructor(renderer) {
    this.renderer = renderer
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#090a0c')
    this.scene.fog = new THREE.FogExp2('#08090b', 0.035)
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 30)
    this.camera.position.set(0.52, 1.66, 2.72)
    this.cameraTarget = new THREE.Vector3(0.02, 0.24, 0.03)
    this.night = false
    this.clockTime = 0
    this.room = new THREE.Group()
    this.scene.add(this.room)
    this.props = new THREE.Group()
    this.scene.add(this.props)
    this.woodTextures = {
      walnut: createWoodTexture(7, 'walnut'),
      oak: createWoodTexture(12, 'oak'),
      ebony: createWoodTexture(21, 'ebony'),
      ash: createWoodTexture(33, 'ash')
    }
    this.createEnvironment()
    this.createRoom()
    this.createTable()
    this.createProps()
    this.createBox()
    this.createLights()
    this.createParticles()
    this.createReveal()
    this.updateCamera()
  }

  createEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
    this.scene.environment = env.texture
    this.scene.environmentIntensity = 0.75
    pmrem.dispose()
  }

  createRoom() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c2b2b, roughness: 0.92, metalness: 0.02 })
    this.wallMaterial = wallMat
    const wall = box(9, 5.6, 0.2, wallMat, [0, 1.5, -3.25], 0.02)
    wall.castShadow = false
    this.room.add(wall)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x171513, roughness: 0.62, metalness: 0.04
    })
    const floor = box(9, 0.1, 7, floorMat, [0, -0.78, 0.5], 0.01)
    floor.receiveShadow = true
    this.room.add(floor)
    const ceiling = box(9, 0.1, 7, new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 1 }), [0, 3.2, 0.5], 0.01)
    this.room.add(ceiling)

    const slatMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.7, metalness: 0.03 })
    this.slatMaterial = slatMat
    for (let i = 0; i < 26; i++) {
      const x = -3.7 + i * 0.29
      if (x > -0.7 && x < 0.7) continue
      const slat = box(0.11, 2.6, 0.055, slatMat, [x, 1.18, -3.1], 0.004)
      slat.castShadow = false
      this.room.add(slat)
    }
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xd9b27a })
    this.ledMaterial = ledMat
    for (const x of [-0.72, 0.72]) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.4, 0.012), ledMat)
      led.position.set(x, 1.2, -3.08)
      this.room.add(led)
    }
    const panelMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f1115, roughness: 0.4, metalness: 0.6, clearcoat: 0.6
    })
    const panel = box(1.26, 2.48, 0.04, panelMat, [0, 1.25, -3.11], 0.01)
    this.room.add(panel)

    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x191715, roughness: 0.55, metalness: 0.2 })
    const shelf = box(1.6, 0.045, 0.32, shelfMat, [2.35, 1.36, -3.03], 0.006)
    this.room.add(shelf)
    const shelf2 = shelf.clone()
    shelf2.position.y = 0.75
    this.room.add(shelf2)

    const bookColors = ['#5e5144', '#3d4b4d', '#7d6552', '#2f343a', '#8d7a5e']
    for (let i = 0; i < 8; i++) {
      const h = 0.18 + (i % 3) * 0.04
      const book = box(0.045, h, 0.2, new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length], roughness: 0.8 }), [1.72 + i * 0.06, 1.36 + h / 2 + 0.022, -3.02], 0.004)
      this.room.add(book)
    }
    const vase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 0.24, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xd0c3ad, roughness: 0.5, metalness: 0.02, clearcoat: 0.4 })
    )
    vase.position.set(2.85, 1.48, -3.03)
    vase.castShadow = true
    this.room.add(vase)
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x3f382c, roughness: 0.8 })
    for (let i = 0; i < 4; i++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.34 + i * 0.04, 8), branchMat)
      branch.position.set(2.85 + (i - 1.5) * 0.03, 1.78 + i * 0.03, -3.03)
      branch.rotation.z = (i - 1.5) * 0.17
      this.room.add(branch)
    }

    const windowMat = new THREE.MeshBasicMaterial({ color: 0xaec4cc, transparent: true, opacity: 0.16 })
    this.windowMaterial = windowMat
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), windowMat)
    win.position.set(-2.5, 1.55, -3.13)
    this.room.add(win)
    const winFrame = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.5, metalness: 0.4 })
    for (const x of [-3.28, -1.72]) {
      const bar = box(0.045, 2.48, 0.06, winFrame, [x, 1.55, -3.11], 0.004)
      this.room.add(bar)
    }
    for (const y of [0.32, 2.78]) {
      const bar = box(1.6, 0.045, 0.06, winFrame, [-2.5, y, -3.11], 0.004)
      this.room.add(bar)
    }
    const mullion = box(0.035, 2.4, 0.05, winFrame, [-2.5, 1.55, -3.11], 0.003)
    this.room.add(mullion)
    this.windowPlane = win

    const artFrame = box(1.0, 1.2, 0.03, new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.4, metalness: 0.5 }), [-1.8, 1.72, -3.12], 0.004)
    this.room.add(artFrame)
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 1.08),
      new THREE.MeshStandardMaterial({ color: 0x3c4b4d, roughness: 0.9 })
    )
    art.position.set(-1.8, 1.72, -3.1)
    this.room.add(art)
  }

  createTable() {
    const wood = this.woodTextures.walnut
    this.tableMaterial = new THREE.MeshPhysicalMaterial({
      map: wood.map,
      roughnessMap: wood.roughnessMap,
      bumpMap: wood.bumpMap,
      bumpScale: 0.004,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.32,
      clearcoatRoughness: 0.24,
      envMapIntensity: 0.85
    })
    const top = new THREE.Mesh(new RoundedBoxGeometry(5.1, 0.11, 3.15, 6, 0.035), this.tableMaterial)
    top.position.set(0, -0.062, 0.18)
    top.receiveShadow = true
    top.castShadow = true
    this.props.add(top)
    this.tableTop = top
    const edge = box(5.14, 0.035, 3.18, new THREE.MeshPhysicalMaterial({
      color: 0x24160f, roughness: 0.5, metalness: 0.05, clearcoat: 0.3
    }), [0, -0.125, 0.18], 0.01)
    this.props.add(edge)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x181615, roughness: 0.45, metalness: 0.45 })
    for (const [x, z] of [[-2.15, -0.95], [2.15, -0.95], [-2.15, 1.3], [2.15, 1.3]]) {
      const leg = box(0.11, 0.72, 0.11, legMat, [x, -0.46, z], 0.012)
      this.props.add(leg)
    }
    const tableShadow = contactShadow(3.2, 0.5, '#000000')
    tableShadow.position.set(0, 0.001, 0.18)
    tableShadow.rotation.x = -Math.PI / 2
    this.props.add(tableShadow)
  }

  createProps() {
    const clothMat = new THREE.MeshPhysicalMaterial({
      color: 0x777d7e, roughness: 0.94, metalness: 0, sheen: 1, sheenColor: new THREE.Color('#a8ada8'), sheenRoughness: 0.9
    })
    const cloth = new THREE.Group()
    const c1 = box(0.56, 0.018, 0.34, clothMat, [0, 0.01, 0], 0.02)
    const c2 = box(0.47, 0.014, 0.27, clothMat, [0.02, 0.025, 0.02], 0.02)
    c2.rotation.y = 0.12
    const c3 = box(0.28, 0.01, 0.19, clothMat, [0.05, 0.036, -0.02], 0.02)
    c3.rotation.y = -0.2
    cloth.add(c1, c2, c3)
    const stitch = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.001, 0.003),
      new THREE.MeshBasicMaterial({ color: 0x4e5252 })
    )
    stitch.position.set(0, 0.043, 0.07)
    cloth.add(stitch)
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 0.025),
      new THREE.MeshBasicMaterial({ map: this.makePropLogo('AURA'), transparent: true })
    )
    logo.rotation.x = -Math.PI / 2
    logo.position.set(0.12, 0.045, -0.02)
    cloth.add(logo)
    cloth.position.set(-1.25, 0, 0.58)
    cloth.rotation.y = -0.25
    this.props.add(cloth)
    const cs = contactShadow(0.72, 0.35)
    cs.position.set(-1.25, 0.001, 0.58)
    this.props.add(cs)

    const standMat = new THREE.MeshPhysicalMaterial({
      color: 0x9b9489, metalness: 0.95, roughness: 0.24, envMapIntensity: 1.4
    })
    const stand = new THREE.Group()
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.025, 48), standMat)
    base.position.y = 0.012
    base.castShadow = true
    stand.add(base)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 24), standMat)
    stem.position.set(0, 0.32, -0.05)
    stem.rotation.x = 0.08
    stem.castShadow = true
    stand.add(stem)
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.27, 20), standMat)
    arm.position.set(0, 0.62, 0.02)
    arm.rotation.x = 0.75
    stand.add(arm)
    const cradle = box(0.18, 0.055, 0.08, standMat, [0, 0.73, 0.12], 0.02)
    stand.add(cradle)
    const cradleLip = box(0.18, 0.06, 0.024, standMat, [0, 0.7, 0.165], 0.01)
    stand.add(cradleLip)
    const rubber = box(0.17, 0.012, 0.07, new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.85 }), [0, 0.7, 0.12], 0.008)
    stand.add(rubber)
    stand.position.set(1.4, 0, 0.2)
    stand.rotation.y = -0.35
    this.props.add(stand)
    this.phoneStand = stand
    this.phoneStandAnchor = new THREE.Vector3(1.4, 0.77, 0.16)
    const ss = contactShadow(0.55, 0.4)
    ss.position.set(1.4, 0.001, 0.2)
    this.props.add(ss)

    const plant = new THREE.Group()
    const potMat = new THREE.MeshPhysicalMaterial({ color: 0x2b2b2c, roughness: 0.4, metalness: 0.1, clearcoat: 0.5 })
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 40), potMat)
    pot.position.y = 0.13
    pot.castShadow = true
    plant.add(pot)
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.145, 32), new THREE.MeshStandardMaterial({ color: 0x16110c, roughness: 1 }))
    soil.rotation.x = -Math.PI / 2
    soil.position.y = 0.262
    plant.add(soil)
    const leafMat = new THREE.MeshPhysicalMaterial({ color: 0x2e4b3a, roughness: 0.62, side: THREE.DoubleSide, clearcoat: 0.25 })
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), leafMat)
      const a = i / 9 * Math.PI * 2
      const r = 0.1 + Math.random() * 0.08
      leaf.scale.set(0.55, 1.8, 0.25)
      leaf.position.set(Math.cos(a) * r, 0.36 + Math.random() * 0.2, Math.sin(a) * r)
      leaf.rotation.z = Math.cos(a) * 0.6
      leaf.rotation.x = Math.sin(a) * 0.4
      leaf.castShadow = true
      plant.add(leaf)
    }
    plant.position.set(-1.72, 0, -0.55)
    this.props.add(plant)

    const diffuser = new THREE.Group()
    const diffMat = new THREE.MeshPhysicalMaterial({ color: 0x272727, roughness: 0.28, metalness: 0.6, clearcoat: 0.8 })
    const db = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.22, 40), diffMat)
    db.position.y = 0.11
    db.castShadow = true
    diffuser.add(db)
    const dc = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.14, 20), new THREE.MeshStandardMaterial({ color: 0x8a7d68, roughness: 0.7 }))
    dc.position.y = 0.28
    diffuser.add(dc)
    diffuser.position.set(1.86, 0, -0.48)
    this.props.add(diffuser)

    const trayMat = new THREE.MeshPhysicalMaterial({ color: 0x8a765d, metalness: 1, roughness: 0.3 })
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.025, 48), trayMat)
    tray.position.set(0.92, 0.012, 1.18)
    tray.castShadow = true
    this.props.add(tray)
    const trayInner = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), new THREE.MeshStandardMaterial({ color: 0x3a3025, roughness: 0.6 }))
    trayInner.rotation.x = -Math.PI / 2
    trayInner.position.set(0.92, 0.026, 1.18)
    this.props.add(trayInner)
    const key = box(0.035, 0.008, 0.14, trayMat, [0.92, 0.035, 1.18], 0.005)
    key.rotation.y = 0.5
    this.props.add(key)

    const boxShadow = contactShadow(2.05, 0.55)
    boxShadow.position.set(0, 0.001, 0)
    boxShadow.scale.set(0.55, 1, 1)
    this.props.add(boxShadow)
    this.boxShadow = boxShadow

    const penMat = new THREE.MeshPhysicalMaterial({ color: 0x15161a, metalness: 0.6, roughness: 0.25 })
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.42, 16), penMat)
    pen.rotation.z = Math.PI / 2
    pen.rotation.y = 0.3
    pen.position.set(-1.3, 0.012, 1.05)
    pen.castShadow = true
    this.props.add(pen)
  }

  makePropLogo(text) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = 'rgba(35,38,40,.65)'
    ctx.font = '600 22px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '8px'
    ctx.fillText(text, 128, 39)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  createBox() {
    this.box = new PhoneBox()
    this.scene.add(this.box.group)
    this.box.group.position.set(0, 0, 0)
  }

  createLights() {
    RectAreaLightUniformsLib.init()
    this.hemi = new THREE.HemisphereLight(0xbfd0e0, 0x2a1d14, 0.4)
    this.scene.add(this.hemi)
    this.key = new THREE.DirectionalLight(0xfff1dd, 3.3)
    this.key.position.set(-2.8, 4.6, 2.4)
    this.key.target.position.set(0, 0.1, 0)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    this.key.shadow.camera.left = -3.2
    this.key.shadow.camera.right = 3.2
    this.key.shadow.camera.top = 3.2
    this.key.shadow.camera.bottom = -3.2
    this.key.shadow.camera.near = 0.5
    this.key.shadow.camera.far = 9
    this.key.shadow.bias = -0.0002
    this.key.shadow.normalBias = 0.018
    this.key.shadow.radius = 4
    this.scene.add(this.key, this.key.target)

    this.fill = new THREE.DirectionalLight(0xb7ccdb, 0.75)
    this.fill.position.set(3.5, 2.2, 2.6)
    this.fill.target.position.set(0, 0.2, 0)
    this.scene.add(this.fill, this.fill.target)

    this.rim = new THREE.SpotLight(0xffd7a3, 38, 8, 0.55, 0.85, 1.4)
    this.rim.position.set(2.6, 3.2, -1.8)
    this.rim.target.position.set(0.1, 0.25, 0)
    this.rim.castShadow = true
    this.rim.shadow.mapSize.set(1024, 1024)
    this.rim.shadow.bias = -0.0003
    this.rim.shadow.normalBias = 0.02
    this.scene.add(this.rim, this.rim.target)

    this.softbox = new THREE.RectAreaLight(0xffe6c7, 8.0, 2.4, 1.4)
    this.softbox.position.set(-0.2, 3.0, 1.0)
    this.softbox.lookAt(0, 0, 0)
    this.scene.add(this.softbox)

    this.softbox2 = new THREE.RectAreaLight(0xc6d9e8, 3.0, 1.6, 1.0)
    this.softbox2.position.set(2.4, 2.0, 1.8)
    this.softbox2.lookAt(0, 0.2, 0)
    this.scene.add(this.softbox2)

    this.tableSpot = new THREE.SpotLight(0xffeeda, 30, 6, 0.75, 1, 1.2)
    this.tableSpot.position.set(0, 3.1, 0.7)
    this.tableSpot.target.position.set(0, 0, 0.2)
    this.scene.add(this.tableSpot, this.tableSpot.target)
  }

  createParticles() {
    const count = 380
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    this.dustData = []
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 5
      const y = Math.random() * 2.6 + 0.1
      const z = (Math.random() - 0.5) * 4
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      sizes[i] = Math.random()
      this.dustData.push({ baseY: y, speed: 0.01 + Math.random() * 0.04, phase: Math.random() * Math.PI * 2 })
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    const mat = new THREE.PointsMaterial({
      color: 0xffe9c9, size: 0.008, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    })
    this.dust = new THREE.Points(geo, mat)
    this.dust.frustumCulled = false
    this.scene.add(this.dust)

    const sparkCount = 70
    const sparkPos = new Float32Array(sparkCount * 3)
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = (Math.random() - 0.5) * 1.4
      sparkPos[i * 3 + 1] = 0.4 + Math.random() * 1.6
      sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 0.8
    }
    const sparkGeo = new THREE.BufferGeometry()
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
    this.sparkMat = new THREE.PointsMaterial({
      color: 0xffdca8, size: 0.018, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    this.sparkles = new THREE.Points(sparkGeo, this.sparkMat)
    this.sparkles.frustumCulled = false
    this.scene.add(this.sparkles)
  }

  createReveal() {
    this.revealLight = new THREE.SpotLight(0xffe0b3, 0, 7, 0.5, 1, 1.4)
    this.revealLight.position.set(0, 3.2, 1.6)
    this.revealLight.target.position.set(0, 0.5, 0)
    this.scene.add(this.revealLight, this.revealLight.target)

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd8b98c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false
    })
    this.revealRing = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.46, 80), ringMat)
    this.revealRing.rotation.x = -Math.PI / 2
    this.revealRing.position.set(0, 0.08, 0)
    this.scene.add(this.revealRing)

    const glow = makeGradientSprite('rgba(255,222,170,.75)', 'rgba(199,150,84,.2)', 128)
    this.revealGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }))
    this.revealGlow.scale.set(2.2, 2.2, 1)
    this.revealGlow.position.set(0, 0.8, 0)
    this.scene.add(this.revealGlow)
  }

  setReveal(amount) {
    this.revealLight.intensity = amount * 42
    this.revealRing.material.opacity = amount * 0.7
    this.revealRing.scale.setScalar(1 + amount * 0.25)
    this.revealGlow.material.opacity = amount * 0.28
    this.sparkMat.opacity = amount * 0.9
  }

  setNight(night) {
    this.night = night
    this.key.intensity = night ? 0.35 : (this.lite ? 4.1 : 3.3)
    this.key.color.set(night ? '#9bb5d1' : '#fff1dd')
    this.hemi.intensity = this.lite ? (night ? 0.3 : 0.62) : (night ? 0.12 : 0.4)
    this.hemi.color.set(night ? '#445d7a' : '#bfd0e0')
    this.fill.intensity = this.lite ? (night ? 0.5 : 1.05) : (night ? 0.28 : 0.75)
    this.rim.intensity = night ? 52 : 38
    this.rim.color.set(night ? '#ffbf7a' : '#ffd7a3')
    this.softbox.intensity = night ? 2.4 : 8
    this.softbox2.intensity = night ? 0.8 : 3
    this.tableSpot.intensity = night ? 18 : 30
    this.softbox.color.set(night ? '#ffc58c' : '#ffe6c7')
    this.room.traverse(o => {
      if (o.material === this.wallMaterial) {
        this.wallMaterial.color.set(night ? '#181a20' : '#2c2b2b')
      }
    })
    this.ledMaterial.color.set(night ? '#ffcf8a' : '#d9b27a')
    this.windowMaterial.color.set(night ? '#1a2b46' : '#aec4cc')
    this.windowMaterial.opacity = night ? 0.1 : 0.16
    this.scene.fog.color.set(night ? '#050609' : '#08090b')
    this.scene.environmentIntensity = night ? 0.34 : 0.75
    this.dust.material.opacity = night ? 0.38 : 0.28
    this.dust.material.color.set(night ? '#ffd7a0' : '#ffe9c9')
  }

  setQuality(quality) {
    const lite = quality === 'lite'
    this.lite = lite
    this.dust.visible = !lite
    this.softbox.visible = !lite
    this.softbox2.visible = !lite
    this.hemi.intensity = lite ? 0.62 : (this.night ? 0.12 : 0.4)
    this.fill.intensity = lite ? 1.05 : (this.night ? 0.28 : 0.75)
  }

  setTableTone(tone) {
    const wood = this.woodTextures[tone] || this.woodTextures.walnut
    this.tableMaterial.map = wood.map
    this.tableMaterial.roughnessMap = wood.roughnessMap
    this.tableMaterial.bumpMap = wood.bumpMap
    this.tableMaterial.needsUpdate = true
  }

  setBackdrop(color) {
    this.wallMaterial.color.set(color)
  }

  updateCamera(aspect) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  update(dt, elapsed) {
    this.clockTime += dt
    const pos = this.dust.geometry.attributes.position
    for (let i = 0; i < this.dustData.length; i++) {
      const d = this.dustData[i]
      pos.array[i * 3 + 1] += d.speed * dt
      pos.array[i * 3] += Math.sin(elapsed * 0.35 + d.phase) * dt * 0.006
      if (pos.array[i * 3 + 1] > 2.8) pos.array[i * 3 + 1] = 0.08
    }
    pos.needsUpdate = true
    if (this.sparkMat.opacity > 0.01) {
      const sp = this.sparkles.geometry.attributes.position
      for (let i = 0; i < sp.count; i++) {
        sp.array[i * 3 + 1] += dt * (0.025 + (i % 5) * 0.01)
        sp.array[i * 3] += Math.sin(elapsed * 0.7 + i) * dt * 0.008
        if (sp.array[i * 3 + 1] > 2.1) sp.array[i * 3 + 1] = 0.25
      }
      sp.needsUpdate = true
    }
    this.revealRing.rotation.z += dt * 0.12
    this.softbox.intensity += Math.sin(elapsed * 0.4) * 0.0015
  }
}
