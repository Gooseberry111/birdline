// Weather presets. The engine blends toward these values when conditions change.
export const WEATHER = {
  clear: {
    name: 'Clear', fog: 0.00014, windScale: 0.6, turbulence: 0.05, rain: 0, cloud: 0.35, dark: 0,
    note: 'Normal conditions.',
  },
  wind: {
    name: 'Windy', fog: 0.00018, windScale: 1.5, turbulence: 0.18, rain: 0, cloud: 0.6, dark: 0.1,
    note: 'Headwinds and tailwinds change your ground speed.',
  },
  rain: {
    name: 'Rain', fog: 0.00075, windScale: 1.0, turbulence: 0.22, rain: 1, cloud: 0.9, dark: 0.35,
    note: 'Visibility reduced. Stay on your route.',
  },
  storm: {
    name: 'Storm', fog: 0.0011, windScale: 1.9, turbulence: 0.65, rain: 1.6, cloud: 1, dark: 0.6,
    note: 'Dangerous turbulence. Expect heavy buffeting.',
  },
  harmattan: {
    name: 'Harmattan', fog: 0.0009, windScale: 0.9, turbulence: 0.1, rain: 0, cloud: 0.1, dark: 0.12, dust: 1,
    note: 'Dry dusty haze from the Sahara. Low visibility, trust the arrow.',
  },
  fog: {
    name: 'Fog', fog: 0.0026, windScale: 0.3, turbulence: 0.04, rain: 0, cloud: 0.5, dark: 0.1,
    note: 'Very low visibility. Trust the waypoint markers.',
  },
}
