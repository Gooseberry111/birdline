import * as THREE from 'three'
import { PLUMAGE, ACCESSORIES } from '../data/cosmetics'
import { makeRng, smooth, clamp, lerp } from './noise'

const C = (h) => new THREE.Color(h)
// keep pale plumage from clipping to pure white under strong sun
const soft = (c) => {
  const col = new THREE.Color(c)
  const hsl = {}
  col.getHSL(hsl)
  if (hsl.l > 0.74) col.setHSL(hsl.h, hsl.s, 0.74)
  return col
}
const mix = (a, b, t) => C(a).lerp(C(b), t)
const hex = (c) => `#${c.getHexString()}`

// ---------------------------------------------------------------- wing outline per silhouette
function outline(shape, u, c0) {
  let chord, sweep
  switch (shape) {
    case 'broad':
      chord = c0 * (1 - 0.3 * u) * (1 - smooth(0.86, 1, u) * 0.55); sweep = 0.12 * c0 * u; break
    case 'long':
      chord = c0 * (1 - 0.5 * u) * (1 - smooth(0.9, 1, u) * 0.5); sweep = 0.22 * c0 * u; break
    case 'pointed':
      chord = c0 * (1 - 0.74 * u); sweep = 0.95 * c0 * Math.pow(u, 1.15); break
    case 'scythe':
      chord = c0 * (1 - 0.68 * u); sweep = 1.25 * c0 * Math.pow(u, 1.6); break
    case 'albatross':
      chord = c0 * (1 - 0.5 * u) * (1 - smooth(0.92, 1, u) * 0.5); sweep = 0.35 * c0 * u; break
    case 'condor':
      chord = c0 * (1 - 0.18 * u) * (1 - smooth(0.88, 1, u) * 0.5); sweep = 0.1 * c0 * u; break
    case 'hum':
      chord = c0 * (1 - 0.62 * u); sweep = 0.55 * c0 * Math.pow(u, 1.2); break
    default: // short, rounded
      chord = c0 * (1 - 0.34 * u) * (1 - smooth(0.8, 1, u) * 0.7); sweep = 0.1 * c0 * u
  }
  const lead = 0.38 * c0 - sweep
  return { lead, trail: lead - chord }
}

// ---------------------------------------------------------------- canvas textures
function patternMarks(g, kind, W, H, a = 0.22, dark = '0,0,0') {
  const rnd = makeRng(41)
  g.save()
  g.fillStyle = `rgba(${dark},${a})`
  g.strokeStyle = `rgba(${dark},${a})`
  if (kind === 'barred') {
    for (let x = 0; x < W; x += 34) g.fillRect(x, 0, 12, H)
  } else if (kind === 'spotted') {
    for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(rnd() * W, rnd() * H, 3 + rnd() * 5, 0, 7); g.fill() }
  } else if (kind === 'streaked') {
    g.lineWidth = 3
    for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26 + rnd() * 40, y + (rnd() - 0.5) * 6); g.stroke() }
  } else if (kind === 'scaled') {
    g.lineWidth = 2
    for (let y = 0; y < H + 16; y += 14) for (let x = (y / 14) % 2 ? 0 : 9; x < W; x += 18) { g.beginPath(); g.arc(x, y, 9, 0.1, Math.PI - 0.1); g.stroke() }
  }
  g.restore()
}

function drawBadge(g, id, x, y, r) {
  if (!id || id === 'none') return
  g.save()
  g.translate(x, y)
  g.strokeStyle = 'rgba(235,242,250,0.9)'
  g.fillStyle = 'rgba(235,242,250,0.9)'
  g.lineWidth = 3
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke()
  if (id === 'wings') { g.beginPath(); g.moveTo(-r * 0.7, 3); g.quadraticCurveTo(0, -r * 0.9, r * 0.7, 3); g.quadraticCurveTo(0, -r * 0.2, -r * 0.7, 3); g.fill() }
  if (id === 'compass') { g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(r * 0.25, 0); g.lineTo(0, r * 0.8); g.lineTo(-r * 0.25, 0); g.closePath(); g.fill() }
  if (id === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.35 : r * 0.8; const a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) } g.closePath(); g.fill() }
  if (id === 'crown') { g.beginPath(); g.moveTo(-r * 0.7, r * 0.4); g.lineTo(-r * 0.7, -r * 0.3); g.lineTo(-r * 0.3, 0); g.lineTo(0, -r * 0.6); g.lineTo(r * 0.3, 0); g.lineTo(r * 0.7, -r * 0.3); g.lineTo(r * 0.7, r * 0.4); g.closePath(); g.fill() }
  if (id === 'laurel') { for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(i * r * 0.22, Math.abs(i) * 3 - 2, 4, 9, i * 0.35, 0, 7); g.fill() } }
  g.restore()
}

function wingTexture(look, cols, pattern, opts) {
  const W = 512, H = 256
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  const rnd = makeRng(7)
  const wing = cols.wing, tip = cols.tip
  const grd = g.createLinearGradient(0, 0, W, 0)
  grd.addColorStop(0, hex(wing)); grd.addColorStop(0.55, hex(wing)); grd.addColorStop(0.95, hex(mix(hex(wing), hex(tip), 0.85)))
  g.fillStyle = grd; g.fillRect(0, 0, W, H)
  // coverts on the leading edge, lighter and softer
  const cov = g.createLinearGradient(0, 0, 0, H * 0.46)
  cov.addColorStop(0, hex(mix(hex(cols.body), hex(wing), 0.35)))
  cov.addColorStop(1, hex(mix(hex(cols.body), hex(wing), 0.8)) + '00')
  g.fillStyle = cov; g.fillRect(0, 0, W * 0.88, H * 0.46)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * W * 0.85, y = rnd() * H * 0.4
    g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.05})`
    g.beginPath(); g.ellipse(x, y, 14, 5, 0, 0, 7); g.fill()
  }
  if (look.tipBlack) {
    const tb = g.createLinearGradient(0, H * 0.45, 0, H)
    tb.addColorStop(0, hex(tip) + '00'); tb.addColorStop(0.5, hex(tip) + 'ff'); tb.addColorStop(1, hex(tip) + 'ff')
    g.fillStyle = tb; g.fillRect(W * 0.06, H * 0.45, W * 0.94, H * 0.55)
  }
  if (look.wingPatch) {
    g.fillStyle = look.wingPatch + 'e0'
    g.beginPath(); g.moveTo(W * 0.3, H * 0.5); g.lineTo(W * 0.72, H * 0.58); g.lineTo(W * 0.7, H * 0.95); g.lineTo(W * 0.3, H * 0.95); g.closePath(); g.fill()
  }
  if (look.barred || pattern === 'barred') patternMarks(g, 'barred', W, H, 0.2, '20,12,6')
  else if (pattern && pattern !== 'none') patternMarks(g, pattern, W, H, 0.2, '20,12,6')
  // feather rachis lines
  g.lineWidth = 1.5
  for (let i = 0; i < 26; i++) {
    const x1 = W * (0.1 + i / 26 * 0.9)
    g.strokeStyle = 'rgba(0,0,0,0.18)'
    g.beginPath(); g.moveTo(x1 - 14, H * (0.28 + rnd() * 0.1)); g.lineTo(x1 + 8, H); g.stroke()
  }
  g.strokeStyle = 'rgba(255,255,255,0.08)'
  for (let i = 0; i < 18; i++) { const y = H * (0.5 + i * 0.028); g.beginPath(); g.moveTo(W * 0.05, y); g.lineTo(W, y + 4); g.stroke() }
  if (opts.elite) { g.fillStyle = '#f0cf8a'; g.fillRect(0, H - 6, W, 6) }
  // aircraft identity marking on the inner wing
  if (opts.text) {
    g.save()
    g.font = '600 26px "Barlow Condensed", Arial Narrow, sans-serif'
    g.fillStyle = 'rgba(244,248,252,0.78)'
    g.textBaseline = 'middle'
    g.fillText(opts.text.toUpperCase(), W * 0.17, H * 0.62)
    g.restore()
  }
  if (opts.badge) drawBadge(g, opts.badge, W * 0.1, H * 0.3, 15)
  // slotted primaries: cut gaps along the trailing edge near the tip
  const fingers = look.shape === 'hum' ? 0 : look.shape === 'scythe' || look.shape === 'pointed' ? 3 : look.shape === 'short' ? 4 : 6
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = '#000'
  for (let i = 0; i < fingers; i++) {
    const x = W * (0.66 + (i / Math.max(fingers, 1)) * 0.3)
    g.beginPath(); g.moveTo(x - 4, H + 1); g.lineTo(x + 4, H + 1); g.lineTo(x + 1, H * (0.78 - i * 0.02)); g.closePath(); g.fill()
  }
  g.globalCompositeOperation = 'source-over'
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function tailTexture(look, cols, pattern) {
  const W = 128, H = 256
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  g.fillStyle = hex(cols.tail); g.fillRect(0, 0, W, H)
  if (look.hawkBand) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, H * 0.8, W, H * 0.12) }
  if (look.barred || pattern === 'barred') {
    g.save(); g.fillStyle = 'rgba(20,12,6,0.25)'
    for (let y = 20; y < H; y += 40) g.fillRect(0, y, W, 12)
    g.restore()
  } else if (pattern && pattern !== 'none') patternMarks(g, pattern, W, H, 0.2, '20,12,6')
  g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1.5
  const n = 9
  for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(W / 2, 0); g.lineTo((i / n) * W, H); g.stroke() }
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = '#000'
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W
    g.beginPath(); g.moveTo(x - 3, H + 1); g.lineTo(x + 3, H + 1); g.lineTo(x, H - 18); g.closePath(); g.fill()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function bodyTexture(pattern, look) {
  const kind = pattern && pattern !== 'none' ? pattern : look.barred ? 'barred' : null
  if (!kind) return null
  const W = 256, H = 256
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H)
  // marks sit in the lower half of the texture to read on the breast and flank
  if (kind === 'barred') {
    g.fillStyle = 'rgba(70,45,25,0.55)'
    for (let y = 20; y < H; y += 26) g.fillRect(0, y, W, 8)
  } else patternMarks(g, kind, W, H, 0.5, '60,40,25')
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// ---------------------------------------------------------------- build
export function createBird(bird, loadout = {}, opts = {}) {
  const look = bird.look
  const plume = PLUMAGE.find((p) => p.id === loadout.plumage) || PLUMAGE[0]
  const acc = loadout.accessory || 'none'
  const elite = !!opts.elite
  const T = plume.tint
  const tint = (h, k) => (T ? hex(mix(h, T, k)) : h)
  const cols = {
    body: soft(tint(look.body, 0.55)), belly: soft(tint(look.belly, 0.22)), wing: soft(tint(look.wing, 0.55)),
    tip: soft(tint(look.tip, 0.35)), head: soft(tint(look.head, 0.12)), tail: soft(tint(look.tail, 0.5)),
  }
  const irid = !!(plume.iridescent || look.iridescent)

  const root = new THREE.Group()
  const rig = new THREE.Group()
  root.add(rig)
  const disposables = []
  const track = (o) => { disposables.push(o); return o }

  const headParts = []
  const L = look.bodyLen
  const R = 0.175 * L
  const stdMat = (color, extra = {}) => track(new THREE.MeshStandardMaterial({ color: soft(color), roughness: 0.72, metalness: 0, ...extra }))
  const bodyMat = track(irid
    ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600], sheen: 0.6, sheenColor: C('#9fd0ff'), map: bodyTexture(loadout.pattern, look) })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, map: bodyTexture(loadout.pattern, look) }))

  // body
  const pts = []
  const n = 22
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const r = R * Math.pow(Math.max(Math.sin(Math.PI * Math.pow(t, 0.7)), 0), 0.8)
    pts.push(new THREE.Vector2(Math.max(r, 0.002), t * L - L * 0.45))
  }
  const bg = new THREE.LatheGeometry(pts, 20)
  bg.rotateX(Math.PI / 2)
  bg.scale(1, 0.92, 1)
  bg.computeVertexNormals()
  {
    const p = bg.attributes.position, nr = bg.attributes.normal
    const colors = new Float32Array(p.count * 3)
    const tmp = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const ny = nr.getY(i)
      const tt = (p.getZ(i) + L * 0.45) / L
      tmp.copy(cols.body).lerp(cols.belly, smooth(0.15, -0.4, ny))
      if (look.throat && tt > 0.55 && ny < 0.05) tmp.copy(C(look.throat)).lerp(cols.belly, 0.1)
      if (tt > 0.86) tmp.lerp(cols.head, smooth(0.86, 1, tt) * (look.neck > 0.6 ? 1 : 0.7))
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b
    }
    bg.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }
  track(bg)
  const body = new THREE.Mesh(bg, bodyMat)
  body.castShadow = true
  rig.add(body)

  // neck and head
  const neckLen = (look.neck ?? 0.35) * L * 0.34
  const headR = Math.max(0.11 * L * (look.neck > 0.8 ? 0.62 : 1), 0.04)
  const neckR = Math.max(headR * 0.7, R * 0.28)
  const frontZ = L * 0.55
  const neckMat = stdMat(cols.head)
  if (neckLen > 0.02) {
    const ng = track(new THREE.CylinderGeometry(neckR * 0.85, neckR * (look.neck > 0.6 ? 1.15 : 1.6), neckLen + R * 0.4, 12))
    ng.rotateX(Math.PI / 2)
    const neck = new THREE.Mesh(ng, neckMat)
    neck.position.set(0, R * 0.12, frontZ - R * 0.2 + neckLen / 2)
    rig.add(neck)
    headParts.push(neck)
  }
  const headGroup = new THREE.Group()
  headGroup.position.set(0, R * 0.14 + (look.neck > 0.6 ? 0 : headR * 0.15), frontZ + neckLen + headR * 0.3)
  rig.add(headGroup)
  headParts.push(headGroup)
  const hg = track(new THREE.SphereGeometry(headR, 20, 14))
  hg.scale(0.92, 0.95, 1.2)
  const head = new THREE.Mesh(hg, stdMat(cols.head))
  head.castShadow = true
  headGroup.add(head)

  // beak
  const beakCol = look.beak
  const bl = look.beakLen
  const beakMat = stdMat(beakCol, { roughness: 0.45 })
  const bw = look.shape === 'hum' ? headR * 0.12 : look.beakLen > 0.45 ? headR * 0.5 : headR * 0.38
  const bgm = track(new THREE.ConeGeometry(bw, bl, 12))
  bgm.rotateX(Math.PI / 2)
  bgm.translate(0, 0, bl / 2)
  if (look.pouch) bgm.scale(1.15, 0.55, 1)
  const beak = new THREE.Mesh(bgm, beakMat)
  beak.position.set(0, -headR * 0.12, headR * 1.0)
  headGroup.add(beak)
  if (look.hooked) {
    const hk = new THREE.Mesh(track(new THREE.ConeGeometry(bw * 0.5, bl * 0.4, 8)), beakMat)
    hk.rotation.x = Math.PI * 0.85
    hk.position.set(0, -headR * 0.12 - bl * 0.12, headR * 1.0 + bl * 0.88)
    headGroup.add(hk)
  }
  if (look.pouch) {
    const pg = track(new THREE.SphereGeometry(bw * 1.05, 14, 10))
    pg.scale(1, 0.7, bl / (bw * 2.2))
    const pouch = new THREE.Mesh(pg, stdMat(look.pouch, { roughness: 0.6 }))
    pouch.position.set(0, -headR * 0.45, headR * 1.0 + bl * 0.4)
    headGroup.add(pouch)
  }
  if (look.knob) {
    const kn = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.22, 10, 8)), stdMat(look.knob))
    kn.scale.set(0.8, 1, 1.2)
    kn.position.set(0, headR * 0.15, headR * 1.05)
    headGroup.add(kn)
  }
  if (look.cheek) {
    for (const s of [-1, 1]) {
      const ck = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.55, 12, 8)), stdMat(look.cheek))
      ck.scale.set(0.35, 0.7, 1)
      ck.position.set(s * headR * 0.78, -headR * 0.22, headR * 0.1)
      headGroup.add(ck)
    }
  }
  if (look.cap) {
    const cp = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.62, 12, 8)), stdMat(look.cap))
    cp.scale.set(1, 0.34, 1.3)
    cp.position.set(0, headR * 0.82, headR * 0.1)
    headGroup.add(cp)
  }
  if (look.nape) {
    const np = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.9, 12, 8)), stdMat(look.nape))
    np.scale.set(0.95, 0.8, 0.8)
    np.position.set(0, headR * 0.1, -headR * 0.55)
    headGroup.add(np)
  }
  if (look.moustache || look.eyeStripe) {
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(track(new THREE.BoxGeometry(headR * 0.12, headR * (look.eyeStripe ? 0.34 : 0.9), headR * (look.eyeStripe ? 1.5 : 0.5))), stdMat(look.eyeStripe || '#1a1d22'))
      m.position.set(s * headR * 0.84, look.eyeStripe ? headR * 0.15 : -headR * 0.45, look.eyeStripe ? -headR * 0.2 : headR * 0.3)
      headGroup.add(m)
    }
  }
  const iris = look.iris || (look.hooked || look.moustache || look.barred || look.eyeStripe ? '#ebb83a' : '#15171a')
  for (const s of [-1, 1]) {
    const eyeR = Math.max(headR * 0.24, 0.012)
    const e = new THREE.Mesh(track(new THREE.SphereGeometry(eyeR, 10, 8)), stdMat(iris, { roughness: 0.2 }))
    e.position.set(s * headR * 0.78, headR * 0.18, headR * 0.52)
    headGroup.add(e)
    const p = new THREE.Mesh(track(new THREE.SphereGeometry(eyeR * 0.55, 8, 6)), stdMat('#050506', { roughness: 0.1 }))
    p.position.set(s * headR * 0.84, headR * 0.18, headR * 0.56)
    headGroup.add(p)
    if (look.hooked) {
      const brow = new THREE.Mesh(track(new THREE.BoxGeometry(headR * 0.2, headR * 0.1, headR * 0.7)), stdMat(mix(hex(cols.head), '#000000', 0.35)))
      brow.position.set(s * headR * 0.72, headR * 0.46, headR * 0.5)
      brow.rotation.z = -s * 0.35
      headGroup.add(brow)
    }
  }
  if (look.ruff) {
    const rf = new THREE.Mesh(track(new THREE.TorusGeometry(neckR * 1.5, neckR * 0.55, 8, 14)), stdMat(look.ruff, { roughness: 0.95 }))
    rf.position.set(0, R * 0.1, frontZ - R * 0.1)
    rf.scale.set(1, 1, 1.4)
    rig.add(rf)
    headParts.push(rf)
  }
  if (look.crest) {
    const cr = new THREE.Mesh(track(new THREE.ConeGeometry(headR * 0.3, headR * 1.2, 6)), stdMat(look.crest))
    cr.rotation.x = -0.9
    cr.position.set(0, headR * 0.9, -headR * 0.5)
    headGroup.add(cr)
  }

  // tail
  const tailPivot = new THREE.Group()
  tailPivot.position.set(0, 0, -L * 0.36)
  rig.add(tailPivot)
  const tl = look.tailLen * (look.shape === 'hum' ? 1 : 1)
  const tailGeo = track(new THREE.PlaneGeometry(1, 1, 8, 4))
  const tailPos = tailGeo.attributes.position
  const tailBase = new Float32Array(tailPos.array)
  const tailMat = track(new THREE.MeshStandardMaterial({ map: tailTexture(look, cols, loadout.pattern), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.8 }))
  const tail = new THREE.Mesh(tailGeo, tailMat)
  tail.castShadow = true
  tailPivot.add(tail)
  const fork = look.tailFork || 0
  function shapeTail(spread) {
    const w0 = R * 0.55
    const w1 = (R * 0.9 + tl * look.tailFan * 0.62) * (0.8 + spread * 0.5)
    for (let i = 0; i < tailPos.count; i++) {
      const u = tailBase[i * 3] + 0.5 // 0..1 across
      const v = 0.5 - tailBase[i * 3 + 1] // 0 root .. 1 tip
      const hw = lerp(w0, w1, v)
      const x = (u - 0.5) * 2 * hw
      const zEnd = -tl * v * (1 + fork * Math.abs(u - 0.5) * 2 * v * 0.6)
      tailPos.setXYZ(i, x, 0, zEnd)
    }
    tailPos.needsUpdate = true
  }
  shapeTail(0)

  // wings
  const halfSpan = look.span / 2
  const NU = 20, NV = 6
  const wingGroups = []
  const wingMeshes = []
  const wingMats = []
  const camber = look.shape === 'hum' ? 0.02 : 0.07
  for (const side of [1, -1]) {
    const geo = track(new THREE.BufferGeometry())
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3)
    const uv = new Float32Array((NU + 1) * (NV + 1) * 2)
    const idx = []
    for (let i = 0; i <= NU; i++) {
      for (let j = 0; j <= NV; j++) {
        const k = i * (NV + 1) + j
        uv[k * 2] = i / NU
        uv[k * 2 + 1] = 1 - j / NV
        if (i < NU && j < NV) {
          const a = k, b = k + 1, c = k + NV + 1, d = k + NV + 2
          idx.push(a, b, c, b, d, c)
        }
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(idx)
    const text = side === -1 ? aircraftMark(bird) : null
    const mat = track(new THREE.MeshStandardMaterial({
      map: wingTexture(look, cols, loadout.pattern, { elite, text, badge: side === 1 ? loadout.badge : null }),
      side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.82,
    }))
    wingMats.push(mat)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.castShadow = true
    const grp = new THREE.Group()
    grp.position.set(0, R * 0.22, L * 0.1)
    grp.scale.x = -side // geometry is built on +X, so the right wing (-X) mirrors
    grp.add(mesh)
    rig.add(grp)
    wingGroups.push(grp)
    wingMeshes.push({ mesh, geo, pos, side })
  }

  function updateWing(w, phase, amp, fold, furl, glideBend, hover) {
    const { pos, geo } = w
    const spanScale = 1 - 0.55 * fold - 0.5 * furl
    let X = 0, Y = 0
    const dx = (halfSpan / NU) * spanScale
    const rowsX = new Float32Array(NU + 1), rowsY = new Float32Array(NU + 1), rowsA = new Float32Array(NU + 1)
    for (let i = 0; i <= NU; i++) {
      const u = i / NU
      let a
      if (hover > 0.5) {
        // wing sweeps in a shallow arc for hovering birds
        a = Math.sin(phase) * amp * 0.25 * (0.5 + u)
      } else {
        a = amp * (Math.sin(phase - u * 0.95) * (0.45 + 0.9 * u)) + 0.1 + glideBend * (1 - u * 1.4) * 0.5 - (look.shape === 'albatross' ? u * u * 0.22 : 0)
        a = a * (1 - furl) - 1.15 * furl * (0.4 + u * 0.6)
      }
      if (i > 0) { X += Math.cos(a) * dx; Y += Math.sin(a) * dx }
      rowsX[i] = X; rowsY[i] = Y; rowsA[i] = a
    }
    for (let i = 0; i <= NU; i++) {
      const u = i / NU
      const { lead, trail } = outline(look.shape, u, look.chord)
      const sweepBack = (fold * 0.9 + furl * 0.4) * look.chord * Math.pow(u, 1.4)
      const hoverSweep = hover > 0.5 ? Math.sin(phase + 1.6) * look.chord * 0.7 * u : 0
      const sn = Math.sin(rowsA[i]), cs = Math.cos(rowsA[i])
      for (let j = 0; j <= NV; j++) {
        const t = j / NV
        const z = lerp(lead, trail, t) - sweepBack + hoverSweep
        const bulge = camber * (lead - trail) * Math.sin(t * Math.PI) * (1 - u * 0.5) * (1 - furl)
        const k = (i * (NV + 1) + j) * 3
        pos[k] = rowsX[i] - sn * bulge
        pos[k + 1] = rowsY[i] + cs * bulge
        pos[k + 2] = z
      }
    }
    geo.attributes.position.needsUpdate = true
    geo.computeVertexNormals()
  }

  // legs
  const legCol = look.legs || (look.shape === 'hum' ? '#2a2a2a' : look.beak === '#e0b845' ? '#e0b845' : '#c9a64a')
  const legMat = stdMat(legCol, { roughness: 0.6 })
  const legLen = Math.max(L * (look.trailLegs ? 0.8 : 0.34), 0.08)
  const legR = Math.max(R * 0.07, 0.008)
  const legs = []
  for (const s of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(s * R * 0.45, -R * 0.65, -L * 0.1)
    const lg = track(new THREE.CylinderGeometry(legR, legR * 0.8, legLen, 6))
    lg.translate(0, -legLen / 2, 0)
    const leg = new THREE.Mesh(lg, legMat)
    hip.add(leg)
    const foot = new THREE.Mesh(track(new THREE.BoxGeometry(legR * 5, legR * 1.4, legR * 9)), legMat)
    foot.position.set(0, -legLen, legR * 3)
    hip.add(foot)
    if (acc === 'band' || acc === 'both') {
      const band = new THREE.Mesh(track(new THREE.CylinderGeometry(legR * 1.7, legR * 1.7, legR * 3, 8)), stdMat(ACCESSORIES.find((a) => a.id === 'band').color, { metalness: 0.7, roughness: 0.3 }))
      band.position.y = -legLen * 0.55
      hip.add(band)
    }
    rig.add(hip)
    legs.push(hip)
  }

  // accessories
  let scarf = null, scarfBase = null
  if (acc === 'harness' || acc === 'both') {
    const hm = stdMat('#142a4d', { roughness: 0.55 })
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(R * 1.015, R * 0.045, 6, 24)), hm)
    ring.position.z = L * 0.06
    ring.scale.set(1, 0.92, 1)
    rig.add(ring)
    const ring2 = ring.clone()
    ring2.position.z = -L * 0.08
    rig.add(ring2)
    const buckle = new THREE.Mesh(track(new THREE.BoxGeometry(R * 0.28, R * 0.1, R * 0.22)), stdMat('#d6dde6', { metalness: 0.9, roughness: 0.25 }))
    buckle.position.set(0, R * 0.95, L * 0.06)
    rig.add(buckle)
    const link = new THREE.Mesh(track(new THREE.BoxGeometry(R * 0.12, R * 0.06, L * 0.16)), hm)
    link.position.set(0, R * 0.92, -L * 0.01)
    rig.add(link)
  }
  if (acc === 'scarf' || acc === 'scarfred') {
    const sg = track(new THREE.PlaneGeometry(headR * 1.0, L * 0.9, 2, 14))
    sg.rotateX(-Math.PI / 2)
    sg.translate(0, 0, -L * 0.45)
    scarfBase = new Float32Array(sg.attributes.position.array)
    scarf = new THREE.Mesh(sg, stdMat(ACCESSORIES.find((a) => a.id === acc).color, { side: THREE.DoubleSide, roughness: 0.5 }))
    scarf.position.set(0, R * 0.2, frontZ - R * 0.1)
    rig.add(scarf)
    headParts.push(scarf)
    const knot = new THREE.Mesh(track(new THREE.TorusGeometry(neckR * 1.25, neckR * 0.34, 8, 14)), stdMat(ACCESSORIES.find((a) => a.id === acc).color, { roughness: 0.5 }))
    knot.position.set(0, R * 0.12, frontZ - R * 0.1)
    rig.add(knot)
  }

  const groundOffset = legLen + R * 0.7
  const state = { phase: Math.random() * 6, fold: 0, furl: 0, spread: 0, bank: 0, head: 0 }
  const tipA = new THREE.Vector3()

  function update(dt, s) {
    // s: flap 0..1, speed 0..1, fold 0..1, pitch, bank, turn, ground 0..1, hover 0..1, dive 0..1, time
    const flap = s.flap ?? 0
    const hover = s.hover ?? 0
    const ground = s.ground ?? 0
    const freq = look.flap * (0.28 + 0.72 * flap) * (hover > 0.5 ? 1.1 : 1)
    state.phase += dt * freq * Math.PI * 2
    if (state.phase > 1e5) state.phase = 0
    const tgtFold = clamp((s.fold ?? 0), 0, 1)
    state.fold = lerp(state.fold, tgtFold, 1 - Math.exp(-dt * 6))
    state.furl = lerp(state.furl, ground > 0.5 && flap < 0.2 ? 1 : 0, 1 - Math.exp(-dt * 5))
    const amp = (hover > 0.5 ? 0.9 : lerp(0.05, look.shape === 'hum' ? 0.8 : 0.62, flap))
    const slow = flap < 0.15 && hover < 0.5
    const glideBend = slow ? 1 : 0.4
    const wob = slow ? Math.sin(s.time * 1.7) * 0.015 : 0
    for (const w of wingMeshes) updateWing(w, state.phase + wob + (w.side === -1 ? 0 : 0), amp, state.fold, state.furl, glideBend, hover)
    // tail follows control inputs
    state.spread = lerp(state.spread, s.brake ?? 0, 1 - Math.exp(-dt * 5))
    shapeTail(state.spread + (s.turn ? Math.abs(s.turn) * 0.2 : 0))
    tailPivot.rotation.x = -(s.pitchIn ?? 0) * 0.3 + (state.spread * 0.2)
    tailPivot.rotation.y = -(s.turn ?? 0) * 0.28
    tailPivot.rotation.z = (s.bank ?? 0) * 0.1
    // body bob with the wingbeat
    rig.position.y = Math.sin(state.phase) * (0.012 + flap * 0.03) * look.span * 0.3 * (hover > 0.5 ? 0.5 : 1)
    rig.position.y += lerp(0, groundOffset, ground)
    rig.rotation.x = hover > 0.5 ? -0.5 : 0
    headGroup.rotation.y = lerp(headGroup.rotation.y, -(s.turn ?? 0) * 0.45, 1 - Math.exp(-dt * 4))
    headGroup.rotation.x = lerp(headGroup.rotation.x, -(s.pitchIn ?? 0) * 0.2 - (ground ? 0 : 0), 1 - Math.exp(-dt * 4))
    // legs tuck while flying, extend on the ground
    const down = ground
    for (const l of legs) l.rotation.x = lerp(lerp(-1.45, -1.58, look.trailLegs ? 1 : 0), 0, down)
    if (scarf) {
      const p = scarf.geometry.attributes.position
      const sp = (s.speed ?? 0)
      for (let i = 0; i < p.count; i++) {
        const z = scarfBase[i * 3 + 2] + L * 0.45
        const k = Math.abs(z) / (L * 0.9)
        p.setXYZ(i, scarfBase[i * 3] + Math.sin(s.time * 8 + z * 9) * k * 0.06 * (0.4 + sp), Math.sin(s.time * 6 + z * 7) * k * 0.05 * (0.4 + sp) - k * 0.02, scarfBase[i * 3 + 2] - sp * k * 0.0)
      }
      p.needsUpdate = true
    }
  }

  function tipWorld(side, out = tipA) {
    const w = wingMeshes[side]
    const p = w.pos
    const k = NU * (NV + 1) * 3 + Math.floor(NV / 2) * 3
    out.set(p[k], p[k + 1], p[k + 2])
    w.mesh.localToWorld(out)
    return out
  }

  function dispose() {
    for (const d of disposables) {
      if (d.map) d.map.dispose()
      d.dispose?.()
    }
  }

  root.userData.bird = bird
  root.traverse((o) => { if (o.isMesh) o.castShadow = true })
  updateWingsInit()
  function updateWingsInit() { update(0, { flap: 0, time: 0 }) }

  function setFirstPerson(on) { for (const h of headParts) h.visible = !on }
  const headTmp = new THREE.Vector3()
  function headWorld(out = headTmp) { return headGroup.getWorldPosition(out) }

  return { root, update, tipWorld, dispose, setFirstPerson, headWorld, groundOffset, headR, span: look.span, length: L + neckLen + bl }
}

function aircraftMark(bird) {
  return `${bird.aircraft}`
}
