<script setup>
import { computed } from 'vue'
import { hud, ui } from '../store'

const rel = computed(() => hud.relBearing || 0)
const abs = computed(() => Math.abs(rel.value))
const state = computed(() => (abs.value < 22 ? 'good' : abs.value < 100 ? 'turn' : 'wrong'))
const dist = computed(() => (hud.wpDist >= 1000 ? (hud.wpDist / 1000).toFixed(1) + ' km' : hud.wpDist + ' m'))
const say = computed(() => {
  if (state.value === 'good') return 'Right on track'
  if (state.value === 'turn') return rel.value > 0 ? 'Turn right' : 'Turn left'
  return 'WRONG WAY! Turn around'
})
const c = computed(() => ui.compact)
</script>

<template>
  <div v-if="hud.wpName && hud.wpDist > 0" class="flex flex-col items-center">
    <div class="flex items-center gap-3 rounded-2xl border-2 px-3 py-1.5 backdrop-blur" :class="[state === 'wrong' ? 'wrong-shake border-[#ff5a5a] bg-[#6d1119]/90' : state === 'turn' ? 'border-white bg-navy/90' : 'border-sky-2 bg-navy/90']">
      <svg :width="c ? 34 : 52" :height="c ? 34 : 52" viewBox="0 0 48 48" :style="{ transform: `rotate(${rel}deg)`, transition: 'transform 0.12s' }">
        <path d="M24 4 L40 30 L28 26 L28 44 L20 44 L20 26 L8 30 Z" :fill="state === 'wrong' ? '#ff7a7a' : state === 'turn' ? '#ffffff' : '#a9dcff'" stroke="#06142c" stroke-width="2.5" stroke-linejoin="round" />
      </svg>
      <div class="leading-tight">
        <div class="display font-semibold text-white" :class="c ? 'text-base' : 'text-2xl'">{{ hud.wpName }}</div>
        <div class="num text-sky-2" :class="c ? 'text-sm' : 'text-lg'">{{ dist }}</div>
      </div>
    </div>
    <div class="display mt-1 rounded-full px-4 font-semibold tracking-wide" :class="[c ? 'text-sm' : 'text-xl', state === 'wrong' ? 'wrong-flash bg-[#ff3b3b] text-white' : state === 'turn' ? 'bg-white text-[#06142c]' : 'bg-sky-2 text-[#06142c]']">{{ say }}</div>
  </div>
</template>
