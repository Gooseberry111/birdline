import * as THREE from 'three'
import { Flight } from './flight'
import { createBird } from './birdModel'
import { heightAt, AIRFIELDS, LANDMARKS, THERMALS, HALF, NIGER, CITY, siteById } from './terrain'
import { makeRng, clamp, lerp } from './noise'
import { BIRDS, birdById } from '../data/birds'
import { profile, ui, hud, award, toast, effectiveStats, masteryFor, claimDaily, checkAch } from '../store'
import { glowTexture } from './scenery'
import { MISSIONS, CAPTAIN } from '../data/missions'
import { coinLine } from './coins'
import { apronSlot, parkedYaw, runwayEnds, runwayFrame, runwayLen, nearestField } from './airfield'

const V = THREE.Vector3
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const fmtTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`
}

const AF = (id) => AIRFIELDS.find((a) => a.id === id)
const runwayAxis = (a) => ({ x: Math.cos(a.dir), z: -Math.sin(a.dir) })
const runwayYaw = (a) => Math.atan2(Math.cos(a.dir), -Math.sin(a.dir))

function makeGate(radius, color, intensity) {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.2 })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.045, 12, 64), mat)
  g.add(ring)
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.97, radius * 0.995, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  g.add(inner)
  g.userData = { ring, mat, inner }
  return g
}

class BaseMode {
  constructor(engine, opts = {}) {
    this.e = engine
    this.opts = opts
    this.group = new THREE.Group()
    engine.scene.add(this.group)
    this.time = 0
    this.locked = false
    this.finished = false
    this.disposables = []
    this.bonus = []
  }

  get f() { return this.e.player.flight }

  hudDue(dt) {
    this.hudT = (this.hudT || 0) + dt
    if (this.hudT < 0.1) return false
    this.hudT = 0
    return true
  }

  dispose() {
    this.e.scene.remove(this.group)
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose())
    })
    for (const d of this.disposables) d()
  }

  setup(hour, weather, speed = 0.05) {
    const e = this.e
    e.hourSpeed = speed
    e.setHour(hour)
    let w = weather
    if (!w || w === 'auto') w = ['clear', 'clear', 'wind', 'rain'][Math.floor(Math.random() * 4)]
    e.setWeather(w, true)
    e.windDir = Math.random() * Math.PI * 2
    e.applyTimeOfDay(true)
  }

  conclude(res) {
    if (this.finished) return
    this.finished = true
    const bird = this.e.player.bird
    const before = masteryFor(bird.id).level
    const daily = claimDaily()
    if (daily) { res.miles += daily; res.lines = [...res.lines, ['Daily bonus', `+${daily} miles`], ['Streak', `${profile.daily.streak} ${profile.daily.streak === 1 ? 'day' : 'days'}`]] }
    profile.stats.flights++
    const out = award({ xp: res.xp, miles: res.miles, birdXp: res.birdXp, birdId: bird.id })
    setTimeout(checkAch, 900)
    ui.results = {
      ...res, bird: { name: bird.name, aircraft: bird.aircraft },
      levelUp: out.levelUp, mastered: out.mastered && out.mastered > before ? out.mastered : null,
      mode: this.id, opts: this.opts,
    }
    this.e.audio.success()
    this.e.setPaused(true)
    ui.screen = 'results'
  }
}

// ======================================================================== FREE FLIGHT
class FreeFlight extends BaseMode {
  constructor(e, o) {
    super(e, o)
    this.id = 'free'
    this.found = new Set()
    this.orbs = []
    this.collected = 0
    this.lowTimer = 0
    this.lowPasses = 0
    this.newLandmarks = 0
    this.altBonus = 0
  }

  start() {
    const e = this.e
    this.setup(this.opts.hour ?? 14.5, this.opts.weather, 0.06)
    const a = AF('home')
    const ax = runwayAxis(a)
    const len = a.r * 1.8
    e.spawn(a.x - ax.x * (len / 2 - 40), a.h + 1, a.z - ax.z * (len / 2 - 40), runwayYaw(a), 0, true)
    this.f.energy = 100

    // landmarks
    const mk = new THREE.Group()
    this.lmMeshes = []
    const tex = glowTexture()
    for (const lm of LANDMARKS) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#9bd8ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0 }))
      s.scale.setScalar(120)
      s.position.set(lm.x, lm.h + 90, lm.z)
      mk.add(s)
      this.lmMeshes.push(s)
    }
    this.group.add(mk)
    // energy orbs
    const rnd = makeRng(Math.floor(Math.random() * 99999))
    const orbMat = new THREE.SpriteMaterial({ map: tex, color: '#8fe6ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    const core = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7fd6ff', emissiveIntensity: 3.2 })
    const coreGeo = new THREE.IcosahedronGeometry(3.2, 1)
    let tries = 0
    while (this.orbs.length < 46 && tries++ < 900) {
      const x = (rnd() - 0.5) * HALF * 1.7, z = (rnd() - 0.5) * HALF * 1.7
      const gh = Math.max(heightAt(x, z), 0)
      const y = gh + 40 + rnd() * 420
      const grp = new THREE.Group()
      const sp = new THREE.Sprite(orbMat)
      sp.scale.setScalar(46)
      grp.add(sp, new THREE.Mesh(coreGeo, core))
      grp.position.set(x, y, z)
      grp.userData.taken = false
      this.group.add(grp)
      this.orbs.push(grp)
    }
    // golden coin lines to follow, spread around the airfield
    const coinPts = []
    const home = AF('home')
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2
      const r0 = 500 + (k % 3) * 400
      const a = { x: home.x + Math.cos(ang) * r0, z: home.z + Math.sin(ang) * r0 }
      const b = { x: home.x + Math.cos(ang + 0.5) * (r0 + 600), z: home.z + Math.sin(ang + 0.5) * (r0 + 600) }
      a.y = groundAt(a.x, a.z) + 90 + (k % 4) * 40
      b.y = groundAt(b.x, b.z) + 110 + (k % 3) * 50
      coinPts.push(a, ...coinLine(a, b, 80, 20, 8), b)
    }
    this.e.coins.set(coinPts)
    this.nextLowCheck = 0
    hud.objective = 'Free Flight'
    ui.tab = 'free'
  }

  onCoins(n) {
    award({ miles: n * 3 })
    profile.stats.coins += n
    this.coinCount = (this.coinCount || 0) + n
    hud.coinCount = this.coinCount
  }

  waypoint() {
    let best = null, bd = Infinity
    for (const lm of LANDMARKS) {
      if (profile.discovered.includes(lm.id) || this.found.has(lm.id)) continue
      const d = Math.hypot(lm.x - this.f.pos.x, lm.z - this.f.pos.z)
      if (d < bd) { bd = d; best = lm }
    }
    if (!best) return null
    return { x: best.x, y: best.h + 90, z: best.z, name: best.name, kind: 'landmark' }
  }

  update(dt) {
    this.time += dt
    const f = this.f
    const t = this.time
    const range = f.flags.focus ? 1.8 : 1
    // landmarks
    for (let i = 0; i < LANDMARKS.length; i++) {
      const lm = LANDMARKS[i]
      const seen = profile.discovered.includes(lm.id) || this.found.has(lm.id)
      this.lmMeshes[i].material.opacity = seen ? 0 : 0.5 + 0.2 * Math.sin(t * 2 + i)
      if (!seen && Math.hypot(lm.x - f.pos.x, lm.z - f.pos.z) < 330 && Math.abs(f.pos.y - lm.h) < 700) {
        this.found.add(lm.id)
        const first = !profile.discovered.includes(lm.id)
        if (first) {
          profile.discovered.push(lm.id)
          this.newLandmarks++
          const reward = lm.id.startsWith('site_') ? 40 : 150
          award({ xp: 20, miles: reward })
          toast(`Discovered ${lm.name}. +${reward} miles`, 'good')
        }
        this.e.audio.pickup()
      }
    }
    // orbs
    for (const o of this.orbs) {
      if (o.userData.taken) continue
      o.rotation.y += dt * 2
      o.children[0].scale.setScalar(46 + Math.sin(t * 3 + o.position.x) * 4)
      if (o.position.distanceTo(new V(f.pos.x, f.pos.y, f.pos.z)) < 32 * range) {
        o.userData.taken = true
        o.visible = false
        this.collected++
        f.energy = Math.min(100, f.energy + 28)
        this.e.audio.pickup()
        toast('Energy restored', 'good')
      }
    }
    // low pass
    const agl = f.pos.y - Math.max(heightAt(f.pos.x, f.pos.z), 0)
    if (!f.onGround && agl < 18 && f.speed > f.cruise * 0.8) {
      this.lowTimer += dt
      if (this.lowTimer > 3) { this.lowTimer = 0; this.lowPasses++; award({ miles: 15 }); toast('Low pass. +15 miles', 'good') }
    } else this.lowTimer = Math.max(0, this.lowTimer - dt)
    // altitude record
    if (f.maxAlt > profile.records.altitude + 25 && f.pos.y > 400) {
      if (!this.recordShown || f.maxAlt > this.recordShown + 200) {
        this.recordShown = f.maxAlt
        if (profile.records.altitude > 0) { toast(`New altitude record, ${Math.round(f.maxAlt)} m`, 'good'); award({ miles: 40 }); this.altBonus += 40 }
      }
    }
    if (!this.hudDue(dt)) return
    // HUD
    const total = LANDMARKS.length
    const done = LANDMARKS.filter((l) => profile.discovered.includes(l.id)).length
    hud.objective = `Discovered ${done} of ${total}   Orbs ${this.collected} of ${this.orbs.length}`
    hud.markers = [
      ...LANDMARKS.filter((l) => !profile.discovered.includes(l.id) && !this.found.has(l.id)).map((l) => ({ x: l.x, z: l.z, kind: 'landmark' })),
      ...AIRFIELDS.map((a) => ({ x: a.x, z: a.z, kind: 'airfield' })),
      ...(f.flags.lift ? THERMALS.map((th) => ({ x: th.x, z: th.z, kind: 'thermal' })) : []),
    ]
  }

  finish() {
    const f = this.f
    const km = f.distance / 1000
    const miles = Math.round(km * 18 + this.newLandmarks * 0 + this.collected * 30 + this.lowPasses * 0)
    profile.records.altitude = Math.max(profile.records.altitude, Math.round(f.maxAlt))
    profile.records.distance = Math.max(profile.records.distance, Math.round(f.distance))
    this.conclude({
      title: 'Flight complete', headline: `${km.toFixed(1)} km flown`,
      lines: [
        ['Distance', `${km.toFixed(1)} km`],
        ['Highest altitude', `${Math.round(f.maxAlt)} m`],
        ['New landmarks', `${this.newLandmarks}`],
        ['Energy orbs', `${this.collected}`],
        ['Low passes', `${this.lowPasses}`],
        ['Flight time', fmtTime(this.time)],
      ],
      miles, xp: Math.round(miles * 0.6 + 20), birdXp: Math.round(miles * 0.7 + 30),
    })
  }
}

// ======================================================================== AIR RACE
const GATE_R = 42

class AirRace extends BaseMode {
  constructor(e, o) {
    super(e, o)
    this.id = 'race'
    this.gates = []
    this.rivals = []
    this.state = 'countdown'
    this.count = 4
    this.next = 0
    this.clean = 0
    this.missed = 0
    this.penalty = 0
    this.raceTime = 0
    this.lastCount = 4
    this.prev = new V()
    this.finishOrder = []
  }

  buildCourse() {
    const n = 11
    const rnd = makeRng(Math.floor(Math.random() * 1e6))
    // try many loops around the home field and keep the one over the friendliest ground
    let best = null
    for (let c = 0; c < 70; c++) {
      const cx = (rnd() - 0.5) * 2400, cz = (rnd() - 0.5) * 2400
      const R = 1300 + rnd() * 700
      const start = rnd() * Math.PI * 2
      const pts = []
      let cost = 0
      for (let i = 0; i < n; i++) {
        const ang = start + (i / n) * Math.PI * 2
        const r = R * (0.85 + rnd() * 0.35)
        const x = clamp(cx + Math.cos(ang) * r, -HALF + 600, HALF - 600)
        const z = clamp(cz + Math.sin(ang) * r, -HALF + 600, HALF - 600)
        pts.push({ x, z, g: Math.max(heightAt(x, z), 0) })
      }
      for (let i = 0; i < n; i++) {
        const A = pts[i], B = pts[(i + 1) % n]
        for (let k = 0; k <= 10; k++) {
          const h = Math.max(heightAt(lerp(A.x, B.x, k / 10), lerp(A.z, B.z, k / 10)), 0)
          cost += h * h * 0.002 + (h > 260 ? (h - 260) * 3 : 0)
        }
      }
      if (!best || cost < best.cost) best = { cost, pts }
    }
    const pts = best.pts.map((p) => ({ x: p.x, z: p.z, y: p.g + 85 + rnd() * 55 }))
    // keep legs clear of the terrain and limit the climb between gates
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < n; i++) {
        const A = pts[i], B = pts[(i + 1) % n]
        for (let s2 = 0; s2 <= 14; s2++) {
          const k = s2 / 14
          const need = Math.max(heightAt(lerp(A.x, B.x, k), lerp(A.z, B.z, k)), 0) + 70
          const y = lerp(A.y, B.y, k)
          if (y < need) { const d = need - y; A.y += d * (1 - k); B.y += d * k }
        }
        const dy = B.y - A.y
        if (dy > 150) A.y += (dy - 150) * 0.5
        if (dy < -150) B.y += (-dy - 150) * 0.5
      }
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i], nx = pts[(i + 1) % n], pv = pts[(i + n - 1) % n]
      const dir = new V(nx.x - pv.x, nx.y - pv.y, nx.z - pv.z).normalize()
      this.gates.push({ pos: new V(p.x, p.y, p.z), dir, passed: false })
    }
    this.gates.pop()
  }

  pickRivals() {
    const mine = this.e.player.bird
    const pool = BIRDS.filter((b) => b.id !== mine.id && b.cls !== 'cargo')
    const diff = this.opts.difficulty || 'normal'
    const pace = diff === 'easy' ? 0.82 : diff === 'hard' ? 0.98 : 0.9
    const rnd = makeRng(Math.floor(Math.random() * 1e6))
    const chosen = []
    while (chosen.length < 3 && pool.length) chosen.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
    return chosen.map((b, i) => {
      const flight = new Flight(b, { ...b.stats }, { ai: true, mastery: 8 })
      const model = createBird(b, {}, {})
      this.e.scene.add(model.root)
      flight.groundOffset = model.groundOffset
      return { bird: b, flight, model, gate: 0, pace: pace * (0.97 + rnd() * 0.06), finished: false, finishTime: 0, abilityTimer: 6 + i * 3, prev: new V() }
    })
  }

  start() {
    const e = this.e
    this.setup(this.opts.hour ?? 16.2, this.opts.weather, 0)
    this.buildCourse()
    const g0 = this.gates[0]
    // starting grid 500 m before gate 0
    const back = new V(g0.dir.x, 0, g0.dir.z).normalize()
    const origin = g0.pos.clone().addScaledVector(back, -520)
    origin.y = Math.max(g0.pos.y - 25, Math.max(heightAt(origin.x, origin.z), 0) + 120)
    const yaw = Math.atan2(back.x, back.z)
    const side = new V(-back.z, 0, back.x)
    this.rivals = this.pickRivals()
    const slots = [-1.5, -0.5, 0.5, 1.5]
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
    const my = order[0]
    const place = (idx) => origin.clone().addScaledVector(side, slots[idx] * 55).addScaledVector(back, -idx * 6)
    const pp = place(my)
    e.spawn(pp.x, pp.y, pp.z, yaw, this.f.cruise * 0.9)
    this.rivals.forEach((r, i) => {
      const q = place(order[i + 1])
      r.flight.place(q.x, q.y, q.z, yaw, r.flight.cruise * 0.9)
      r.flight.energy = 100
    })
    this.gateObjs = this.gates.map((g, i) => {
      const obj = makeGate(GATE_R, i === 0 ? '#7fe3ff' : '#c8dcff', i === 0 ? 3.6 : 0.8)
      obj.position.copy(g.pos)
      obj.lookAt(g.pos.clone().add(g.dir))
      this.group.add(obj)
      return obj
    })
    this.locked = true
    this.count = 4.2
    this.prev.set(this.f.pos.x, this.f.pos.y, this.f.pos.z)
    this.rivals.forEach((r) => r.prev.set(r.flight.pos.x, r.flight.pos.y, r.flight.pos.z))
    // name tags over every rival so you can see who is who and how far away they are
    this.tags = this.rivals.map((r, i) => {
      const cv = document.createElement('canvas')
      cv.width = 320; cv.height = 80
      const tex = new THREE.CanvasTexture(cv)
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false }))
      sp.scale.set(0.2, 0.05, 1)
      sp.renderOrder = 12
      this.group.add(sp)
      return { sp, cv, tex, last: '' }
    })
    ui.tab = 'race'
    hud.objective = 'Air Race'
    hud.rings = this.gates.length
    hud.ring = 0
    this.updateGateVisuals()
    toast('Pass through every gate. Centre passes score more.')
  }

  waypoint() {
    const g = this.gates[Math.min(this.next, this.gates.length - 1)]
    return { x: g.pos.x, y: g.pos.y, z: g.pos.z, name: `Gate ${this.next + 1}`, kind: 'gate' }
  }

  updateGateVisuals() {
    this.gateObjs.forEach((o, i) => {
      const passed = i < this.next
      const isNext = i === this.next
      o.userData.mat.emissiveIntensity = isNext ? 4.2 : passed ? 0.0 : 0.9
      o.userData.mat.emissive.set(isNext ? '#7fe3ff' : passed ? '#67d3a4' : '#c8dcff')
      o.userData.inner.material.opacity = isNext ? 0.18 : 0
      o.visible = !passed || i === this.next - 1
      o.scale.setScalar(isNext ? 1.08 : 1)
    })
  }

  crossing(prev, cur, gate, tolerance) {
    const n = gate.dir
    const d0 = new V().subVectors(prev, gate.pos).dot(n)
    const d1 = new V().subVectors(cur, gate.pos).dot(n)
    if (d0 < 0 && d1 >= 0) {
      const k = d0 / (d0 - d1)
      const hit = prev.clone().lerp(cur, k)
      const dist = hit.distanceTo(gate.pos)
      return { passed: dist <= GATE_R * tolerance, dist }
    }
    if (d1 > 380 && d0 >= 0) return { passed: false, dist: 999, overshoot: true }
    return null
  }

  steerAI(r, dt) {
    const f = r.flight
    const g = this.gates[Math.min(r.gate, this.gates.length - 1)]
    const target = g.pos.clone().addScaledVector(g.dir, 60)
    const dx = target.x - f.pos.x, dz = target.z - f.pos.z, dy = target.y - f.pos.y
    const hd = Math.hypot(dx, dz)
    const err = wrap(Math.atan2(dx, dz) - f.yaw)
    const roll = clamp(-err * 2.4, -1, 1)
    let desPitch = clamp(Math.atan2(dy, Math.max(hd, 80)), -0.55, 0.55)
    // terrain look ahead
    const ax = f.pos.x + Math.sin(f.yaw) * 320, az = f.pos.z + Math.cos(f.yaw) * 320
    const clear = f.pos.y - Math.max(heightAt(ax, az), heightAt(f.pos.x, f.pos.z), 0)
    if (clear < 80) desPitch = Math.max(desPitch, 0.5)
    const pitch = clamp((desPitch - f.pitch) * 3, -1, 1)
    // rubber band
    const myProg = this.progressOf(this.next, this.f)
    const rProg = this.progressOf(r.gate, f)
    const gap = myProg - rProg
    const band = clamp(gap * 0.2, -0.2, 0.22)
    const targetSpeed = f.cruise * 1.3 * r.pace * (1 + band)
    const flap = f.speed < targetSpeed || desPitch > 0.1
    const boost = f.speed < targetSpeed * 0.88 && f.energy > 25
    f.energy = Math.max(f.energy, 35)
    r.abilityTimer -= dt
    if (r.abilityTimer < 0) {
      r.abilityTimer = 7 + Math.random() * 8
      if (Math.abs(err) < 0.3 && hd > 500) f.useAbility(0)
    }
    return { pitch, roll, flap, boost, brake: false }
  }

  progressOf(gate, f) {
    const g = this.gates[Math.min(gate, this.gates.length - 1)]
    const d = Math.hypot(g.pos.x - f.pos.x, g.pos.z - f.pos.z)
    return gate + 1 - Math.min(d / 1300, 1)
  }

  update(dt) {
    const e = this.e
    const f = this.f
    // countdown
    if (this.state === 'countdown') {
      this.count -= dt
      const c = Math.ceil(this.count)
      if (c !== this.lastCount && c >= 0) {
        this.lastCount = c
        if (c > 0 && c < 4) e.audio.count(false)
      }
      hud.countdown = this.count > 0 && this.count < 4 ? Math.ceil(this.count) : this.count <= 0 && this.count > -0.8 ? -1 : 0
      if (this.count <= 0) { this.state = 'racing'; this.locked = false; e.audio.count(true) }
    } else if (this.state === 'racing') {
      this.raceTime += dt
      hud.countdown = this.raceTime < 0.9 ? -1 : 0
    }
    this.time += dt

    // rivals always fly, even through the countdown
    this.rivals.forEach((r, i) => {
      const tg = this.tags && this.tags[i]
      if (!tg) return
      tg.sp.position.set(r.flight.pos.x, r.flight.pos.y + 7, r.flight.pos.z)
      const d = Math.hypot(r.flight.pos.x - f.pos.x, r.flight.pos.y - f.pos.y, r.flight.pos.z - f.pos.z)
      tg.sp.material.opacity = d < 18 ? 0.35 : 1
      tg.sp.visible = !r.finished || true
    })
    for (const r of this.rivals) {
      if (r.finished) continue
      const input = this.state === 'countdown' ? { pitch: 0, roll: 0, flap: r.flight.speed < r.flight.cruise * 0.9, boost: false } : this.steerAI(r, dt)
      r.flight.update(dt, input, { time: e.time, windAt: e.windAt, noise: e.noise })
      r.flight.events.length = 0
      const root = r.model.root
      root.position.set(r.flight.pos.x, r.flight.pos.y, r.flight.pos.z)
      root.rotation.order = 'YXZ'
      root.rotation.set(-r.flight.pitch, r.flight.yaw, r.flight.roll)
      r.model.update(dt, { flap: r.flight.flapping, speed: r.flight.speed / r.flight.vTop, fold: r.flight.abilityKind('dive') ? 1 : 0, time: e.time, turn: -r.flight.turnSmooth / 1.5, bank: r.flight.roll })
      if (this.state === 'racing') {
        const g = this.gates[r.gate]
        const cur = new V(r.flight.pos.x, r.flight.pos.y, r.flight.pos.z)
        const c = this.crossing(r.prev, cur, g, 1.4)
        if (c && (c.passed || c.overshoot)) {
          r.gate++
          if (r.gate >= this.gates.length) { r.finished = true; r.finishTime = this.raceTime; this.finishOrder.push(r) }
        }
        r.prev.copy(cur)
      } else r.prev.set(r.flight.pos.x, r.flight.pos.y, r.flight.pos.z)
    }

    if (this.state === 'racing') {
      const cur = new V(f.pos.x, f.pos.y, f.pos.z)
      if (this.next < this.gates.length) {
        const g = this.gates[this.next]
        const tol = f.flags.focus ? 1.5 : 1
        const c = this.crossing(this.prev, cur, g, tol)
        if (c) {
          if (c.passed) {
            const clean = c.dist < GATE_R * 0.4
            if (clean) { this.clean++; toast('Clean pass. Precision bonus', 'good') }
            e.audio.gate(clean)
          } else {
            this.missed++
            this.penalty += 2.5
            toast('Gate missed. +2.5 s', 'bad')
            e.audio.thud()
          }
          this.next++
          hud.ring = this.next
          if (this.next < this.gates.length) this.updateGateVisuals()
          else this.finishRace(false)
        }
      }
      this.prev.copy(cur)
      if (this.raceTime > 480) this.finishRace(true)
    }

    if (!this.hudDue(dt)) return
    // standings
    const entries = [
      { name: e.player.bird.name, aircraft: e.player.bird.aircraft, me: true, prog: this.next >= this.gates.length ? 99 : this.progressOf(this.next, f) },
      ...this.rivals.map((r) => ({ name: r.bird.name, aircraft: r.bird.aircraft, me: false, prog: r.finished ? 99 - r.finishTime * 0.001 : this.progressOf(r.gate, r.flight) })),
    ].sort((a, b) => b.prog - a.prog)
    hud.standings = entries
    hud.position = entries.findIndex((x) => x.me) + 1
    hud.field = entries.length
    // tags and overtake callouts
    const rankNow = hud.position
    if (this.state === 'racing' && this.lastRank && rankNow !== this.lastRank) {
      const ord = ['', '1st', '2nd', '3rd', '4th'][rankNow]
      if (rankNow < this.lastRank) { const lost = entries[rankNow]; toast(`You passed ${lost ? lost.name : 'a rival'}! Now ${ord}`, 'good'); e.audio.gate(true) }
      else { const ahead = entries[rankNow - 2]; toast(`${ahead ? ahead.name : 'A rival'} passed you. ${ord} now`, 'bad'); e.audio.wrong() }
    }
    this.lastRank = rankNow
    const myP = this.progressOf(this.next, f)
    this.rivals.forEach((r, i) => {
      const tag = this.tags[i]
      const rp = r.finished ? 99 : this.progressOf(r.gate, r.flight)
      const dist = Math.round(Math.hypot(r.flight.pos.x - f.pos.x, r.flight.pos.y - f.pos.y, r.flight.pos.z - f.pos.z))
      const ahead = rp > myP
      const rank = entries.findIndex((x) => x.name === r.bird.name && !x.me) + 1
      const text = `${rank}  ${r.bird.name}`
      const sub = ahead ? `\u25B2 ${dist} m ahead` : `\u25BC ${dist} m behind`
      const key = text + sub
      if (tag.last !== key) {
        tag.last = key
        const g2 = tag.cv.getContext('2d')
        g2.clearRect(0, 0, 320, 80)
        g2.fillStyle = 'rgba(8,22,46,0.88)'
        g2.beginPath(); g2.roundRect(3, 3, 314, 74, 14); g2.fill()
        g2.strokeStyle = ahead ? '#ff8f7a' : '#a9dcff'; g2.lineWidth = 3; g2.stroke()
        g2.fillStyle = '#ffffff'; g2.font = '600 34px "Barlow Condensed", Arial Narrow, sans-serif'; g2.textAlign = 'center'
        g2.fillText(text, 160, 34)
        g2.fillStyle = ahead ? '#ffb4a5' : '#a9dcff'; g2.font = '500 26px "Barlow Condensed", Arial Narrow, sans-serif'
        g2.fillText(sub, 160, 64)
        tag.tex.needsUpdate = true
      }
    })
    hud.timer = this.raceTime + this.penalty
    hud.objective = `Gate ${Math.min(this.next + 1, this.gates.length)} of ${this.gates.length}`
    hud.markers = [
      ...this.gates.map((g, i) => ({ x: g.pos.x, z: g.pos.z, kind: i === this.next ? 'gatenext' : i < this.next ? 'gatedone' : 'gate' })),
      ...this.rivals.map((r) => ({ x: r.flight.pos.x, z: r.flight.pos.z, kind: 'rival' })),
    ]
  }

  finishRace(dnf) {
    if (this.finished) return
    const f = this.f
    const mine = this.progressOf(this.next, f)
    let pos = 1
    for (const r of this.rivals) {
      if (r.finished || this.progressOf(r.gate, r.flight) > (dnf ? mine : 99)) pos++
    }
    const total = this.raceTime + this.penalty
    const payout = [900, 550, 300, 100]
    const diffMul = { easy: 0.8, normal: 1, hard: 1.35 }[this.opts.difficulty || 'normal']
    const miles = Math.round(((dnf ? 60 : 250 + payout[pos - 1]) + this.clean * 25) * diffMul)
    const best = profile.records.bestRace
    if (!dnf && (!best || total < best)) profile.records.bestRace = Math.round(total * 100) / 100
    this.conclude({
      title: dnf ? 'Race abandoned' : pos === 1 ? 'Race won' : `Finished ${['', '1st', '2nd', '3rd', '4th'][pos]}`,
      headline: dnf ? 'Did not finish' : fmtTime(total),
      lines: [
        ...(hud.standings || []).map((en, i) => [['1st', '2nd', '3rd', '4th'][i], `${en.name} ${en.aircraft}${en.me ? ' (you)' : ''}`]),
        ['Position', dnf ? 'DNF' : `${pos} of ${this.rivals.length + 1}`],
        ['Race time', fmtTime(this.raceTime)],
        ['Penalties', `${this.penalty.toFixed(1)} s`],
        ['Clean gates', `${this.clean}`],
        ['Missed gates', `${this.missed}`],
        ['Best time', profile.records.bestRace ? fmtTime(profile.records.bestRace) : 'None'],
      ],
      miles, xp: Math.round(miles * 0.55 + 30), birdXp: Math.round(miles * 0.65 + 40),
    })
  }

  finish() { this.finishRace(true) }

  dispose() {
    for (const r of this.rivals) { this.e.scene.remove(r.model.root); r.model.dispose() }
    for (const tg of this.tags || []) tg.tex.dispose()
    hud.standings = []
    super.dispose()
  }
}

// ======================================================================== LONG HAUL
class LongHaul extends BaseMode {
  constructor(e, o) {
    super(e, o)
    this.id = 'haul'
    this.wps = []
    this.next = 0
    this.strand = 0
    this.wpHit = 0
  }

  start() {
    const e = this.e
    this.setup(this.opts.hour ?? 9.5, this.opts.weather, 0.03)
    const home = AF('home')
    const opts = AIRFIELDS.filter((a) => a.id !== 'home')
    const dest = AF(this.opts.dest) || opts[Math.floor(Math.random() * opts.length)]
    this.dest = dest
    const dx = dest.x - home.x, dz = dest.z - home.z
    this.total = Math.hypot(dx, dz)
    const yaw = Math.atan2(dx, dz)
    const startAlt = Math.max(heightAt(home.x, home.z), 0) + 480
    e.spawn(home.x, startAlt, home.z, yaw, this.f.cruise)
    // route waypoints, bent toward nearby thermals where there are any
    for (let i = 1; i <= 3; i++) {
      const k = i / 4
      let x = home.x + dx * k, z = home.z + dz * k
      let best = null, bd = 900
      for (const t of THERMALS) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t } }
      if (best) { x = lerp(x, best.x, 0.8); z = lerp(z, best.z, 0.8) }
      const y = Math.max(heightAt(x, z), 0) + 320 + (3 - i) * 120
      const ring = makeGate(95, '#7fe3ff', 2.6)
      ring.position.set(x, y, z)
      ring.lookAt(dest.x, y, dest.z)
      this.group.add(ring)
      this.wps.push({ x, y, z, ring, name: `Waypoint ${i}`, done: false })
    }
    this.startTime = 0
    this.minEnergy = 100
    ui.tab = 'haul'
    hud.objective = `Long Haul to ${dest.name}`
    toast(`Route set for ${dest.name}. Land on arrival.`)
  }

  waypoint() {
    const w = this.wps[this.next]
    if (w) return { x: w.x, y: w.y, z: w.z, name: w.name, kind: 'wp' }
    return { x: this.dest.x, y: this.dest.h + 80, z: this.dest.z, name: this.dest.name, kind: 'dest' }
  }

  update(dt) {
    this.time += dt
    const f = this.f
    const w = this.wps[this.next]
    if (w) {
      const d = Math.hypot(w.x - f.pos.x, w.y - f.pos.y, w.z - f.pos.z)
      w.ring.userData.inner.material.opacity = 0.14
      if (d < 100 * (f.flags.focus ? 1.5 : 1)) {
        w.done = true; w.ring.visible = false
        this.next++; this.wpHit++
        award({ miles: 40 })
        toast(`${w.name} reached. +40 miles`, 'good')
        this.e.audio.gate(true)
      }
    }
    this.minEnergy = Math.min(this.minEnergy, f.energy)
    const dd = Math.hypot(this.dest.x - f.pos.x, this.dest.z - f.pos.z)
    if (this.hudDue(dt)) {
    hud.timer = this.time
    hud.objective = `${(dd / 1000).toFixed(1)} km to ${this.dest.name}`
    hud.markers = [
      ...AIRFIELDS.map((a) => ({ x: a.x, z: a.z, kind: a.id === this.dest.id ? 'dest' : 'airfield' })),
      ...this.wps.filter((x) => !x.done).map((x) => ({ x: x.x, z: x.z, kind: 'gate' })),
      ...(f.flags.lift ? THERMALS.map((th) => ({ x: th.x, z: th.z, kind: 'thermal' })) : []),
    ]
    }
    if (f.onGround) {
      if (dd < this.dest.r + 60) { this.arrive(); return }
      if (f.energy < 3) {
        this.strand += dt
        if (this.strand > 5) this.stranded()
      }
    } else this.strand = 0
  }

  arrive() {
    const f = this.f
    const km = this.total / 1000
    const eta = this.total / (f.cruise * 1.05)
    const timeBonus = Math.max(0, Math.round((eta - this.time) * 1.2))
    const miles = Math.round(km * 70 + f.energy * 3 + 200 + this.wpHit * 40 + timeBonus)
    const best = profile.records.longHaul
    if (!best || this.time < best) profile.records.longHaul = Math.round(this.time)
    profile.records.distance = Math.max(profile.records.distance, Math.round(f.distance))
    this.conclude({
      title: 'Arrived', headline: `${this.dest.name} in ${fmtTime(this.time)}`,
      lines: [
        ['Route length', `${km.toFixed(1)} km`],
        ['Flight time', fmtTime(this.time)],
        ['Energy remaining', `${Math.round(f.energy)} percent`],
        ['Waypoints', `${this.wpHit} of 3`],
        ['Time bonus', `${timeBonus} miles`],
        ['Landing', 'Smooth'],
      ],
      miles, xp: Math.round(miles * 0.5 + 40), birdXp: Math.round(miles * 0.6 + 50),
    })
  }

  stranded() {
    const f = this.f
    const dd = Math.hypot(this.dest.x - f.pos.x, this.dest.z - f.pos.z)
    const prog = clamp(1 - dd / this.total, 0, 1)
    const miles = Math.round(prog * this.total / 1000 * 30 + this.wpHit * 40)
    this.conclude({
      title: 'Out of energy', headline: `${Math.round(prog * 100)} percent of the route`,
      lines: [
        ['Route completed', `${Math.round(prog * 100)} percent`],
        ['Flight time', fmtTime(this.time)],
        ['Waypoints', `${this.wpHit} of 3`],
        ['Tip', 'Use thermals and glide to save energy'],
      ],
      miles, xp: Math.round(miles * 0.5 + 10), birdXp: Math.round(miles * 0.5 + 20),
    })
  }

  finish() { this.stranded() }
}

// ======================================================================== MISSIONS
const RING_R = 58

// local runway coordinates to world
function fieldPoint(a, lx, lz) {
  return { x: a.x + lx * Math.cos(a.dir) + lz * Math.sin(a.dir), z: a.z - lx * Math.sin(a.dir) + lz * Math.cos(a.dir) }
}
const groundAt = (x, z) => Math.max(heightAt(x, z), 0)

class MissionMode extends BaseMode {
  constructor(e, o) {
    super(e, o)
    this.id = 'missions'
    this.def = MISSIONS.find((m) => m.id === (o.mission || 'school')) || MISSIONS[0]
    this.si = 0
    this.steps = []
    this.coins = 0
    this.chain = 0
    this.chainT = 0
    this.bestChain = 0
    this.ringsDone = 0
    this.carrying = false
    this.limit = this.def.limit || 0
  }

  start() {
    const e = this.e
    this.setup(this.def.hour ?? this.opts.hour ?? 14.5, this.def.weather || (this.opts.weather === 'auto' ? 'clear' : this.opts.weather) || 'clear', 0.02)
    const a = AF('home')
    this.home = a
    const ax = runwayAxis(a)
    const len = a.r * 1.8
    this.ax = ax
    this.rwEnd = { x: a.x + ax.x * (len / 2), z: a.z + ax.z * (len / 2) }
    if (this.def.apron) {
      const sp = apronSlot(a, 3)
      e.spawn(sp.x, a.h + 1, sp.z, parkedYaw(a), 0, true)
    } else e.spawn(a.x - ax.x * (len / 2 - 40), a.h + 1, a.z - ax.z * (len / 2 - 40), runwayYaw(a), 0, true)
    this.f.energy = 100
    this.steps = this.buildSteps()
    ui.tab = 'mission'
    this.begin(0)
    this.e.radio.say(CAPTAIN, this.def.brief)
  }

  // ---------------------------------------------------------------- step factories
  takeoff() {
    const m = this
    return {
      text: 'Take off', short: 'Take off',
      hint: 'Hold Flap to run down the runway. You lift off by yourself.',
      target: { x: this.rwEnd.x, y: this.home.h + 40, z: this.rwEnd.z, name: 'End of runway', kind: 'wp' },
      update() { return !m.f.onGround && m.f.pos.y - groundAt(m.f.pos.x, m.f.pos.z) > 10 },
    }
  }

  climb(alt) {
    const m = this
    return {
      text: `Climb to ${alt} m`, short: `Climb to ${alt} m`, alt,
      hint: 'Pull the nose up (S or stick up) and keep flapping. Watch your speed.',
      target: null,
      update() { return m.f.pos.y >= alt },
    }
  }

  rings(points, label) {
    const m = this
    let idx = 0
    let objs = []
    return {
      text: label, short: label, points,
      hint: 'Fly through the glowing ring. Steer with A and D, or the stick.',
      get target() {
        const p = points[Math.min(idx, points.length - 1)]
        return { x: p.x, y: p.y, z: p.z, name: `Ring ${Math.min(idx + 1, points.length)} of ${points.length}`, kind: 'gate' }
      },
      enter() {
        objs = points.map((p, i) => {
          const prev = points[i - 1] || { x: m.f.pos.x, y: m.f.pos.y, z: m.f.pos.z }
          const next = points[i + 1] || { x: p.x + (p.x - prev.x), y: p.y, z: p.z + (p.z - prev.z) }
          const dir = new V(next.x - prev.x, next.y - prev.y, next.z - prev.z).normalize()
          const g = makeGate(RING_R, '#c8dcff', 0.9)
          g.position.set(p.x, p.y, p.z)
          g.lookAt(g.position.clone().add(dir))
          m.group.add(g)
          return { g, p, dir, prev: null }
        })
        this.refresh()
      },
      refresh() {
        objs.forEach((o, i) => {
          const done = i < idx, cur = i === idx
          o.g.userData.mat.emissiveIntensity = cur ? 4.2 : done ? 0 : 1
          o.g.userData.mat.emissive.set(cur ? '#7fe3ff' : done ? '#67d3a4' : '#c8dcff')
          o.g.userData.inner.material.opacity = cur ? 0.2 : 0
          o.g.visible = !done
          o.g.scale.setScalar(cur ? 1.1 : 1)
        })
      },
      update() {
        const o = objs[idx]
        if (!o) return true
        const cur = new V(m.f.pos.x, m.f.pos.y, m.f.pos.z)
        if (!o.prev) o.prev = cur.clone()
        const d0 = new V().subVectors(o.prev, new V(o.p.x, o.p.y, o.p.z)).dot(o.dir)
        const d1 = new V().subVectors(cur, new V(o.p.x, o.p.y, o.p.z)).dot(o.dir)
        const tol = RING_R * (m.f.flags.focus ? 1.5 : 1)
        let hit = null
        if (d0 < 0 && d1 >= 0) {
          const k = d0 / (d0 - d1)
          const dist = o.prev.clone().lerp(cur, k).distanceTo(new V(o.p.x, o.p.y, o.p.z))
          hit = dist <= tol ? 'pass' : 'miss'
          if (hit === 'pass' && dist < RING_R * 0.35) hit = 'centre'
        } else if (d1 > 300) hit = 'miss'
        o.prev.copy(cur)
        if (hit) {
          if (hit === 'miss') { m.chain = 0; toast('Missed that ring. Keep going', 'bad') }
          else m.ringPassed(hit === 'centre')
          idx++
          this.refresh()
        }
        return idx >= objs.length
      },
      exit() { objs.forEach((o) => m.group.remove(o.g)) },
    }
  }

  reach(pos, r, dy, text, hint, name, onDone) {
    const m = this
    let beam = null
    return {
      text, short: text, hint,
      target: { x: pos.x, y: pos.y, z: pos.z, name: name || text, kind: 'wp' },
      enter() {
        beam = new THREE.Group()
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 900, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))
        cyl.position.y = 380
        const ring = makeGate(r * 0.55, '#7fe3ff', 3.4)
        ring.rotation.x = Math.PI / 2
        beam.add(cyl, ring)
        beam.position.set(pos.x, pos.y, pos.z)
        m.group.add(beam)
      },
      update() {
        const f = m.f
        const ok = Math.hypot(f.pos.x - pos.x, f.pos.z - pos.z) < r && Math.abs(f.pos.y - pos.y) < dy
        if (ok && onDone) onDone()
        return ok
      },
      exit() { if (beam) m.group.remove(beam) },
    }
  }

  land(field, text) {
    const m = this
    let rings = []
    let L = null
    let lastHud = 0
    const label = text || `Land at ${field.name}`
    const towerName = `${field.name.replace(/ (Airport|Airstrip)$/, '')} Tower`
    let lastKey = ''
    let lastSay = -99
    const planeTip = () => (m.f.planeMode ? '' : 'Press T (or the Plane button) to turn into a plane for an easier landing')
    return {
      text: label, short: label, isLand: true,
      hint: 'Fly to the approach point, follow the rings down, ease off Flap. After you touch down hold Brake until you stop.',
      get target() {
        const f = m.f
        if (!L) return { x: field.x, y: field.h + 30, z: field.z, name: field.name, kind: 'dest' }
        if (f.onGround) return null
        const s = -((f.pos.x - L.T.x) * L.dir.x + (f.pos.z - L.T.z) * L.dir.z)
        // first lead the bird to the start of the approach, then down to the runway itself
        if (s > 1700) return { x: L.T.x - L.dir.x * 1500, y: L.g + 4 + 135, z: L.T.z - L.dir.z * 1500, name: 'Approach point', kind: 'wp' }
        if (s > 150) return { x: L.T.x, y: L.g + 3, z: L.T.z, name: 'Runway start', kind: 'dest' }
        // over the runway: look ahead along it so the arrow never points backwards
        const along = -s
        const ahead = Math.min(L.len * 0.92, Math.max(L.len * 0.4, along + 220))
        return { x: L.T.x + L.dir.x * ahead, y: L.g + 2, z: L.T.z + L.dir.z * ahead, name: 'Touch down', kind: 'dest' }
      },
      enter() {
        const f = m.f
        const [e0, e1] = runwayEnds(field)
        const d0 = Math.hypot(e0.x - f.pos.x, e0.z - f.pos.z), d1 = Math.hypot(e1.x - f.pos.x, e1.z - f.pos.z)
        const T = d0 < d1 ? e0 : e1, far = d0 < d1 ? e1 : e0
        const len = Math.hypot(far.x - T.x, far.z - T.z)
        L = { T, len, dir: { x: (far.x - T.x) / len, z: (far.z - T.z) / len }, g: groundAt(T.x, T.z) }
        for (const s of [1400, 900, 450]) {
          const g = makeGate(62, '#a9dcff', 1.8)
          g.position.set(T.x - L.dir.x * s, L.g + 4 + s * 0.09, T.z - L.dir.z * s)
          g.lookAt(g.position.clone().add(new V(L.dir.x, -0.09, L.dir.z)))
          m.group.add(g)
          rings.push(g)
        }
        m.e.landGuide = { T: L.T, dir: L.dir, g: L.g, len: L.len }
        m.e.radio.say(towerName, 'Runway clear. You are cleared to land. Landing assist is on, so just follow the rings.')
      },
      update(dt) {
        const f = m.f
        if (!L) return false
        const vx = f.pos.x - L.T.x, vz = f.pos.z - L.T.z
        const s = -(vx * L.dir.x + vz * L.dir.z)
        const lat = vx * -L.dir.z + vz * L.dir.x
        lastHud += dt
        if (lastHud > 0.1) {
          lastHud = 0
          if (f.onGround) hud.landing = { lines: [f.speed > 4 ? (ui.touch ? 'Touched down! Hold the Brake button until you stop' : 'Touched down! Hold Ctrl or X (Brake) until you stop') : 'Almost stopped. Hold still'], good: [f.speed <= 4], tip: '' }
          else if (s > -80 && s < 4800) {
            const dev = f.pos.y - (L.g + 3 + Math.max(s, 0) * 0.09)
            const lines = [], good = []
            lines.push(dev > 30 ? 'Too high: lower the nose' : dev < -18 ? 'Too low: climb gently' : 'On the glide path'); good.push(Math.abs(dev) <= 30 && dev >= -18)
            if (s > 150) { lines.push(Math.abs(lat) > 45 ? (lat > 0 ? 'Line up: move left' : 'Line up: move right') : 'Lined up with the runway'); good.push(Math.abs(lat) <= 45) }
            if (s < 1100) {
              const fast = f.speed > f.cruise * 0.82, slow = f.speed < f.stall * 1.15
              lines.push(fast ? 'Too fast: let go of Flap and brake' : slow ? 'Too slow: add Flap' : 'Speed is good'); good.push(!fast && !slow)
            }
            hud.landing = { lines, good, tip: planeTip() }
            hud.landing.assist = profile.settings.landAssist !== false
            const bad = lines.find((l, i) => !good[i])
            const key = bad || 'good'
            if (key !== lastKey && m.time - lastSay > 6 && s < 3200) {
              lastKey = key
              lastSay = m.time
              m.e.radio.say(towerName, bad ? bad.replace(': ', '. ') : 'You are on the glide path. Looking good.')
            }
          } else hud.landing = null
        }
        const fr = runwayFrame(field, f.pos.x, f.pos.z)
        return f.onGround && f.speed < 4 && Math.abs(fr.along) < runwayLen(field) / 2 + 90 && Math.abs(fr.side) < 70
      },
      exit() { rings.forEach((g) => m.group.remove(g)); hud.landing = null; m.e.landGuide = null },
    }
  }

  // stand still on a marker for a few seconds: boarding, loading or unloading
  board(spot, text, what, secs = 4) {
    const m = this
    let t = 0
    let mark = null
    return {
      text, short: text,
      hint: 'Taxi onto the glowing circle, let go of Flap and hold Brake until the bar fills.',
      target: { x: spot.x, y: groundAt(spot.x, spot.z) + 2, z: spot.z, name: what === 'unload' ? 'Terminal' : 'Boarding point', kind: 'wp' },
      enter() {
        mark = makeGate(20, '#7fe3ff', 3)
        mark.rotation.x = Math.PI / 2
        mark.position.set(spot.x, groundAt(spot.x, spot.z) + 0.8, spot.z)
        m.group.add(mark)
      },
      update(dt) {
        const f = m.f
        const near = Math.hypot(f.pos.x - spot.x, f.pos.z - spot.z) < 26
        if (f.onGround && near && f.speed < 2.5) t += dt
        else t = Math.max(0, t - dt * 2)
        hud.boardP = Math.min(1, t / secs)
        if (t >= secs) {
          if (what === 'unload') m.unloadCarry()
          else m.loadCarry(what)
          return true
        }
        return false
      },
      exit() { if (mark) m.group.remove(mark); hud.boardP = 0 },
    }
  }

  taxi(spot, text, near = 34) {
    const m = this
    return {
      text, short: text,
      hint: 'Stay on the ground. Flap gently to roll, steer with A and D, and brake to slow down.',
      target: { x: spot.x, y: groundAt(spot.x, spot.z) + 2, z: spot.z, name: text, kind: 'wp' },
      update() { return m.f.onGround && Math.hypot(m.f.pos.x - spot.x, m.f.pos.z - spot.z) < near },
    }
  }

  loadCarry(kind) {
    const f = this.f
    const root = this.e.player.model.root
    const span = this.e.player.model.span
    this.carry = kind
    this.carryMeshes = []
    if (kind === 'passengers') {
      f.load = 0.12
      this.comfort = 100
      const mat = new THREE.MeshStandardMaterial({ color: '#e8c9a0', roughness: 0.8 })
      for (const z of [-0.18, 0, 0.18]) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(span * 0.03, 10, 8), mat)
        p.position.set(0, span * 0.075, z * span * 0.6)
        root.add(p)
        this.carryMeshes.push(p)
      }
      toast('Passengers on board. Keep the ride smooth', 'good')
    } else {
      f.load = 0.6
      const mat = new THREE.MeshStandardMaterial({ color: '#8d9aab', roughness: 0.7 })
      for (const dx of [-0.12, 0.12]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(span * 0.09, span * 0.07, span * 0.11), mat)
        b.position.set(dx * span * 0.6, -span * 0.06, 0)
        root.add(b)
        this.carryMeshes.push(b)
      }
      toast('Cargo loaded. You will climb and turn slower', 'good')
    }
    this.e.audio.pickup()
  }

  unloadCarry() {
    const root = this.e.player.model.root
    for (const m of this.carryMeshes || []) root.remove(m)
    this.carryMeshes = []
    this.f.load = 0
    if (this.carry === 'passengers') {
      const bonus = Math.round((this.comfort ?? 100) * 2)
      this.coins += bonus
      toast(`Passengers happy ${Math.round(this.comfort ?? 100)} percent. +${bonus} miles`, 'good')
    } else toast('Cargo delivered', 'good')
    this.carry = null
    this.comfort = -1
    this.e.audio.success()
  }

  onEvent(ev) {
    if (ev.type !== 'land') return
    const cur = this.steps[this.si]
    if (!cur || !cur.isLand) return
    const fld = nearestField(ev.x, ev.z)
    const fr = runwayFrame(fld, ev.x, ev.z)
    const onRw = Math.abs(fr.along) < runwayLen(fld) / 2 + 30 && Math.abs(fr.side) < 32
    const sink = Math.abs(ev.vy || 0)
    const score = 100 - sink * 7 - Math.abs(fr.side) * 1.0 - Math.max(0, ev.speed - this.f.stall * 1.3) * 2.5 - (onRw ? 0 : 40) + (this.f.planeMode ? 12 : 0)
    let rating = 'Rough landing', bonus = 0
    if (score > 72) { rating = 'Perfect landing!'; bonus = 120 } else if (score > 52) { rating = 'Smooth landing'; bonus = 60 } else if (score > 30) { rating = 'Firm landing'; bonus = 20 }
    if (!onRw) rating += ' (off the runway)'
    this.landing = rating
    profile.stats.landings++
    if (bonus >= 120) profile.stats.perfect++
    this.coins += bonus
    if (this.comfort >= 0 && sink > 3) this.comfort = Math.max(0, this.comfort - (sink - 3) * 9)
    toast(`${rating}${bonus ? `  +${bonus} miles` : ''}`, bonus ? 'good' : 'bad')
    this.e.radio.say(`${fld.name.replace(/ (Airport|Airstrip)$/, '')} Tower`, `${rating.replace('!', '')}. Welcome to ${fld.name.replace(/ (Airport|Airstrip)$/, '')}. Hold the brake until you stop.`)
  }

  thermalClimb(alt) {
    const m = this
    return {
      text: `Climb to ${alt} m in rising air`, short: 'Ride the warm air', alt,
      hint: 'Fly into the glowing column on your map, then bank and circle inside it.',
      get target() {
        let best = THERMALS[0], bd = Infinity
        for (const t of THERMALS) {
          const d = Math.hypot(t.x - m.f.pos.x, t.z - m.f.pos.z)
          if (d < bd) { bd = d; best = t }
        }
        return { x: best.x, y: Math.max(m.f.pos.y, best.base + 120), z: best.z, name: 'Rising air', kind: 'wp' }
      },
      update() { return m.f.pos.y >= alt },
    }
  }

  // ---------------------------------------------------------------- mission scripts
  ringLine(from, to, n, alt, wobble = 120, startK = 0.05) {
    const pts = []
    const side = new V(-(to.z - from.z), 0, to.x - from.x).normalize()
    for (let i = 0; i < n; i++) {
      const k = startK + (i / (n - 1 || 1)) * (1 - startK)
      const x = lerp(from.x, to.x, k) + side.x * Math.sin(i * 1.3) * wobble
      const z = lerp(from.z, to.z, k) + side.z * Math.sin(i * 1.3) * wobble
      const a = typeof alt === 'function' ? alt(i, n) : alt
      pts.push({ x, z, y: groundAt(x, z) + a })
    }
    return pts
  }

  buildSteps() {
    const a = this.home
    const city = LANDMARKS.find((l) => l.id === 'meridian_city')
    const sum = LANDMARKS.find((l) => l.id === 'crown_peak')
    const rw = this.rwEnd
    switch (this.def.id) {
      case 'express': {
        const apron = fieldPoint(a, 0, a.r * 1.8 * 0.2)
        const tower = siteById('tower')
        void city
        return [
          this.takeoff(),
          this.reach({ x: apron.x, y: a.h + 22, z: apron.z }, 80, 36, 'Collect the parcel', 'Fly low over the glowing marker beside the terminal. Slow down and stay level.', 'Parcel', () => this.pickParcel()),
          this.reach({ x: tower.x, y: CITY.h + 205, z: tower.z }, 110, 60, 'Deliver the parcel to Millennium Tower', 'Climb to the top of the tall tower and fly into the glowing marker.', 'Millennium Tower', () => this.dropParcel()),
          this.land(a),
        ]
      }
      case 'thermal':
        return [
          this.takeoff(),
          this.thermalClimb(700),
          this.land(a, 'Glide home and land'),
        ]
      case 'coast': {
        const lm1 = LANDMARKS.find((l) => l.id === 'salt_bay_light') || { x: -1800, z: 900 }
        const lm2 = LANDMARKS.find((l) => l.id === 'gull_rock') || { x: 1500, z: 1200 }
        const p1 = this.ringLine({ x: rw.x, z: rw.z }, lm1, 5, 70, 160, 0.12)
        const p2 = this.ringLine(lm1, lm2, 6, 55, 200, 0.1)
        return [
          this.takeoff(),
          this.rings(p1, 'Fly the Usuma Dam rings'),
          this.rings(p2, 'Keep the chain going'),
          this.land(AF('home'), 'Return and land'),
        ]
      }
      case 'summit': {
        const s = sum || { x: 0, z: -2000, h: 800 }
        const down = this.ringLine({ x: s.x, z: s.z }, { x: a.x, z: a.z }, 5, 140, 100, 0.25)
        return [
          this.takeoff(),
          this.reach({ x: s.x, y: s.h + 90, z: s.z }, 170, 110, 'Fly above Zuma Rock', 'Climb high, follow the marker and stay above the summit.', 'Zuma Rock'),
          this.rings(down, 'Dive back through the valley'),
          this.land(a),
        ]
      }
      case 'skim': {
        const pts = NIGER.map(([x, z]) => ({ x, z }))
        const lowRings = pts.slice(2).map((p) => ({ x: p.x, z: p.z, y: 22 }))
        return [this.takeoff(), this.reach({ x: pts[1].x, y: 80, z: pts[1].z }, 240, 100, 'Fly to the River Niger', 'Head for the glowing marker, then drop low over the river.', 'River Niger'), this.rings(lowRings, 'Skim the River Niger'), this.land(a)]
      }
      case 'safari': {
        const ids = ['gull_rock', 'twin_needle', 'mirage_flats', 'frost_saddle']
        const spots = ids.map((id) => LANDMARKS.find((l) => l.id === id)).filter(Boolean)
        const steps = [this.takeoff()]
        for (const sp of spots) steps.push(this.reach({ x: sp.x, y: Math.max(sp.h, 0) + 130, z: sp.z }, 170, 110, `Photo of ${sp.name}`, 'Fly near the glowing marker to snap the photo.', sp.name, () => toast('Click! Great photo', 'good')))
        steps.push(this.land(a))
        return steps
      }
      case 'rescue': {
        const cape = LANDMARKS.find((l) => l.id === 'sentinel_cape') || { x: 2200, z: -1500, h: 5 }
        const west = AF('west')
        return [
          this.takeoff(),
          this.reach({ x: cape.x, y: groundAt(cape.x, cape.z) + 45, z: cape.z }, 130, 55, 'Find the stranded flyer', 'Fly low over the glowing marker to pick them up.', 'Stranded flyer', () => this.pickParcel('Flyer on board! Take them to Minna Airport', '#7fd0ff')),
          this.land(west, 'Land at Minna Airport'),
        ]
      }
      case 'tour': {
        const steps = [this.takeoff()]
        for (const id of ['assembly', 'eagle', 'mosque', 'tower', 'stadium', 'ncc']) {
          const st = siteById(id)
          steps.push(this.reach({ x: st.x, y: CITY.h + st.ay, z: st.z }, st.r, 100, `Fly over ${st.name}`, 'Follow the arrow and fly over the glowing marker.', st.name, () => toast(`${st.name}. What a view!`, 'good')))
        }
        steps.push(this.land(a))
        return steps
      }
      case 'charter': {
        const west = AF('west')
        const ends = runwayEnds(a)
        return [
          this.board(apronSlot(a, 3), 'Board the passengers', 'passengers', 4),
          this.taxi({ x: ends[0].x + this.ax.x * 30, z: ends[0].z + this.ax.z * 30 }, 'Taxi to the runway'),
          this.takeoff(),
          this.land(west, 'Land at Minna Airport'),
          this.taxi(apronSlot(west, 3), 'Taxi to the terminal'),
          this.board(apronSlot(west, 3), 'Let the passengers off', 'unload', 4),
        ]
      }
      case 'cargo': {
        const east = AF('east')
        const ends = runwayEnds(a)
        return [
          this.board(apronSlot(a, 3), 'Load the cargo', 'cargo', 4),
          this.taxi({ x: ends[0].x + this.ax.x * 30, z: ends[0].z + this.ax.z * 30 }, 'Taxi to the runway'),
          this.takeoff(),
          this.land(east, 'Land at Jos Airport'),
          this.taxi(apronSlot(east, 3), 'Taxi to the terminal'),
          this.board(apronSlot(east, 3), 'Unload the cargo', 'unload', 4),
        ]
      }
      case 'night': {
        const apron = fieldPoint(a, 0, a.r * 1.8 * 0.2)
        const south = AF('south')
        return [
          this.takeoff(),
          this.reach({ x: apron.x, y: a.h + 22, z: apron.z }, 80, 36, 'Collect the medicine', 'Fly low over the glowing marker beside the terminal.', 'Medicine', () => this.pickParcel('Medicine on board. Fly to Lokoja Airstrip', '#ff7a7a')),
          this.reach({ x: south.x, y: south.h + 160, z: south.z }, 220, 120, 'Reach Lokoja Airstrip', 'Follow the arrow across the dark sea. The airstrip lights glow.', 'Lokoja Airstrip', () => this.dropParcel()),
          this.land(south),
        ]
      }
      case 'storm': {
        const east = AF('east')
        const storm = this.ringLine({ x: rw.x, z: rw.z }, { x: east.x, z: east.z }, 9, 170, 220, 0.06)
        return [this.takeoff(), this.rings(storm, 'Fly through the storm'), this.land(east)]
      }
      default: {
        const rings = this.ringLine({ x: rw.x, z: rw.z }, { x: rw.x + this.ax.x * 2200, z: rw.z + this.ax.z * 2200 }, 6, 120, 150, 0.08)
        return [
          this.takeoff(),
          this.climb(120),
          this.rings(rings, 'Fly through the rings'),
          this.land(a),
        ]
      }
    }
  }

  pickParcel(msg = 'Parcel collected. Take it to the Millennium Tower', color = '#d9a05b') {
    if (this.carrying) return
    this.carrying = true
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }))
    box.position.set(0, -0.4, 0)
    this.parcel = box
    this.e.player.model.root.add(box)
    toast(msg, 'good')
    this.e.audio.pickup()
  }

  dropParcel() {
    this.carrying = false
    if (this.parcel) { this.e.player.model.root.remove(this.parcel); this.parcel = null }
    toast('Parcel delivered', 'good')
    this.e.audio.success()
    const bonus = this.limit && this.time < this.limit * 0.7 ? 150 : 0
    if (bonus) { this.coins += bonus; toast(`Fast delivery. +${bonus} miles`, 'good') }
  }

  ringPassed(centre) {
    this.chain = this.chainT < 9 ? this.chain + 1 : 1
    this.chainT = 0
    this.bestChain = Math.max(this.bestChain, this.chain)
    this.ringsDone++
    const pts = 10 * this.chain + (centre ? 10 : 0)
    this.coins += pts
    const f = this.f
    f.speed = Math.min(f.speed + 7, f.vTop * 1.12)
    this.e.fovKick = 1
    this.e.audio.gate(centre)
    toast(`${centre ? 'Centre pass. ' : ''}Chain x${this.chain}  +${pts} miles`, 'good')
  }

  // ---------------------------------------------------------------- flow
  begin(i) {
    this.si = i
    const s = this.steps[i]
    s?.enter?.()
    this.stepTime = 0
    if (s && i > 0) this.e.radio.say(CAPTAIN, s.text)
    this.e.coins.set(this.stepCoins(s))
  }

  stepCoins(s) {
    if (!s || s.text === 'Take off') return []
    const f = this.f
    const from = { x: f.pos.x, y: f.pos.y, z: f.pos.z }
    if (s.points) {
      const out = []
      let prev = from
      for (const p of s.points) { out.push(...coinLine(prev, p, 80, 16, 14)); prev = p }
      return out
    }
    if (s.target) {
      const t = s.target
      const dx = t.x - from.x, dz = t.z - from.z
      const d = Math.hypot(dx, dz) || 1
      const reach = Math.min(d, 1800)
      return coinLine(from, { x: from.x + (dx / d) * reach, y: lerp(from.y, t.y, reach / d), z: from.z + (dz / d) * reach }, 110, 18, 16)
    }
    return []
  }

  onCoins(n) {
    this.coins += n * 3
    profile.stats.coins += n
    this.coinCount = (this.coinCount || 0) + n
    hud.coinCount = this.coinCount
  }

  nextStep() {
    const s = this.steps[this.si]
    s?.exit?.()
    this.e.audio.pickup()
    if (this.si + 1 >= this.steps.length) return this.complete()
    this.begin(this.si + 1)
  }

  waypoint() { return this.steps[this.si]?.target || null }
  hint() { return this.steps[this.si]?.hint || '' }

  update(dt) {
    if (this.finished) return
    this.time += dt
    this.stepTime += dt
    this.chainT += dt
    if (this.chainT > 9) this.chain = 0
    const f = this.f
    if (this.limit && this.time > this.limit) { this.complete('time'); return }
    if (this.carry === 'passengers' && this.comfort >= 0) {
      const dvy = Math.abs(f.vy - (this.prevVy ?? f.vy)) / Math.max(dt, 0.001)
      this.prevVy = f.vy
      let loss = 0
      if (!f.onGround) {
        if (Math.abs(f.roll) > 0.75) loss += (Math.abs(f.roll) - 0.75) * 45
        if (dvy > 14) loss += (dvy - 14) * 0.5
        loss += f.turb * 4
        if (f.stalling) loss += 6
      } else if (f.speed > 14 && Math.abs(f.roll) > 0.1) loss += 4
      this.comfort = Math.max(0, Math.min(100, this.comfort - loss * dt + (loss === 0 ? 1.4 * dt : 0)))
      if (this.comfort <= 0) { this.complete('unhappy'); return }
    }
    const s = this.steps[this.si]
    if (s && s.update(dt)) this.nextStep()
    // fail: out of energy on the ground away from any goal
    if (!this.finished && f.onGround && f.energy < 2 && this.si > 0) {
      this.strand = (this.strand || 0) + dt
      if (this.strand > 6) { this.complete(true); return }
    } else this.strand = 0
    if (!this.hudDue(dt)) return
    const cur = this.steps[this.si]
    hud.missionName = this.def.name
    hud.objective = cur ? cur.text : ''
    hud.steps = this.steps.map((st, i) => ({ text: st.short, done: i < this.si, current: i === this.si }))
    hud.timer = this.time
    hud.carrying = this.carrying
    hud.chain = this.chain
    hud.coins = this.coins
    hud.limit = this.limit
    hud.timeLeft = this.limit ? Math.max(0, this.limit - this.time) : 0
    hud.markers = [
      ...AIRFIELDS.map((af) => ({ x: af.x, z: af.z, kind: 'airfield' })),
      ...(cur && cur.target ? [{ x: cur.target.x, z: cur.target.z, kind: 'gatenext' }] : []),
      ...((cur && cur.alt) || f.flags.lift ? THERMALS.map((th) => ({ x: th.x, z: th.z, kind: 'thermal' })) : []),
    ]
    hud.guideAlt = cur && cur.alt ? cur.alt : null
    hud.comfort = this.carry === 'passengers' ? Math.round(this.comfort ?? 100) : -1
    hud.load = this.carry === 'cargo' ? 'Heavy cargo: slower climb and turns' : ''
  }

  complete(failed = false) {
    if (this.finished) return
    const first = !profile.missions.done[this.def.id]
    const timeUp = failed === 'time'
    const unhappy = failed === 'unhappy'
    const mul = failed ? 0.15 : first ? 1 : 0.35
    const miles = Math.round(this.def.reward.miles * mul + this.coins)
    const xp = Math.round(this.def.reward.xp * mul)
    if (!failed) {
      const prev = profile.missions.done[this.def.id]
      profile.stats.missions++
      profile.missions.done[this.def.id] = { best: prev ? Math.min(prev.best, Math.round(this.time)) : Math.round(this.time) }
    }
    this.conclude({
      title: timeUp ? "Time's up" : unhappy ? 'Passengers left' : failed ? 'Mission over' : 'Mission complete',
      headline: this.def.name,
      lines: [
        ['Time', fmtTime(this.time)],
        ['Rings flown', `${this.ringsDone}`],
        ['Best chain', `x${this.bestChain}`],
        ['Bonus miles', `${this.coins}`],
        ['Reward', first || failed ? 'Full' : 'Replay (reduced)'],
        ['Coins', `${this.coinCount || 0}`],
        ...(this.landing ? [['Landing', this.landing]] : []),
        ...(failed ? [] : [[CAPTAIN, this.def.after]]),
        [failed ? 'Tip' : 'Next', unhappy ? 'Bank gently and land softly. Passengers hate steep turns' : timeUp ? 'Follow the arrow and keep flapping. Boost on the straights' : failed ? 'Glide and use rising air to save energy' : 'Try the next mission in the list'],
      ],
      miles, xp, birdXp: Math.round(miles * 0.6 + 40),
    })
  }

  finish() { this.complete(true) }

  dispose() {
    if (this.parcel) this.e.player.model.root.remove(this.parcel)
    hud.steps = []
    hud.missionName = ''
    hud.carrying = false
    hud.guideAlt = null
    hud.timeLeft = 0
    hud.limit = 0
    hud.coinCount = 0
    hud.comfort = -1
    hud.boardP = 0
    hud.landing = null
    hud.load = ''
    if (this.carryMeshes) for (const mm of this.carryMeshes) this.e.player.model.root.remove(mm)
    this.e.player.flight.load = 0
    super.dispose()
  }
}

export function createMode(id, engine, opts) {
  if (id === 'missions') return new MissionMode(engine, opts)
  if (id === 'race') return new AirRace(engine, opts)
  if (id === 'haul') return new LongHaul(engine, opts)
  return new FreeFlight(engine, opts)
}
