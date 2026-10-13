<script setup>
import { ref, computed } from 'vue'
import { MODES } from '../data/modes'
import { MISSIONS, CAPTAIN } from '../data/missions'
import { WEATHER } from '../data/weather'
import { AIRFIELDS } from '../game/terrain'
import { ui, go, game, selectedBird, profile } from '../store'
import TopBar from '../components/TopBar.vue'
import BirdTag from '../components/BirdTag.vue'
import BirdIcon from '../components/BirdIcon.vue'

const sel = ref(MODES[0].id)
const THEME = {
  missions: ['#ffcf4a', '#ff8a1f'], free: ['#6be39a', '#1fae78'], race: ['#ff7a7a', '#d92f55'], haul: ['#5ed2ff', '#2a7de0'],
  rescue: ['#b8c4d8', '#7b8aa6'], cargo: ['#b8c4d8', '#7b8aa6'], emergency: ['#b8c4d8', '#7b8aa6'], multi: ['#b8c4d8', '#7b8aa6'],
}
const tile = (m) => ({ background: `linear-gradient(135deg, ${THEME[m.id][0]}, ${THEME[m.id][1]})` })
const missionId = ref('school')
const missionUnlocked = (i) => i === 0 || !!profile.missions.done[MISSIONS[i - 1].id]
const missionDone = (m) => profile.missions.done[m.id]
missionId.value = (MISSIONS.find((m, i) => missionUnlocked(i) && !missionDone(m)) || MISSIONS[0]).id
const mode = computed(() => MODES.find((m) => m.id === sel.value))
const weather = ref('auto')
const time = ref(14.5)
const diff = ref('normal')
const dest = ref('north')
const times = [
  { n: 'Morning', h: 8.5 }, { n: 'Afternoon', h: 14.5 }, { n: 'Dusk', h: 18.1 }, { n: 'Night', h: 22 },
]
const diffs = ['easy', 'normal', 'hard']
const weathers = ['auto', ...Object.keys(WEATHER)]
const dests = AIRFIELDS.filter((a) => a.id !== 'home')

function start() {
  if (mode.value.status !== 'ready') return
  ui.mode = mode.value.id
  ui.screen = 'play'
  game.engine.startMode(mode.value.id, {
    weather: weather.value, hour: time.value, difficulty: diff.value, dest: dest.value, mission: missionId.value,
  })
}
</script>

<template>
  <div class="absolute inset-0 z-10">
    <div class="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/30 to-ink/70"></div>
    <TopBar back="Menu" @back="go('title')" />
    <div class="absolute inset-x-0 bottom-0 flex fade-up" :class="ui.portrait ? 'top-12 flex-col gap-2 px-2 pb-2' : ui.compact ? 'top-12 gap-3 px-3 pb-2' : 'top-24 gap-6 px-6 pb-6'">
      <div class="scroll shrink-0 space-y-2 overflow-y-auto pr-2" :class="ui.portrait ? 'flex w-full gap-2 overflow-x-auto overflow-y-hidden pb-1' : ui.compact ? 'w-[38%] space-y-2' : 'w-[min(430px,44vw)] space-y-2.5'">
        <h2 v-if="!ui.compact" class="display mb-1 text-4xl font-semibold text-white">Choose a flight</h2>
        <button v-for="m in MODES" :key="m.id" class="panel relative overflow-hidden text-left transition hover:border-sky/60"
          :class="[ui.portrait ? 'w-[150px] shrink-0' : 'w-full', ui.compact ? 'p-2.5' : 'p-4', sel === m.id ? '!border-sky' : '', m.status !== 'ready' ? 'opacity-60' : '']" @click="sel = m.id">
          <span v-if="sel === m.id" class="absolute inset-y-0 left-0 w-1 bg-sky"></span>
          <div class="flex items-center justify-between">
            <span class="display font-semibold text-white" :class="ui.compact ? 'text-lg' : 'text-2xl'">{{ m.name }}</span>
            <span v-if="m.status !== 'ready'" class="chip">Soon</span>
            <span v-else-if="m.id === 'missions'" class="chip chip-on">Start here</span>
          </div>
          <div class="mt-0.5 text-steel" :class="ui.compact ? 'text-xs' : 'text-sm'">{{ m.tagline }}</div>
        </button>
      </div>

      <div class="flex min-h-0 min-w-0 flex-1 justify-end" :class="ui.portrait ? 'items-stretch' : 'items-end'">
        <div class="panel flex max-h-full min-h-0 flex-col" :class="[ui.portrait ? 'w-full' : 'w-[min(520px,100%)]', ui.compact ? 'p-4' : 'p-7']">
         <div class="scroll min-h-0 flex-1 overflow-y-auto pr-1">
          <h3 class="display font-semibold text-white" :class="ui.compact ? 'text-2xl' : 'text-4xl'">{{ mode.name }}</h3>
          <p class="mt-1.5 leading-relaxed text-silver/85" :class="ui.compact ? 'text-[13px]' : 'text-[15px]'">{{ mode.desc }}</p>
          <p v-if="mode.reward" class="mt-2 text-sm text-sky-2">{{ mode.reward }}</p>
          <div class="metal-line my-5"></div>

          <template v-if="mode.status === 'ready'">
            <div v-if="mode.id === 'missions'" class="mb-4 space-y-2">
              <button v-for="(m, i) in MISSIONS" :key="m.id" class="hud-panel w-full p-3 text-left transition" :disabled="!missionUnlocked(i)"
                :class="[missionId === m.id ? '!border-sky bg-sky/10' : '', missionUnlocked(i) ? 'hover:border-sky/60' : 'opacity-50']" @click="missionUnlocked(i) && (missionId = m.id)">
                <div class="flex items-center justify-between gap-2">
                  <span class="display text-xl text-white">{{ i + 1 }}. {{ m.name }}</span>
                  <span class="text-xs" :class="missionDone(m) ? 'text-sky-2' : 'text-steel'">{{ !missionUnlocked(i) ? 'Locked' : missionDone(m) ? 'Done, best ' + Math.floor(missionDone(m).best / 60) + ':' + String(missionDone(m).best % 60).padStart(2, '0') : m.level }}</span>
                </div>
                <div v-if="missionId === m.id" class="mt-1 text-[13px] leading-snug text-silver/85">{{ m.blurb }}</div>
                <div v-if="missionId === m.id" class="mt-1 text-[13px] italic leading-snug text-sky-2">{{ CAPTAIN }}: "{{ m.brief }}"</div>
                <div v-if="missionId === m.id" class="mt-1 text-xs text-sky-2">Reward {{ m.reward.miles }} miles and {{ m.reward.xp }} XP</div>
              </button>
            </div>
            <div class="space-y-4 text-sm">
              <div>
                <div class="mb-1.5 text-steel">Weather</div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="w in weathers" :key="w" class="chip cursor-pointer capitalize" :class="{ 'chip-on': weather === w }" @click="weather = w">{{ w === 'auto' ? 'Automatic' : WEATHER[w].name }}</button>
                </div>
              </div>
              <div>
                <div class="mb-1.5 text-steel">Time of day</div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="t in times" :key="t.n" class="chip cursor-pointer" :class="{ 'chip-on': time === t.h }" @click="time = t.h">{{ t.n }}</button>
                </div>
              </div>
              <div v-if="mode.id === 'race'">
                <div class="mb-1.5 text-steel">Rival pace</div>
                <div class="flex gap-2">
                  <button v-for="d in diffs" :key="d" class="chip cursor-pointer capitalize" :class="{ 'chip-on': diff === d }" @click="diff = d">{{ d }}</button>
                </div>
              </div>
              <div v-if="mode.id === 'haul'">
                <div class="mb-1.5 text-steel">Destination</div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="a in dests" :key="a.id" class="chip cursor-pointer" :class="{ 'chip-on': dest === a.id }" @click="dest = a.id">{{ a.name }}</button>
                </div>
              </div>
            </div>
            <div class="metal-line my-5"></div>
          </template>

         </div>
          <div class="mt-3 flex gap-4 border-t-2 border-white/20 pt-3" :class="ui.portrait ? 'flex-col items-stretch' : 'items-center justify-between'">
            <button class="flex items-center gap-3 text-left" @click="go('hangar')">
              <BirdIcon :bird="selectedBird" :size="96" />
              <div>
                <BirdTag :bird="selectedBird" />
                <div class="text-xs text-steel">Change in hangar</div>
              </div>
            </button>
            <button class="btn btn-primary !px-8 !py-3 !text-2xl" :disabled="mode.status !== 'ready'" @click="start">Take off</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
