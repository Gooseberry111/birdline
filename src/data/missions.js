// A small story runs through the missions. Captain Adaeze runs FlyBird Airways out of Abuja
// and every job is a step toward getting the supplies through before the big rainy season storm.
export const CAPTAIN = 'Captain Adaeze'

export const MISSIONS = [
  {
    id: 'school', limit: 240, name: 'Flight School', level: 'Easy',
    blurb: 'Learn to take off, climb, steer through rings and land at Abuja Airport. Your first stop.',
    brief: "Welcome to FlyBird Airways, rookie! I am Captain Adaeze. Show me you can take off from Abuja, climb and fly the practice rings.",
    after: 'Well done! You are cleared for real jobs. First up, Abuja needs a parcel.',
    reward: { miles: 400, xp: 150 },
  },
  {
    id: 'tour', limit: 420, name: 'Abuja City Tour', level: 'Easy', hour: 15.5,
    blurb: 'Fly over the National Assembly, Eagle Square, the National Mosque, Millennium Tower, the stadium and the Christian Centre, then land.',
    brief: 'Visitors want to see our capital from the sky! Take them over the Three Arms Zone, the National Mosque, Millennium Tower and the stadium.',
    after: 'They loved it. Abuja looks even better from up here!',
    reward: { miles: 700, xp: 240 },
  },
  {
    id: 'express', limit: 300, name: 'Abuja Express', level: 'Easy',
    blurb: 'Collect a parcel at the terminal and deliver it to the top of Millennium Tower before time runs out.',
    brief: 'The radio team at Millennium Tower needs a part. Grab the parcel by the terminal and take it to the top of the tower, fast!',
    after: 'The tower is back online. We will need that radio for what is coming.',
    reward: { miles: 650, xp: 220 },
  },
  {
    id: 'thermal', limit: 360, name: 'Rising Air', level: 'Medium',
    blurb: 'Find a warm air column over the dry ground, circle inside it to climb to 700 metres, then glide home with almost no effort.',
    brief: 'Good pilots save their energy. The dry ground makes warm air columns. Ride one up to 700 metres and glide home.',
    after: 'Lovely soaring. Saving stamina will keep you going on the long routes.',
    reward: { miles: 600, xp: 220 },
  },
  {
    id: 'coast', limit: 300, name: 'Usuma Dam Run', level: 'Medium',
    blurb: 'Fly low over the green hills from Gurara Falls to Usuma Dam through a chain of rings. Keep the chain going for bonus miles.',
    brief: 'The rainy season storm is building. Race from Gurara Falls to Usuma Dam and check the marker rings before the weather turns.',
    after: 'Markers are good. The storm is closer than I thought.',
    reward: { miles: 800, xp: 260 },
  },
  {
    id: 'skim', limit: 300, name: 'River Niger Skimmer', level: 'Medium', hour: 11,
    blurb: 'Follow the River Niger and skim low over the water through a ring chain. Stay close to the river for coins.',
    brief: 'The river fishermen are cut off from the radio. Stay low over the River Niger and bring in their signal flags.',
    after: 'Low and fast. Nobody flies the river like you.',
    reward: { miles: 850, xp: 280 },
  },
  {
    id: 'safari', limit: 420, name: 'Naija Photo Tour', level: 'Medium', hour: 15.5,
    blurb: 'Visit four famous Nigerian landmarks and snap a photo at each before the clock ends.',
    brief: 'Visitors love our country! Fly to each landmark so we can photograph it for the tourism brochure.',
    after: 'Beautiful pictures. Bookings are through the roof!',
    reward: { miles: 900, xp: 300 },
  },
  {
    id: 'charter', limit: 480, name: 'Abuja to Minna Charter', level: 'Medium', hour: 10, apron: true,
    blurb: 'Board passengers at Abuja, taxi out, take off, land at Minna Airport and let them off. Smooth flying keeps them happy.',
    brief: 'VIP passengers are waiting at the Abuja terminal for Minna. Taxi out, fly them across and keep it gentle. No steep turns and a soft landing!',
    after: 'Five stars from every passenger. Smooth work!',
    reward: { miles: 1000, xp: 320 },
  },
  {
    id: 'summit', limit: 380, name: 'Zuma Rock Dash', level: 'Hard',
    blurb: 'Climb above Zuma Rock, then dive back toward Abuja through the valley rings.',
    brief: 'The weather station on Zuma Rock lost contact. Get above the rock to relay a signal, then dive home.',
    after: 'Signal received. The station says the storm will hit tonight.',
    reward: { miles: 1000, xp: 320 },
  },
  {
    id: 'rescue', limit: 360, name: 'Confluence Rescue', level: 'Hard', hour: 9,
    blurb: 'Find a stranded flyer where the Niger and Benue rivers meet and carry them to Minna Airport.',
    brief: 'A flyer is stranded where the Niger and Benue meet. Find the beacon, pick them up and land at Minna Airport. Easy does it!',
    after: 'Safe and sound. Everyone is heading to shelter.',
    reward: { miles: 1100, xp: 340 },
  },
  {
    id: 'night', limit: 420, name: 'Lokoja Night Mail', level: 'Hard', hour: 22.2,
    blurb: 'Deliver medicine across the dark sky and land at Lokoja Airstrip.',
    brief: 'Lokoja needs medicine before the storm cuts the roads. Fly the night route and land at the airport lights.',
    after: 'Delivered. Now hold on to your feathers.',
    reward: { miles: 1200, xp: 360 },
  },
  {
    id: 'cargo', limit: 480, name: 'Jos Cargo Haul', level: 'Hard', hour: 8.5, weather: 'harmattan', apron: true,
    blurb: 'Load heavy cargo, take off with a slow climb through the Harmattan haze, land at Jos Airport on the plateau and unload.',
    brief: 'Relief supplies for Jos. The Harmattan haze is thick and the crates are heavy, so plan your takeoff and use the whole runway.',
    after: 'The supplies have arrived. Thank you!',
    reward: { miles: 1400, xp: 400 },
  },
  {
    id: 'storm', limit: 420, name: 'Rainy Season Run', level: 'Expert', weather: 'storm', hour: 17.5,
    blurb: 'Fly the final route through the rainy season storm and land at Jos Airport. Expect heavy turbulence.',
    brief: 'This is it. One last flight through the storm to light the beacon at Jos. I believe in you!',
    after: 'The beacon is lit and the airports are safe. You are a FlyBird legend!',
    reward: { miles: 1800, xp: 500 },
  },
]
