import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export { RoundedBoxGeometry }

export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutQuint = t => 1 - Math.pow(1 - t, 5)
export const easeOutBack = t => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export class Tweens {
  constructor() {
    this.items = []
  }

  add({ duration = 0.8, delay = 0, ease = easeInOutCubic, update, complete }) {
    const item = { elapsed: -delay, duration, ease, update, complete, done: false }
    this.items.push(item)
    return item
  }

  to(object, target, options = {}) {
    const start = {}
    const keys = Object.keys(target)
    for (const key of keys) {
      if (object[key]?.isVector3) start[key] = object[key].clone()
      else start[key] = object[key]
    }
    return this.add({
      duration: options.duration ?? 1,
      delay: options.delay ?? 0,
      ease: options.ease ?? easeInOutCubic,
      update: t => {
        for (const key of keys) {
          if (target[key]?.isVector3) object[key].lerpVectors(start[key], target[key], t)
          else object[key] = lerp(start[key], target[key], t)
        }
      },
      complete: options.complete
    })
  }

  wait(duration, complete) {
    return this.add({ duration, update: () => {}, complete })
  }

  update(dt) {
    for (const item of this.items) {
      if (item.done) continue
      item.elapsed += dt
      if (item.elapsed < 0) continue
      const t = clamp(item.elapsed / item.duration)
      item.update(item.ease(t), t)
      if (t >= 1) {
        item.done = true
        item.complete?.()
      }
    }
    this.items = this.items.filter(item => !item.done)
  }

  clear() {
    this.items.length = 0
  }
}

export function roundedRectShape(width, height, radius) {
  const w = width / 2
  const h = height / 2
  const r = Math.min(radius, w, h)
  const shape = new THREE.Shape()
  shape.moveTo(-w + r, -h)
  shape.lineTo(w - r, -h)
  shape.quadraticCurveTo(w, -h, w, -h + r)
  shape.lineTo(w, h - r)
  shape.quadraticCurveTo(w, h, w - r, h)
  shape.lineTo(-w + r, h)
  shape.quadraticCurveTo(-w, h, -w, h - r)
  shape.lineTo(-w, -h + r)
  shape.quadraticCurveTo(-w, -h, -w + r, -h)
  return shape
}

export function roundedRectHole(width, height, radius) {
  const shape = roundedRectShape(width, height, radius)
  shape.holes.push(new THREE.Path(roundedRectShape(width - 0.04, height - 0.04, Math.max(0.001, radius - 0.02)).getPoints(24)))
  return shape
}

export function mesh(geometry, material, { position, rotation, scale, castShadow = true, receiveShadow = true, name } = {}) {
  const m = new THREE.Mesh(geometry, material)
  if (position) m.position.set(...position)
  if (rotation) m.rotation.set(...rotation)
  if (scale) m.scale.set(...scale)
  m.castShadow = castShadow
  m.receiveShadow = receiveShadow
  if (name) m.name = name
  return m
}

export function box(w, h, d, material, position = [0, 0, 0], radius = 0.008) {
  const geometry = radius > 0 ? new RoundedBoxGeometry(w, h, d, 4, radius) : new THREE.BoxGeometry(w, h, d)
  const m = new THREE.Mesh(geometry, material)
  m.position.set(...position)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export function contactShadow(size = 1, opacity = 0.45, color = '#000000') {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 124)
  g.addColorStop(0, color)
  g.addColorStop(0.28, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const texture = new THREE.CanvasTexture(canvas)
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false, blending: THREE.NormalBlending })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat)
  m.rotation.x = -Math.PI / 2
  m.renderOrder = 1
  return m
}

export function screenSpaceGlow(size = 1, color = '#ffffff', opacity = 0.4) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, color)
  g.addColorStop(0.3, color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat)
}

export function makeTextSprite(text, { color = '#ffffff', fontSize = 32, font = 'Helvetica', background = 'rgba(0,0,0,0)' } = {}) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `500 ${fontSize}px ${font}`
  const w = Math.ceil(ctx.measureText(text).width) + 40
  canvas.width = w
  canvas.height = fontSize + 30
  const c = canvas.getContext('2d')
  c.font = `500 ${fontSize}px ${font}`
  c.fillStyle = background
  c.fillRect(0, 0, canvas.width, canvas.height)
  c.fillStyle = color
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(canvas.width / canvas.height * 0.12, 0.12, 1)
  return sprite
}

export function disposeObject(root) {
  root.traverse(obj => {
    obj.geometry?.dispose?.()
    if (Array.isArray(obj.material)) obj.material.forEach(m => disposeMaterial(m))
    else if (obj.material) disposeMaterial(obj.material)
  })
}

function disposeMaterial(material) {
  for (const key of Object.keys(material)) {
    const value = material[key]
    if (value?.isTexture) value.dispose()
  }
  material.dispose?.()
}

export function createCurvedScreenMaterial(texture) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    color: 0xffffff
  })
}
