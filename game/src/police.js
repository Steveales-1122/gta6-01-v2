// The law. One job: the wanted level, and the police who answer it —
// patrol cars that chase and ram, foot cops who chase and brawl, and the
// bust meter that ends a run when it fills.

import { TUNING, WORLD } from './config.js';
import { clamp, angleTo, angleDelta, dist2 } from './random.js';
import { makeCar, stepCar } from './vehicles.js';
import { randomRoadPoint } from './world.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.heat = 0; // 0..100; stars = ceil(heat / 20), capped at 5
    this.hiddenTimer = 0;
    this.bust = 0; // 0..1; fills while a cop is on top of the player
  }

  add(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
    const stars = Math.min(5, Math.ceil(this.heat / 20));
    const rose = stars > this.stars;
    this.stars = stars;
    this.hiddenTimer = 0;
    return rose;
  }

  // Heat cools only while no police can see the player.
  update(dt, policeNear) {
    if (this.stars === 0) {
      this.bust = 0;
      return;
    }
    if (policeNear) {
      this.hiddenTimer = 0;
    } else {
      this.hiddenTimer += dt;
      if (this.hiddenTimer > 4) {
        this.heat -= TUNING.wantedDecayPerSec * 10 * dt;
        if (this.heat <= 0) {
          this.heat = 0;
          this.stars = 0;
        } else {
          this.stars = Math.min(5, Math.ceil(this.heat / 20));
        }
      }
    }
  }

  clear() {
    this.stars = 0;
    this.heat = 0;
    this.bust = 0;
    this.hiddenTimer = 0;
  }
}

export class Police {
  constructor() {
    this.cars = [];
    this.cops = [];
    this.spawnTimer = 0;
  }

  get count() {
    return this.cars.length + this.cops.length;
  }

  get anyNear() {
    return this._near;
  }

  clear() {
    this.cars = [];
    this.cops = [];
    this.spawnTimer = 0;
    this._near = false;
  }

  // How many police the wanted level asks for.
  wantedCount(stars) {
    return stars <= 0 ? 0 : stars === 1 ? 1 : stars === 2 ? 2 : stars === 3 ? 3 : stars === 4 ? 4 : 6;
  }

  update(world, dt, rng, playerPos, playerInCar, wanted) {
    const want = this.wantedCount(wanted.stars);
    this.spawnTimer -= dt;
    if (this.count < want && this.spawnTimer <= 0) {
      this.spawnTimer = 1.1;
      this._spawn(world, rng, playerPos, wanted.stars);
    }
    if (this.count > want + 2) {
      // Too many: retire the farthest.
      let far = null;
      let farD = -1;
      for (const c of this.cars) {
        const d = dist2(c.x, c.y, playerPos.x, playerPos.y);
        if (d > farD) {
          farD = d;
          far = c;
        }
      }
      if (far) this.cars.splice(this.cars.indexOf(far), 1);
    }

    this._near = false;
    // Police cars chase the player's position with a little prediction.
    for (const car of this.cars) {
      const d = Math.hypot(playerPos.x - car.x, playerPos.y - car.y);
      if (d < 560) this._near = true;
      const px = playerPos.x + (playerPos.vx || 0) * 0.35;
      const py = playerPos.y + (playerPos.vy || 0) * 0.35;
      const wantAngle = Math.atan2(py - car.y, px - car.x);
      const steer = clamp(angleDelta(car.angle, wantAngle) * 2.2, -1, 1);
      const drive = { throttle: d > 90 ? 1 : 0.4, steer, brake: false };
      stepCar(world, car, drive, dt);
      car.sirenPhase += dt * 9;
    }
    // Foot cops run the player down and brawl.
    for (const cop of this.cops) {
      const d = Math.hypot(playerPos.x - cop.x, playerPos.y - cop.y);
      if (d < 560) this._near = true;
      const wantAngle = Math.atan2(playerPos.y - cop.y, playerPos.x - cop.x);
      cop.angle = wantAngle;
      const spd = playerInCar ? TUNING.policeFootSpeed * 0.7 : TUNING.policeFootSpeed;
      cop.x += Math.cos(wantAngle) * spd * dt;
      cop.y += Math.sin(wantAngle) * spd * dt;
      cop.walkPhase += dt * 12;
      if (d > 900) cop.dead = true;
    }
    this.cops = this.cops.filter((c) => !c.dead);
    // A foot cop next to the player fills the bust meter.
    let touching = false;
    for (const cop of this.cops) {
      if (Math.hypot(cop.x - playerPos.x, cop.y - playerPos.y) < 34) touching = true;
    }
    for (const car of this.cars) {
      if (Math.hypot(car.x - playerPos.x, car.y - playerPos.y) < 52) touching = true;
    }
    if (touching && wanted.stars > 0) {
      wanted.bust = clamp(wanted.bust + dt / TUNING.bustSeconds, 0, 1);
    } else {
      wanted.bust = Math.max(0, wanted.bust - dt * 0.4);
    }
  }

  _spawn(world, rng, playerPos, stars) {
    // Spawn at a road point 500-800 px away, off the player's screen.
    let p = null;
    for (let i = 0; i < 8; i++) {
      const cand = randomRoadPoint(rng);
      const d = Math.hypot(cand.x - playerPos.x, cand.y - playerPos.y);
      if (d > 480 && d < 900) {
        p = cand;
        break;
      }
    }
    if (!p) p = { x: clamp(playerPos.x + 600, 60, WORLD.w - 60), y: clamp(playerPos.y, 60, WORLD.h - 60) };
    if (stars >= 2 && rng.chance(0.45)) {
      this.cops.push({
        kind: 'cop',
        x: p.x,
        y: p.y,
        angle: 0,
        walkPhase: 0,
        shirt: '#20242e',
        dead: false,
      });
    } else {
      const angle = angleTo(p.x, p.y, playerPos.x, playerPos.y);
      const car = makeCar(p.x, p.y, angle, 6, { kind: 'police', color: '#20242e' });
      car.speed = 200;
      this.cars.push(car);
    }
  }
}
