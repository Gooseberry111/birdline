<script setup>
import { ui, game, go } from '../store'

function again() {
  const r = ui.results
  ui.screen = 'play'
  game.engine.startMode(r.mode, r.opts)
}
const canShare = typeof navigator !== 'undefined' && !!navigator.share
async function share() {
  const r = ui.results
  try { await navigator.share({ title: 'FlyBird', text: `I just finished ${r.headline} in FlyBird, flying a ${r.bird.name} ${r.bird.aircraft} over Abuja!`, url: location.href }) } catch (e) { /* cancelled */ }
}
function hangar() { game.engine.endMode(); go('hangar') }
function menu() { game.engine.endMode(); go('title') }
</script>

<template>
  <div class="absolute inset-0 z-30 grid place-items-center bg-ink/65 backdrop-blur-sm">
    <div v-if="ui.results" class="panel scroll max-h-[96vh] w-[min(560px,92vw)] overflow-y-auto p-4 sm:p-8 fade-up">
      <div class="display text-lg text-steel">{{ ui.results.bird.name }} {{ ui.results.bird.aircraft }}</div>
      <h3 class="display text-4xl font-bold leading-none text-white sm:text-6xl">{{ ui.results.title }}</h3>
      <div class="display mt-2 text-3xl text-sky-2">{{ ui.results.headline }}</div>
      <div class="metal-line my-5"></div>
      <div class="grid grid-cols-2 gap-x-8 gap-y-2 text-[15px]">
        <template v-for="l in ui.results.lines" :key="l[0]">
          <span class="text-steel">{{ l[0] }}</span>
          <span class="num text-right text-lg text-white">{{ l[1] }}</span>
        </template>
      </div>
      <div class="metal-line my-5"></div>
      <div class="flex flex-wrap items-center gap-3">
        <span class="chip !px-4 !py-1.5 !text-base text-white"><span class="num text-xl">+{{ ui.results.miles.toLocaleString() }}</span> miles</span>
        <span class="chip !px-4 !py-1.5 !text-base text-white"><span class="num text-xl">+{{ ui.results.xp }}</span> pilot XP</span>
        <span v-if="ui.results.levelUp" class="chip chip-on !px-4 !py-1.5 !text-base">Pilot level {{ ui.results.levelUp }}</span>
        <span v-if="ui.results.mastered" class="chip chip-on !px-4 !py-1.5 !text-base">{{ ui.results.bird.name }} mastery {{ ui.results.mastered }}</span>
      </div>
      <div class="mt-7 flex flex-wrap gap-3">
        <button class="btn btn-primary" @click="again">Fly again</button>
        <button class="btn" @click="hangar">Hangar</button>
        <button v-if="canShare" class="btn" @click="share">Share</button>
        <button class="btn btn-ghost" @click="menu">Menu</button>
      </div>
    </div>
  </div>
</template>
