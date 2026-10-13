<script setup>
import { profile, dailyReady } from '../store'
import { ACH } from '../data/achievements'
defineEmits(['close'])
const stats = () => [
  ['Flights', profile.stats.flights], ['Missions finished', profile.stats.missions], ['Landings', profile.stats.landings],
  ['Perfect landings', profile.stats.perfect], ['Coins collected', profile.stats.coins], ['Landmarks found', profile.discovered.length],
]
</script>

<template>
  <div class="absolute inset-0 z-50 grid place-items-center bg-ink/60 p-3" @click.self="$emit('close')">
    <div class="panel scroll max-h-[94vh] w-[min(560px,96vw)] overflow-y-auto p-5 sm:p-7 fade-up">
      <div class="flex items-center justify-between">
        <h3 class="display text-3xl font-semibold text-white sm:text-4xl">Trophies</h3>
        <button class="text-steel hover:text-white" @click="$emit('close')">Close</button>
      </div>
      <div class="metal-line my-3"></div>
      <div class="mb-3 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-silver">
        <span v-if="dailyReady()" class="text-sky-2">Daily bonus is ready. Finish any mission today to claim it.</span>
        <span v-else class="text-sky-2">Daily bonus claimed.</span>
        <span class="ml-2 text-steel">Streak {{ profile.daily.streak }} {{ profile.daily.streak === 1 ? 'day' : 'days' }}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div v-for="s in stats()" :key="s[0]" class="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
          <div class="num text-2xl text-white">{{ s[1] }}</div>
          <div class="text-[11px] text-steel">{{ s[0] }}</div>
        </div>
      </div>
      <div class="mt-4 space-y-2">
        <div v-for="a in ACH" :key="a.id" class="flex items-center gap-3 rounded-xl border p-3" :class="profile.ach[a.id] ? 'border-sky/60 bg-sky/10' : 'border-white/10 bg-white/5 opacity-70'">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full border" :class="profile.ach[a.id] ? 'border-sky bg-sky text-ink' : 'border-white/30 text-steel'">{{ profile.ach[a.id] ? '✓' : '' }}</span>
          <div class="min-w-0 flex-1">
            <div class="display text-xl leading-none text-white">{{ a.name }}</div>
            <div class="text-sm text-steel">{{ a.desc }}</div>
          </div>
          <span class="num text-sm text-sky-2">+{{ a.reward }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
