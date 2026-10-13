// Cosmetics change how a bird looks, never how it flies.

export const PLUMAGE = [
  { id: 'natural', name: 'Natural', price: 0, tint: null },
  { id: 'dusk', name: 'Dusk', price: 600, tint: '#5d6f96' },
  { id: 'frost', name: 'Frost', price: 800, tint: '#cfe3f2' },
  { id: 'ember', name: 'Ember', price: 900, tint: '#c4673a' },
  { id: 'jade', name: 'Jade', price: 1100, tint: '#3d8f78' },
  { id: 'graphite', name: 'Graphite', price: 1200, tint: '#40454d' },
  { id: 'opal', name: 'Opal Sheen', price: 4000, tint: '#a9c9e6', iridescent: true, rare: true },
  { id: 'aurora', name: 'Aurora Sheen', price: 6500, tint: '#7fd0c0', iridescent: true, rare: true },
]

export const PATTERNS = [
  { id: 'none', name: 'Plain', price: 0 },
  { id: 'barred', name: 'Barred', price: 500 },
  { id: 'spotted', name: 'Spotted', price: 700 },
  { id: 'streaked', name: 'Streaked', price: 800 },
  { id: 'scaled', name: 'Scalloped', price: 1000 },
]

export const TRAILS = [
  { id: 'none', name: 'None', price: 0, color: null },
  { id: 'contrail', name: 'Contrail', price: 800, color: '#ffffff' },
  { id: 'sky', name: 'Sky Ribbon', price: 1200, color: '#7ec8ff' },
  { id: 'gold', name: 'Gold Dust', price: 1800, color: '#f0cf8a' },
  { id: 'rose', name: 'Sunset Streak', price: 2000, color: '#ff9a7a' },
  { id: 'mint', name: 'Mint Wake', price: 2200, color: '#8ff0c8' },
]

export const BADGES = [
  { id: 'none', name: 'None', price: 0 },
  { id: 'wings', name: 'Wings', price: 300 },
  { id: 'compass', name: 'Compass Rose', price: 500 },
  { id: 'star', name: 'Naija Star', price: 700 },
  { id: 'crown', name: 'Crest', price: 1500 },
  { id: 'laurel', name: 'Laurel', price: 1800 },
]

export const ACCESSORIES = [
  { id: 'none', name: 'None', price: 0 },
  { id: 'harness', name: 'Flight harness', price: 700, color: '#142a4d' },
  { id: 'band', name: 'Leg band', price: 300, color: '#cfd6e0' },
  { id: 'scarf', name: 'Silk scarf', price: 900, color: '#e7f1ff' },
  { id: 'scarfred', name: 'Signal scarf', price: 900, color: '#e8604c' },
  { id: 'both', name: 'Harness and band', price: 1000, color: '#142a4d' },
]

export const HABITATS = [
  { id: 'coast', name: 'Gurara Falls', price: 0, hour: 13, lm: 'salt_bay_light', alt: 150, pos: [-1450, 0, 880], blurb: 'Mist and green hills over the falls.' },
  { id: 'alpine', name: 'Zuma Rock at dawn', price: 1500, hour: 7.1, lm: 'crown_peak', alt: 90, pos: [1500, 0, -1500], blurb: 'Cool air and first light over the great rock.' },
  { id: 'dune', name: 'Sahel sunset', price: 2200, hour: 17.6, lm: 'mirage_flats', alt: 170, pos: [-300, 0, -2000], blurb: 'Warm thermals under a low red sun.' },
  { id: 'night', name: 'Abuja night lights', price: 2800, hour: 21.6, lm: 'meridian_city', alt: 330, pitch: 0.42, pos: [-1450, 0, 880], blurb: 'The capital glowing from above.' },
]
