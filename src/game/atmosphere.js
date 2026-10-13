import * as THREE from 'three'
import { makeNoise, fbm, makeRng, smooth, clamp } from './noise'

// Far hills ring the horizon so the map never ends in a flat line.
export function createHorizon() {
  const noise = makeNoise(404)
  const segs = 200, rings = 6
  const r0 = 5600, r1 = 15000
  const pos = new Float32Array((segs + 1) * (rings + 1) * 3)
  const col = new Float32Array(pos.length)
  const idx = []
  const c = new THREE.Color()
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2
    const base = fbm(noise, Math.cos(a) * 2.3 + 5, Math.sin(a) * 2.3, 3) * 0.5 + 0.5
    for (let j = 0; j <= rings; j++) {
      const t = j / rings
      const r = r0 + (r1 - r0) * Math.pow(t, 1.25)
      const ridge = Math.sin(t * Math.PI) * (0.45 + Math.pow(base, 1.7)) * 360
      const detail = fbm(noise, Math.cos(a) * 9 + t * 4, Math.sin(a) * 9 - t * 3, 3) * 70 * Math.sin(t * Math.PI)
      const k = (i * (rings + 1) + j) * 3
      pos[k] = Math.cos(a) * r
      pos[k + 1] = 41 + Math.max(0, ridge + detail)
      pos[k + 2] = Math.sin(a) * r
      c.set('#7f957f').lerp(new THREE.Color('#9fb0b5'), t)
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b
      if (i < segs && j < rings) {
        const a0 = i * (rings + 1) + j, b0 = a0 + 1, c0 = a0 + rings + 1, d0 = c0 + 1
        idx.push(a0, c0, b0, b0, c0, d0)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))
  mesh.frustumCulled = false
  return mesh
}

// Black kites circling over the markets and the city, as in real Abuja.
export function createKites(centers, count = 14) {
  const rnd = makeRng(515)
  const geo = new THREE.BufferGeometry()
  const v = new Float32Array([
    -1.7, 0, -0.1, 0, 0, 0.55, 0, 0, -0.5,
    1.7, 0, -0.1, 0, 0, -0.5, 0, 0, 0.55,
  ])
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#2a2018', side: THREE.DoubleSide }), count)
  mesh.frustumCulled = false
  const birds = []
  for (let i = 0; i < count; i++) {
    const c = centers[i % centers.length]
    birds.push({ c, r: 70 + rnd() * 190, w: (0.12 + rnd() * 0.12) * (rnd() < 0.5 ? 1 : -1), a: rnd() * 6.28, y: c.y + 110 + rnd() * 120, f: 4 + rnd() * 2, s: 2.2 + rnd() * 1.3 })
  }
  const o = new THREE.Object3D()
  mesh.userData.update = (dt, t, cam) => {
    mesh.visible = Math.hypot(cam.x - centers[0].x, cam.z - centers[0].z) < 4500
    if (!mesh.visible) return
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i]
      b.a += b.w * dt
      const x = b.c.x + Math.cos(b.a) * b.r, z = b.c.z + Math.sin(b.a) * b.r
      o.position.set(x, b.y + Math.sin(t * 0.6 + i) * 6, z)
      o.rotation.set(0, -b.a - (b.w > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI, (b.w > 0 ? -1 : 1) * 0.35)
      const flap = 0.8 + Math.abs(Math.sin(t * b.f + i)) * 0.22
      o.scale.set(b.s * flap, b.s, b.s)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  return mesh
}

void smooth; void clamp
