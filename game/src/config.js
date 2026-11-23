// config.js — all game constants and data tables

export const GAME = {
  seed: 42,
  shadowMapSize: 2048,
  shadowRange: 120,
  fogNear: 10,
  fogFar: 300,
  renderDistance: 350,
};

export const CITY = {
  seed: 1337,
  gridSize: 8,
  blockSize: 60,
  roadWidth: 12,
  sidewalkWidth: 3,
  curbHeight: 0.15,
  buildingMinHeight: 12,
  buildingMaxHeight: 80,
  laneWidth: 3.5,
};

export const PLAYER = {
  walkSpeed: 5,
  runSpeed: 9,
  height: 1.8,
  radius: 0.4,
  jumpForce: 7,
  health: 100,
  startCash: 0,
};

export const VEHICLE = {
  enterDistance: 3.5,
  maxSpeed: 35,
  acceleration: 18,
  braking: 25,
  steering: 2.2,
  drift: 0.88,
  handbrake: 0.5,
  topSpeedDrag: 0.92,
  collisionDamage: 0.08,
};

export const CAR_MODELS = [
  {
    id: 'sedan',
    name: 'Sedan',
    length: 4.5,
    width: 1.8,
    height: 1.4,
    mass: 1200,
    maxSpeed: 32,
    acceleration: 16,
    handling: 0.85,
    color: 0x3366cc,
  },
  {
    id: 'sports',
    name: 'Sports Car',
    length: 4.2,
    width: 1.9,
    height: 1.2,
    mass: 1100,
    maxSpeed: 45,
    acceleration: 25,
    handling: 0.92,
    color: 0xff3366,
  },
  {
    id: 'suv',
    name: 'SUV',
    length: 4.8,
    width: 2.0,
    height: 1.9,
    mass: 1800,
    maxSpeed: 28,
    acceleration: 14,
    handling: 0.75,
    color: 0x333333,
  },
  {
    id: 'taxi',
    name: 'Taxi',
    length: 4.5,
    width: 1.8,
    height: 1.5,
    mass: 1300,
    maxSpeed: 30,
    acceleration: 15,
    handling: 0.80,
    color: 0xffcc00,
  },
  {
    id: 'muscle',
    name: 'Muscle Car',
    length: 4.9,
    width: 1.9,
    height: 1.3,
    mass: 1500,
    maxSpeed: 40,
    acceleration: 22,
    handling: 0.78,
    color: 0x9933ff,
  },
];

export const POLICE_CAR = {
  id: 'police',
  name: 'Police Cruiser',
  length: 4.6,
  width: 1.85,
  height: 1.5,
  mass: 1400,
  maxSpeed: 38,
  acceleration: 20,
  handling: 0.88,
  color: 0x0066ff,
};

export const WANTED = {
  heatMax: 500,
  decayRate: 8,
  levelThresholds: [0, 50, 120, 220, 350, 500],
  crimes: {
    'speeding': 10,
    'hit_ped': 25,
    'hit_car': 15,
    'car_theft': 35,
    'assault': 30,
    'shoot': 40,
    'kill': 60,
  },
  spawnDelay: 3,
  pursuitRange: 100,
  bustRange: 2.5,
  bustTime: 3,
};

export const TRAFFIC = {
  count: 30,
  speedLimit: 15,
  following: 8,
  brakeDist: 12,
  spawnRange: 80,
};

export const PEDS = {
  count: 50,
  walkSpeed: 1.4,
  fleeSpeed: 4.5,
  fleeDistance: 20,
  spawnRange: 60,
};

export const COLORS = {
  sky: 0x87ceeb,
  fog: 0xb0c4de,
  sun: 0xfff8dc,
  ground: 0x2d5a3d,
  road: 0x333333,
  sidewalk: 0xcccccc,
  building: 0xf5f5dc,
  water: 0x1e90ff,
};

export const MISSIONS = [
  {
    id: 'intro',
    title: 'Welcome to Crimson Bay',
    description: 'Get familiar with the city. Steal a car and drive to the marker.',
    objectives: ['Steal a vehicle', 'Drive to the waypoint'],
    reward: 500,
  },
  {
    id: 'chase',
    title: 'High Speed Pursuit',
    description: 'Lose the cops in under 2 minutes.',
    objectives: ['Evade police pursuit'],
    reward: 1000,
  },
  {
    id: 'delivery',
    title: 'Special Delivery',
    description: 'Pick up the package and deliver it without attracting attention.',
    objectives: ['Pick up package', 'Deliver to drop point', 'Avoid wanted level'],
    reward: 1500,
  },
];
