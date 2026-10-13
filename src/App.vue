<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ui, profile, game, loadoutFor, masteryFor } from './store'
import { Engine } from './game/engine'
import TitleScreen from './screens/TitleScreen.vue'
import ModeSelect from './screens/ModeSelect.vue'
import Hangar from './screens/Hangar.vue'
import PauseMenu from './screens/PauseMenu.vue'
import Results from './screens/Results.vue'
import GameHud from './components/GameHud.vue'
import HowToFly from './components/HowToFly.vue'
import { asset } from './assets'

const canvas = ref(null)
const ready = ref(false)
const error = ref('')
const started = ref(false)
const noArt = ref(false)
const lost = ref(false)
const wideUrl = asset('splash-wide.jpg')
const tallUrl = asset('splash-tall.jpg')
const logoUrl = asset('logo.png')
const splashUrl = computed(() => (ui.vw >= ui.vh ? wideUrl : tallUrl))

// Phones always show the game in landscape. If the phone is held upright and the
// browser will not lock rotation, the whole stage is turned 90 degrees instead.
function measure() {
  const W = window.innerWidth, H = window.innerHeight
  ui.rotated = ui.touch && H > W * 1.05
  ui.vw = ui.rotated ? H : W
  ui.vh = ui.rotated ? W : H
  ui.portrait = ui.vh > ui.vw * 1.05
  ui.compact = ui.vw < 900 || ui.vh < 560
  game.engine?.onResize?.()
}

const stageStyle = computed(() => (ui.rotated
  ? { position: 'fixed', left: 0, top: 0, width: ui.vw + 'px', height: ui.vh + 'px', transformOrigin: 'top left', transform: `translateX(${ui.vh}px) rotate(90deg)`, overflow: 'hidden' }
  : { position: 'fixed', inset: 0, overflow: 'hidden' }))

function reloadNow() { location.reload() }

function tapStart() {
  started.value = true
  const e = game.engine
  e.audio.start()
  e.audio.setVolume(profile.settings.volume)
  e.audio.musicStart()
  if (ui.touch) {
    try {
      const el = document.documentElement
      const p = el.requestFullscreen?.({ navigationUI: 'hide' })
      const lock = () => screen.orientation?.lock?.('landscape').then(measure).catch(() => {})
      if (p && p.then) p.then(lock).catch(() => {})
      else lock()
    } catch (err) { /* ignore */ }
    if (profile.settings.tilt) e.setTilt(true)
  }
  if (!profile.settings.tutorialDone) ui.howto = true
}

onMounted(async () => {
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', () => setTimeout(measure, 250))
  window.addEventListener('touchstart', () => {
    if (!ui.touch) { ui.touch = true; if (game.engine) game.engine.assist = true; measure() }
  }, { passive: true })
  document.addEventListener('contextmenu', (e) => e.preventDefault())
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installEvent = e })
  document.addEventListener('visibilitychange', () => {
    const eng = game.engine
    if (!eng) return
    if (document.hidden) {
      eng.audio.suspend()
      if (ui.screen === 'play' && !eng.paused) eng.setPaused(true)
    } else {
      eng.audio.resume()
      if (ui.screen === 'play') eng.lockScreen()
    }
  })
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) game.engine?.audio.click() })
  try { screen.orientation?.lock?.('landscape').catch(() => {}) } catch (err) { /* needs fullscreen on most browsers */ }
  try {
    const engine = new Engine(canvas.value)
    game.engine = engine
    if (import.meta.env.DEV) { window.__engine = engine; window.__ui = ui; window.__profile = profile }
    canvas.value.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost.value = true })
    canvas.value.addEventListener('webglcontextrestored', () => location.reload())
    await engine.init((p) => { ui.loading = p })
    ready.value = true
    engine.showTitle()
  } catch (e) {
    console.error(e)
    error.value = 'This device could not start the 3D view. Try a recent version of Chrome, Edge or Firefox with hardware acceleration on.'
  }
})

watch(() => ui.screen, (s) => {
  const e = game.engine
  if (!e || !ready.value) return
  if (s === 'title' || s === 'modes') e.showTitle()
  else if (s === 'hangar') e.showHangar()
})

watch(
  () => [profile.selected, JSON.stringify(loadoutFor(profile.selected)), masteryFor(profile.selected).level >= 50],
  () => { if (game.engine && ready.value && ui.screen !== 'play' && ui.screen !== 'results') game.engine.refreshBird() },
)

watch(() => profile.settings.music, (m) => game.engine?.audio.musicOn(m !== false))

watch(() => ui.paused, (p) => { if (game.engine && game.engine.paused !== p) game.engine.setPaused(p) })
</script>

<template>
  <div id="stage" :style="stageStyle">
    <canvas id="view" ref="canvas" tabindex="0"></canvas>

    <!-- loading and start splash -->
    <div v-if="!ready || !started" class="absolute inset-0 z-50 overflow-hidden bg-[#2a7fd6]">
      <img v-if="!noArt" :key="splashUrl" :src="splashUrl" alt="FlyBird" class="absolute inset-0 h-full w-full object-cover" style="object-position: 50% 45%" @error="noArt = true" />
      <div v-else class="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#59b4ff] to-[#d8efff]">
        <img :src="logoUrl" alt="FlyBird" class="w-[min(420px,70vw)] rounded-3xl bg-white p-4 shadow-2xl" />
      </div>
      <div class="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-ink/75 to-transparent"></div>
      <div class="absolute inset-x-0 mx-auto w-[min(420px,80%)] text-center" :style="{ bottom: 'max(22px, env(safe-area-inset-bottom))' }">
        <template v-if="!ready">
          <div v-if="!error" class="h-1.5 overflow-hidden rounded-full bg-white/25">
            <div class="h-full rounded-full bg-white transition-all" :style="{ width: Math.max(ui.loading, 0.05) * 100 + '%' }"></div>
          </div>
          <p v-if="!error" class="mt-2 text-sm text-white drop-shadow">Preparing the sky</p>
          <p v-else class="rounded-lg bg-ink/70 p-3 text-sm text-white">{{ error }}</p>
        </template>
        <button v-else class="btn btn-primary !px-12 !py-3 !text-2xl" @click="tapStart">{{ ui.touch ? 'Tap to play' : 'Click to play' }}</button>
      </div>
    </div>

    <div v-if="lost" class="absolute inset-0 z-[80] grid place-items-center bg-ink/95 p-6 text-center">
      <div>
        <div class="display text-3xl font-semibold text-white">The graphics were interrupted</div>
        <p class="mt-2 text-silver">This can happen when the phone switches apps. Your progress is saved.</p>
        <button class="btn btn-primary mt-4" @click="reloadNow">Reload the game</button>
      </div>
    </div>

    <template v-if="ready && started">
      <TitleScreen v-if="ui.screen === 'title'" />
      <ModeSelect v-else-if="ui.screen === 'modes'" />
      <Hangar v-else-if="ui.screen === 'hangar'" />
      <template v-else>
        <GameHud />
        <PauseMenu v-if="ui.paused && ui.screen === 'play'" />
        <Results v-if="ui.screen === 'results'" />
      </template>

      <HowToFly v-if="ui.howto" />

      <!-- toasts -->
      <div v-if="ui.screen !== 'results'" :class="ui.compact ? 'top-[56%]' : 'top-[40%]'" class="pointer-events-none absolute left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
        <transition-group name="t">
          <div v-for="t in ui.toasts" :key="t.id" class="fade-up rounded-full px-5 py-2 text-[15px] text-white shadow-lg backdrop-blur"
            :class="t.kind === 'good' ? 'bg-[#14527a]/90' : t.kind === 'bad' ? 'bg-[#8d1f2a]/90' : 'bg-navy-2/90'">{{ t.text }}</div>
        </transition-group>
      </div>
    </template>
  </div>
</template>
