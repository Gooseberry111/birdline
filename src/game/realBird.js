import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { asset } from '../assets'

// Loads a real 3D bird (.glb) and wraps it in the same interface as the built in bird,
// so the flight code, camera and menus do not care which one they are using.
// Models are optional: drop files in public/models and list them in public/models/index.json.
export async function loadRealBird(bird, cfg) {
  const gltf = await new GLTFLoader().loadAsync(asset(`models/${cfg.file}`))
  const inner = gltf.scene
  inner.rotation.y = cfg.rotY || 0 // set to 3.14159 if the model faces backwards
  const holder = new THREE.Group()
  holder.add(inner)

  let box = new THREE.Box3().setFromObject(holder)
  const size = box.getSize(new THREE.Vector3())
  const span = cfg.span ?? bird.look.span
  const k = (span / Math.max(size.x, size.z * 0.6, 0.001)) * (cfg.scale || 1)
  holder.scale.setScalar(k)
  box = new THREE.Box3().setFromObject(holder)
  const center = box.getCenter(new THREE.Vector3())
  holder.position.sub(new THREE.Vector3(center.x, center.y, center.z))
  box = new THREE.Box3().setFromObject(holder)
  const len = box.max.z - box.min.z
  const width = box.max.x - box.min.x

  const root = new THREE.Group()
  root.add(holder)
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false } })

  let mixer = null
  if (gltf.animations && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(inner)
    const clip = gltf.animations.find((c) => /fly|flap|glide/i.test(c.name)) || gltf.animations[0]
    mixer.clipAction(clip).play()
  }

  const tmp = new THREE.Vector3()
  return {
    root,
    span: width,
    length: len,
    headR: 0.12,
    groundOffset: Math.max(0.3, -box.min.y * 0.6),
    update(dt, s = {}) {
      if (mixer) mixer.update(dt * (0.25 + 2.3 * (s.flap ?? 0.2) + (s.fold ? -0.3 : 0)))
    },
    tipWorld(side, out = tmp) {
      out.set(side === 0 ? width / 2 : -width / 2, 0, 0)
      return root.localToWorld(out)
    },
    setFirstPerson(on) { holder.visible = !on },
    headWorld(out = tmp) { out.set(0, 0.05, len * 0.45); return root.localToWorld(out) },
    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose() })
      })
    },
  }
}
