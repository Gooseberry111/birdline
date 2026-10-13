import { profile } from '../store'

export const buzz = (p) => { try { if (profile.settings.haptics !== false && navigator.vibrate) navigator.vibrate(p) } catch (e) { /* ignore */ } }

// Procedural audio: wind that follows airspeed, rain, a soft music pad, plus short cues.
export class GameAudio {
  constructor() {
    this.ctx = null
    this.volume = 0.6
  }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(ctx.destination)

    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 }
    const noise = (filterType, freq, q) => {
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = filterType; f.frequency.value = freq; f.Q.value = q
      const g = ctx.createGain(); g.gain.value = 0
      src.connect(f); f.connect(g); g.connect(this.master)
      src.start()
      return { f, g }
    }
    this.wind = noise('bandpass', 400, 0.7)
    this.rush = noise('highpass', 2200, 0.4)
    const rainBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const rd = rainBuf.getChannelData(0)
    for (let i = 0; i < len; i++) rd[i] = (Math.random() * 2 - 1) * 0.5
    const rs = ctx.createBufferSource(); rs.buffer = rainBuf; rs.loop = true
    const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 5200; rf.Q.value = 0.5
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0
    rs.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(this.master); rs.start()
  }

  musicStart() {
    if (!this.ctx || this.musicNodes) return
    const ctx = this.ctx
    const out = ctx.createGain(); out.gain.value = 0
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100
    lp.connect(out); out.connect(this.master)
    const oscs = [0, 1, 2, 3].map((i) => { const o = ctx.createOscillator(); o.type = i === 3 ? 'sine' : 'triangle'; o.detune.value = (i - 1.5) * 6; o.connect(lp); o.start(); return o })
    const chords = [[220, 261.6, 329.6, 110], [174.6, 220, 261.6, 87.3], [196, 261.6, 329.6, 98], [196, 246.9, 293.7, 98]]
    let k = 0
    const next = () => {
      const c = chords[k++ % chords.length]
      oscs.forEach((o, i) => o.frequency.setTargetAtTime(c[i], ctx.currentTime, 0.8))
    }
    next()
    const timer = setInterval(next, 7000)
    out.gain.setTargetAtTime(profile.settings.music === false ? 0 : 0.06, ctx.currentTime, 2)
    this.musicNodes = { out, oscs, timer }
  }

  musicOn(on) {
    if (!this.ctx) return
    if (on) this.musicStart()
    if (this.musicNodes) this.musicNodes.out.gain.setTargetAtTime(on ? 0.06 : 0, this.ctx.currentTime, 0.6)
  }

  suspend() { this.ctx?.suspend?.() }
  resume() { this.ctx?.resume?.() }

  setVolume(v) {
    this.volume = v
    if (this.master) this.master.gain.value = v
  }

  update(speedNorm, rain, paused) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const k = paused ? 0 : speedNorm
    this.wind.g.gain.setTargetAtTime(0.08 + k * 0.5, t, 0.1)
    this.wind.f.frequency.setTargetAtTime(260 + k * 900, t, 0.1)
    this.rush.g.gain.setTargetAtTime(Math.max(0, k - 0.4) * 0.22, t, 0.12)
    this.rainGain.gain.setTargetAtTime(paused ? 0 : Math.min(rain, 1.5) * 0.14, t, 0.4)
  }

  blip(freq = 880, dur = 0.18, type = 'sine', vol = 0.18, slide = 0) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(this.master)
    o.start(t); o.stop(t + dur + 0.02)
  }

  gate(clean) {
    buzz(14)
    this.blip(clean ? 1180 : 880, 0.22, 'sine', 0.16)
    setTimeout(() => this.blip(clean ? 1760 : 1320, 0.28, 'sine', 0.12), 70)
  }

  coin() { buzz(6); this.blip(1568, 0.09, 'square', 0.07); setTimeout(() => this.blip(2093, 0.12, 'square', 0.06), 50) }
  wrong() { this.blip(180, 0.25, 'sawtooth', 0.09, -60) }
  click() { this.blip(760, 0.06, 'triangle', 0.07) }
  pickup() { this.blip(1320, 0.14, 'triangle', 0.14); setTimeout(() => this.blip(1980, 0.2, 'triangle', 0.1), 60) }
  ability() { this.blip(300, 0.35, 'sawtooth', 0.07, 700) }
  thud() { buzz(55); this.blip(110, 0.3, 'sine', 0.3, -60) }
  count(final) { this.blip(final ? 1040 : 640, final ? 0.5 : 0.18, 'sine', 0.18) }
  success() { buzz([20, 40, 20]); [660, 880, 1320].forEach((f, i) => setTimeout(() => this.blip(f, 0.35, 'sine', 0.14), i * 120)) }
}
