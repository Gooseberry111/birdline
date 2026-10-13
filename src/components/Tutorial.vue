<script setup>
import { computed } from 'vue'
import { ui, game } from '../store'
import { TUTORIAL } from '../data/tutorial'
const step = computed(() => TUTORIAL[ui.tutorial.step])
</script>

<template>
  <div v-if="ui.tutorial.active && step" :class="ui.touch ? 'top-[64px] w-[min(380px,52vw)]' : 'top-[112px] w-[min(520px,92vw)]'" class="pointer-events-auto absolute left-1/2 z-20 -translate-x-1/2">
    <div class="panel fade-up" :class="ui.touch ? 'p-3' : 'p-5'" :key="step.id">
      <div class="flex items-center justify-between">
        <div class="display font-semibold text-white" :class="ui.touch ? 'text-xl' : 'text-3xl'">{{ step.title }}</div>
        <div class="flex items-center gap-1.5">
          <span v-for="(s, i) in TUTORIAL" :key="s.id" class="h-1.5 w-6 rounded-full" :class="i < ui.tutorial.step ? 'bg-sky' : i === ui.tutorial.step ? 'bg-white' : 'bg-white/20'"></span>
        </div>
      </div>
      <p class="mt-1 leading-snug text-silver" :class="ui.touch ? 'text-[12px]' : 'mt-1.5 text-[15px]'">{{ ui.touch && step.touch ? step.touch : step.text }}</p>
      <div class="mt-3 flex items-center justify-between">
        <div v-if="!ui.touch" class="flex gap-2">
          <span v-for="k in step.keys" :key="k" class="num grid h-10 min-w-10 place-items-center rounded-lg border border-white/30 bg-white/10 px-3 text-xl text-white shadow-[0_3px_0_rgba(255,255,255,0.18)]">{{ k }}</span>
        </div>
        <button class="text-sm text-steel hover:text-white" @click="game.engine.skipTutorial()">Skip tutorial</button>
      </div>
    </div>
  </div>
</template>
