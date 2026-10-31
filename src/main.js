import './style.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { World } from './world.js'
import { Phone, PHONE_VARIANTS } from './phone.js'
import { ACCESSORY_DATA } from './accessories.js'
import { SoundEngine } from './audio.js'
import { clamp, lerp, damp, Tweens, easeOutCubic, easeInOutCubic, easeOutBack } from './utils.js'
import { FINISHES, shade } from './textures.js'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

const SCREEN_W = 1024
const SCREEN_H = 2048
const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || innerWidth < 780
const QUERY = new URLSearchParams(location.search)
const QUALITY_PARAM = QUERY.get('quality')
const SCALE_PARAM = parseFloat(QUERY.get('scale'))

const app = {
  started: false,
  stage: 0,
  mode: 'unboxing',
  revealReady: false,
  holding: false,
  holdProgress: 0,
  holdStart: 0,
  powerOn: false,
  inspectedId: null,
  inspectedItem: null,
  autoRotateItem: false,
  collected: new Set(),
  photos: [],
  quality: ['lite', 'performance', 'cinematic'].includes(QUALITY_PARAM)
    ? QUALITY_PARAM
    : (IS_MOBILE ? 'performance' : 'cinematic'),
  night: false,
  muted: false,
  variantId: 'x1',
  config: { ...PHONE_VARIANTS[0] },
  custom: null,
  preCameraMode: 'free',
  filter: 'none',
  infoCallback: null,
  infoSecondaryCallback: null,
  lastInteraction: performance.now(),
  busy: false,
  bootStarted: false
}

let renderer, world, phone, composer, bloomPass, bokehPass, smaaPass, grainPass, camera
let clock, tweens, raycaster, pointerNdc
const sound = new SoundEngine()
const cam = {
  theta: 0.42,
  phi: 0.79,
  radius: 3.65,
  dTheta: 0.42,
  dPhi: 0.79,
  dRadius: 3.65,
  target: new THREE.Vector3(0, 0.24, 0.02),
  dTarget: new THREE.Vector3(0, 0.24, 0.02)
}
const pointer = {
  active: new Map(),
  mode: null,
  downX: 0,
  downY: 0,
  lastX: 0,
  lastY: 0,
  moved: false,
  hit: null,
  sealSide: 1,
  lidStart: 0,
  startRadius: 0,
  pinchStart: 0,
  downTime: 0
}
let inspectionHalo
let toastTimer
let hoverThrottle = 0

const GUIDE_STEPS = [
  {
    title: 'Bóc niêm phong',
    text: 'Dùng ngón tay kéo một trong hai tem niêm phong trên hộp. Lớp seal sẽ bong ra chân thực — đây là bước không thể bỏ qua.',
    hint: 'KÉO TEM NIÊM PHONG LÊN',
    button: 'KÉO TEM ĐỂ TIẾP TỤC',
    disabled: true
  },
  {
    title: 'Mở nắp hộp',
    text: 'Đặt tay lên nắp hộp và kéo lên từ từ. Bạn sẽ cảm nhận được độ ma sát nhẹ giữa nắp và thân hộp.',
    hint: 'KÉO NẮP HỘP LÊN TỪ TỪ',
    button: 'NHẤC NẮP HỘP',
    disabled: true
  },
  {
    title: 'Khoảnh khắc ra mắt',
    text: 'Chiếc điện thoại đang hiện ra dưới ánh sáng studio. Hãy chiêm ngưỡng thiết kế trước khi tiếp tục.',
    hint: 'CHIÊM NGƯỠNG KHOẢNH KHẮC',
    button: 'KHÁM PHÁ ĐIỆN THOẠI',
    disabled: true
  },
  {
    title: 'Kiểm tra phụ kiện',
    text: 'Chạm vào từng món phụ kiện trong hộp để lấy ra, xoay 360° và kiểm tra chất liệu. Mọi món đều có hình dạng riêng.',
    hint: 'CHẠM VÀO TỪNG PHỤ KIỆN',
    button: 'KIỂM TRA NGUỒN',
    disabled: false
  },
  {
    title: 'Đánh thức thiết bị',
    text: 'Nhấn và giữ nút nguồn bên hông điện thoại — hoặc nút bên dưới — trong 1,5 giây để khởi động AURA OS.',
    hint: 'GIỮ NÚT NGUỒN 1,5 GIÂY',
    button: 'GIỮ NÚT NGUỒN',
    disabled: false
  },
  {
    title: 'Thiết lập ban đầu',
    text: 'Tương tác trực tiếp trên màn hình điện thoại: chọn ngôn ngữ, hình nền và giao diện yêu thích của bạn.',
    hint: 'CHỌN NGÔN NGỮ · HÌNH NỀN',
    button: 'CHỌN TRÊN MÀN HÌNH',
    disabled: true
  },
  {
    title: 'AURA đã sẵn sàng',
    text: 'Bạn đã hoàn thành toàn bộ nghi thức mở hộp. Tiếp tục khám phá tự do, đánh giá chi tiết hoặc chụp ảnh sản phẩm.',
    hint: 'TRẢI NGHIỆM ĐÃ SẴN SÀNG',
    button: 'KHÁM PHÁ TỰ DO',
    disabled: false
  }
]

const PART_DATA = {
  camera: {
    icon: '◉', kicker: 'CAMERA SYSTEM', title: 'AURA Fusion Camera',
    desc: 'Cụm camera được gia công từ một khối kim loại, tích hợp cảm biến 200MP, ống kính chống chói và lấy nét laser.',
    specs: [['Cảm biến', '200MP · 1/1.3"'], ['Khẩu độ', 'f/1.6'], ['Chống rung', 'OIS 3 trục'], ['Video', '8K 60fps']]
  },
  frame: {
    icon: '▭', kicker: 'CHASSIS', title: 'Khung titan cấp 5',
    desc: 'Khung titan nguyên khối được CNC chính xác, nhẹ hơn thép nhưng cứng hơn 30%. Các cạnh được vát kim cương thủ công.',
    specs: [['Vật liệu', 'Titan Grade 5'], ['Độ dày', '7.8 mm'], ['Chuẩn', 'IP68 · IP69'], ['Khối lượng', '198 g']]
  },
  screen: {
    icon: '▤', kicker: 'DISPLAY', title: 'AURA Vision OLED',
    desc: 'Màn hình LTPO OLED 6,8 inch với tần số quét thích ứng 1–120Hz, độ sáng đỉnh 2.600 nits và lớp phủ chống phản chiếu.',
    specs: [['Kích thước', '6.8 inch'], ['Độ phân giải', '1440 × 3120'], ['Tần số', '1–120Hz'], ['Độ sáng', '2600 nits']]
  },
  power: {
    icon: '⏻', kicker: 'CONTROLS', title: 'Nút nguồn & cảm biến',
    desc: 'Nút nguồn tích hợp cảm biến vân tay siêu âm, phản hồi xúc giác và khả năng kích hoạt trợ lý AURA chỉ với một lần chạm.',
    specs: [['Chất liệu', 'Titan phay xước'], ['Bảo mật', 'Vân tay siêu âm'], ['Haptic', 'X-axis linear'], ['Chức năng', 'Power · AURA AI']]
  },
  usb: {
    icon: '⌁', kicker: 'CONNECTIVITY', title: 'Cổng USB-C & loa',
    desc: 'Cổng USB-C 3.2 Gen 2 hỗ trợ sạc 45W, truyền dữ liệu tốc độ cao và xuất hình ảnh. Hệ loa stereo được tinh chỉnh bởi AURA Audio.',
    specs: [['Sạc', '45W PD 3.1'], ['Dữ liệu', '10Gbps'], ['Loa', 'Stereo · Dolby Atmos'], ['Phụ kiện', 'USB-C 1.5m']]
  },
  back: {
    icon: '◇', kicker: 'FINISH', title: 'Mặt lưng kính nano',
    desc: 'Mặt lưng kính cường lực phủ lớp nano mờ chống bám vân tay, tạo hiệu ứng chuyển màu nhẹ theo góc nhìn.',
    specs: [['Vật liệu', 'Kính cường lực'], ['Lớp phủ', 'Nano matte'], ['Màu', 'Titan Xám'], ['Chống bám', 'Fingerprint-free']]
  }
}

const CAMERA_FILTERS = {
  none: 'none',
  cinematic: 'contrast(1.12) saturate(0.82) sepia(0.13) brightness(0.94)',
  mono: 'grayscale(1) contrast(1.16) brightness(1.02)',
  warm: 'sepia(0.3) saturate(1.3) contrast(1.05) brightness(1.04)'
}

async function boot() {
  const timings = window.__auraTimings = {}
  let mark = performance.now()
  const lap = name => {
    const now = performance.now()
    timings[name] = Math.round(now - mark)
    mark = now
  }
  clock = new THREE.Clock()
  tweens = new Tweens()
  raycaster = new THREE.Raycaster()
  pointerNdc = new THREE.Vector2()
  setLoader(8, 'Đang khởi tạo WebGL…')
  await frameBreak()
  try {
    initRenderer()
    lap('renderer')
    setLoader(28, 'Đang dựng studio ánh sáng…')
    await frameBreak()
    world = new World(renderer)
    camera = world.camera
    lap('world')
    setLoader(55, 'Đang gia công hộp và phụ kiện…')
    await frameBreak()
    phone = new Phone(app.config, onScreenAction)
    placePhoneInsideBox()
    world.scene.add(phone.group)
    lap('phone')
    setLoader(76, 'Đang tạo vật liệu PBR và phản chiếu…')
    await frameBreak()
    initComposer()
    lap('composer')
    initInteraction()
    initUI()
    buildCollection()
    buildReviewGrid()
    syncCustomFromCurrent()
    lap('ui')
    setLoader(94, 'Đang căn chỉnh ánh sáng điện ảnh…')
    await frameBreak()
    world.updateCamera(innerWidth / innerHeight)
    updateCamera(1)
    if (renderer.compileAsync) await renderer.compileAsync(world.scene, camera)
    else renderer.compile(world.scene, camera)
    lap('compile')
    renderer.render(world.scene, camera)
    lap('firstFrame')
    setLoader(100, 'Sẵn sàng.')
    await new Promise(resolve => setTimeout(resolve, 420))
    $('#loading').classList.add('hidden')
    document.body.classList.add('loaded')
    if (import.meta.env.DEV) {
      window.__aura = {
        app, world, phone, camera, renderer,
        screenOf(object) {
          const v = new THREE.Vector3()
          object.getWorldPosition(v)
          v.project(camera)
          return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z }
        },
        sealScreen(side = 1) {
          const seal = world.box.seals.find(s => s.side === side)
          return seal ? this.screenOf(seal.front) : null
        },
        sealTopScreen(side = 1) {
          const seal = world.box.seals.find(s => s.side === side)
          return seal ? this.screenOf(seal.top) : null
        },
        lidScreen() { return this.screenOf(world.box.topPlane) },
        powerScreen() { return phone.powerHit ? this.screenOf(phone.powerHit) : null },
        info: () => ({
          stage: app.stage,
          mode: app.mode,
          quality: app.quality,
          revealReady: app.revealReady,
          powerOn: app.powerOn,
          sealProgress: world.box.seals.map(s => s.progress),
          lidOpen: world.box.lidOpen,
          lidVisible: world.box.lid.visible,
          phonePos: phone.group.position.toArray().map(n => +n.toFixed(3)),
          phoneRot: phone.group.rotation.toArray().slice(0, 3).map(n => +n.toFixed(3)),
          camPos: camera.position.toArray().map(n => +n.toFixed(3)),
          camTarget: cam.dTarget.toArray().map(n => +n.toFixed(3)),
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          timings: window.__auraTimings
        }),
        dev: {
          startExperience, completeSeal, completeLid, goToAccessories, goToPower,
          enterFree, enterCameraMode, setMode, openReview
        },
        settle(seconds = 8) {
          const steps = Math.ceil(seconds / 0.05)
          for (let i = 0; i < steps; i++) {
            tweens.update(0.05)
            updateCamera(0.05)
            world.update(0.05, clock.elapsedTime + i * 0.05)
            phone.update(0.05)
          }
          renderer.render(world.scene, camera)
        }
      }
    }
    animate()
  } catch (error) {
    console.error(error)
    $('#loaderCopy').textContent = 'Không thể khởi tạo 3D. Vui lòng thử trình duyệt khác.'
    $('#loaderCopy').style.color = '#e09a8f'
    setLoader(100, 'WebGL không khả dụng trên thiết bị này.')
  }
}

function setLoader(progress, copy) {
  const bar = $('#loaderProgress')
  if (bar) bar.style.width = `${progress}%`
  if (copy) $('#loaderCopy').textContent = copy
}

function frameBreak() {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30)))
}

function initRenderer() {
  const canvas = $('#scene')
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  })
  renderer.setSize(innerWidth, innerHeight)
  renderer.setPixelRatio(Math.min(devicePixelRatio, app.quality === 'cinematic' ? 1.8 : 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.04
  renderer.shadowMap.enabled = app.quality !== 'lite'
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.info.autoReset = false
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault()
    toast('WebGL đã bị gián đoạn. Đang thử khôi phục…')
  })
}

function initComposer() {
  composer = new EffectComposer(renderer)
  const renderPass = new RenderPass(world.scene, camera)
  composer.addPass(renderPass)

  bokehPass = new BokehPass(world.scene, camera, {
    focus: 3.0,
    aperture: 0.00008,
    maxblur: 0.006
  })
  composer.addPass(bokehPass)

  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.34, 0.55, 0.82)
  composer.addPass(bloomPass)

  smaaPass = new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio())
  composer.addPass(smaaPass)

  grainPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      time: { value: 0 },
      grainAmount: { value: 0.026 },
      vignetteAmount: { value: 0.38 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float time;
      uniform float grainAmount;
      uniform float vignetteAmount;
      varying vec2 vUv;
      float rand(vec2 co){ return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec4 color = texture2D(tDiffuse, vUv);
        float d = distance(vUv, vec2(0.5));
        float vig = smoothstep(0.92, 0.28, d);
        color.rgb *= mix(1.0, vig, vignetteAmount);
        float grain = rand(vUv * 1000.0 + fract(time) * 30.0) - 0.5;
        color.rgb += grain * grainAmount * (0.55 + 0.45 * (1.0 - color.rgb));
        gl_FragColor = color;
      }
    `
  })
  composer.addPass(grainPass)
  composer.addPass(new OutputPass())
  applyQuality()
  window.addEventListener('resize', onResize)
}

function applyQuality() {
  if (!renderer || !composer) return
  const cinematic = app.quality === 'cinematic'
  const lite = app.quality === 'lite'
  const ratio = Number.isFinite(SCALE_PARAM)
    ? clamp(SCALE_PARAM, 0.35, 2)
    : (lite ? 0.8 : Math.min(devicePixelRatio, cinematic ? 1.8 : 1.25))
  renderer.setPixelRatio(ratio)
  composer.setPixelRatio(ratio)
  composer.setSize(innerWidth, innerHeight)
  renderer.shadowMap.enabled = !lite
  if (world?.key) world.key.castShadow = !lite
  bokehPass.enabled = cinematic
  smaaPass.enabled = cinematic
  bloomPass.enabled = !lite
  bloomPass.strength = cinematic ? 0.36 : 0.24
  grainPass.uniforms.grainAmount.value = lite ? 0 : (cinematic ? 0.026 : 0.018)
  if (world?.key) {
    const size = lite ? 512 : cinematic ? 2048 : 1024
    world.key.shadow.mapSize.set(size, size)
    world.key.shadow.map?.dispose()
    world.key.shadow.map = null
  }
  world?.setQuality?.(app.quality)
  const label = $('.quality-btn span')
  if (label) label.textContent = lite ? 'LITE' : cinematic ? 'CINEMA' : 'PERFORM'
}

function onResize() {
  if (!renderer) return
  renderer.setSize(innerWidth, innerHeight)
  world.updateCamera(innerWidth / innerHeight)
  composer.setSize(innerWidth, innerHeight)
  smaaPass.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio())
}

function placePhoneInsideBox() {
  phone.group.position.set(0, 0.112, 0)
  phone.group.rotation.set(-Math.PI / 2, 0, 0)
  phone.group.scale.setScalar(1)
}

function updateCamera(dt) {
  if (!camera) return
  const damping = 1 - Math.exp(-7.5 * dt)
  cam.theta = lerp(cam.theta, cam.dTheta, damping)
  cam.phi = lerp(cam.phi, cam.dPhi, damping)
  cam.radius = lerp(cam.radius, cam.dRadius, damping)
  cam.target.lerp(cam.dTarget, damping)
  const sinPhi = Math.sin(cam.phi)
  camera.position.set(
    cam.target.x + cam.radius * sinPhi * Math.sin(cam.theta),
    cam.target.y + cam.radius * Math.cos(cam.phi),
    cam.target.z + cam.radius * sinPhi * Math.cos(cam.theta)
  )
  camera.lookAt(cam.target)
  if (bokehPass) {
    const focus = camera.position.distanceTo(cam.target)
    bokehPass.uniforms.focus.value = focus
  }
}

function moveCamera(pose, duration = 1.1, ease = easeInOutCubic) {
  const start = {
    theta: cam.dTheta,
    phi: cam.dPhi,
    radius: cam.dRadius,
    target: cam.dTarget.clone()
  }
  const endTarget = pose.target ? new THREE.Vector3(...pose.target) : start.target.clone()
  tweens.add({
    duration,
    ease,
    update: t => {
      cam.dTheta = lerp(start.theta, pose.theta ?? start.theta, t)
      cam.dPhi = lerp(start.phi, pose.phi ?? start.phi, t)
      cam.dRadius = lerp(start.radius, pose.radius ?? start.radius, t)
      cam.dTarget.lerpVectors(start.target, endTarget, t)
      cam.theta = cam.dTheta
      cam.phi = cam.dPhi
      cam.radius = cam.dRadius
      cam.target.copy(cam.dTarget)
    }
  })
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const elapsed = clock.elapsedTime
  tweens.update(dt)
  updateCamera(dt)
  world.update(dt, elapsed)
  phone.update(dt)
  updateHold(dt)
  updateInspection(dt)
  updateSparkleAmbient(elapsed)
  if (grainPass) grainPass.uniforms.time.value = elapsed
  if (app.quality === 'lite') renderer.render(world.scene, camera)
  else composer.render()
}

function updateSparkleAmbient(elapsed) {
  if (!world) return
  if (app.revealReady && app.stage === 2) {
    world.revealRing.rotation.z += 0.001
  }
}

function updateInspection(dt) {
  if (app.inspectedItem && app.autoRotateItem) {
    app.inspectedItem.rotation.y += dt * 0.55
    app.inspectedItem.position.y = app.inspectedItem.userData.inspectY + Math.sin(performance.now() * 0.0017) * 0.006
  }
  if (inspectionHalo && inspectionHalo.visible) {
    inspectionHalo.material.opacity = 0.22 + Math.sin(performance.now() * 0.0025) * 0.08
    inspectionHalo.rotation.z += dt * 0.18
  }
}

function initInteraction() {
  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', e => e.preventDefault())
  window.addEventListener('pointerup', () => { if (app.holding) endPowerHold() })
  canvas.addEventListener('pointerleave', () => { canvas.style.cursor = '' })
  window.addEventListener('keydown', onKeyDown)

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.2, 64),
    new THREE.MeshBasicMaterial({ color: 0xd8b98c, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.set(-0.8, 0.31, 0.72)
  halo.visible = false
  world.scene.add(halo)
  inspectionHalo = halo
}

function setRayFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointerNdc, camera)
}

function isObjectVisible(object) {
  let o = object
  while (o) {
    if (o.visible === false) return false
    o = o.parent
  }
  return true
}

function getHit(event) {
  setRayFromEvent(event)
  const targets = [world.box.group, phone.group, world.box.accessories.group]
  const hits = raycaster.intersectObjects(targets, true)
  for (const hit of hits) {
    if (!isObjectVisible(hit.object)) continue
    let o = hit.object
    while (o) {
      if (o.userData.action || o.userData.screen || o.userData.hotspot) {
        return {
          object: o,
          hit,
          action: o.userData.action,
          screen: o.userData.screen,
          hotspot: o.userData.hotspot,
          uv: hit.uv,
          point: hit.point
        }
      }
      o = o.parent
    }
  }
  return null
}

function canUseScreen() {
  if (!phone) return false
  if (app.mode === 'camera') return false
  if (phone.screen.state === 'off') return false
  return app.mode === 'free' || app.mode === 'review' || (app.mode === 'unboxing' && app.stage >= 5)
}

function onPointerDown(event) {
  if (!app.started) return
  sound.init()
  pointer.active.set(event.pointerId, { x: event.clientX, y: event.clientY })
  pointer.downX = pointer.lastX = event.clientX
  pointer.downY = pointer.lastY = event.clientY
  pointer.downTime = performance.now()
  pointer.moved = false
  pointer.hit = getHit(event)
  const hit = pointer.hit

  if (pointer.active.size === 2) {
    const pts = [...pointer.active.values()]
    pointer.pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    pointer.startRadius = cam.dRadius
    pointer.mode = 'pinch'
    renderer.domElement.setPointerCapture?.(event.pointerId)
    return
  }

  if (hit?.action === 'seal' && app.mode === 'unboxing' && app.stage === 0) {
    pointer.mode = 'seal'
    pointer.sealSide = hit.object.userData.side || 1
    pointer.sealStart = world.box.seals.find(s => s.side === pointer.sealSide)?.progress || 0
    sound.startPeel()
  } else if (hit?.action === 'lid' && app.mode === 'unboxing' && app.stage === 1) {
    pointer.mode = 'lid'
    pointer.lidStart = world.box.lidOpen
    sound.lid()
  } else if (hit?.action === 'power' && app.mode === 'unboxing' && app.stage === 4) {
    pointer.mode = 'power'
    beginPowerHold()
  } else if (hit?.action?.startsWith('accessory:') && (app.mode !== 'unboxing' || app.stage >= 3)) {
    pointer.mode = 'click'
  } else if (hit?.hotspot && app.mode === 'review') {
    pointer.mode = 'click'
  } else if (hit?.action === 'film' && phone.film?.visible) {
    pointer.mode = 'film'
  } else if (hit?.screen && canUseScreen()) {
    pointer.mode = 'screen'
  } else {
    pointer.mode = 'orbit'
    renderer.domElement.style.cursor = 'grabbing'
  }
  renderer.domElement.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event) {
  if (!app.started) return
  if (pointer.active.has(event.pointerId)) {
    pointer.active.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }
  const dx = event.clientX - pointer.lastX
  const dy = event.clientY - pointer.lastY
  const totalDx = event.clientX - pointer.downX
  const totalDy = event.clientY - pointer.downY
  if (Math.hypot(totalDx, totalDy) > 8) pointer.moved = true

  if (pointer.mode === 'pinch' && pointer.active.size >= 2) {
    const pts = [...pointer.active.values()]
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    if (pointer.pinchStart > 0) {
      cam.dRadius = clamp(pointer.startRadius * (pointer.pinchStart / dist), 1.35, 5.4)
    }
    return
  }

  if (pointer.mode === 'orbit') {
    cam.dTheta -= dx * 0.0052
    cam.dPhi = clamp(cam.dPhi - dy * 0.0045, 0.48, 1.36)
    renderer.domElement.style.cursor = 'grabbing'
    app.lastInteraction = performance.now()
  } else if (pointer.mode === 'screen' && Math.hypot(totalDx, totalDy) > 12) {
    pointer.mode = 'orbit'
    cam.dTheta -= totalDx * 0.004
    cam.dPhi = clamp(cam.dPhi - totalDy * 0.004, 0.48, 1.36)
  } else if (pointer.mode === 'seal') {
    const progress = clamp((-totalDy / 180) + Math.abs(totalDx) / 480)
    world.box.setSealProgress(progress, pointer.sealSide)
    sound.updatePeel(progress, totalDx / innerWidth)
    app.sealDrag = progress
    updateGuideProgress(progress)
  } else if (pointer.mode === 'lid') {
    const progress = clamp(pointer.lidStart + (-totalDy / 230))
    world.box.setLidProgress(progress)
    app.lidDrag = progress
    updateGuideProgress(progress)
    if (progress > 0.05) sound.lid()
  }

  pointer.lastX = event.clientX
  pointer.lastY = event.clientY

  if (pointer.mode === 'orbit' && !pointer.moved) {
    hoverThrottle += 1
    if (hoverThrottle % 4 === 0) updateHoverCursor(event)
  }
}

function updateHoverCursor(event) {
  const hit = getHit(event)
  let cursor = ''
  if (hit?.action === 'seal' && app.stage === 0) cursor = 'grab'
  else if (hit?.action === 'lid' && app.stage === 1) cursor = 'grab'
  else if (hit?.action === 'power' && app.stage === 4) cursor = 'pointer'
  else if (hit?.action?.startsWith('accessory:') && (app.mode !== 'unboxing' || app.stage >= 3)) cursor = 'pointer'
  else if (hit?.hotspot && app.mode === 'review') cursor = 'pointer'
  else if (hit?.screen && canUseScreen()) cursor = 'pointer'
  else if (hit?.action === 'film' && phone.film?.visible) cursor = 'pointer'
  renderer.domElement.style.cursor = cursor
}

function onPointerUp(event) {
  if (!app.started) return
  pointer.active.delete(event.pointerId)
  const mode = pointer.mode
  const hit = pointer.hit
  const moved = pointer.moved
  if (mode === 'seal') {
    sound.stopPeel()
    if (app.sealDrag > 0.34) completeSeal()
    else {
      const seal = world.box.seals.find(s => s.side === pointer.sealSide)
      const start = seal?.progress || 0
      tweens.add({
        duration: 0.35,
        ease: easeOutCubic,
        update: t => world.box.setSealProgress(lerp(start, 0, t), pointer.sealSide)
      })
      app.sealDrag = 0
      updateGuideProgress(0)
      toast('Kéo tem lên cao hơn để bóc niêm phong.')
    }
  } else if (mode === 'lid') {
    if (app.lidDrag > 0.44) completeLid()
    else {
      const start = world.box.lidOpen
      tweens.add({
        duration: 0.45,
        ease: easeOutCubic,
        update: t => world.box.setLidProgress(lerp(start, 0, t))
      })
      app.lidDrag = 0
      updateGuideProgress(0)
      toast('Kéo nắp hộp lên từ từ.')
    }
  } else if (mode === 'power') {
    endPowerHold()
  } else if (mode === 'film' && !moved) {
    peelFilm()
  } else if (mode === 'screen' && !moved) {
    handleScreenTap(hit)
  } else if (mode === 'click' && !moved) {
    handleClickHit(hit)
  } else if (mode === 'orbit') {
    renderer.domElement.style.cursor = ''
  }
  pointer.mode = null
  pointer.hit = null
  renderer.domElement.style.cursor = ''
}

function onWheel(event) {
  if (!app.started) return
  event.preventDefault()
  cam.dRadius = clamp(cam.dRadius * (1 + event.deltaY * 0.0011), 1.35, 5.4)
}

function handleScreenTap(hit) {
  if (!hit?.uv) return
  const x = hit.uv.x * SCREEN_W
  const y = (1 - hit.uv.y) * SCREEN_H
  const action = phone.screen.hitTest(x, y)
  if (action) {
    phone.screen.handle(action)
    sound.click()
    app.lastInteraction = performance.now()
  } else {
    toast('Chạm vào các lựa chọn trên màn hình.')
  }
}

function handleClickHit(hit) {
  if (!hit) return
  if (hit.action?.startsWith('accessory:')) {
    const id = hit.action.split(':')[1]
    inspectAccessory(id)
    return
  }
  if (hit.hotspot) {
    showPart(hit.hotspot)
  }
}

function completeSeal() {
  if (app.stage !== 0) return
  sound.stopPeel()
  sound.paper()
  const picked = pointer.sealSide === -1 ? -1 : 1
  const other = picked === 1 ? -1 : 1
  const pickedSeal = world.box.seals.find(s => s.side === picked)
  const otherSeal = world.box.seals.find(s => s.side === other)
  const p0 = pickedSeal?.progress || 0
  tweens.add({
    duration: 0.45,
    ease: easeOutCubic,
    update: t => world.box.setSealProgress(lerp(p0, 1, t), picked)
  })
  tweens.wait(0.12, () => {
    const p1 = otherSeal?.progress || 0
    tweens.add({
      duration: 0.55,
      ease: easeInOutCubic,
      update: t => world.box.setSealProgress(lerp(p1, 1, t), other)
    })
  })
  tweens.wait(0.55, () => {
    for (const seal of world.box.seals) {
      tweens.add({
        duration: 0.55,
        ease: easeInOutCubic,
        update: t => {
          seal.group.position.y = seal.homePosition.y + t * 0.32
          seal.group.rotation.z = t * 0.5 * seal.side
          seal.material.opacity = 0.97 * (1 - t)
          seal.top.material.opacity = 0.97 * (1 - t)
        },
        complete: () => { seal.group.visible = false }
      })
    }
  })
  app.stage = 1
  app.sealDrag = 1
  updateUI()
  toast('Niêm phong đã bóc. Bây giờ hãy nhấc nắp hộp.')
  moveCamera({ theta: 0.2, phi: 0.95, radius: 2.85, target: [0, 0.22, 0.05] }, 1.1)
}

function completeLid() {
  if (app.stage !== 1) return
  app.stage = 2
  app.revealReady = false
  app.busy = true
  updateUI()
  sound.paper()
  world.box.setLidProgress(1)
  moveCamera({ theta: 0.17, phi: 0.92, radius: 3.5, target: [0, 0.72, 0.04] }, 1.2)
  tweens.wait(0.35, () => {
    tweens.add({
      duration: 1.25,
      ease: easeInOutCubic,
      update: t => {
        world.box.lid.position.set(
          lerp(world.box.lidHome.x, 1.95, t),
          lerp(world.box.lidHome.y + 0.55, 1.7, t),
          lerp(world.box.lidHome.z + 0.12, -1.35, t)
        )
        world.box.lid.rotation.set(
          lerp(0.11, 0.62, t),
          lerp(0, -0.45, t),
          lerp(0.035, 0.42, t)
        )
      },
      complete: () => { world.box.lid.visible = false }
    })
  })
  sound.lid()
  tweens.wait(0.65, () => {
    world.setReveal(1)
    moveCamera({ theta: 0.05, phi: 0.93, radius: 2.7, target: [0, 0.72, 0.06] }, 2.0)
    tweens.add({
      duration: 1.5,
      ease: easeInOutCubic,
      update: t => {
        phone.group.position.y = lerp(0.112, 1.02, t)
        phone.group.position.z = lerp(0, 0.08, t)
      }
    })
    tweens.add({
      duration: 1.45,
      delay: 0.6,
      ease: easeInOutCubic,
      update: t => {
        phone.group.rotation.x = lerp(-Math.PI / 2, 0, t)
        phone.group.rotation.y = lerp(0, -0.16, t)
      },
      complete: () => {
        app.revealReady = true
        app.busy = false
        sound.sparkle()
        updateUI()
        toast('AURA X1 PRO đã xuất hiện. Chạm và kéo để xoay.')
        moveCamera({ theta: 0.15, phi: 0.97, radius: 2.5, target: [0, 0.86, 0.12] }, 1.4)
      }
    })
    tweens.add({
      duration: 2.2,
      update: t => world.setReveal(1 - t * 0.72)
    })
  })
}

function goToAccessories() {
  if (!app.revealReady || app.stage !== 2) return
  app.stage = 3
  app.busy = true
  updateUI()
  sound.swipe()
  world.box.revealAccessories()
  phone.group.rotation.set(0, -0.36, 0)
  tweens.add({
    duration: 1.35,
    ease: easeInOutCubic,
    update: t => {
      phone.group.position.set(lerp(0, 1.4, t), lerp(1.02, 1.0, t), lerp(0.08, 0.16, t))
    },
    complete: () => { app.busy = false }
  })
  moveCamera({ theta: 0.14, phi: 0.99, radius: 2.95, target: [0.36, 0.55, 0.12] }, 1.35)
  toast('8 phụ kiện đã lộ diện. Chạm vào từng món để kiểm tra.')
}

function goToPower() {
  if (app.stage !== 3) return
  closeInfo()
  app.stage = 4
  app.busy = true
  updateUI()
  if (phone.film?.visible) peelFilm(true)
  phone.group.rotation.set(0, 0.04, 0)
  tweens.add({
    duration: 1.4,
    ease: easeInOutCubic,
    update: t => {
      phone.group.position.set(lerp(1.4, 0, t), lerp(1.0, 0.95, t), lerp(0.16, 0.28, t))
    },
    complete: () => { app.busy = false; updateUI() }
  })
  moveCamera({ theta: 0.52, phi: 1.24, radius: 2.0, target: [0, 0.92, 0.26] }, 1.4)
  sound.swipe()
  toast('Giữ nút nguồn bên hông máy trong 1,5 giây.')
}

function beginPowerHold() {
  if (app.mode !== 'unboxing' || app.stage !== 4 || app.powerOn) return
  app.holding = true
  app.holdStart = performance.now()
  app.holdProgress = 0
  $('#holdPower').classList.add('visible')
  $('#holdRing').style.strokeDashoffset = '276'
  sound.click()
}

function endPowerHold() {
  if (!app.holding) return
  app.holding = false
  $('#holdPower').classList.remove('visible')
  if (app.holdProgress < 0.98) {
    app.holdProgress = 0
    $('#holdRing').style.strokeDashoffset = '276'
    toast('Giữ nút nguồn lâu hơn một chút.')
  }
}

function updateHold(dt) {
  if (!app.holding) return
  const elapsed = (performance.now() - app.holdStart) / 1000
  app.holdProgress = clamp(elapsed / 1.5)
  $('#holdRing').style.strokeDashoffset = `${276 * (1 - app.holdProgress)}`
  updateGuideProgress(app.holdProgress)
  if (app.holdProgress >= 1) completePowerHold()
}

function completePowerHold() {
  if (app.powerOn) return
  app.holding = false
  app.powerOn = true
  $('#holdPower').classList.remove('visible')
  $('#holdRing').style.strokeDashoffset = '0'
  phone.powerOn()
  sound.boot()
  flash()
  moveCamera({ theta: 0.06, phi: 1.18, radius: 2.35, target: [0, 0.95, 0.3] }, 1.6)
  updateUI()
  toast('AURA OS đang khởi động…')
}

function onScreenAction(action) {
  if (action === 'boot-start') {
    app.bootStarted = true
  } else if (action === 'boot-complete') {
    if (app.mode === 'unboxing' && app.stage === 4) {
      app.stage = 5
      updateUI()
      sound.success()
      moveCamera({ theta: 0.03, phi: 1.17, radius: 2.32, target: [0, 0.95, 0.3] }, 1.4)
      toast('Chọn ngôn ngữ và hình nền trên màn hình.')
    }
  } else if (action === 'setup-complete') {
    if (app.mode === 'unboxing' && app.stage === 5) {
      app.stage = 6
      app.revealReady = true
      updateUI()
      sound.success()
      sound.sparkle()
      world.setReveal(0.55)
      tweens.add({ duration: 2.2, update: t => world.setReveal(0.55 * (1 - t)) })
      moveCamera({ theta: 0.12, phi: 0.98, radius: 2.65, target: [0, 0.9, 0.16] }, 1.8)
      toast('Thiết lập hoàn tất. Chào mừng đến với AURA.')
    } else {
      toast('Thiết lập hoàn tất. Chào mừng đến với AURA.')
    }
  } else if (action === 'screen-shutter') {
    flash()
    sound.shutter()
    toast('Đã lưu ảnh vào AURA Photos.')
  } else if (action === 'open-camera') {
    toast('AURA Camera · 200MP · Sẵn sàng.')
  } else if (action === 'music-toggle') {
    toast(phone.screen.musicPlaying ? 'Đang phát: Neon Afterglow' : 'Đã tạm dừng nhạc.')
  } else if (action === 'home') {
    sound.click()
  }
}

function peelFilm(silent = false) {
  if (!phone.film?.visible) return
  const film = phone.film
  sound.paper()
  tweens.add({
    duration: 0.8,
    ease: easeOutCubic,
    update: t => {
      film.position.y = t * 0.25
      film.position.z = t * 0.1
      film.rotation.z = t * 0.35
      film.traverse(o => {
        if (o.material && 'opacity' in o.material) {
          o.material.transparent = true
          o.material.opacity = Math.max(0, 0.22 * (1 - t))
        }
      })
    },
    complete: () => {
      phone.removeFilm()
      if (!silent) toast('Đã bóc lớp dán bảo vệ màn hình.')
    }
  })
}

function inspectAccessory(id) {
  const item = world.box.accessories.get(id)
  if (!item) return
  if (app.inspectedItem === item) {
    returnInspected()
    return
  }
  if (app.inspectedItem) returnInspected(true)
  const meta = item.userData.meta
  app.collected.add(id)
  app.inspectedId = id
  app.inspectedItem = item
  app.autoRotateItem = false
  const home = item.userData.home
  const homeScale = item.userData.homeScale
  const targetLocal = world.box.accessories.group.worldToLocal(new THREE.Vector3(-0.8, 0.36, 0.74))
  item.userData.inspectY = targetLocal.y
  item.userData.inspectScale = homeScale * 2.5
  tweens.add({
    duration: 0.85,
    ease: easeInOutCubic,
    update: t => {
      item.position.lerpVectors(home, targetLocal, t)
      item.scale.setScalar(lerp(homeScale, item.userData.inspectScale, t))
      item.rotation.x = lerp(0, -0.06, t)
      item.rotation.y = lerp(item.userData.homeRotation.y, 0.4, t)
    }
  })
  moveCamera({ theta: 0.1, phi: 1.05, radius: 1.55, target: [-0.72, 0.35, 0.7] }, 1.0)
  inspectionHalo.visible = true
  inspectionHalo.position.set(-0.8, 0.335, 0.74)
  inspectionHalo.scale.setScalar(1.1)
  showInfo({
    icon: meta.icon,
    kicker: 'PHỤ KIỆN TRONG HỘP',
    title: meta.name,
    desc: meta.desc,
    specs: [['Vật liệu', meta.material], ['Tình trạng', 'Mới · Nguyên seal'], ['Bảo hành', '24 tháng'], ['Trong hộp', 'Có']],
    primary: 'TRẢ VỀ HỘP',
    secondary: 'XOAY 360°',
    onPrimary: () => returnInspected(),
    onSecondary: () => {
      app.autoRotateItem = !app.autoRotateItem
      $('#infoSecondary').textContent = app.autoRotateItem ? 'DỪNG XOAY' : 'XOAY 360°'
    }
  })
  sound.paper()
  sound.click()
  updateInventoryCount()
  toast(`Đã thêm ${meta.short} vào túi đồ.`)
}

function returnInspected(silent = false) {
  const item = app.inspectedItem
  if (!item) return
  const home = item.userData.home
  const homeScale = item.userData.homeScale
  const startPos = item.position.clone()
  const startScale = item.scale.x
  const startRot = item.rotation.clone()
  app.inspectedItem = null
  app.inspectedId = null
  app.autoRotateItem = false
  inspectionHalo.visible = false
  closeInfo()
  tweens.add({
    duration: 0.7,
    ease: easeInOutCubic,
    update: t => {
      item.position.lerpVectors(startPos, home, t)
      item.scale.setScalar(lerp(startScale, homeScale, t))
      item.rotation.set(lerp(startRot.x, item.userData.homeRotation.x, t), lerp(startRot.y, item.userData.homeRotation.y, t), lerp(startRot.z, item.userData.homeRotation.z, t))
    }
  })
  if (app.mode === 'unboxing' && app.stage === 3) {
    moveCamera({ theta: 0.14, phi: 0.99, radius: 2.95, target: [0.36, 0.55, 0.12] }, 0.9)
  } else {
    moveCamera({ theta: 0.15, phi: 0.98, radius: 2.9, target: [0.3, 0.62, 0.16] }, 0.9)
  }
  if (!silent) toast('Đã trả phụ kiện về hộp.')
}

function showInfo({ icon, kicker, title, desc, specs, primary, secondary, onPrimary, onSecondary }) {
  $('#infoIcon').textContent = icon || '◇'
  $('#infoKicker').textContent = kicker || 'CHI TIẾT'
  $('#infoTitle').textContent = title || ''
  $('#infoDesc').textContent = desc || ''
  $('#infoSpecs').innerHTML = (specs || []).map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('')
  $('#infoPrimary').textContent = primary || 'ĐÓNG'
  const sec = $('#infoSecondary')
  if (secondary) {
    sec.style.display = ''
    sec.textContent = secondary
  } else {
    sec.style.display = 'none'
  }
  app.infoCallback = onPrimary || closeInfo
  app.infoSecondaryCallback = onSecondary || null
  $('#infoPanel').classList.add('visible')
  document.body.classList.add('info-open')
}

function closeInfo() {
  $('#infoPanel').classList.remove('visible')
  document.body.classList.remove('info-open')
  app.infoCallback = null
  app.infoSecondaryCallback = null
}

function showPart(part) {
  const data = PART_DATA[part]
  if (!data) return
  if (app.inspectedItem) returnInspected(true)
  closeModal()
  showInfo({
    icon: data.icon,
    kicker: data.kicker,
    title: data.title,
    desc: data.desc,
    specs: data.specs,
    primary: 'ĐÓNG',
    secondary: null,
    onPrimary: closeInfo
  })
  if (app.mode !== 'review') {
    app.mode = 'review'
    phone.setReviewMode(true)
    updateModeRail()
  }
  moveCamera({ theta: 0.55, phi: 1.15, radius: 2.15, target: [0, 0.9, 0.12] }, 1.1)
  sound.click()
}

function initUI() {
  $('#startExperience').addEventListener('click', () => startExperience('unboxing'))
  $('#startFree').addEventListener('click', () => startExperience('free'))
  $$('.mode-btn').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)))
  $('#soundToggle').addEventListener('click', toggleSound)
  $('#nightToggle').addEventListener('click', toggleNight)
  $('#qualityToggle').addEventListener('click', toggleQuality)
  $('#fullscreenToggle').addEventListener('click', toggleFullscreen)
  $('#resetTop').addEventListener('click', resetExperience)
  $('#resetBtn').addEventListener('click', resetExperience)
  $('#nextBtn').addEventListener('click', handleNext)
  $('#primaryAction').addEventListener('click', handlePrimaryClick)
  $('#primaryAction').addEventListener('pointerdown', e => {
    if (app.mode === 'unboxing' && app.stage === 4) {
      e.preventDefault()
      beginPowerHold()
    }
  })
  $('#primaryAction').addEventListener('pointerup', e => {
    if (app.mode === 'unboxing' && app.stage === 4) {
      e.preventDefault()
      endPowerHold()
    }
  })
  $('#inventoryBtn').addEventListener('click', openInventory)
  $('#infoClose').addEventListener('click', () => {
    if (app.inspectedItem) returnInspected()
    else closeInfo()
  })
  $('#infoPrimary').addEventListener('click', () => {
    const cb = app.infoCallback
    if (cb) cb()
    else closeInfo()
  })
  $('#infoSecondary').addEventListener('click', () => {
    if (app.infoSecondaryCallback) app.infoSecondaryCallback()
  })
  $('#holdPower').addEventListener('pointerdown', e => {
    e.preventDefault()
    e.stopPropagation()
    beginPowerHold()
  })
  $('#holdPower').addEventListener('pointerup', e => {
    e.preventDefault()
    e.stopPropagation()
    endPowerHold()
  })
  $$('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal))
  $('#collectionCustom').addEventListener('click', () => {
    closeModal()
    syncCustomFromCurrent()
    openModal('custom')
    app.mode = 'custom'
    updateModeRail()
    updateUI()
  })
  $('#applyCustom').addEventListener('click', applyCustom)
  $('#cameraExit').addEventListener('click', exitCameraMode)
  $('#shutterBtn').addEventListener('click', capturePhoto)
  $('#galleryBtn').addEventListener('click', openGallery)
  $('#zoomRange').addEventListener('input', e => {
    cam.dRadius = lerp(3.7, 1.65, (Number(e.target.value) - 35) / 95)
  })
  $$('.filter-chip').forEach(btn => btn.addEventListener('click', () => setCameraFilter(btn.dataset.filter)))
  buildFinishSwatches()
  buildCustomSegments()
  updateUI()
}

async function startExperience(mode) {
  if (app.started) return
  app.started = true
  document.body.classList.add('started')
  sound.init()
  sound.thud()
  if (mode === 'free') {
    await sleep(250)
    enterFree(true)
  } else {
    moveCamera({ theta: 0.2, phi: 0.94, radius: 3.02, target: [0, 0.23, 0.02] }, 1.7)
    app.stage = 0
    app.mode = 'unboxing'
    updateUI()
    updateModeRail()
    toast('Chạm và kéo tem niêm phong để bắt đầu.')
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function handleNext() {
  if (app.mode === 'unboxing') {
    if (app.stage === 2 && app.revealReady) goToAccessories()
    else if (app.stage === 3) goToPower()
    else if (app.stage === 6) enterFree()
  } else if (app.mode === 'free') {
    enterCameraMode()
  } else if (app.mode === 'review') {
    openReview()
  }
}

function handlePrimaryClick() {
  if (app.mode === 'unboxing') {
    if (app.stage === 4) return
    if (app.stage === 2 && app.revealReady) goToAccessories()
    else if (app.stage === 3) goToPower()
    else if (app.stage === 6) enterFree()
  } else if (app.mode === 'free') {
    enterCameraMode()
  } else if (app.mode === 'review') {
    openReview()
  }
}

function setMode(mode) {
  if (mode === app.mode && mode !== 'collection' && mode !== 'custom') {
    if (mode === 'review') openReview()
    if (mode === 'camera') enterCameraMode()
    return
  }
  if (mode === 'unboxing') {
    if (app.stage >= 6 || app.mode !== 'unboxing') {
      resetExperience()
      app.mode = 'unboxing'
      updateModeRail()
      updateUI()
      toast('Bắt đầu lại nghi thức mở hộp.')
    }
    return
  }
  if (mode === 'free') {
    enterFree()
    return
  }
  if (mode === 'collection') {
    enterFree(true, true)
    app.mode = 'collection'
    updateModeRail()
    updateUI()
    buildCollection()
    openModal('collection')
    sound.click()
    return
  }
  if (mode === 'review') {
    enterFree(true, true)
    app.mode = 'review'
    updateModeRail()
    phone.setReviewMode(true)
    updateUI()
    openReview()
    moveCamera({ theta: 0.52, phi: 1.14, radius: 2.25, target: [0, 0.9, 0.12] }, 1.1)
    return
  }
  if (mode === 'camera') {
    enterCameraMode()
    return
  }
  if (mode === 'custom') {
    enterFree(true, true)
    app.mode = 'custom'
    updateModeRail()
    syncCustomFromCurrent()
    openModal('custom')
    updateUI()
    return
  }
}

function updateModeRail() {
  $$('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === app.mode))
}

function updateUI() {
  if (!phone) return
  updateModeRail()
  updateSteps()
  updateGuide()
  const holdVisible = app.mode === 'unboxing' && app.stage === 4 && !app.powerOn
  $('#holdPower').classList.toggle('visible', holdVisible)
  const nextDisabled = !(app.mode === 'unboxing' && ((app.stage === 2 && app.revealReady) || app.stage === 3 || app.stage === 6)) && !(app.mode === 'free') && !(app.mode === 'review')
  $('#nextBtn').disabled = nextDisabled
  updateInventoryCount()
}

function updateSteps() {
  const steps = $$('.step')
  let activeIndex = -1
  if (app.mode === 'unboxing') {
    if (app.stage < 6) activeIndex = app.stage
    else activeIndex = 5
  }
  steps.forEach((el, i) => {
    el.classList.remove('active', 'done')
    if (app.mode !== 'unboxing') {
      if (app.stage >= 6) el.classList.add('done')
    } else if (i < activeIndex || app.stage >= 6) el.classList.add('done')
    else if (i === activeIndex) el.classList.add('active')
  })
}

function setGuide({ step, kicker, title, text, hint, button, disabled, progress, timer }) {
  $('#guideStep').textContent = step
  $('#guideKicker').textContent = kicker
  $('#guideTitle').textContent = title
  $('#guideText').textContent = text
  $('#guideHint').querySelector('span').textContent = hint
  $('#guideHint').classList.toggle('done', !!disabled && progress >= 100)
  $('#primaryAction').querySelector('span').textContent = button
  $('#primaryAction').disabled = !!disabled
  $('#guideProgressBar').style.width = `${clamp(progress ?? 0, 0, 100)}%`
  $('#guideTimer').textContent = timer || 'UNBOXING'
}

function updateGuide() {
  if (app.mode === 'free') {
    setGuide({
      step: '∞', kicker: 'FREE MODE', title: 'Tự do khám phá',
      text: 'Xoay camera 360°, phóng to để soi từng chi tiết, chạm vào phụ kiện hoặc màn hình điện thoại để tương tác.',
      hint: 'KÉO ĐỂ XOAY · CUỘN ĐỂ ZOOM', button: 'MỞ CAMERA MODE', disabled: false, progress: 100, timer: 'FREE ROAM'
    })
    $('#guideHint').classList.add('done')
    return
  }
  if (app.mode === 'review') {
    setGuide({
      step: '04', kicker: 'REVIEW MODE', title: 'Đánh giá từng chi tiết',
      text: 'Chạm vào các điểm sáng trên điện thoại hoặc mở danh sách bộ phận để xem cấu tạo, vật liệu và thông số.',
      hint: 'CHẠM VÀO ĐIỂM SÁNG', button: 'CHỌN BỘ PHẬN', disabled: false, progress: 100, timer: 'INSPECTION'
    })
    return
  }
  if (app.mode === 'collection') {
    setGuide({
      step: '03', kicker: 'COLLECTION MODE', title: 'Bộ sưu tập AURA',
      text: 'Chọn một trong sáu dòng smartphone để đưa vào studio. Mỗi mẫu có thiết kế, cấu hình và cá tính riêng.',
      hint: 'CHỌN MẪU ĐỂ TRƯNG BÀY', button: 'MỞ BỘ SƯU TẬP', disabled: false, progress: 100, timer: 'COLLECTION'
    })
    return
  }
  if (app.mode === 'custom') {
    setGuide({
      step: '06', kicker: 'CUSTOM MODE', title: 'Thiết kế của riêng bạn',
      text: 'Thay đổi màu sắc, chất liệu, bộ nhớ, cụm camera và cả màu hộp. Mọi thay đổi được áp dụng trực tiếp vào 3D.',
      hint: 'TÙY BIẾN MỌI CHI TIẾT', button: 'MỞ XƯỞNG THIẾT KẾ', disabled: false, progress: 100, timer: 'CUSTOM LAB'
    })
    return
  }
  const base = GUIDE_STEPS[Math.min(app.stage, 6)]
  const stepNum = String(Math.min(app.stage + 1, 6)).padStart(2, '0')
  let progress = 0
  let disabled = base.disabled
  let hint = base.hint
  let button = base.button
  if (app.stage === 0) progress = (app.sealDrag || 0) * 100
  if (app.stage === 1) progress = (app.lidDrag || 0) * 100
  if (app.stage === 2) {
    progress = app.revealReady ? 100 : 35
    disabled = !app.revealReady
    hint = app.revealReady ? 'CHIÊM NGƯỠNG KHOẢNH KHẮC' : 'ĐANG MỞ HỘP…'
    button = app.revealReady ? base.button : 'ĐANG MỞ HỘP…'
  }
  if (app.stage === 3) {
    progress = (app.collected.size / 8) * 100
    disabled = false
    hint = `${app.collected.size} / 8 PHỤ KIỆN ĐÃ KIỂM TRA`
  }
  if (app.stage === 4) {
    progress = (app.holdProgress || 0) * 100
    disabled = app.powerOn
    button = app.powerOn ? 'ĐANG KHỞI ĐỘNG…' : base.button
    hint = app.powerOn ? 'AURA OS ĐANG KHỞI ĐỘNG' : base.hint
  }
  if (app.stage === 5) {
    progress = 100
    disabled = true
    hint = 'CHỌN NGÔN NGỮ · HÌNH NỀN · GIAO DIỆN'
  }
  if (app.stage === 6) {
    progress = 100
    disabled = false
    hint = base.hint
  }
  setGuide({
    step: stepNum, kicker: 'UNBOXING MODE', title: base.title, text: base.text,
    hint, button, disabled, progress, timer: `BƯỚC ${stepNum} / 06`
  })
  if (app.stage >= 6) $('#guideHint').classList.add('done')
}

function updateGuideProgress(value) {
  $('#guideProgressBar').style.width = `${clamp(value * 100, 0, 100)}%`
  if (app.stage === 3) $('#guideHint').querySelector('span').textContent = `${app.collected.size} / 8 PHỤ KIỆN ĐÃ KIỂM TRA`
}

function enterFree(fromMode = false, quiet = false) {
  if (app.inspectedItem) returnInspected(true)
  closeInfo()
  closeModal()
  app.mode = 'free'
  app.stage = 6
  app.revealReady = true
  app.busy = false
  phone.setReviewMode(false)
  ensureBoxOpen()
  world.box.revealAccessories()
  phone.group.rotation.set(0, -0.36, 0)
  phone.group.position.set(1.4, 1.0, 0.16)
  if (phone.screen.state === 'off') {
    phone.screen.state = 'home'
    phone.screen.brightness = 1
    phone.screen.dirty = true
    phone.setScreenBrightness(1)
  }
  if (phone.film?.visible) phone.removeFilm()
  inspectionHalo.visible = false
  moveCamera({ theta: 0.15, phi: 0.98, radius: 2.95, target: [0.32, 0.58, 0.16] }, 1.25)
  updateModeRail()
  updateUI()
  if (!quiet) {
    sound.swipe()
    toast('FREE MODE · Xoay, zoom và chạm để khám phá.')
  }
}

function ensureBoxOpen() {
  if (!world?.box) return
  for (const seal of world.box.seals) seal.group.visible = false
  world.box.setLidProgress(1)
  world.box.lid.visible = false
  world.box.lid.position.set(1.95, 1.7, -1.35)
  world.box.revealAccessories()
}

function enterCameraMode() {
  if (app.mode !== 'camera') app.preCameraMode = app.mode
  enterFree(true, true)
  app.mode = 'camera'
  document.body.classList.add('camera-mode')
  updateModeRail()
  updateUI()
  setCameraFilter(app.filter)
  phone.group.position.set(1.15, 0.98, 0.1)
  phone.group.rotation.set(0, -0.22, 0)
  moveCamera({ theta: 0.18, phi: 1.0, radius: 2.85, target: [0.34, 0.62, 0.1] }, 1.2)
  updateCameraCount()
  toast('CAMERA MODE · Chạm nút tròn để chụp.')
  sound.click()
}

function exitCameraMode() {
  document.body.classList.remove('camera-mode')
  renderer.domElement.style.filter = 'none'
  app.mode = app.preCameraMode === 'camera' ? 'free' : app.preCameraMode
  if (app.mode === 'unboxing' && app.stage < 6) {
    app.mode = 'free'
    app.stage = 6
  }
  enterFree(true, true)
  updateModeRail()
  updateUI()
}

function setCameraFilter(filter) {
  app.filter = filter
  $$('.filter-chip').forEach(b => b.classList.toggle('active', b.dataset.filter === filter))
  renderer.domElement.style.filter = CAMERA_FILTERS[filter] || 'none'
}

function capturePhoto() {
  if (app.mode !== 'camera') return
  flash()
  sound.shutter()
  try {
    composer.render()
    const source = renderer.domElement
    const maxW = 900
    const scale = Math.min(1, maxW / source.width)
    const out = document.createElement('canvas')
    out.width = Math.round(source.width * scale)
    out.height = Math.round(source.height * scale)
    const ctx = out.getContext('2d')
    ctx.filter = CAMERA_FILTERS[app.filter] || 'none'
    ctx.drawImage(source, 0, 0, out.width, out.height)
    const data = out.toDataURL('image/jpeg', 0.9)
    app.photos.unshift(data)
    if (app.photos.length > 12) app.photos.pop()
    updateCameraCount()
    updateGallery()
    toast('Đã lưu ảnh vào AURA Gallery.')
  } catch (error) {
    console.error(error)
    toast('Không thể chụp ảnh trên thiết bị này.')
  }
}

function updateCameraCount() {
  $('#cameraCounter').textContent = String(app.photos.length).padStart(2, '0')
  const strip = $('#galleryStrip')
  strip.innerHTML = app.photos.slice(0, 3).map(src => `<img src="${src}" alt="Ảnh đã chụp" />`).join('')
}

function updateGallery() {
  const grid = $('#galleryGrid')
  if (!app.photos.length) {
    grid.innerHTML = '<div class="gallery-empty">Chưa có ảnh nào. Vào CAMERA MODE và nhấn nút chụp.</div>'
    return
  }
  grid.innerHTML = app.photos.map(src => `<img src="${src}" alt="Ảnh chụp sản phẩm" />`).join('')
}

function openGallery() {
  updateGallery()
  openModal('gallery')
}

function openReview() {
  buildReviewGrid()
  openModal('review')
  phone.setReviewMode(true)
  app.mode = 'review'
  updateModeRail()
  updateUI()
  moveCamera({ theta: 0.52, phi: 1.14, radius: 2.25, target: [0, 0.9, 0.12] }, 1.0)
  sound.click()
}

function buildReviewGrid() {
  const grid = $('#reviewGrid')
  const entries = Object.entries(PART_DATA)
  grid.innerHTML = entries.map(([key, p]) => `
    <button class="review-item" data-part="${key}">
      <span>${p.icon}</span>
      <strong>${p.title}</strong>
      <small>${p.kicker}</small>
    </button>
  `).join('')
  $$('.review-item', grid).forEach(btn => {
    btn.addEventListener('click', () => {
      showPart(btn.dataset.part)
    })
  })
}

function buildCollection() {
  const grid = $('#collectionGrid')
  grid.innerHTML = PHONE_VARIANTS.map(v => {
    const f = FINISHES[v.finish] || FINISHES.graphite
    return `
      <button class="collection-card ${v.id === app.variantId ? 'selected' : ''}" data-variant="${v.id}">
        ${v.id === app.variantId ? '<span class="cc-check">✓</span>' : ''}
        <div class="cc-swatch" style="--c1:${shade(f.color, 36)};--c2:${f.color}"></div>
        <div class="cc-tier">${v.tier}</div>
        <h3>${v.name}</h3>
        <p>${v.ram} · ${v.storage} · ${v.camera} camera</p>
        <div class="cc-price">${v.price}</div>
      </button>
    `
  }).join('')
  $$('.collection-card', grid).forEach(card => {
    card.addEventListener('click', () => selectVariant(card.dataset.variant))
  })
}

function selectVariant(id) {
  const variant = PHONE_VARIANTS.find(v => v.id === id)
  if (!variant) return
  app.variantId = id
  app.config = { ...variant }
  phone.setConfig(app.config)
  applyVariantToScene(variant)
  closeModal()
  enterFree(true, true)
  buildCollection()
  sound.success()
  toast(`${variant.name} đã được đưa vào studio.`)
}

function applyVariantToScene(variant) {
  const f = FINISHES[variant.finish] || FINISHES.graphite
  world.box.setStyle({
    finish: variant.finish,
    model: variant.name,
    short: variant.short,
    boxColor: '#0b0c10',
    accent: f.accent
  })
  phone.screen.setWallpaper(variant.id === 'play' ? 'ember' : variant.id === 'fold' ? 'dunes' : 'aurora')
  app.config = { ...variant }
  syncCustomFromCurrent()
}

function buildFinishSwatches() {
  const wrap = $('#finishSwatches')
  wrap.innerHTML = Object.entries(FINISHES).map(([key, f]) => `
    <button class="swatch ${key === app.config.finish ? 'active' : ''}" data-finish="${key}" style="background:linear-gradient(145deg, ${shade(f.color, 38)}, ${f.color} 55%, ${shade(f.color, -28)})" title="${f.name}"></button>
  `).join('')
  $$('.swatch', wrap).forEach(btn => btn.addEventListener('click', () => {
    const finish = btn.dataset.finish
    app.custom.finish = finish
    app.custom.accent = FINISHES[finish].accent
    $$('.swatch', wrap).forEach(b => b.classList.toggle('active', b.dataset.finish === finish))
    updateCustomPreview()
  }))
}

function buildCustomSegments() {
  const bind = (id, key, parser = v => v) => {
    const root = $('#' + id)
    if (!root) return
    $$('button', root).forEach(btn => btn.addEventListener('click', () => {
      $$('button', root).forEach(b => b.classList.toggle('active', b === btn))
      app.custom[key] = parser(btn.dataset.value)
      updateCustomPreview()
    }))
  }
  bind('finishType', 'finishType')
  bind('ramSelect', 'ram')
  bind('storageSelect', 'storage')
  bind('cameraSelect', 'camera', Number)
  bind('foldSelect', 'fold', v => v === 'true')
  bindColorRow('boxColorRow', 'boxColor')
  bindColorRow('tableColorRow', 'tableTone')
  bindColorRow('backdropRow', 'backdrop')
  $('#customName').addEventListener('input', e => {
    app.custom.name = e.target.value.toUpperCase()
    updateCustomPreview()
  })
}

function bindColorRow(id, key) {
  const root = $('#' + id)
  if (!root) return
  $$('button', root).forEach(btn => btn.addEventListener('click', () => {
    $$('button', root).forEach(b => b.classList.toggle('active', b === btn))
    app.custom[key] = btn.dataset.value
    updateCustomPreview()
  }))
}

function syncCustomFromCurrent() {
  const c = app.config
  app.custom = {
    name: c.name || 'AURA X1 PRO',
    finish: c.finish || 'graphite',
    finishType: c.finishType || (FINISHES[c.finish]?.glass ? 'glass' : 'matte'),
    ram: c.ram || '12 GB',
    storage: c.storage || '512 GB',
    camera: c.camera || 3,
    fold: !!c.fold,
    boxColor: c.boxColor || '#0b0c10',
    tableTone: c.tableTone || 'walnut',
    backdrop: c.backdrop || '#2c2b2b',
    accent: FINISHES[c.finish]?.accent || '#c7a97c'
  }
  const nameInput = $('#customName')
  if (nameInput) nameInput.value = app.custom.name
  const finishWrap = $('#finishSwatches')
  if (finishWrap) $$('.swatch', finishWrap).forEach(b => b.classList.toggle('active', b.dataset.finish === app.custom.finish))
  setSegment('finishType', app.custom.finishType)
  setSegment('ramSelect', app.custom.ram)
  setSegment('storageSelect', app.custom.storage)
  setSegment('cameraSelect', String(app.custom.camera))
  setSegment('foldSelect', String(app.custom.fold))
  setColorRow('boxColorRow', app.custom.boxColor)
  setColorRow('tableColorRow', app.custom.tableTone)
  setColorRow('backdropRow', app.custom.backdrop)
  updateCustomPreview()
}

function setSegment(id, value) {
  const root = $('#' + id)
  if (!root) return
  $$('button', root).forEach(b => b.classList.toggle('active', b.dataset.value === value))
}

function setColorRow(id, value) {
  const root = $('#' + id)
  if (!root) return
  $$('button', root).forEach(b => b.classList.toggle('active', b.dataset.value === value))
}

function updateCustomPreview() {
  const c = app.custom
  if (!c) return
  const f = FINISHES[c.finish] || FINISHES.graphite
  const preview = $('#customPreview')
  preview.style.background = `linear-gradient(145deg, ${shade(f.color, 46)}, ${f.color} 55%, ${shade(f.color, -30)})`
  preview.classList.toggle('matte', c.finishType === 'matte')
  preview.classList.toggle('fold', !!c.fold)
  preview.style.width = c.fold ? '190px' : '140px'
  const finishName = f.name
  $('#customPreviewName').textContent = c.name || 'AURA X1 PRO'
  $('#customPreviewSpec').textContent = `${c.ram} · ${c.storage} · ${c.camera} CAMERA · ${finishName.toUpperCase()}`
}

function applyCustom() {
  const c = app.custom
  if (!c) return
  const config = {
    ...app.config,
    name: c.name || 'AURA CUSTOM',
    short: (c.name || 'AURA CUSTOM').replace(/^AURA\s+/i, ''),
    finish: c.finish,
    finishType: c.finishType,
    ram: c.ram,
    storage: c.storage,
    camera: c.camera,
    fold: c.fold,
    boxColor: c.boxColor,
    tableTone: c.tableTone,
    backdrop: c.backdrop
  }
  app.config = config
  app.variantId = 'custom'
  phone.setConfig(config)
  world.box.setStyle({
    finish: c.finish,
    model: config.name,
    short: config.short,
    boxColor: c.boxColor,
    accent: FINISHES[c.finish]?.accent || '#c7a97c'
  })
  world.setTableTone(c.tableTone)
  world.setBackdrop(c.backdrop)
  closeModal()
  enterFree(true, true)
  app.mode = 'free'
  updateModeRail()
  updateUI()
  buildCollection()
  sound.success()
  toast('Thiết kế đã được áp dụng vào studio 3D.')
}

function openInventory() {
  const grid = $('#inventoryGrid')
  grid.innerHTML = ACCESSORY_DATA.map(a => {
    const owned = app.collected.has(a.id)
    return `
      <button class="inv-card ${owned ? '' : 'locked'}" data-accessory="${a.id}">
        ${owned ? '<span class="check">✓</span>' : ''}
        <span class="inv-icon">${a.icon}</span>
        <strong>${a.name}</strong>
        <small>${owned ? a.material : 'Chưa lấy ra khỏi hộp'}</small>
      </button>
    `
  }).join('')
  $$('.inv-card', grid).forEach(card => card.addEventListener('click', () => {
    const id = card.dataset.accessory
    if (!app.collected.has(id)) {
      toast('Hãy lấy phụ kiện này ra khỏi hộp trước.')
      return
    }
    closeModal()
    if (app.mode === 'unboxing' && app.stage < 3) {
      enterFree(true, true)
    }
    if (!world.box.accessories.group.visible) world.box.revealAccessories()
    setTimeout(() => inspectAccessory(id), 120)
  }))
  $('#inventorySummary').textContent = `${app.collected.size} / 8 phụ kiện đã kiểm tra`
  openModal('inventory')
  sound.click()
}

function updateInventoryCount() {
  const el = $('#inventoryCount')
  if (el) el.textContent = app.collected.size
}

function openModal(name) {
  const root = $('#modalRoot')
  root.classList.add('open')
  $$('.modal', root).forEach(m => m.classList.toggle('active', m.dataset.modal === name))
  document.body.classList.add('modal-open')
}

function closeModal() {
  const root = $('#modalRoot')
  if (!root.classList.contains('open')) return
  const active = $('.modal.active', root)?.dataset.modal
  root.classList.remove('open')
  $$('.modal', root).forEach(m => m.classList.remove('active'))
  document.body.classList.remove('modal-open')
  if (active === 'collection' || active === 'custom') {
    if (app.mode === 'collection' || app.mode === 'custom') {
      app.mode = 'free'
      updateModeRail()
      updateUI()
    }
  }
}

function toggleSound() {
  sound.init()
  app.muted = !app.muted
  sound.setMuted(app.muted)
  $('#soundToggle').classList.toggle('muted', app.muted)
  toast(app.muted ? 'Đã tắt âm thanh.' : 'Âm thanh 3D đã bật.')
}

function toggleNight() {
  app.night = !app.night
  world.setNight(app.night)
  sound.setNight(app.night)
  $('#nightToggle').classList.toggle('muted', app.night)
  toast(app.night ? 'Ánh sáng ban đêm · Studio after hours' : 'Ánh sáng ban ngày · Studio daylight')
  sound.click()
}

function toggleQuality() {
  const cycle = ['lite', 'performance', 'cinematic']
  app.quality = cycle[(cycle.indexOf(app.quality) + 1) % cycle.length]
  applyQuality()
  const copy = {
    cinematic: 'Chất lượng Cinema · Bokeh, bloom, SMAA.',
    performance: 'Chế độ Performance · Tối ưu cho thiết bị di động.',
    lite: 'Chế độ Lite · Dành cho thiết bị yếu hoặc trình duyệt phần mềm.'
  }
  toast(copy[app.quality])
  sound.click()
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => toast('Trình duyệt không hỗ trợ toàn màn hình.'))
  } else {
    document.exitFullscreen?.()
  }
}

function resetExperience() {
  if (!phone) return
  tweens.clear()
  app.stage = 0
  app.mode = 'unboxing'
  app.revealReady = false
  app.holding = false
  app.holdProgress = 0
  app.powerOn = false
  app.bootStarted = false
  app.busy = false
  app.inspectedItem = null
  app.inspectedId = null
  app.autoRotateItem = false
  app.collected.clear()
  app.sealDrag = 0
  app.lidDrag = 0
  closeInfo()
  closeModal()
  document.body.classList.remove('camera-mode')
  renderer.domElement.style.filter = 'none'
  phone.setReviewMode(false)
  world.box.reset()
  phone.addFilmBack()
  phone.screen.powerOff()
  phone.setScreenBrightness(0)
  phone.screen.state = 'off'
  phone.screen.dirty = true
  placePhoneInsideBox()
  world.setReveal(0)
  world.setNight(false)
  app.night = false
  $('#nightToggle').classList.remove('muted')
  inspectionHalo.visible = false
  $('#holdPower').classList.remove('visible')
  moveCamera({ theta: 0.2, phi: 0.94, radius: 3.02, target: [0, 0.23, 0.02] }, 1.3)
  updateUI()
  toast('Đã đặt lại toàn bộ trải nghiệm.')
  sound.paper()
}

function onKeyDown(event) {
  if (event.key === 'Escape') {
    if ($('#modalRoot').classList.contains('open')) {
      closeModal()
      if (app.mode === 'camera') document.body.classList.add('camera-mode')
    } else if (app.mode === 'camera') {
      exitCameraMode()
    } else if (app.inspectedItem) {
      returnInspected()
    } else {
      closeInfo()
    }
  }
  if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) resetExperience()
  if (event.key.toLowerCase() === 'm') toggleSound()
  if (event.key.toLowerCase() === 'n') toggleNight()
}

function toast(message) {
  const el = $('#toast')
  $('#toastText').textContent = message
  el.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2800)
}

function flash() {
  const el = $('#flash')
  el.classList.remove('fire')
  void el.offsetWidth
  el.classList.add('fire')
}

window.addEventListener('orientationchange', () => {
  setTimeout(onResize, 250)
})

boot()
