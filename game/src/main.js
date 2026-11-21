// SUNSET KEYS — Port Alba. One job: run the game — the loop, the state
// machine, and every system talking to every other one.

import { WORLD, TUNING, CAR_MODELS } from './config.js';
import { makeRng, hashSeed, clamp } from './random.js';
import { buildWorld, resolveCircle, randomRoadPoint } from './world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { makeCar, spawnTraffic, updateTraffic, separateCars, stepCar } from './vehicles.js';
import { makePlayer as makePlayerFn, spawnPeds, updatePlayerOnFoot, updatePed } from './people.js';
import { Wanted, Police } from './police.js';
import { MissionManager, FareManager, MISSIONS, HIDDEN_KEYS } from './missions.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor(canvas, hudRoot) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(hudRoot);
    this.input = new Input();
    this.audio = new AudioSys();
    this.state = 'menu';
    this.time = 0;
    this.clock = 0;
    this.day = 1;
    this.cash = TUNING.startCash;
    this.keysFound = 0;
    this.missionsCompleted = 0;
    this.frozen = false;
    this.shotMode = null;
    this._saveTimer = 0;
    this._fareTimer = 18;
    this._lastDamage = 0;
    this._frame = 0;
  }

  init(seed, shot) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.world = buildWorld(seed);
    this.player = makePlayerFn(1160, 1060);
    this.traffic = spawnTraffic(this.world, this.rng, TUNING.trafficCount);
    this.parked = this._spawnParked();
    this.peds = spawnPeds(this.world, this.rng, TUNING.pedCount);
    this.police = new Police();
    this.wanted = new Wanted();
    this.missions = new MissionManager();
    this.fares = new FareManager();
    this.hiddenKeys = HIDDEN_KEYS.map((k) => ({ ...k }));
    this.input.attach(this.canvas);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.load();
    if (shot) this._setupShot(shot);
    // The title menu shows for real players and for the start screenshot;
    // gameplay shots hide it so the game itself is what the camera sees.
    if (!shot || shot === 'start') this.hud.showMenu('start', this);
    else this.hud.hideMenu();
    this.hud.update(this);
  }

  _resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  _spawnParked() {
    const cars = [];
    for (const lot of this.world.parking) {
      const n = Math.min(3, lot.bays);
      for (let i = 0; i < n; i++) {
        const x = lot.x0 + 34 + i * 60;
        const y = lot.y0 + 23;
        const modelIndex = this.rng.int(0, CAR_MODELS.length - 2);
        const car = makeCar(x, y, 0, modelIndex, { kind: 'parked' });
        cars.push(car);
      }
    }
    return cars;
  }

  // --- save / load ---------------------------------------------------------

  save() {
    try {
      const data = {
        cash: this.cash,
        keysFound: this.keysFound,
        missionsCompleted: this.missionsCompleted,
        day: this.day,
        keys: this.hiddenKeys.map((k) => (k.found ? 1 : 0)),
      };
      localStorage.setItem(TUNING.saveKey, JSON.stringify(data));
    } catch {
      // Storage unavailable (private mode): play on without saving.
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(TUNING.saveKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.cash === 'number') this.cash = Math.max(0, data.cash);
      if (typeof data.keysFound === 'number') this.keysFound = data.keysFound;
      if (typeof data.missionsCompleted === 'number') this.missionsCompleted = Math.min(7, data.missionsCompleted);
      if (typeof data.day === 'number') this.day = data.day;
      if (Array.isArray(data.keys)) {
        data.keys.forEach((v, i) => {
          if (v && this.hiddenKeys[i]) this.hiddenKeys[i].found = true;
        });
      }
    } catch {
      // Corrupt save: start fresh.
    }
  }

  // --- derived views the renderer and HUD ask for ---------------------------

  playerScreenX() {
    return this.player.x - this.renderer.cam.x + this.canvas.width / 2;
  }

  playerScreenY() {
    return this.player.y - this.renderer.cam.y + this.canvas.height / 2;
  }

  allCars() {
    const cars = [...this.traffic, ...this.parked, ...this.police.cars];
    if (this.player.inCar) cars.push(this.player.inCar);
    return cars;
  }

  currentMarker() {
    if (this.missions.active) return this.missions.objective();
    const f = this.fares.marker();
    if (f) return f;
    return null;
  }

  // --- state transitions ----------------------------------------------------

  startGame() {
    this.audio.unlock();
    this.state = 'playing';
    this.hud.hideMenu();
    if (this.missions.index === -1 && this.missionsCompleted < MISSIONS.length) {
      this.missions.start(this.missionsCompleted);
      if (this.missions.index === 3) this.wanted.add(40);
    }
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showMenu('pause', this);
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.hideMenu();
  }

  busted() {
    this.state = 'busted';
    const bail = Math.min(this.cash, 200);
    this.cash -= bail;
    this.wanted.clear();
    this.police.clear();
    if (this.player.inCar) {
      this.player.inCar = null;
    }
    this.player.health = TUNING.playerHealth;
    this.player.x = 1160;
    this.player.y = 1060;
    this.audio.setSiren(false);
    this.hud.showMenu('busted', this);
    this.save();
  }

  wasted() {
    this.state = 'wasted';
    const fee = Math.min(this.cash, 150);
    this.cash -= fee;
    if (this.player.inCar) this.player.inCar = null;
    this.player.health = TUNING.playerHealth;
    this.player.x = 2080;
    this.player.y = 660;
    this.wanted.clear();
    this.police.clear();
    this.audio.setSiren(false);
    this.hud.showMenu('wasted', this);
    this.save();
  }

  // --- the loop --------------------------------------------------------------

  run() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!this.frozen) this.update(dt);
      this.renderer.draw(this);
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  update(dt) {
    this._frame++;
    this.time += dt;
    this.clock += dt;
    if (this.clock >= 3600) {
      this.clock = 0;
      this.day++;
    }
    if (this.input.wasPressed('mute')) {
      this.audio.setMuted(!this.audio.muted);
    }
    if (this.state === 'menu') {
      // Slow cinematic pan over Downtown for the title screen.
      const t = this.time * 0.05;
      this.renderer.cam.x = 1900 + Math.sin(t) * 500;
      this.renderer.cam.y = 500 + Math.cos(t * 0.7) * 160;
      if (this.input.wasPressed('action') || this.input.mouse.clicked) this.startGame();
      this.renderer.updateParticles(dt);
      return;
    }
    if (this.state === 'paused') {
      if (this.input.wasPressed('pause') || this.input.wasPressed('action')) this.resumeGame();
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted' || this.state === 'complete') {
      if (this.input.wasPressed('action') || this.input.mouse.clicked) {
        if (this.state === 'complete') {
          this.state = 'playing';
          this.hud.hideMenu();
        } else {
          this.startGame();
        }
      }
      return;
    }
    // Playing.
    if (this.input.wasPressed('pause')) {
      this.pauseGame();
      return;
    }
    this._updatePlaying(dt);
  }

  _updatePlaying(dt) {
    const p = this.player;
    // --- player ------------------------------------------------------------
    if (p.inCar) {
      const axis = this.input.axis();
      const drive = this._autoDrive
        ? { throttle: this._autoDrive.throttle, steer: this._autoDrive.steer, brake: this._autoDrive.brake }
        : {
            throttle: axis.y !== 0 ? -axis.y : 0,
            steer: axis.x,
            brake: this.input.held('brake'),
          };
      const wasSpeed = Math.abs(p.inCar.speed);
      const crashed = stepCar(this.world, p.inCar, drive, dt);
      // The player rides in the car: their position is the car's position.
      p.x = p.inCar.x;
      p.y = p.inCar.y;
      p.angle = p.inCar.angle;
      if (crashed) {
        this.audio.crash(Math.min(1, wasSpeed / 400));
        this.renderer.shake = 0.7;
        this.renderer.burst(p.inCar.x, p.inCar.y, '#ffb14d', 10, 120);
        p.health -= wasSpeed * 0.02;
        this._lastDamage = this.time;
        if (this._autoDrive) this._autoDrive.steer = -this._autoDrive.steer;
        if (p.inCar.health <= 0) this._wreckCar(p.inCar);
      }
      if (this.input.held('horn') && p.inCar) {
        p.inCar.honk = 0.2;
        if (Math.random() < 0.05) this.audio.blip(330);
      }
      if (p.inCar && p.inCar.skid > 0.3 && Math.abs(p.inCar.speed) > 240) {
        this.renderer.skidMark(p.inCar.x, p.inCar.y, p.inCar.angle);
      }
      if (p.inCar && this.input.wasPressed('enter')) this._exitCar();
      if (p.inCar) this.audio.setEngine(Math.abs(p.inCar.speed) / TUNING.carMaxSpeed, true);
      else this.audio.setEngine(0, false);
    } else {
      const ev = updatePlayerOnFoot(this.world, p, this.input, dt, this.peds);
      if (ev === 'punched') this.audio.punch();
      if (this.input.wasPressed('enter')) this._tryEnterCar();
      this.audio.setEngine(0, false);
      // Slow health regen out of trouble.
      if (this.time - this._lastDamage > 5 && p.health < TUNING.playerHealth) {
        p.health = Math.min(TUNING.playerHealth, p.health + 2 * dt);
      }
    }

    // --- traffic, peds, police ----------------------------------------------
    for (const car of this.traffic) updateTraffic(this.world, car, dt, this.rng);
    for (const car of this.parked) {
      // Parked cars do not move.
    }
    separateCars(this.allCars());
    this._carPedCollisions(dt);
    const threats = this.allCars().filter((c) => Math.abs(c.speed) > 120);
    if (p.inCar) threats.push(p.inCar);
    for (const ped of this.peds) updatePed(this.world, ped, dt, this.rng, threats);
    this.police.update(this.world, dt, this.rng, { x: p.x, y: p.y, vx: p.inCar ? Math.cos(p.inCar.angle) * p.inCar.speed : 0, vy: p.inCar ? Math.sin(p.inCar.angle) * p.inCar.speed : 0 }, !!p.inCar, this.wanted);
    this.wanted.update(dt, this.police.anyNear);
    this.audio.setSiren(this.police.cars.length > 0 && this.wanted.stars > 0);

    // --- paint shop: drive in, pay, lose the heat, fix the car -------------
    const shop = this.world.landmarks.paintShop;
    if (p.inCar && Math.hypot(p.x - shop.x, p.y - shop.y) < 70 && (this.wanted.stars > 0 || p.inCar.health < 100)) {
      if (this.cash >= TUNING.repairCost) {
        this.cash -= TUNING.repairCost;
        this.wanted.clear();
        p.inCar.health = 100;
        this.audio.missionDone();
        this.missions.say('Fresh paint, clean record. -$150');
      }
    }

    // --- missions, fares, keys ----------------------------------------------
    const mev = this.missions.update(dt, { x: p.x, y: p.y }, this.wanted.stars);
    if (mev === 'mission-done') {
      const m = this.missions.mission;
      this.cash += m.reward;
      this.missionsCompleted++;
      this.audio.missionDone();
      this.missions.say(`${m.title} complete! +$${m.reward}`);
      this.save();
      if (this.missionsCompleted >= MISSIONS.length) {
        this.state = 'complete';
        this.hud.showMenu('complete', this);
      }
    } else if (mev === 'mission-failed') {
      this.audio.crash(0.4);
    }
    if (this.missions.done && this.input.wasPressed('action')) {
      this.missions.start(this.missionsCompleted);
      if (this.missions.index === 3) this.wanted.add(40);
    }
    // Taxi fares appear while free-roaming.
    if (!this.missions.active && this.fares.state === 'idle') {
      this._fareTimer -= dt;
      if (this._fareTimer <= 0) {
        this._fareTimer = 30;
        this.fares.offer(this.rng);
        if (this.fares.state !== 'idle') this.missions.say('Taxi fare nearby — pick them up! ($' + this.fares.reward + ')');
      }
    }
    const fev = this.fares.update(dt, { x: p.x, y: p.y }, !!p.inCar);
    if (fev && typeof fev === 'object' && fev.type === 'fare-done') {
      this.cash += fev.pay;
      this.audio.coin();
      this.missions.say(`Fare delivered! +$${fev.pay}`);
      this.save();
    } else if (fev === 'fare-picked') {
      this.audio.blip(990);
    }
    // Hidden keys.
    for (const k of this.hiddenKeys) {
      if (!k.found && Math.hypot(p.x - k.x, p.y - k.y) < 40) {
        k.found = true;
        this.keysFound++;
        this.cash += 100;
        this.audio.coin();
        this.missions.say(`Sunset key found! +$100 (${this.keysFound}/8)`);
        this.renderer.burst(k.x, k.y, '#ffd650', 16, 140);
        this.save();
      }
    }

    // --- busted / wasted ------------------------------------------------------
    if (this.wanted.bust >= 1) {
      this.busted();
      return;
    }
    if (p.health <= 0) {
      this.wasted();
      return;
    }

    // --- camera + particles ---------------------------------------------------
    const vx = p.inCar ? Math.cos(p.inCar.angle) * p.inCar.speed : 0;
    const vy = p.inCar ? Math.sin(p.inCar.angle) * p.inCar.speed : 0;
    this.renderer.follow(p.x, p.y, vx, vy, dt);
    this.renderer.updateParticles(dt);
    this._saveTimer += dt;
    if (this._saveTimer > 5) {
      this._saveTimer = 0;
      this.save();
    }
    this.hud.update(this);
  }

  _tryEnterCar() {
    const p = this.player;
    let best = null;
    let bestD = 52 * 52;
    for (const car of [...this.traffic, ...this.parked]) {
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return;
    const wasTraffic = this.traffic.includes(best);
    const wasParked = this.parked.includes(best);
    if (wasTraffic) this.traffic.splice(this.traffic.indexOf(best), 1);
    if (wasParked) this.parked.splice(this.parked.indexOf(best), 1);
    best.kind = 'player';
    p.inCar = best;
    p.angle = best.angle;
    this.audio.blip(520);
    // Stealing a car the city can see is a crime.
    if (wasTraffic && Math.abs(best.speed) > 30) {
      if (this.wanted.add(25)) this.audio.wantedUp();
      this.missions.say('Grand theft auto! The PD noticed.');
    } else if (wasParked) {
      if (this.wanted.add(10)) this.audio.wantedUp();
    }
  }

  _exitCar() {
    const p = this.player;
    const car = p.inCar;
    if (!car) return;
    p.inCar = null;
    const a = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(a) * 34;
    p.y = car.y + Math.sin(a) * 34;
    const probe = { x: p.x, y: p.y };
    resolveCircle(this.world, probe, TUNING.playerRadius);
    p.x = probe.x;
    p.y = probe.y;
    car.kind = 'traffic';
    car.speed = 0;
    car.target = null;
    this.traffic.push(car);
  }

  _wreckCar(car) {
    this.renderer.burst(car.x, car.y, '#888888', 24, 200);
    this.renderer.burst(car.x, car.y, '#ff7a2c', 16, 160);
    this.audio.crash(1);
    this.renderer.shake = 1;
    if (this.player.inCar === car) {
      this.player.inCar = null;
      this.player.x = car.x + 40;
      this.player.y = car.y;
      this.player.health -= 15;
      this._lastDamage = this.time;
    }
    this.traffic = this.traffic.filter((c) => c !== car);
    this.parked = this.parked.filter((c) => c !== car);
    this.police.cars = this.police.cars.filter((c) => c !== car);
  }

  _carPedCollisions(dt) {
    const p = this.player;
    const cars = this.allCars();
    for (const ped of this.peds) {
      if (ped.knocked) {
        ped.knocked -= dt;
        continue;
      }
      for (const car of cars) {
        if (Math.abs(car.speed) < 40) continue;
        const dx = ped.x - car.x;
        const dy = ped.y - car.y;
        if (dx * dx + dy * dy < 30 * 30) {
          ped.knocked = 2.2;
          ped.flee = 3;
          ped.scared = 3;
          this.renderer.burst(ped.x, ped.y, '#ff5a5a', 10, 120);
          this.audio.crash(0.5);
          this.renderer.shake = 0.5;
          if (car === p.inCar) {
            if (this.wanted.add(20)) this.audio.wantedUp();
            this.missions.say('You hit a pedestrian! The PD is coming.');
          }
          break;
        }
      }
    }
    // A traffic car hitting the player on foot.
    if (!p.inCar) {
      if (p.invuln > 0) p.invuln -= dt;
      for (const car of this.traffic) {
        if (Math.abs(car.speed) < 60) continue;
        const dx = p.x - car.x;
        const dy = p.y - car.y;
        if (dx * dx + dy * dy < 30 * 30) {
          if (p.invuln > 0) break;
          p.invuln = 0.9;
          p.health -= 12;
          this._lastDamage = this.time;
          p.x += (dx / 30) * 40;
          p.y += (dy / 30) * 40;
          this.renderer.shake = 0.8;
          this.audio.crash(0.6);
          break;
        }
      }
    }
  }

  // --- screenshot presets ------------------------------------------------------

  _setupShot(shot) {
    this.shotMode = shot;
    const rng = this.rng;
    if (shot === 'start') {
      // Title screen over Downtown; the menu does the rest.
      this.state = 'menu';
      window.__shotReady = true;
      return;
    }
    // Every other shot plays the game, then freezes after fixed steps.
    this.state = 'playing';
    this.hud.hideMenu();
    if (shot === 'drive') {
      const car = makeCar(2080, 620, 0, 1, { kind: 'player' });
      this.player.inCar = car;
      this.player.x = 2080;
      this.player.y = 620;
      this.player.angle = 0;
      this.renderer.cam.x = 2080;
      this.renderer.cam.y = 620;
      this.missions.start(0);
      this._autoDrive = { throttle: 1, steer: 0, brake: false, steps: 150 };
    } else if (shot === 'chase') {
      const car = makeCar(1620, 1020, -Math.PI / 2, 0, { kind: 'player' });
      this.player.inCar = car;
      this.player.x = 1620;
      this.player.y = 1020;
      this.player.angle = -Math.PI / 2;
      this.wanted.add(60);
      for (let i = 0; i < 3; i++) {
        const a = rng.range(0, Math.PI * 2);
        const pc = makeCar(1620 + Math.cos(a) * 460, 1020 + Math.sin(a) * 460, a, 6, { kind: 'police', color: '#20242e' });
        pc.speed = 300;
        this.police.cars.push(pc);
      }
      this.renderer.cam.x = 1620;
      this.renderer.cam.y = 1020;
      this._autoDrive = { throttle: 1, steer: 0, brake: false, steps: 90 };
    } else if (shot === 'mission') {
      const car = makeCar(1160, 700, Math.PI / 2, 2, { kind: 'player' });
      this.player.inCar = car;
      this.player.x = 1160;
      this.player.y = 700;
      this.player.angle = Math.PI / 2;
      this.missions.start(1);
      this.renderer.cam.x = 1160;
      this.renderer.cam.y = 700;
      this._autoDrive = { throttle: 0.6, steer: 0, brake: false, steps: 90 };
    }
    // Run the fixed steps now, synchronously, then freeze the frame.
    if (this._autoDrive) {
      const steps = this._autoDrive.steps;
      const dt = 1 / 60;
      for (let i = 0; i < steps; i++) {
        this.update(dt);
      }
      // Snap the camera onto the player so the frozen frame is centred.
      this.renderer.cam.x = clamp(this.player.x, this.canvas.width / 2, WORLD.w - this.canvas.width / 2);
      this.renderer.cam.y = clamp(this.player.y, this.canvas.height / 2, WORLD.h - this.canvas.height / 2);
      this.frozen = true;
    }
    window.__shotReady = true;
  }
}

// Boot: index.html creates the game.
export function boot() {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const shot = params.get('shot');
  const canvas = $('game');
  const game = new Game(canvas, document.body);
  game.init(hashSeed('port-alba-' + seed), shot);
  game.run();
  window.__game = game;
  return game;
}
