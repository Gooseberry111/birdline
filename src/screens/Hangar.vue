<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { BIRDS, CLASSES, RARITIES, birdById, masteryTree, statTotal } from '../data/birds'
import { ABILITIES, abilityLevelMods } from '../data/abilities'
import { PLUMAGE, PATTERNS, TRAILS, BADGES, ACCESSORIES, HABITATS } from '../data/cosmetics'
import {
  ui, go, profile, game, toast, isBirdOwned, isBirdUnlocked, buyBird, effectiveStats, masteryFor,
  loadoutFor, ownsItem, buyItem, abilityLevel, upgradeAbility, upgradeCost, STAT_KEYS, statLevel, statUpgradeCost, upgradeStat,
} from '../store'
import TopBar from '../components/TopBar.vue'
import BirdIcon from '../components/BirdIcon.vue'
import BirdTag from '../components/BirdTag.vue'
import StatBar from '../components/StatBar.vue'

const filter = ref('all')
const tab = ref('overview')
const tabs = [
  { id: 'overview', n: 'Overview' }, { id: 'tune', n: 'Tune up' }, { id: 'progress', n: 'Progress' }, { id: 'upgrades', n: 'Abilities' },
  { id: 'style', n: 'Customize' }, { id: 'habitat', n: 'Habitat' },
]

onMounted(() => { ui.previewId = profile.selected; game.engine?.refreshBird() })
onBeforeUnmount(() => { ui.previewId = null; game.engine?.refreshBird() })

const view = computed(() => birdById(ui.previewId) || birdById(profile.selected))
const list = computed(() => BIRDS.filter((b) => filter.value === 'all' || b.cls === filter.value).sort((a, b) => a.unlock - b.unlock))
const owned = computed(() => isBirdOwned(view.value.id))
const unlocked = computed(() => isBirdUnlocked(view.value))
const eff = computed(() => effectiveStats(view.value))
const mastery = computed(() => masteryFor(view.value.id))
const lo = computed(() => loadoutFor(view.value.id))
const rar = computed(() => RARITIES[view.value.rarity])

function preview(b) { ui.previewId = b.id; ui.drawer = false; game.engine?.refreshBird() }
function select() { profile.selected = view.value.id; toast(`${view.value.name} ${view.value.aircraft} ready for takeoff`, 'good') }
function buy() {
  if (!buyBird(view.value.id)) toast('Not enough miles', 'bad')
  else profile.selected = view.value.id
}

function tune(k) {
  if (!owned.value) { toast('Add this bird to your hangar first', 'bad'); return }
  if (!upgradeStat(view.value.id, k)) toast(statLevel(view.value.id, k) >= 5 ? 'Maxed out' : 'Not enough miles', 'bad')
  else toast('Upgraded!', 'good')
}
function slotLevel(i) { return abilityLevel(view.value.id, i) }
function up(i) {
  if (!upgradeAbility(view.value.id, i)) toast(slotLevel(i) >= 3 ? 'Fully upgraded' : 'Not enough miles', 'bad')
  else toast('Ability upgraded', 'good')
}

function pick(type, key, opt) {
  if (!owned.value) { toast('Add this bird to your hangar first', 'bad'); return }
  if (!ownsItem(type, opt.id)) {
    if (!buyItem(type, opt.id, opt.price)) { toast('Not enough miles', 'bad'); return }
    toast(`${opt.name} unlocked`, 'good')
  }
  lo.value[key] = opt.id
}
function pickHabitat(h) {
  if (!ownsItem('habitat', h.id)) {
    if (!buyItem('habitat', h.id, h.price)) { toast('Not enough miles', 'bad'); return }
  }
  profile.habitat = h.id
  game.engine?.setHabitat()
}
const groups = [
  { title: 'Plumage', type: 'plumage', key: 'plumage', items: PLUMAGE },
  { title: 'Pattern', type: 'pattern', key: 'pattern', items: PATTERNS },
  { title: 'Flight trail', type: 'trail', key: 'trail', items: TRAILS },
  { title: 'Badge', type: 'badge', key: 'badge', items: BADGES },
  { title: 'Harness and accessories', type: 'accessory', key: 'accessory', items: ACCESSORIES },
]
const statRows = [['Speed', 'speed'], ['Range', 'range'], ['Altitude', 'altitude'], ['Agility', 'agility'], ['Endurance', 'endurance']]
</script>

<template>
  <div class="absolute inset-0 z-10">
    <template v-if="!ui.compact">
      <div class="absolute inset-y-0 left-0 w-[420px] bg-gradient-to-r from-ink/85 to-transparent"></div>
      <div class="absolute inset-y-0 right-0 w-[520px] bg-gradient-to-l from-ink/85 to-transparent"></div>
    </template>
    <TopBar back="Menu" @back="go('title')" />

    <!-- roster -->
    <button v-if="ui.compact && !ui.portrait" class="btn absolute left-2 top-12 z-20 !px-4 !py-1 !text-base" @click="ui.drawer = true">Birds</button>
    <div v-if="ui.compact && !ui.portrait && ui.drawer" class="absolute inset-0 z-30 bg-ink/60" @click="ui.drawer = false"></div>
    <div v-show="!ui.compact || ui.drawer || ui.portrait" class="flex flex-col fade-up" :class="ui.portrait ? 'absolute inset-x-0 top-[35%] h-[84px] px-2' : ui.compact ? 'fixed inset-y-0 left-0 z-40 w-[300px] bg-navy/95 p-3 pt-2' : 'absolute bottom-5 left-5 top-24 w-[340px]'">
      <div v-if="!ui.portrait" class="flex items-center justify-between"><h2 class="display font-semibold text-white" :class="ui.compact ? 'text-2xl' : 'text-4xl'">Hangar</h2><button v-if="ui.compact" class="text-steel" @click="ui.drawer = false">Close</button></div>
      <div v-if="!ui.portrait" class="mt-3 flex flex-wrap gap-1.5">
        <button class="chip cursor-pointer" :class="{ 'chip-on': filter === 'all' }" @click="filter = 'all'">All</button>
        <button v-for="(c, id) in CLASSES" :key="id" class="chip cursor-pointer" :class="{ 'chip-on': filter === id }" @click="filter = id">{{ c.name }}</button>
      </div>
      <div class="scroll" :class="ui.portrait ? 'flex gap-2 overflow-x-auto overflow-y-hidden pb-1' : 'mt-3 flex-1 space-y-2 overflow-y-auto pr-1.5'">
        <button v-for="b in list" :key="b.id" class="panel group flex items-center gap-3 p-2.5 pr-3 text-left transition hover:border-sky/60"
          :class="[ui.portrait ? 'w-[220px] shrink-0' : 'w-full', { '!border-sky': view.id === b.id }]" @click="preview(b)">
          <div class="grid h-12 w-[84px] shrink-0 place-items-center rounded-lg bg-white/[0.04]">
            <BirdIcon :bird="b" :size="80" :locked="!isBirdOwned(b.id) && !isBirdUnlocked(b)" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="display flex items-baseline gap-2 text-xl leading-none">
              <span class="truncate text-white">{{ b.name }}</span>
              <span class="shrink-0 text-sky">{{ b.aircraft }}</span>
            </div>
            <div class="mt-1 flex items-center gap-2 text-xs text-steel">
              <span class="h-1.5 w-1.5 rounded-full" :style="{ background: RARITIES[b.rarity].color }"></span>
              {{ CLASSES[b.cls].name }}
              <span v-if="profile.selected === b.id" class="text-sky-2">In use</span>
              <span v-else-if="ui.portrait" class="text-sky-2">{{ isBirdOwned(b.id) ? 'Owned' : !isBirdUnlocked(b) ? 'Level ' + b.unlock : b.price.toLocaleString() }}</span>
            </div>
          </div>
          <div v-if="!ui.portrait" class="text-right text-xs">
            <div v-if="isBirdOwned(b.id)" class="text-sky-2">Owned</div>
            <div v-else-if="!isBirdUnlocked(b)" class="text-steel">Level {{ b.unlock }}</div>
            <div v-else class="num text-base text-white">{{ b.price.toLocaleString() }}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- detail -->
    <div class="panel absolute flex flex-col fade-up" :class="ui.portrait ? 'inset-x-2 bottom-2 top-[calc(35%+92px)] p-3' : ui.compact ? 'bottom-2 right-2 top-12 w-[min(55vw,440px)] p-3' : 'bottom-5 right-5 top-24 w-[490px] p-6'">
      <BirdTag :bird="view" :big="!ui.compact" />
      <div v-if="!ui.compact" class="mt-3 flex flex-wrap gap-2">
        <span class="chip" :style="{ borderColor: rar.color + '99', color: rar.color }">{{ rar.name }}</span>
        <span class="chip">{{ CLASSES[view.cls].name }} class</span>
        <span class="chip">Mastery {{ mastery.level }}</span>
      </div>

      <div class="flex gap-1 overflow-x-auto border-b border-white/10" :class="ui.compact ? 'mt-2' : 'mt-4'">
        <button v-for="t in tabs" :key="t.id" class="display relative shrink-0 px-2 pb-2 text-[15px] text-steel transition hover:text-white" :class="{ '!text-white': tab === t.id }" @click="tab = t.id">
          {{ t.n }}
          <span v-if="tab === t.id" class="absolute inset-x-2 -bottom-px h-0.5 rounded bg-sky"></span>
        </button>
      </div>

      <div class="scroll flex-1 overflow-y-auto pr-1.5" :class="ui.compact ? 'mt-2' : 'mt-4'">
        <!-- overview -->
        <div v-if="tab === 'overview'" class="space-y-5">
          <p class="text-[15px] leading-relaxed text-silver/90">{{ view.blurb }}</p>
          <div class="space-y-2.5">
            <StatBar v-for="r in statRows" :key="r[1]" :label="r[0]" :value="eff[r[1]]" :base="view.stats[r[1]]" />
            <StatBar label="Payload" :value="view.payload" />
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="hud-panel p-3"><div class="text-steel">Class</div><div class="mt-0.5 text-white">{{ CLASSES[view.cls].blurb }}</div></div>
            <div class="hud-panel p-3"><div class="text-steel">Wingspan</div><div class="mt-0.5 text-white">{{ view.wingspan }} m</div></div>
            <div class="hud-panel p-3"><div class="text-steel">Habitat</div><div class="mt-0.5 text-white">{{ view.habitat }}</div></div>
            <div class="hud-panel p-3"><div class="text-steel">Behaviour</div><div class="mt-0.5 text-white">{{ view.behaviour }}</div></div>
          </div>
          <div class="space-y-2">
            <div v-for="(id, i) in view.abilities" :key="id" class="hud-panel p-3" :class="{ 'opacity-60': i === 1 && mastery.level < 30 }">
              <div class="flex items-center justify-between">
                <span class="display text-xl text-white">{{ ABILITIES[id].name }}</span>
                <span class="chip">{{ i === 0 ? 'Key Q' : 'Key E' }}</span>
              </div>
              <div class="mt-1 text-sm text-silver/80">{{ ABILITIES[id].desc }}</div>
              <div v-if="i === 1 && mastery.level < 30" class="mt-1 text-xs text-steel">Unlocks at mastery 30</div>
            </div>
          </div>
        </div>

        <!-- tune up -->
        <div v-else-if="tab === 'tune'" class="space-y-3">
          <p class="text-sm text-silver/85">Spend the miles you earn from coins to make this bird better. Each level adds a boost you can feel.</p>
          <div v-for="k in STAT_KEYS" :key="k" class="rounded-xl border border-white/15 bg-white/5 p-3">
            <div class="flex items-center justify-between">
              <span class="display text-xl font-semibold capitalize text-white">{{ k }}</span>
              <div class="flex gap-1"><span v-for="n in 5" :key="n" class="h-3 w-6 rounded-full" :class="statLevel(view.id, k) >= n ? 'bg-sky' : 'bg-white/20'"></span></div>
            </div>
            <button class="btn btn-primary mt-2 !py-1.5 !text-base" :disabled="!owned || statLevel(view.id, k) >= 5" @click="tune(k)">
              {{ statLevel(view.id, k) >= 5 ? 'Maxed out' : 'Upgrade for ' + statUpgradeCost(statLevel(view.id, k)).toLocaleString() + ' miles' }}
            </button>
          </div>
        </div>

        <!-- progression -->
        <div v-else-if="tab === 'progress'" class="space-y-4">
          <div>
            <div class="flex items-baseline justify-between">
              <span class="display text-2xl text-white">Mastery {{ mastery.level }}</span>
              <span class="text-sm text-steel">{{ mastery.level >= 50 ? 'Maximum' : mastery.into + ' of ' + mastery.need }}</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full bg-sky" :style="{ width: (mastery.into / mastery.need) * 100 + '%' }"></div></div>
            <p class="mt-2 text-sm text-steel">Fly this bird to raise its mastery. Rarity gives only a small edge, skill decides races.</p>
          </div>
          <div class="relative space-y-3 pl-6">
            <div class="absolute bottom-2 left-[9px] top-2 w-px bg-white/15"></div>
            <div v-for="n in masteryTree(view)" :key="n.level" class="relative">
              <span class="absolute -left-6 top-1.5 h-[18px] w-[18px] rounded-full border-2" :class="mastery.level >= n.level ? 'border-sky bg-sky' : 'border-white/30 bg-navy'"></span>
              <div class="hud-panel p-3" :class="{ 'opacity-60': mastery.level < n.level }">
                <div class="flex items-center justify-between"><span class="display text-xl text-white">{{ n.name }}</span><span class="num text-steel">Level {{ n.level }}</span></div>
                <div class="text-sm text-silver/80">{{ n.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ability upgrades -->
        <div v-else-if="tab === 'upgrades'" class="space-y-3">
          <p class="text-sm text-steel">Upgrades shorten cooldowns and lengthen effects. Three levels per ability, balanced so no ability replaces good flying.</p>
          <div v-for="(id, i) in view.abilities" :key="id" class="hud-panel p-4">
            <div class="flex items-center justify-between">
              <span class="display text-2xl text-white">{{ ABILITIES[id].name }}</span>
              <div class="flex gap-1.5"><span v-for="p in 3" :key="p" class="h-2.5 w-6 rounded-sm" :class="slotLevel(i) >= p ? 'bg-sky' : 'bg-white/15'"></span></div>
            </div>
            <div class="mt-1 text-sm text-silver/80">
              Duration {{ (ABILITIES[id].dur * abilityLevelMods(slotLevel(i)).dur).toFixed(1) }} s,
              cooldown {{ (ABILITIES[id].cd * abilityLevelMods(slotLevel(i)).cd).toFixed(1) }} s
            </div>
            <button class="btn mt-3 !py-1.5 !text-base" :disabled="!owned || slotLevel(i) >= 3 || (i === 1 && mastery.level < 30)" @click="up(i)">
              {{ slotLevel(i) >= 3 ? 'Maximum' : 'Upgrade for ' + upgradeCost(slotLevel(i)).toLocaleString() + ' miles' }}
            </button>
          </div>
        </div>

        <!-- customize -->
        <div v-else-if="tab === 'style'" class="space-y-5">
          <p class="text-sm text-steel">Cosmetics never change how a bird flies. The bird always stays a bird.</p>
          <div v-for="g in groups" :key="g.type">
            <div class="display mb-2 text-xl text-white">{{ g.title }}</div>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="o in g.items" :key="o.id" class="hud-panel flex items-center gap-2 p-2.5 text-left text-sm transition hover:border-sky/60"
                :class="{ '!border-sky bg-sky/10': lo[g.key] === o.id }" @click="pick(g.type, g.key, o)">
                <span v-if="o.tint || o.color" class="h-4 w-4 shrink-0 rounded-full border border-white/30" :style="{ background: o.tint || o.color }"></span>
                <span class="flex-1 truncate text-white">{{ o.name }}</span>
                <span class="text-xs text-steel">{{ ownsItem(g.type, o.id) ? (lo[g.key] === o.id ? 'On' : 'Owned') : o.price.toLocaleString() }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- habitat -->
        <div v-else class="space-y-3">
          <p class="text-sm text-steel">Choose where your bird rests between flights.</p>
          <button v-for="h in HABITATS" :key="h.id" class="hud-panel w-full p-4 text-left transition hover:border-sky/60" :class="{ '!border-sky bg-sky/10': profile.habitat === h.id }" @click="pickHabitat(h)">
            <div class="flex items-center justify-between">
              <span class="display text-2xl text-white">{{ h.name }}</span>
              <span class="text-sm text-steel">{{ ownsItem('habitat', h.id) ? (profile.habitat === h.id ? 'Current' : 'Owned') : h.price.toLocaleString() + ' miles' }}</span>
            </div>
            <div class="text-sm text-silver/80">{{ h.blurb }}</div>
          </button>
        </div>
      </div>

      <div class="metal-line" :class="ui.compact ? 'my-2' : 'my-4'"></div>
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-steel">Total rating <span class="num text-xl text-white">{{ Math.round(statTotal(view) / 5) }}</span></div>
        <button v-if="owned" class="btn btn-primary" :class="ui.compact ? '!px-4 !py-1.5 !text-base' : ''" :disabled="profile.selected === view.id" @click="select">{{ profile.selected === view.id ? 'Selected' : 'Select bird' }}</button>
        <button v-else-if="unlocked" class="btn btn-primary" @click="buy">Add for {{ view.price.toLocaleString() }} miles</button>
        <button v-else class="btn" disabled>Reach level {{ view.unlock }}</button>
      </div>
    </div>
  </div>
</template>
