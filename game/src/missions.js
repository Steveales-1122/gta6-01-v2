// Missions and side work. One job: the Sunset Keys story — seven missions
// in order — plus taxi fares and the hidden keys, all as data the game
// steps through.

import { WORLD } from './config.js';

function L(name) {
  return name;
}

// Mission stages. Types:
//   goto    — reach a point (radius)
//   pickup  — reach a point, pick something up
//   deliver — reach a point while carrying
//   escape  — get the wanted level down to zero
//   race    — pass checkpoints in order before the clock runs out
//   collect — reach every listed point
export const MISSIONS = [
  {
    id: 'welcome',
    title: 'Welcome to Port Alba',
    briefing: 'Mara is waiting at the marina. Drive over and say hello — the city is yours now.',
    reward: 200,
    stages: [
      { type: 'goto', x: 330, y: 300, radius: 70, label: 'Meet Mara at the Marina' },
    ],
  },
  {
    id: 'keys',
    title: 'Keys to the City',
    briefing: 'A package is waiting in Old Town. Pick it up and take it to the Downtown tower.',
    reward: 350,
    stages: [
      { type: 'pickup', x: 1160, y: 620, radius: 60, label: 'Pick up the package in Old Town' },
      { type: 'deliver', x: 2080, y: 220, radius: 70, label: 'Deliver it to the Downtown tower' },
    ],
  },
  {
    id: 'taxi',
    title: 'Taxi Days',
    briefing: 'The meter is running. Three fares, three corners of the city — no scratches.',
    reward: 450,
    stages: [
      { type: 'pickup', x: 1620, y: 1020, radius: 60, label: 'Pick up fare 1 — Hills' },
      { type: 'deliver', x: 700, y: 1820, radius: 70, label: 'Drop fare 1 at the Docks' },
      { type: 'pickup', x: 2540, y: 620, radius: 60, label: 'Pick up fare 2 — Downtown' },
      { type: 'deliver', x: 1620, y: 2180, radius: 70, label: 'Drop fare 2 at Beachfront' },
      { type: 'pickup', x: 1160, y: 1820, radius: 60, label: 'Pick up fare 3 — Docks' },
      { type: 'deliver', x: 330, y: 300, radius: 70, label: 'Drop fare 3 at the Marina' },
    ],
  },
  {
    id: 'pursuit',
    title: 'Hot Pursuit',
    briefing: 'That was loud. The PD is on you — lose them, all of them, and stay clean.',
    reward: 500,
    stages: [
      { type: 'escape', label: 'Lose the cops — get your wanted level to zero' },
    ],
  },
  {
    id: 'dockside',
    title: 'Dockside Deal',
    briefing: 'Crates at the Docks Gate, then the buyer at the stadium. The PD watches the docks — keep it quiet.',
    reward: 650,
    stages: [
      { type: 'pickup', x: 700, y: 2050, radius: 60, label: 'Pick up the crates at the Docks Gate' },
      { type: 'deliver', x: 2540, y: 1820, radius: 70, label: 'Deliver to the Sunset Bowl' },
    ],
  },
  {
    id: 'sunset-run',
    title: 'Sunset Run',
    briefing: 'Five checkpoints, one sunset, no brakes. Beat the clock and the city is talking about you.',
    reward: 800,
    stages: [
      {
        type: 'race',
        timeLimit: 95,
        checkpoints: [
          { x: 240, y: 220 },
          { x: 1620, y: 220 },
          { x: 2960, y: 1020 },
          { x: 2080, y: 2180 },
          { x: 700, y: 2180 },
        ],
        label: 'Race the checkpoints',
      },
    ],
  },
  {
    id: 'finale',
    title: 'Sunset Keys',
    briefing: 'Three keys, three corners of Alba, then the lighthouse at the edge of the world. Bring them home.',
    reward: 1500,
    stages: [
      {
        type: 'collect',
        points: [
          { x: 330, y: 300, label: 'Marina key' },
          { x: 2540, y: 620, label: 'Downtown key' },
          { x: 1620, y: 2180, label: 'Beachfront key' },
        ],
        label: 'Collect the three Sunset Keys',
      },
      { type: 'goto', x: 150, y: 2250, radius: 80, label: 'Reach the Lighthouse' },
    ],
  },
];

// Hidden sunset keys scattered around free roam: $100 each.
export const HIDDEN_KEYS = [
  { x: 240, y: 1420, found: false },
  { x: 1160, y: 220, found: false },
  { x: 2960, y: 620, found: false },
  { x: 700, y: 1020, found: false },
  { x: 2080, y: 1420, found: false },
  { x: 2540, y: 220, found: false },
  { x: 1620, y: 620, found: false },
  { x: 1160, y: 2180, found: false },
];

export class MissionManager {
  constructor() {
    this.index = -1; // -1: no mission yet
    this.stage = 0;
    this.active = false;
    this.done = false;
    this.failed = false;
    this.timer = 0;
    this.carrying = false;
    this.collected = [];
    this.checkpoint = 0;
    this.message = '';
    this.messageTimer = 0;
  }

  get mission() {
    return this.index >= 0 && this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }

  get stageDef() {
    const m = this.mission;
    if (!m || !this.active) return null;
    return m.stages[this.stage] || null;
  }

  start(index) {
    this.index = index;
    this.stage = 0;
    this.active = true;
    this.done = false;
    this.failed = false;
    this.timer = 0;
    this.carrying = false;
    this.collected = [];
    this.checkpoint = 0;
    const m = this.mission;
    this.say(m.title + ' — ' + m.briefing);
    const s = this.stageDef;
    if (s && s.type === 'race') this.timer = s.timeLimit;
  }

  say(text) {
    this.message = text;
    this.messageTimer = 6;
  }

  // Advance one stage. Returns 'mission-done' when the last stage ends.
  _advance() {
    this.stage++;
    this.carrying = false;
    const m = this.mission;
    if (this.stage >= m.stages.length) {
      this.active = false;
      this.done = true;
      return 'mission-done';
    }
    const s = this.stageDef;
    if (s.type === 'race') this.timer = s.timeLimit;
    return 'stage-done';
  }

  // The current objective as a marker: {x, y, radius, label} or null.
  objective() {
    const s = this.stageDef;
    if (!s) return null;
    if (s.type === 'escape') return { x: null, y: null, radius: 0, label: s.label };
    if (s.type === 'race') {
      const cp = s.checkpoints[this.checkpoint];
      return { x: cp.x, y: cp.y, radius: 70, label: `${s.label} — ${this.checkpoint + 1}/${s.checkpoints.length} (${Math.ceil(this.timer)}s)` };
    }
    if (s.type === 'collect') {
      const next = s.points.find((p) => !this.collected.includes(p.label));
      if (!next) return { x: null, y: null, radius: 0, label: s.label };
      return { x: next.x, y: next.y, radius: 60, label: `${s.label} — ${this.collected.length}/${s.points.length}` };
    }
    return { x: s.x, y: s.y, radius: s.radius, label: s.label };
  }

  // Called every frame with the player's state. Returns an event or null.
  update(dt, playerPos, wantedStars) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (!this.active) return null;
    const s = this.stageDef;
    if (!s) return null;
    if (s.type === 'race') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.active = false;
        this.failed = true;
        this.say('Out of time — the Sunset Run slipped away. Try again from the pause menu.');
        return 'mission-failed';
      }
    }
    if (s.type === 'escape') {
      if (wantedStars === 0) return this._advance();
      return null;
    }
    if (s.type === 'race') {
      const cp = s.checkpoints[this.checkpoint];
      const d = Math.hypot(playerPos.x - cp.x, playerPos.y - cp.y);
      if (d < 70) {
        this.checkpoint++;
        if (this.checkpoint >= s.checkpoints.length) return this._advance();
        this.say(`Checkpoint ${this.checkpoint}/${s.checkpoints.length}`);
      }
      return null;
    }
    if (s.type === 'collect') {
      const next = s.points.find((p) => !this.collected.includes(p.label));
      if (!next) return this._advance();
      const d = Math.hypot(playerPos.x - next.x, playerPos.y - next.y);
      if (d < 60) {
        this.collected.push(next.label);
        this.say(`${next.label} — ${this.collected.length}/${s.points.length}`);
      }
      return null;
    }
    const d = Math.hypot(playerPos.x - s.x, playerPos.y - s.y);
    if (d < s.radius) {
      if (s.type === 'pickup') {
        this.carrying = true;
        this.say('Picked up — now deliver it.');
      }
      return this._advance();
    }
    return null;
  }
}

// A roaming taxi fare: a ped waiting, then a destination. Pays on delivery.
export class FareManager {
  constructor() {
    this.state = 'idle'; // idle | pickup | deliver
    this.pickup = null;
    this.dest = null;
    this.reward = 0;
    this.timer = 0;
  }

  offer(rng) {
    if (this.state !== 'idle') return;
    const spots = [
      { x: 700, y: 620 },
      { x: 1620, y: 1020 },
      { x: 2540, y: 1420 },
      { x: 1160, y: 1820 },
      { x: 2080, y: 220 },
      { x: 330, y: 1420 },
    ];
    this.pickup = rng.pick(spots);
    this.dest = rng.pick(spots.filter((s) => s !== this.pickup));
    this.reward = 120 + rng.int(0, 4) * 40;
    this.state = 'pickup';
    this.timer = 0;
  }

  update(dt, playerPos, inCar) {
    if (this.state === 'idle') return null;
    this.timer += dt;
    if (this.state === 'pickup') {
      if (Math.hypot(playerPos.x - this.pickup.x, playerPos.y - this.pickup.y) < 60) {
        if (!inCar) return 'need-car';
        this.state = 'deliver';
        return 'fare-picked';
      }
    } else if (Math.hypot(playerPos.x - this.dest.x, playerPos.y - this.dest.y) < 70) {
      const pay = this.reward;
      this.state = 'idle';
      this.pickup = null;
      this.dest = null;
      return { type: 'fare-done', pay };
    }
    if (this.timer > 120) {
      this.state = 'idle';
      return 'fare-expired';
    }
    return null;
  }

  marker() {
    if (this.state === 'pickup') return { x: this.pickup.x, y: this.pickup.y, radius: 60, label: `Taxi fare — pick up ($${this.reward})` };
    if (this.state === 'deliver') return { x: this.dest.x, y: this.dest.y, radius: 70, label: 'Taxi fare — drop off' };
    return null;
  }
}

export { L };
