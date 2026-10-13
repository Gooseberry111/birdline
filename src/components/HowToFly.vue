<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ui, profile } from '../store'

const page = ref(0)
const touch = computed(() => ui.touch)

const pages = computed(() => [
  {
    title: 'Welcome to FlyBird',
    text: 'Your mission is always on the top left. Follow the big arrow, fly through glowing rings, grab coins and beat the clock.',
    keys: [], icon: 'bird',
  },
  {
    title: 'Take off',
    text: touch.value ? 'Hold the Flap button or push the left stick up. Run down the runway and you lift off by yourself.' : 'Hold Space to flap and run down the runway. You lift off by yourself.',
    keys: touch.value ? ['Flap'] : ['Space'], icon: 'run',
  },
  {
    title: 'Steer like a plane',
    text: touch.value ? 'Tilt your phone like a steering wheel to bank. Tilt the top toward you to climb, away to dive. The left stick works too.' : 'S pulls the nose up to climb. W pushes it down to dive. A and D bank left and right. Bank more for a tighter turn.',
    keys: touch.value ? ['Tilt', 'Stick'] : ['W', 'A', 'S', 'D'], icon: 'steer',
  },
  {
    title: 'Flap for speed',
    text: touch.value ? 'Flap gives you speed and climb. Hold Boost for a burst. It uses stamina fast, so use it on the straights.' : 'Flap (Space) gives you speed and lets you climb. Hold Shift with it for a boost burst. Boosting uses stamina fast.',
    keys: touch.value ? ['Flap', 'Boost'] : ['Space', 'Shift'], icon: 'boost',
  },
  {
    title: 'Watch your stamina',
    text: 'The bar at the bottom shrinks while you flap and refills while you glide. Let go and glide downhill, or find a warm air column to climb for free.',
    keys: [], icon: 'stamina',
  },
  {
    title: 'Follow the arrow',
    text: 'The arrow at the top points to your goal. If it turns red and shouts WRONG WAY, you are flying away from it. Arrows in the sky also lead you. The clock is ticking!',
    keys: [], icon: 'arrow',
  },
  {
    title: 'Grab the coins',
    text: 'Fly through coins to earn miles. Spend miles in the Hangar on new birds and upgrades for speed, range, agility and stamina.',
    keys: [], icon: 'coin',
  },
])

const p = computed(() => pages.value[page.value])
const last = computed(() => page.value === pages.value.length - 1)
function next() { if (last.value) done(); else page.value++ }
function back() { if (page.value > 0) page.value-- }
function done() { profile.settings.tutorialDone = true; ui.howto = false; page.value = 0 }
function key(e) {
  if (!ui.howto) return
  if (e.key === 'Enter' || e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') back()
  else if (e.key === 'Escape') done()
}
onMounted(() => window.addEventListener('keydown', key))
onBeforeUnmount(() => window.removeEventListener('keydown', key))
</script>

<template>
  <div class="absolute inset-0 z-[70] grid place-items-center bg-ink/85 p-3 backdrop-blur-sm" style="pointer-events: auto">
    <button class="absolute right-3 top-3 z-10 rounded-lg border border-white/30 bg-white/5 px-5 py-2 text-base font-medium text-white hover:bg-white/10" @click="done">Skip</button>
    <div :key="page" class="pop-in panel w-[min(640px,96vw)] text-center" :class="ui.compact ? 'p-4' : 'p-8'">
      <div class="mx-auto mb-2 grid place-items-center rounded-2xl border border-white/15 bg-white/5" :class="ui.compact ? 'h-[84px] w-[84px]' : 'h-[130px] w-[130px]'">
        <svg v-if="p.icon === 'bird'" viewBox="0 0 64 64" width="72" height="72" fill="none"><path d="M6 36c10-2 16-8 22-20 6 12 12 18 26 20-10 0-18 2-26 12-8-10-14-12-22-12z" fill="#7fd0ff" stroke="#fff" stroke-width="3" stroke-linejoin="round" /></svg>
        <svg v-else-if="p.icon === 'run'" viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 50h48M14 50l8-6M26 50l8-6M38 50l8-6" /><path d="M20 32l14-8 12 6-10 4-12-2z" fill="#7fd0ff" /></svg>
        <svg v-else-if="p.icon === 'steer'" viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 8v48M8 32h48" /><path d="M32 8l-6 8M32 8l6 8M32 56l-6-8M32 56l6-8M8 32l8-6M8 32l8 6M56 32l-8-6M56 32l-8 6" /></svg>
        <svg v-else-if="p.icon === 'boost'" viewBox="0 0 64 64" width="72" height="72" fill="#a9dcff" stroke="#fff" stroke-width="3" stroke-linejoin="round"><path d="M36 6L14 36h14l-4 22 24-32H34z" /></svg>
        <svg v-else-if="p.icon === 'stamina'" viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"><rect x="6" y="22" width="48" height="22" rx="6" /><rect x="54" y="29" width="5" height="8" rx="2" fill="#fff" /><rect x="11" y="27" width="26" height="12" rx="3" fill="#6cc0ff" stroke="none" /></svg>
        <svg v-else-if="p.icon === 'arrow'" viewBox="0 0 48 48" width="72" height="72"><path d="M24 4 L40 30 L28 26 L28 44 L20 44 L20 26 L8 30 Z" fill="#a9dcff" stroke="#06142c" stroke-width="2.5" stroke-linejoin="round" /></svg>
        <svg v-else viewBox="0 0 64 64" width="72" height="72"><circle cx="32" cy="32" r="22" fill="#ffd14a" stroke="#fff" stroke-width="4" /><circle cx="32" cy="32" r="14" fill="none" stroke="#e09a00" stroke-width="4" /></svg>
      </div>
      <h2 class="display font-semibold text-white" :class="ui.compact ? 'text-3xl' : 'text-5xl'">{{ p.title }}</h2>
      <p class="mx-auto mt-2 max-w-[520px] leading-snug text-silver" :class="ui.compact ? 'text-[14px]' : 'text-lg'">{{ p.text }}</p>
      <div v-if="p.keys.length" class="mt-3 flex flex-wrap justify-center gap-2">
        <span v-for="k in p.keys" :key="k" class="num grid min-w-12 place-items-center rounded-lg border border-white/35 bg-white/10 px-4 py-2 text-xl text-white shadow-[0_2px_0_rgba(255,255,255,0.18)]">{{ k }}</span>
      </div>
      <div class="mt-4 flex items-center justify-center gap-2">
        <span v-for="(x, i) in pages" :key="i" class="h-2.5 rounded-full transition-all" :class="i === page ? 'w-8 bg-sky' : 'w-2.5 bg-white/30'"></span>
      </div>
      <div class="mt-4 flex justify-center gap-3">
        <button v-if="page > 0" class="btn" @click="back">Back</button>
        <button class="btn btn-primary !px-10" @click="next">{{ last ? "Let's fly!" : 'Next' }}</button>
      </div>
    </div>
  </div>
</template>
