import * as THREE from 'three'
import {
  RoundedBoxGeometry, box, mesh, clamp, lerp, roundedRectShape, easeOutCubic, easeInOutCubic
} from './utils.js'
import {
  FINISHES, createBackTexture, createWallpaper, createBoxArtTexture, createSealTexture,
  shade
} from './textures.js'

export const PHONE_VARIANTS = [
  {
    id: 'x1', name: 'AURA X1 PRO', short: 'X1 PRO', tier: 'Flagship', finish: 'graphite',
    ram: '12 GB', storage: '512 GB', camera: 3, fold: false, price: '32.990.000 ₫',
    tagline: 'TITANIUM. REIMAGINED.', desc: 'Khung titan cấp hàng không, màn hình LTPO 120Hz và hệ thống camera AURA Fusion thế hệ mới.'
  },
  {
    id: 'lite', name: 'AURA LITE', short: 'LITE', tier: 'Phổ thông', finish: 'alpine',
    ram: '8 GB', storage: '128 GB', camera: 2, fold: false, price: '6.990.000 ₫',
    tagline: 'EVERYDAY. ELEVATED.', desc: 'Chiếc smartphone cân bằng giữa thiết kế tinh gọn, pin bền bỉ và trải nghiệm mượt mà mỗi ngày.'
  },
  {
    id: 'neo', name: 'AURA NEO', short: 'NEO', tier: 'Tầm trung', finish: 'porcelain',
    ram: '8 GB', storage: '256 GB', camera: 3, fold: false, price: '11.490.000 ₫',
    tagline: 'MORE, BEAUTIFULLY.', desc: 'Màn hình OLED rực rỡ, camera 50MP và thiết kế sứ mờ sang trọng trong tầm tay.'
  },
  {
    id: 'play', name: 'AURA PLAY', short: 'PLAY', tier: 'Gaming', finish: 'obsidian',
    ram: '16 GB', storage: '1 TB', camera: 3, fold: false, price: '19.990.000 ₫', gaming: true,
    tagline: 'BUILT TO WIN.', desc: 'Tản nhiệt buồng hơi, màn hình 165Hz và trigger cảm ứng biến mọi trận đấu thành sân khấu.'
  },
  {
    id: 'fold', name: 'AURA FOLD', short: 'FOLD', tier: 'Màn hình gập', finish: 'desert',
    ram: '12 GB', storage: '512 GB', camera: 3, fold: true, price: '41.990.000 ₫',
    tagline: 'UNFOLD THE FUTURE.', desc: 'Bản lề titan siêu mỏng, màn hình gập không nếp gấp và trải nghiệm đa nhiệm trên không gian rộng mở.'
  },
  {
    id: 'signature', name: 'AURA SIGNATURE', short: 'SIGNATURE', tier: 'Siêu cao cấp', finish: 'desert',
    ram: '16 GB', storage: '1 TB', camera: 4, fold: false, price: '49.990.000 ₫',
    tagline: 'THE ART OF ENGINEERING.', desc: 'Phiên bản giới hạn với khung titan vàng champagne, camera bốn ống kính và hậu tố cá nhân hóa.'
  }
]

const SCREEN_W = 1024
const SCREEN_H = 2048

export class PhoneScreen {
  constructor(onAction) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = SCREEN_W
    this.canvas.height = SCREEN_H
    this.ctx = this.canvas.getContext('2d')
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 8
    this.texture.needsUpdate = true
    this.onAction = onAction
    this.state = 'off'
    this.brightness = 0
    this.bootT = 0
    this.bootDuration = 3.4
    this.booting = false
    this.dirty = true
    this.lastDraw = 0
    this.wallpaperName = 'aurora'
    this.wallpaperTex = createWallpaper('aurora')
    this.language = 'vi'
    this.theme = 'dark'
    this.accent = '#c7a97c'
    this.hotspots = []
    this.app = null
    this.musicPlaying = true
    this.musicT = 0
    this.time = 0
    this.appAccent = '#c7a97c'
    this.battery = 87
    this.drawOff()
  }

  setWallpaper(name) {
    this.wallpaperName = name
    this.wallpaperTex?.dispose()
    this.wallpaperTex = createWallpaper(name)
    this.dirty = true
  }

  setLanguage(lang) {
    this.language = lang
    this.dirty = true
  }

  setTheme(theme) {
    this.theme = theme
    this.dirty = true
  }

  setBrightness(v) {
    this.brightness = clamp(v)
  }

  powerOn() {
    this.state = 'boot'
    this.booting = true
    this.bootT = 0
    this.brightness = 0
    this.dirty = true
    this.onAction?.('boot-start')
  }

  powerOff() {
    this.booting = false
    this.state = 'off'
    this.app = null
    this.brightness = 0
    this.drawOff()
  }

  update(dt) {
    this.time += dt
    if (this.booting) {
      this.bootT += dt
      this.brightness = clamp(this.bootT / 0.6)
      if (this.bootT > this.bootDuration) {
        this.booting = false
        this.state = 'setup-lang'
        this.brightness = 1
        this.dirty = true
        this.onAction?.('boot-complete')
      } else {
        this.dirty = true
      }
    }
    if (this.state === 'home' && this.time - this.lastDraw > 1) this.dirty = true
    if (this.state === 'app-music' && this.musicPlaying) this.dirty = true
    if (this.dirty && this.time - this.lastDraw > 1 / 24) {
      this.draw()
      this.lastDraw = this.time
      this.dirty = false
    }
  }

  drawOff() {
    const ctx = this.ctx
    ctx.fillStyle = '#010102'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.texture.needsUpdate = true
    this.hotspots = []
  }

  draw() {
    if (this.state === 'off') return this.drawOff()
    if (this.state === 'boot') return this.drawBoot()
    if (this.state.startsWith('setup')) return this.drawSetup()
    if (this.state.startsWith('app-')) return this.drawApp()
    return this.drawHome()
  }

  background() {
    const ctx = this.ctx
    const wp = this.wallpaperTex.image
    ctx.drawImage(wp, 0, 0, SCREEN_W, SCREEN_H)
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
    if (this.theme === 'light') {
      g.addColorStop(0, 'rgba(255,255,255,.28)')
      g.addColorStop(1, 'rgba(255,255,255,.12)')
    } else {
      g.addColorStop(0, 'rgba(0,0,0,.18)')
      g.addColorStop(0.5, 'rgba(0,0,0,.05)')
      g.addColorStop(1, 'rgba(0,0,0,.45)')
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  }

  statusBar(dark = false) {
    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = dark ? 'rgba(12,13,17,.82)' : 'rgba(255,255,255,.9)'
    ctx.font = '600 34px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('09:41', 62, 72)
    ctx.textAlign = 'right'
    ctx.fillText('5G', 846, 72)
    ctx.strokeStyle = ctx.fillStyle
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (let i = 0; i < 4; i++) {
      const x = 884 + i * 15
      const h = 10 + i * 7
      ctx.beginPath()
      ctx.moveTo(x, 78)
      ctx.lineTo(x, 78 - h)
      ctx.stroke()
    }
    ctx.lineWidth = 4
    ctx.strokeStyle = ctx.fillStyle
    ctx.beginPath()
    ctx.arc(958, 66, 20, Math.PI * 0.76, Math.PI * 1.24)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(958, 66, 11, Math.PI * 0.76, Math.PI * 1.24)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(958, 70, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ctx.fillStyle
    ctx.lineWidth = 3
    ctx.strokeRect(985, 48, 34, 20)
    ctx.fillStyle = ctx.fillStyle
    ctx.fillRect(990, 53, 21, 10)
    ctx.restore()
  }

  drawBoot() {
    const ctx = this.ctx
    const t = this.bootT
    ctx.fillStyle = '#020204'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    const reveal = easeOutCubic(clamp(t / 1.2))
    const pulse = 0.5 + Math.sin(t * 2.4) * 0.5
    ctx.save()
    ctx.translate(SCREEN_W / 2, SCREEN_H / 2 - 120)
    ctx.globalAlpha = reveal
    ctx.strokeStyle = `rgba(199,169,124,${0.35 + pulse * 0.3})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 132 + pulse * 10, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, 154, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.55)
    ctx.strokeStyle = 'rgba(255,255,255,.15)'
    ctx.stroke()
    ctx.fillStyle = '#f2ede3'
    ctx.font = '300 74px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '22px'
    ctx.fillText('AURA', 10, 26)
    ctx.fillStyle = 'rgba(199,169,124,.9)'
    ctx.font = '500 18px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '12px'
    ctx.fillText('AURA OS 12', 5, 112)
    ctx.restore()

    const progress = clamp(t / this.bootDuration)
    ctx.fillStyle = 'rgba(255,255,255,.13)'
    ctx.fillRect(292, SCREEN_H / 2 + 230, 440, 3)
    const bg = ctx.createLinearGradient(292, 0, 732, 0)
    bg.addColorStop(0, '#8f6c44')
    bg.addColorStop(0.55, '#f2e4c9')
    bg.addColorStop(1, '#c7a97c')
    ctx.fillStyle = bg
    ctx.fillRect(292, SCREEN_H / 2 + 230, 440 * progress, 3)
    ctx.fillStyle = 'rgba(255,255,255,.35)'
    ctx.font = '400 20px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '3px'
    ctx.fillText(progress < 0.45 ? 'POWERING UP' : progress < 0.8 ? 'SECURING YOUR DEVICE' : 'ALMOST READY', SCREEN_W / 2, SCREEN_H / 2 + 290)
    ctx.fillStyle = 'rgba(255,255,255,.18)'
    ctx.font = '400 17px Helvetica, Arial, sans-serif'
    ctx.fillText('AURA  ·  PRIVATE BY DESIGN', SCREEN_W / 2, SCREEN_H - 110)
    this.hotspots = []
    this.texture.needsUpdate = true
  }

  drawSetup() {
    const ctx = this.ctx
    const step = this.state === 'setup-lang' ? 0 : this.state === 'setup-wallpaper' ? 1 : 2
    this.background()
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
    g.addColorStop(0, 'rgba(8,10,14,.78)')
    g.addColorStop(0.55, 'rgba(8,10,14,.86)')
    g.addColorStop(1, 'rgba(8,10,14,.94)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.statusBar()
    this.hotspots = []
    ctx.textAlign = 'left'
    ctx.fillStyle = '#c7a97c'
    ctx.font = '500 20px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '8px'
    ctx.fillText(`BƯỚC ${step + 1} / 3`, 78, 220)
    ctx.fillStyle = 'rgba(255,255,255,.95)'
    ctx.font = '300 66px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '0px'
    if (step === 0) {
      ctx.fillText('Xin chào.', 74, 318)
      ctx.fillStyle = 'rgba(255,255,255,.52)'
      ctx.font = '400 30px Helvetica, Arial, sans-serif'
      ctx.fillText('Chọn ngôn ngữ cho thiết bị của bạn.', 78, 378)
      const opts = [
        { label: 'Tiếng Việt', sub: 'Việt Nam', code: 'vi', y: 470 },
        { label: 'English', sub: 'United States', code: 'en', y: 646 },
        { label: '日本語', sub: 'Japan', code: 'ja', y: 822 }
      ]
      for (const o of opts) {
        const active = this.language === o.code
        this.pill(66, o.y, 892, 142, active ? 'rgba(199,169,124,.18)' : 'rgba(255,255,255,.055)', active ? 'rgba(199,169,124,.9)' : 'rgba(255,255,255,.11)', 28)
        ctx.fillStyle = '#f4f0e7'
        ctx.font = '500 34px Helvetica, Arial, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(o.label, 110, o.y + 62)
        ctx.fillStyle = 'rgba(255,255,255,.38)'
        ctx.font = '400 21px Helvetica, Arial, sans-serif'
        ctx.fillText(o.sub, 110, o.y + 99)
        ctx.beginPath()
        ctx.arc(886, o.y + 71, 21, 0, Math.PI * 2)
        ctx.strokeStyle = active ? '#d8bd94' : 'rgba(255,255,255,.22)'
        ctx.lineWidth = 2
        ctx.stroke()
        if (active) {
          ctx.beginPath()
          ctx.arc(886, o.y + 71, 12, 0, Math.PI * 2)
          ctx.fillStyle = '#d8bd94'
          ctx.fill()
        }
        this.hotspots.push({ x: 66, y: o.y, w: 892, h: 142, action: `lang:${o.code}` })
      }
      this.button(66, 1726, 892, 116, 'TIẾP TỤC', true, 'setup-next')
    } else if (step === 1) {
      ctx.fillText('Chọn hình nền.', 74, 318)
      ctx.fillStyle = 'rgba(255,255,255,.52)'
      ctx.font = '400 30px Helvetica, Arial, sans-serif'
      ctx.fillText('Một chút cá tính cho màn hình đầu tiên.', 78, 378)
      const walls = [
        { id: 'aurora', label: 'Aurora', y: 470 },
        { id: 'dunes', label: 'Dunes', y: 760 },
        { id: 'prism', label: 'Prism', y: 1050 },
        { id: 'ocean', label: 'Ocean', y: 1340 }
      ]
      for (const wall of walls) {
        const active = this.wallpaperName === wall.id
        const tex = active ? this.wallpaperTex : createWallpaper(wall.id)
        const x = 66, y = wall.y, w = 892, h = 250
        ctx.save()
        this.roundRect(x, y, w, h, 28)
        ctx.clip()
        ctx.drawImage(tex.image, 0, 0, w, h)
        ctx.fillStyle = 'rgba(0,0,0,.18)'
        ctx.fillRect(x, y, w, h)
        ctx.restore()
        ctx.strokeStyle = active ? '#d8bd94' : 'rgba(255,255,255,.14)'
        ctx.lineWidth = active ? 5 : 2
        this.roundRect(x, y, w, h, 28)
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = '500 28px Helvetica, Arial, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(wall.label, x + 34, y + h - 34)
        if (active) {
          ctx.fillStyle = 'rgba(20,20,24,.6)'
          this.roundRect(x + w - 150, y + h - 70, 116, 42, 21)
          ctx.fill()
          ctx.fillStyle = '#f0dfc4'
          ctx.font = '500 17px Helvetica, Arial, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('ĐÃ CHỌN', x + w - 92, y + h - 43)
        }
        if (!active) tex.dispose()
        this.hotspots.push({ x, y, w, h, action: `wall:${wall.id}` })
      }
      this.button(66, 1690, 892, 116, 'TIẾP TỤC', true, 'setup-next')
    } else {
      ctx.fillText('Hoàn thiện.', 74, 318)
      ctx.fillStyle = 'rgba(255,255,255,.52)'
      ctx.font = '400 30px Helvetica, Arial, sans-serif'
      ctx.fillText('Chọn giao diện và phong cách màu.', 78, 378)
      const themes = [
        { id: 'dark', label: 'Midnight', sub: 'Tối sang trọng', y: 470 },
        { id: 'light', label: 'Porcelain', sub: 'Sáng tinh khiết', y: 646 }
      ]
      for (const th of themes) {
        const active = this.theme === th.id
        this.pill(66, th.y, 892, 142, active ? 'rgba(199,169,124,.18)' : 'rgba(255,255,255,.055)', active ? 'rgba(199,169,124,.9)' : 'rgba(255,255,255,.11)', 28)
        ctx.fillStyle = th.id === 'dark' ? '#16171c' : '#e8e3d9'
        this.roundRect(108, th.y + 32, 78, 78, 18)
        ctx.fill()
        ctx.fillStyle = th.id === 'dark' ? '#d9c29e' : '#7a654c'
        ctx.font = '500 20px Helvetica, Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Aa', 147, th.y + 83)
        ctx.textAlign = 'left'
        ctx.fillStyle = '#f4f0e7'
        ctx.font = '500 32px Helvetica, Arial, sans-serif'
        ctx.fillText(th.label, 218, th.y + 64)
        ctx.fillStyle = 'rgba(255,255,255,.38)'
        ctx.font = '400 21px Helvetica, Arial, sans-serif'
        ctx.fillText(th.sub, 218, th.y + 100)
        ctx.beginPath()
        ctx.arc(886, th.y + 71, 21, 0, Math.PI * 2)
        ctx.strokeStyle = active ? '#d8bd94' : 'rgba(255,255,255,.22)'
        ctx.lineWidth = 2
        ctx.stroke()
        if (active) {
          ctx.beginPath()
          ctx.arc(886, th.y + 71, 12, 0, Math.PI * 2)
          ctx.fillStyle = '#d8bd94'
          ctx.fill()
        }
        this.hotspots.push({ x: 66, y: th.y, w: 892, h: 142, action: `theme:${th.id}` })
      }
      ctx.fillStyle = 'rgba(255,255,255,.08)'
      this.roundRect(66, 858, 892, 228, 30)
      ctx.fill()
      ctx.fillStyle = '#c7a97c'
      ctx.font = '500 18px Helvetica, Arial, sans-serif'
      ctx.letterSpacing = '5px'
      ctx.fillText('AURA INTELLIGENCE', 104, 912)
      ctx.fillStyle = 'rgba(255,255,255,.68)'
      ctx.font = '400 24px Helvetica, Arial, sans-serif'
      ctx.letterSpacing = '0px'
      ctx.fillText('Thiết bị đã sẵn sàng. Mọi dữ liệu', 104, 960)
      ctx.fillText('được mã hoá và bảo vệ ngay từ đầu.', 104, 998)
      this.button(66, 1690, 892, 116, 'BẮT ĐẦU SỬ DỤNG', true, 'setup-finish')
    }
    ctx.fillStyle = 'rgba(255,255,255,.3)'
    ctx.font = '400 20px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('AURA OS 12  ·  Thiết lập an toàn', SCREEN_W / 2, 1958)
    this.texture.needsUpdate = true
  }

  drawHome() {
    const ctx = this.ctx
    this.background()
    this.statusBar(this.theme === 'light')
    const dark = this.theme !== 'light'
    ctx.textAlign = 'center'
    ctx.fillStyle = dark ? '#f7f3ea' : '#17181c'
    ctx.font = '300 186px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '-8px'
    ctx.fillText('09:41', SCREEN_W / 2, 342)
    ctx.font = '500 24px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '4px'
    ctx.fillStyle = dark ? 'rgba(255,255,255,.58)' : 'rgba(20,22,28,.55)'
    ctx.fillText('THỨ BẢY, 31 THÁNG 10', SCREEN_W / 2, 396)

    ctx.textAlign = 'left'
    const widgetAlpha = dark ? 0.1 : 0.36
    ctx.fillStyle = dark ? `rgba(255,255,255,${widgetAlpha})` : `rgba(255,255,255,${widgetAlpha + 0.2})`
    this.roundRect(58, 462, 908, 210, 34)
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.3)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = dark ? '#f4efe5' : '#17181c'
    ctx.font = '400 29px Helvetica, Arial, sans-serif'
    ctx.fillText('Hà Nội', 98, 522)
    ctx.fillStyle = dark ? 'rgba(255,255,255,.45)' : 'rgba(20,22,28,.5)'
    ctx.font = '400 21px Helvetica, Arial, sans-serif'
    ctx.fillText('Nhiều mây  ·  27°', 98, 558)
    ctx.fillStyle = dark ? '#f4efe5' : '#17181c'
    ctx.font = '300 76px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('27°', 924, 552)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,.12)'
    ctx.fillRect(98, 596, 826, 2)
    ctx.fillStyle = dark ? 'rgba(255,255,255,.56)' : 'rgba(20,22,28,.55)'
    ctx.font = '400 20px Helvetica, Arial, sans-serif'
    ctx.fillText('AQI 32  ·  Chất lượng không khí tốt', 98, 636)

    const apps = [
      { id: 'camera', name: 'Camera', colorA: '#353b4a', colorB: '#11131a', glyph: '◉' },
      { id: 'photos', name: 'Ảnh', colorA: '#e7b164', colorB: '#b4593b', glyph: '✦' },
      { id: 'settings', name: 'Cài đặt', colorA: '#70747c', colorB: '#2f3238', glyph: '⚙' },
      { id: 'music', name: 'Nhạc', colorA: '#c16474', colorB: '#552b44', glyph: '♫' },
      { id: 'notes', name: 'Ghi chú', colorA: '#e5d09a', colorB: '#ad8750', glyph: '≡' },
      { id: 'browser', name: 'AURA', colorA: '#587d88', colorB: '#213c47', glyph: '◎' },
      { id: 'clock', name: 'Đồng hồ', colorA: '#282b32', colorB: '#0d0f14', glyph: '◷' },
      { id: 'weather', name: 'Thời tiết', colorA: '#7ba8c4', colorB: '#395d79', glyph: '☁' }
    ]
    const startX = 80, startY = 746, gapX = 228, gapY = 264, size = 142
    apps.forEach((app, i) => {
      const col = i % 4, row = Math.floor(i / 4)
      const x = startX + col * gapX, y = startY + row * gapY
      const gr = ctx.createLinearGradient(x, y, x + size, y + size)
      gr.addColorStop(0, app.colorA)
      gr.addColorStop(1, app.colorB)
      ctx.fillStyle = gr
      this.roundRect(x, y, size, size, 34)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,.13)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,.9)'
      ctx.font = '400 54px Helvetica, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(app.glyph, x + size / 2, y + size / 2 + 19)
      ctx.fillStyle = dark ? 'rgba(255,255,255,.78)' : 'rgba(20,22,28,.76)'
      ctx.font = '400 21px Helvetica, Arial, sans-serif'
      ctx.fillText(app.name, x + size / 2, y + size + 36)
      this.hotspots.push({ x: x - 14, y: y - 10, w: size + 28, h: size + 58, action: `app:${app.id}` })
    })

    const dockY = 1712
    ctx.fillStyle = dark ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.32)'
    this.roundRect(50, dockY, 924, 224, 52)
    ctx.fill()
    const dock = ['phone', 'messages', 'camera', 'photos']
    dock.forEach((id, i) => {
      const x = 102 + i * 216
      const app = id === 'phone' ? { colorA: '#6f9e68', colorB: '#315c39', glyph: '✆' } : id === 'messages' ? { colorA: '#62b48a', colorB: '#2c6f51', glyph: '●' } : id === 'camera' ? { colorA: '#505762', colorB: '#1a1d23', glyph: '◉' } : { colorA: '#e7b164', colorB: '#b4593b', glyph: '✦' }
      const gr = ctx.createLinearGradient(x, dockY + 42, x + 128, dockY + 170)
      gr.addColorStop(0, app.colorA)
      gr.addColorStop(1, app.colorB)
      ctx.fillStyle = gr
      this.roundRect(x, dockY + 42, 128, 128, 30)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,.9)'
      ctx.font = '400 50px Helvetica, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(app.glyph, x + 64, dockY + 126)
      this.hotspots.push({ x: x - 12, y: dockY + 30, w: 152, h: 154, action: `app:${id}` })
    })
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.fillRect(430, 1980, 164, 7)
    this.texture.needsUpdate = true
  }

  drawApp() {
    const ctx = this.ctx
    const id = this.state.replace('app-', '')
    ctx.fillStyle = '#08090c'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.hotspots = []
    if (id === 'camera') return this.drawCameraApp()
    if (id === 'photos') return this.drawPhotosApp()
    if (id === 'settings') return this.drawSettingsApp()
    if (id === 'music') return this.drawMusicApp()
    if (id === 'notes') return this.drawNotesApp()
    if (id === 'browser') return this.drawBrowserApp()
    if (id === 'clock') return this.drawClockApp()
    if (id === 'weather') return this.drawWeatherApp()
    return this.drawHome()
  }

  drawCameraApp() {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, SCREEN_W, SCREEN_H)
    g.addColorStop(0, '#243441')
    g.addColorStop(0.35, '#705f52')
    g.addColorStop(0.68, '#b28a68')
    g.addColorStop(1, '#2d2522')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    ctx.fillStyle = 'rgba(255,255,255,.08)'
    ctx.beginPath()
    ctx.arc(700, 520, 240, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,.2)'
    ctx.fillRect(0, 0, SCREEN_W, 140)
    this.statusBar()
    ctx.fillStyle = '#fff'
    ctx.font = '500 22px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '4px'
    ctx.fillText('AURA CAMERA  ·  1×', SCREEN_W / 2, 200)
    ctx.strokeStyle = 'rgba(255,255,255,.8)'
    ctx.lineWidth = 2
    const bx = 190, by = 500, bw = 644, bh = 644
    for (const [x, y, sx, sy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
      ctx.beginPath()
      ctx.moveTo(x, y + sy * 54)
      ctx.lineTo(x, y)
      ctx.lineTo(x + sx * 54, y)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    ctx.font = '400 18px Helvetica, Arial, sans-serif'
    ctx.fillText('ẢNH  ·  4:3  ·  200MP', SCREEN_W / 2, 1230)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(SCREEN_W / 2, 1500, 92, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(SCREEN_W / 2, 1500, 74, 0, Math.PI * 2)
    ctx.fill()
    this.hotspots.push({ x: SCREEN_W / 2 - 100, y: 1400, w: 200, h: 200, action: 'shutter' })
    ctx.fillStyle = 'rgba(255,255,255,.4)'
    ctx.font = '400 20px Helvetica, Arial, sans-serif'
    ctx.fillText('TAP ĐỂ CHỤP  ·  VUỐT ĐỂ ĐÓNG', SCREEN_W / 2, 1660)
    this.hotspots.push({ x: 70, y: 1880, w: 200, h: 90, action: 'home' })
    this.texture.needsUpdate = true
  }

  drawPhotosApp() {
    const ctx = this.ctx
    ctx.fillStyle = this.theme === 'light' ? '#f2eee7' : '#0a0b0e'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.statusBar(this.theme === 'light')
    const dark = this.theme !== 'light'
    ctx.fillStyle = dark ? '#f3eee5' : '#15161a'
    ctx.font = '300 54px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Ảnh', 68, 190)
    ctx.fillStyle = dark ? 'rgba(255,255,255,.4)' : 'rgba(20,20,24,.45)'
    ctx.font = '400 22px Helvetica, Arial, sans-serif'
    ctx.fillText('Hôm nay  ·  31 tháng 10', 70, 238)
    const colors = [
      ['#b57c55', '#3c2b22'], ['#5e7f87', '#1f3037'], ['#c7a97c', '#4a3826'],
      ['#b25f5a', '#321c1d'], ['#7b6a94', '#261f38'], ['#5d886f', '#1b3126'],
      ['#c9b98c', '#3e3526'], ['#70859c', '#232d38'], ['#a2756d', '#36201e']
    ]
    let i = 0
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 60 + col * 312, y = 300 + row * 412
        const gr = ctx.createLinearGradient(x, y, x + 284, y + 380)
        gr.addColorStop(0, colors[i][0])
        gr.addColorStop(1, colors[i][1])
        ctx.fillStyle = gr
        this.roundRect(x, y, 284, 380, 22)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,.1)'
        ctx.stroke()
        i++
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.5)'
    ctx.font = '400 18px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('9 ảnh  ·  AURA X1 PRO', SCREEN_W / 2, 1620)
    this.hotspots.push({ x: 60, y: 1880, w: 250, h: 90, action: 'home' })
    this.texture.needsUpdate = true
  }

  drawSettingsApp() {
    const ctx = this.ctx
    ctx.fillStyle = this.theme === 'light' ? '#f2eee7' : '#0b0c0f'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.statusBar(this.theme === 'light')
    const dark = this.theme !== 'light'
    ctx.fillStyle = dark ? '#f3eee5' : '#15161a'
    ctx.font = '300 54px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Cài đặt', 68, 190)
    const rows = [
      ['Wi-Fi', 'AURA Studio 5G', '◉'],
      ['Bluetooth', 'Đang bật', '⌁'],
      ['Màn hình', '120Hz · Tự động', '☼'],
      ['Âm thanh', 'Không gian 3D', '◖'],
      ['AURA Intelligence', 'Đang học thói quen', '✦'],
      ['Bảo mật', 'Face ID · Đã bật', '◇']
    ]
    rows.forEach((r, i) => {
      const y = 290 + i * 166
      ctx.fillStyle = dark ? 'rgba(255,255,255,.065)' : 'rgba(20,20,24,.05)'
      this.roundRect(60, y, 904, 132, 26)
      ctx.fill()
      ctx.fillStyle = this.accent
      ctx.font = '400 34px Helvetica, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(r[2], 122, y + 82)
      ctx.textAlign = 'left'
      ctx.fillStyle = dark ? '#f4efe6' : '#1a1b20'
      ctx.font = '500 28px Helvetica, Arial, sans-serif'
      ctx.fillText(r[0], 176, y + 62)
      ctx.fillStyle = dark ? 'rgba(255,255,255,.38)' : 'rgba(20,20,24,.45)'
      ctx.font = '400 21px Helvetica, Arial, sans-serif'
      ctx.fillText(r[1], 176, y + 99)
      ctx.fillStyle = 'rgba(255,255,255,.2)'
      ctx.font = '400 34px Helvetica, Arial, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('›', 918, y + 82)
    })
    this.hotspots.push({ x: 60, y: 1880, w: 250, h: 90, action: 'home' })
    this.texture.needsUpdate = true
  }

  drawMusicApp() {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
    g.addColorStop(0, '#241820')
    g.addColorStop(0.5, '#100c12')
    g.addColorStop(1, '#070709')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.statusBar()
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,.42)'
    ctx.font = '500 18px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '6px'
    ctx.fillText('ĐANG PHÁT TỪ AURA MUSIC', SCREEN_W / 2, 190)
    const art = ctx.createLinearGradient(170, 280, 850, 960)
    art.addColorStop(0, '#d9a46d')
    art.addColorStop(0.35, '#7e4252')
    art.addColorStop(0.72, '#293f58')
    art.addColorStop(1, '#0f1824')
    ctx.fillStyle = art
    this.roundRect(170, 280, 684, 684, 46)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.16)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.16)'
    ctx.beginPath()
    ctx.arc(512, 622, 210, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.3)'
    ctx.beginPath()
    ctx.arc(512, 622, 120, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1218'
    ctx.beginPath()
    ctx.arc(512, 622, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f6f0e7'
    ctx.font = '500 42px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '0px'
    ctx.fillText('Neon Afterglow', SCREEN_W / 2, 1084)
    ctx.fillStyle = 'rgba(255,255,255,.42)'
    ctx.font = '400 24px Helvetica, Arial, sans-serif'
    ctx.fillText('AURA SESSIONS  ·  VOL. 04', SCREEN_W / 2, 1128)
    ctx.fillStyle = 'rgba(255,255,255,.14)'
    ctx.fillRect(130, 1240, 764, 5)
    const p = (this.time * 0.06) % 1
    ctx.fillStyle = '#d8b98b'
    ctx.fillRect(130, 1240, 764 * p, 5)
    ctx.fillStyle = 'rgba(255,255,255,.3)'
    ctx.font = '400 18px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('1:24', 130, 1284)
    ctx.textAlign = 'right'
    ctx.fillText('3:58', 894, 1284)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f4eee5'
    ctx.font = '400 58px Helvetica, Arial, sans-serif'
    ctx.fillText('⏮', 320, 1440)
    ctx.fillStyle = '#d8b98b'
    ctx.beginPath()
    ctx.arc(512, 1420, 88, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#18130f'
    ctx.font = '400 54px Helvetica, Arial, sans-serif'
    ctx.fillText(this.musicPlaying ? 'Ⅱ' : '▶', 512, 1440)
    ctx.fillStyle = '#f4eee5'
    ctx.fillText('⏭', 704, 1440)
    this.hotspots.push({ x: 400, y: 1310, w: 224, h: 220, action: 'music-toggle' })
    this.hotspots.push({ x: 60, y: 1880, w: 250, h: 90, action: 'home' })
    this.texture.needsUpdate = true
  }

  drawNotesApp() {
    const ctx = this.ctx
    ctx.fillStyle = '#ece7dc'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.statusBar(true)
    ctx.fillStyle = '#17181c'
    ctx.font = '300 54px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Ghi chú', 68, 190)
    ctx.fillStyle = '#b4966b'
    ctx.font = '500 18px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '5px'
    ctx.fillText('HÔM NAY', 72, 286)
    ctx.fillStyle = '#1a1b20'
    ctx.font = '500 34px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '0px'
    ctx.fillText('Ngày đầu tiên với AURA', 72, 350)
    ctx.fillStyle = 'rgba(20,20,24,.6)'
    ctx.font = '400 24px Helvetica, Arial, sans-serif'
    const lines = [
      'Mở hộp. Bóc seal. Nhấc nắp.',
      'Cảm giác kim loại lạnh trong tay.',
      'Màn hình sáng lên — và mọi thứ',
      'bắt đầu từ đây.',
      '',
      'Ghi chú tiếp theo:',
      '• Chụp ảnh studio',
      '• Cài đặt hình nền mới',
      '• Khám phá AURA Intelligence'
    ]
    lines.forEach((line, i) => ctx.fillText(line, 74, 424 + i * 52))
    this.hotspots.push({ x: 60, y: 1880, w: 250, h: 90, action: 'home' })
    this.texture.needsUpdate = true
  }

  drawBrowserApp() {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
    g.addColorStop(0, '#0a1115')
    g.addColorStop(1, '#0d171c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.statusBar()
    ctx.fillStyle = 'rgba(255,255,255,.08)'
    this.roundRect(58, 152, 908, 94, 47)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.42)'
    ctx.font = '400 24px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('aura.com/x1-pro', 106, 210)
    ctx.fillStyle = '#f1ede4'
    ctx.font = '300 62px Helvetica, Arial, sans-serif'
    ctx.fillText('AURA', 66, 380)
    ctx.fillStyle = '#c7a97c'
    ctx.font = '500 19px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '7px'
    ctx.fillText('THE NEW STANDARD', 70, 426)
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    ctx.font = '300 40px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '0px'
    ctx.fillText('Titanium.', 70, 548)
    ctx.fillText('Reimagined.', 70, 600)
    const card = ctx.createLinearGradient(60, 680, 960, 1420)
    card.addColorStop(0, '#7a6250')
    card.addColorStop(0.4, '#3f4650')
    card.addColorStop(1, '#14171d')
    ctx.fillStyle = card
    this.roundRect(60, 680, 904, 740, 40)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.16)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.7)'
    ctx.font = '400 28px Helvetica, Arial, sans-serif'
    ctx.fillText('Khám phá AURA X1 PRO', 106, 1350)
    ctx.fillStyle = 'rgba(255,255,255,.36)'
    ctx.font = '400 20px Helvetica, Arial, sans-serif'
    ctx.fillText('Từ 32.990.000 ₫', 106, 1390)
    this.hotspots.push({ x: 60, y: 1880, w: 250, h: 90, action: 'home' })
    this.texture.needsUpdate = true
  }

  drawClockApp() {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
    g.addColorStop(0, '#0a0b0f')
    g.addColorStop(1, '#13161c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.statusBar()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f2ede3'
    ctx.font = '200 210px Helvetica, Arial, sans-serif'
    ctx.fillText('09:41', SCREEN_W / 2, 560)
    ctx.fillStyle = 'rgba(255,255,255,.38)'
    ctx.font = '400 25px Helvetica, Arial, sans-serif'
    ctx.letterSpacing = '5px'
    ctx.fillText('THỨ BẢY  ·  31 THÁNG 10', SCREEN_W / 2, 624)
    ctx.strokeStyle = 'rgba(199,169,124,.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(SCREEN_W / 2, 1130, 260, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2 - Math.PI / 2
      const r1 = i % 5 === 0 ? 222 : 238
      ctx.beginPath()
      ctx.moveTo(SCREEN_W / 2 + Math.cos(a) * r1, 1130 + Math.sin(a) * r1)
      ctx.lineTo(SCREEN_W / 2 + Math.cos(a) * 252, 1130 + Math.sin(a) * 252)
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.2)'
      ctx.stroke()
    }
    const h = (9 + 41 / 60) / 12 * Math.PI * 2 - Math.PI / 2
    const m = 41 / 60 * Math.PI * 2 - Math.PI / 2
    ctx.strokeStyle = '#e8ddca'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(SCREEN_W / 2, 1130)
    ctx.lineTo(SCREEN_W / 2 + Math.cos(h) * 118, 1130 + Math.sin(h) * 118)
    ctx.stroke()
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(SCREEN_W / 2, 1130)
    ctx.lineTo(SCREEN_W / 2 + Math.cos(m) * 190, 1130 + Math.sin(m) * 190)
    ctx.stroke()
    ctx.fillStyle = '#c7a97c'
    ctx.beginPath()
    ctx.arc(SCREEN_W / 2, 1130, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.28)'
    ctx.font = '400 20px Helvetica, Arial, sans-serif'
    ctx.fillText('BÁO THỨC  ·  06:30', SCREEN_W / 2, 1600)
    this.hotspots.push({ x: 60, y: 1880, w: 250, h: 90, action: 'home' })
    this.texture.needsUpdate = true
  }

  drawWeatherApp() {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
    g.addColorStop(0, '#395d79')
    g.addColorStop(0.45, '#6e8f9f')
    g.addColorStop(1, '#1c2d38')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.statusBar()
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,.95)'
    ctx.font = '300 48px Helvetica, Arial, sans-serif'
    ctx.fillText('Hà Nội', SCREEN_W / 2, 210)
    ctx.font = '200 230px Helvetica, Arial, sans-serif'
    ctx.fillText('27°', SCREEN_W / 2, 540)
    ctx.font = '400 28px Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,.65)'
    ctx.fillText('Nhiều mây  ·  Cao 31°  ·  Thấp 23°', SCREEN_W / 2, 610)
    const days = [['T7', '27°', '☁'], ['CN', '28°', '☀'], ['T2', '26°', '☂'], ['T3', '27°', '☁'], ['T4', '29°', '☀']]
    days.forEach((d, i) => {
      const x = 74 + i * 180
      ctx.fillStyle = 'rgba(255,255,255,.1)'
      this.roundRect(x, 720, 148, 300, 28)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,.7)'
      ctx.font = '500 22px Helvetica, Arial, sans-serif'
      ctx.fillText(d[0], x + 74, 770)
      ctx.font = '400 52px Helvetica, Arial, sans-serif'
      ctx.fillText(d[2], x + 74, 872)
      ctx.font = '400 26px Helvetica, Arial, sans-serif'
      ctx.fillText(d[1], x + 74, 956)
    })
    this.hotspots.push({ x: 60, y: 1880, w: 250, h: 90, action: 'home' })
    this.texture.needsUpdate = true
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  pill(x, y, w, h, fill, stroke, r) {
    const ctx = this.ctx
    this.roundRect(x, y, w, h, r)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  button(x, y, w, h, label, active, action) {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(x, y, x + w, y + h)
    g.addColorStop(0, active ? '#ead7b7' : 'rgba(255,255,255,.12)')
    g.addColorStop(1, active ? '#b89363' : 'rgba(255,255,255,.06)')
    ctx.fillStyle = g
    this.roundRect(x, y, w, h, h / 2)
    ctx.fill()
    ctx.fillStyle = active ? '#17130e' : 'rgba(255,255,255,.5)'
    ctx.font = '600 24px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '4px'
    ctx.fillText(label, x + w / 2, y + h / 2 + 8)
    this.hotspots.push({ x, y, w, h, action })
  }

  hitTest(x, y) {
    for (const h of this.hotspots) {
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.action
    }
    return null
  }

  handle(action) {
    if (!action) return
    if (action.startsWith('lang:')) {
      this.setLanguage(action.split(':')[1])
      return
    }
    if (action.startsWith('wall:')) {
      this.setWallpaper(action.split(':')[1])
      return
    }
    if (action.startsWith('theme:')) {
      this.setTheme(action.split(':')[1])
      return
    }
    if (action === 'setup-next') {
      this.state = this.state === 'setup-lang' ? 'setup-wallpaper' : 'setup-theme'
      this.dirty = true
      return
    }
    if (action === 'setup-finish') {
      this.state = 'home'
      this.dirty = true
      this.onAction?.('setup-complete')
      return
    }
    if (action.startsWith('app:')) {
      const id = action.split(':')[1]
      if (id === 'phone' || id === 'messages') {
        this.state = 'app-notes'
      } else {
        this.state = `app-${id}`
      }
      this.dirty = true
      this.onAction?.(`open-${id}`)
      return
    }
    if (action === 'home') {
      this.state = 'home'
      this.dirty = true
      this.onAction?.('home')
      return
    }
    if (action === 'music-toggle') {
      this.musicPlaying = !this.musicPlaying
      this.dirty = true
      this.onAction?.('music-toggle')
      return
    }
    if (action === 'shutter') {
      this.onAction?.('screen-shutter')
      return
    }
    this.dirty = true
  }
}

export class Phone {
  constructor(config = {}, onScreenAction) {
    this.config = { ...PHONE_VARIANTS[0], ...config }
    this.group = new THREE.Group()
    this.group.name = 'phone'
    this.screen = new PhoneScreen(onScreenAction)
    this.brightness = 0
    this.reviewMode = false
    this.parts = {}
    this.hotspots = []
    this.film = null
    this.screenLight = null
    this.glare = null
    this.build()
  }

  build() {
    const c = this.config
    const f = FINISHES[c.finish] || FINISHES.graphite
    const fold = !!c.fold
    const w = fold ? 0.88 : 0.72
    const h = 1.56
    const d = fold ? 0.105 : 0.078
    this.w = w
    this.h = h
    this.d = d

    const metal = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(f.color).lerp(new THREE.Color('#ffffff'), 0.22),
      metalness: 0.96,
      roughness: 0.24,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.5
    })
    this.metalMaterial = metal

    const bodyGeo = new RoundedBoxGeometry(w, h, d, 8, Math.min(0.064, w * 0.1))
    const body = new THREE.Mesh(bodyGeo, metal)
    body.castShadow = true
    body.receiveShadow = true
    body.name = 'frame'
    body.userData.part = 'frame'
    this.group.add(body)
    this.parts.frame = body

    const backTex = createBackTexture(c.finish, c.short || 'X1 PRO')
    const glossy = c.finishType ? c.finishType === 'glass' : f.glass
    const backMat = new THREE.MeshPhysicalMaterial({
      map: backTex,
      color: 0xffffff,
      metalness: glossy ? 0.34 : 0.18,
      roughness: glossy ? 0.12 : 0.64,
      clearcoat: glossy ? 1 : 0.2,
      clearcoatRoughness: glossy ? 0.07 : 0.4,
      envMapIntensity: glossy ? 1.7 : 0.8
    })
    this.backMaterial = backMat
    const backGeo = new RoundedBoxGeometry(w - 0.024, h - 0.024, 0.016, 6, Math.min(0.055, w * 0.09))
    const back = new THREE.Mesh(backGeo, backMat)
    back.position.z = -d / 2 - 0.002
    back.castShadow = true
    back.receiveShadow = true
    back.name = 'back'
    back.userData.part = 'back'
    this.group.add(back)
    this.parts.back = back

    const bezelMat = new THREE.MeshPhysicalMaterial({
      color: 0x060608, metalness: 0.15, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03
    })
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(w - 0.012, h - 0.012, 0.014, 6, 0.05), bezelMat)
    bezel.position.z = d / 2 - 0.001
    bezel.castShadow = true
    bezel.receiveShadow = true
    bezel.userData.part = 'screen'
    this.group.add(bezel)
    this.parts.bezel = bezel

    const screenGeo = new THREE.PlaneGeometry(w - 0.064, h - 0.064)
    this.screenMaterial = new THREE.MeshBasicMaterial({
      map: this.screen.texture,
      toneMapped: false,
      color: 0xffffff
    })
    const screenMesh = new THREE.Mesh(screenGeo, this.screenMaterial)
    screenMesh.position.z = d / 2 + 0.008
    screenMesh.name = 'screen'
    screenMesh.userData.part = 'screen'
    screenMesh.userData.screen = true
    this.group.add(screenMesh)
    this.screenMesh = screenMesh
    this.parts.screen = screenMesh

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
      metalness: 0,
      roughness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.01,
      envMapIntensity: 2.2,
      depthWrite: false
    })
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.028, h - 0.028), glassMat)
    glass.position.z = d / 2 + 0.011
    glass.renderOrder = 2
    this.group.add(glass)
    this.screenGlass = glass

    this.createGlare(w, h, d)
    this.createCameraIsland(w, h, d, f)
    this.createButtons(w, h, d, f)
    this.createPorts(w, h, d)
    this.createScreenProtector(w, h, d)
    if (fold) this.createHinge(w, h, d, f)
    this.createHotspots(w, h, d)

    this.screenLight = new THREE.PointLight(new THREE.Color(f.accent), 0, 1.2, 2)
    this.screenLight.position.set(0, 0, d / 2 + 0.18)
    this.group.add(this.screenLight)

    this.group.userData.phone = this
    this.setScreenBrightness(0)
  }

  createGlare(w, h, d) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 256, 512)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.32, 'rgba(255,255,255,0)')
    g.addColorStop(0.46, 'rgba(255,255,255,.62)')
    g.addColorStop(0.52, 'rgba(255,255,255,.08)')
    g.addColorStop(0.7, 'rgba(255,255,255,0)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 512)
    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false
    })
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.65, h * 1.3), mat)
    glare.position.set(-w * 0.12, 0, d / 2 + 0.014)
    glare.rotation.z = -0.24
    glare.renderOrder = 4
    this.group.add(glare)
    this.glare = glare
  }

  createCameraIsland(w, h, d, f) {
    const c = this.config
    const islandW = c.camera === 4 ? 0.36 : c.camera === 2 ? 0.25 : 0.31
    const islandH = c.camera === 4 ? 0.4 : c.camera === 2 ? 0.26 : 0.38
    const x = -w / 2 + islandW / 2 + 0.065
    const y = h / 2 - islandH / 2 - 0.085
    const islandMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(f.color).lerp(new THREE.Color('#000000'), 0.22),
      metalness: 0.78,
      roughness: 0.2,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.4
    })
    const island = new THREE.Mesh(new RoundedBoxGeometry(islandW, islandH, 0.032, 6, 0.06), islandMat)
    island.position.set(x, y, -d / 2 - 0.018)
    island.castShadow = true
    island.receiveShadow = true
    island.userData.part = 'camera'
    island.name = 'camera-island'
    this.group.add(island)
    this.parts.camera = island

    const ringMat = new THREE.MeshPhysicalMaterial({
      color: 0x9c876d, metalness: 1, roughness: 0.17, envMapIntensity: 1.8
    })
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x060b13, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
      envMapIntensity: 2
    })
    const positions = c.camera === 4
      ? [[-0.082, 0.094], [0.082, 0.094], [-0.082, -0.094], [0.082, -0.094]]
      : c.camera === 2
        ? [[-0.058, 0.05], [0.058, -0.05]]
        : [[-0.076, 0.086], [0.076, 0.086], [-0.076, -0.086]]
    const lensGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.03, 40)
    const ringGeo = new THREE.TorusGeometry(0.052, 0.009, 12, 48)
    for (const [lx, ly] of positions) {
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.set(x + lx, y + ly, -d / 2 - 0.038)
      ring.castShadow = true
      this.group.add(ring)
      const lens = new THREE.Mesh(lensGeo, glassMat)
      lens.rotation.x = Math.PI / 2
      lens.position.set(x + lx, y + ly, -d / 2 - 0.04)
      this.group.add(lens)
      const highlight = new THREE.Mesh(
        new THREE.CircleGeometry(0.014, 24),
        new THREE.MeshBasicMaterial({ color: 0x7d9fc4, transparent: true, opacity: 0.7 })
      )
      highlight.position.set(x + lx - 0.012, y + ly + 0.014, -d / 2 - 0.057)
      highlight.rotation.y = Math.PI
      this.group.add(highlight)
    }
    if (c.camera >= 3) {
      const flash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.016, 28),
        new THREE.MeshPhysicalMaterial({ color: 0xf1e3c4, emissive: 0x7a6541, emissiveIntensity: 0.2, roughness: 0.22, metalness: 0.2 })
      )
      flash.rotation.x = Math.PI / 2
      flash.position.set(x + 0.1, y - 0.082, -d / 2 - 0.038)
      this.group.add(flash)
      const lidar = new THREE.Mesh(
        new THREE.CircleGeometry(0.019, 24),
        new THREE.MeshBasicMaterial({ color: 0x151820 })
      )
      lidar.position.set(x - 0.1, y - 0.082, -d / 2 - 0.04)
      lidar.rotation.y = Math.PI
      this.group.add(lidar)
    }
  }

  createButtons(w, h, d, f) {
    const buttonMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(f.color).lerp(new THREE.Color('#ffffff'), 0.14),
      metalness: 1,
      roughness: 0.26,
      envMapIntensity: 1.4
    })
    const power = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.16, 0.034, 4, 0.008), buttonMat)
    power.position.set(w / 2 + 0.005, 0.16, 0)
    power.userData.part = 'power'
    power.name = 'power-button'
    this.group.add(power)
    this.parts.power = power

    const powerHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.26, 0.13),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    )
    powerHit.position.copy(power.position)
    powerHit.userData.action = 'power'
    this.group.add(powerHit)
    this.powerHit = powerHit

    for (let i = 0; i < 2; i++) {
      const vol = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.115, 0.03, 4, 0.007), buttonMat)
      vol.position.set(w / 2 + 0.005, 0.39 - i * 0.135, 0)
      vol.userData.part = 'volume'
      this.group.add(vol)
      if (i === 0) this.parts.volume = vol
    }
    const action = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.075, 0.03, 4, 0.007), buttonMat)
    action.position.set(-w / 2 - 0.005, 0.3, 0)
    action.userData.part = 'action'
    this.group.add(action)
    this.parts.action = action
  }

  createPorts(w, h, d) {
    const dark = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.45, metalness: 0.4 })
    const port = new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.012, 0.036, 4, 0.006), dark)
    port.position.set(0, -h / 2 - 0.002, 0)
    port.rotation.x = Math.PI / 2
    port.userData.part = 'usb'
    port.name = 'usb-c'
    this.group.add(port)
    this.parts.usb = port
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x010102 })
    for (let i = 0; i < 6; i++) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.006, 10), holeMat)
      hole.position.set(0.19 + i * 0.026, -h / 2 - 0.004, 0)
      hole.rotation.x = -Math.PI / 2
      this.group.add(hole)
    }
    for (let i = 0; i < 4; i++) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.005, 10), holeMat)
      hole.position.set(-0.25 - i * 0.024, -h / 2 - 0.004, 0)
      hole.rotation.x = -Math.PI / 2
      this.group.add(hole)
    }
    const simTray = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.04), dark)
    simTray.position.set(-w / 2 - 0.004, 0.05, 0)
    this.group.add(simTray)
    this.parts.sim = simTray
  }

  createScreenProtector(w, h, d) {
    const group = new THREE.Group()
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xbfd7e8,
      metalness: 0.1,
      roughness: 0.04,
      transparent: true,
      opacity: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.8,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const film = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.032, h - 0.032), mat)
    film.position.z = d / 2 + 0.016
    film.userData.action = 'film'
    film.name = 'screen-protector'
    group.add(film)
    const tab = new THREE.Mesh(
      new THREE.PlaneGeometry(0.13, 0.11),
      new THREE.MeshBasicMaterial({ color: 0xe6d3ae, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    )
    tab.position.set(w * 0.3, h / 2 - 0.01, d / 2 + 0.018)
    tab.rotation.z = -0.18
    group.add(tab)
    group.userData.action = 'film'
    group.name = 'screen-film'
    this.group.add(group)
    this.film = group
    this.parts.film = group
    this.filmHome = group.position.clone()
    this.filmRotation = group.rotation.clone()
    this.filmOpacities = []
    group.traverse(o => {
      if (o.material && 'opacity' in o.material) {
        this.filmOpacities.push({ material: o.material, opacity: o.material.opacity })
      }
    })
  }

  createHinge(w, h, d, f) {
    const hingeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(f.color).lerp(new THREE.Color('#000000'), 0.18),
      metalness: 1, roughness: 0.3, envMapIntensity: 1.4
    })
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, h - 0.06, 24), hingeMat)
    hinge.position.set(0, 0, -d / 2 - 0.011)
    hinge.rotation.z = Math.PI / 2
    this.group.add(hinge)
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, h - 0.08, 0.002),
      new THREE.MeshBasicMaterial({ color: 0x050506 })
    )
    seam.position.set(0, 0, d / 2 + 0.016)
    this.group.add(seam)
  }

  createHotspots(w, h, d) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe4c795, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const spots = [
      { part: 'camera', p: [0, h * 0.3, -d / 2 - 0.07], label: 'Hệ thống camera' },
      { part: 'frame', p: [w / 2 + 0.02, -h * 0.1, 0], label: 'Khung titan' },
      { part: 'screen', p: [0, -h * 0.1, d / 2 + 0.03], label: 'Màn hình OLED' },
      { part: 'power', p: [w / 2 + 0.04, 0.16, 0], label: 'Nút nguồn' },
      { part: 'usb', p: [0, -h / 2 - 0.04, 0], label: 'Cổng USB-C' },
      { part: 'back', p: [w * 0.15, h * 0.1, -d / 2 - 0.03], label: 'Mặt lưng kính' }
    ]
    for (const spot of spots) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.034, 32), mat.clone())
      ring.position.set(...spot.p)
      ring.userData.hotspot = spot.part
      ring.userData.label = spot.label
      ring.visible = false
      this.group.add(ring)
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.01, 20), mat.clone())
      dot.position.set(...spot.p)
      dot.userData.hotspot = spot.part
      dot.visible = false
      this.group.add(dot)
      this.hotspots.push({ ring, dot, part: spot.part, label: spot.label })
    }
  }

  setReviewMode(on) {
    this.reviewMode = on
    for (const h of this.hotspots) {
      h.ring.visible = on
      h.dot.visible = on
    }
    if (!on) this.hotspots.forEach(h => {
      h.ring.material.opacity = 0
      h.dot.material.opacity = 0
    })
  }

  setScreenBrightness(v) {
    this.brightness = clamp(v)
    this.screenMaterial.color.setScalar(Math.max(0.02, this.brightness))
    this.screenLight.intensity = this.brightness * 0.55
    this.screenGlass.material.opacity = 0.05 + this.brightness * 0.06
    if (this.screenLight) this.screenLight.color.set(this.config.accent || '#c7a97c')
  }

  update(dt) {
    this.screen.update(dt)
    this.setScreenBrightness(this.screen.brightness)
    if (this.glare) {
      const t = performance.now() * 0.00018
      this.glare.position.x = Math.sin(t) * this.w * 0.32
      this.glare.material.opacity = this.screen.brightness * (0.045 + Math.sin(t * 1.7) * 0.025)
    }
    if (this.reviewMode) {
      const pulse = 0.35 + Math.sin(performance.now() * 0.004) * 0.2
      for (const h of this.hotspots) {
        h.ring.material.opacity = pulse
        h.dot.material.opacity = pulse
      }
    }
  }

  setConfig(config) {
    Object.assign(this.config, config)
    this.rebuild()
  }

  rebuild() {
    const old = this.group
    const parent = old.parent
    const pos = old.position.clone()
    const rot = old.rotation.clone()
    const scale = old.scale.clone()
    if (parent) parent.remove(old)
    this.parts = {}
    this.hotspots = []
    this.screenLight = null
    this.glare = null
    this.film = null
    this.group = new THREE.Group()
    this.group.name = 'phone'
    this.build()
    this.group.position.copy(pos)
    this.group.rotation.copy(rot)
    this.group.scale.copy(scale)
    if (parent) parent.add(this.group)
    this.group.userData.phone = this
    this.setScreenBrightness(this.screen.brightness)
  }

  setScreenState(state) {
    this.screen.state = state
    this.screen.dirty = true
  }

  powerOn() {
    this.screen.powerOn()
  }

  removeFilm() {
    if (!this.film) return
    this.film.visible = false
  }

  addFilmBack() {
    if (!this.film) return
    this.film.visible = true
    this.film.position.copy(this.filmHome)
    this.film.rotation.copy(this.filmRotation)
    for (const entry of this.filmOpacities || []) {
      entry.material.opacity = entry.opacity
      entry.material.transparent = true
    }
  }

  getScreenUV(point) {
    if (!this.screenMesh) return null
    const local = this.screenMesh.worldToLocal(point.clone())
    const w = this.w - 0.064
    const h = this.h - 0.064
    return {
      u: clamp(local.x / w + 0.5),
      v: clamp(local.y / h + 0.5)
    }
  }
}
