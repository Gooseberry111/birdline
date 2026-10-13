import * as THREE from 'three'

// Spinning gold coins that hang in the air. Flying through one collects it.
export class CoinField {
  constructor(scene, max = 260) {
    const geo = new THREE.CylinderGeometry(3.4, 3.4, 0.8, 20)
    geo.rotateX(Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({ color: '#ffd14a', emissive: '#ff9f00', emissiveIntensity: 1.1, metalness: 0.55, roughness: 0.3 })
    this.mesh = new THREE.InstancedMesh(geo, mat, max)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    scene.add(this.mesh)
    this.max = max
    this.pos = []
    this.alive = []
    this.o = new THREE.Object3D()
  }

  clear() {
    this.pos = []
    this.alive = []
    this.mesh.count = 0
  }

  set(list) {
    this.pos = list.slice(0, this.max)
    this.alive = this.pos.map(() => true)
    this.mesh.count = this.pos.length
  }

  get remaining() { return this.alive.filter(Boolean).length }

  // returns how many coins were collected this frame
  update(dt, t, p, radius = 30) {
    let got = 0
    const o = this.o
    for (let i = 0; i < this.pos.length; i++) {
      const c = this.pos[i]
      if (this.alive[i]) {
        const dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z
        if (dx * dx + dy * dy + dz * dz < radius * radius) { this.alive[i] = false; got++ }
      }
      o.position.set(c.x, c.y + Math.sin(t * 2 + i) * 0.8, c.z)
      o.rotation.set(0, t * 2.6 + i * 0.7, 0)
      o.scale.setScalar(this.alive[i] ? 1 : 0.0001)
      o.updateMatrix()
      this.mesh.setMatrixAt(i, o.matrix)
    }
    if (this.pos.length) this.mesh.instanceMatrix.needsUpdate = true
    return got
  }
}

// evenly spaced coins between two points with a gentle wave
export function coinLine(a, b, spacing = 90, wobble = 14, maxN = 40) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
  const len = Math.hypot(dx, dy, dz)
  const n = Math.min(maxN, Math.max(0, Math.floor(len / spacing) - 1))
  const out = []
  const sx = -dz / (Math.hypot(dx, dz) || 1), sz = dx / (Math.hypot(dx, dz) || 1)
  for (let i = 1; i <= n; i++) {
    const k = i / (n + 1)
    const w = Math.sin(k * Math.PI * 3) * wobble
    out.push({ x: a.x + dx * k + sx * w, y: a.y + dy * k + Math.cos(k * Math.PI * 2) * 5, z: a.z + dz * k + sz * w })
  }
  return out
}
