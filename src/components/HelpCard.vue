<script setup>
import { ui } from '../store'
import { CONTROLS } from '../data/tutorial'
const TOUCH = [
  ['Tilt', 'Turn the phone like a wheel to bank. Tilt the top toward you to climb'],
  ['Left thumb', 'Drag to steer. Up climbs, down dives, sideways banks'],
  ['Flap', 'Hold for extra thrust. Cruise assist flaps for you when slow'],
  ['Boost', 'Sprint burst. Drains Energy fast'],
  ['Brake', 'Slow down and tighten turns'],
  ['Ability buttons', 'Tap to use your bird abilities'],
  ['Top right', 'Camera, controls and pause'],
]
</script>

<template>
  <div v-if="ui.help" class="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-ink/50" @click="ui.help = false">
    <div class="panel fade-up max-h-[92vh] w-[min(520px,92vw)] overflow-y-auto p-5 sm:p-7" @click.stop>
      <div class="flex items-center justify-between">
        <h3 class="display text-4xl font-semibold text-white">Controls</h3>
        <button class="text-steel hover:text-white" @click="ui.help = false">Close</button>
      </div>
      <div class="metal-line my-4"></div>
      <div v-if="ui.touch" class="space-y-2.5">
        <div v-for="c in TOUCH" :key="c[0]" class="flex items-center gap-4">
          <span class="display w-32 shrink-0 text-lg text-white">{{ c[0] }}</span><span class="text-[14px] text-silver">{{ c[1] }}</span>
        </div>
      </div>
      <div v-else class="space-y-2.5">
        <div v-for="c in CONTROLS" :key="c[1]" class="flex items-center gap-4">
          <div class="flex w-36 shrink-0 gap-1.5">
            <span v-for="k in c[0]" :key="k" class="num grid h-8 min-w-8 place-items-center rounded-md border border-white/30 bg-white/10 px-2 text-base text-white">{{ k }}</span>
          </div>
          <span class="text-[15px] text-silver">{{ c[1] }}</span>
        </div>
      </div>
      <p class="mt-5 text-sm text-steel">Tip: climbing costs speed and diving gains it. Let go of the keys to glide and recover Energy.</p>
    </div>
  </div>
</template>
