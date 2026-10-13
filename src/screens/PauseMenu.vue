<script setup>
import { ref } from 'vue'
import { ui, game, go, profile } from '../store'
import SettingsPanel from '../components/SettingsPanel.vue'

const settings = ref(false)

function resume() { game.engine.setPaused(false) }
function replay() {
  profile.settings.tutorialDone = false
  game.engine.startMode('free', {})
}
function end() {
  game.engine.setPaused(false)
  game.engine.mode?.finish()
}
function quit() {
  game.engine.endMode()
  go('title')
}
</script>

<template>
  <div class="absolute inset-0 z-30 grid place-items-center bg-ink/55 backdrop-blur-sm">
    <div class="panel scroll max-h-[94vh] w-[min(380px,90vw)] overflow-y-auto p-5 sm:p-7 fade-up">
      <h3 class="display text-4xl font-semibold text-white">Paused</h3>
      <div class="metal-line my-4"></div>
      <div class="flex flex-col gap-2 sm:gap-2.5">
        <button class="btn btn-primary" @click="resume">Resume</button>
        <button class="btn" @click="end">{{ ui.mode === 'free' ? 'End flight and collect rewards' : 'Abandon and see results' }}</button>
        <button class="btn" @click="game.engine.takePhoto()">Save a photo</button>
        <button class="btn" @click="ui.howto = true">How to fly</button>
        <button class="btn" @click="ui.help = true; resume()">Controls card</button>
        <button class="btn" @click="settings = true">Settings</button>
        <button class="btn btn-ghost" @click="quit">Quit to menu</button>
      </div>
    </div>
    <SettingsPanel v-if="settings" @close="settings = false" />
  </div>
</template>
