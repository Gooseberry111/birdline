import * as THREE from 'three'

// The aircraft form of a bird, used for landing. It is steadier, never tires, and carries
// the aircraft name on the fuselage and the bird's colours on the tail. Same interface as the bird model.
export function createPlane(bird) {
  const S = bird.look.span * 1.2 // wingspan
  const L = S * 1.12 // length
  const R = S * 0.062 // fuselage radius
  const root = new THREE.Group()
  const rig = new THREE.Group()
  root.add(rig)
  const track = []
  const T = (o) => { track.push(o); return o }

  const accent = new THREE.Color(bird.look.wing).lerp(new THREE.Color('#10306a'), 0.6)
  const white = T(new THREE.MeshStandardMaterial({ color: '#f5f7f9', roughness: 0.32, metalness: 0.25 }))
  const light = T(new THREE.MeshStandardMaterial({ color: '#dde2e8', roughness: 0.4, metalness: 0.25 }))
  const accentMat = T(new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.3 }))
  const glass = T(new THREE.MeshStandardMaterial({ color: '#0f1a28', roughness: 0.08, metalness: 0.7 }))
  const dark = T(new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.7, metalness: 0.3 }))
  const chrome = T(new THREE.MeshStandardMaterial({ color: '#b9c1ca', roughness: 0.25, metalness: 0.85 }))

  // ---- fuselage: a smooth tapered body with a belly that is a shade darker
  const prof = [[0.05, -0.5], [0.2, -0.465], [0.5, -0.38], [0.82, -0.25], [0.98, -0.12], [1, 0.0], [1, 0.18], [0.95, 0.28], [0.8, 0.37], [0.58, 0.44], [0.3, 0.485], [0.04, 0.5]]
  const lathe = T(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * R, y * L)), 28))
  lathe.rotateX(Math.PI / 2)
  lathe.scale(1, 0.93, 1)
  lathe.computeVertexNormals()
  {
    const n = lathe.attributes.normal, cols = new Float32Array(n.count * 3)
    const top = new THREE.Color('#f7f8fa'), belly = new THREE.Color('#aeb6bf'), c = new THREE.Color()
    for (let i = 0; i < n.count; i++) {
      c.copy(top).lerp(belly, THREE.MathUtils.smoothstep(-n.getY(i), 0.15, 0.85))
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b
    }
    lathe.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  }
  const body = new THREE.Mesh(lathe, T(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.28 })))
  rig.add(body)

  // cockpit windows
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(T(new THREE.BoxGeometry(R * 0.5, R * 0.34, L * 0.06)), glass)
    w.position.set(s * R * 0.42, R * 0.52, L * 0.395)
    w.rotation.set(-0.5, s * 0.42, 0)
    rig.add(w)
  }
  const front = new THREE.Mesh(T(new THREE.BoxGeometry(R * 0.7, R * 0.3, L * 0.04)), glass)
  front.position.set(0, R * 0.56, L * 0.43); front.rotation.x = -0.62
  rig.add(front)
  // cabin windows and the cheatline
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const w = new THREE.Mesh(T(new THREE.BoxGeometry(0.012 * S, R * 0.2, L * 0.026)), glass)
      w.position.set(s * R * 0.99, R * 0.3, L * (-0.2 + i * 0.045))
      rig.add(w)
    }
    const band = new THREE.Mesh(T(new THREE.BoxGeometry(0.01 * S, R * 0.12, L * 0.7)), accentMat)
    band.position.set(s * R * 0.985, R * 0.02, -L * 0.04)
    rig.add(band)
    const band2 = new THREE.Mesh(T(new THREE.BoxGeometry(0.01 * S, R * 0.06, L * 0.7)), accentMat)
    band2.position.set(s * R * 0.985, -R * 0.14, -L * 0.04)
    rig.add(band2)
  }

  // ---- wings with flaps and winglets
  const half = S / 2
  const wing = new THREE.Shape()
  wing.moveTo(0, L * 0.13); wing.lineTo(half, -L * 0.13); wing.lineTo(half, -L * 0.19); wing.lineTo(0, -L * 0.1); wing.closePath()
  const wingGeo = T(new THREE.ExtrudeGeometry(wing, { depth: S * 0.026, bevelEnabled: true, bevelThickness: S * 0.004, bevelSize: S * 0.004, bevelSegments: 1 }))
  wingGeo.rotateX(Math.PI / 2)
  const flaps = []
  const tips = []
  for (const s of [1, -1]) {
    const g = new THREE.Group()
    const w = new THREE.Mesh(wingGeo, white)
    w.scale.x = s
    g.add(w)
    for (const [a, b] of [[0.12, 0.45], [0.52, 0.86]]) {
      const fl = new THREE.Group()
      const slab = new THREE.Mesh(T(new THREE.BoxGeometry(half * (b - a), S * 0.01, L * 0.045)), light)
      slab.position.set(0, 0, -L * 0.022)
      fl.add(slab)
      const xm = s * half * (a + b) / 2
      fl.position.set(xm, S * 0.014, -L * (0.105 + 0.085 * ((a + b) / 2)) )
      g.add(fl)
      flaps.push(fl)
    }
    const wl = new THREE.Mesh(T(new THREE.BoxGeometry(S * 0.01, S * 0.075, L * 0.09)), accentMat)
    wl.position.set(s * (half - S * 0.004), S * 0.036, -L * 0.165)
    wl.rotation.z = -s * 0.3
    g.add(wl)
    g.position.set(0, -R * 0.4, 0)
    g.rotation.z = s * 0.045
    rig.add(g)
    // navigation light on the tip
    const nav = new THREE.Mesh(T(new THREE.SphereGeometry(S * 0.011, 8, 6)), T(new THREE.MeshStandardMaterial({ color: s > 0 ? '#ff2a2a' : '#22e06a', emissive: s > 0 ? '#ff1010' : '#10ff60', emissiveIntensity: 2 })))
    nav.position.set(s * (half - S * 0.004), S * 0.07 - R * 0.35, -L * 0.18)
    rig.add(nav)
    tips.push(nav)
  }

  // ---- tail with the bird's colours and an emblem
  const fin = new THREE.Shape()
  fin.moveTo(0, 0); fin.lineTo(L * 0.2, 0); fin.lineTo(L * 0.08, S * 0.2); fin.lineTo(-L * 0.01, S * 0.2); fin.closePath()
  const finMesh = new THREE.Mesh(T(new THREE.ExtrudeGeometry(fin, { depth: S * 0.02, bevelEnabled: false })), accentMat)
  finMesh.rotation.y = -Math.PI / 2
  finMesh.position.set(S * 0.01, R * 0.55, -L * 0.5 + L * 0.2)
  rig.add(finMesh)
  const emb = document.createElement('canvas')
  emb.width = emb.height = 128
  {
    const g = emb.getContext('2d')
    g.fillStyle = '#ffffff'
    g.beginPath(); g.moveTo(10, 78); g.bezierCurveTo(40, 70, 56, 52, 64, 20); g.bezierCurveTo(72, 52, 88, 70, 118, 78); g.bezierCurveTo(90, 76, 76, 84, 64, 108); g.bezierCurveTo(52, 84, 38, 76, 10, 78); g.fill()
  }
  const embTex = T(new THREE.CanvasTexture(emb))
  embTex.colorSpace = THREE.SRGBColorSpace
  for (const s of [1, -1]) {
    const d = new THREE.Mesh(T(new THREE.PlaneGeometry(S * 0.11, S * 0.11)), T(new THREE.MeshBasicMaterial({ map: embTex, transparent: true, depthWrite: false })))
    d.position.set(s * (S * 0.02 + 0.003 * S), R * 0.55 + S * 0.1, -L * 0.5 + L * 0.115)
    d.rotation.y = s * Math.PI / 2
    rig.add(d)
  }
  const stab = new THREE.Shape()
  stab.moveTo(0, L * 0.06); stab.lineTo(S * 0.19, -L * 0.03); stab.lineTo(S * 0.19, -L * 0.075); stab.lineTo(0, -L * 0.04); stab.closePath()
  const stabGeo = T(new THREE.ExtrudeGeometry(stab, { depth: S * 0.012, bevelEnabled: false }))
  stabGeo.rotateX(Math.PI / 2)
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(stabGeo, white)
    m.scale.x = s
    m.position.set(0, R * 0.55 + S * 0.0, -L * 0.5 + L * 0.075)
    m.rotation.z = s * 0.05
    rig.add(m)
  }
  const strobe = new THREE.Mesh(T(new THREE.SphereGeometry(S * 0.012, 8, 6)), T(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 3 })))
  strobe.position.set(0, R * 0.55 + S * 0.205, -L * 0.5 + L * 0.2)
  rig.add(strobe)

  // ---- rear mounted engines
  for (const s of [1, -1]) {
    const nac = new THREE.Mesh(T(new THREE.CylinderGeometry(R * 0.4, R * 0.34, L * 0.19, 18)), light)
    nac.rotation.x = Math.PI / 2
    nac.position.set(s * R * 1.55, R * 0.42, -L * 0.34)
    const intake = new THREE.Mesh(T(new THREE.CircleGeometry(R * 0.33, 18)), dark)
    intake.position.set(s * R * 1.55, R * 0.42, -L * 0.34 + L * 0.0955)
    const exhaust = new THREE.Mesh(T(new THREE.ConeGeometry(R * 0.2, L * 0.05, 14)), chrome)
    exhaust.rotation.x = -Math.PI / 2
    exhaust.position.set(s * R * 1.55, R * 0.42, -L * 0.34 - L * 0.115)
    const pyl = new THREE.Mesh(T(new THREE.BoxGeometry(R * 0.7, R * 0.2, L * 0.12)), white)
    pyl.position.set(s * R * 1.2, R * 0.38, -L * 0.34)
    rig.add(nac, intake, exhaust, pyl)
  }

  // ---- landing gear
  const gear = new THREE.Group()
  const wheelGeo = T(new THREE.CylinderGeometry(S * 0.026, S * 0.026, S * 0.022, 16)); wheelGeo.rotateZ(Math.PI / 2)
  const hubGeo = T(new THREE.CylinderGeometry(S * 0.012, S * 0.012, S * 0.024, 10)); hubGeo.rotateZ(Math.PI / 2)
  const legGeo = T(new THREE.CylinderGeometry(S * 0.005, S * 0.007, R * 1.5, 6))
  for (const [x, z, double] of [[0, L * 0.3, false], [R * 1.05, -L * 0.06, true], [-R * 1.05, -L * 0.06, true]]) {
    const leg = new THREE.Mesh(legGeo, chrome); leg.position.set(x, -R * 1.15, z)
    gear.add(leg)
    for (const dx of double ? [-S * 0.018, S * 0.018] : [0]) {
      const w = new THREE.Mesh(wheelGeo, dark); w.position.set(x + dx, -R * 1.9, z)
      const h = new THREE.Mesh(hubGeo, chrome); h.position.copy(w.position)
      gear.add(w, h)
    }
  }
  rig.add(gear)

  // ---- the aircraft name and registration on the fuselage
  const cv = document.createElement('canvas')
  cv.width = 1024; cv.height = 128
  {
    const g = cv.getContext('2d')
    g.clearRect(0, 0, 1024, 128)
    g.fillStyle = '#10306a'
    g.font = '700 84px "Barlow Condensed", Arial Narrow, sans-serif'
    g.textBaseline = 'middle'; g.textAlign = 'left'
    g.fillText(bird.aircraft.toUpperCase(), 10, 64)
    g.font = '600 46px "Barlow Condensed", Arial Narrow, sans-serif'
    g.textAlign = 'right'
    g.fillStyle = '#4a5a74'
    g.fillText('5N FBA', 1014, 66)
  }
  const tex = T(new THREE.CanvasTexture(cv))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(T(new THREE.PlaneGeometry(L * 0.5, L * 0.0625)), T(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })))
    m.position.set(s * (R * 0.935 + 0.002 * S), R * 0.06, -L * 0.03)
    m.rotation.y = s * Math.PI / 2
    rig.add(m)
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true })

  const st = { gear: 1, flap: 0 }
  const tmp = new THREE.Vector3()
  return {
    root, span: S, length: L, headR: R, groundOffset: R * 2.0 + 0.2, isPlane: true,
    update(dt, s = {}) {
      const landing = s.ground || s.gearDown || (s.speed ?? 1) < 0.5
      st.gear += ((landing ? 1 : 0) - st.gear) * Math.min(1, dt * 3)
      st.flap += ((landing ? 0.5 : 0) - st.flap) * Math.min(1, dt * 2.5)
      gear.visible = st.gear > 0.25
      gear.scale.y = 0.3 + st.gear * 0.7
      gear.position.y = (1 - st.gear) * R * 1.2
      for (const f of flaps) f.rotation.x = st.flap
      const t = s.time || 0
      strobe.visible = Math.sin(t * 7) > 0.55
      tips[0].material.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5
    },
    tipWorld(side, out = tmp) { out.set(side === 0 ? S / 2 : -S / 2, 0, -L * 0.17); return root.localToWorld(out) },
    setFirstPerson(on) { rig.visible = !on },
    headWorld(out = tmp) { out.set(0, R * 0.7, L * 0.45); return root.localToWorld(out) },
    dispose() { for (const o of track) o.dispose && o.dispose() },
  }
}
