export const TUTORIAL = [
  { id: 'takeoff', keys: ['Space'], title: 'Take off', text: 'Hold Space to flap and run down the runway. You lift off by yourself once you reach speed.', touch: 'Push the left stick up to run down the runway. You lift off by yourself once you reach speed.' },
  { id: 'pitch', keys: ['W', 'S'], title: 'Climb and dive', text: 'Press S to climb and W to dive. Climbing costs speed, diving gains it.', touch: 'Tilt the top of the phone toward you to climb and away to dive, or use the left stick. Climbing costs speed, diving gains it.' },
  { id: 'bank', keys: ['A', 'D'], title: 'Bank and turn', text: 'Press A or D to bank. Hold longer for a tighter turn.', touch: 'Tilt your phone like a steering wheel, or move the left stick, to bank. Hold longer for a tighter turn.' },
  { id: 'boost', keys: ['Space', 'Shift'], title: 'Sprint', text: 'Hold Space and Shift together for a burst of speed. It drains Energy fast.', touch: 'Hold the Boost button for a burst of speed. It drains Energy fast.' },
  { id: 'glide', keys: [], title: 'Glide', text: 'Let go of every key for three seconds. Gliding recovers Energy, and warm air columns lift you.', touch: 'Let go of the stick and buttons for three seconds. Gliding recovers Energy, and warm air columns lift you.' },
  { id: 'ability', keys: ['Q'], title: 'Ability', text: 'Press Q to use your bird ability. The cooldown shows bottom left.', touch: 'Tap the ability button on the right to use your bird ability.' },
]

export const CONTROLS = [
  [['W'], 'Dive (nose down)'],
  [['S'], 'Climb (nose up)'],
  [['A', 'D'], 'Bank left and right'],
  [['Space'], 'Flap. Hold on the ground to take off'],
  [['Shift'], 'Sprint while flapping'],
  [['Ctrl'], 'Air brake'],
  [['Q', 'E'], 'Bird abilities'],
  [['F'], 'Cruise assist (auto flap)'],
  [['T'], 'Turn into a plane (easier landing) or back'],
  [['L'], 'Landing assist on or off'],
  [['C'], 'Change camera'],
  [['M'], 'Show or hide map'],
  [['H'], 'This card'],
  [['Esc'], 'Pause'],
]
