import * as THREE from 'three'

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function canvasTexture(canvas, { repeat = [1, 1], colorSpace = THREE.SRGBColorSpace, anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = colorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.anisotropy = anisotropy
  texture.needsUpdate = true
  return texture
}

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function createWoodTexture(seed = 7, tone = 'walnut') {
  const w = 1600, h = 1000
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const rand = mulberry32(seed)
  const palettes = {
    walnut: ['#3b2418', '#5b3824', '#2a1710', '#75492e', '#1d100b'],
    oak: ['#8b6544', '#b88a5c', '#6b4b31', '#d2a576', '#4a3222'],
    ebony: ['#211a17', '#3b2c25', '#100c0a', '#4e3a30', '#0a0807'],
    ash: ['#b9a58e', '#d4c1a8', '#8e7a65', '#e4d2ba', '#6f5d4b']
  }
  const p = palettes[tone] || palettes.walnut
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, p[0])
  grad.addColorStop(0.35, p[1])
  grad.addColorStop(0.65, p[0])
  grad.addColorStop(1, p[2])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 130; i++) {
    const y = rand() * h
    const amp = 5 + rand() * 22
    const freq = 0.002 + rand() * 0.006
    const phase = rand() * Math.PI * 2
    ctx.beginPath()
    for (let x = -20; x <= w + 20; x += 8) {
      const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase) * amp * 0.25
      if (x === -20) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(255,220,180,.075)' : i % 3 === 0 ? 'rgba(20,7,3,.16)' : 'rgba(10,4,2,.09)'
    ctx.lineWidth = 0.8 + rand() * 2.8
    ctx.stroke()
  }

  for (let k = 0; k < 7; k++) {
    const cx = rand() * w
    const cy = rand() * h
    for (let r = 4; r < 58; r += 3) {
      ctx.beginPath()
      ctx.ellipse(cx, cy, r * 2.6, r, rand() * 0.2, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(15,6,2,${0.07 - r * 0.0008})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  for (let i = 0; i < 18000; i++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,235,210' : '10,5,3'},${rand() * 0.035})`
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1)
  }

  const roughness = makeCanvas(800, 500)
  const rctx = roughness.getContext('2d')
  rctx.fillStyle = '#a5a5a5'
  rctx.fillRect(0, 0, 800, 500)
  for (let i = 0; i < 2600; i++) {
    rctx.fillStyle = `rgba(${rand() > 0.5 ? 255 : 40},${rand() > 0.5 ? 255 : 40},${rand() > 0.5 ? 255 : 40},${rand() * 0.18})`
    rctx.fillRect(rand() * 800, rand() * 500, 1 + rand() * 10, 1)
  }

  return {
    map: canvasTexture(canvas, { repeat: [1, 1] }),
    roughnessMap: canvasTexture(roughness, { repeat: [1, 1], colorSpace: THREE.NoColorSpace }),
    bumpMap: canvasTexture(canvas, { repeat: [1, 1], colorSpace: THREE.NoColorSpace })
  }
}

export function createPaperTexture(seed = 11) {
  const w = 512, h = 512
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const rand = mulberry32(seed)
  ctx.fillStyle = '#8f8f8f'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 35000; i++) {
    const v = 90 + rand() * 100
    ctx.fillStyle = `rgba(${v},${v},${v},${0.04 + rand() * 0.12})`
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2)
  }
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? 255 : 20},${rand() > 0.5 ? 255 : 20},${rand() > 0.5 ? 255 : 20},.035)`
    ctx.beginPath()
    const y = rand() * h
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(w * 0.3, y + rand() * 12, w * 0.6, y - rand() * 12, w, y + rand() * 8)
    ctx.stroke()
  }
  return canvasTexture(canvas, { repeat: [2, 2], colorSpace: THREE.NoColorSpace })
}

export function createVelvetTexture(seed = 23) {
  const w = 512, h = 512
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const rand = mulberry32(seed)
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#141417')
  g.addColorStop(0.5, '#222228')
  g.addColorStop(1, '#0d0d10')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 40000; i++) {
    const v = rand() * 80
    ctx.fillStyle = `rgba(${v + 40},${v + 38},${v + 44},${rand() * 0.12})`
    ctx.fillRect(rand() * w, rand() * h, 1, 1 + rand() * 3)
  }
  return canvasTexture(canvas, { repeat: [3, 3] })
}

export function createSealTexture() {
  const w = 512, h = 512
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#8c6a3d')
  g.addColorStop(0.14, '#e7cb92')
  g.addColorStop(0.28, '#c9a56c')
  g.addColorStop(0.4, '#f6e7bd')
  g.addColorStop(0.52, '#c7a36b')
  g.addColorStop(0.66, '#eed7a4')
  g.addColorStop(0.8, '#a9824e')
  g.addColorStop(1, '#e3c68c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Holographic foil streaks.
  ctx.globalAlpha = 0.22
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = i % 3 === 0 ? '#f4c6d8' : i % 3 === 1 ? '#bfe4e0' : '#fff6d8'
    ctx.lineWidth = 2 + Math.random() * 8
    ctx.beginPath()
    ctx.moveTo(-40, Math.random() * h)
    ctx.lineTo(w + 40, Math.random() * h)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Deep ink band with the brand mark.
  const band = ctx.createLinearGradient(0, 170, 0, 350)
  band.addColorStop(0, '#14151a')
  band.addColorStop(0.5, '#24252c')
  band.addColorStop(1, '#111216')
  ctx.fillStyle = band
  ctx.fillRect(0, 168, w, 184)
  ctx.strokeStyle = 'rgba(238,215,164,.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 168)
  ctx.lineTo(w, 168)
  ctx.moveTo(0, 352)
  ctx.lineTo(w, 352)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f1d9a6'
  ctx.font = '700 52px Helvetica, Arial, sans-serif'
  ctx.fillText('AURA', w / 2, 250)
  ctx.font = '500 17px Helvetica, Arial, sans-serif'
  ctx.fillStyle = 'rgba(241,217,166,.82)'
  ctx.fillText('T A M P E R   E V I D E N T', w / 2, 288)
  ctx.font = '500 14px Helvetica, Arial, sans-serif'
  ctx.fillStyle = 'rgba(241,217,166,.55)'
  ctx.fillText('SEAL · DO NOT ACCEPT IF BROKEN', w / 2, 318)

  // Microtext rows on the foil.
  ctx.fillStyle = 'rgba(48,36,20,.4)'
  ctx.font = '500 11px Helvetica, Arial, sans-serif'
  for (let row = 0; row < 5; row++) {
    ctx.fillText('AURA X1 PRO · SECURE · AURA X1 PRO · SECURE · AURA X1 PRO', w / 2, 48 + row * 20)
  }
  for (let row = 0; row < 4; row++) {
    ctx.fillText('AURA X1 PRO · SECURE · AURA X1 PRO · SECURE · AURA X1 PRO', w / 2, 392 + row * 20)
  }

  ctx.strokeStyle = 'rgba(48,36,20,.45)'
  ctx.lineWidth = 3
  ctx.strokeRect(18, 18, w - 36, h - 36)
  return canvasTexture(canvas)
}

export function createCardboardBump(seed = 31) {
  const w = 512, h = 512
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const rand = mulberry32(seed)
  ctx.fillStyle = '#888'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 24000; i++) {
    const v = 70 + rand() * 120
    ctx.fillStyle = `rgba(${v},${v},${v},${rand() * 0.25})`
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1)
  }
  return canvasTexture(canvas, { repeat: [3, 3], colorSpace: THREE.NoColorSpace })
}

export const FINISHES = {
  graphite: { name: 'Titan Xám', color: '#3b3d43', accent: '#c8a97a', glass: true },
  desert: { name: 'Titan Sa Mạc', color: '#a98463', accent: '#e8c89d', glass: false },
  alpine: { name: 'Xanh Alpine', color: '#425d63', accent: '#9bc1c3', glass: true },
  obsidian: { name: 'Đen Obsidian', color: '#15161a', accent: '#8e7b64', glass: true },
  porcelain: { name: 'Sứ Trắng', color: '#d8d4ca', accent: '#b39a78', glass: false },
  coral: { name: 'San Hô', color: '#b36b5e', accent: '#ecc4b4', glass: true }
}

export function createBackTexture(finish = 'graphite', model = 'X1 PRO') {
  const f = FINISHES[finish] || FINISHES.graphite
  const w = 640, h = 1280
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const base = f.color
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, shade(base, 38))
  g.addColorStop(0.28, shade(base, 5))
  g.addColorStop(0.52, shade(base, -18))
  g.addColorStop(0.78, shade(base, 12))
  g.addColorStop(1, shade(base, -30))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  if (f.glass) {
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * w
      const gr = ctx.createLinearGradient(x, 0, x + 60, h)
      gr.addColorStop(0, 'rgba(255,255,255,0)')
      gr.addColorStop(0.5, `rgba(255,255,255,${0.008 + Math.random() * 0.022})`)
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gr
      ctx.fillRect(x, 0, 30 + Math.random() * 70, h)
    }
  } else {
    for (let i = 0; i < 9000; i++) {
      const v = Math.random() * 40
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.018})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2)
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,.34)'
  ctx.font = '600 30px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.letterSpacing = '10px'
  ctx.fillText('AURA', w / 2, 825)
  ctx.font = '400 16px Helvetica, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.25)'
  ctx.fillText(model, w / 2, 860)
  ctx.font = '400 12px Helvetica, Arial, sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,.28)'
  ctx.fillText('DESIGNED BY AURA  •  ASSEMBLED WITH CARE', w / 2, 1204)
  ctx.fillText('MODEL A2691  •  5G  •  MADE IN VIETNAM', w / 2, 1226)
  return canvasTexture(canvas)
}

export function createBoxArtTexture({ finish = 'graphite', model = 'AURA X1 PRO', tagline = 'TITANIUM. REIMAGINED.', boxColor = '#0c0d10', accent = '#c7a97c' } = {}) {
  const w = 1200, h = 2200
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const f = FINISHES[finish] || FINISHES.graphite
  ctx.fillStyle = boxColor
  ctx.fillRect(0, 0, w, h)

  const bg = ctx.createRadialGradient(w * 0.5, h * 0.36, 20, w * 0.5, h * 0.5, w * 0.9)
  bg.addColorStop(0, 'rgba(255,255,255,.10)')
  bg.addColorStop(0.4, 'rgba(255,255,255,.025)')
  bg.addColorStop(1, 'rgba(0,0,0,.35)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(255,255,255,.09)'
  ctx.lineWidth = 2
  ctx.strokeRect(42, 42, w - 84, h - 84)

  ctx.fillStyle = accent
  ctx.font = '600 26px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.letterSpacing = '11px'
  ctx.fillText('AURA', 86, 128)
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ctx.font = '400 16px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('DESIGNED IN CALIFORNIA', 88, 166)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.font = '300 82px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '2px'
  ctx.fillText(model.replace('AURA ', ''), w / 2, 330)
  ctx.fillStyle = accent
  ctx.font = '500 20px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '8px'
  ctx.fillText(tagline, w / 2, 380)

  const pw = 480, ph = 990, px = (w - pw) / 2, py = 470
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.75)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 35
  roundRect(ctx, px, py, pw, ph, 72)
  const phoneGrad = ctx.createLinearGradient(px, py, px + pw, py + ph)
  phoneGrad.addColorStop(0, shade(f.color, 42))
  phoneGrad.addColorStop(0.3, f.color)
  phoneGrad.addColorStop(0.58, shade(f.color, -28))
  phoneGrad.addColorStop(0.82, shade(f.color, 16))
  phoneGrad.addColorStop(1, shade(f.color, -20))
  ctx.fillStyle = phoneGrad
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRect(ctx, px + 8, py + 8, pw - 16, ph - 16, 64)
  ctx.clip()
  const sheen = ctx.createLinearGradient(px, py, px + pw, py + ph)
  sheen.addColorStop(0.1, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.38, 'rgba(255,255,255,.16)')
  sheen.addColorStop(0.42, 'rgba(255,255,255,.02)')
  sheen.addColorStop(0.7, 'rgba(255,255,255,.10)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(px, py, pw, ph)
  ctx.restore()

  const camX = px + 38, camY = py + 38, camW = 236, camH = 270
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.6)'
  ctx.shadowBlur = 30
  roundRect(ctx, camX, camY, camW, camH, 55)
  const camGrad = ctx.createLinearGradient(camX, camY, camX + camW, camY + camH)
  camGrad.addColorStop(0, shade(f.color, 55))
  camGrad.addColorStop(1, shade(f.color, -25))
  ctx.fillStyle = camGrad
  ctx.fill()
  ctx.restore()

  const lensPositions = [[camX + 72, camY + 78], [camX + 166, camY + 78], [camX + 72, camY + 184]]
  for (const [lx, ly] of lensPositions) {
    ctx.beginPath()
    ctx.arc(lx, ly, 51, 0, Math.PI * 2)
    ctx.fillStyle = '#17191d'
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#8d775e'
    ctx.stroke()
    const lg = ctx.createRadialGradient(lx - 12, ly - 14, 4, lx, ly, 40)
    lg.addColorStop(0, 'rgba(130,180,220,.85)')
    lg.addColorStop(0.18, 'rgba(32,48,70,.95)')
    lg.addColorStop(0.65, 'rgba(4,7,12,1)')
    lg.addColorStop(1, '#0b0c10')
    ctx.beginPath()
    ctx.arc(lx, ly, 36, 0, Math.PI * 2)
    ctx.fillStyle = lg
    ctx.fill()
    ctx.beginPath()
    ctx.arc(lx - 13, ly - 14, 7, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(camX + 166, camY + 184, 22, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(250,238,205,.9)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(camX + 166, camY + 184, 12, 0, Math.PI * 2)
  ctx.fillStyle = '#d2b16f'
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,.34)'
  ctx.font = '600 29px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.letterSpacing = '10px'
  ctx.fillText('AURA', w / 2, py + ph - 80)
  ctx.font = '400 14px Helvetica, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.24)'
  ctx.letterSpacing = '3px'
  ctx.fillText('TITANIUM SERIES', w / 2, py + ph - 48)

  ctx.strokeStyle = 'rgba(255,255,255,.12)'
  ctx.beginPath()
  ctx.moveTo(86, 1600)
  ctx.lineTo(w - 86, 1600)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.fillStyle = accent
  ctx.font = '500 18px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '5px'
  ctx.fillText('PRODUCT HIGHLIGHTS', 88, 1662)
  ctx.fillStyle = 'rgba(255,255,255,.82)'
  ctx.font = '400 28px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '1px'
  ctx.fillText('Titanium frame  ·  Quad camera', 88, 1722)
  ctx.fillText('AURA Fusion X1  ·  120Hz OLED', 88, 1770)
  ctx.fillText('All-day battery  ·  AURA OS 12', 88, 1818)

  ctx.fillStyle = 'rgba(255,255,255,.32)'
  ctx.font = '400 16px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '2px'
  ctx.fillText('5G', 88, 2090)
  ctx.textAlign = 'right'
  ctx.fillText('MODEL A2691', w - 88, 2090)

  for (let i = 0; i < 22000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.018})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
  }

  return canvasTexture(canvas)
}

export function createBoxSideTexture({ boxColor = '#0c0d10', accent = '#c7a97c', model = 'X1 PRO' } = {}) {
  const canvas = makeCanvas(1200, 240)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = boxColor
  ctx.fillRect(0, 0, 1200, 240)
  const g = ctx.createLinearGradient(0, 0, 1200, 0)
  g.addColorStop(0, 'rgba(255,255,255,.03)')
  g.addColorStop(0.5, 'rgba(255,255,255,.08)')
  g.addColorStop(1, 'rgba(255,255,255,.02)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1200, 240)
  ctx.fillStyle = accent
  ctx.font = '600 26px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '9px'
  ctx.textAlign = 'left'
  ctx.fillText('AURA', 54, 92)
  ctx.fillStyle = 'rgba(255,255,255,.58)'
  ctx.font = '400 18px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '5px'
  ctx.fillText(model, 56, 128)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,.36)'
  ctx.font = '400 15px Helvetica, Arial, sans-serif'
  ctx.fillText('TITANIUM SERIES  •  5G', 1146, 102)
  return canvasTexture(canvas)
}

export function createWallpaper(name = 'aurora', accent = '#c7a97c') {
  const w = 1024, h = 2048
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const palettes = {
    aurora: ['#05070d', '#0b1a2b', '#2b4a55', '#d2a26d', '#d8d1c2'],
    dunes: ['#1c100b', '#4a2b1c', '#9c6741', '#e0b782', '#f3e5cc'],
    prism: ['#090812', '#2b1d3f', '#5b3b75', '#bd6f8e', '#e7b7a3'],
    obsidian: ['#030405', '#11151b', '#2b323d', '#727b87', '#d2d7dd'],
    ocean: ['#02080d', '#062c3a', '#0b6b78', '#44b8b2', '#d5eee9'],
    ember: ['#0d0605', '#2e110c', '#6b2118', '#c76032', '#f3c89e']
  }
  const p = palettes[name] || palettes.aurora
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, p[0])
  bg.addColorStop(0.35, p[1])
  bg.addColorStop(0.62, p[2])
  bg.addColorStop(0.85, p[3])
  bg.addColorStop(1, p[4])
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 5; i++) {
    const x = w * (0.1 + Math.random() * 0.8)
    const y = h * (0.2 + Math.random() * 0.65)
    const r = 240 + Math.random() * 420
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `${p[3]}88`)
    g.addColorStop(0.4, `${p[2]}33`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  if (name === 'dunes') {
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(-100, h)
      ctx.bezierCurveTo(w * 0.2, h * (0.55 + i * 0.035), w * 0.55, h * (0.5 + i * 0.05), w + 100, h * (0.42 + i * 0.06))
      ctx.lineTo(w + 100, h)
      ctx.closePath()
      ctx.fillStyle = `rgba(${30 + i * 14},${18 + i * 7},${12 + i * 4},${0.12 + i * 0.045})`
      ctx.fill()
    }
  }

  if (name === 'prism') {
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 12; i++) {
      ctx.beginPath()
      const x = Math.random() * w
      const y = Math.random() * h
      const s = 80 + Math.random() * 260
      ctx.moveTo(x, y)
      ctx.lineTo(x + s, y + s * 0.35)
      ctx.lineTo(x + s * 0.42, y + s)
      ctx.closePath()
      ctx.fillStyle = `rgba(${180 + Math.random() * 70},${100 + Math.random() * 90},${130 + Math.random() * 80},.04)`
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  const vig = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.2, w / 2, h * 0.5, w * 0.85)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,.4)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 14000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
  }
  return canvasTexture(canvas)
}

export function createGuideTexture() {
  const canvas = makeCanvas(512, 720)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f2eee6'
  ctx.fillRect(0, 0, 512, 720)
  ctx.fillStyle = '#141519'
  ctx.font = '600 18px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '8px'
  ctx.fillText('AURA', 52, 74)
  ctx.fillStyle = '#b4966b'
  ctx.fillRect(52, 94, 46, 3)
  ctx.fillStyle = '#16171a'
  ctx.font = '300 52px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '1px'
  ctx.fillText('X1 PRO', 52, 172)
  ctx.font = '400 22px Helvetica, Arial, sans-serif'
  ctx.fillStyle = '#6e6a63'
  ctx.fillText('HƯỚNG DẪN NHANH', 52, 212)
  ctx.strokeStyle = 'rgba(20,20,24,.12)'
  ctx.lineWidth = 1
  for (let y = 280; y < 640; y += 44) {
    ctx.beginPath()
    ctx.moveTo(52, y)
    ctx.lineTo(460, y)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(20,20,24,.45)'
  ctx.font = '400 13px Helvetica, Arial, sans-serif'
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(52, 266 + i * 44, 160 + Math.random() * 220, 5)
  }
  ctx.strokeStyle = '#b4966b'
  ctx.strokeRect(24, 24, 464, 672)
  return canvasTexture(canvas)
}

export function createWarrantyTexture() {
  const canvas = makeCanvas(600, 400)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#eae3d3'
  ctx.fillRect(0, 0, 600, 400)
  ctx.strokeStyle = '#b79b70'
  ctx.lineWidth = 2
  ctx.strokeRect(18, 18, 564, 364)
  ctx.fillStyle = '#17181b'
  ctx.font = '600 20px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '7px'
  ctx.fillText('AURA', 44, 68)
  ctx.font = '400 30px Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '2px'
  ctx.fillText('PHIẾU BẢO HÀNH', 44, 118)
  ctx.font = '400 15px Helvetica, Arial, sans-serif'
  ctx.fillStyle = 'rgba(20,20,24,.5)'
  ctx.fillText('SERIAL  A1X9 · 2026 · VN', 44, 154)
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(20,20,24,.18)'
    ctx.fillRect(44, 200 + i * 30, 240 + Math.random() * 220, 4)
  }
  ctx.fillStyle = '#b4966b'
  ctx.beginPath()
  ctx.arc(500, 300, 32, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#eae3d3'
  ctx.font = '600 12px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('AURA', 500, 304)
  return canvasTexture(canvas)
}

export function shade(hex, amt) {
  const c = hex.replace('#', '')
  const n = parseInt(c.length === 3 ? c.split('').map(v => v + v).join('') : c, 16)
  let r = (n >> 16) + amt
  let g = ((n >> 8) & 0xff) + amt
  let b = (n & 0xff) + amt
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function makeGradientSprite(colorA = '#ffffff', colorB = '#000000', size = 128) {
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, colorA)
  g.addColorStop(0.35, colorB)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return canvasTexture(canvas)
}
