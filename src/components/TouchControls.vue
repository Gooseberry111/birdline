<script setup>
import { ref, computed } from 'vue'
import { game, hud, ui, toStage } from '../store'

const R = 58
const stick = ref({ id: null, bx: 0, by: 0, kx: 0, ky: 0 })
const e = () => game.engine

function sdown(ev) {
  if (stick.value.id !== null) return
  ev.currentTarget.setPointerCapture(ev.pointerId)
  const p = toStage(ev.clientX, ev.clientY)
  stick.value = { id: ev.pointerId, bx: p.x, by: p.y, kx: p.x, ky: p.y }
}
function smove(ev) {
  const s = stick.value
  if (ev.pointerId !== s.id) return
  const p = toStage(ev.clientX, ev.clientY)
  let dx = p.x - s.bx, dy = p.y - s.by
  const d = Math.hypot(dx, dy)
  if (d > R) { dx *= R / d; dy *= R / d }
  s.kx = s.bx + dx; s.ky = s.by + dy
  const nx = dx / R, ny = dy / R
  const dead = (v) => (Math.abs(v) < 0.1 ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - 0.1) / 0.8))
  e().touch.x = dead(nx)
  e().touch.y = dead(ny)
}
function sup(ev) {
  if (ev.pointerId !== stick.value.id) return
  stick.value = { id: null, bx: 0, by: 0, kx: 0, ky: 0 }
  e().touch.x = 0
  e().touch.y = 0
}

const held = ref({})
function hold(key, v) {
  held.value[key] = v
  e().touch[key] = v
}
const ab = (i) => hud.ability[i] || { ready: 1, active: 0, locked: true, name: '' }
const ring = (i) => {
  const a = ab(i)
  const p = a.active ? a.active : a.ready
  return { background: `conic-gradient(${a.active ? '#ffffff' : '#6cc0ff'} ${p * 360}deg, rgba(255,255,255,0.14) 0)` }
}
const showStick = computed(() => stick.value.id !== null)
</script>

<template>
  <div class="absolute inset-0 z-20 select-none" style="touch-action: none">
    <!-- movement zone -->
    <div class="pointer-events-auto absolute bottom-0 left-0 top-[18%] w-[46%]" style="touch-action: none"
      @pointerdown.prevent="sdown" @pointermove.prevent="smove" @pointerup="sup" @pointercancel="sup">
      <div v-if="!showStick" class="absolute bottom-[22px] left-[34px] grid h-[120px] w-[120px] place-items-center rounded-full border border-white/25 bg-white/5">
        <div class="h-12 w-12 rounded-full border border-white/40 bg-white/15"></div>
      </div>
    </div>
    <template v-if="showStick">
      <div class="pointer-events-none fixed h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-white/10" :style="{ left: stick.bx + 'px', top: stick.by + 'px' }"></div>
      <div class="pointer-events-none fixed h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/35 backdrop-blur" :style="{ left: stick.kx + 'px', top: stick.ky + 'px' }"></div>
    </template>

    <!-- action buttons -->
    <div class="pointer-events-none absolute bottom-0 right-0 h-[260px] w-[300px]" style="padding-right: env(safe-area-inset-right)">
      <button class="pointer-events-auto absolute bottom-[20px] right-[22px] grid h-[96px] w-[96px] place-items-center rounded-full border-2 border-white/70 bg-sky/30 text-white backdrop-blur active:bg-sky/60"
        :class="{ '!bg-sky/70': held.flap }" style="touch-action: none"
        @pointerdown.prevent="hold('flap', true)" @pointerup="hold('flap', false)" @pointercancel="hold('flap', false)" @pointerleave="hold('flap', false)">
        <span class="display text-2xl font-semibold">Flap</span>
      </button>
      <button class="pointer-events-auto absolute bottom-[24px] right-[132px] grid h-[66px] w-[66px] place-items-center rounded-full border border-white/50 bg-white/10 text-white backdrop-blur"
        :class="{ '!bg-white/40': held.boost }" style="touch-action: none"
        @pointerdown.prevent="hold('boost', true)" @pointerup="hold('boost', false)" @pointercancel="hold('boost', false)" @pointerleave="hold('boost', false)">
        <span class="display text-lg font-semibold">Boost</span>
      </button>
      <button class="pointer-events-auto absolute bottom-[36px] right-[210px] grid h-[48px] w-[48px] place-items-center rounded-full border border-white/40 bg-white/10 text-white backdrop-blur"
        :class="{ '!bg-white/40': held.brake }" style="touch-action: none"
        @pointerdown.prevent="hold('brake', true)" @pointerup="hold('brake', false)" @pointercancel="hold('brake', false)" @pointerleave="hold('brake', false)">
        <span class="display text-sm font-semibold">Brake</span>
      </button>
      <button v-for="i in 2" :key="i" class="pointer-events-auto absolute grid place-items-center rounded-full p-[3px]"
        :class="[i === 1 ? 'bottom-[126px] right-[34px] h-[68px] w-[68px]' : 'bottom-[112px] right-[116px] h-[58px] w-[58px]', ab(i - 1).locked ? 'opacity-30' : '']"
        :style="[ring(i - 1), { touchAction: 'none' }]" @pointerdown.prevent="e().useAbilitySlot(i - 1)">
        <span class="grid h-full w-full place-items-center rounded-full bg-navy/90 px-1 text-center text-[11px] leading-tight text-white">{{ ab(i - 1).name }}</span>
      </button>
    </div>

    <!-- system buttons -->
    <div class="pointer-events-auto absolute right-3 top-2 flex gap-2" style="margin-right: env(safe-area-inset-right)">
      <button v-if="!ui.rotated" class="grid h-10 min-w-10 place-items-center rounded-full border bg-ink/50 px-2 text-white" :class="ui.tilt ? 'border-sky text-sky-2' : 'border-white/30'" @pointerdown.prevent="e().setTilt(!ui.tilt)" aria-label="Tilt steering">
        <span class="display text-sm font-semibold">{{ ui.tilt ? 'Tilt on' : 'Tilt' }}</span>
      </button>
      <button v-if="hud.landing" class="grid h-10 min-w-10 place-items-center rounded-full border bg-ink/50 px-2 text-white" :class="hud.assist2 ? 'border-sky text-sky-2' : 'border-white/30'" @pointerdown.prevent="e().toggleLandAssist()" aria-label="Landing assist">
        <span class="display text-sm font-semibold">Auto land</span>
      </button>
      <button class="grid h-10 min-w-10 place-items-center rounded-full border bg-ink/50 px-2 text-white" :class="hud.plane ? 'border-sky text-sky-2' : 'border-white/30'" @pointerdown.prevent="e().togglePlane()" aria-label="Turn into a plane">
        <span class="display text-sm font-semibold">{{ hud.plane ? 'Bird' : 'Plane' }}</span>
      </button>
      <button v-if="ui.tilt" class="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-ink/50 text-white" @pointerdown.prevent="e().calibrateTilt()" aria-label="Level the phone">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
      </button>
      <button class="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-ink/50 text-white" @pointerdown.prevent="e().cycleCamera()" aria-label="Camera">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
      </button>
      <button class="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-ink/50 text-white" @pointerdown.prevent="ui.help = !ui.help" aria-label="Controls">
        <span class="display text-xl font-semibold">?</span>
      </button>
      <button class="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-ink/50 text-white" @pointerdown.prevent="e().setPaused(!e().paused)" aria-label="Pause">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      </button>
    </div>
  </div>
</template>
