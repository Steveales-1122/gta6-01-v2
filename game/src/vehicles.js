// Cars. One job: how a car moves, and how traffic drives itself around
// the city's roads.

import { TUNING, CAR_MODELS, ROADS_X, ROADS_Y } from './config.js';
import { clamp, angleDelta, dist2 } from './random.js';
import { resolveCircle, nearestIntersection, randomRoadPoint } from './world.js';

let nextCarId = 1;

export function makeCar(x, y, angle, modelIndex, opts = {}) {
  const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
  return {
    id: nextCarId++,
    kind: opts.kind || 'traffic',
    x,
    y,
    angle,
    speed: 0,
    steer: 0,
    model,
    color: opts.color || model.color,
    health: 100,
    // Traffic AI state.
    target: opts.target || null,
    wait: 0,
    // Police state.
    sirenPhase: Math.random() * Math.PI * 2,
    // Cosmetic.
    skid: 0,
    honk: 0,
  };
}

export function carCorners(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hl = car.model.len / 2;
  const hw = car.model.wid / 2;
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
  ];
}

// Drive one step. `drive` is {throttle -1..1, steer -1..1, brake bool}.
// Returns true when the car scraped something solid.
export function stepCar(world, car, drive, dt) {
  const grip = TUNING.carGrip;
  const maxFwd = car.kind === 'police' ? TUNING.policeCarSpeed : car.model.top;
  if (drive.brake) {
    car.speed -= Math.sign(car.speed) * TUNING.carBrake * dt;
    if (Math.abs(car.speed) < 12) car.speed = 0;
  } else if (drive.throttle !== 0) {
    const accel = drive.throttle > 0 ? TUNING.carAccel : TUNING.carAccel * 0.8;
    car.speed += drive.throttle * accel * dt;
  } else {
    car.speed *= Math.pow(0.4, dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -TUNING.carMaxReverse, maxFwd);
  // Steering only bites while moving; faster = wider turn.
  const spd = Math.abs(car.speed);
  const turnRate = TUNING.carTurn * clamp(spd / 220, 0.25, 1);
  car.angle += drive.steer * turnRate * Math.sign(car.speed || 1) * dt;
  car.angle = ((car.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const probe = { x: nx, y: ny };
  const hit = resolveCircle(world, probe, TUNING.carRadius);
  car.x = probe.x;
  car.y = probe.y;
  if (hit) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    car.health -= impact * 0.02;
    car.skid = 1;
    return impact > 60;
  }
  car.skid = Math.max(0, car.skid - dt * 2);
  return false;
}

// --- traffic ---------------------------------------------------------------

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rng);
    const modelIndex = rng.int(0, CAR_MODELS.length - 2); // never a police car
    const car = makeCar(p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), modelIndex);
    car.speed = rng.range(60, TUNING.trafficSpeed);
    pickTrafficTarget(car, rng);
    cars.push(car);
  }
  return cars;
}

function pickTrafficTarget(car, rng) {
  const cur = nearestIntersection(car.x, car.y);
  const opts = [];
  for (const rx of ROADS_X) {
    if (Math.abs(rx - cur.x) < 1 && Math.abs(0 - 0) < 1) continue;
    if (Math.abs(rx - cur.x) < 1) opts.push({ x: rx, y: rng.pick(ROADS_Y) });
  }
  for (const ry of ROADS_Y) {
    if (Math.abs(ry - cur.y) < 1) opts.push({ x: rng.pick(ROADS_X), y: ry });
  }
  // Prefer a target on the same road (no diagonal shortcuts).
  const sameRoad = opts.filter((o) => Math.abs(o.x - cur.x) < 1 || Math.abs(o.y - cur.y) < 1);
  car.target = (sameRoad.length ? rng.pick(sameRoad) : rng.pick(opts)) || cur;
}

// Steer a traffic car toward its waypoint, then pick a new one.
export function updateTraffic(world, car, dt, rng) {
  if (!car.target) pickTrafficTarget(car, rng);
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) {
    pickTrafficTarget(car, rng);
    return;
  }
  const want = Math.atan2(dy, dx);
  const steer = clamp(angleDelta(car.angle, want) * 1.6, -1, 1);
  const drive = { throttle: 0.55, steer, brake: false };
  // Slow down for a car right ahead.
  car._slow = false;
  stepCar(world, car, drive, dt);
}

// Simple car-vs-car separation so traffic does not stack.
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const d2 = dist2(a.x, a.y, b.x, b.y);
      const min = 44;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}
