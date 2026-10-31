import * as THREE from 'three'
import { RoundedBoxGeometry, roundedRectShape, box, clamp } from './utils.js'
import { createGuideTexture, createWarrantyTexture, createCardboardBump } from './textures.js'

export const ACCESSORY_DATA = [
  {
    id: 'charger', name: 'Củ sạc AURA 45W', short: 'Củ sạc', icon: '⌁',
    desc: 'Củ sạc GaN 45W siêu nhỏ, hỗ trợ sạc nhanh PD 3.1 và bảo vệ pin thông minh.',
    material: 'Nhựa ceramic · chân kim loại'
  },
  {
    id: 'cable', name: 'Cáp USB-C 1.5m', short: 'Cáp USB-C', icon: '∿',
    desc: 'Cáp bọc dù dệt cao cấp, đầu kim loại nguyên khối, hỗ trợ truyền dữ liệu 480Mbps.',
    material: 'Dù dệt · nhôm anodized'
  },
  {
    id: 'sim', name: 'Que chọc SIM', short: 'Que SIM', icon: '⌇',
    desc: 'Que chọc SIM bằng thép không gỉ, thiết kế vòng tròn tiện dụng.',
    material: 'Thép không gỉ'
  },
  {
    id: 'case', name: 'Ốp lưng trong suốt', short: 'Ốp lưng', icon: '▢',
    desc: 'Ốp TPU trong suốt chống ố vàng, viền nâng bảo vệ camera và màn hình.',
    material: 'TPU y tế · chống sốc'
  },
  {
    id: 'guide', name: 'Sách hướng dẫn', short: 'Hướng dẫn', icon: '▤',
    desc: 'Hướng dẫn nhanh bằng tiếng Việt, giấy mỹ thuật và in nhũ vàng.',
    material: 'Giấy mỹ thuật 180gsm'
  },
  {
    id: 'warranty', name: 'Phiếu bảo hành', short: 'Bảo hành', icon: '◈',
    desc: 'Phiếu bảo hành chính hãng 24 tháng, kích hoạt điện tử cùng serial thiết bị.',
    material: 'Giấy ivory · dấu nhũ'
  },
  {
    id: 'protector', name: 'Miếng dán màn hình', short: 'Dán màn hình', icon: '◇',
    desc: 'Kính cường lực 0.33mm, lớp phủ chống vân tay và kháng ánh sáng xanh.',
    material: 'Kính cường lực · AR coating'
  },
  {
    id: 'minibox', name: 'Hộp phụ kiện', short: 'Hộp nhỏ', icon: '▣',
    desc: 'Hộp giấy tái chế đựng que SIM và các chi tiết nhỏ, mở bằng nam châm.',
    material: 'Giấy tái chế · nam châm'
  }
]

export class AccessorySet {
  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'accessories'
    this.items = []
    this.build()
  }

  build() {
    const slots = [
      [-0.3, -0.49], [-0.1, -0.49], [0.1, -0.49], [0.3, -0.49],
      [-0.3, -0.19], [-0.1, -0.19], [0.1, -0.19], [0.3, -0.19]
    ]
    const makers = [this.makeCharger, this.makeCable, this.makeSimTool, this.makeCase, this.makeGuide, this.makeWarranty, this.makeProtector, this.makeMiniBox].map(fn => fn.bind(this))
    ACCESSORY_DATA.forEach((data, i) => {
      const item = makers[i]()
      item.userData.itemId = data.id
      item.userData.meta = data
      item.userData.home = new THREE.Vector3(slots[i][0], 0.036, slots[i][1])
      item.userData.homeRotation = item.rotation.clone()
      item.userData.homeScale = item.scale.x
      item.position.copy(item.userData.home)
      item.rotation.y = (i % 2 === 0 ? -1 : 1) * 0.13
      this.group.add(item)
      this.items.push(item)
    })
  }

  makeHitBox(w, h, d, id) {
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    )
    hit.userData.action = `accessory:${id}`
    hit.name = `hit-${id}`
    return hit
  }

  makeCharger() {
    const g = new THREE.Group()
    g.name = 'charger'
    const shell = new THREE.MeshPhysicalMaterial({
      color: 0xf2f0ea, roughness: 0.26, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.12,
      envMapIntensity: 1.2
    })
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.125, 0.145, 0.095, 6, 0.025), shell)
    body.position.y = 0.052
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 0.1),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.3 })
    )
    face.position.set(0, 0.058, 0.048)
    g.add(face)
    const port = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.012, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x08090b })
    )
    port.position.set(0, 0.02, 0.049)
    g.add(port)
    const metal = new THREE.MeshPhysicalMaterial({ color: 0xc4c7c9, metalness: 1, roughness: 0.18 })
    for (const x of [-0.028, 0.028]) {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.018), metal)
      prong.position.set(x, 0.118, -0.032)
      g.add(prong)
    }
    const logo = this.makeLogoPlate('AURA', 0.065, 0.012)
    logo.position.set(0, 0.105, 0.049)
    g.add(logo)
    const hit = this.makeHitBox(0.16, 0.18, 0.14, 'charger')
    hit.position.y = 0.06
    g.add(hit)
    g.scale.setScalar(1.35)
    return g
  }

  makeCable() {
    const g = new THREE.Group()
    g.name = 'cable'
    const braid = document.createElement('canvas')
    braid.width = 128
    braid.height = 128
    const bctx = braid.getContext('2d')
    bctx.fillStyle = '#68615a'
    bctx.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 260; i++) {
      bctx.strokeStyle = `rgba(${180 + Math.random() * 50},${170 + Math.random() * 40},${150 + Math.random() * 40},.18)`
      bctx.beginPath()
      bctx.moveTo(Math.random() * 128, 0)
      bctx.lineTo(Math.random() * 128, 128)
      bctx.stroke()
    }
    const tex = new THREE.CanvasTexture(braid)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 2)
    const cableMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.68, metalness: 0.1 })
    const points = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      const a = t * Math.PI * 4.1
      const r = 0.068 * (1 - t * 0.12)
      points.push(new THREE.Vector3(Math.cos(a) * r, 0.012, Math.sin(a) * r))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 180, 0.008, 8, false), cableMat)
    tube.castShadow = true
    g.add(tube)
    const metal = new THREE.MeshPhysicalMaterial({ color: 0xaaadb0, metalness: 1, roughness: 0.25 })
    for (const t of [0, 1]) {
      const p = curve.getPoint(t)
      const connector = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.02, 0.018, 4, 0.006), metal)
      connector.position.copy(p)
      connector.position.y = 0.016
      connector.rotation.y = t * Math.PI * 1.7
      g.add(connector)
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.012), new THREE.MeshStandardMaterial({ color: 0x15171b }))
      tip.position.copy(connector.position)
      tip.position.y += 0.011
      g.add(tip)
    }
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.003, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.7 })
    )
    band.rotation.x = Math.PI / 2
    band.position.set(0.075, 0.014, 0.025)
    g.add(band)
    const hit = this.makeHitBox(0.22, 0.09, 0.22, 'cable')
    hit.position.y = 0.03
    g.add(hit)
    g.scale.setScalar(1.05)
    return g
  }

  makeSimTool() {
    const g = new THREE.Group()
    g.name = 'sim-tool'
    const metal = new THREE.MeshPhysicalMaterial({ color: 0xc8c5bd, metalness: 1, roughness: 0.22, envMapIntensity: 1.6 })
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.0022, 0.13, 16), metal)
    pin.rotation.z = Math.PI / 2
    pin.position.set(0.02, 0.015, 0)
    pin.castShadow = true
    g.add(pin)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 12, 40), metal)
    ring.rotation.x = Math.PI / 2
    ring.position.set(-0.05, 0.015, 0)
    ring.castShadow = true
    g.add(ring)
    const holder = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.7, side: THREE.DoubleSide })
    )
    holder.rotation.x = -Math.PI / 2
    holder.position.set(0, 0.002, 0)
    g.add(holder)
    const hit = this.makeHitBox(0.16, 0.06, 0.08, 'sim')
    hit.position.y = 0.02
    g.add(hit)
    g.scale.setScalar(1.2)
    return g
  }

  makeCase() {
    const g = new THREE.Group()
    g.name = 'case'
    const w = 0.22, h = 0.44, r = 0.045
    const shape = roundedRectShape(w, h, r)
    const inner = roundedRectShape(w - 0.022, h - 0.022, r - 0.011).getPoints(32)
    shape.holes.push(new THREE.Path(inner))
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.014, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.004, bevelThickness: 0.004, curveSegments: 20
    })
    geo.center()
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xdfeff1, transmission: 0.75, thickness: 0.01, roughness: 0.08,
      metalness: 0, transparent: true, opacity: 0.46, clearcoat: 1, clearcoatRoughness: 0.06,
      envMapIntensity: 1.8, side: THREE.DoubleSide
    })
    const rim = new THREE.Mesh(geo, mat)
    rim.rotation.x = -Math.PI / 2
    rim.position.y = 0.03
    rim.castShadow = true
    g.add(rim)
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.006, h - 0.006),
      new THREE.MeshPhysicalMaterial({
        color: 0xc9e4e7, transmission: 0.86, thickness: 0.006, roughness: 0.04,
        transparent: true, opacity: 0.18, clearcoat: 1, side: THREE.DoubleSide
      })
    )
    back.rotation.x = -Math.PI / 2
    back.position.y = 0.018
    g.add(back)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.003, 8, 30),
      new THREE.MeshBasicMaterial({ color: 0x93b9bd, transparent: true, opacity: 0.5 })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 0.025, -0.13)
    g.add(ring)
    const hit = this.makeHitBox(0.26, 0.08, 0.48, 'case')
    hit.position.y = 0.03
    g.add(hit)
    g.scale.setScalar(0.78)
    return g
  }

  makeGuide() {
    const g = new THREE.Group()
    g.name = 'guide'
    const coverTex = createGuideTexture()
    const pages = new THREE.MeshStandardMaterial({ color: 0xe7e1d5, roughness: 0.86 })
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.008, 0.27),
      new THREE.MeshPhysicalMaterial({ map: coverTex, roughness: 0.62, clearcoat: 0.2, clearcoatRoughness: 0.5 })
    )
    cover.position.y = 0.028
    cover.castShadow = true
    g.add(cover)
    for (let i = 0; i < 5; i++) {
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.182, 0.003, 0.262), pages)
      page.position.y = 0.007 + i * 0.004
      g.add(page)
    }
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.006, 0.27),
      new THREE.MeshPhysicalMaterial({ color: 0xe9e4d9, roughness: 0.7 })
    )
    back.position.y = 0.002
    g.add(back)
    const hit = this.makeHitBox(0.22, 0.06, 0.3, 'guide')
    hit.position.y = 0.02
    g.add(hit)
    g.scale.setScalar(1.15)
    return g
  }

  makeWarranty() {
    const g = new THREE.Group()
    g.name = 'warranty'
    const tex = createWarrantyTexture()
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.004, 0.12),
      new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 })
    )
    card.position.y = 0.012
    card.rotation.y = 0.1
    card.castShadow = true
    g.add(card)
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.0045, 0.121),
      new THREE.MeshPhysicalMaterial({ color: 0x9e8058, metalness: 0.7, roughness: 0.35 })
    )
    band.position.set(0, 0.013, 0)
    g.add(band)
    const hit = this.makeHitBox(0.22, 0.04, 0.16, 'warranty')
    hit.position.y = 0.02
    g.add(hit)
    g.scale.setScalar(1.2)
    return g
  }

  makeProtector() {
    const g = new THREE.Group()
    g.name = 'protector'
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 256, 512)
    grad.addColorStop(0, 'rgba(180,220,235,.7)')
    grad.addColorStop(0.35, 'rgba(245,225,185,.55)')
    grad.addColorStop(0.6, 'rgba(205,185,230,.5)')
    grad.addColorStop(1, 'rgba(180,235,220,.7)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 512)
    ctx.strokeStyle = 'rgba(255,255,255,.8)'
    ctx.lineWidth = 4
    ctx.strokeRect(8, 8, 240, 496)
    ctx.fillStyle = 'rgba(255,255,255,.5)'
    ctx.font = '600 18px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('AURA ARMOR', 128, 250)
    const tex = new THREE.CanvasTexture(canvas)
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.4),
      new THREE.MeshPhysicalMaterial({
        map: tex, transparent: true, opacity: 0.42, roughness: 0.02, metalness: 0.1,
        clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 2, side: THREE.DoubleSide
      })
    )
    glass.rotation.x = -Math.PI / 2
    glass.position.y = 0.012
    g.add(glass)
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.204, 0.404),
      new THREE.MeshStandardMaterial({ color: 0xe7e0d2, roughness: 0.9, side: THREE.DoubleSide })
    )
    backing.rotation.x = -Math.PI / 2
    backing.position.y = 0.008
    g.add(backing)
    const tab = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 0.045),
      new THREE.MeshBasicMaterial({ color: 0xd9b777, side: THREE.DoubleSide })
    )
    tab.rotation.x = -Math.PI / 2
    tab.position.set(0.08, 0.014, 0.21)
    g.add(tab)
    const hit = this.makeHitBox(0.24, 0.06, 0.44, 'protector')
    hit.position.y = 0.02
    g.add(hit)
    g.scale.setScalar(0.78)
    return g
  }

  makeMiniBox() {
    const g = new THREE.Group()
    g.name = 'minibox'
    const bump = createCardboardBump(4)
    const paper = new THREE.MeshPhysicalMaterial({
      color: 0xf1ede3, roughness: 0.7, bumpMap: bump, bumpScale: 0.0015, clearcoat: 0.1
    })
    const bottom = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.055, 0.17, 4, 0.012), paper)
    bottom.position.y = 0.032
    bottom.castShadow = true
    g.add(bottom)
    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.245, 0.028, 0.175, 4, 0.01), paper)
    lid.position.y = 0.073
    g.add(lid)
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.246, 0.03, 0.02),
      new THREE.MeshPhysicalMaterial({ color: 0xc0a174, metalness: 0.5, roughness: 0.35 })
    )
    band.position.set(0, 0.062, 0)
    g.add(band)
    const logo = this.makeLogoPlate('AURA', 0.07, 0.012)
    logo.position.set(0, 0.09, 0)
    logo.rotation.x = -Math.PI / 2
    g.add(logo)
    const hit = this.makeHitBox(0.27, 0.12, 0.2, 'minibox')
    hit.position.y = 0.06
    g.add(hit)
    g.scale.setScalar(1.15)
    return g
  }

  makeLogoPlate(text, w, h) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = '#8f7758'
    ctx.font = '600 24px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '7px'
    ctx.fillText(text, 128, 34)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    )
  }

  get(id) {
    return this.items.find(i => i.userData.itemId === id)
  }
}
