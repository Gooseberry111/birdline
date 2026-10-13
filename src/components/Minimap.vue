<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { hud } from '../store'
import { renderMapImage, SIZE, STATES } from '../game/terrain'

const props = defineProps({ size: { type: Number, default: 170 } })
const cv = ref(null)
let img = null
let timer = null
const RANGE = 2600
const PX = 200

const colors = {
  airfield: '#e8f1ff', landmark: '#6cc0ff', gate: '#cfe3ff', gatenext: '#ffffff', gatedone: '#4a6f95',
  rival: '#ff9a7a', dest: '#ffe08a', thermal: '#9bd8ff',
}

function draw() {
  const c = cv.value
  if (!c || !img) return
  const g = c.getContext('2d')
  const p = hud.pos || { x: 0, z: 0, yaw: 0 }
  g.clearRect(0, 0, PX, PX)
  g.save()
  g.beginPath(); g.arc(PX / 2, PX / 2, PX / 2 - 1, 0, 7); g.clip()
  const scale = PX / (RANGE * 2)
  const ip = img.width / SIZE
  // draw the map image, north up, centred on the player
  g.save()
  g.translate(PX / 2, PX / 2)
  g.scale(scale / ip, scale / ip)
  g.drawImage(img, -(p.x + SIZE / 2) * ip, -(p.z + SIZE / 2) * ip)
  g.restore()
  g.fillStyle = 'rgba(5,12,27,0.28)'
  g.fillRect(0, 0, PX, PX)
  g.font = '600 10px "Barlow Condensed", sans-serif'
  g.textAlign = 'center'
  g.fillStyle = 'rgba(255,255,255,0.55)'
  for (const st of STATES) {
    const sx = PX / 2 + (st.x - p.x) * scale, sy = PX / 2 + (st.z - p.z) * scale
    if (Math.hypot(sx - PX / 2, sy - PX / 2) < PX / 2 - 20) g.fillText(st.name.replace(' State', '').toUpperCase(), sx, sy)
  }
  for (const m of hud.markers || []) {
    const dx = (m.x - p.x) * scale, dz = (m.z - p.z) * scale
    let x = PX / 2 + dx, y = PX / 2 + dz
    const d = Math.hypot(dx, dz)
    const lim = PX / 2 - 8
    const out = d > lim
    if (out) { x = PX / 2 + (dx / d) * lim; y = PX / 2 + (dz / d) * lim }
    g.fillStyle = colors[m.kind] || '#fff'
    g.globalAlpha = out ? 0.55 : 1
    const r = m.kind === 'gatenext' || m.kind === 'dest' ? 5 : m.kind === 'thermal' ? 4 : 3
    if (m.kind === 'airfield') { g.fillRect(x - 3, y - 3, 6, 6) }
    else if (m.kind === 'landmark') { g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.fill() }
    else if (m.kind === 'thermal') { g.strokeStyle = colors.thermal; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke() }
    else { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill() }
    g.globalAlpha = 1
  }
  g.restore()
  // player arrow
  g.save()
  g.translate(PX / 2, PX / 2)
  g.rotate(Math.PI - p.yaw)
  g.fillStyle = '#ffffff'
  g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill()
  g.restore()
  g.strokeStyle = 'rgba(213,221,232,0.5)'
  g.lineWidth = 1.5
  g.beginPath(); g.arc(PX / 2, PX / 2, PX / 2 - 1, 0, 7); g.stroke()
  g.fillStyle = '#d5dde8'
  g.font = '600 11px "Barlow Condensed", sans-serif'
  g.textAlign = 'center'
  g.fillText('N', PX / 2, 13)
}

onMounted(() => {
  img = renderMapImage(320)
  timer = setInterval(draw, 66)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <canvas ref="cv" :width="PX" :height="PX" :style="{ width: size + 'px', height: size + 'px' }" class="rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.45)]"></canvas>
</template>
