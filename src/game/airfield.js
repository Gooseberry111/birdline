import { AIRFIELDS } from './terrain'

// Shared airfield geometry. Local runway coordinates: x runs along the runway,
// z runs toward the terminal and apron.
export const AF = (id) => AIRFIELDS.find((a) => a.id === id)
export const runwayLen = (a) => a.r * 1.8
export const axisOf = (a) => ({ x: Math.cos(a.dir), z: -Math.sin(a.dir) })
export const yawOf = (ax) => Math.atan2(ax.x, ax.z)

export function fieldPoint(a, lx, lz) {
  return { x: a.x + lx * Math.cos(a.dir) + lz * Math.sin(a.dir), z: a.z - lx * Math.sin(a.dir) + lz * Math.cos(a.dir) }
}

// four parking slots along the apron
export const apronSlot = (a, i) => fieldPoint(a, (i - 1.5) * runwayLen(a) * 0.09, runwayLen(a) * 0.2)
// parked birds face the runway
export const parkedYaw = (a) => Math.atan2(-Math.sin(a.dir), -Math.cos(a.dir))

export function runwayEnds(a) {
  const L = runwayLen(a), ax = axisOf(a)
  return [
    { x: a.x - ax.x * L / 2, z: a.z - ax.z * L / 2 },
    { x: a.x + ax.x * L / 2, z: a.z + ax.z * L / 2 },
  ]
}

// where a point sits relative to the runway: distance along it and sideways offset
export function runwayFrame(a, x, z) {
  const ax = axisOf(a)
  const dx = x - a.x, dz = z - a.z
  return { along: dx * ax.x + dz * ax.z, side: dx * -ax.z + dz * ax.x }
}

export function nearestField(x, z) {
  let best = null, bd = Infinity
  for (const a of AIRFIELDS) {
    const d = Math.hypot(a.x - x, a.z - z)
    if (d < bd) { bd = d; best = a }
  }
  return best
}
