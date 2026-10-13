<script setup>
import { ref } from 'vue'
import { ui, go, selectedBird, profile } from '../store'
import TopBar from '../components/TopBar.vue'
import BirdTag from '../components/BirdTag.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import { asset } from '../assets'
import TrophiesPanel from '../components/TrophiesPanel.vue'
import { dailyReady } from '../store'
const showSettings = ref(false)
const showTrophies = ref(false)
</script>

<template>
  <div class="absolute inset-0 z-10">
    <!-- phone held upright -->
    <template v-if="ui.portrait">
      <div class="absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink/80"></div>
      <TopBar />
      <div class="absolute inset-x-0 top-[72px] flex flex-col items-center fade-up">
        <h1 class="w-[min(250px,62vw)] rounded-2xl bg-white p-2.5 shadow-[0_16px_50px_rgba(2,8,20,0.5)]"><img :src="asset('logo.png')" alt="FlyBird" class="block w-full" /></h1>
        <p class="display mt-3 text-xl text-sky-2">Fly across Nigeria</p>
      </div>
      <div class="absolute inset-x-0 bottom-0 px-5 pb-[max(20px,env(safe-area-inset-bottom))] fade-up">
        <div class="mb-4 text-center">
          <div class="text-xs text-steel">Your bird</div>
          <BirdTag :bird="selectedBird" center />
        </div>
        <button class="btn btn-primary w-full !py-3.5 !text-2xl" @click="go('modes')">Fly</button>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <button class="btn !py-3" @click="go('hangar')">Hangar</button>
          <button class="btn !py-3" @click="showSettings = true">Settings</button>
        </div>
        <button class="btn btn-ghost mt-3 w-full !py-2.5" @click="showTrophies = true">Trophies{{ dailyReady() ? ' and daily bonus' : '' }}</button>
        <p class="mt-3 text-center text-xs text-steel">Flights play in landscape. You will be asked to turn your phone.</p>
      </div>
    </template>

    <!-- desktop and landscape -->
    <template v-else>
      <div class="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/25 to-transparent"></div>
      <TopBar />
      <div class="absolute top-1/2 -translate-y-1/2 fade-up" :class="ui.compact ? 'left-[5vw]' : 'left-[7vw]'">
        <h1 :class="ui.compact ? 'w-[min(210px,30vw)] rounded-2xl p-2' : 'w-[min(380px,34vw)] rounded-3xl p-3'" class="bg-white shadow-[0_20px_60px_rgba(2,8,20,0.5)]"><img :src="asset('logo.png')" alt="FlyBird" class="block w-full" /></h1>
        <div class="metal-line mt-5 w-[min(380px,60vw)]"></div>
        <p class="display text-sky-2" :class="ui.compact ? 'mt-2 text-lg' : 'mt-4 text-2xl'">Fly across Nigeria</p>
        <p v-if="!ui.compact" class="mt-2 max-w-md text-[15px] leading-relaxed text-silver/80">Take off from Abuja and fly across the FCT, Niger, Kaduna, Plateau and Kogi. Collect coins and unlock new birds.</p>
        <div class="flex flex-col items-start gap-3" :class="ui.compact ? 'mt-3' : 'mt-9'">
          <button class="btn btn-primary !px-12 !py-3 !text-2xl" @click="go('modes')">Fly</button>
          <div class="flex gap-3">
            <button class="btn" @click="go('hangar')">Hangar</button>
            <button class="btn btn-ghost" @click="showSettings = true">Settings</button>
            <button class="btn btn-ghost" @click="ui.howto = true">How to fly</button>
            <button class="btn btn-ghost" @click="showTrophies = true">Trophies</button>
          </div>
          <div v-if="dailyReady()" class="chip chip-on">Daily bonus ready. Finish a mission today</div>
        </div>
      </div>
      <div class="absolute text-right" :class="ui.compact ? 'bottom-3 right-4' : 'bottom-7 right-7'">
        <div class="text-sm text-steel">Your bird</div>
        <BirdTag :bird="selectedBird" class="mt-1" />
      </div>
    </template>
    <SettingsPanel v-if="showSettings" @close="showSettings = false" />
    <TrophiesPanel v-if="showTrophies" @close="showTrophies = false" />
  </div>
</template>
