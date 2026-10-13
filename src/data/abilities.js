// Abilities are grouped by behaviour kind. The flight model reads `kind` and `power`,
// the UI reads name and description.
export const ABILITIES = {
  predatorDive: {
    name: 'Predator Dive', kind: 'dive', dur: 3.2, cd: 14, cost: 10, power: 1,
    desc: 'Folds the wings and drops into a high speed dive, then pulls out with the speed it gained.',
  },
  royalGlide: {
    name: 'Royal Glide', kind: 'glide', dur: 7, cd: 20, cost: 0, power: 1,
    desc: 'Locks the wings into a perfect soar. Energy use falls to almost nothing while speed holds.',
  },
  machBurst: {
    name: 'Mach Burst', kind: 'burst', dur: 2.6, cd: 12, cost: 18, power: 1.0,
    desc: 'Extreme acceleration for a few seconds. Great for straights, costly if you spend it carelessly.',
  },
  streak: {
    name: 'Streak', kind: 'burst', dur: 1.8, cd: 8, cost: 10, power: 0.7,
    desc: 'A short, sharp surge of speed with very little energy cost.',
  },
  flutterDash: {
    name: 'Flutter Dash', kind: 'burst', dur: 1.4, cd: 6, cost: 8, power: 0.6,
    desc: 'A blur of wingbeats that snaps the bird forward in a quick burst.',
  },
  precisionTurn: {
    name: 'Precision Turn', kind: 'turn', dur: 3.5, cd: 11, cost: 8, power: 1,
    desc: 'Banks hard and holds speed through an extremely tight, controlled turn.',
  },
  flockDart: {
    name: 'Flock Dart', kind: 'turn', dur: 2.8, cd: 9, cost: 6, power: 0.8,
    desc: 'Darts through tight gaps with sharply improved turn rate.',
  },
  oceanGlide: {
    name: 'Ocean Glide', kind: 'glide', dur: 12, cd: 24, cost: 0, power: 1.25,
    desc: 'Rides the air just above the swell. Uses very little energy over long distances.',
  },
  silentGlide: {
    name: 'Silent Glide', kind: 'glide', dur: 6, cd: 16, cost: 0, power: 0.9,
    desc: 'Smooth, steady, effortless. Recovers a little energy while it holds.',
  },
  waterStrike: {
    name: 'Water Strike', kind: 'strike', dur: 3.2, cd: 13, cost: 6, power: 1,
    desc: 'Dives toward the water, skims the surface and recovers in one rapid pull up with bonus speed.',
  },
  hover: {
    name: 'Hover', kind: 'hover', dur: 4, cd: 12, cost: 12, power: 1,
    desc: 'Stops in mid air and holds position. Turn on the spot, then fly off again.',
  },
  stoop: {
    name: 'Stoop', kind: 'dive', dur: 2.4, cd: 16, cost: 14, power: 1.35,
    desc: 'The fastest dive in the sky. Short, violent and difficult to control.',
  },
  thermalRead: {
    name: 'Thermal Read', kind: 'lift', dur: 9, cd: 18, cost: 0, power: 1,
    desc: 'Senses rising air. Thermals glow on your map and give much stronger lift.',
  },
  ridgeRider: {
    name: 'Ridge Rider', kind: 'lift', dur: 10, cd: 20, cost: 0, power: 1.2,
    desc: 'Uses slope lift along mountain faces to climb with almost no energy cost.',
  },
  steadyWings: {
    name: 'Steady Wings', kind: 'steady', dur: 8, cd: 18, cost: 0, power: 1,
    desc: 'Rides through turbulence and gusts without losing speed, and recovers energy.',
  },
  heavyLift: {
    name: 'Heavy Lift', kind: 'steady', dur: 10, cd: 22, cost: 0, power: 1.2,
    desc: 'Settles the load and powers through weather. Strong energy recovery.',
  },
  eagleEye: {
    name: 'Eagle Eye', kind: 'focus', dur: 8, cd: 18, cost: 4, power: 1,
    desc: 'Sharpens vision. Checkpoints and pickups are easier to hit and the next route points show on the HUD.',
  },
  vFormation: {
    name: 'V Formation', kind: 'draft', dur: 10, cd: 20, cost: 0, power: 1,
    desc: 'Finds the draft. Energy use drops by half and cruise speed improves.',
  },
  groundEffect: {
    name: 'Ground Effect', kind: 'skim', dur: 8, cd: 16, cost: 0, power: 1,
    desc: 'Close to the surface the wings gain extra lift and speed with very little effort.',
  },
}

export const abilityLevelMods = (level) => ({
  cd: 1 - 0.07 * level,
  dur: 1 + 0.08 * level,
})
