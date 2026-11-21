// People on foot. One job: the player walking and the pedestrians who
// fill the sidewalks — and who run away when a car comes at them.

import { TUNING, PED_SHIRTS } from './config.js';
import { clamp, angleTo, dist2 } from './random.js';
import { resolveCircle, randomSidewalkPoint, onRoad } from './world.js';

let nextPedId = 1;

export function makePlayer(x, y) {
  return {
    id: 0,
    kind: 'player',
    x,
    y,
    angle: -Math.PI / 2,
    speed: 0,
    health: TUNING.playerHealth,
    inCar: null,
    shirt: '#e8452c',
    walkPhase: 0,
    punchTimer: 0,
    punchHit: false,
    invuln: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    id: nextPedId++,
    kind: 'ped',
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    shirt: rng.pick(PED_SHIRTS),
    target: null,
    flee: 0,
    walkPhase: rng.range(0, 6),
    scared: 0,
  };
}

export function spawnPeds(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPoint(rng);
    peds.push(makePed(p.x, p.y, rng));
  }
  return peds;
}

function pickPedTarget(ped, rng) {
  const p = randomSidewalkPoint(rng);
  ped.target = p;
}

// The player on foot. Returns an event string when something notable
// happens ('punched'), else null.
export function updatePlayerOnFoot(world, player, input, dt, peds) {
  const axis = input.axis();
  const running = input.held('run');
  const speed = running ? TUNING.playerRun : TUNING.playerWalk;
  const len = Math.hypot(axis.x, axis.y);
  if (len > 0.01) {
    const nx = axis.x / len;
    const ny = axis.y / len;
    player.x += nx * speed * dt;
    player.y += ny * speed * dt;
    player.angle = Math.atan2(ny, nx);
    player.speed = speed;
    player.walkPhase += dt * (running ? 14 : 9);
  } else {
    player.speed = 0;
  }
  const probe = { x: player.x, y: player.y };
  resolveCircle(world, probe, TUNING.playerRadius);
  player.x = probe.x;
  player.y = probe.y;

  // Punch: a short arc in front of the player that scares peds.
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (input.wasPressed('punch') && player.punchTimer <= 0) {
    player.punchTimer = 0.45;
    player.punchHit = false;
    const px = player.x + Math.cos(player.angle) * 30;
    const py = player.y + Math.sin(player.angle) * 30;
    for (const ped of peds) {
      if (dist2(px, py, ped.x, ped.y) < 34 * 34) {
        ped.flee = 2.5;
        ped.scared = 2.5;
        ped.target = null;
      }
    }
    return 'punched';
  }
  return null;
}

export function updatePed(world, ped, dt, rng, threats) {
  // Threats: fast cars and the punching player. Flee from the nearest.
  let threat = null;
  let threatD = 170 * 170;
  for (const t of threats) {
    const d = dist2(ped.x, ped.y, t.x, t.y);
    if (d < threatD) {
      threatD = d;
      threat = t;
    }
  }
  let tx;
  let ty;
  let spd = TUNING.pedWalk;
  if (threat) {
    ped.flee = 1.2;
    const away = angleTo(threat.x, threat.y, ped.x, ped.y);
    tx = ped.x + Math.cos(away) * 200;
    ty = ped.y + Math.sin(away) * 200;
    spd = TUNING.pedWalk * 2.1;
    ped.scared = Math.max(ped.scared, 0.5);
  } else {
    if (ped.flee > 0) ped.flee -= dt;
    if (!ped.target || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 30 * 30) {
      pickPedTarget(ped, rng);
    }
    tx = ped.target.x;
    ty = ped.target.y;
  }
  const want = angleTo(ped.x, ped.y, tx, ty);
  // Turn smoothly toward the target, then walk.
  let da = want - ped.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  ped.angle += clamp(da, -4 * dt, 4 * dt);
  ped.x += Math.cos(ped.angle) * spd * dt;
  ped.y += Math.sin(ped.angle) * spd * dt;
  ped.walkPhase += dt * (spd / 12);
  ped.scared = Math.max(0, ped.scared - dt);
  const probe = { x: ped.x, y: ped.y };
  resolveCircle(world, probe, 10);
  ped.x = probe.x;
  ped.y = probe.y;
  // Keep peds off the road centre: they cross, they do not live there.
  if (onRoad(ped.x, ped.y) && !threat) {
    ped.target = null;
  }
}
