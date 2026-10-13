import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CITY, SITES, siteById } from './terrain'
import { makeRng, clamp, lerp, smooth } from './noise'

// A compressed model of central Abuja: boulevards, the Three Arms Zone, the CBD towers,
// the National Mosque and Christian Centre, the stadium, residential districts and traffic.
const C = CITY
const Y = CITY.h
const R = (x, z) => [C.x + x, C.z + z]

const ROADS = [
  { name: 'Shehu Shagari Way', w: 34, median: true, pts: [R(-100, -1080), R(-100, 1050)] },
  { name: 'Ahmadu Bello Way', w: 34, median: true, pts: [R(-1100, -450), R(1100, -450)] },
  { name: 'Independence Avenue', w: 30, median: true, pts: [R(-1100, 260), R(1100, 260)] },
  { name: 'Ring Road East', w: 26, pts: [R(520, -1080), R(520, 1000)] },
  { name: 'Ring Road West', w: 26, pts: [R(-720, -1080), R(-720, 1000)] },
  { name: 'Northern Parkway', w: 26, pts: [R(-1050, -1000), R(1050, -1000)] },
  { name: 'Southern Parkway', w: 26, pts: [R(-1000, 850), R(1000, 850)] },
]
const ROUNDS = [R(-100, -450), R(-100, 260), R(520, -450), R(-720, 260), R(520, 260), R(-100, -1000)]

const SEGS = []
for (const rd of ROADS) {
  for (let i = 0; i < rd.pts.length - 1; i++) {
    const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1]
    SEGS.push({ ax, az, bx, bz, w: rd.w, road: rd })
  }
}

function segDist(x, z, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az
  const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz), 0, 1)
  return Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t))
}
const onRoad = (x, z, margin) => SEGS.some((s) => segDist(x, z, s) < s.w / 2 + margin) || ROUNDS.some(([rx, rz]) => Math.hypot(x - rx, z - rz) < 60 + margin)
const BIG_SITES = ['villa', 'court', 'assembly', 'eagle', 'mosque', 'ncc', 'tower', 'stadium']
const nearBigSite = (x, z, m = 0) => BIG_SITES.some((id) => { const s = siteById(id); return Math.hypot(x - s.x, z - s.z) < (id === 'stadium' ? 120 : id === 'eagle' ? 105 : 85) + m })

const colorize = (g, hex) => {
  const c = new THREE.Color(hex)
  const a = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

function windowTextures() {
  const n = 128
  const mk = (lit) => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = n
    const g = cv.getContext('2d')
    const rnd = makeRng(5)
    g.fillStyle = lit ? '#000' : '#6f8499'
    g.fillRect(0, 0, n, n)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        const on = rnd() > 0.5
        g.fillStyle = lit ? (on ? '#ffe2a8' : '#000') : (on ? '#a9c4dc' : '#8aa5bf')
        g.fillRect(x * 21 + 3, y * 16 + 3, 15, 10)
      }
    }
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = lit ? THREE.NoColorSpace : THREE.SRGBColorSpace
    return t
  }
  return { map: mk(false), emissive: mk(true) }
}

function roadTexture() {
  const cv = document.createElement('canvas')
  cv.width = 256; cv.height = 128
  const g = cv.getContext('2d')
  g.fillStyle = '#393c42'; g.fillRect(0, 0, 256, 128)
  const rnd = makeRng(8)
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},0.03)`; g.fillRect(rnd() * 256, rnd() * 128, 3, 2) }
  g.fillStyle = '#e9ecef'
  g.fillRect(0, 4, 256, 3); g.fillRect(0, 121, 256, 3)
  g.fillStyle = '#e8c85a'
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 62, 34, 4)
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function labelSprite(text, big) {
  const cv = document.createElement('canvas')
  cv.width = 512; cv.height = 96
  const g = cv.getContext('2d')
  g.fillStyle = 'rgba(8,22,46,0.86)'
  g.beginPath(); g.roundRect(4, 4, 504, 88, 16); g.fill()
  g.strokeStyle = big ? 'rgba(255,255,255,0.9)' : 'rgba(169,220,255,0.8)'; g.lineWidth = 3; g.stroke()
  g.fillStyle = '#fff'
  g.font = '600 44px "Barlow Condensed", Arial Narrow, sans-serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 256, 50)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, sizeAttenuation: false, opacity: 0 }))
  sp.scale.set(big ? 0.27 : 0.2, big ? 0.05 : 0.0375, 1)
  sp.renderOrder = 9
  return sp
}

export function createAbuja(quality = 'medium') {
  const group = new THREE.Group()
  const rnd = makeRng(20231)
  const lowQ = quality === 'low'

  // ------------------------------------------------------------ roads
  const asphalt = [], medians = [], greens = []
  for (const s of SEGS) {
    const dx = s.bx - s.ax, dz = s.bz - s.az
    const len = Math.hypot(dx, dz)
    const ang = Math.atan2(dz, dx)
    const g = new THREE.PlaneGeometry(len, s.w)
    g.rotateX(-Math.PI / 2)
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len / 40), uv.getY(i))
    g.rotateY(-ang)
    g.translate((s.ax + s.bx) / 2, Y + 0.3, (s.az + s.bz) / 2)
    asphalt.push(g)
    if (s.road.median) {
      const m = new THREE.PlaneGeometry(len, 5)
      m.rotateX(-Math.PI / 2); m.rotateY(-ang); m.translate((s.ax + s.bx) / 2, Y + 0.5, (s.az + s.bz) / 2)
      medians.push(colorize(m, '#5c9150'))
    }
  }
  for (const [rx, rz] of ROUNDS) {
    const ring = new THREE.RingGeometry(26, 62, 40)
    ring.rotateX(-Math.PI / 2); ring.translate(rx, Y + 0.32, rz)
    const uv = ring.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5)
    asphalt.push(ring)
    const disc = new THREE.CircleGeometry(26, 28)
    disc.rotateX(-Math.PI / 2); disc.translate(rx, Y + 0.55, rz)
    greens.push(colorize(disc, '#4f8a45'))
  }
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  const roadMesh = new THREE.Mesh(mergeGeometries(asphalt.map((g) => (g.index ? g.toNonIndexed() : g))), roadMat)
  roadMesh.receiveShadow = true
  group.add(roadMesh)
  // green medians, roundabout lawns and parks
  const parks = [
    [C.x + 250, C.z - 80, 240, 200],          // Millennium Park
    [C.x - 130, C.z - 620, 130, 60],          // lawns around Eagle Square
    [C.x - 420, C.z + 620, 140, 110],
  ]
  for (const [px, pz, pw, pd] of parks) {
    const p = new THREE.PlaneGeometry(pw, pd)
    p.rotateX(-Math.PI / 2); p.translate(px, Y + 0.42, pz)
    greens.push(colorize(p, '#5b9a4e'))
  }
  const greenGeos = [...medians, ...greens].map((g) => (g.index ? g.toNonIndexed() : g))
  const greenMesh = new THREE.Mesh(mergeGeometries(greenGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }))
  group.add(greenMesh)

  // ------------------------------------------------------------ buildings
  const towers = [], houses = []
  const placed = []
  const free = (x, z, r) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + r)
  const tower = (x, z, w, d, h, color) => {
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(0, h / 2, 0)
    const uv = g.attributes.uv
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 24), uv.getY(k) * (h / 24))
    colorize(g, color)
    g.translate(x, Y, z)
    towers.push(g)
    placed.push({ x, z, r: Math.max(w, d) * 0.6 })
  }
  const cbd = siteById('cbd')
  const roofKit = (x, z, h, w) => {
    const ant = new THREE.CylinderGeometry(0.35, 0.55, 10 + h * 0.08, 6)
    ant.translate(x, h + 5 + h * 0.04, z)
    const box = new THREE.BoxGeometry(w * 0.4, 4, w * 0.35)
    box.translate(x + w * 0.15, h + 2, z - w * 0.1)
    for (const g of [ant, box]) { colorize(g, '#7d858d'); g.translate(0, Y, 0); towers.push(g.index ? g.toNonIndexed() : g) }
  }
  const glass = ['#8fb9dc', '#7fb0cc', '#a7c5de', '#9fb3c4', '#c8d3dc', '#7ea2c0']
  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const x = cbd.x + ix * 78 + (rnd() - 0.5) * 12, z = cbd.z + iz * 86 + (rnd() - 0.5) * 12
      if (onRoad(x, z, 10)) continue
      const centre = ix === 0 && iz === 0
      const h = centre ? 240 : 80 + rnd() * 120 * (1 - Math.hypot(ix, iz) * 0.12)
      const tw = centre ? 40 : 26 + rnd() * 12
      tower(x, z, tw, centre ? 40 : 26 + rnd() * 12, h, glass[Math.floor(rnd() * glass.length)])
      roofKit(x, z, h, tw)
    }
  }
  // mid rise infill around the business district
  let tries = 0, mids = 0
  while (mids < (lowQ ? 50 : 110) && tries++ < 1800) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 600
    const x = cbd.x + Math.cos(a) * d, z = cbd.z + Math.sin(a) * d
    if (onRoad(x, z, 12) || nearBigSite(x, z, 30)) continue
    const w = 20 + rnd() * 14, dd = 20 + rnd() * 14
    if (!free(x, z, Math.max(w, dd) * 0.6 + 6)) continue
    tower(x, z, w, dd, 16 + rnd() * 38, ['#e9e3d4', '#d9d3c6', '#f1ede2', '#c5ccd3', '#b9c8d6'][Math.floor(rnd() * 5)])
    mids++
  }

  const walls = ['#efe6d2', '#e8dcc4', '#f5f1e6', '#d9c9a8', '#f0e0c0', '#e6d4b4']
  const roofs = ['#a8452e', '#8a3d2b', '#b5573a', '#56705a', '#5d6d7c']
  const house = (x, z, w, d, h, wall, roof) => {
    const body = new THREE.BoxGeometry(w, h, d)
    body.translate(0, h / 2, 0)
    colorize(body, wall)
    const cone = new THREE.ConeGeometry(Math.max(w, d) * 0.78, 3 + rnd() * 2, 4)
    cone.rotateY(Math.PI / 4)
    cone.scale(w / Math.max(w, d), 1, d / Math.max(w, d))
    cone.translate(0, h + 1.8, 0)
    colorize(cone, roof)
    for (const g of [body, cone]) { g.translate(x, Y, z); houses.push(g.index ? g.toNonIndexed() : g) }
  }
  const district = (id, rw, rd, spacing, hMin, hMax, size, count = 9999) => {
    const s = siteById(id)
    let n = 0
    for (let ix = -rw / 2; ix <= rw / 2; ix += spacing) {
      for (let iz = -rd / 2; iz <= rd / 2; iz += spacing) {
        if (n >= count) return
        const x = s.x + ix + (rnd() - 0.5) * spacing * 0.3, z = s.z + iz + (rnd() - 0.5) * spacing * 0.3
        if (onRoad(x, z, 14) || nearBigSite(x, z, 25) || Math.hypot(x - C.x, z - C.z) > C.r - 30) continue
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 10)) continue
        const w = size * (0.8 + rnd() * 0.5), d = size * (0.8 + rnd() * 0.5)
        house(x, z, w, d, hMin + rnd() * (hMax - hMin), walls[Math.floor(rnd() * walls.length)], roofs[Math.floor(rnd() * roofs.length)])
        n++
      }
    }
  }
  const k = lowQ ? 1.5 : 1
  district('maitama', 520, 300, 42 * k, 7, 12, 15)
  district('asokoro', 420, 300, 42 * k, 7, 11, 14)
  district('garki', 560, 240, 34 * k, 6, 10, 12)
  district('wuse', 380, 300, 24 * k, 4, 8, 14)
  district('stadium', 300, 150, 40 * k, 6, 9, 13)

  const towerMat = (() => {
    const tex = windowTextures()
    return new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.emissive, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0, vertexColors: true, roughness: 0.4, metalness: 0.35 })
  })()
  const towerMesh = new THREE.Mesh(mergeGeometries(towers.map((g) => (g.index ? g.toNonIndexed() : g))), towerMat)
  group.add(towerMesh)
  if (houses.length) group.add(new THREE.Mesh(mergeGeometries(houses), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })))

  // ------------------------------------------------------------ street trees
  const trunk = new THREE.CylinderGeometry(0.4, 0.55, 5, 5); trunk.translate(0, 2.5, 0)
  const crown = new THREE.IcosahedronGeometry(3.6, 0); crown.translate(0, 7, 0)
  const treeGeo = mergeGeometries([colorize(trunk, '#5a4030'), colorize(crown, '#ffffff')].map((g) => (g.index ? g.toNonIndexed() : g)))
  const spots = []
  for (const s of SEGS) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az)
    const ux = (s.bx - s.ax) / len, uz = (s.bz - s.az) / len
    for (let d = 20; d < len - 20; d += lowQ ? 70 : 38) {
      for (const side of [-1, 1]) {
        const off = side * (s.w / 2 + 7)
        const x = s.ax + ux * d - uz * off, z = s.az + uz * d + ux * off
        if (onRoad(x, z, -2) || nearBigSite(x, z, 10) || placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r)) continue
        spots.push([x, z])
      }
    }
  }
  for (const [px, pz, pw, pd] of parks) for (let i = 0; i < (lowQ ? 8 : 22); i++) spots.push([px + (rnd() - 0.5) * pw * 0.9, pz + (rnd() - 0.5) * pd * 0.9])
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), spots.length)
  const tmp = new THREE.Object3D(), tc = new THREE.Color()
  spots.forEach(([x, z], i) => {
    const sc = 0.8 + rnd() * 0.7
    tmp.position.set(x, Y, z); tmp.rotation.y = rnd() * 6; tmp.scale.setScalar(sc); tmp.updateMatrix()
    trees.setMatrixAt(i, tmp.matrix)
    tc.set(['#3f8a46', '#4c9a4e', '#35773f', '#5ca552'][Math.floor(rnd() * 4)]); trees.setColorAt(i, tc)
  })
  trees.computeBoundingSphere()
  group.add(trees)

  // ------------------------------------------------------------ the landmarks
  const white = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.65 })
  const cream = new THREE.MeshStandardMaterial({ color: '#e9e2cf', roughness: 0.7 })
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b24a', roughness: 0.28, metalness: 0.8, emissive: '#6a4a10', emissiveIntensity: 0.25 })
  const paleGold = new THREE.MeshStandardMaterial({ color: '#e7dcae', roughness: 0.4, metalness: 0.5 })
  const teal = new THREE.MeshStandardMaterial({ color: '#4f9a82', roughness: 0.5, metalness: 0.3 })
  const grey = new THREE.MeshStandardMaterial({ color: '#c9c9c0', roughness: 0.95 })
  const add = (mesh, x, y, z, parent = group) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh }
  const B = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  const dome = (r, m, sy = 0.8) => { const d = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m); d.scale.y = sy; return d }
  const flagAt = (x, y, z, parent = group) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 22, 6), new THREE.MeshStandardMaterial({ color: '#d8dde3' }))
    add(pole, x, y + 11, z, parent)
    ;['#008751', '#ffffff', '#008751'].forEach((c, i) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }))
      add(f, x + 1 + i * 2, y + 19.5, z, parent)
    })
  }

  // National Assembly
  { const s = siteById('assembly')
    add(B(150, 20, 58, white), s.x, Y + 10, s.z)
    add(B(56, 17, 42, white), s.x - 96, Y + 8.5, s.z); add(B(56, 17, 42, white), s.x + 96, Y + 8.5, s.z)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(25, 27, 14, 36), white); add(drum, s.x, Y + 27, s.z)
    add(dome(30, paleGold, 0.7), s.x, Y + 34, s.z)
    for (let i = -3; i <= 3; i++) add(B(3, 18, 3, cream), s.x + i * 18, Y + 9, s.z + 31) }
  // Presidential Villa at the foot of Aso Rock
  { const s = siteById('villa')
    add(B(120, 18, 44, white), s.x, Y + 9, s.z)
    add(B(50, 14, 34, white), s.x - 90, Y + 7, s.z + 6); add(B(50, 14, 34, white), s.x + 90, Y + 7, s.z + 6)
    add(dome(14, teal, 0.85), s.x, Y + 18, s.z)
    flagAt(s.x + 60, Y, s.z + 40) }
  // Supreme Court
  { const s = siteById('court')
    add(B(62, 16, 34, white), s.x, Y + 8, s.z)
    add(dome(15, paleGold, 0.85), s.x, Y + 16, s.z) }
  // Eagle Square
  { const s = siteById('eagle')
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(84, 40), grey); plaza.rotation.x = -Math.PI / 2; add(plaza, s.x, Y + 0.7, s.z)
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; flagAt(s.x + Math.cos(a) * 70, Y, s.z + Math.sin(a) * 70) }
    add(B(6, 30, 6, white), s.x, Y + 15, s.z); add(new THREE.Mesh(new THREE.SphereGeometry(6, 14, 10), gold), s.x, Y + 34, s.z) }
  // National Mosque
  { const s = siteById('mosque')
    add(B(84, 16, 84, white), s.x, Y + 8, s.z)
    add(dome(30, gold, 0.9), s.x, Y + 16, s.z)
    for (const [dx, dz] of [[-48, -48], [48, -48], [-48, 48], [48, 48]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 92, 12), white), s.x + dx, Y + 46, s.z + dz)
      add(new THREE.Mesh(new THREE.ConeGeometry(3.2, 9, 12), gold), s.x + dx, Y + 96, s.z + dz)
    } }
  // National Christian Centre
  { const s = siteById('ncc')
    add(B(96, 26, 44, white), s.x, Y + 13, s.z); add(B(44, 26, 96, white), s.x, Y + 13, s.z)
    add(dome(24, paleGold, 0.85), s.x, Y + 26, s.z)
    add(B(3, 34, 3, gold), s.x, Y + 58, s.z); add(B(16, 3, 3, gold), s.x, Y + 62, s.z) }
  // Millennium Tower
  { const s = siteById('tower')
    add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 6, 240, 14), new THREE.MeshStandardMaterial({ color: '#d4dbe4', roughness: 0.4, metalness: 0.3 })), s.x, Y + 120, s.z)
    add(new THREE.Mesh(new THREE.SphereGeometry(11, 18, 12), new THREE.MeshStandardMaterial({ color: '#c3cdd8', roughness: 0.3, metalness: 0.5 })), s.x, Y + 214, s.z)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(16, 1.7, 8, 30), new THREE.MeshStandardMaterial({ color: '#008751', roughness: 0.5, emissive: '#00402a', emissiveIntensity: 0.5 }))
    ring.rotation.x = Math.PI / 2; add(ring, s.x, Y + 214, s.z)
    add(new THREE.Mesh(new THREE.ConeGeometry(1.4, 24, 8), gold), s.x, Y + 250, s.z) }
  // Moshood Abiola National Stadium
  { const s = siteById('stadium')
    const st = new THREE.Group()
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(90, 94, 26, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.6, side: THREE.DoubleSide }))
    add(wall, 0, 13, 0, st)
    const bowl = new THREE.Mesh(new THREE.RingGeometry(52, 88, 48), new THREE.MeshStandardMaterial({ color: '#b5402f', roughness: 0.8, side: THREE.DoubleSide }))
    bowl.rotation.x = -Math.PI / 2; add(bowl, 0, 15, 0, st)
    const pitch = new THREE.Mesh(new THREE.CircleGeometry(52, 40), new THREE.MeshStandardMaterial({ color: '#4d9b48', roughness: 1 }))
    pitch.rotation.x = -Math.PI / 2; add(pitch, 0, 1.4, 0, st)
    for (const [dx, dz] of [[-78, -78], [78, -78], [-78, 78], [78, 78]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 62, 8), white), dx, 31, dz, st)
      add(B(9, 5, 3, new THREE.MeshStandardMaterial({ color: '#fffbe6', emissive: '#fff2b0', emissiveIntensity: 0.6 })), dx, 63, dz, st)
    }
    st.scale.x = 1.12
    add(st, s.x, Y, s.z) }

  // ------------------------------------------------------------ name boards
  const labels = []
  const heights = { tower: 300, cbd: 300, stadium: 80, mosque: 110, ncc: 90, assembly: 70, villa: 70, court: 60, eagle: 50, wuse: 50, maitama: 60, asokoro: 60, garki: 60 }
  for (const s of SITES) {
    if (lowQ && !['assembly', 'villa', 'mosque', 'tower', 'cbd', 'ncc', 'stadium'].includes(s.id)) continue
    const big = ['assembly', 'villa', 'mosque', 'tower', 'ncc', 'stadium', 'eagle', 'cbd'].includes(s.id)
    const sp = labelSprite(s.name, big)
    sp.position.set(s.x, Y + (heights[s.id] || 60) + 25, s.z)
    group.add(sp)
    labels.push({ sp, s, reach: big ? 2300 : 1300 })
  }
  for (const rd of ROADS.slice(0, 3)) {
    const [ax, az] = rd.pts[0], [bx, bz] = rd.pts[1]
    const sp = labelSprite(rd.name, false)
    sp.scale.set(0.17, 0.032, 1)
    sp.position.set(lerp(ax, bx, 0.18), Y + 30, lerp(az, bz, 0.18))
    group.add(sp)
    labels.push({ sp, s: { x: sp.position.x, z: sp.position.z }, reach: 800 })
  }

  // ------------------------------------------------------------ traffic
  const carBody = new THREE.BoxGeometry(4.4, 1.1, 1.95); carBody.translate(0, 0.9, 0)
  const carCab = new THREE.BoxGeometry(2.3, 0.85, 1.75); carCab.translate(-0.2, 1.85, 0)
  const carGeo = mergeGeometries([carBody, carCab])
  const carCount = lowQ ? 28 : 64
  const cars = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.4 }), carCount)
  cars.frustumCulled = false
  const palette = ['#f4f4f1', '#f4f4f1', '#f4f4f1', '#d8dbe0', '#25282d', '#1f7a4a', '#9aa3ad', '#2c4a7a', '#e8b03a', '#b13a32']
  const traffic = []
  for (let i = 0; i < carCount; i++) {
    const seg = SEGS[Math.floor(rnd() * SEGS.length)]
    const len = Math.hypot(seg.bx - seg.ax, seg.bz - seg.az)
    traffic.push({ seg, len, s: rnd() * len, dir: rnd() < 0.5 ? 1 : -1, v: 9 + rnd() * 9 })
    tc.set(palette[Math.floor(rnd() * palette.length)]); cars.setColorAt(i, tc)
  }
  group.add(cars)

  const o = new THREE.Object3D()
  group.userData.update = (dt, t, cam, dir) => {
    const d = Math.hypot(cam.x - C.x, cam.z - C.z)
    group.visible = d < 9000
    if (!group.visible) return
    // cars only move when someone could see them
    if (d < 4200) {
      for (let i = 0; i < traffic.length; i++) {
        const c = traffic[i]
        c.s += c.v * dt * c.dir
        if (c.s > c.len) c.s = 0
        if (c.s < 0) c.s = c.len
        const ux = (c.seg.bx - c.seg.ax) / c.len, uz = (c.seg.bz - c.seg.az) / c.len
        const fx = ux * c.dir, fz = uz * c.dir
        const lane = c.seg.w * 0.22
        o.position.set(c.seg.ax + ux * c.s + -fz * lane, Y + 0.45, c.seg.az + uz * c.s + fx * lane)
        o.rotation.set(0, Math.atan2(fx, fz) - Math.PI / 2, 0)
        o.updateMatrix()
        cars.setMatrixAt(i, o.matrix)
      }
      cars.instanceMatrix.needsUpdate = true
    }
    // names only appear for what you are heading toward, and only the three best ones at once
    const scored = []
    for (const l of labels) {
      const dx = l.s.x - cam.x, dz = l.s.z - cam.z
      const dd = Math.hypot(dx, dz)
      const dot = dir ? (dx * dir.x + dz * dir.z) / (dd * Math.hypot(dir.x, dir.z) + 0.0001) : 1
      let a = smooth(0.78, 0.93, dot) * (1 - smooth(l.reach * 0.65, l.reach, dd)) * smooth(110, 260, dd)
      l.a = a
      if (a > 0.02) scored.push(l)
    }
    scored.sort((p, q) => q.a - p.a)
    labels.forEach((l) => { l.sp.material.opacity = scored.indexOf(l) >= 0 && scored.indexOf(l) < 3 ? Math.min(0.95, l.a) : 0 })
  }
  // street lamps along the avenues, lit at night
  const lampPoleGeo = new THREE.CylinderGeometry(0.22, 0.3, 10, 6); lampPoleGeo.translate(0, 5, 0)
  const lampHeadGeo = new THREE.SphereGeometry(0.8, 8, 6); lampHeadGeo.translate(0, 10.4, 0)
  const lampSpots = []
  for (const s of SEGS) {
    if (!s.road.median) continue
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az)
    const ux = (s.bx - s.ax) / len, uz = (s.bz - s.az) / len
    for (let d = 30; d < len - 30; d += lowQ ? 120 : 64) {
      for (const side of [-1, 1]) {
        const off = side * (s.w / 2 - 1.5)
        const x = s.ax + ux * d - uz * off, z = s.az + uz * d + ux * off
        lampSpots.push([x, z])
      }
    }
  }
  const lampPoles = new THREE.InstancedMesh(lampPoleGeo, new THREE.MeshStandardMaterial({ color: '#8d949b', roughness: 0.6 }), Math.max(1, lampSpots.length))
  const lampMat = new THREE.MeshStandardMaterial({ color: '#f4efe0', emissive: '#ffd9a0', emissiveIntensity: 0.0 })
  const lampHeads = new THREE.InstancedMesh(lampHeadGeo, lampMat, Math.max(1, lampSpots.length))
  lampSpots.forEach(([x, z], i) => {
    const m = new THREE.Matrix4().makeTranslation(x, Y, z)
    lampPoles.setMatrixAt(i, m); lampHeads.setMatrixAt(i, m)
  })
  lampPoles.frustumCulled = false; lampHeads.frustumCulled = false
  group.add(lampPoles, lampHeads)

  // Nigerian flags in the middle of the roundabouts
  for (const [rx, rz] of ROUNDS) flagAt(rx, Y + 0.5, rz)

  // shadows: everything casts and receives except the flat road paint and the cars
  group.traverse((o) => {
    if (!o.isMesh || o.isSprite) return
    const flat = o === roadMesh || o === greenMesh
    o.castShadow = !flat && o !== cars && o !== trees && o !== lampPoles && o !== lampHeads
    o.receiveShadow = true
  })
  group.userData.setNight = (k) => { towerMat.emissiveIntensity = k * 0.9; lampMat.emissiveIntensity = k * 2.6 }
  return group
}
