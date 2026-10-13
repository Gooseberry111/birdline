<script setup>
defineProps({ label: String, value: Number, base: Number, max: { type: Number, default: 110 } })
</script>

<template>
  <div class="flex items-center gap-3 text-sm">
    <span class="w-24 text-steel">{{ label }}</span>
    <div class="relative h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
      <div class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky/70 to-sky-2" :style="{ width: Math.min(100, value) + '%' }"></div>
    </div>
    <span class="num w-14 text-right text-base text-white">{{ Math.min(100, Math.round(value)) }}<span v-if="base !== undefined && Math.round(value) - base >= 1" class="ml-1 text-xs text-sky-2">+{{ Math.round(value) - base }}</span></span>
  </div>
</template>
