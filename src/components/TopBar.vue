<script setup>
import { profile, player, ui } from '../store'
defineProps({ back: String, title: String })
defineEmits(['back'])
</script>

<template>
  <div class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between" :class="ui.compact ? 'p-2' : 'p-5'">
    <div class="pointer-events-auto flex items-center gap-4">
      <button v-if="back" class="btn !px-4 !py-2" :class="ui.compact ? '!px-3 !py-1 !text-base' : ''" @click="$emit('back')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        {{ back }}
      </button>
      <h2 v-if="title" class="display text-3xl font-semibold text-white">{{ title }}</h2>
    </div>
    <div class="pointer-events-auto hud-panel flex items-center px-4 py-2" :class="ui.compact ? 'gap-3 !px-3 !py-1' : 'gap-5'">
      <div class="flex items-center gap-2">
        <span class="display text-lg text-steel">Level</span>
        <span class="num text-2xl text-white">{{ player.level }}</span>
        <div v-if="!ui.compact" class="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
          <div class="h-full rounded-full bg-sky" :style="{ width: (player.into / player.need) * 100 + '%' }"></div>
        </div>
      </div>
      <div class="h-6 w-px bg-white/15"></div>
      <div class="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="#d5dde8" stroke-width="1.4" /><path d="M5 11l5-6 5 6M10 5v10" stroke="#a9dcff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span class="num text-2xl text-white">{{ profile.miles.toLocaleString() }}</span>
        <span class="text-sm text-steel">miles</span>
      </div>
    </div>
  </div>
</template>
