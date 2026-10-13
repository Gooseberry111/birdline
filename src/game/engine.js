import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

import { makeNoise, clamp, lerp, smooth } from './noise'
import { createTerrain, heightAt, AIRFIELDS, LANDMARKS, THERMALS, HALF, stateAt, SIZE, CITY } from './terrain'
import {
  createWater, createClouds, createStars, createTrees, createAirfields,
  createThermalVisual, createRain, createStreaks, glowTexture,
} from './scenery'
import { createBird } from './birdModel'
import { Flight } from './flight'
import { GameAudio } from './audio'
import { WEATHER } from '../data/weather'
import { HABITATS, TRAILS } from '../data/cosmetics'
import { birdById } from '../data/birds'
import { profile, ui, hud, effectiveStats, masteryFor, loadoutFor, abilityLevel, toast } from '../store'
import { createMode } from './modes'
import { toStage } from '../store'
import { CoinField } from './coins'
import { loadRealBird } from './realBird'
import { Traffic } from './traffic'
import { createAbuja } from './abuja'
import { Radio } from './radio'
import { asset } from '../assets'
import { createPlane } from './plane'
import { createHorizon, createKites } from './atmosphere'
import { TUTORIAL } from '../data/tutorial'

const V = THREE.Vector3
const fogDay = new THREE.Color('#aecbe6')
const fogNight = new THREE.Color('#142443')
const fogDusk = new THREE.Color('#e7a47a')
const fogGrey = new THREE.Color('#7e8791')

export class Engine {
  constructor(canvas) {
    this.canvas = canvas
    this.clock = new THREE.Clock()
    this.time = 0
    this.hour = 14
    this.hourSpeed = 0 // game hours per real second
    this.view = 'title' // title | hangar | play
    this.paused = false
    this.keys = new Set()
    this.touch = { x: 0, y: 0, flap: false, boost: false, brake: false }
    this.assist = ui.touch
    this.pressed = new Set()
    this.noise = makeNoise(5)
    this.audio = new GameAudio()
    this.cam = { mode: 0, shake: 0, fov: 62, yawOrbit: 0.6, pitchOrbit: 0.03, zoom: 1, drag: false }
    this.camPos = new V(0, 200, 0)
    this.camLook = new V()
    this.wx = { ...WEATHER.clear }
    this.wxTarget = { ...WEATHER.clear }
    this.weatherKey = 'clear'
    this.windBase = 0.6
    this.windDir = 0.8
    this.player = null
    this.mode = null
    this.lightning = 0
    this.nextLightning = 6
    this.envHour = -99
    this.hudTimer = 0
    this.trailIdx = 0
    this.fwd = new V()
    this.camDir = new V()
    this.padPrev = {}
    this.menuAngle = 0
    this.ready = false
    this.lastTipL = new V()
    this.lastTipR = new V()
  }

  // ------------------------------------------------------------ setup
  async init(onProgress = () => {}) {
    const q = profile.settings.quality
    this.useComposer = q === 'high'
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.useComposer, powerPreference: 'high-performance', stencil: false })
    this.basePR = Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : q === 'medium' ? 1.25 : 1)
    this.resScale = 1
    this.fpsAcc = 0; this.fpsN = 0
    renderer.setPixelRatio(this.basePR)
    renderer.setSize(ui.vw, ui.vh)
    this.shadowsOn = q !== 'low' && !ui.touch
    renderer.shadowMap.enabled = this.shadowsOn
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    this.renderer = renderer

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(fogDay, 0.00014)
    this.scene = scene
    this.camera = new THREE.PerspectiveCamera(62, ui.vw / ui.vh, 0.3, 42000)
    scene.add(this.camera)

    this.sky = new Sky()
    this.sky.scale.setScalar(30000)
    scene.add(this.sky)
    this.skyScene = new THREE.Scene()
    this.pmrem = new THREE.PMREMGenerator(renderer)

    this.hemi = new THREE.HemisphereLight('#bcd9ff', '#6b6a57', 0.55)
    scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight('#fff3dc', 3)
    if (this.shadowsOn) {
      this.sun.castShadow = true
      this.sun.shadow.mapSize.set(2048, 2048)
      const sc = this.sun.shadow.camera
      sc.left = -480; sc.right = 480; sc.top = 480; sc.bottom = -480; sc.near = 20; sc.far = 3200
      this.sun.shadow.bias = -0.0006
      this.sun.shadow.normalBias = 0.9
    }
    scene.add(this.sun, this.sun.target)
    this.moon = new THREE.DirectionalLight('#7b9bff', 0)
    scene.add(this.moon, this.moon.target)
    // soft fill on the bird for menu scenes
    this.fill = new THREE.DirectionalLight('#dbe8ff', 0)
    scene.add(this.fill, this.fill.target)

    onProgress(0.1); await tick()
    this.terrain = createTerrain(q === 'high' ? 560 : q === 'medium' ? 380 : 260)
    scene.add(this.terrain)
    // a flat ring of savanna beyond the map edge so the horizon fades into haze
    const outer = new THREE.Shape()
    outer.moveTo(-30000, -30000); outer.lineTo(30000, -30000); outer.lineTo(30000, 30000); outer.lineTo(-30000, 30000); outer.closePath()
    const hole = new THREE.Path()
    const e = SIZE / 2 - 4
    hole.moveTo(-e, -e); hole.lineTo(-e, e); hole.lineTo(e, e); hole.lineTo(e, -e); hole.closePath()
    outer.holes.push(hole)
    const skirt = new THREE.Mesh(new THREE.ShapeGeometry(outer), new THREE.MeshStandardMaterial({ color: '#a29a5e', roughness: 1 }))
    skirt.rotation.x = -Math.PI / 2
    skirt.position.y = 41.4
    scene.add(skirt)
    onProgress(0.4); await tick()
    this.water = createWater(this.terrain.userData.heightTex)
    scene.add(this.water)
    this.trees = createTrees(q === 'high' ? 16000 : q === 'medium' ? 7000 : 3000)
    scene.add(this.trees)
    onProgress(0.6); await tick()
    this.city = createAbuja(q)
    scene.add(this.city)
    this.airfields = createAirfields()
    scene.add(this.airfields)
    this.clouds = createClouds(q)
    scene.add(this.clouds)
    this.stars = createStars()
    scene.add(this.stars)
    this.thermalVis = createThermalVisual()
    scene.add(this.thermalVis)
    this.rain = createRain()
    scene.add(this.rain)
    this.streaks = createStreaks()
    scene.add(this.streaks)
    onProgress(0.8); await tick()

    // blob shadow under the bird
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }))
    sh.rotation.x = -Math.PI / 2
    sh.renderOrder = 2
    this.shadow = sh
    scene.add(sh)

    // trail particles
    this.glow = glowTexture()
    const TN = 900
    this.trailN = TN
    const tg = new THREE.BufferGeometry()
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 3), 3))
    tg.setAttribute('aBirth', new THREE.BufferAttribute(new Float32Array(TN).fill(-100), 1))
    this.trailMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') }, uMap: { value: this.glow } },
      vertexShader: `
        attribute float aBirth; uniform float uTime; varying float vA;
        void main(){
          float age = uTime - aBirth;
          vA = clamp(1.0 - age / 2.4, 0.0, 1.0);
          vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + 7.0 * vA) * (500.0 / max(-mv.z, 5.0));
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform sampler2D uMap; varying float vA;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA * 0.9; gl_FragColor = vec4(uColor, a); }`,
    })
    this.trail = new THREE.Points(tg, this.trailMat)
    this.trail.frustumCulled = false
    scene.add(this.trail)

    this.radio = new Radio(this.audio)
    this.horizon = createHorizon()
    scene.add(this.horizon)
    this.kites = createKites([
      { x: CITY.x + 650, z: CITY.z + 420, y: CITY.h },
      { x: CITY.x + 80, z: CITY.z + 40, y: CITY.h },
      { x: CITY.x - 250, z: CITY.z + 930, y: CITY.h },
    ], q === 'low' ? 8 : 14)
    scene.add(this.kites)
    this.coins = new CoinField(scene)
    this.traffic = new Traffic(this)
    this.traffic.build(q)
    // glowing arrow trail that leads the way to the next goal
    this.pathDots = []
    this.pathGroup = new THREE.Group()
    for (let i = 0; i < 16; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: '#9be8ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }))
      sp.scale.setScalar(26)
      this.pathGroup.add(sp)
      this.pathDots.push(sp)
    }
    scene.add(this.pathGroup)

    // post processing, high quality only
    this.bloom = { strength: 0 }
    if (this.useComposer) {
      const rt = new THREE.WebGLRenderTarget(ui.vw, ui.vh, { type: THREE.HalfFloatType, samples: 4 })
      this.composer = new EffectComposer(renderer, rt)
      this.composer.addPass(new RenderPass(scene, this.camera))
      this.bloom = new UnrealBloomPass(new THREE.Vector2(ui.vw, ui.vh), 0.2, 0.5, 2.2)
      this.composer.addPass(this.bloom)
      this.composer.addPass(new OutputPass())
    }

    window.addEventListener('resize', this.onResize)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', () => this.keys.clear())
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: true })

    try {
      const r = await fetch(asset('models/index.json'))
      const j = r.ok ? await r.json() : {}
      this.realIndex = j && typeof j === 'object' ? j : {}
    } catch (e) { this.realIndex = {} }
    this.realCache = {}
    this.setWeather('clear', true)
    this.setHour(14)
    this.refreshBird()
    onProgress(1)
    this.ready = true
    this.last = performance.now()
    this.loop = this.loop.bind(this)
    requestAnimationFrame(this.loop)
  }

  // ------------------------------------------------------------ events
  onResize = () => {
    if (!this.renderer) return
    const w = ui.vw, h = ui.vh
    this.renderer.setSize(w, h)
    this.composer?.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  onKeyDown = (e) => {
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && this.view === 'play') e.preventDefault()
    if (ui.touch && e.isTrusted && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) { ui.touch = false; ui.tilt = false }
    if (!this.keys.has(e.code)) this.pressed.add(e.code)
    this.keys.add(e.code)
    if (this.view === 'play') this.audio.start()
  }

  onKeyUp = (e) => { this.keys.delete(e.code) }
  onPointerDown = (e) => { const p = toStage(e.clientX, e.clientY); this.cam.drag = true; this.cam.lastX = p.x; this.cam.lastY = p.y; this.audio.start() }
  onPointerUp = () => { this.cam.drag = false }
  onPointerMove = (e) => {
    if (!this.cam.drag || this.view !== 'hangar') return
    const p = toStage(e.clientX, e.clientY)
    this.cam.yawOrbit -= (p.x - this.cam.lastX) * 0.006
    this.cam.pitchOrbit = clamp(this.cam.pitchOrbit + (p.y - this.cam.lastY) * 0.004, -0.4, 1.2)
    this.cam.lastX = p.x; this.cam.lastY = p.y
  }

  onWheel = (e) => { if (this.view === 'hangar') this.cam.zoom = clamp(this.cam.zoom * (1 + e.deltaY * 0.001), 0.6, 2.2) }

  consume(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true }
    return false
  }

  // ------------------------------------------------------------ environment
  setHour(h) { this.hour = ((h % 24) + 24) % 24; this.applyTimeOfDay(true) }

  setWeather(key, immediate = false) {
    const w = WEATHER[key] || WEATHER.clear
    this.weatherKey = key in WEATHER ? key : 'clear'
    this.wxTarget = { ...w }
    if (immediate) this.wx = { ...w }
    hud.weather = w.name
  }

  windAt = (x, y, z, t) => {
    const n = this.noise
    const a = this.windDir + n(t * 0.01, 5) * 0.7 + n(x * 0.0002, z * 0.0002) * 0.5
    const spd = 9 * this.wx.windScale * (1 + 0.35 * n(x * 0.0003 + t * 0.02, z * 0.0003)) * (0.6 + Math.min(Math.max(y, 0), 1500) / 1500 * 0.9)
    const rough = smooth(30, 400, heightAt(x, z)) * 0.6
    const turb = this.wx.turbulence * (0.55 + rough)
    return { x: Math.cos(a) * spd, z: Math.sin(a) * spd, y: 0, turb, tv: n(t * 1.7 + x * 0.01, y * 0.01 + 40) * this.wx.turbulence * 7 * (0.6 + rough) }
  }

  applyTimeOfDay(force = false) {
    const h = this.hour
    const elev = Math.sin(((h - 6) / 12) * Math.PI) // -1 .. 1, positive between 6 and 18
    const ang = Math.asin(clamp(elev, -1, 1)) * 0.92
    const az = (h / 24) * Math.PI * 2 + 0.6
    this.sunDir = new V(Math.sin(az) * Math.cos(ang), Math.sin(ang), Math.cos(az) * Math.cos(ang)).normalize()
    const day = smooth(-0.1, 0.28, elev)
    const dusk = Math.exp(-Math.pow((elev - 0.03) / 0.16, 2))
    const dark = this.wx.dark
    const u = this.sky.material.uniforms
    u.sunPosition.value.copy(this.sunDir)
    u.turbidity.value = 2 + dark * 14 + dusk * 3 + (this.wx.dust || 0) * 8
    u.rayleigh.value = 2.0 + dusk * 1.4 + (1 - day) * 0.3
    u.mieCoefficient.value = 0.0025 + dark * 0.02
    u.mieDirectionalG.value = 0.68
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir)

    const fog = new THREE.Color().copy(fogNight).lerp(fogDay, day).lerp(fogDusk, dusk * 0.55 * day + dusk * 0.2).lerp(fogGrey.clone().multiplyScalar(0.25 + day * 0.75), dark * 0.7)
    const dust = this.wx.dust || 0
    if (dust > 0.01) fog.lerp(new THREE.Color('#d9b88a').multiplyScalar(0.3 + day * 0.7), dust * 0.7)
    this.fogColor = fog
    this.scene.fog.color.copy(fog)
    this.sunPower = smooth(-0.05, 0.25, elev) * (1 - dark * 0.55)
    this.nightK = 1 - smooth(-0.15, 0.12, elev)
    this.sun.intensity = this.sunPower * 2.5
    const sunCol = new THREE.Color('#fff3dc').lerp(new THREE.Color('#ffb27a'), dusk * 0.8)
    this.sun.color.copy(sunCol)
    this.hemiBase = 0.55 - day * 0.31
    this.hemi.intensity = this.hemiBase
    this.hemi.color.set('#bcd9ff').lerp(new THREE.Color('#2b3b66'), 1 - day)
    this.moon.intensity = this.nightK * 1.8
    this.moon.position.copy(this.sunDir).multiplyScalar(-1)
    this.renderer.toneMappingExposure = lerp(0.95, 0.92, day) + dusk * 0.05
    this.stars.material.opacity = this.nightK * (1 - dark * 0.8)
    this.water.material.color.setScalar(0.22 + day * 0.78)
    this.city.userData.setNight(this.nightK)
    this.airfields.userData.setNight(this.nightK)
    const cloudCol = new THREE.Color().setScalar(0.3 + day * 0.7).lerp(new THREE.Color('#ffc59d'), dusk * 0.45 * day).multiplyScalar(1 - dark * 0.55)
    for (const m of this.clouds.userData.mats) m.color.copy(cloudCol)
    // refresh image based lighting when the sky changes enough
    if (force || Math.abs(this.envHour - h) > 0.35 || this.envWeather !== this.weatherKey) {
      this.envHour = h
      this.envWeather = this.weatherKey
      this.updateEnvironmentMap()
    }
  }

  updateEnvironmentMap() {
    const s = this.skyScene
    this.sky.position.set(0, 0, 0)
    s.add(this.sky)
    const rt = this.pmrem.fromScene(s, 0.04)
    this.scene.add(this.sky)
    if (this.envRT) this.envRT.dispose()
    this.envRT = rt
    this.scene.environment = rt.texture
    this.scene.environmentIntensity = 0.22 + this.sunPower * 0.22 + this.nightK * 0.3
  }

  // ------------------------------------------------------------ birds
  refreshBird(opts = {}) {
    const bird = birdById((this.view === 'hangar' && ui.previewId) || profile.selected)
    if (!bird) return
    if (this.player) {
      this.scene.remove(this.player.model.root)
      this.player.model.dispose()
    }
    const lo = loadoutFor(bird.id)
    const mastery = masteryFor(bird.id).level
    const model = createBird(bird, lo, { elite: mastery >= 50 })
    this.scene.add(model.root)
    const flight = new Flight(bird, effectiveStats(bird), { mastery, abilityLevels: [abilityLevel(bird.id, 0), abilityLevel(bird.id, 1)] })
    flight.groundOffset = model.groundOffset
    this.player = { bird, model, flight, loadout: lo }
    this.fp = null
    this.swapReal(bird, model)
    const trail = TRAILS.find((t) => t.id === lo.trail)
    this.trailMat.uniforms.uColor.value.set(trail?.color || '#ffffff')
    this.trailOn = !!trail?.color
    if (this.view === 'hangar' || this.view === 'title') this.placeShowcase()
    void opts
  }

  takePhoto() { this.photoReq = true }

  savePhoto() {
    this.canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `flybird-${Date.now()}.jpg`, { type: 'image/jpeg' })
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'FlyBird' }); return }
      } catch (e) { /* fall back to a download */ }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      toast('Photo saved', 'good')
    }, 'image/jpeg', 0.92)
  }

  async lockScreen() {
    try {
      if (navigator.wakeLock && !this.wl) {
        this.wl = await navigator.wakeLock.request('screen')
        this.wl.addEventListener?.('release', () => { this.wl = null })
      }
    } catch (e) { /* not available */ }
  }

  unlockScreen() { try { this.wl?.release?.() } catch (e) { /* ignore */ } this.wl = null }

  toggleLandAssist() {
    profile.settings.landAssist = profile.settings.landAssist === false
    toast(profile.settings.landAssist === false ? 'Landing assist off' : 'Landing assist on', 'info')
  }

  // turn the bird into its aircraft for an easier landing, and back again
  togglePlane() {
    if (this.view !== 'play' || this.paused || !this.player) return
    const p = this.player
    const f = p.flight
    const next = !f.planeMode
    const old = p.model
    this.scene.remove(old.root)
    old.dispose()
    let mdl
    if (next) mdl = createPlane(p.bird)
    else mdl = createBird(p.bird, p.loadout, { elite: masteryFor(p.bird.id).level >= 50 })
    this.scene.add(mdl.root)
    p.model = mdl
    f.planeMode = next
    f.stall *= next ? 1.2 : 1 / 1.2
    f.groundOffset = mdl.groundOffset
    this.fp = null
    this.audio.pickup()
    toast(next ? `Plane mode: ${p.bird.aircraft}. Steadier and tireless` : 'Back to bird', 'good')
    if (!next) this.swapReal(p.bird, mdl)
  }

  // swap in a real 3D model when one exists for this bird
  swapReal(bird, procedural) {
    const cfg = this.realIndex && this.realIndex[bird.id]
    if (!cfg || !cfg.file) return
    const p = (this.realCache[bird.id] ||= loadRealBird(bird, cfg).catch((err) => { console.warn('Real bird failed', bird.id, err); return null }))
    p.then((real) => {
      if (!real || !this.player || this.player.model !== procedural) return
      real.root.visible = true
      this.scene.remove(procedural.root)
      procedural.dispose()
      this.scene.add(real.root)
      this.player.model = real
      this.player.flight.groundOffset = real.groundOffset
      this.fp = null
    })
  }

  placeShowcase() {
    const hab = HABITATS.find((h) => h.id === profile.habitat) || HABITATS[0]
    const lm = LANDMARKS.find((l) => l.id === hab.lm)
    const [px, , pz] = hab.pos
    const x = lm ? lm.x : px, z = lm ? lm.z : pz
    const ground = Math.max(heightAt(x, z), lm ? lm.h : 0, 0)
    this.showcase = { x, z, y: ground + (hab.alt || 150) }
  }

  // ------------------------------------------------------------ screens
  showTitle() {
    this.endMode()
    this.view = 'title'
    this.paused = false
    this.setWeather('clear')
    if (this.hourSpeed === 0) this.hourSpeed = 0.04
    this.cam.fov = 58
  }

  showHangar() {
    this.endMode()
    this.view = 'hangar'
    this.paused = false
    this.placeShowcase()
    const hab = HABITATS.find((h) => h.id === profile.habitat) || HABITATS[0]
    this.hourSpeed = 0
    this.setHour(hab.hour)
    this.setWeather('clear')
    this.cam.zoom = 1
    this.cam.pitchOrbit = hab.pitch ?? 0.03
  }

  setHabitat() {
    if (this.view !== 'hangar') return
    this.placeShowcase()
    const hab = HABITATS.find((h) => h.id === profile.habitat) || HABITATS[0]
    this.setHour(hab.hour)
    this.cam.pitchOrbit = hab.pitch ?? 0.03
  }

  startMode(id, opts = {}) {
    this.endMode()
    this.refreshBird()
    this.view = 'play'
    this.paused = false
    ui.paused = false
    this.coins.clear()
    this.radio.clear()
    this.lockScreen()
    this.mode = createMode(id, this, opts)
    this.cam.mode = 0
    this.mode.start()
    this.calibrateTilt()
    this.tutSeen = new Set(); this.tutGlide = 0; this.abilityUsed = false
    ui.tutorial.step = 0
    const guided = id === 'free' || id === 'missions'
    ui.tutorial.active = false
    ui.help = !guided && !profile.settings.helpShown && !profile.settings.tutorialDone
    if (!guided) profile.settings.helpShown = true
    this.idleT = 0; hud.hint = ''
    this.audio.start()
    this.audio.setVolume(profile.settings.volume)
    this.trailReset()
  }

  endMode() {
    this.radio?.clear()
    this.unlockScreen()
    this.landGuide = null
    this.coins?.clear()
    this.pathGroup && (this.pathGroup.visible = false)
    ui.tutorial.active = false
    ui.help = false
    if (this.mode) { this.mode.dispose(); this.mode = null }
    hud.markers = []
    hud.wpScreen = null
    hud.objective = ''
    hud.message = ''
    hud.countdown = 0
  }

  setPaused(p) { this.paused = p; ui.paused = p }

  trailReset() {
    this.trail.geometry.attributes.aBirth.array.fill(-100)
    this.trail.geometry.attributes.aBirth.needsUpdate = true
  }

  // spawn the player; used by modes
  spawn(x, y, z, yaw, speed, onGround = false) {
    const f = this.player.flight
    f.place(x, y, z, yaw, speed)
    f.energy = 100
    f.onGround = onGround
    f.distance = 0
    f.maxAlt = y
    this.snapCamera()
  }

  snapCamera() {
    this.camSnap = true
  }

  project(x, y, z) {
    const v = new V(x, y, z).project(this.camera)
    const behind = new V(x, y, z).sub(this.camera.position).dot(this.camera.getWorldDirection(new V())) < 0
    return { x: (v.x * 0.5 + 0.5) * ui.vw, y: (-v.y * 0.5 + 0.5) * ui.vh, behind }
  }

  // ------------------------------------------------------------ tilt steering
  async enableTilt() {
    if (this.tiltBound) { ui.tilt = true; this.calibrateTilt(); return true }
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
        const r = await DeviceMotionEvent.requestPermission()
        if (r !== 'granted') return false
      }
    } catch (e) { return false }
    if (typeof DeviceMotionEvent === 'undefined') return false
    this.tiltBound = true
    this.tiltRaw = { roll: 0, pitch: 0, seen: false, z0: 0, r0: 0 }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x == null) return
      const sg = ios ? -1 : 1
      const x = a.x * sg, y = a.y * sg, z = a.z * sg
      let ang = (screen.orientation && screen.orientation.angle) || 0
      if (typeof window.orientation === 'number' && !screen.orientation) ang = (window.orientation + 360) % 360
      let xs = x, ys = y
      if (ang === 90) { xs = -y; ys = x } else if (ang === 270) { xs = y; ys = -x } else if (ang === 180) { xs = -x; ys = -y }
      const g = Math.hypot(x, y, z) || 9.81
      const t = this.tiltRaw
      t.roll += (-Math.atan2(xs, ys) - t.roll) * 0.25
      t.pitch += (z / g - t.pitch) * 0.25
      if (!t.seen) { t.seen = true; ui.tiltReady = true; this.calibrateTilt() }
    })
    ui.tilt = true
    return true
  }

  calibrateTilt() { if (this.tiltRaw) { this.tiltRaw.z0 = this.tiltRaw.pitch; this.tiltRaw.r0 = this.tiltRaw.roll } }

  setTilt(on) {
    if (on) this.enableTilt().then((ok) => { if (!ok) ui.tilt = false })
    else ui.tilt = false
    profile.settings.tilt = !!on
  }

  tiltInput() {
    const t = this.tiltRaw
    if (!ui.touch || !ui.tilt || !t || !t.seen || ui.rotated) return null
    const dz = (v, d) => (Math.abs(v) < d ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - d) / (1 - d)))
    return { roll: dz((t.roll - t.r0) / 0.5, 0.16), pitch: dz(-(t.pitch - t.z0) / 0.3, 0.14) }
  }

  // ------------------------------------------------------------ input
  readInput() {
    const k = this.keys
    const inv = profile.settings.invertY ? -1 : 1
    const input = { pitch: 0, roll: 0, flap: false, boost: false, brake: false, assist: this.assist }
    // W dives (nose down), S climbs
    if (k.has('KeyW') || k.has('ArrowUp')) input.pitch -= 1 * inv
    if (k.has('KeyS') || k.has('ArrowDown')) input.pitch += 1 * inv
    if (k.has('KeyA') || k.has('ArrowLeft')) input.roll -= 1
    if (k.has('KeyD') || k.has('ArrowRight')) input.roll += 1
    // game controller: left stick steers (forward dives), A flaps, right trigger boosts, B brakes
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    const gp = [...pads].find((g) => g && g.connected)
    if (gp) {
      const ax = (v) => (Math.abs(v) < 0.16 ? 0 : v)
      input.roll += ax(gp.axes[0] || 0)
      input.pitch += ax(gp.axes[1] || 0) * inv
      if (gp.buttons[0]?.pressed) input.flap = true
      if ((gp.buttons[7]?.value || 0) > 0.3 || gp.buttons[2]?.pressed) { input.boost = true; input.flap = true }
      if (gp.buttons[1]?.pressed || (gp.buttons[6]?.value || 0) > 0.3) input.brake = true
      const edge = (i, fn) => { const on = !!gp.buttons[i]?.pressed; if (on && !this.padPrev[i]) fn(); this.padPrev[i] = on }
      edge(4, () => this.useAbilitySlot(0)); edge(5, () => this.useAbilitySlot(1)); edge(3, () => this.togglePlane())
      edge(9, () => this.setPaused(!this.paused))
    }
    const t = this.touch
    if (t.x || t.y) { input.roll += t.x; input.pitch += -t.y * inv }
    const tl = this.tiltInput()
    if (tl) { input.roll += tl.roll; input.pitch += tl.pitch * inv }
    input.roll = Math.max(-1, Math.min(1, input.roll))
    input.pitch = Math.max(-1, Math.min(1, input.pitch))
    if (t.flap) input.flap = true
    if (t.boost) { input.boost = true; input.flap = true }
    if (t.brake) input.brake = true
    input.flap = k.has('Space')
    input.boost = k.has('ShiftLeft') || k.has('ShiftRight')
    input.brake = k.has('ControlLeft') || k.has('KeyX')
    return input
  }

  // ------------------------------------------------------------ main loop
  loop() {
    requestAnimationFrame(this.loop)
    if (!this.ready) return
    const dt = Math.min(this.clock.getDelta(), 0.1)
    this.time += dt
    const t = this.time

    // weather blends toward the target
    const kw = 1 - Math.exp(-dt * 0.6)
    for (const key of ['fog', 'windScale', 'turbulence', 'rain', 'cloud', 'dark']) this.wx[key] = lerp(this.wx[key], this.wxTarget[key], kw)
    this.wx.dust = lerp(this.wx.dust || 0, this.wxTarget.dust || 0, kw)
    this.scene.fog.density = this.wx.fog * (this.view === 'hangar' ? 0.5 : 1)

    // time of day
    if (this.hourSpeed) { this.hour = (this.hour + dt * this.hourSpeed) % 24; this.applyTimeOfDay() }
    else if (Math.abs(this.wx.dark - this.wxTarget.dark) > 0.01 || Math.abs((this.wx.dust || 0) - (this.wxTarget.dust || 0)) > 0.01) this.applyTimeOfDay()

    this.adaptResolution(dt)
    if (this.view === 'play') this.updatePlay(dt)
    else if (this.view === 'title') this.updateTitle(dt)
    else this.updateHangar(dt)

    this.updateWorld(dt)
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
    if (this.photoReq) { this.photoReq = false; this.savePhoto() }
    this.pressed.clear()
  }

  // advance the simulation without rendering (used by tests)
  debugStep(seconds, dt = 1 / 60) {
    for (let t = 0; t < seconds; t += dt) { this.time += dt; this.updatePlay(dt) }
  }

  adaptResolution(dt) {
    this.fpsAcc += dt; this.fpsN++
    if (this.fpsAcc < 1.5) return
    const fps = this.fpsN / this.fpsAcc
    this.fpsAcc = 0; this.fpsN = 0
    let s = this.resScale
    if (fps < 44 && s > 0.5) s = Math.max(0.5, s * 0.85)
    else if (fps > 58 && s < 1) s = Math.min(1, s * 1.08)
    if (s <= 0.55 && fps < 30 && !this.lite) { this.lite = true; this.clouds.visible = false; this.thermalVis.visible = false }
    if (Math.abs(s - this.resScale) > 0.01) {
      this.resScale = s
      const pr = this.basePR * s
      this.renderer.setPixelRatio(pr)
      this.renderer.setSize(ui.vw, ui.vh)
      if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(ui.vw, ui.vh) }
    }
  }

  // ------------------------------------------------------------ tutorial
  skipTutorial() {
    ui.tutorial.active = false
    profile.settings.tutorialDone = true
    ui.help = false
  }

  updateTutorial(dt) {
    const t = ui.tutorial
    if (!t.active) return
    const f = this.player.flight
    const inp = this.readInput()
    const seen = (this.tutSeen ||= new Set())
    let done = false
    switch (TUTORIAL[t.step]?.id) {
      case 'takeoff': done = !f.onGround; break
      case 'pitch': if (inp.pitch < -0.3) seen.add('w'); if (inp.pitch > 0.3) seen.add('s'); done = seen.has('w') && seen.has('s'); break
      case 'bank': if (inp.roll < -0.3) seen.add('a'); if (inp.roll > 0.3) seen.add('d'); done = seen.has('a') && seen.has('d'); break
      case 'boost': done = inp.boost; break
      case 'glide': this.tutGlide = (!f.onGround && !inp.flap && !inp.boost) ? (this.tutGlide || 0) + dt : 0; done = this.tutGlide > 3; break
      case 'ability': done = !!this.abilityUsed; break
      default: break
    }
    if (done) {
      toast('Nice', 'good')
      this.audio.pickup()
      seen.clear(); this.tutGlide = 0
      t.step++
      if (t.step >= TUTORIAL.length) {
        t.active = false
        profile.settings.tutorialDone = true
        toast('Tutorial complete. Press H any time for controls', 'good')
      }
    }
  }

  // ------------------------------------------------------------ play
  updatePlay(dt) {
    if (this.camera.view?.enabled) this.camera.clearViewOffset()
    const p = this.player
    const f = p.flight
    if (this.consume('Escape') || this.consume('KeyP')) { this.setPaused(!this.paused) }
    if (this.consume('KeyC')) this.cam.mode = (this.cam.mode + 1) % 3
    if (this.consume('KeyM')) hud.mapVisible = !hud.mapVisible
    if (this.consume('KeyH')) ui.help = !ui.help
    if (this.consume('KeyT')) this.togglePlane()
    if (this.consume('KeyL')) this.toggleLandAssist()
    if (this.consume('Enter') && ui.tutorial.active) this.skipTutorial()
    if (this.consume('KeyF')) { this.assist = !this.assist; toast(this.assist ? 'Cruise assist on' : 'Cruise assist off') }

    if (!this.paused && !ui.help && !ui.howto) {
      this.updateTutorial(dt)
      const input = this.readInput()
      input.landGuide = this.landGuide
      input.landAssist = profile.settings.landAssist !== false
      const active = input.pitch || input.roll || input.flap || input.boost || input.brake || f.speed > 5 && !f.onGround && this.keys.size
      if (active || this.pressed.size) { this.idleT = 0; if (hud.hint) hud.hint = '' }
      else {
        this.idleT = (this.idleT || 0) + dt
        if (this.idleT > (f.onGround ? 5 : 9) && !hud.countdown) {
          const h = this.mode?.hint?.() || (f.onGround ? 'Hold Flap to run down the runway and take off.' : 'Steer toward the marker, or glide to recover Energy.')
          if (hud.hint !== h) hud.hint = h
        }
      }
      if (this.mode?.locked) { input.pitch = 0; input.roll = 0; input.flap = false; input.boost = false }
      if (this.consume('KeyQ')) this.useAbilitySlot(0)
      if (this.consume('KeyE')) this.useAbilitySlot(1)
      f.update(dt, input, { time: this.time, windAt: this.windAt, noise: this.noise })
      for (const ev of f.events) this.handleFlightEvent(ev)
      f.events.length = 0
      this.mode?.update(dt)
      const got = this.coins.update(dt, this.time, f.pos, f.flags.focus ? 46 : 32)
      if (got) { this.audio.coin(); this.mode?.onCoins?.(got) }
      this.emitTrail(dt)
    }
    this.syncModel(dt, f, p.model)
    this.updateChaseCamera(dt)
    this.updateHud(dt)
  }

  handleFlightEvent(ev) {
    if (ev.type === 'ability') this.audio.ability()
    if (ev.type === 'contact') { this.audio.thud(); this.cam.shake = ev.hard ? 1 : 0.4 }
    if (ev.type === 'takeoff' && this.time - (this.lastGroundToast || -9) > 3) { toast('Takeoff', 'good'); this.lastGroundToast = this.time }
    if (ev.type === 'land' && this.time - (this.lastGroundToast || -9) > 3) { toast('Touchdown'); this.lastGroundToast = this.time }
    this.mode?.onEvent?.(ev)
  }

  syncModel(dt, f, model) {
    const r = model.root
    r.position.set(f.pos.x, f.pos.y, f.pos.z)
    r.rotation.order = 'YXZ'
    r.rotation.set(-f.pitch, f.yaw, f.roll)
    const sn = clamp(f.speed / f.vTop, 0, 1.5)
    const dive = f.abilityKind('dive') || f.abilityKind('strike')
    const burst = f.abilityKind('burst')
    const hov = f.abilityKind('hover')
    model.update(dt, {
      flap: f.onGround ? clamp(f.speed / 12, 0, 1) * (f.flapping > 0.1 ? 1 : 0.3) : f.flapping,
      speed: sn, fold: dive ? 1 : burst ? 0.5 : clamp((sn - 0.8) * 2.5, 0, 0.6),
      ground: f.onGround ? 1 : 0, hover: hov ? 1 : 0, brake: f.braking,
      pitchIn: this.readInputPitchCached(), turn: -f.turnSmooth / 1.5, bank: f.roll, time: this.time,
    })
  }

  readInputPitchCached() {
    const k = this.keys
    return ((k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0) - ((k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0) - this.touch.y
  }

  useAbilitySlot(i) {
    if (this.view !== 'play' || this.paused) return
    if (this.player.flight.useAbility(i) && i === 0) this.abilityUsed = true
  }

  cycleCamera() { this.cam.mode = (this.cam.mode + 1) % 3 }

  updateChaseCamera(dt) {
    const f = this.player.flight
    const m = this.player.model
    const size = Math.max(m.span, m.length * 1.3)
    f.getForward(this.fwd)
    const mode = this.cam.mode
    if (this.fp !== (mode === 2)) { this.fp = mode === 2; m.setFirstPerson(this.fp) }
    const dist = mode === 0 ? size * 0.95 + 4.5 : mode === 1 ? size * 0.5 + 2 : 0
    const height = mode === 0 ? size * 0.2 + 1.4 : mode === 1 ? size * 0.12 + 0.6 : 0
    // camera trails the heading with a little lag so turns feel heavy
    const targetPos = new V(f.pos.x, f.pos.y, f.pos.z)
    let desired
    if (mode === 2) {
      desired = m.headWorld(new V()).addScaledVector(this.fwd, 0.25)
    } else {
      const flat = new V(Math.sin(f.yaw), 0, Math.cos(f.yaw))
      const back = this.fwd.clone().multiplyScalar(0.55).addScaledVector(flat, 0.45).normalize()
      desired = targetPos.clone().addScaledVector(back, -dist)
      desired.y += height + dist * 0.12
    }
    const k = this.camSnap || mode === 2 ? 1 : 1 - Math.exp(-dt * 7)
    this.camPos.lerp(desired, k)
    this.camSnap = false
    const cam = this.camera
    // never dip below the ground
    const gh = Math.max(heightAt(this.camPos.x, this.camPos.z), 0) + 1.5
    if (this.camPos.y < gh) this.camPos.y = gh
    cam.position.copy(this.camPos)
    const look = targetPos.clone().addScaledVector(this.fwd, mode === 2 ? 40 : dist * 1.6)
    look.y += mode === 2 ? 0 : size * 0.05
    cam.lookAt(look)
    // bank the horizon slightly with the bird
    cam.rotateZ(-f.roll * (mode === 2 ? 0.5 : 0.18))
    // shake
    const sh = (this.cam.shake = Math.max(0, this.cam.shake - dt * 2.2))
    const shake = sh * 0.5 + f.turb * 0.05 + (f.abilityKind('burst') ? 0.04 : 0)
    if (shake > 0.001) cam.position.add(new V(this.noise(this.time * 30, 1), this.noise(this.time * 33, 2), this.noise(this.time * 29, 3)).multiplyScalar(shake))
    this.fovKick = Math.max(0, (this.fovKick || 0) - dt * 2.2)
    const fovT = 60 + clamp(f.speed / f.vTop, 0, 1.4) * 13 + (f.abilityKind('burst') ? 8 : 0) + (f.abilityKind('dive') ? 6 : 0) + this.fovKick * 9
    this.cam.fov = lerp(this.cam.fov, fovT, 1 - Math.exp(-dt * 3))
    if (Math.abs(cam.fov - this.cam.fov) > 0.05) { cam.fov = this.cam.fov; cam.updateProjectionMatrix() }
  }

  // ------------------------------------------------------------ menu cameras
  updateTitle(dt) {
    const p = this.player
    if (!p) return
    if (this.camera.view?.enabled) this.camera.clearViewOffset()
    this.menuAngle += dt * 0.11
    const a = this.menuAngle
    const R = 650
    const cx = 120, cz = -60
    const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R
    const y = Math.max(heightAt(x, z), 0) + 190 + Math.sin(a * 2.1) * 30
    const r = p.model.root
    // moving counterclockwise in the x/z plane
    const yaw = Math.atan2(-Math.sin(a), Math.cos(a))
    r.position.set(x, y, z)
    r.rotation.order = 'YXZ'
    r.rotation.set(0.04, yaw, 0.38)
    p.model.update(dt, { flap: 0.3 + 0.25 * Math.sin(this.time * 0.5), speed: 0.5, time: this.time, turn: 0.5, bank: 0.38 })
    const size = Math.max(p.model.span, p.model.length * 1.3)
    const off = a + 2.4 + Math.sin(this.time * 0.12) * 0.5
    let dist = size * 2.1 + 6
    const asp = ui.vw / ui.vh
    if (asp < 1) dist = Math.max(dist, (size * 0.9) / (Math.tan(26 * Math.PI / 180) * asp))
    this.camera.position.set(x + Math.cos(off) * dist * 0.9, y + size * 0.35 + 1.5, z + Math.sin(off) * dist * 0.9)
    const lookAt = new V(x, y, z)
    this.camera.lookAt(lookAt)
    this.camera.fov = 52
    this.camera.updateProjectionMatrix()
    this.camPos.copy(this.camera.position)
    this.placeShadowFor(r.position)
    hud.speed = 0
  }

  updateHangar(dt) {
    const p = this.player
    if (!p || !this.showcase) return
    const s = this.showcase
    const r = p.model.root
    r.position.set(s.x, s.y + Math.sin(this.time * 0.9) * 0.15, s.z)
    r.rotation.order = 'YXZ'
    r.rotation.set(-0.05, 0, 0.0)
    const flap = 0.2 + 0.12 * Math.sin(this.time * 0.6)
    p.model.update(dt, { flap, speed: 0.4, time: this.time, turn: 0, bank: 0 })
    if (!this.cam.drag) this.cam.yawOrbit += dt * 0.12
    const size = Math.max(p.model.span, p.model.length * 1.3)
    const aspect = ui.vw / ui.vh
    let dist = (size * 1.45 + 2.2) * this.cam.zoom
    if (aspect < 1) dist = Math.max(dist, (size * 0.5 * this.cam.zoom) / (Math.tan((38 / 2) * Math.PI / 180) * aspect))
    const yaw = this.cam.yawOrbit, pit = this.cam.pitchOrbit
    this.camera.position.set(s.x + Math.sin(yaw) * Math.cos(pit) * dist, s.y + Math.sin(pit) * dist + size * 0.06, s.z + Math.cos(yaw) * Math.cos(pit) * dist)
    // shift the view so the bird sits to the right of the centre panel layout
    this.camera.lookAt(s.x, s.y + size * 0.02, s.z)
    this.camera.fov = 38
    const W = ui.vw, H = ui.vh
    if (aspect < 1) this.camera.setViewOffset(W, H, 0, H * 0.3, W, H)
    else if (ui.compact) this.camera.setViewOffset(W, H, W * 0.2, 0, W, H)
    else if (this.camera.view?.enabled) this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    const off = this.camera.position.clone().sub(new V(s.x, s.y, s.z))
    void off
    this.camPos.copy(this.camera.position)
    this.placeShadowFor(r.position)
  }

  placeShadowFor(pos) {
    const gh = Math.max(heightAt(pos.x, pos.z), 0)
    this.shadow.position.set(pos.x, gh + 0.25, pos.z)
    const alt = pos.y - gh
    const span = this.player?.model.span || 3
    const s = span * 0.5 * (1 + alt * 0.0009)
    this.shadow.scale.set(s, s * 0.8, s)
    this.shadow.material.opacity = clamp(0.38 - alt * 0.00045, 0.04, 0.38) * (0.2 + this.sunPower * 0.8)
  }

  emitTrail() {
    if (!this.trailOn || !this.player || this.view !== 'play') return
    const f = this.player.flight
    if (f.onGround || f.speed < f.cruise * 0.55) return
    const g = this.trail.geometry
    const pos = g.attributes.position, birth = g.attributes.aBirth
    const a = this.player.model.tipWorld(0, new V())
    const b = this.player.model.tipWorld(1, new V())
    for (const v of [a, b]) {
      const i = this.trailIdx++ % this.trailN
      pos.setXYZ(i, v.x, v.y, v.z)
      birth.setX(i, this.time)
    }
    pos.needsUpdate = true
    birth.needsUpdate = true
  }

  // ------------------------------------------------------------ world per frame
  updateWorld(dt) {
    const c = this.camPos
    const t = this.time
    this.water.userData.update(c.x, c.z, t)
    const pp = this.player?.model.root.position
    if (this.view === 'play' && pp) this.placeShadowFor(pp)
    this.sun.position.copy(c).addScaledVector(this.sunDir, 2000)
    this.sun.target.position.copy(c)
    this.moon.position.copy(c).addScaledVector(this.sunDir, -2000)
    this.moon.target.position.copy(c)
    const menuView = this.view !== 'play'
    this.fill.intensity = menuView ? 0.55 + this.nightK * 1.1 : this.nightK * 1.4
    this.fill.position.copy(c).add(new V(0, 6, 0))
    this.fill.target.position.copy(this.player ? this.player.model.root.position : c)
    this.sky.position.copy(c)
    this.stars.position.copy(c)
    this.trees.userData.update(c.x, c.z, 4600 * (0.55 + 0.45 * this.resScale))
    this.trailMat.uniforms.uTime.value = t
    this.thermalVis.material.uniforms.uTime.value = t
    this.thermalVis.material.uniforms.uCam.value.copy(c)
    const thermalBoost = this.player?.flight.flags.lift ? 1 : 0
    this.thermalVis.material.uniforms.uBoost.value = lerp(this.thermalVis.material.uniforms.uBoost.value, thermalBoost, 1 - Math.exp(-dt * 3))
    this.camera.getWorldDirection(this.camDir)
    this.airfields.userData.update(t, this.windAt(0, 50, 0, t), c, this.camDir)
    this.traffic.update(dt, t, c, this.view !== 'hangar')
    this.city.userData.update(dt, t, c, this.camDir)
    this.horizon.position.set(c.x, 0, c.z)
    this.kites.userData.update(dt, t, c)
    if (this.shadowsOn) {
      const px = this.player ? this.player.model.root.position.x : c.x, pz = this.player ? this.player.model.root.position.z : c.z
      const sx = Math.round(px / 6) * 6, sz = Math.round(pz / 6) * 6
      this.sun.target.position.set(sx, 60, sz)
      this.sun.position.set(sx + this.sunDir.x * 1500, 60 + this.sunDir.y * 1500, sz + this.sunDir.z * 1500)
    }

    // arrow trail toward the goal
    const wpt = this.view === 'play' && !this.paused ? this.mode?.waypoint?.() : null
    this.pathGroup.visible = !!wpt
    if (wpt && this.player) {
      const f = this.player.flight
      const dx = wpt.x - f.pos.x, dz = wpt.z - f.pos.z
      const hd = Math.hypot(dx, dz) || 1
      const dy = (wpt.y ?? f.pos.y) - f.pos.y
      for (let i = 0; i < this.pathDots.length; i++) {
        const d = 110 * (i + 1) + 60
        const sp = this.pathDots[i]
        if (d > hd - 90) { sp.material.opacity = 0; continue }
        const k = d / hd
        sp.position.set(f.pos.x + dx * k, f.pos.y + dy * k + Math.sin(t * 3 + i * 0.7) * 2.5 + 6, f.pos.z + dz * k)
        sp.scale.setScalar(16 + d * 0.025)
        sp.material.opacity = 0.9 * (1 - i / this.pathDots.length) * (0.6 + 0.4 * Math.sin(t * 5 - i * 0.8))
      }
    }

    // cloud cover
    const cover = this.view === 'play' ? this.wx.cloud : this.view === 'hangar' ? 0.04 : Math.min(this.wx.cloud, 0.3)
    const cl = this.clouds.userData.clusters
    for (let i = 0; i < cl.length; i++) cl[i].visible = cl[i].userData.order < cover

    // rain
    const rainU = this.rain.material.uniforms
    rainU.uTime.value = t
    rainU.uCam.value.copy(c)
    rainU.uAmt.value = clamp(this.wx.rain, 0, 1.6)
    const vel = this.player ? new V().set(0, 0, 0).addScaledVector(this.getVel(), 1) : new V()
    rainU.uVel.value.copy(vel)
    this.rain.visible = this.wx.rain > 0.02
    const su = this.streaks.material.uniforms
    su.uCam.value.copy(c)
    const sp = this.player && this.view === 'play' ? this.player.flight.speed / this.player.flight.vTop : 0
    su.uVel.value.copy(vel)
    su.uAmt.value = clamp((sp - 0.55) * 2.2, 0, 1) + (this.player?.flight.abilityKind('burst') ? 0.5 : 0)

    // lightning during storms
    if (this.weatherKey === 'storm' && this.view !== 'title') {
      this.nextLightning -= dt
      if (this.nextLightning < 0) { this.lightning = 1; this.nextLightning = 4 + Math.random() * 9 }
    }
    this.lightning = Math.max(0, this.lightning - dt * 4)
    this.hemi.intensity = (this.hemiBase || 0.4) + this.lightning * 2.4

    this.bloom.strength = (this.useComposer ? 0.16 : 0) + this.lightning * 0.4 + this.nightK * 0.2
    this.audio.update(sp, this.wx.rain, this.paused || this.view !== 'play')
  }

  getVel() {
    const f = this.player.flight
    const cp = Math.cos(f.pitch)
    return new V(Math.sin(f.yaw) * cp * f.speed + f.wind.x, Math.sin(f.pitch) * f.speed, Math.cos(f.yaw) * cp * f.speed + f.wind.z)
  }

  // ------------------------------------------------------------ HUD
  updateHud(dt) {
    this.hudTimer += dt
    if (this.hudTimer < (ui.touch ? 0.1 : 0.05)) return
    this.hudTimer = 0
    const f = this.player.flight
    hud.speed = Math.round(f.speed * 1.944)
    hud.groundSpeed = Math.round(f.groundSpeed * 1.944)
    hud.altitude = Math.round(f.pos.y)
    hud.flightLevel = Math.round(f.pos.y / 30.48)
    hud.agl = Math.round(f.pos.y - Math.max(heightAt(f.pos.x, f.pos.z), 0))
    hud.vspeed = Math.round(f.vy * 10) / 10
    hud.energy = f.energy
    hud.energyRate = f.energyRate
    hud.heading = ((Math.PI - f.yaw) * 180 / Math.PI % 360 + 360) % 360
    hud.windSpeed = Math.round(Math.hypot(f.wind.x, f.wind.z) * 1.944)
    hud.windDir = ((Math.atan2(f.wind.x, -f.wind.z)) * 180 / Math.PI + 360) % 360
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw)
    hud.headwind = Math.round(-(f.wind.x * fx + f.wind.z * fz) * 1.944)
    hud.onGround = f.onGround
    hud.thermal = f.thermal > 0.8
    hud.turbulence = f.turb
    hud.stall = f.stalling
    hud.pos = { x: f.pos.x, z: f.pos.z, yaw: f.yaw }
    hud.visibility = Math.round(clamp(100 - this.wx.fog * 60000, 6, 100))
    const hh = Math.floor(this.hour), mm = Math.floor((this.hour - hh) * 60)
    hud.clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    hud.ceiling = Math.round(f.ceiling)
    hud.plane = !!f.planeMode
    hud.assist2 = profile.settings.landAssist !== false
    hud.assisting = !!f.assisting
    hud.canPlane = true
    hud.state = stateAt(f.pos.x, f.pos.z).name
    hud.outside = !!f.outside
    hud.ability = f.abilities.map((a) => ({
      name: a.def.name, locked: !a.unlocked,
      ready: a.active > 0 ? 0 : a.cd > 0 ? 1 - a.cd / (a.cdTotal || 1) : 1,
      active: a.active > 0 ? a.active / (a.total || 1) : 0,
    }))
    hud.assist = !!this.assist
    hud.cam = this.cam.mode
    // waypoint projection
    const wp = this.mode?.waypoint?.()
    if (wp) {
      const dx = wp.x - f.pos.x, dz = wp.z - f.pos.z
      hud.wpDist = Math.round(Math.hypot(dx, dz))
      hud.wpName = wp.name || ''
      hud.wpBearing = ((Math.atan2(dx, -dz)) * 180 / Math.PI + 360) % 360
      const s = this.project(wp.x, wp.y ?? f.pos.y, wp.z)
      hud.wpScreen = { x: s.x, y: s.y, behind: s.behind, kind: wp.kind || 'wp' }
      hud.guideDy = Math.round((wp.y ?? f.pos.y) - f.pos.y)
      hud.relBearing = ((hud.wpBearing - hud.heading + 540) % 360) - 180
      if (hud.wpDist > 220 && Math.abs(hud.relBearing) > 100 && this.time - (this.lastWrong || -9) > 3) { this.audio.wrong(); this.lastWrong = this.time }
    } else { hud.relBearing = 0; hud.wpScreen = null; hud.wpDist = 0; hud.wpName = ''; hud.guideDy = hud.guideAlt ? Math.round(hud.guideAlt - f.pos.y) : 0 }
    hud.distance = Math.round(f.distance)
  }
}

const tick = () => new Promise((r) => setTimeout(r, 16))
export { LANDMARKS, AIRFIELDS, THERMALS, HALF }
