import { reactive, computed, watch } from 'vue'
import { BIRDS, RARITIES, birdById } from './data/birds'
import { ACH } from './data/achievements'

const KEY = 'birdline.profile.v1'
const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

const defaults = () => ({
  xp: 0,
  miles: 1500,
  ownedBirds: ['sparrow', 'kite', 'hawk'],
  owned: ['plumage:natural', 'pattern:none', 'trail:none', 'badge:none', 'accessory:none', 'habitat:coast'],
  mastery: {}, // birdId -> xp
  abilityLevels: {}, // `${birdId}:${slot}` -> 0..3
  loadouts: {}, // birdId -> { plumage, pattern, trail, badge, accessory }
  selected: 'hawk',
  habitat: 'coast',
  discovered: [],
  daily: { date: '', streak: 0, done: false },
  ach: {},
  stats: { flights: 0, landings: 0, perfect: 0, coins: 0, missions: 0 },
  missions: { done: {} },
  upgrades: {},
  records: { altitude: 0, distance: 0, bestRace: null, longHaul: null },
  settings: { volume: 0.6, quality: 'medium', weather: 'auto', time: 'auto', invertY: false, tutorialDone: false, helpShown: false, perf3: true, tilt: true, radio: true, landAssist: true, music: true, haptics: true },
})

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = defaults()
      const p = { ...d, ...JSON.parse(raw) }
      p.settings = { ...d.settings, ...p.settings }
      if (!p.settings.perf3) { p.settings.perf3 = true; p.settings.quality = 'medium' }
      return p
    }
  } catch (e) { /* storage unavailable */ }
  return defaults()
}

export const profile = reactive(load())

watch(profile, () => {
  try { localStorage.setItem(KEY, JSON.stringify(profile)) } catch (e) { /* ignore */ }
}, { deep: true })

// Screen state and live game values
export const ui = reactive({
  screen: 'title', // title | hangar | modes | play | results
  mode: 'free',
  paused: false,
  loading: 0,
  tab: 'overview',
  toasts: [],
  results: null,
  menuWeather: 'clear',
  previewId: null,
  help: false,
  howto: false,
  installEvent: null,
  touch: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
  portrait: false,
  rotated: false,
  vw: typeof innerWidth !== 'undefined' ? innerWidth : 1280,
  vh: typeof innerHeight !== 'undefined' ? innerHeight : 720,
  tilt: false,
  tiltReady: false,
  compact: typeof innerWidth !== 'undefined' && (innerWidth < 900 || innerHeight < 560),
  drawer: false,
  tutorial: { active: false, step: 0 },
})

export const hud = reactive({
  hint: '', assist2: true, assisting: false, radio: null, plane: false, canPlane: false, comfort: -1, boardP: 0, landing: null, load: '', steps: [], missionName: '', carrying: false, chain: 0, coins: 0, guideAlt: null, guideDy: 0,
  speed: 0, altitude: 0, heading: 0, energy: 100, vspeed: 0, groundSpeed: 0,
  windSpeed: 0, windDir: 0, headwind: 0, weather: 'Clear', visibility: 100,
  onGround: false, thermal: false, turbulence: 0, stall: false,
  ability: [{ name: '', ready: 1, active: 0, locked: false }, { name: '', ready: 1, active: 0, locked: true }],
  objective: '', wpDist: 0, wpBearing: 0, wpScreen: null, wpName: '',
  timer: 0, countdown: 0, position: 1, field: 4, ring: 0, rings: 0, message: '',
  clock: '12:00', flightLevel: 0, distance: 0, miles: 0, mapVisible: true,
  markers: [],
})

// ---- progression ----
const xpNeeded = (lvl) => Math.round(120 * Math.pow(lvl, 1.45))

export function levelFromXp(xp) {
  let lvl = 1
  let rest = xp
  while (rest >= xpNeeded(lvl) && lvl < 99) { rest -= xpNeeded(lvl); lvl++ }
  return { level: lvl, into: rest, need: xpNeeded(lvl) }
}

export const player = computed(() => levelFromXp(profile.xp))

const masteryNeed = (l) => 90 + 38 * l
export function masteryFor(id) {
  let xp = profile.mastery[id] || 0
  let lvl = 1
  while (lvl < 50 && xp >= masteryNeed(lvl)) { xp -= masteryNeed(lvl); lvl++ }
  return { level: lvl, into: lvl >= 50 ? 1 : xp, need: lvl >= 50 ? 1 : masteryNeed(lvl) }
}

export const STAT_KEYS = ['speed', 'range', 'altitude', 'agility', 'endurance']
export const statLevel = (id, k) => (profile.upgrades[id] && profile.upgrades[id][k]) || 0
export const statUpgradeCost = (lvl) => 450 * (lvl + 1)

export function upgradeStat(id, k) {
  const l = statLevel(id, k)
  if (l >= 5) return false
  const cost = statUpgradeCost(l)
  if (profile.miles < cost) return false
  profile.miles -= cost
  if (!profile.upgrades[id]) profile.upgrades[id] = {}
  profile.upgrades[id][k] = l + 1
  return true
}

export function effectiveStats(bird) {
  const m = masteryFor(bird.id).level
  const r = RARITIES[bird.rarity].bonus
  const e = m >= 50 ? 0.03 : 0
  const f = 1 + r + (m - 1) * 0.0012 + e
  const s = bird.stats
  const u = (k) => statLevel(bird.id, k) * 2.4
  return {
    speed: s.speed * f + u('speed'), range: s.range * f + u('range'), altitude: s.altitude * f * (m >= 10 ? 1.03 : 1) + u('altitude'),
    agility: s.agility * f + u('agility'), endurance: s.endurance * f * (m >= 20 ? 1.03 : 1) + u('endurance'),
  }
}

// ---- toasts ----
let toastId = 0
export function toast(text, kind = 'info') {
  const id = ++toastId
  ui.toasts.push({ id, text, kind })
  while (ui.toasts.length > 2) ui.toasts.shift()
  setTimeout(() => {
    const i = ui.toasts.findIndex((t) => t.id === id)
    if (i >= 0) ui.toasts.splice(i, 1)
  }, 2600)
}

// ---- rewards ----
export function award({ xp = 0, miles = 0, birdXp = 0, birdId }) {
  const before = levelFromXp(profile.xp).level
  profile.xp += Math.round(xp)
  profile.miles += Math.round(miles)
  const after = levelFromXp(profile.xp).level
  let mastered = null
  if (birdId && birdXp) {
    const b4 = masteryFor(birdId).level
    profile.mastery[birdId] = (profile.mastery[birdId] || 0) + Math.round(birdXp)
    const af = masteryFor(birdId).level
    if (af > b4) mastered = af
  }
  return { levelUp: after > before ? after : null, mastered }
}

// ---- daily bonus and trophies ----
const dayStr = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
export const dailyReady = () => profile.daily.date !== dayStr(new Date()) || !profile.daily.done

export function claimDaily() {
  const today = dayStr(new Date())
  const dl = profile.daily
  if (dl.date === today && dl.done) return 0
  dl.streak = dl.date === dayStr(new Date(Date.now() - 864e5)) ? dl.streak + 1 : 1
  dl.date = today
  dl.done = true
  return 300 + Math.min(dl.streak - 1, 6) * 100
}

export function checkAch() {
  for (const a of ACH) {
    if (!profile.ach[a.id] && a.test(profile)) {
      profile.ach[a.id] = true
      profile.miles += a.reward
      toast(`Trophy: ${a.name}. +${a.reward} miles`, 'good')
    }
  }
}

// ---- shop ----
export const isBirdOwned = (id) => profile.ownedBirds.includes(id)
export const isBirdUnlocked = (b) => player.value.level >= b.unlock

export function buyBird(id) {
  const b = birdById(id)
  if (!b || isBirdOwned(id)) return false
  if (!isBirdUnlocked(b)) return false
  if (profile.miles < b.price) return false
  profile.miles -= b.price
  profile.ownedBirds.push(id)
  toast(`${b.name} (${b.aircraft}) added to your hangar`, 'good')
  return true
}

export const ownsItem = (type, id) => profile.owned.includes(`${type}:${id}`)

export function buyItem(type, id, price) {
  if (ownsItem(type, id)) return true
  if (profile.miles < price) return false
  profile.miles -= price
  profile.owned.push(`${type}:${id}`)
  return true
}

export function loadoutFor(id) {
  if (!profile.loadouts[id]) {
    profile.loadouts[id] = { plumage: 'natural', pattern: 'none', trail: 'none', badge: 'none', accessory: 'none' }
  }
  return profile.loadouts[id]
}

export const abilityLevel = (birdId, slot) => profile.abilityLevels[`${birdId}:${slot}`] || 0

export function upgradeCost(level) { return 600 * (level + 1) }

export function upgradeAbility(birdId, slot) {
  const l = abilityLevel(birdId, slot)
  if (l >= 3) return false
  const cost = upgradeCost(l)
  if (profile.miles < cost) return false
  profile.miles -= cost
  profile.abilityLevels[`${birdId}:${slot}`] = l + 1
  return true
}

export const selectedBird = computed(() => birdById(profile.selected) || BIRDS[0])

export function go(screen) {
  ui.screen = screen
  ui.paused = false
}

// the running engine, set by App.vue
export const game = { engine: null }

// pointer coordinates in the (possibly rotated) stage
export function toStage(x, y) {
  return ui.rotated ? { x: y, y: window.innerWidth - x } : { x, y }
}
