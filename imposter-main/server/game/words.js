export const WORDS = [
  'Waterfall','Library','Volcano','Telescope','Pineapple','Submarine','Skateboard','Airplane',
  'Moonlight','Birthday','Sandcastle','Fireworks','Rainforest','Astronaut','Chocolate','Lighthouse',
  'Keyboard','Mountain','Popcorn','Umbrella','Snowflake','Compass','Aquarium','Backpack',
  'Campfire','Dinosaur','Elevator','Festival','Guitar','Jungle','Kangaroo','Museum',
  'Orchestra','Pancake','Rainbow','Spaceship','Thunder','Violin','Windmill','Zebra'
];

export function chooseWord(random = Math.random) {
  return WORDS[Math.floor(random() * WORDS.length)];
}
