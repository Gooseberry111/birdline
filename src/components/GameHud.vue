<script setup>
import { computed } from 'vue'
import { hud, ui, selectedBird } from '../store'
import Minimap from './Minimap.vue'
import DirectionGuide from './DirectionGuide.vue'
import HelpCard from './HelpCard.vue'
import TouchControls from './TouchControls.vue'

const c = computed(() => ui.touch)
const pxDeg = computed(() => (c.value ? 3.6 : 5.4))

const ticks = computed(() => {
  const h = hud.heading
  const base = Math.round(h / 5) * 5
  const out = []
  for (let d = -60; d <= 60; d += 5) {
    const v = (((base + d) % 360) + 360) % 360
    out.push({ v, x: (base + d - h) * pxDeg.value, major: v % 30 === 0, label: v === 0 ? 'N' : v === 90 ? 'E' : v === 180 ? 'S' : v === 270 ? 'W' : String(v) })
  }
  return out
})

const fmt = (s) => {
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

const warning = computed(() => {
  if (hud.onGround) return null
  if (hud.outside) return { t: 'Leaving the flight area. Turn back', c: 'bad' }
  if (hud.agl < 35 && hud.vspeed < -6) return { t: 'Terrain ahead. Pull up', c: 'bad' }
  if (hud.energy < 12) return { t: 'Low energy. Glide and find lift', c: 'bad' }
  if (hud.stall) return { t: 'Low speed. Lower the nose', c: 'warn' }
  if (hud.altitude > hud.ceiling) return { t: 'Above service ceiling', c: 'warn' }
  if (hud.turbulence > 0.4) return { t: 'Heavy turbulence', c: 'warn' }
  if (hud.thermal) return { t: 'Thermal lift. Circle to climb', c: 'good' }
  return null
})

const wp = computed(() => {
  const s = hud.wpScreen
  if (!s) return null
  const w = ui.vw, h = ui.vh
  let x = s.x, y = s.y
  let off = false
  if (s.behind) { x = w - x; y = h - 60; off = true }
  const m = 60
  const cx = Math.min(Math.max(x, m), w - m)
  const cy = Math.min(Math.max(y, m + 40), h - m - (c.value ? 80 : 120))
  if (cx !== x || cy !== y) off = true
  return { x: cx, y: cy, off, ang: Math.atan2(cy - h / 2, cx - w / 2) * 180 / Math.PI }
})

const dist = computed(() => (hud.wpDist >= 1000 ? (hud.wpDist / 1000).toFixed(1) + ' km' : hud.wpDist + ' m'))
const windRel = computed(() => hud.windDir - hud.heading)
const vig = computed(() => Math.min(Math.max((hud.speed - 90) / 160, 0), 0.7))
const hasWind = computed(() => hud.windSpeed > 1)
const guide = computed(() => {
  const d = hud.guideDy
  if (hud.onGround) return null
  if (!hud.wpScreen && !hud.guideAlt) return null
  if (d > 25) return { arrow: '\u25B2', text: `Climb ${Math.round(d / 5) * 5} m`, c: 'text-sky-2' }
  if (d < -25) return { arrow: '\u25BC', text: `Descend ${Math.round(-d / 5) * 5} m`, c: 'text-sky-2' }
  return { arrow: '\u25CF', text: 'Hold this height', c: 'text-white' }
})
const missionMode = computed(() => ui.mode === 'missions')
const barColor = computed(() => (hud.energy > 50 ? 'linear-gradient(90deg,#6cc0ff,#eaf6ff)' : hud.energy > 25 ? 'linear-gradient(90deg,#e6a23c,#ffd98a)' : 'linear-gradient(90deg,#ff4b4b,#ff9a7a)'))
const rate = computed(() => {
  const r = hud.energyRate || 0
  if (r > 0.4) return { t: 'Recovering \u25B2', c: 'text-sky-2' }
  if (r < -0.4) return { t: 'Using \u25BC', c: 'text-[#ffb27a]' }
  return { t: 'Steady', c: 'text-steel' }
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-10 select-none">
    <div class="absolute inset-0" :style="{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(5,12,27,${vig}) 100%)` }"></div>

    <!-- compass -->
    <div class="absolute left-1/2 top-2 -translate-x-1/2 sm:top-4">
      <div class="hud-panel relative overflow-hidden" :class="c ? 'h-9 w-[300px]' : 'h-12 w-[560px]'">
        <div class="absolute left-1/2 top-0 h-full w-0">
          <div v-for="t in ticks" :key="t.v + '_' + t.x" class="absolute top-0" :style="{ transform: `translateX(${t.x}px)` }">
            <div class="-translate-x-1/2" :class="t.major ? 'mt-1.5 h-3 w-px bg-white' : 'mt-3 h-2 w-px bg-white/45'"></div>
            <div v-if="t.major" class="num -translate-x-1/2 text-center leading-none" :class="[t.label.length === 1 ? 'text-sky-2' : 'text-silver', c ? 'text-xs' : 'text-[15px]']">{{ t.label }}</div>
          </div>
        </div>
        <div class="absolute left-1/2 top-0 h-2 w-3 -translate-x-1/2 bg-sky" style="clip-path: polygon(0 0, 100% 0, 50% 100%)"></div>
        <div v-if="hud.wpName" class="absolute bottom-1 h-3 w-3 rotate-45 border border-ink bg-sky-2" :style="{ left: `calc(50% + ${Math.max(-(c ? 140 : 270), Math.min(c ? 140 : 270, (hud.relBearing || 0) * pxDeg))}px)` }"></div>
      </div>
      <div class="num mt-0.5 text-center text-white" :class="c ? 'text-lg' : 'mt-1 text-2xl'">{{ String(Math.round(hud.heading) % 360).padStart(3, '0') }}</div>
      <DirectionGuide class="mt-2" />
      <div v-if="warning" class="mx-auto mt-1 w-max rounded-full px-3 py-1 font-medium" :class="[c ? 'text-xs' : 'px-4 py-1.5 text-sm', warning.c === 'bad' ? 'bg-[#8d1f2a]/85 text-white' : warning.c === 'warn' ? 'bg-[#1b3b6e]/90 text-white' : 'bg-[#14527a]/90 text-white']">{{ warning.t }}</div>
    </div>

    <!-- objective -->
    <div class="absolute left-2 top-2 space-y-2 sm:left-5 sm:top-5" :class="c ? 'w-[170px]' : 'w-[260px]'" :style="{ marginLeft: 'env(safe-area-inset-left)' }">
      <div class="hud-panel" :class="c ? 'p-2' : 'p-3'">
        <div class="display leading-none text-white" :class="c ? 'text-lg' : 'text-2xl'">
          {{ ui.mode === 'race' ? 'Air Race' : ui.mode === 'haul' ? 'Long Haul' : ui.mode === 'missions' ? (hud.missionName || 'Mission') : 'Free Flight' }}
        </div>
        <div class="mt-1" :class="[c ? 'text-[12px] leading-tight' : 'mt-1.5 text-[15px]', missionMode ? 'font-semibold text-white' : 'text-silver']">{{ hud.objective }}</div>
        <div v-if="guide" class="mt-1 flex items-center gap-1.5 font-semibold" :class="[guide.c, c ? 'text-[12px]' : 'text-sm']"><span>{{ guide.arrow }}</span><span>{{ guide.text }}</span></div>
        <div v-if="missionMode && hud.steps && hud.steps.length && !c" class="mt-2 space-y-1 border-t border-white/10 pt-2">
          <div v-for="(s, i) in hud.steps" :key="i" class="flex items-center gap-2 text-[13px]" :class="s.done ? 'text-steel line-through' : s.current ? 'text-white' : 'text-steel'">
            <span class="grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px]" :class="s.done ? 'border-sky bg-sky text-ink' : s.current ? 'border-white' : 'border-white/30'">{{ s.done ? '\u2713' : '' }}</span>
            <span class="truncate">{{ s.text }}</span>
          </div>
        </div>
        <div v-if="missionMode && hud.carrying" class="mt-1 text-xs text-sky-2">Carrying a parcel</div>
        <div v-if="missionMode && hud.chain > 1" class="num mt-1 text-lg text-white">Chain x{{ hud.chain }}</div>
        <div v-if="hud.limit > 0" class="flex items-center gap-2" :class="hud.timeLeft < 20 ? 'low-pulse text-[#ff7a7a]' : 'text-white'">
          <svg :width="c ? 16 : 22" :height="c ? 16 : 22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></svg>
          <span class="num" :class="c ? 'text-2xl' : 'text-4xl'">{{ fmt(hud.timeLeft) }}</span><span class="text-xs text-steel">left</span>
        </div>
        <div v-else-if="ui.mode !== 'free'" class="num text-white" :class="c ? 'text-xl' : 'mt-1 text-3xl'">{{ fmt(hud.timer) }}</div>
        <div v-if="(missionMode || ui.mode === 'free') && !c" class="mt-1 flex items-center gap-2 text-[#ffd75e]">
          <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffd14a" stroke="#fff" stroke-width="1.5" /><circle cx="12" cy="12" r="5" fill="none" stroke="#e09a00" stroke-width="1.8" /></svg>
          <span class="num text-xl">{{ hud.coinCount || 0 }}</span><span class="text-xs text-steel">coins</span>
        </div>
        <div v-if="ui.mode === 'race' && c" class="num text-sm text-sky-2">Position {{ hud.position }} of {{ hud.field }}</div>
        <div v-if="!c" class="mt-2 flex items-center gap-2 text-xs text-steel">
          <span>{{ hud.state }}</span><span>{{ hud.weather }}</span><span class="num ml-auto text-sm text-silver">{{ hud.clock }}</span>
        </div>
        <div v-else class="mt-0.5 flex justify-between text-[10px] text-steel"><span>{{ hud.state }}</span><span class="num">{{ hud.clock }}</span></div>
      </div>
      <div v-if="ui.mode === 'race' && hud.standings && hud.standings.length" class="hud-panel" :class="c ? 'p-1' : 'p-2'">
        <div v-for="(s, i) in hud.standings" :key="s.name" class="flex items-center gap-2 rounded px-2" :class="[s.me ? 'bg-sky/25 text-white' : 'text-silver', c ? 'py-0.5 text-[11px]' : 'py-1 text-sm']">
          <span class="num w-5 text-base">{{ i + 1 }}</span>
          <span class="display text-lg leading-none">{{ s.name }}</span>
          <span class="display ml-auto text-base leading-none text-sky-2">{{ s.aircraft }}</span>
        </div>
      </div>
    </div>

    <!-- waypoint marker -->
    <div v-if="wp" class="absolute -translate-x-1/2 -translate-y-1/2" :style="{ left: wp.x + 'px', top: wp.y + 'px' }">
      <div class="flex flex-col items-center">
        <div v-if="!wp.off" class="relative h-9 w-9">
          <div class="absolute inset-0 rotate-45 border-2 border-white/90" :class="hud.wpScreen.kind === 'gate' ? 'rounded-full !rotate-0' : ''"></div>
          <div class="absolute inset-[11px] rotate-45 bg-sky" :class="hud.wpScreen.kind === 'gate' ? 'rounded-full !rotate-0' : ''"></div>
        </div>
        <svg v-else width="34" height="34" viewBox="0 0 34 34" :style="{ transform: `rotate(${wp.ang}deg)` }"><path d="M6 17h20M18 8l9 9-9 9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <div class="mt-1 whitespace-nowrap rounded bg-ink/60 px-2 py-0.5 text-white" :class="c ? 'text-xs' : 'text-sm'"><span class="display text-base">{{ hud.wpName }}</span> <span class="num text-sky-2">{{ dist }}</span></div>
        <div v-if="guide && guide.arrow !== '\u25CF'" class="mt-0.5 rounded bg-sky/80 px-2 py-0.5 text-xs font-semibold text-ink">{{ guide.arrow }} {{ guide.text }}</div>
      </div>
    </div>

    <!-- countdown -->
    <div v-if="hud.countdown !== 0" :key="hud.countdown" class="countdown absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2">
      <div class="display font-bold leading-none text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.5)]" :class="c ? 'text-[110px]' : 'text-[190px]'">{{ hud.countdown > 0 ? hud.countdown : 'Go' }}</div>
    </div>

    <!-- landing guidance -->
    <div v-if="hud.landing" class="absolute right-3 z-10 w-[min(250px,40vw)] rounded-xl border border-sky-2/60 bg-navy/90 p-3 backdrop-blur" :class="c ? '!right-auto left-2 top-[156px] !w-[178px]' : 'top-[150px] sm:right-5'">
      <div class="display text-white" :class="c ? 'text-base' : 'text-xl'">Landing</div>
      <div v-for="(l, i) in hud.landing.lines" :key="i" class="mt-0.5 flex items-center gap-2" :class="[hud.landing.good[i] ? 'text-sky-2' : 'text-[#ffb27a]', c ? 'text-[11px]' : 'text-sm']">
        <span>{{ hud.landing.good[i] ? '\u2713' : '\u25B6' }}</span><span>{{ l }}</span>
      </div>
      <div class="mt-1 flex items-center gap-1.5 text-white/90" :class="c ? 'text-[10px]' : 'text-xs'"><span class="rounded bg-sky/30 px-1.5">Auto landing {{ hud.assist2 ? 'on' : 'off' }}</span><span v-if="!c">Press L to change</span></div>
      <div v-if="hud.landing.tip" class="mt-1.5 border-t border-white/15 pt-1.5 text-white/85" :class="c ? 'text-[10px]' : 'text-xs'">{{ hud.landing.tip }}</div>
    </div>

    <!-- radio -->
    <div v-if="hud.radio" class="absolute z-10 flex max-w-[min(480px,60vw)] items-start gap-2 rounded-xl border border-white/25 bg-navy/90 px-3 py-2 backdrop-blur" :class="c ? 'bottom-[62px] left-2 text-[11px]' : 'bottom-[118px] left-5 text-sm'">
      <svg class="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a9dcff" stroke-width="2" stroke-linecap="round"><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M7 8l9-5M8 14h4M16 13h2" /></svg>
      <div><span class="font-semibold text-sky-2">{{ hud.radio.who }}</span><span class="text-white/90">: {{ hud.radio.text }}</span></div>
    </div>
    <div v-if="hud.plane" class="absolute left-1/2 z-10 -translate-x-1/2 rounded-full border border-sky-2/70 bg-navy/90 px-3 py-1 text-xs text-sky-2" :class="c ? 'top-[56px] hidden' : 'top-[10px] hidden'">Plane mode</div>

    <!-- boarding progress -->
    <div v-if="hud.boardP > 0" class="absolute left-1/2 top-[42%] z-10 w-[min(280px,70vw)] -translate-x-1/2 rounded-xl border border-white/30 bg-navy/90 p-3 text-center">
      <div class="display text-white" :class="c ? 'text-base' : 'text-xl'">Hold still</div>
      <div class="mt-1 h-2.5 overflow-hidden rounded-full bg-white/15"><div class="h-full rounded-full bg-sky" :style="{ width: hud.boardP * 100 + '%' }"></div></div>
    </div>

    <!-- passenger comfort and load -->
    <div v-if="hud.comfort >= 0" class="absolute right-3 z-10 w-[130px]" :class="c ? 'top-[52px] hidden' : 'top-[100px] sm:right-5'">
      <div class="mb-0.5 flex justify-between text-xs text-white"><span>Passenger comfort</span><span class="num">{{ hud.comfort }}</span></div>
      <div class="h-2.5 overflow-hidden rounded-full bg-white/15"><div class="h-full rounded-full transition-[width] duration-200" :style="{ width: hud.comfort + '%', background: hud.comfort > 50 ? '#a9dcff' : hud.comfort > 25 ? '#e6a23c' : '#ff5a5a' }"></div></div>
    </div>
    <div v-if="hud.comfort >= 0 && c" class="absolute left-2 top-[132px] z-10 w-[150px]">
      <div class="mb-0.5 flex justify-between text-[10px] text-white"><span>Comfort</span><span class="num">{{ hud.comfort }}</span></div>
      <div class="h-2 overflow-hidden rounded-full bg-white/15"><div class="h-full rounded-full" :style="{ width: hud.comfort + '%', background: hud.comfort > 50 ? '#a9dcff' : hud.comfort > 25 ? '#e6a23c' : '#ff5a5a' }"></div></div>
    </div>
    <div v-if="hud.load" class="absolute left-1/2 bottom-[112px] z-10 -translate-x-1/2 rounded-full bg-navy/90 px-3 py-1 text-xs text-sky-2" :class="c ? 'hidden' : ''">{{ hud.load }}</div>

    <div v-if="hud.hint && !ui.tutorial.active" class="absolute left-1/2 z-10 -translate-x-1/2" :class="c ? 'bottom-[74px]' : 'bottom-[120px]'">
      <div class="hint-pulse flex max-w-[min(560px,86vw)] items-start gap-2 rounded-2xl border border-sky/60 bg-navy/90 px-4 py-2.5 text-white shadow-lg backdrop-blur" :class="c ? 'text-[12px]' : 'text-[15px]'">
        <span class="num rounded-full bg-sky px-2 text-ink">Tip</span><span>{{ hud.hint }}</span>
      </div>
    </div>
    <HelpCard />
    <div v-if="!c" class="absolute bottom-[112px] left-5 text-xs text-steel">Press <span class="num rounded border border-white/30 px-1.5 text-sm text-white">H</span> for controls</div>

    <!-- bottom left abilities (desktop) -->
    <div v-if="!c" class="absolute bottom-5 left-5 flex gap-3">
      <div v-for="(a, i) in hud.ability" :key="i" class="hud-panel relative w-[150px] overflow-hidden p-3" :class="{ 'opacity-40': a.locked }">
        <div class="flex items-center justify-between">
          <span class="chip num !py-0 !text-sm">{{ i === 0 ? 'Q' : 'E' }}</span>
          <span v-if="a.locked" class="text-xs text-steel">Mastery 30</span>
          <span v-else-if="a.active" class="text-xs text-sky-2">Active</span>
          <span v-else-if="a.ready >= 1" class="text-xs text-white">Ready</span>
        </div>
        <div class="display mt-1.5 text-xl leading-none text-white">{{ a.name }}</div>
        <div class="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div class="h-full rounded-full" :class="a.active ? 'bg-white' : 'bg-sky'" :style="{ width: (a.active ? a.active : a.ready) * 100 + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- bottom centre -->
    <div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-end sm:bottom-5" :class="c ? 'gap-2' : 'gap-4'">
      <div class="hud-panel text-center" :class="c ? 'w-[72px] p-1.5' : 'w-[132px] p-3'">
        <div class="text-steel" :class="c ? 'text-[10px]' : 'text-xs'">Speed kt</div>
        <div class="num leading-none text-white" :class="c ? 'text-3xl' : 'text-5xl'">{{ hud.speed }}</div>
      </div>
      <div class="pb-1" :class="c ? 'w-[176px]' : 'w-[300px]'">
        <div class="mb-1 flex items-center justify-between font-semibold" :class="c ? 'text-[11px]' : 'text-sm'">
          <span class="flex items-center gap-1 text-white"><svg width="14" height="14" viewBox="0 0 24 24" fill="#a9dcff"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>Stamina</span>
          <span v-if="hud.assist && !c" class="text-sky-2">Auto flap</span>
          <span :class="rate.c">{{ rate.t }}</span>
        </div>
        <div class="relative overflow-hidden rounded-xl border-2 border-white/45 bg-[#06142c]/85" :class="[c ? 'h-5' : 'h-7', hud.energy < 25 ? 'low-pulse' : '']">
          <div class="h-full rounded-lg transition-[width] duration-100" :style="{ width: hud.energy + '%', background: barColor }"></div>
          <div class="pointer-events-none absolute inset-0 flex"><span v-for="n in 10" :key="n" class="h-full flex-1 border-r border-[#06142c]/60"></span></div>
          <span class="num absolute inset-0 grid place-items-center text-white drop-shadow" :class="c ? 'text-xs' : 'text-base'">{{ Math.round(hud.energy) }}</span>
        </div>
        <div class="mt-1 text-center text-steel" :class="c ? 'text-[10px]' : 'text-xs'">{{ hud.onGround ? 'On the ground. Hold Flap to take off' : hud.energy < 25 ? 'Low! Glide to refill' : selectedBird.name + ' ' + selectedBird.aircraft }}</div>
      </div>
      <div class="hud-panel text-center" :class="c ? 'w-[72px] p-1.5' : 'w-[132px] p-3'">
        <div class="text-steel" :class="c ? 'text-[10px]' : 'text-xs'">Altitude m</div>
        <div class="num leading-none text-white" :class="c ? 'text-3xl' : 'text-5xl'">{{ hud.altitude }}</div>
      </div>
    </div>

    <!-- minimap -->
    <div v-if="hud.mapVisible" class="absolute flex flex-col items-end gap-2" :class="c ? 'right-3 top-[58px]' : 'bottom-5 right-5'">
      <div v-if="!c" class="hud-panel flex items-center gap-3 px-3 py-1.5 text-sm">
        <svg width="22" height="22" viewBox="0 0 24 24" :style="{ transform: `rotate(${windRel}deg)`, opacity: hasWind ? 1 : 0.3 }"><path d="M12 3v18M6 9l6-6 6 6" stroke="#a9dcff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span class="text-silver">Wind <span class="num text-base text-white">{{ hud.windSpeed }}</span> kt</span>
        <span class="text-steel">Climb <span class="num text-base" :class="hud.vspeed >= 0 ? 'text-white' : 'text-sky-2'">{{ hud.vspeed > 0 ? '+' : '' }}{{ hud.vspeed.toFixed(1) }}</span> m/s</span>
      </div>
      <Minimap :size="c ? 104 : 170" />
    </div>

    <TouchControls v-if="c" />
  </div>
</template>
