// Port Alba itself. One job: build the city once from a seed and answer
// every spatial question the game asks — where the roads run, what blocks
// movement, where things can spawn.

import { WORLD, ROADS_X, ROADS_Y, ROAD_HALF, DISTRICTS, PALETTE } from './config.js';
import { makeRng, clamp } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

export function inWater(x, y) {
  // The sea hugs the west edge; the marina basin cuts in near the top.
  if (x < 120) return true;
  if (x < 300 && y < 420) return true;
  return false;
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const parking = [];
  const plazas = [];

  // Blocks are the cells between neighbouring roads. Each block gets a use.
  for (let ix = 0; ix < ROADS_X.length - 1; ix++) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy++) {
      const x0 = ROADS_X[ix] + ROAD_HALF + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_HALF - 14;
      const y0 = ROADS_Y[iy] + ROAD_HALF + 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // The marina basin and the beach stay open.
      if (inWater(cx, cy)) continue;
      const roll = rng.next();
      const d = districtAt(cx, cy);
      if (d.name === 'Beachfront' && iy >= 4) {
        // Beachfront blocks: sand, palms, a few low huts.
        for (let i = 0; i < 5; i++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), palm: true });
        }
        if (roll < 0.5) {
          buildings.push(makeBuilding(cx, cy, 70, 54, 8, '#c98a4b'));
        }
        continue;
      }
      if (roll < 0.16) {
        parks.push({ x0, y0, x1, y1 });
        for (let i = 0; i < 6; i++) {
          trees.push({ x: rng.range(x0 + 16, x1 - 16), y: rng.range(y0 + 16, y1 - 16), palm: false });
        }
        continue;
      }
      if (roll < 0.26) {
        plazas.push({ x0, y0, x1, y1 });
        continue;
      }
      if (roll < 0.36) {
        // Parking lot: open asphalt with marked bays.
        parking.push({ x0, y0, x1, y1, bays: Math.floor((x1 - x0) / 60) });
        continue;
      }
      // Built-up block: one or two buildings.
      const tall = d.name === 'Downtown';
      const n = tall ? 2 : rng.chance(0.6) ? 2 : 1;
      if (n === 1) {
        const w = Math.min(x1 - x0 - 24, rng.range(90, 170));
        const h = Math.min(y1 - y0 - 24, rng.range(70, 140));
        buildings.push(makeBuilding(cx, cy, w, h, tall ? rng.range(26, 60) : rng.range(8, 22), roofColor(rng)));
      } else {
        const w = (x1 - x0) / 2 - 30;
        const h = Math.min(y1 - y0 - 24, rng.range(70, 130));
        buildings.push(makeBuilding(x0 + w / 2 + 12, cy, w, h, tall ? rng.range(24, 54) : rng.range(8, 18), roofColor(rng)));
        buildings.push(makeBuilding(x1 - w / 2 - 12, cy, w, h, tall ? rng.range(24, 54) : rng.range(8, 18), roofColor(rng)));
      }
      // Street trees and lamps along the block edge.
      for (let i = 0; i < 3; i++) {
        trees.push({ x: rng.range(x0, x1), y: y0 + rng.range(4, 18), palm: d.name === 'Beachfront' });
      }
    }
  }

  // Lamps at every intersection corner.
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      lamps.push({ x: rx - ROAD_HALF - 6, y: ry - ROAD_HALF - 6 });
      lamps.push({ x: rx + ROAD_HALF + 6, y: ry + ROAD_HALF + 6 });
    }
  }

  // Docks: containers and cranes along the south-west shore.
  const docks = [];
  for (let i = 0; i < 8; i++) {
    docks.push({
      x: 180 + i * 110,
      y: 2050 + (i % 2) * 90,
      w: 86,
      h: 34,
      color: ['#b8542c', '#2c7ab8', '#4f9e4f', '#c9a12c'][i % 4],
    });
  }

  // Landmarks the missions use.
  const landmarks = {
    marina: { x: 330, y: 300, name: 'Marina' },
    lighthouse: { x: 150, y: 2250, name: 'Lighthouse' },
    paintShop: { x: 1160, y: 1020, name: 'Spray Shop' },
    hospital: { x: 2080, y: 620, name: 'Alba General' },
    stadium: { x: 2540, y: 1820, name: 'Sunset Bowl' },
    docksGate: { x: 700, y: 2050, name: 'Docks Gate' },
    downtown: { x: 2080, y: 620, name: 'Downtown' },
  };

  return {
    seed,
    buildings,
    trees,
    lamps,
    parks,
    parking,
    plazas,
    docks,
    landmarks,
    roadsX: ROADS_X,
    roadsY: ROADS_Y,
  };
}

function makeBuilding(x, y, w, h, height, roof) {
  return { x: x - w / 2, y: y - h / 2, w, h, height, roof };
}

function roofColor(rng) {
  return rng.pick([PALETTE.buildingRoof, PALETTE.buildingRoof2, PALETTE.buildingRoof3, '#7a5a6e']);
}

// --- collision and placement queries ---------------------------------------

export function circleHitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  for (const d of world.docks) {
    if (x + r > d.x && x - r < d.x + d.w && y + r > d.y && y - r < d.y + d.h) return d;
  }
  return null;
}

export function pointBlocked(world, x, y, r) {
  if (x < 20 || y < 20 || x > WORLD.w - 20 || y > WORLD.h - 20) return true;
  if (inWater(x, y)) return true;
  return circleHitsBuilding(world, x, y, r) !== null;
}

// Push a circle out of whatever it overlaps. Returns true when it moved.
export function resolveCircle(world, p, r) {
  let moved = false;
  p.x = clamp(p.x, 20 + r, WORLD.w - 20 - r);
  p.y = clamp(p.y, 20 + r, WORLD.h - 20 - r);
  const b = circleHitsBuilding(world, p.x, p.y, r);
  if (b) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const ox = b.w / 2 + r - Math.abs(dx);
    const oy = b.h / 2 + r - Math.abs(dy);
    if (ox < oy) p.x += dx >= 0 ? ox : -ox;
    else p.y += dy >= 0 ? oy : -oy;
    moved = true;
  }
  return moved;
}

// A random point on a road, for spawning traffic and peds.
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    const rx = rng.pick(ROADS_X);
    return { x: rx + rng.range(-ROAD_HALF + 8, ROAD_HALF - 8), y: rng.range(80, WORLD.h - 80) };
  }
  const ry = rng.pick(ROADS_Y);
  return { x: rng.range(80, WORLD.w - 80), y: ry + rng.range(-ROAD_HALF + 8, ROAD_HALF - 8) };
}

// A random sidewalk point: just off a road, on a block edge.
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const dx = rng.pick([-1, 1]) * (ROAD_HALF + 12);
  const dy = rng.pick([-1, 1]) * (ROAD_HALF + 12);
  if (rng.chance(0.5)) p.x = clamp(p.x + dx, 40, WORLD.w - 40);
  else p.y = clamp(p.y + dy, 40, WORLD.h - 40);
  return p;
}

// Nearest intersection to a point, for traffic routing.
export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y: ry };
      }
    }
  }
  return best;
}
