<script setup>
import { computed } from 'vue'
const props = defineProps({ bird: Object, size: { type: Number, default: 120 }, locked: Boolean })
const l = computed(() => props.bird.look)
const neck = computed(() => Math.min(l.value.neck ?? 0.35, 2) )
const headX = computed(() => 112 + neck.value * 11)
const headY = computed(() => 40 - neck.value * 6)
const beakLen = computed(() => Math.min(6 + l.value.beakLen * 34, 30))
const wingH = computed(() => 14 + Math.min(l.value.span, 6.5) * 6.2)
const tailL = computed(() => 18 + l.value.tailLen * 16)
</script>

<template>
  <svg :viewBox="'0 0 180 90'" :width="size" :height="size * 0.5" :style="{ opacity: locked ? 0.35 : 1, filter: locked ? 'grayscale(0.7)' : 'none' }">
    <!-- tail -->
    <polygon :points="`58,46 ${58 - tailL},${38 + (l.tailFork ? 0 : 4)} ${58 - tailL * 0.92},${50} ${58 - tailL},${56 + (l.tailFork ? 2 : -2)} 60,52`" :fill="l.tail" />
    <!-- far wing -->
    <path :d="`M92 42 Q ${78} ${42 - wingH * 0.7} ${44} ${42 - wingH * 0.9} Q 70 ${40 - wingH * 0.35} 100 46 Z`" :fill="l.wing" opacity="0.55" />
    <!-- body -->
    <ellipse cx="90" cy="46" rx="38" ry="13" :fill="l.belly" />
    <path d="M52 46 Q 90 20 128 46 Q 90 40 52 46 Z" :fill="l.body" />
    <path d="M52 46 Q 90 24 128 46 Q 90 50 52 48 Z" :fill="l.body" opacity="0.9" />
    <!-- neck and head -->
    <path :d="`M118 40 L ${headX} ${headY} L ${headX} ${headY + 7} L 122 56 Z`" :fill="l.head" />
    <circle :cx="headX" :cy="headY" r="7.5" :fill="l.head" />
    <polygon :points="`${headX + 6},${headY - 2} ${headX + 6 + beakLen},${headY + 2.5} ${headX + 6},${headY + 4.5}`" :fill="l.beak" />
    <circle :cx="headX + 2.4" :cy="headY - 1.5" r="1.4" fill="#0b0d12" />
    <!-- near wing -->
    <path :d="`M100 40 Q ${84} ${40 - wingH * 0.85} ${34} ${40 - wingH} Q 62 ${44 - wingH * 0.4} 112 50 Z`" :fill="l.wing" />
    <path :d="`M34 ${40 - wingH} Q 52 ${44 - wingH * 0.62} 84 ${46 - wingH * 0.3}`" fill="none" :stroke="l.tip" stroke-width="3" stroke-linecap="round" opacity="0.8" />
  </svg>
</template>
