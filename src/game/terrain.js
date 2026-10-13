import * as THREE from 'three'
import { makeNoise, fbm, clamp, lerp, smooth, makeRng } from './noise'

export const SIZE = 10000
export const HALF = SIZE / 2
export const SEA = 0

const nBase = makeNoise(11)
const nRidge = makeNoise(23)
const nDetail = makeNoise(37)
const nMoist = makeNoise(51)
const nColor = makeNoise(77)
const nForest = makeNoise(91)

export const AIRFIELDS = [
  { id: 'home', name: 'Abuja Airport', sub: 'Nnamdi Azikiwe International, FCT', x: 0, z: 0, h: 62, r: 330, blend: 520, dir: 0 },
  { id: 'north', name: 'Kaduna Airport', sub: 'Kaduna International, Kaduna State', x: -1200, z: -3300, h: 95, r: 240, blend: 450, dir: 0.5 },
  { id: 'south', name: 'Lokoja Airstrip', sub: 'Lokoja, Kogi State', x: 300, z: 2750, h: 42, r: 240, blend: 380, dir: 1.2 },
  { id: 'east', name: 'Jos Airport', sub: 'Yakubu Gowon Airport, Plateau State', x: 3400, z: -900, h: 250, r: 240, blend: 420, dir: 0.2 },
  { id: 'west', name: 'Minna Airport', sub: 'Minna Airport, Niger State', x: -3400, z: 300, h: 58, r: 240, blend: 400, dir: 1.0 },
]

export const CITY = { x: 1650, z: 500, h: 70, r: 1150, blend: 650 }

// Real places in Abuja, squeezed into the map. ay is a good flying height above the city for a fly over.
const C = CITY
export const SITES = [
  { id: 'villa', name: 'Presidential Villa', x: C.x - 150, z: C.z - 1020, ay: 110, r: 170 },
  { id: 'court', name: 'Supreme Court', x: C.x + 60, z: C.z - 930, ay: 100, r: 150 },
  { id: 'assembly', name: 'National Assembly', x: C.x + 260, z: C.z - 960, ay: 110, r: 170 },
  { id: 'eagle', name: 'Eagle Square', x: C.x - 100, z: C.z - 520, ay: 90, r: 160 },
  { id: 'mosque', name: 'National Mosque', x: C.x + 640, z: C.z - 520, ay: 110, r: 160 },
  { id: 'ncc', name: 'National Christian Centre', x: C.x - 640, z: C.z - 480, ay: 110, r: 160 },
  { id: 'tower', name: 'Millennium Tower', x: C.x + 330, z: C.z - 250, ay: 240, r: 150 },
  { id: 'cbd', name: 'Central Business District', x: C.x + 80, z: C.z + 40, ay: 260, r: 190 },
  { id: 'stadium', name: 'Moshood Abiola Stadium', x: C.x - 250, z: C.z + 930, ay: 110, r: 190 },
  { id: 'wuse', name: 'Wuse Market', x: C.x + 650, z: C.z + 420, ay: 90, r: 170 },
  { id: 'maitama', name: 'Maitama', x: C.x + 500, z: C.z - 960, ay: 100, r: 190 },
  { id: 'asokoro', name: 'Asokoro', x: C.x - 560, z: C.z - 860, ay: 100, r: 190 },
  { id: 'garki', name: 'Garki', x: C.x - 100, z: C.z + 560, ay: 100, r: 190 },
]
export const siteById = (id) => SITES.find((s) => s.id === id)

// Zuma Rock and Aso Rock: the big granite domes that watch over Abuja
export const ZUMA = { x: -2600, z: -1100, r: 420, hgt: 420 }
export const ASO = { x: CITY.x - 150, z: CITY.z - 1500, r: 320, hgt: 250 }
const ROCKS = [ZUMA, ASO]

// rivers and lakes (the River Niger and the Benue meet near Lokoja)
export const NIGER = [[-5200, 2300], [-3800, 2500], [-2400, 3000], [-1000, 3350], [300, 3350], [1300, 3200]]
export const BENUE = [[5200, 2600], [4200, 2850], [3100, 3300], [2000, 3150], [1300, 3200]]
export const CONFLUENCE = { x: 1300, z: 3200 }
const RIVERS = [NIGER, BENUE]
export const LAKES = [{ name: 'Usuma Dam', x: -400, z: -1500, r: 420 }, { name: 'Jabi Lake', x: CITY.x - 950, z: CITY.z + 250, r: 190 }]

// the states around the Federal Capital Territory, used for the "over ..." readout
export const STATES = [
  { name: 'FCT Abuja', x: 700, z: 350 },
  { name: 'Niger State', x: -3300, z: -400 },
  { name: 'Kaduna State', x: -1200, z: -3300 },
  { name: 'Plateau State', x: 3300, z: -1000 },
  { name: 'Nasarawa State', x: 2600, z: 1700 },
  { name: 'Kogi State', x: -400, z: 3200 },
]
export function stateAt(x, z) {
  let best = STATES[0], bd = Infinity
  for (const s of STATES) {
    const d = Math.hypot(s.x - x, s.z - z)
    if (d < bd) { bd = d; best = s }
  }
  return best
}

function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az
  const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1)
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}
function riverDist(x, z) {
  let best = Infinity
  for (const poly of RIVERS) {
    for (let i = 0; i < poly.length - 1; i++) {
      const d = segDist(x, z, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1])
      if (d < best) best = d
    }
  }
  return best
}

const hsh = (i, j, s) => { const n = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n) }
const ROCK_CELL = 1500

const FLAT = [...AIRFIELDS, CITY]

export function heightAt(x, z) {
  const r = Math.hypot(x, z) / HALF
  // rolling savanna plateau
  let h = 62 + fbm(nBase, x * 0.00045, z * 0.00045, 4) * 38 + fbm(nDetail, x * 0.002, z * 0.002, 3) * 6
  // the Jos Plateau rises in the east, Kaduna is higher and drier, Kogi is low near the rivers
  const pw = smooth(1500, 3500, x) * (1 - smooth(1400, 3300, Math.abs(z + 900)))
  const ridge = 1 - Math.abs(fbm(nRidge, x * 0.0011, z * 0.0011, 4))
  h += pw * (150 + ridge * ridge * 300)
  h += smooth(-1200, -3200, z) * 30 - smooth(1800, 3600, z) * 38
  // granite inselbergs scattered across the savanna
  const ci = Math.floor(x / ROCK_CELL), cj = Math.floor(z / ROCK_CELL)
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const i = ci + di, j = cj + dj
      if (hsh(i, j, 1) > 0.42) continue
      const cx = (i + 0.15 + 0.7 * hsh(i, j, 2)) * ROCK_CELL, cz = (j + 0.15 + 0.7 * hsh(i, j, 3)) * ROCK_CELL
      const rad = 90 + 150 * hsh(i, j, 4)
      const d = Math.hypot(x - cx, z - cz)
      if (d < rad) h += (60 + 120 * hsh(i, j, 5)) * Math.pow(1 - (d / rad) * (d / rad), 0.5)
    }
  }
  // rivers and lakes carve the land down below the water line
  const rd = riverDist(x, z)
  const half = 55 + 14 * Math.sin(x * 0.004)
  if (rd < half + 130) h = lerp(h, -9, 1 - smooth(half, half + 130, rd))
  for (const lk of LAKES) {
    const d = Math.hypot(x - lk.x, z - lk.z)
    if (d < lk.r + 100) h = lerp(h, -7, 1 - smooth(lk.r, lk.r + 100, d))
  }
  // flat plains at the map edge so the world fades into haze
  h = lerp(h, 42, smooth(0.8, 1.0, r))
  for (let i = 0; i < FLAT.length; i++) {
    const f = FLAT[i]
    const d = Math.hypot(x - f.x, z - f.z)
    if (d < f.r + f.blend) {
      const w = 1 - smooth(f.r, f.r + f.blend, d)
      h = lerp(h, f.h, w)
    }
  }
  for (const rk of ROCKS) {
    const d = Math.hypot(x - rk.x, z - rk.z)
    if (d < rk.r * 2) {
      h = lerp(h, Math.max(h, 70), 1 - smooth(rk.r * 0.8, rk.r * 2, d))
      if (d < rk.r) h += rk.hgt * Math.pow(1 - (d / rk.r) * (d / rk.r), 0.45)
    }
  }
  return h
}

export function desertAt(x, z, h) {
  if (h < 3 || h > 340) return 0
  const north = smooth(-900, -3000, z)
  const south = smooth(1200, 3000, z)
  return clamp(smooth(0.12, 0.32, fbm(nMoist, x * 0.00042 + 9, z * 0.00042, 3)) * (1 - south * 0.8) + north * 0.55, 0, 1)
}

export function forestAt(x, z, h) {
  if (h < 6 || h > 330) return 0
  return clamp(smooth(-0.12, 0.2, fbm(nForest, x * 0.0016, z * 0.0016, 3)) * (1 - desertAt(x, z, h)) + smooth(1500, 3000, z) * 0.35, 0, 1)
}

function scan(step, fn) {
  for (let x = -HALF + step; x < HALF - step; x += step) {
    for (let z = -HALF + step; z < HALF - step; z += step) fn(x, z, heightAt(x, z))
  }
}

// ---- points of interest, found by scanning the generated land ----
const peaks = []
let desertSpot = null
scan(120, (x, z, h) => {
  if (h > 500) peaks.push({ x, z, h })
  if (!desertSpot && desertAt(x, z, h) > 0.9 && Math.hypot(x, z) < 3600 && h < 120) desertSpot = { x, z, h }
})
peaks.sort((a, b) => b.h - a.h)
const farFrom = (list, p, d) => list.every((q) => Math.hypot(q.x - p.x, q.z - p.z) > d)
const chosenPeaks = []
for (const p of peaks) {
  if (farFrom(chosenPeaks, p, 1800)) chosenPeaks.push(p)
  if (chosenPeaks.length >= 3) break
}

function coastPoint(angle) {
  for (let d = 400; d < HALF; d += 40) {
    const x = Math.cos(angle) * d, z = Math.sin(angle) * d
    if (heightAt(x, z) < 0) {
      const dx = Math.cos(angle) * (d - 120), dz = Math.sin(angle) * (d - 120)
      return { x: dx, z: dz, h: Math.max(heightAt(dx, dz), 0) }
    }
  }
  return null
}

export const LANDMARKS = []
const addLm = (name, p, note, id) => { if (p) LANDMARKS.push({ id: id || name.toLowerCase().replace(/\s+/g, '_'), name, note, x: p.x, z: p.z, h: p.h }) }
const at = (x, z) => ({ x, z, h: Math.max(heightAt(x, z), 0) })
addLm('Zuma Rock', { x: ZUMA.x, z: ZUMA.z, h: heightAt(ZUMA.x, ZUMA.z) }, 'The giant granite monolith at the gateway to Abuja', 'crown_peak')
addLm('Aso Rock', { x: ASO.x, z: ASO.z, h: heightAt(ASO.x, ASO.z) }, 'The great rock that rises over the capital', 'twin_needle')
addLm('Jos Plateau', at(3000, -1500), 'Cool high ground and rolling hills', 'frost_saddle')
addLm('Sahel Savanna', desertSpot || at(-800, -2600), 'Hot dry ground and strong rising air', 'mirage_flats')
addLm('Usuma Dam', at(LAKES[0].x, LAKES[0].z), 'The big reservoir north of Abuja', 'gull_rock')
addLm('Gurara Falls', at(-1700, -200), 'A wide waterfall in Niger State', 'salt_bay_light')
addLm('Niger Benue Confluence', at(CONFLUENCE.x, CONFLUENCE.z), 'Where the two great rivers meet near Lokoja', 'sentinel_cape')
addLm('Abuja Central Area', { x: CITY.x + 80, z: CITY.z + 40, h: CITY.h }, 'Towers, boulevards and the heart of the capital', 'meridian_city')
for (const st of SITES) if (st.id !== 'cbd') addLm(st.name, { x: st.x, z: st.z, h: CITY.h }, 'A place in Abuja', 'site_' + st.id)
AIRFIELDS.slice(1).forEach((a) => addLm(a.name, { x: a.x, z: a.z, h: a.h }, 'An airport near Abuja'))

// ---- thermals: rising columns over hot ground ----
export const THERMALS = []
{
  const rnd = makeRng(404)
  let tries = 0
  while (THERMALS.length < 22 && tries++ < 4000) {
    const x = (rnd() - 0.5) * SIZE * 0.8
    const z = (rnd() - 0.5) * SIZE * 0.8
    const h = heightAt(x, z)
    if (h < 3 || h > 520) continue
    const dry = desertAt(x, z, h)
    if (rnd() > 0.25 + dry * 0.9) continue
    if (!farFrom(THERMALS, { x, z }, 700)) continue
    THERMALS.push({ x, z, r: 150 + rnd() * 130, power: 4.5 + rnd() * 4.5 + dry * 3, top: 1100 + rnd() * 900, base: h })
  }
  // one reliable thermal near the home field so new pilots can find lift
  THERMALS.unshift({ x: 520, z: -380, r: 230, power: 7.5, top: 1600, base: heightAt(520, -380) })
}

export function thermalAt(x, z, y) {
  let best = 0
  for (let i = 0; i < THERMALS.length; i++) {
    const t = THERMALS[i]
    const dx = x - t.x, dz = z - t.z
    const d2 = dx * dx + dz * dz
    if (d2 > t.r * t.r) continue
    const k = 1 - Math.sqrt(d2) / t.r
    const alt = 1 - smooth(t.top - 400, t.top, y)
    const v = t.power * (k * k * (3 - 2 * k)) * alt
    if (v > best) best = v
  }
  return best
}

export function createTerrain(segs = 520) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, segs, segs)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const n = pos.count
  const heights = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const h = heightAt(pos.getX(i), pos.getZ(i))
    heights[i] = h
    pos.setY(i, h)
  }
  geo.computeVertexNormals()
  const nor = geo.attributes.normal
  const colors = new Float32Array(n * 3)
  const c = new THREE.Color()
  const sand = new THREE.Color('#d9caa0'), grass = new THREE.Color('#7d9c46'), forest = new THREE.Color('#3b6a3b')
  const alp = new THREE.Color('#7e8f60'), rock = new THREE.Color('#8e7f70'), snow = new THREE.Color('#b9b0a1')
  const desert = new THREE.Color('#c97a42'), desert2 = new THREE.Color('#a85d2e'), urban = new THREE.Color('#738262')
  const shallow = new THREE.Color('#9fd3cf'), deep = new THREE.Color('#0c3553'), field = new THREE.Color('#a7b36a')
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heights[i]
    const slope = 1 - nor.getY(i)
    const vary = nColor(x * 0.01, z * 0.01) * 0.5 + 0.5
    const fine = nColor(x * 0.07 + 5, z * 0.07) * 0.5 + 0.5
    if (h < 0) {
      c.copy(shallow).lerp(deep, smooth(0, -60, h))
    } else {
      const dry = desertAt(x, z, h)
      const fo = forestAt(x, z, h)
      c.copy(sand)
      c.lerp(grass, smooth(3, 14, h))
      c.lerp(field, smooth(0.45, 0.8, vary) * 0.55 * (1 - fo))
      c.lerp(forest, fo * 0.9)
      c.lerp(alp, smooth(240, 420, h))
      c.lerp(desert.clone().lerp(desert2, vary), dry)
      c.lerp(rock, clamp(smooth(380, 620, h) * 0.9 + smooth(0.14, 0.4, slope), 0, 1))
      c.lerp(snow, smooth(650, 760, h + vary * 90) * (1 - smooth(0.35, 0.6, slope) * 0.6))
      const dc = Math.hypot(x - CITY.x, z - CITY.z)
      c.lerp(urban, (1 - smooth(CITY.r * 0.8, CITY.r * 1.25, dc)) * 0.8)
      for (const a of AIRFIELDS) {
        const d = Math.hypot(x - a.x, z - a.z)
        c.lerp(grass, (1 - smooth(a.r * 0.7, a.r, d)) * 0.6)
      }
    }
    const shade = 0.92 + fine * 0.16
    colors[i * 3] = c.r * shade
    colors[i * 3 + 1] = c.g * shade
    colors[i * 3 + 2] = c.b * shade
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 })
  // world space detail so large slopes do not look flat
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float dn = vn(vWP.xz * 0.045) * 0.5 + vn(vWP.xz * 0.21) * 0.32 + vn(vWP.xz * 0.9) * 0.18;
diffuseColor.rgb *= 0.74 + 0.5 * dn;`)
  }
  // height texture lets the water shader find the shoreline
  const side = segs + 1
  const half = new Uint16Array(side * side)
  for (let i = 0; i < heights.length; i++) half[i] = THREE.DataUtils.toHalfFloat(clamp(heights[i], -200, 2000))
  const heightTex = new THREE.DataTexture(half, side, side, THREE.RedFormat, THREE.HalfFloatType)
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter
  heightTex.generateMipmaps = false
  heightTex.needsUpdate = true
  const mesh = new THREE.Mesh(geo, mat)
  mesh.userData.heightTex = heightTex
  mesh.receiveShadow = true
  return mesh
}

// Top down colour image for the minimap
export function renderMapImage(px = 256) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = px
  const g = cv.getContext('2d')
  const img = g.createImageData(px, px)
  for (let j = 0; j < px; j++) {
    for (let i = 0; i < px; i++) {
      const x = (i / px - 0.5) * SIZE
      const z = (j / px - 0.5) * SIZE
      const h = heightAt(x, z)
      const k = (j * px + i) * 4
      let r, g2, b
      if (h < 0) { const d = smooth(0, -60, h); r = lerp(70, 12, d); g2 = lerp(140, 52, d); b = lerp(170, 92, d) }
      else {
        const dry = desertAt(x, z, h)
        const hh = Math.min(h / 800, 1)
        r = lerp(lerp(96, 150, hh), 205, dry); g2 = lerp(lerp(140, 150, hh), 170, dry); b = lerp(lerp(88, 150, hh), 110, dry)
        const sh = (heightAt(x + 60, z + 60) - h) * -0.12
        r += sh; g2 += sh; b += sh
        if (h > 700) { r = 170; g2 = 162; b = 150 }
      }
      img.data[k] = r; img.data[k + 1] = g2; img.data[k + 2] = b; img.data[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return cv
}
