// Every bird is a bird first and an aircraft identity second.
// `look` drives the procedural model, `stats` and `ability` drive performance.

export const CLASSES = {
  sport: { name: 'Sport', blurb: 'Fast and agile. Short on range.' },
  luxury: { name: 'Luxury', blurb: 'Range, stability and altitude.' },
  heavy: { name: 'Heavy', blurb: 'Endurance and payload. Slow to turn.' },
  utility: { name: 'Utility', blurb: 'Balanced and reliable.' },
  cargo: { name: 'Cargo', blurb: 'Payload and endurance for delivery work.' },
  micro: { name: 'Micro', blurb: 'Tiny and brilliantly agile.' },
}

export const RARITIES = {
  common: { name: 'Common', color: '#b6c2d1', rank: 0, bonus: 0 },
  uncommon: { name: 'Uncommon', color: '#67d3a4', rank: 1, bonus: 0.01 },
  rare: { name: 'Rare', color: '#5fb4ff', rank: 2, bonus: 0.02 },
  epic: { name: 'Epic', color: '#9db7ff', rank: 3, bonus: 0.03 },
  legendary: { name: 'Legendary', color: '#f0cf8a', rank: 4, bonus: 0.04 },
  elite: { name: 'Elite', color: '#ffffff', rank: 5, bonus: 0.05 },
}

const B = (o) => o

export const BIRDS = [
  B({
    id: 'sparrow', name: 'Sparrow', aircraft: 'Cessna', category: 'Light trainer', cls: 'micro', rarity: 'common',
    unlock: 1, price: 0, wingspan: 0.22,
    stats: { speed: 52, range: 48, altitude: 44, agility: 92, endurance: 50 }, payload: 20,
    abilities: ['flockDart', 'streak'],
    habitat: 'Cities, farmland and hedgerows', behaviour: 'Social, fearless and always in motion.',
    blurb: 'The first wings most pilots earn. Forgiving, quick to turn and perfect for learning the sky.',
    look: { body: '#8b6b4a', belly: '#d9cbb4', wing: '#6d5339', tip: '#4e3b28', head: '#7b5b3c', beak: '#403528', tail: '#5e4733', span: 1.0, chord: 0.34, tailLen: 0.5, tailFan: 0.35, bodyLen: 0.62, flap: 9, shape: 'short', beakLen: 0.11 },
  }),
  B({
    id: 'kite', name: 'Kite', aircraft: 'Pilatus', category: 'Rugged utility', cls: 'utility', rarity: 'common',
    unlock: 1, price: 0, wingspan: 1.5,
    stats: { speed: 62, range: 66, altitude: 70, agility: 72, endurance: 68 }, payload: 55,
    abilities: ['thermalRead', 'precisionTurn'],
    habitat: 'Open country, valleys and ridges', behaviour: 'Patient. Hangs on the wind and reads the land.',
    blurb: 'A working glider with a forked tail. It lives on thermals and gets more from the air than anything its size.',
    look: { body: '#a05d35', belly: '#c88a5e', wing: '#8d5a3a', tip: '#262424', head: '#d6c9bb', beak: '#e0b845', tail: '#b3693c', span: 2.9, chord: 0.62, tailLen: 1.1, tailFan: 0.25, tailFork: 0.5, bodyLen: 1.2, flap: 2.2, shape: 'long', beakLen: 0.16 },
  }),
  B({
    id: 'hawk', name: 'Hawk', aircraft: 'Challenger', category: 'Super midsize', cls: 'utility', rarity: 'common',
    unlock: 1, price: 0, wingspan: 1.2,
    stats: { speed: 70, range: 68, altitude: 72, agility: 78, endurance: 66 }, payload: 50,
    abilities: ['precisionTurn', 'eagleEye'],
    habitat: 'Woodland edges and open farmland', behaviour: 'Sharp, deliberate, hunts with exact control.',
    blurb: 'Round wings and a long tail make the Hawk the most precise turner in its class.',
    look: { body: '#6e5236', belly: '#e6dccb', wing: '#594430', tip: '#2f251c', head: '#5d4630', beak: '#2b2b2b', tail: '#9a6d44', span: 2.7, chord: 0.78, tailLen: 1.2, tailFan: 0.45, bodyLen: 1.15, flap: 3.4, shape: 'broad', beakLen: 0.16, barred: true },
  }),
  B({
    id: 'goose', name: 'Goose', aircraft: 'ATR', category: 'Regional turboprop', cls: 'cargo', rarity: 'uncommon',
    unlock: 3, price: 900, wingspan: 1.6,
    stats: { speed: 60, range: 78, altitude: 52, agility: 48, endurance: 86 }, payload: 80,
    abilities: ['vFormation', 'steadyWings'],
    habitat: 'Wetlands, lakes and migration corridors', behaviour: 'Disciplined long distance flyer.',
    blurb: 'A tireless regional hauler. The Goose finds the draft and holds it for hundreds of kilometres.',
    look: { body: '#8c8579', belly: '#d8d2c6', wing: '#756e63', tip: '#38342f', head: '#1d1d1f', beak: '#1b1b1b', tail: '#2d2b29', span: 3.2, chord: 0.62, tailLen: 0.75, tailFan: 0.4, bodyLen: 1.5, neck: 0.9, flap: 3, shape: 'long', beakLen: 0.14, cheek: '#f4f1ea' },
  }),
  B({
    id: 'osprey', name: 'Osprey', aircraft: 'King Air', category: 'Twin turboprop', cls: 'utility', rarity: 'uncommon',
    unlock: 4, price: 1400, wingspan: 1.7,
    stats: { speed: 68, range: 74, altitude: 66, agility: 74, endurance: 74 }, payload: 60,
    abilities: ['waterStrike', 'precisionTurn'],
    habitat: 'Coasts, rivers and lakes', behaviour: 'Hovers, folds, strikes the water and climbs out again.',
    blurb: 'A coastal specialist with a crooked wing and a bold dive. Nobody leaves the water faster.',
    look: { body: '#4e3b2b', belly: '#f4f1ea', wing: '#4a3828', tip: '#2b2118', head: '#f4f1ea', beak: '#242424', tail: '#5b4533', span: 3.3, chord: 0.62, tailLen: 0.85, tailFan: 0.4, bodyLen: 1.3, flap: 2.6, shape: 'long', beakLen: 0.14, eyeStripe: '#2b2118' },
  }),
  B({
    id: 'falcon', name: 'Falcon', aircraft: 'Legacy', category: 'Midsize jet', cls: 'sport', rarity: 'rare',
    unlock: 5, price: 2600, wingspan: 1.0,
    stats: { speed: 92, range: 62, altitude: 78, agility: 88, endurance: 56 }, payload: 35,
    abilities: ['machBurst', 'precisionTurn'],
    habitat: 'Open plains, cliffs and cities', behaviour: 'Fast, focused and relentless.',
    blurb: 'Swept wings and a blistering top speed. The Falcon spends its energy like a sprinter.',
    look: { body: '#5e6d82', belly: '#e4e8ee', wing: '#4d5a6e', tip: '#26303d', head: '#38465a', beak: '#d3b24c', tail: '#44546a', span: 2.5, chord: 0.5, tailLen: 1.1, tailFan: 0.25, bodyLen: 1.1, flap: 4.2, shape: 'pointed', beakLen: 0.12, moustache: true },
  }),
  B({
    id: 'swift', name: 'Swift', aircraft: 'Citation', category: 'Light jet', cls: 'sport', rarity: 'rare',
    unlock: 6, price: 3000, wingspan: 0.42,
    stats: { speed: 86, range: 58, altitude: 74, agility: 90, endurance: 60 }, payload: 20,
    abilities: ['streak', 'flockDart'],
    habitat: 'Open skies and city towers', behaviour: 'Spends almost its whole life in flight.',
    blurb: 'Scythe wings and endless stamina in the air. The Citation of birds.',
    look: { body: '#2d2f33', belly: '#46484d', wing: '#27292d', tip: '#1a1b1e', head: '#2b2d31', beak: '#1e1e1e', tail: '#26282b', span: 2.2, chord: 0.36, tailLen: 0.6, tailFan: 0.3, tailFork: 0.6, bodyLen: 0.9, flap: 7, shape: 'scythe', beakLen: 0.06, throat: '#e8e5df' },
  }),
  B({
    id: 'hummingbird', name: 'Hummingbird', aircraft: 'Cirrus', category: 'Personal aircraft', cls: 'micro', rarity: 'epic',
    unlock: 7, price: 4200, wingspan: 0.11,
    stats: { speed: 46, range: 40, altitude: 38, agility: 100, endurance: 44 }, payload: 8,
    abilities: ['hover', 'flutterDash'],
    habitat: 'Gardens, forests and mountain meadows', behaviour: 'Hovers, reverses and darts sideways.',
    blurb: 'The only bird that can stop in the air and hold. Brilliant in tight, technical courses.',
    look: { body: '#2a8f6d', belly: '#d7e6dc', wing: '#7e8f98', tip: '#59666e', head: '#1d9e7c', beak: '#1a1a1a', tail: '#1b6c55', span: 1.35, chord: 0.2, tailLen: 0.5, tailFan: 0.3, bodyLen: 0.6, flap: 22, shape: 'hum', beakLen: 0.42, throat: '#d8365d', iridescent: true },
  }),
  B({
    id: 'stork', name: 'Stork', aircraft: 'Antonov', category: 'Heavy transport', cls: 'cargo', rarity: 'uncommon',
    unlock: 8, price: 2200, wingspan: 2.0,
    stats: { speed: 58, range: 84, altitude: 64, agility: 44, endurance: 90 }, payload: 92,
    abilities: ['thermalRead', 'steadyWings'],
    habitat: 'Wetlands, rooftops and open fields', behaviour: 'Soars on thermals across continents.',
    blurb: 'Long legs, long wings, long range. Built to carry cargo across the map.',
    look: { body: '#f2f0ea', belly: '#faf9f5', wing: '#f2f0ea', tip: '#1d1d20', head: '#f2f0ea', beak: '#d3452f', tail: '#eceae4', span: 3.9, chord: 0.8, tailLen: 0.7, tailFan: 0.35, bodyLen: 1.5, neck: 1.2, flap: 2.2, shape: 'broad', beakLen: 0.52, legs: '#d3452f', trailLegs: 0.9, tipBlack: true },
  }),
  B({
    id: 'eagle', name: 'Eagle', aircraft: 'Gulfstream', category: 'Luxury long range', cls: 'luxury', rarity: 'epic',
    unlock: 10, price: 5200, wingspan: 2.1,
    stats: { speed: 95, range: 98, altitude: 97, agility: 82, endurance: 96 }, payload: 55,
    abilities: ['predatorDive', 'royalGlide'],
    habitat: 'Big rivers and lakes, from the Niger to Lake Chad', behaviour: 'Powerful, confident and unhurried.',
    blurb: 'The flagship. Commanding presence, huge range and the altitude to match.',
    look: { body: '#4a3626', belly: '#5a4331', wing: '#43301f', tip: '#2b1d12', head: '#f6f3ec', beak: '#f0bd33', tail: '#f6f3ec', span: 4.2, chord: 0.95, tailLen: 1.1, tailFan: 0.5, bodyLen: 1.5, flap: 2.1, shape: 'broad', beakLen: 0.22, hooked: true },
  }),
  B({
    id: 'pelican', name: 'Pelican', aircraft: 'Airbus', category: 'Wide body', cls: 'heavy', rarity: 'rare',
    unlock: 12, price: 4000, wingspan: 2.8,
    stats: { speed: 58, range: 86, altitude: 58, agility: 38, endurance: 92 }, payload: 96,
    abilities: ['groundEffect', 'steadyWings'],
    habitat: 'Coasts, estuaries and lagoons', behaviour: 'Skims the surface in smooth, heavy flight.',
    blurb: 'A wide body with a huge bill. Rides the sea surface on ground effect for hours.',
    look: { body: '#f2efe8', belly: '#f7f5f0', wing: '#f2efe8', tip: '#2a2a2c', head: '#f6f2df', beak: '#e2a23a', tail: '#e3dfd4', span: 4.6, chord: 0.95, tailLen: 0.6, tailFan: 0.35, bodyLen: 1.7, neck: 0.9, flap: 1.8, shape: 'broad', beakLen: 0.7, pouch: '#efbf68', tipBlack: true },
  }),
  B({
    id: 'swan', name: 'Swan', aircraft: 'Embraer', category: 'Executive jet', cls: 'luxury', rarity: 'rare',
    unlock: 14, price: 4600, wingspan: 2.4,
    stats: { speed: 74, range: 90, altitude: 70, agility: 58, endurance: 88 }, payload: 70,
    abilities: ['silentGlide', 'steadyWings'],
    habitat: 'Lakes, rivers and estuaries', behaviour: 'Graceful, calm and unmistakably elegant.',
    blurb: 'A long neck and a smooth ride. The Swan is the premium choice for a comfortable crossing.',
    look: { body: '#fbfbf8', belly: '#ffffff', wing: '#f7f7f3', tip: '#e5e5e1', head: '#fbfbf8', beak: '#f08c2f', tail: '#f1f1ed', span: 4.0, chord: 0.85, tailLen: 0.6, tailFan: 0.3, bodyLen: 1.7, neck: 1.8, flap: 2.4, shape: 'broad', beakLen: 0.2, knob: '#1b1b1d' },
  }),
  B({
    id: 'peregrine', name: 'Peregrine Falcon', aircraft: 'Phenom', category: 'Very light jet', cls: 'sport', rarity: 'epic',
    unlock: 16, price: 6200, wingspan: 1.0,
    stats: { speed: 100, range: 56, altitude: 82, agility: 86, endurance: 52 }, payload: 30,
    abilities: ['stoop', 'machBurst'],
    habitat: 'Cliffs, coasts and skyscrapers', behaviour: 'The fastest animal alive in a dive.',
    blurb: 'Raw speed with a razor edge. Without discipline the Peregrine runs out of sky.',
    look: { body: '#4f5a69', belly: '#efe9dc', wing: '#424c5a', tip: '#20252d', head: '#1f242c', beak: '#d6b448', tail: '#3c4654', span: 2.6, chord: 0.46, tailLen: 0.95, tailFan: 0.22, bodyLen: 1.1, flap: 4.6, shape: 'pointed', beakLen: 0.11, moustache: true, barred: true },
  }),
  B({
    id: 'albatross', name: 'Albatross', aircraft: 'Global', category: 'Ultra long range', cls: 'heavy', rarity: 'legendary',
    unlock: 20, price: 9000, wingspan: 3.4,
    stats: { speed: 72, range: 100, altitude: 74, agility: 52, endurance: 100 }, payload: 84,
    abilities: ['oceanGlide', 'steadyWings'],
    habitat: 'Open ocean and remote islands', behaviour: 'Glides for days with barely a wingbeat.',
    blurb: 'The greatest long haul flyer. It crosses oceans on almost no energy at all.',
    look: { body: '#f6f5f0', belly: '#fbfaf6', wing: '#3b3a3d', tip: '#242326', head: '#f6f5f0', beak: '#efc4a4', tail: '#f2f1ec', span: 6.4, chord: 0.5, tailLen: 0.65, tailFan: 0.3, bodyLen: 1.5, flap: 1.4, shape: 'albatross', beakLen: 0.3, hooked: true },
  }),
  B({
    id: 'golden', name: 'Golden Eagle', aircraft: 'Global Express', category: 'Business jet', cls: 'luxury', rarity: 'legendary',
    unlock: 24, price: 11000, wingspan: 2.2,
    stats: { speed: 94, range: 94, altitude: 100, agility: 80, endurance: 90 }, payload: 58,
    abilities: ['eagleEye', 'predatorDive'],
    habitat: 'High mountains and open ranges', behaviour: 'Hunts across vast territory from great height.',
    blurb: 'Golden plumage, the highest ceiling in the game and vision that finds every checkpoint.',
    look: { body: '#4b3522', belly: '#573d27', wing: '#3d2a1a', tip: '#25170d', head: '#d7a24e', beak: '#d9b24a', tail: '#6f5033', span: 4.4, chord: 1.0, tailLen: 1.25, tailFan: 0.5, bodyLen: 1.55, flap: 2, shape: 'broad', beakLen: 0.22, hooked: true, nape: '#e2b25a' },
  }),
  B({
    id: 'crane', name: 'Crowned Crane', aircraft: 'C130', category: 'Military transport', cls: 'cargo', rarity: 'epic',
    unlock: 26, price: 7600, wingspan: 2.3,
    stats: { speed: 64, range: 88, altitude: 70, agility: 50, endurance: 94 }, payload: 98,
    abilities: ['heavyLift', 'thermalRead'],
    habitat: 'Savanna and wetlands across Nigeria. The national bird', behaviour: 'Proud, cooperative and strong, and it arrives together.',
    blurb: 'Nigeria\'s own Black Crowned Crane. A rugged hauler that takes the heaviest loads through the roughest weather.',
    look: { body: '#3a3f47', belly: '#50565f', wing: '#2f343c', tip: '#16181c', head: '#26282c', beak: '#5a5e52', tail: '#2c3036', span: 4.2, chord: 0.8, tailLen: 0.75, tailFan: 0.35, bodyLen: 1.6, neck: 1.25, flap: 2.2, shape: 'broad', beakLen: 0.3, cap: '#e8c24a', cheek: '#f4f1ea', legs: '#2a2a2a', trailLegs: 0.9, wingPatch: '#f1efe8' },
  }),
  B({
    id: 'condor', name: 'Condor', aircraft: 'Boeing', category: 'Jumbo', cls: 'heavy', rarity: 'elite',
    unlock: 28, price: 14000, wingspan: 3.1,
    stats: { speed: 76, range: 96, altitude: 92, agility: 40, endurance: 98 }, payload: 100,
    abilities: ['ridgeRider', 'royalGlide'],
    habitat: 'High Andes and coastal cliffs', behaviour: 'Soars for hours on rising mountain air.',
    blurb: 'The largest flying bird on the map. Heavy, majestic and unstoppable once it is up.',
    look: { body: '#17171a', belly: '#1b1b1f', wing: '#18181b', tip: '#101012', head: '#c8836b', beak: '#e9e4d8', tail: '#151517', span: 6.0, chord: 1.2, tailLen: 0.9, tailFan: 0.5, bodyLen: 1.7, neck: 0.8, flap: 1.3, shape: 'condor', beakLen: 0.2, hooked: true, ruff: '#f4f1ea', wingPatch: '#ececec' },
  }),
]

export const birdById = (id) => BIRDS.find((b) => b.id === id)

export const statTotal = (b) => {
  const s = b.stats
  return s.speed + s.range + s.altitude + s.agility + s.endurance
}

export const masteryTree = (b) => [
  { level: 1, name: `Basic ${b.name}`, desc: 'Standard flight characteristics.' },
  { level: 5, name: 'Improved glide', desc: 'Glide efficiency up by 4 percent.' },
  { level: 10, name: 'High altitude flight', desc: 'Service ceiling up by 8 percent.' },
  { level: 20, name: 'Long range endurance', desc: 'Energy use down by 8 percent.' },
  { level: 30, name: 'Second ability', desc: `Unlocks a second ability slot.`, ability: true },
  { level: 50, name: `Elite ${b.aircraft} ${b.name}`, desc: 'Elite livery and a small boost to every stat.' },
]

