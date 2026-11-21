// SUNSET KEYS — Port Alba: shared constants and tuning.
// One job: every number the rest of the game agrees on lives here.

export const WORLD = { w: 3200, h: 2400 };

// Road centrelines. The city is a grid; the sea sits west of x = 160,
// the beach runs along the south-west shore.
export const ROADS_X = [240, 700, 1160, 1620, 2080, 2540, 2960];
export const ROADS_Y = [220, 620, 1020, 1420, 1820, 2180];
export const ROAD_HALF = 34; // half width of a road, in world px
export const BLOCK = 300; // nominal block size between roads

export const DISTRICTS = [
  { name: 'Marina', x0: 0, y0: 0, x1: 480, y1: 900, tint: '#2e6f8e' },
  { name: 'Old Town', x0: 480, y0: 0, x1: 1400, y1: 900, tint: '#c98a4b' },
  { name: 'Downtown', x0: 1400, y0: 0, x1: 3200, y1: 1100, tint: '#7a5a9e' },
  { name: 'Crosstown', x0: 0, y0: 900, x1: 1400, y1: 1400, tint: '#8a7a4b' },
  { name: 'Hills', x0: 1400, y0: 1100, x1: 3200, y1: 1700, tint: '#4b7a5a' },
  { name: 'Docks', x0: 0, y0: 1400, x1: 1200, y1: 2400, tint: '#5a6b52' },
  { name: 'Beachfront', x0: 1200, y0: 1400, x1: 3200, y1: 2400, tint: '#d9a05b' },
];

export const PALETTE = {
  grass: '#5d8a4a',
  grassDark: '#527c40',
  road: '#3a3a44',
  roadLine: '#e8d44f',
  sidewalk: '#9a938a',
  water: '#2a6f9e',
  waterDeep: '#1e5478',
  sand: '#e0c184',
  buildingRoof: '#8a6f5c',
  buildingRoof2: '#6f7f8a',
  buildingRoof3: '#a0714f',
  buildingEdge: '#4a3a30',
  park: '#4a7a3f',
  plaza: '#b0a894',
  sunsetSky: '#ff9e5e',
  dusk: '#ff7a4d',
};

// Sunset lighting: the sun sits low in the west, so shadows stretch east.
export const SUN = { dx: 0.55, dy: 0.28, len: 26 };

export const TUNING = {
  playerWalk: 170,
  playerRun: 265,
  playerRadius: 13,
  playerHealth: 100,
  carAccel: 340,
  carBrake: 520,
  carMaxSpeed: 560,
  carMaxReverse: 180,
  carTurn: 2.9,
  carGrip: 0.94,
  carRadius: 20,
  trafficSpeed: 150,
  trafficCount: 26,
  pedCount: 60,
  pedWalk: 55,
  policeCarSpeed: 520,
  policeFootSpeed: 185,
  wantedDecayPerSec: 0.55,
  wantedEscapeRadius: 620,
  bustSeconds: 2.2,
  repairCost: 150,
  startCash: 250,
  saveKey: 'sunset-keys-port-alba-v2',
};

export const CAR_MODELS = [
  { name: 'Sunset Coupe', len: 46, wid: 22, top: 300, color: '#e8452c' },
  { name: 'Alba Sedan', len: 48, wid: 22, top: 260, color: '#2c6fe8' },
  { name: 'Marina Taxi', len: 48, wid: 22, top: 280, color: '#f2c230' },
  { name: 'Dock Hauler', len: 56, wid: 24, top: 190, color: '#7a7f85' },
  { name: 'Hills SUV', len: 50, wid: 24, top: 240, color: '#3fae6a' },
  { name: 'Beach Buggy', len: 44, wid: 22, top: 320, color: '#ff7ab8' },
  { name: 'PD Interceptor', len: 48, wid: 22, top: 420, color: '#20242e' },
];

export const PED_SHIRTS = ['#e8e8e8', '#f2a541', '#5aa2e8', '#e85a7a', '#7ac74f', '#c96fe8', '#e8d44f'];

export const MISSION_REWARDS = [200, 350, 450, 500, 650, 800, 1500];

// Keys that do anything. Everything else is ignored.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  brake: ['Space'],
  punch: ['KeyF'],
  horn: ['KeyH'],
  mute: ['KeyM'],
  pause: ['KeyP', 'Escape'],
  action: ['Enter'],
};
