import * as THREE from 'three'
import { birdById } from '../data/birds'
import { createBird } from './birdModel'
import { heightAt, AIRFIELDS } from './terrain'
import { AF, axisOf, runwayLen, runwayEnds, apronSlot, parkedYaw } from './airfield'
import { makeRng, clamp, lerp } from './noise'

const V = THREE.Vector3
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const gnd = (x, z) => Math.max(heightAt(x, z), 0)

// who flies for FlyBird Airways: [bird, job, home airfield]
const ROSTER = [
  ['pelican', 'cargo', 'home'], ['goose', 'passenger', 'home'], ['crane', 'cargo', 'west'],
  ['swan', 'passenger', 'north'], ['stork', 'cargo', 'east'], ['albatross', 'cargo', 'south'],
  ['kite', 'light', 'home'], ['hawk', 'light', 'west'], ['condor', 'cargo', 'north'],
]

// Ambient airline traffic: birds park on aprons, taxi, take off, cruise between airfields,
// land and park again. Purely visual, they never block the player.
export class Traffic {
  constructor(engine) {
    this.e = engine
    this.group = new THREE.Group()
    engine.scene.add(this.group)
    this.npcs = []
    this.rnd = makeRng(4242)
  }

  build(quality) {
    const n = quality === 'high' ? 9 : quality === 'medium' ? 7 : 5
    ROSTER.slice(0, n).forEach(([id, job, homeId], i) => {
      const bird = birdById(id)
      const home = AF(homeId)
      const model = createBird(bird, {}, {})
      this.group.add(model.root)
      this.decorate(model, job, bird)
      const npc = {
        bird, job, model, field: home, slot: i % 3, state: 'parked', timer: 3 + this.rnd() * 25,
        pos: new V(), yaw: 0, pitch: 0, roll: 0, speed: 0, dest: null, land: null, cruiseAlt: 150 + this.rnd() * 250, cruiseSpeed: 36 + this.rnd() * 14,
      }
      this.park(npc)
      // half of them start in the air so there is traffic to see straight away
      if (i % 2 === 1) this.startCruise(npc, true)
      this.npcs.push(npc)
    })
  }

  decorate(model, job, bird) {
    const s = bird.look.span
    if (job === 'cargo') {
      const mat = new THREE.MeshStandardMaterial({ color: '#8d9aab', roughness: 0.7 })
      for (const dx of [-0.12, 0.12]) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(s * 0.08, s * 0.06, s * 0.1), mat)
        box.position.set(dx * s * 0.6, -s * 0.05, 0)
        model.root.add(box)
      }
    } else if (job === 'passenger') {
      const mat = new THREE.MeshStandardMaterial({ color: '#e8c9a0', roughness: 0.8 })
      for (const z of [-0.12, 0, 0.12]) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(s * 0.025, 8, 6), mat)
        p.position.set(0, s * 0.07, z * s * 0.5)
        model.root.add(p)
      }
    }
  }

  park(n) {
    const a = n.field
    const p = apronSlot(a, n.slot)
    n.pos.set(p.x, gnd(p.x, p.z), p.z)
    n.yaw = parkedYaw(a)
    n.pitch = 0; n.roll = 0; n.speed = 0
    n.state = 'parked'
    n.timer = 14 + this.rnd() * 45
  }

  pickDest(n) {
    const options = AIRFIELDS.filter((a) => a !== n.field)
    return options[Math.floor(this.rnd() * options.length)]
  }

  // runway end nearest to a point, with the direction you would land in
  landingFor(field, from) {
    const [e0, e1] = runwayEnds(field)
    const d0 = Math.hypot(e0.x - from.x, e0.z - from.z), d1 = Math.hypot(e1.x - from.x, e1.z - from.z)
    const near = d0 < d1 ? e0 : e1, far = d0 < d1 ? e1 : e0
    const L = Math.hypot(far.x - near.x, far.z - near.z)
    const dir = { x: (far.x - near.x) / L, z: (far.z - near.z) / L }
    return { T: near, dir, far }
  }

  startCruise(n, midAir = false) {
    n.dest = this.pickDest(n)
    n.land = this.landingFor(n.dest, n.field)
    if (midAir) {
      // drop the bird somewhere along its route
      const k = 0.15 + this.rnd() * 0.6
      const x = lerp(n.field.x, n.dest.x, k), z = lerp(n.field.z, n.dest.z, k)
      n.pos.set(x, gnd(x, z) + n.cruiseAlt, z)
      n.yaw = Math.atan2(n.dest.x - n.field.x, n.dest.z - n.field.z)
      n.speed = n.cruiseSpeed
    }
    n.state = 'cruise'
  }

  steerTo(n, tx, tz, rate, dt) {
    const want = Math.atan2(tx - n.pos.x, tz - n.pos.z)
    const d = wrap(want - n.yaw)
    const step = clamp(d, -rate * dt, rate * dt)
    n.yaw += step
    n.roll += (clamp(-d * 1.6, -0.55, 0.55) - n.roll) * Math.min(1, dt * 3)
  }

  advance(n, dt) {
    n.pos.x += Math.sin(n.yaw) * Math.cos(n.pitch) * n.speed * dt
    n.pos.z += Math.cos(n.yaw) * Math.cos(n.pitch) * n.speed * dt
  }

  step(n, dt) {
    const f = n.field
    switch (n.state) {
      case 'parked': {
        n.timer -= dt
        if (n.timer <= 0) { n.state = 'taxiOut'; n.speed = 0 }
        break
      }
      case 'taxiOut': {
        const [e0] = runwayEnds(f)
        n.speed = Math.min(n.speed + 3 * dt, 7)
        this.steerTo(n, e0.x, e0.z, 1.2, dt)
        this.advance(n, dt)
        n.pos.y = gnd(n.pos.x, n.pos.z)
        if (Math.hypot(e0.x - n.pos.x, e0.z - n.pos.z) < 14) {
          const ax = axisOf(f)
          n.yaw = Math.atan2(ax.x, ax.z); n.roll = 0
          n.state = 'takeoff'; n.speed = 0
        }
        break
      }
      case 'takeoff': {
        n.speed += 4.2 * dt
        const rolling = n.speed < 24
        if (!rolling) {
          n.pitch = lerp(n.pitch, 0.2, dt * 2)
          n.pos.y += Math.sin(n.pitch) * n.speed * dt
          if (n.pos.y > gnd(n.pos.x, n.pos.z) + 90) { n.pitch = 0; this.startCruise(n) }
        } else n.pos.y = gnd(n.pos.x, n.pos.z)
        this.advance(n, dt)
        break
      }
      case 'cruise': {
        const L = n.land
        const apx = L.T.x - L.dir.x * 1700, apz = L.T.z - L.dir.z * 1700
        n.speed = lerp(n.speed, n.cruiseSpeed, dt)
        this.steerTo(n, apx, apz, 0.45, dt)
        const goalY = gnd(n.pos.x, n.pos.z) + n.cruiseAlt
        const vy = clamp((goalY - n.pos.y) * 0.4, -8, 8)
        n.pos.y += vy * dt
        n.pitch = Math.atan2(vy, n.speed)
        this.advance(n, dt)
        if (Math.hypot(apx - n.pos.x, apz - n.pos.z) < 450) n.state = 'approach'
        break
      }
      case 'approach': {
        const L = n.land
        const dist = Math.hypot(L.T.x - n.pos.x, L.T.z - n.pos.z)
        n.speed = lerp(n.speed, 27, dt * 0.8)
        this.steerTo(n, L.T.x + L.dir.x * 60, L.T.z + L.dir.z * 60, 0.5, dt)
        const goalY = gnd(L.T.x, L.T.z) + 3 + dist * 0.085
        const vy = clamp((goalY - n.pos.y) * 0.8, -7, 4)
        n.pos.y += vy * dt
        n.pitch = Math.atan2(vy, n.speed)
        this.advance(n, dt)
        if (n.pos.y <= gnd(n.pos.x, n.pos.z) + 1.2 || dist < 20) {
          n.pos.y = gnd(n.pos.x, n.pos.z); n.pitch = 0; n.roll = 0
          n.yaw = Math.atan2(L.dir.x, L.dir.z)
          n.field = n.dest
          n.state = 'rollout'
        }
        break
      }
      case 'rollout': {
        n.speed = Math.max(0, n.speed - 4.6 * dt)
        n.pos.y = gnd(n.pos.x, n.pos.z)
        this.advance(n, dt)
        if (n.speed < 2.5) { n.state = 'taxiIn'; n.slot = Math.floor(this.rnd() * 3) }
        break
      }
      case 'taxiIn': {
        const p = apronSlot(n.field, n.slot)
        n.speed = Math.min(n.speed + 2 * dt, 6)
        this.steerTo(n, p.x, p.z, 1.1, dt)
        this.advance(n, dt)
        n.pos.y = gnd(n.pos.x, n.pos.z)
        if (Math.hypot(p.x - n.pos.x, p.z - n.pos.z) < 8) this.park(n)
        break
      }
      default: break
    }
  }

  update(dt, t, camPos, visible = true) {
    this.group.visible = visible
    if (!visible) return
    for (const n of this.npcs) {
      this.step(n, dt)
      const far = Math.hypot(n.pos.x - camPos.x, n.pos.z - camPos.z) > 5200
      n.model.root.visible = !far
      if (far) continue
      const onGround = n.state === 'parked' || n.state === 'taxiOut' || n.state === 'taxiIn' || n.state === 'rollout' || (n.state === 'takeoff' && n.speed < 24)
      const r = n.model.root
      r.position.set(n.pos.x, n.pos.y, n.pos.z)
      r.rotation.order = 'YXZ'
      r.rotation.set(-n.pitch, n.yaw, n.roll)
      const flap = n.state === 'takeoff' ? 0.9 : n.state === 'cruise' ? 0.32 : n.state === 'approach' ? 0.12 : onGround && n.speed > 1 ? 0.25 : 0
      n.model.update(dt, { flap, speed: n.speed / 60, ground: onGround ? 1 : 0, fold: 0, time: t, turn: -n.roll, bank: n.roll })
    }
  }

  dispose() {
    this.e.scene.remove(this.group)
    for (const n of this.npcs) n.model.dispose()
  }
}
