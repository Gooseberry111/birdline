import { MISSIONS } from './missions'

export const ACH = [
  { id: 'first', name: 'First flight', desc: 'Finish a mission', reward: 100, test: (p) => p.stats.missions >= 1 },
  { id: 'perfect', name: 'Butter landing', desc: 'Make a perfect landing', reward: 150, test: (p) => p.stats.perfect >= 1 },
  { id: 'landings', name: 'Safe hands', desc: 'Land 10 times', reward: 200, test: (p) => p.stats.landings >= 10 },
  { id: 'coins', name: 'Coin collector', desc: 'Collect 100 coins', reward: 200, test: (p) => p.stats.coins >= 100 },
  { id: 'coins2', name: 'Coin hoarder', desc: 'Collect 500 coins', reward: 500, test: (p) => p.stats.coins >= 500 },
  { id: 'five', name: 'Frequent flyer', desc: 'Finish 5 missions', reward: 300, test: (p) => p.stats.missions >= 5 },
  { id: 'explorer', name: 'Abuja explorer', desc: 'Discover 10 landmarks', reward: 250, test: (p) => p.discovered.length >= 10 },
  { id: 'streak', name: 'Daily pilot', desc: 'Fly three days in a row', reward: 400, test: (p) => p.daily.streak >= 3 },
  { id: 'legend', name: 'FlyBird legend', desc: 'Finish every mission', reward: 1500, test: (p) => Object.keys(p.missions.done).length >= MISSIONS.length },
]
