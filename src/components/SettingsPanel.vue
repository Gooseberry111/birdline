<script setup>
import { profile, game, ui } from '../store'
defineEmits(['close'])
const q = ['low', 'medium', 'high']
function vol(e) { profile.settings.volume = +e.target.value; game.engine?.audio.setVolume(profile.settings.volume) }
function reload() { location.reload() }
function music() { game.engine?.audio.musicOn(profile.settings.music !== false) }
function reset() {
  if (!confirm('Reset all progress, miles and trophies? This cannot be undone.')) return
  try { localStorage.removeItem('birdline.profile.v1') } catch (e) { /* ignore */ }
  location.reload()
}
async function install() { const p = ui.installEvent; if (!p) return; p.prompt(); await p.userChoice; ui.installEvent = null }
</script>

<template>
  <div class="absolute inset-0 z-50 grid place-items-center bg-ink/60" @click.self="$emit('close')">
    <div class="panel scroll max-h-[94vh] w-[min(440px,92vw)] overflow-y-auto p-5 sm:p-7 fade-up">
      <div class="flex items-center justify-between">
        <h3 class="display text-3xl font-semibold text-white">Settings</h3>
        <button class="text-steel hover:text-white" @click="$emit('close')">Close</button>
      </div>
      <div class="metal-line my-4"></div>
      <div class="space-y-5 text-sm">
        <label class="block">
          <div class="mb-1 flex justify-between"><span>Volume</span><span class="num text-base">{{ Math.round(profile.settings.volume * 100) }}</span></div>
          <input type="range" min="0" max="1" step="0.05" :value="profile.settings.volume" class="w-full" @input="vol" />
        </label>
        <div>
          <div class="mb-2">Graphics quality</div>
          <div class="flex gap-2">
            <button v-for="o in q" :key="o" class="chip cursor-pointer capitalize" :class="{ 'chip-on': profile.settings.quality === o }" @click="profile.settings.quality = o">{{ o }}</button>
          </div>
          <button class="mt-3 text-sky hover:underline" @click="reload">Apply and reload</button>
        </div>
        <label class="flex items-center justify-between">
          <span>Music</span>
          <input type="checkbox" v-model="profile.settings.music" class="h-4 w-4 accent-sky" @change="music" />
        </label>
        <label class="flex items-center justify-between">
          <span>Vibration on phones</span>
          <input type="checkbox" v-model="profile.settings.haptics" class="h-4 w-4 accent-sky" />
        </label>
        <label class="flex items-center justify-between">
          <span>Radio voice (tower and captain)</span>
          <input type="checkbox" v-model="profile.settings.radio" class="h-4 w-4 accent-sky" />
        </label>
        <label class="flex items-center justify-between">
          <span>Invert pitch controls</span>
          <input type="checkbox" v-model="profile.settings.invertY" class="h-4 w-4 accent-sky" />
        </label>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <button v-if="ui.installEvent" class="btn btn-primary !py-1.5 !text-base" @click="install">Install the app</button>
        <button class="btn btn-ghost !py-1.5 !text-base" @click="reset">Reset progress</button>
      </div>
      <div class="metal-line my-5"></div>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-silver/80">
        <span>W and S</span><span class="text-right text-steel">Dive and climb</span>
        <span>A and D</span><span class="text-right text-steel">Bank left and right</span>
        <span>Space</span><span class="text-right text-steel">Flap</span>
        <span>Shift</span><span class="text-right text-steel">Sprint flap</span>
        <span>Ctrl or X</span><span class="text-right text-steel">Air brake</span>
        <span>Q and E</span><span class="text-right text-steel">Abilities</span>
        <span>F</span><span class="text-right text-steel">Cruise assist</span>
        <span>C and M</span><span class="text-right text-steel">Camera and map</span>
        <span>Esc</span><span class="text-right text-steel">Pause</span>
      </div>
    </div>
  </div>
</template>
