<script setup>
defineProps({ bird: Object, big: Boolean, center: Boolean })
</script>

<template>
  <div :class="center ? 'text-center' : ''">
    <div :class="['display flex items-baseline gap-3 leading-none', center ? 'justify-center' : '', big ? 'text-5xl' : 'text-2xl']">
      <span class="text-white font-semibold">{{ bird.name }}</span>
      <span :class="['inline-block self-center bg-silver/60', big ? 'h-8 w-px' : 'h-5 w-px']"></span>
      <span class="text-sky font-semibold">{{ bird.aircraft }}</span>
    </div>
    <div v-if="big" class="mt-2 text-steel text-sm">{{ bird.category }}</div>
  </div>
</template>
