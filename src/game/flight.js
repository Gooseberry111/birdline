import { ABILITIES, abilityLevelMods } from '../data/abilities'
import { clamp, smooth, lerp } from './noise'
import { heightAt, thermalAt, HALF } from './terrain'

const G = 9.81
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// One flying bird. Pure simulation, no rendering. All distances in metres.
export class Flight {
  constructor(bird, stats, opts = {}) {
    this.bird = bird
    this.stats = stats
    this.mastery = opts.mastery || 1
    this.abilityLevels = opts.abilityLevels || [0, 0]
    this.ai = !!opts.ai

    const s = stats
    this.vTop = 24 + s.speed * 0.72
    this.cruise = this.vTop * 0.6
    this.stall = Math.max(10, this.cruise * 0.34)
    this.ld = 6 + s.range * 0.14 + (this.mastery >= 5 ? 0.6 : 0)
    const vg = this.cruise * 0.8
    this.kd = (G * 0.9) / (this.ld * vg * vg)
    this.flapThrust = 5.2
    this.boostThrust = this.flapThrust + 7.5
    this.pitchRate = 1.5 + s.agility * 0.014
    this.rollRate = 7 + s.agility * 0.07
    this.turnGain = 1.25 + s.agility * 0.01
    this.maxBank = 1.05 + s.agility * 0.003
    this.energyRate = 0
    this.ceiling = (900 + s.altitude * 22) * (this.mastery >= 10 ? 1.08 : 1)
    this.drainScale = (1.55 - s.endurance * 0.0085) * (this.mastery >= 20 ? 0.92 : 1)
    this.payload = bird.payload

    this.pos = { x: 0, y: 100, z: 0 }
    this.yaw = 0
    this.pitch = 0
    this.roll = 0
    this.speed = this.cruise
    this.vy = 0
    this.energy = 100
    this.onGround = false
    this.groundOffset = 0.6
    this.flapping = 0
    this.boosting = false
    this.braking = 0
    this.hovering = false
    this.thermal = 0
    this.turb = 0
    this.wind = { x: 0, y: 0, z: 0 }
    this.groundSpeed = 0
    this.flags = { lift: 0, focus: 0, glide: 0, dive: 0, steady: 0, turn: 0, strike: 0 }
    this.events = []
    this.hardContact = 0
    this.stalling = false
    this.distance = 0
    this.maxAlt = 0
    this.strikeState = 0
    this.recover = 0
    this.takeoffT = 0
    this.load = 0
    this.planeMode = false
    this.turnSmooth = 0

    this.abilities = bird.abilities.map((id, i) => ({
      id,
      def: ABILITIES[id],
      slot: i,
      level: this.abilityLevels[i] || 0,
      unlocked: i === 0 || this.mastery >= 30,
      active: 0,
      cd: 0,
      total: 0,
    }))
  }

  place(x, y, z, yaw, speed = this.cruise) {
    this.pos.x = x; this.pos.y = y; this.pos.z = z
    this.yaw = yaw; this.speed = speed
    this.pitch = 0; this.roll = 0; this.vy = 0
    this.onGround = false
  }

  getForward(out) {
    const cg = Math.cos(this.pitch)
    out.x = Math.sin(this.yaw) * cg
    out.y = Math.sin(this.pitch)
    out.z = Math.cos(this.yaw) * cg
    return out
  }

  useAbility(slot) {
    const a = this.abilities[slot]
    if (!a || !a.unlocked || a.active > 0 || a.cd > 0) return false
    const cost = a.def.cost
    if (this.energy < cost) return false
    this.energy -= cost
    const m = abilityLevelMods(a.level)
    a.total = a.def.dur * m.dur
    a.active = a.total
    a.cdTotal = a.def.cd * m.cd
    if (a.def.kind === 'strike') this.strikeState = 1
    if (a.def.kind === 'hover') { this.hovering = true }
    this.events.push({ type: 'ability', slot, name: a.def.name })
    return true
  }

  abilityKind(kind) {
    for (const a of this.abilities) if (a.active > 0 && a.def.kind === kind) return a
    return null
  }

  update(dt, input, env) {
    dt = Math.min(dt, 0.05)
    const t = env.time
    const s = this.stats
    const p = this.pos

    // ---- abilities
    this.flags.lift = this.flags.focus = this.flags.glide = this.flags.dive = 0
    this.flags.steady = this.flags.turn = this.flags.strike = 0
    for (const a of this.abilities) {
      if (a.active > 0) {
        a.active -= dt
        if (a.def.kind in this.flags) this.flags[a.def.kind] = a.def.power
        if (a.active <= 0) {
          a.active = 0
          a.cd = a.cdTotal
          if (a.def.kind === 'hover') this.hovering = false
          if (a.def.kind === 'dive') this.recover = 0.9
          this.events.push({ type: 'abilityEnd', slot: a.slot })
        }
      } else if (a.cd > 0) a.cd = Math.max(0, a.cd - dt)
    }
    const burst = this.abilityKind('burst')
    const drafting = this.abilityKind('draft')
    const skimming = this.abilityKind('skim')
    const hover = this.abilityKind('hover')
    this.hovering = !!hover

    // ---- environment: wind, thermals, turbulence
    const w = env.windAt(p.x, p.y, p.z, t)
    let up = w.y
    let thermalLift = thermalAt(p.x, p.z, p.y)
    thermalLift *= 1 + this.flags.lift * 0.9
    this.thermal = thermalLift
    up += thermalLift
    const surf = Math.max(heightAt(p.x, p.z), 0)
    // slope lift: wind pushed up a hillside
    const gx = heightAt(p.x + 25, p.z) - heightAt(p.x - 25, p.z)
    const gz = heightAt(p.x, p.z + 25) - heightAt(p.x, p.z - 25)
    const agl = p.y - surf
    if (agl < 220 && agl > 0) {
      const into = (w.x * gx + w.z * gz) / 50
      if (into < 0) up += -into * 0.45 * (1 - agl / 220) * (1 + this.flags.lift * 0.8)
    }
    const turbAmt = w.turb * (1 - Math.min(this.flags.steady, 1.4) * 0.8)
    this.turb = lerp(this.turb, turbAmt, 1 - Math.exp(-dt * 3))
    up += w.tv * (1 - Math.min(this.flags.steady, 1.4) * 0.8)

    // ---- controls
    let pitchIn = input.pitch || 0
    let rollIn = input.roll || 0
    let flap = input.flap ? 1 : 0

    // ---- landing assist: lines the bird up, holds the glide path, slows down, flares and brakes
    let aBrake = 0
    const lg = input.landGuide
    const assistOn = !!(lg && input.landAssist)
    this.assisting = false
    if (assistOn) {
      const gain = this.planeMode ? 1.25 : 1
      const dirYaw = Math.atan2(lg.dir.x, lg.dir.z)
      const vx = p.x - lg.T.x, vz = p.z - lg.T.z
      const s = -(vx * lg.dir.x + vz * lg.dir.z)
      const lat = vx * -lg.dir.z + vz * lg.dir.x
      const wR = 1 - Math.min(1, Math.abs(rollIn) * 1.5), wP = 1 - Math.min(1, Math.abs(pitchIn) * 1.5)
      if (this.onGround) {
        rollIn += clamp(-wrap(dirYaw - this.yaw) * 2.2, -0.6, 0.6) * wR
        aBrake = this.speed > 6 ? 0.85 : 0.3
        if (this.speed > 3) flap = 0
        this.assisting = true
      } else if (s > -(lg.len || 600) * 0.9 && s < 2800) {
        const aimYaw = dirYaw + clamp(lat * 0.0045, -0.9, 0.9) * (s > 0 ? 1 : 0.8)
        rollIn += clamp(-wrap(aimYaw - this.yaw) * 2.4, -0.8, 0.8) * wR * gain
        const dev = p.y - (lg.g + 3 + Math.max(s, 0) * 0.085)
        const desPitch = clamp(-dev * 0.006, -0.3, 0.22)
        pitchIn += clamp((desPitch - this.pitch) * 2.6, -0.8, 0.8) * wP * gain
        const want = this.stall * (s < 900 ? 1.25 : 1.6)
        this.assistWant = want
        if (this.speed > want * 1.1) { flap = 0; aBrake = s < 1200 ? 0.6 : 0.25 }
        else if (this.speed < want * 0.95) flap = Math.max(flap, 1)
        const aglNow = p.y - Math.max(heightAt(p.x, p.z), 0)
        if (aglNow < 12 && s < 400) pitchIn += clamp((-0.05 - this.pitch) * 3, -0.5, 0.7) * wP
        this.assisting = true
      }
      rollIn = clamp(rollIn, -1, 1)
      pitchIn = clamp(pitchIn, -1, 1)
    }
    const aInput = assistOn ? { ...input, roll: rollIn, pitch: pitchIn } : input
    if (input.assist && this.speed < this.cruise * 0.92 && (!this.onGround || (input.pitch || 0) > 0.3)) flap = Math.max(flap, 0.6)
    if (this.energy <= 0.2) flap = 0
    const boost = !!input.boost && this.energy > 4 && flap > 0
    this.boosting = boost
    this.flapping = lerp(this.flapping, flap ? (boost ? 1 : 0.7) : 0, 1 - Math.exp(-dt * 8))
    this.braking = lerp(this.braking, input.brake ? 1 : aBrake, 1 - Math.exp(-dt * 6))

    // ---- ground handling
    if (this.onGround) {
      this.updateGround(dt, aInput, flap, boost, env)
      this.finishFrame(dt)
      return
    }

    // ---- roll and turning
    const turnAssist = 1 + this.flags.turn * 0.85
    const target = rollIn * (this.planeMode ? Math.min(this.maxBank, 0.62) : this.maxBank) * (this.flags.turn ? 1.2 : 1) + (this.ai ? 0 : 0)
    this.roll += (target - this.roll) * (1 - Math.exp(-dt * this.rollRate * (this.flags.turn ? 1.5 : 1)))
    const slowFactor = clamp(this.speed / this.cruise, 0.55, 1.4)
    let yawRate = -(G * Math.tan(this.roll) / Math.max(this.speed, 22)) * this.turnGain * turnAssist
    if (hover) yawRate = -rollIn * 1.9
    yawRate = clamp(yawRate, -2.2, 2.2)
    this.yaw += yawRate * dt
    this.turnSmooth = lerp(this.turnSmooth, yawRate, 1 - Math.exp(-dt * 6))
    void slowFactor

    // ---- pitch
    if (hover) {
      this.pitch = lerp(this.pitch, 0, 1 - Math.exp(-dt * 4))
    } else {
      const loadFactor = 1 - Math.min(Math.abs(Math.sin(this.roll)) * 0.25, 0.25)
      this.pitch += pitchIn * this.pitchRate * dt * loadFactor
      if (!pitchIn) {
        // speed stability: the nose settles toward the attitude that holds glide speed
        let target = clamp((this.speed - this.cruise * 0.82) * 0.03, -0.5, 0.3)
        if (this.takeoffT > 0) target = Math.max(target, 0.17)
        else if (agl < 45) target = Math.max(target, 0.02)
        this.pitch += (target - this.pitch) * 1.1 * dt
      }
      // turning costs a little lift
      this.pitch -= (1 - Math.cos(this.roll)) * 0.35 * dt
    }

    // ---- ability forced attitude
    const dive = this.abilityKind('dive')
    if (dive) {
      this.pitch = lerp(this.pitch, -0.95 + pitchIn * -0.25, 1 - Math.exp(-dt * 3.2))
    } else if (this.recover > 0) {
      this.recover -= dt
      this.pitch = lerp(this.pitch, 0.2, 1 - Math.exp(-dt * 3.5))
    }
    const strike = this.abilityKind('strike')
    if (strike) {
      const overWater = heightAt(p.x, p.z) < 2
      if (this.strikeState === 1) {
        this.pitch = lerp(this.pitch, overWater ? -1.0 : -0.65, 1 - Math.exp(-dt * 3))
        if (overWater && agl < 9) { this.strikeState = 2; this.events.push({ type: 'strike' }); this.energy = Math.min(100, this.energy + 8) }
        if (!overWater && agl < 25) this.strikeState = 2
      } else {
        this.pitch = lerp(this.pitch, 0.35, 1 - Math.exp(-dt * 5))
        this.speed += 9 * dt * strike.def.power
      }
    }
    const lim = hover ? 0.2 : this.planeMode ? 0.5 : 1.35
    this.pitch = clamp(this.pitch, -lim, lim * 0.9)
    if (!hover && !dive) {
      const cap = lerp(0.1, 0.62, clamp((this.speed - this.stall) / (this.cruise * 0.5), 0, 1)) * (1 - 0.25 * this.load) * (this.planeMode ? 0.75 : 1)
      if (this.pitch > cap) this.pitch = cap
    }

    // ---- speed
    const spd = this.speed
    let drag = this.kd * spd * spd
    drag *= 1 + this.braking * (this.planeMode ? 2.8 : 1.8)
    if (this.flags.glide) drag *= 1 / (1 + (this.flags.glide - 0.4) * 0.8)
    const vCap = this.vTop * (burst ? 1.3 : 1) * (dive ? 1.45 : 1) * (boost ? 1.18 : 1)
    drag += 6 * Math.pow(Math.min(spd / vCap, 1.6), 8)
    let thrust = 0
    const ceilK = 1 - smooth(0.75, 1.0, p.y / this.ceiling)
    if (flap) thrust = (boost ? this.boostThrust : this.flapThrust) * (0.35 + 0.65 * ceilK) * (1 - 0.3 * this.load)
    thrust *= 1 - clamp(this.payload / 100 - 0.5, 0, 0.5) * 0.18
    if (burst) thrust += 13 * burst.def.power
    if (dive) thrust += 9 * dive.def.power
    if (drafting) thrust += this.kd * this.cruise * this.cruise * 0.9
    if (this.flags.glide) {
      // hold speed near cruise without flapping
      if (spd < this.cruise * 1.02) thrust += drag * 0.98
    }
    if (skimming && agl < 25) thrust += 2.4 * (1 - agl / 25)
    if (this.takeoffT > 0) { this.takeoffT -= dt; thrust += 3.4; if (this.speed < this.stall * 1.08) this.speed = this.stall * 1.08 }
    const grav = -G * (this.pitch > 0 ? 0.42 : 0.8) * Math.sin(this.pitch)
    const accel = grav + thrust - drag
    this.speed = Math.max(0, spd + accel * dt)
    // airbrakes and reverse thrust bring the speed down to a safe landing speed
    if (assistOn && this.assisting && !this.onGround && this.assistWant && this.speed > this.assistWant * 1.05) this.speed -= Math.min(5, (this.speed - this.assistWant) * 0.6) * dt

    if (hover) {
      this.speed = lerp(this.speed, 2, 1 - Math.exp(-dt * 3.5))
    }

    // stall behaviour
    this.stalling = !hover && this.speed < this.stall
    if (this.stalling) {
      const k = (this.stall - this.speed) / this.stall
      this.pitch -= k * 0.7 * dt
      this.speed += G * 0.5 * k * dt * 2
    }

    // ---- energy
    let drain = 0
    if (flap) drain += 2.7 * this.drainScale * (boost ? 2.0 : 1) * (1 + clamp(this.payload / 100 - 0.4, 0, 0.6) * 0.5)
    if (hover) drain += 3.2
    if (this.flags.glide) drain *= 0.15
    if (drafting) drain *= 0.5
    if (skimming && agl < 25) drain *= 0.5
    if (agl > 0 && p.y > this.ceiling) drain += 3
    drain += this.turb * 0.5
    let regen = 0
    if (!flap) regen += 2.6 * (0.7 + s.endurance / 200)
    if (this.pitch < 0 && !flap) regen += -Math.sin(this.pitch) * 2.4
    regen += this.thermal * 0.8
    if (this.flags.steady) regen += 2.4 * this.flags.steady
    if (this.abilityKind('glide')?.id === 'silentGlide') regen += 1
    if (this.abilityKind('glide')) regen += 0.8
    this.energyRate = regen - drain
    this.energy = clamp(this.energy + (regen - drain) * dt, 0, 100)
    if (this.planeMode) { this.energy = 100; this.energyRate = 0 }

    // ---- integrate position
    const cp = Math.cos(this.pitch)
    const vx = Math.sin(this.yaw) * cp * this.speed
    const vz = Math.cos(this.yaw) * cp * this.speed
    let vyBody = Math.sin(this.pitch) * this.speed
    if (hover) vyBody = pitchIn * 7 + (input.flap ? 3 : 0)
    // stall sink and exhaustion
    let sink = 0
    if (!hover && this.speed < this.stall * 1.1) sink -= (this.stall * 1.1 - this.speed) * 0.4
    if (this.energy <= 0.2 && !this.flags.glide) sink -= 0.8
    if (p.y > this.ceiling) sink -= (p.y - this.ceiling) * 0.05
    // gusts shove the bird around
    const buf = this.turb
    const gx2 = env.noise(t * 1.3, 11) * buf * 6, gz2 = env.noise(t * 1.1, 29) * buf * 6
    let vyT = vyBody + up + sink
    if (assistOn && agl < 14 && !this.onGround) vyT = Math.max(vyT, -2.4)
    this.vy = lerp(this.vy, vyT, 1 - Math.exp(-dt * 5))
    const prevX = p.x, prevZ = p.z
    const WI = 0.45 // wind pushes the bird gently so it never feels like it slides sideways
    p.x += (vx + w.x * WI + gx2 * WI) * dt
    p.z += (vz + w.z * WI + gz2 * WI) * dt
    p.y += this.vy * dt
    this.groundSpeed = Math.hypot(vx + w.x * WI, vz + w.z * WI)
    this.wind = w
    this.distance += Math.hypot(p.x - prevX, p.z - prevZ)
    if (buf > 0.2) {
      this.roll += env.noise(t * 2.1, 3) * buf * 0.35 * dt * 6
      this.pitch += env.noise(t * 2.3, 7) * buf * 0.12 * dt * 6
    }

    // ---- terrain contact
    const floor = surf + this.groundOffset
    if (p.y < floor) {
      const overWater = heightAt(p.x, p.z) < 0.5
      const gentle = this.vy > -8 && this.pitch > -0.45 && Math.abs(this.roll) < 0.55
      const landing = this.speed < this.stall * (this.planeMode ? 1.6 : 1.45) && gentle && !dive && !strike
      if (landing) {
        this.onGround = true
        p.y = floor
        this.roll = 0
        this.pitch = 0
        this.events.push({ type: 'land', speed: this.speed, vy: this.vy, x: p.x, z: p.z })
      } else if (strike && this.strikeState === 1) {
        p.y = floor
      } else if (overWater && this.vy > -9 && this.pitch > -0.5) {
        // skim the surface: a little drag and spray, no damage
        p.y = floor
        this.vy = Math.max(this.vy, 0)
        this.speed *= 1 - 0.25 * dt
        this.pitch = Math.max(this.pitch, 0.02)
        this.skim = 1
      } else {
        const hard = Math.abs(this.vy) > 14 || this.speed > this.cruise * 1.1
        p.y = floor + 0.3
        this.pitch = Math.abs(this.pitch) * 0.3 + 0.25
        this.speed *= hard ? 0.62 : 0.85
        this.vy = Math.abs(this.vy) * 0.2
        this.energy = Math.max(0, this.energy - (hard ? 14 : 5))
        this.hardContact = 1
        this.events.push({ type: 'contact', hard })
      }
    }

    // keep inside the world
    const lim2 = HALF - 250
    const outside = Math.max(Math.abs(p.x), Math.abs(p.z)) - lim2
    this.outside = outside > 0
    if (outside > 0) {
      const toCenter = Math.atan2(-p.x, -p.z)
      let d = toCenter - this.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.yaw += clamp(d, -1, 1) * Math.min(1, outside / 300 + 0.3) * dt * 1.8
    }
    this.finishFrame(dt)
  }

  finishFrame(dt) {
    this.maxAlt = Math.max(this.maxAlt, this.pos.y)
    this.hardContact = Math.max(0, this.hardContact - dt * 3)
  }

  updateGround(dt, input, flap, boost, env) {
    const p = this.pos
    const surf = Math.max(heightAt(p.x, p.z), 0)
    const onWater = heightAt(p.x, p.z) < 0.5
    // steering on the ground
    const steer = (input.roll || 0)
    this.yaw -= steer * dt * clamp(this.speed / 8, 0.15, 1.1) * (onWater ? 0.6 : 0.9) * (0.5 + this.stats.agility / 120)
    // acceleration
    let thrust = flap ? (boost ? this.flapThrust * 2 : this.flapThrust * 1.45) : 0
    if (this.energy <= 0.2) thrust = 0
    const fric = (onWater ? 1.1 : 0.55) + 0.012 * this.speed + this.braking * (this.planeMode ? 11 : 6)
    this.speed = Math.max(0, this.speed + (thrust - fric) * dt * 2.1)
    const drainK = flap ? 3.2 * this.drainScale * (boost ? 2 : 1) : 0
    this.energy = clamp(this.energy + ((flap ? 0 : 2.4) - drainK) * dt, 0, 100)
    const vx = Math.sin(this.yaw) * this.speed
    const vz = Math.cos(this.yaw) * this.speed
    const w = env.windAt(p.x, p.y, p.z, env.time)
    this.wind = w
    p.x += vx * dt
    p.z += vz * dt
    p.y = Math.max(heightAt(p.x, p.z), 0) + this.groundOffset
    this.groundSpeed = this.speed
    this.vy = 0
    this.roll = 0
    this.pitch = lerp(this.pitch, 0, 1 - Math.exp(-dt * 8))
    this.thermal = 0
    const rotate = this.speed > this.stall * 1.05 && (input.pitch || 0) < -0.01 // pitch input is positive up
    void rotate
    const lift = this.speed > this.stall * 1.05 && (flap > 0 || (input.pitch || 0) > 0.35) && !(this.braking > 0.5)
    if (lift) {
      this.takeoffT = 5
      this.onGround = false
      this.pitch = 0.22
      this.vy = 3
      p.y = surf + this.groundOffset + 0.6
      this.events.push({ type: 'takeoff' })
    }
    void surf
  }
}
