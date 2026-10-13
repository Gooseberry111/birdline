import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeRng, smooth } from './noise'
import { AIRFIELDS, CITY, SIZE, HALF, heightAt, forestAt, desertAt, THERMALS } from './terrain'

// ---------------------------------------------------------------- water
function waterNormalTexture() {
  const n = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = n
  const g = cv.getContext('2d')
  const img = g.createImageData(n, n)
  const h = new Float32Array(n * n)
  const waves = []
  const rnd = makeRng(5)
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2
    const f = 2 + Math.floor(rnd() * 7)
    waves.push([Math.cos(a) * f, Math.sin(a) * f, rnd() * 6.28, 0.4 + rnd() * 0.6])
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 0
      for (const w of waves) v += Math.sin((x / n * w[0] + y / n * w[1]) * Math.PI * 2 + w[2]) * w[3]
      h[y * n + x] = v
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = h[y * n + ((x + 1) % n)] - h[y * n + ((x + n - 1) % n)]
      const dy = h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x]
      const k = (y * n + x) * 4
      img.data[k] = 128 + dx * 22
      img.data[k + 1] = 128 + dy * 22
      img.data[k + 2] = 255
      img.data[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

export function createWater(heightTex) {
  const geo = new THREE.PlaneGeometry(40000, 40000, 1, 1)
  geo.rotateX(-Math.PI / 2)
  const nm = waterNormalTexture()
  nm.repeat.set(40000 / 90, 40000 / 90)
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 0.14, metalness: 0.0, transparent: true,
    normalMap: nm, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.3,
  })
  const wu = { uH: { value: heightTex }, uTime: { value: 0 }, uHalf: { value: HALF } }
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wu)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
uniform sampler2D uH;
uniform float uTime;
uniform float uHalf;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec2 huv = (vWP.xz + uHalf) / (uHalf * 2.0);
float th = (huv.x < 0.0 || huv.x > 1.0 || huv.y < 0.0 || huv.y > 1.0) ? -200.0 : texture2D(uH, huv).r;
float depth = max(-th, 0.0);
vec3 shallowC = vec3(0.17, 0.80, 0.78);
vec3 deepC = vec3(0.012, 0.16, 0.31);
vec3 wc = mix(shallowC, deepC, smoothstep(0.0, 38.0, depth));
float wv = sin(vWP.x * 0.35 + uTime * 1.3) + sin(vWP.z * 0.28 - uTime * 1.1) + sin((vWP.x + vWP.z) * 0.18 + uTime * 0.7);
float foam = smoothstep(5.0, 0.5, depth + wv * 0.9);
wc = mix(wc, vec3(1.0), foam * 0.9);
diffuseColor.rgb = wc * diffuse;
diffuseColor.a = max(mix(0.5, 0.96, smoothstep(0.0, 16.0, depth)), foam);`)
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = -0.05
  mesh.renderOrder = 1
  mesh.userData.update = (cx, cz, t) => {
    wu.uTime.value = t
    const tile = 90
    mesh.position.x = Math.round(cx / tile) * tile
    mesh.position.z = Math.round(cz / tile) * tile
    const ox = (mesh.position.x - 20000) / tile
    const oz = (mesh.position.z - 20000) / tile
    nm.offset.set(ox + t * 0.004, -oz + t * 0.003)
  }
  return mesh
}

// ---------------------------------------------------------------- clouds
function puffTexture(seed) {
  const n = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = n
  const g = cv.getContext('2d')
  const rnd = makeRng(seed)
  g.clearRect(0, 0, n, n)
  for (let i = 0; i < 16; i++) {
    const x = n * (0.25 + rnd() * 0.5), y = n * (0.3 + rnd() * 0.4), r = n * (0.14 + rnd() * 0.18)
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, 'rgba(255,255,255,0.55)')
    gr.addColorStop(0.6, 'rgba(255,255,255,0.22)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
  }
  return new THREE.CanvasTexture(cv)
}

export function createClouds(quality = 'medium') {
  const group = new THREE.Group()
  const mats = [1, 2, 3].map((s) => new THREE.SpriteMaterial({ map: puffTexture(s * 17), transparent: true, depthWrite: false, opacity: 0.9 }))
  const rnd = makeRng(808)
  const clusters = []
  const clusterN = quality === 'high' ? 90 : quality === 'medium' ? 60 : 36
  for (let i = 0; i < clusterN; i++) {
    const cl = new THREE.Group()
    const cx = (rnd() - 0.5) * SIZE * 1.1, cz = (rnd() - 0.5) * SIZE * 1.1
    const base = 1000 + rnd() * 900
    const sz = 350 + rnd() * 550
    const count = (quality === 'low' ? 4 : 6) + Math.floor(rnd() * 5)
    for (let j = 0; j < count; j++) {
      const s = new THREE.Sprite(mats[Math.floor(rnd() * 3)])
      const w = sz * (0.6 + rnd() * 0.9)
      s.scale.set(w, w * (0.5 + rnd() * 0.3), 1)
      s.position.set((rnd() - 0.5) * sz * 1.4, (rnd() - 0.2) * sz * 0.25, (rnd() - 0.5) * sz * 1.1)
      cl.add(s)
    }
    cl.position.set(cx, base, cz)
    cl.userData.order = rnd()
    clusters.push(cl)
    group.add(cl)
  }
  group.userData.mats = mats
  group.userData.clusters = clusters
  return group
}

// ---------------------------------------------------------------- stars
export function createStars() {
  const rnd = makeRng(99)
  const n = 1800
  const p = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u)
    p[i * 3] = Math.cos(a) * r * 9000; p[i * 3 + 1] = Math.abs(u) * 9000 + 200; p[i * 3 + 2] = Math.sin(a) * r * 9000
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
  const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  return pts
}

// ---------------------------------------------------------------- trees
export function createTrees(count = 16000) {
  const rnd = makeRng(2024)
  const cone = (r, h, y, seg = 7) => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, y + h / 2, 0); return g }
  const trunk = new THREE.CylinderGeometry(0.35, 0.5, 4, 5); trunk.translate(0, 2, 0)
  const colorize = (g, hex) => {
    const c = new THREE.Color(hex)
    const a = new Float32Array(g.attributes.position.count * 3)
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3))
    return g
  }
  const conifer = mergeGeometries([
    colorize(trunk.clone(), '#4a3524'),
    colorize(cone(4.6, 9, 3), '#ffffff'),
    colorize(cone(3.4, 8, 8), '#ffffff'),
    colorize(cone(2.2, 7, 13), '#ffffff'),
  ].map((g) => g.index ? g.toNonIndexed() : g))
  const round = mergeGeometries([
    colorize(trunk.clone(), '#4a3524'),
    colorize(new THREE.IcosahedronGeometry(5.2, 0).translate(0, 9, 0), '#ffffff'),
    colorize(new THREE.IcosahedronGeometry(3.6, 0).translate(2.4, 7.6, 1.2), '#ffffff'),
  ].map((g) => g.index ? g.toNonIndexed() : g))
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })

  const CELL = 1250
  const cells = new Map()
  const tmp = new THREE.Object3D()
  const col = new THREE.Color()
  const group = new THREE.Group()
  let placed = 0, tries = 0
  const buckets = new Map()
  while (placed < count && tries++ < count * 14) {
    const x = (rnd() - 0.5) * SIZE * 0.96, z = (rnd() - 0.5) * SIZE * 0.96
    const h = heightAt(x, z)
    const f = forestAt(x, z, h)
    if (f < 0.25 || rnd() > f) continue
    const hx = heightAt(x + 8, z) - h, hz = heightAt(x, z + 8) - h
    if (Math.hypot(hx, hz) > 6) continue
    if (AIRFIELDS.some((a) => Math.hypot(a.x - x, a.z - z) < a.r + 80) || Math.hypot(CITY.x - x, CITY.z - z) < CITY.r + 80) continue
    const key = `${Math.floor((x + HALF) / CELL)}_${Math.floor((z + HALF) / CELL)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push({ x, z, h })
    placed++
  }
  for (const [key, list] of buckets) {
    const high = list.filter((p) => p.h > 140 || rnd() < 0.55)
    const low = list.filter((p) => !high.includes(p))
    const make = (geo, items, palette) => {
      if (!items.length) return null
      const im = new THREE.InstancedMesh(geo, mat, items.length)
      items.forEach((p, i) => {
        const s = 0.9 + rnd() * 1.3
        tmp.position.set(p.x, p.h - 0.4, p.z)
        tmp.rotation.set(0, rnd() * 6.28, 0)
        tmp.scale.set(s, s * (0.9 + rnd() * 0.5), s)
        tmp.updateMatrix()
        im.setMatrixAt(i, tmp.matrix)
        col.set(palette[Math.floor(rnd() * palette.length)])
        im.setColorAt(i, col)
      })
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
      im.castShadow = false
      group.add(im)
      return im
    }
    const a = make(conifer, high, ['#2f5a3a', '#35653f', '#2a5136', '#3b6e42'])
    const b = make(round, low, ['#4c7d3a', '#5b8a3d', '#6a9440', '#3f7040', '#7a9a3c'])
    cells.set(key, [a, b].filter(Boolean))
  }
  group.userData.cells = cells
  group.userData.update = (cx, cz, range) => {
    for (const [key, meshes] of cells) {
      const [ix, iz] = key.split('_').map(Number)
      const mx = ix * CELL - HALF + CELL / 2, mz = iz * CELL - HALF + CELL / 2
      const vis = Math.hypot(mx - cx, mz - cz) < range
      for (const m of meshes) m.visible = vis
    }
  }
  return group
}

// ---------------------------------------------------------------- city
function windowTextures() {
  const n = 128
  const mk = (lit) => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = n
    const g = cv.getContext('2d')
    const rnd = makeRng(lit ? 3 : 3)
    g.fillStyle = lit ? '#000' : '#26313f'
    g.fillRect(0, 0, n, n)
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const on = rnd() > 0.55
        if (lit) g.fillStyle = on ? '#ffdca0' : '#000'
        else g.fillStyle = on ? '#6f8fb0' : '#364458'
        g.fillRect(x * 32 + 6, y * 32 + 8, 20, 16)
      }
    }
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = lit ? THREE.NoColorSpace : THREE.SRGBColorSpace
    return t
  }
  return { map: mk(false), emissive: mk(true) }
}

const MOSQUE = { x: CITY.x - 150, z: CITY.z + 90 }
const TOWER = { x: CITY.x + 110, z: CITY.z - 70 }

// the golden domed National Mosque and a tall slim tower, Abuja's skyline
function createLandmarks() {
  const g = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.7 })
  const gold = new THREE.MeshStandardMaterial({ color: '#e2b04a', roughness: 0.3, metalness: 0.75, emissive: '#6a4a10', emissiveIntensity: 0.25 })
  const base = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 46), white)
  base.position.set(MOSQUE.x, CITY.h + 6, MOSQUE.z)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(19, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), gold)
  dome.position.set(MOSQUE.x, CITY.h + 13, MOSQUE.z)
  g.add(base, dome)
  for (const [dx, dz] of [[-28, -28], [28, -28], [-28, 28], [28, 28]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 52, 10), white)
    m.position.set(MOSQUE.x + dx, CITY.h + 26, MOSQUE.z + dz)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 10), gold)
    tip.position.set(MOSQUE.x + dx, CITY.h + 55, MOSQUE.z + dz)
    g.add(m, tip)
  }
  const tw = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5, 230, 12), new THREE.MeshStandardMaterial({ color: '#cfd8e3', roughness: 0.4, metalness: 0.3 }))
  tw.position.set(TOWER.x, CITY.h + 114, TOWER.z)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 1.6, 8, 28), new THREE.MeshStandardMaterial({ color: '#008751', roughness: 0.5, emissive: '#00402a', emissiveIntensity: 0.4 }))
  ring.rotation.x = Math.PI / 2
  ring.position.set(TOWER.x, CITY.h + 205, TOWER.z)
  g.add(tw, ring)
  return g
}

export function createCity() {
  const rnd = makeRng(606)
  const geos = []
  const tex = windowTextures()
  const col = new THREE.Color()
  const cell = 64
  const R = CITY.r * 0.92
  for (let gx = -R; gx <= R; gx += cell) {
    for (let gz = -R; gz <= R; gz += cell) {
      const d = Math.hypot(gx, gz)
      if (d > R) continue
      // skip some lots and the whole airfield side so streets and parks appear
      if (rnd() < 0.16) continue
      const x = CITY.x + gx + (rnd() - 0.5) * 8, z = CITY.z + gz + (rnd() - 0.5) * 8
      if (AIRFIELDS.some((f) => Math.hypot(f.x - x, f.z - z) < 120)) continue
      if (Math.hypot(x - MOSQUE.x, z - MOSQUE.z) < 90 || Math.hypot(x - TOWER.x, z - TOWER.z) < 55) continue
      const core = 1 - d / R
      const w = 26 + rnd() * 20, dd = 26 + rnd() * 20
      const tower = rnd() < 0.12 + core * 0.35
      const h = 10 + rnd() * 22 + (tower ? Math.pow(core, 1.5) * (60 + rnd() * 160) : core * 18)
      const g = new THREE.BoxGeometry(w, h, dd)
      g.translate(0, h / 2, 0)
      const uv = g.attributes.uv
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 12), uv.getY(k) * (h / 11))
      const warm = rnd() < 0.35
      col.setHSL(warm ? 0.08 : 0.58, warm ? 0.08 : 0.1, 0.62 + rnd() * 0.28)
      const cols = new Float32Array(g.attributes.position.count * 3)
      for (let k = 0; k < cols.length; k += 3) { cols[k] = col.r; cols[k + 1] = col.g; cols[k + 2] = col.b }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
      g.translate(x, CITY.h - 1, z)
      geos.push(g)
    }
  }
  const merged = mergeGeometries(geos)
  const mat = new THREE.MeshStandardMaterial({
    map: tex.map, emissiveMap: tex.emissive, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0,
    vertexColors: true, roughness: 0.6, metalness: 0.15,
  })
  const mesh = new THREE.Mesh(merged, mat)
  mesh.add(createLandmarks())
  mesh.userData.setNight = (k) => { mat.emissiveIntensity = k * 0.9 }
  return mesh
}

// ---------------------------------------------------------------- airfields
function runwayTexture(len) {
  const cv = document.createElement('canvas')
  cv.width = 1024; cv.height = 64
  const g = cv.getContext('2d')
  g.fillStyle = '#34383e'; g.fillRect(0, 0, 1024, 64)
  const rnd = makeRng(12)
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},0.025)`; g.fillRect(rnd() * 1024, rnd() * 64, 3, 2) }
  g.fillStyle = '#e8ecef'
  for (let x = 120; x < 904; x += 64) g.fillRect(x, 30, 36, 4)
  for (let k = 0; k < 6; k++) { g.fillRect(24, 10 + k * 8, 56, 4); g.fillRect(944, 10 + k * 8, 56, 4) }
  g.fillRect(0, 2, 1024, 2); g.fillRect(0, 60, 1024, 2)
  const t = new THREE.CanvasTexture(cv)
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function createAirfields() {
  const group = new THREE.Group()
  const lights = []
  const lightGeo = new THREE.SphereGeometry(0.32, 6, 4)
  const lightMat = new THREE.MeshBasicMaterial({ color: '#ffe9b8', fog: true })
  const tex = runwayTexture()
  for (const a of AIRFIELDS) {
    const len = a.r * 1.8
    const holder = new THREE.Group()
    holder.position.set(a.x, a.h + 0.35, a.z)
    holder.rotation.y = a.dir
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(len, len / 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
    rw.rotation.x = -Math.PI / 2
    rw.receiveShadow = true
    holder.add(rw)
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.38, len * 0.1), new THREE.MeshStandardMaterial({ color: '#5b6068', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }))
    apron.rotation.x = -Math.PI / 2
    apron.position.set(0, 0.02, len * 0.2)
    holder.add(apron)
    const taxi = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.05, len * 0.14), new THREE.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }))
    taxi.rotation.x = -Math.PI / 2
    taxi.position.set(-len * 0.1, 0.02, len * 0.1)
    holder.add(taxi)
    // terminal
    const term = new THREE.Mesh(new THREE.BoxGeometry(len * 0.2, 9, len * 0.05), new THREE.MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.5, metalness: 0.2 }))
    term.position.set(0, 4.5, len * 0.27)
    holder.add(term)
    const glass = new THREE.Mesh(new THREE.BoxGeometry(len * 0.2 + 0.4, 3.4, len * 0.05 + 0.4), new THREE.MeshStandardMaterial({ color: '#16304f', roughness: 0.1, metalness: 0.7, emissive: '#ffdca0', emissiveIntensity: 0 }))
    glass.position.set(0, 5.2, len * 0.27)
    holder.add(glass)
    holder.userData.glass = glass
    // tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 30, 10), new THREE.MeshStandardMaterial({ color: '#e9eef3', roughness: 0.6 }))
    tower.position.set(len * 0.14, 15, len * 0.29)
    holder.add(tower)
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(5, 3.6, 5, 10), new THREE.MeshStandardMaterial({ color: '#10243f', roughness: 0.12, metalness: 0.8, emissive: '#ffdca0', emissiveIntensity: 0 }))
    cab.position.set(len * 0.14, 32, len * 0.29)
    holder.add(cab)
    holder.userData.cab = cab
    // wind sock
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 9, 6), new THREE.MeshStandardMaterial({ color: '#d8dde3' }))
    pole.position.set(-len * 0.12, 4.5, len * 0.12)
    holder.add(pole)
    const sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#ff7a3d', side: THREE.DoubleSide }))
    sock.geometry.translate(0, -2.5, 0); sock.geometry.rotateZ(Math.PI / 2)
    sock.position.set(-len * 0.12, 9, len * 0.12)
    holder.add(sock)
    holder.userData.sock = sock
    // Nigerian flag on a tall pole by the terminal
    const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 20, 6), new THREE.MeshStandardMaterial({ color: '#d8dde3' }))
    fpole.position.set(len * 0.2, 10, len * 0.2)
    holder.add(fpole)
    const flag = new THREE.Group()
    ;['#008751', '#ffffff', '#008751'].forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.6), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.8 }))
      m.position.x = 1.2 + i * 2.4
      flag.add(m)
    })
    flag.position.set(len * 0.2, 17.5, len * 0.2)
    holder.add(flag)
    holder.userData.flag = flag
    // edge lights
    const n = 36
    const im = new THREE.InstancedMesh(lightGeo, lightMat, n * 2)
    const o = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      for (let s = 0; s < 2; s++) {
        o.position.set(-len / 2 + (i / (n - 1)) * len, 0.5, (s ? 1 : -1) * len / 32 - (s ? -0.4 : 0.4))
        o.updateMatrix(); im.setMatrixAt(i * 2 + s, o.matrix)
      }
    }
    holder.add(im)
    lights.push(im)
    // beacon beam
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(5, 22, 1500, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))
    beam.position.set(len * 0.14, 750, len * 0.29)
    holder.add(beam)
    holder.userData.beam = beam
    // flashing approach lights that lead pilots to both runway ends
    const approachLights = []
    const lightTex = glowTexture()
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: lightTex, color: '#fff3d0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })
      approachLights.push(mat)
      for (const end of [-1, 1]) {
        const sp = new THREE.Sprite(mat)
        sp.scale.setScalar(26)
        sp.position.set(end * (len / 2 + 45 + i * 55), 3, 0)
        holder.add(sp)
      }
    }
    holder.userData.approach = approachLights
    // name board that stays readable from far away
    const cv = document.createElement('canvas')
    cv.width = 512; cv.height = 112
    const g2 = cv.getContext('2d')
    g2.fillStyle = 'rgba(8,22,46,0.88)'
    g2.beginPath(); g2.roundRect(4, 4, 504, 104, 18); g2.fill()
    g2.strokeStyle = 'rgba(169,220,255,0.9)'; g2.lineWidth = 4; g2.stroke()
    g2.fillStyle = '#ffffff'; g2.font = '600 46px "Barlow Condensed", Arial Narrow, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'
    g2.fillText(a.name, 256, 42)
    g2.fillStyle = '#a9dcff'; g2.font = '500 28px "Barlow Condensed", Arial Narrow, sans-serif'
    g2.fillText(a.sub || 'Airport', 256, 84)
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, sizeAttenuation: false, opacity: 0 }))
    label.scale.set(0.26, 0.057, 1)
    label.position.set(len * 0.14, 90, len * 0.29)
    label.renderOrder = 10
    holder.add(label)
    holder.userData.label = label
    group.add(holder)
  }
  group.userData.setNight = (k) => {
    lightMat.color.set('#aab3bd').lerp(new THREE.Color('#ffe2a8'), k).multiplyScalar(1 + k * 3)
    for (const h of group.children) {
      h.userData.glass.material.emissiveIntensity = k * 1.2
      h.userData.cab.material.emissiveIntensity = k * 1.6
      h.userData.beam.material.opacity = 0.13 + k * 0.14
    }
  }
  group.userData.update = (t, wind, cam, dir) => {
    for (const h of group.children) {
      h.userData.approach.forEach((m, i) => { m.opacity = 0.25 + 0.75 * Math.max(0, Math.sin(t * 6 - i * 0.55)) })
      if (cam) {
        const dx = h.position.x - cam.x, dz = h.position.z - cam.z
        const d = Math.hypot(dx, dz)
        const dot = dir ? (dx * dir.x + dz * dir.z) / (d * Math.hypot(dir.x, dir.z) + 0.0001) : 1
        h.userData.label.material.opacity = Math.min(0.95, smooth(0.75, 0.92, dot) * (1 - smooth(1900, 3000, d)) * smooth(250, 600, d))
      }
      h.userData.flag.rotation.y = -Math.atan2(wind.z, wind.x) - h.rotation.y
      const s = h.userData.sock
      s.rotation.y = -Math.atan2(wind.z, wind.x) - h.rotation.y
      s.rotation.z = Math.sin(t * 3) * 0.05
    }
  }
  return group
}

// ---------------------------------------------------------------- thermals
export function createThermalVisual() {
  const per = 90
  const total = THERMALS.length * per
  const rnd = makeRng(1717)
  const center = new Float32Array(total * 3)
  const data = new Float32Array(total * 4)
  const pos = new Float32Array(total * 3)
  let k = 0
  THERMALS.forEach((t, ti) => {
    for (let i = 0; i < per; i++) {
      center[k * 3] = t.x; center[k * 3 + 1] = t.base; center[k * 3 + 2] = t.z
      data[k * 4] = Math.sqrt(rnd()) * t.r * 0.9
      data[k * 4 + 1] = rnd() * 6.28
      data[k * 4 + 2] = rnd()
      data[k * 4 + 3] = t.top - t.base
      k++
    }
    void ti
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aCenter', new THREE.BufferAttribute(center, 3))
  geo.setAttribute('aData', new THREE.BufferAttribute(data, 4))
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uBoost: { value: 0 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color('#bfe6ff') } },
    vertexShader: `
      attribute vec3 aCenter; attribute vec4 aData;
      uniform float uTime; uniform float uBoost; uniform vec3 uCam;
      varying float vA;
      void main(){
        float life = fract(aData.z + uTime * 0.045);
        float y = life * min(aData.w, 1400.0);
        float ang = aData.y + uTime * 0.35 + life * 3.0;
        vec3 p = aCenter + vec3(cos(ang) * aData.x, y, sin(ang) * aData.x);
        float dist = distance(p, uCam);
        float near = 1.0 - smoothstep(900.0, 3400.0, dist);
        vA = sin(life * 3.14159) * (0.22 + uBoost * 0.7) * (0.4 + near * 0.6);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (5.0 + uBoost * 4.0) * (900.0 / max(-mv.z, 80.0)) ;
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(uColor, a);
      }`,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  return pts
}

// ---------------------------------------------------------------- rain
export function createRain() {
  const n = 2600
  const aPos = new Float32Array(n * 2 * 3)
  const aEnd = new Float32Array(n * 2)
  const rnd = makeRng(321)
  for (let i = 0; i < n; i++) {
    const x = rnd(), y = rnd(), z = rnd()
    for (let e = 0; e < 2; e++) {
      aPos.set([x, y, z], (i * 2 + e) * 3)
      aEnd[i * 2 + e] = e
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3))
  geo.setAttribute('aPos', new THREE.BufferAttribute(aPos, 3))
  geo.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uBox: { value: new THREE.Vector3(90, 60, 90) } },
    vertexShader: `
      attribute vec3 aPos; attribute float aEnd;
      uniform float uTime; uniform vec3 uCam; uniform vec3 uVel; uniform vec3 uBox;
      varying float vA;
      void main(){
        vec3 p = mod(aPos * uBox - uCam + vec3(0.0, -uTime * 32.0, 0.0), uBox) - uBox * 0.5;
        vec3 rel = vec3(0.0, -32.0, 0.0) - uVel;
        vec3 w = uCam + p + normalize(-rel) * aEnd * 1.6;
        vA = (1.0 - aEnd * 0.7) * (1.0 - length(p) / 60.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: `
      uniform float uAmt; varying float vA;
      void main(){ gl_FragColor = vec4(0.8, 0.88, 0.95, clamp(vA, 0.0, 1.0) * 0.2 * uAmt); }`,
  })
  const lines = new THREE.LineSegments(geo, mat)
  lines.frustumCulled = false
  return lines
}

// ---------------------------------------------------------------- speed streaks
export function createStreaks() {
  const n = 90
  const aPos = new Float32Array(n * 2 * 3)
  const aEnd = new Float32Array(n * 2)
  const rnd = makeRng(777)
  for (let i = 0; i < n; i++) {
    const x = rnd(), y = rnd(), z = rnd()
    for (let e = 0; e < 2; e++) { aPos.set([x, y, z], (i * 2 + e) * 3); aEnd[i * 2 + e] = e }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3))
  geo.setAttribute('aPos', new THREE.BufferAttribute(aPos, 3))
  geo.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uBox: { value: new THREE.Vector3(70, 50, 70) } },
    vertexShader: `
      attribute vec3 aPos; attribute float aEnd;
      uniform vec3 uCam; uniform vec3 uVel; uniform vec3 uBox;
      varying float vA;
      void main(){
        vec3 p = mod(aPos * uBox - uCam, uBox) - uBox * 0.5;
        vec3 w = uCam + p - uVel * 0.045 * aEnd;
        vA = (1.0 - aEnd) * smoothstep(8.0, 22.0, length(p));
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: `
      uniform float uAmt; varying float vA;
      void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, vA * uAmt * 0.5); }`,
  })
  const lines = new THREE.LineSegments(geo, mat)
  lines.frustumCulled = false
  return lines
}

// a soft glow sprite texture used for trails, orbs and rings
export function glowTexture() {
  const n = 64
  const cv = document.createElement('canvas')
  cv.width = cv.height = n
  const g = cv.getContext('2d')
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, n, n)
  return new THREE.CanvasTexture(cv)
}

export { smooth, desertAt }
