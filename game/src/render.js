// Rendering. One job: draw the whole game — the sunset city, the cars and
// people in it, the particles, and the minimap — onto one canvas.

import { WORLD, ROADS_X, ROADS_Y, ROAD_HALF, PALETTE, SUN } from './config.js';
import { districtAt, inWater } from './world.js';
import { clamp, lerp } from './random.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: WORLD.w / 2, y: WORLD.h / 2, zoom: 1 };
    this.shake = 0;
    this.particles = [];
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 3 });
    }
  }

  skidMark(x, y, angle) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.8, max: 0.8, color: 'rgba(20,20,24,0.55)', size: 5, skid: true, angle });
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  // Camera follows the player with a look-ahead in the direction of travel.
  follow(px, py, vx, vy, dt) {
    const tx = clamp(px + vx * 0.22, this.canvas.width / 2, WORLD.w - this.canvas.width / 2);
    const ty = clamp(py + vy * 0.22, this.canvas.height / 2, WORLD.h - this.canvas.height / 2);
    const k = 1 - Math.pow(0.001, dt);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);
  }

  draw(game) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 8 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 8 : 0;
    this.shake = Math.max(0, this.shake - 0.03);
    const camX = this.cam.x - W / 2 + shakeX;
    const camY = this.cam.y - H / 2 + shakeY;

    // Sunset sky wash at the edges of the screen.
    const sky = ctx.createLinearGradient(0, 0, W, H);
    sky.addColorStop(0, 'rgba(255,158,94,0.20)');
    sky.addColorStop(0.5, 'rgba(255,122,77,0.05)');
    sky.addColorStop(1, 'rgba(122,90,158,0.16)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-camX, -camY);
    this._drawGround(game, camX, camY, W, H);
    this._drawRoads(game, camX, camY, W, H);
    this._drawParks(game);
    this._drawBuildings(game);
    this._drawDocks(game);
    this._drawProps(game);
    this._drawMarkers(game);
    this._drawCars(game);
    this._drawPeople(game);
    this._drawParticles();
    ctx.restore();

    this._drawVignette(W, H);
    this._drawMinimap(game, W, H);
  }

  _inView(x, y, camX, camY, W, H, pad = 120) {
    return x > camX - pad && x < camX + W + pad && y > camY - pad && y < camY + H + pad;
  }

  _drawGround(game, camX, camY, W, H) {
    const { ctx } = this;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(camX - 40, camY - 40, W + 80, H + 80);
    // Mow stripes for texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    const x0 = Math.floor((camX - 40) / stripe) * stripe;
    const y0 = Math.floor((camY - 40) / stripe) * stripe;
    for (let x = x0; x < camX + W + 80; x += stripe * 2) {
      for (let y = y0; y < camY + H + 80; y += stripe * 2) {
        ctx.fillRect(x, y, stripe, stripe);
      }
    }
    // The sea, west edge, with a moving shimmer. Only the strip x < 120 is water.
    const t = game.time * 0.6;
    const seaX0 = Math.max(camX - 40, 0);
    const seaX1 = Math.min(camX + W + 80, 120);
    if (seaX1 > seaX0) {
      ctx.fillStyle = PALETTE.waterDeep;
      ctx.fillRect(seaX0, camY - 40, seaX1 - seaX0, H + 80);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(seaX0, camY - 40, Math.max(0, Math.min(seaX1, 105) - seaX0), H + 80);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let y = Math.floor((camY - 40) / 46) * 46; y < camY + H + 80; y += 46) {
        const wob = Math.sin(y * 0.05 + t) * 8;
        ctx.beginPath();
        ctx.moveTo(20 + wob, y);
        ctx.lineTo(105 + wob, y);
        ctx.stroke();
      }
    }
    // Sand strip along the shore.
    const sandX0 = Math.max(camX - 40, 120);
    const sandX1 = Math.min(camX + W + 80, 166);
    if (sandX1 > sandX0) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(sandX0, camY - 40, sandX1 - sandX0, H + 80);
    }
  }

  _drawRoads(game, camX, camY, W, H) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF, camY - 40, ROAD_HALF * 2, H + 80);
    for (const ry of ROADS_Y) ctx.fillRect(camX - 40, ry - ROAD_HALF, W + 80, ROAD_HALF * 2);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = Math.floor((camY - 40) / 56) * 56; y < camY + H + 80; y += 56) {
        ctx.fillRect(rx - 2, y, 4, 28);
      }
    }
    for (const ry of ROADS_Y) {
      for (let x = Math.floor((camX - 40) / 56) * 56; x < camX + W + 80; x += 56) {
        ctx.fillRect(x, ry - 2, 28, 4);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(232,232,232,0.75)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(rx + i * 9 - 3, ry - ROAD_HALF - 2, 6, 8);
          ctx.fillRect(rx + i * 9 - 3, ry + ROAD_HALF - 6, 6, 8);
        }
      }
    }
  }

  _drawParks(game) {
    const { ctx } = this;
    for (const p of game.world.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x0 + 4, p.y0 + 4, p.x1 - p.x0 - 8, p.y1 - p.y0 - 8);
    }
    for (const p of game.world.plazas) {
      ctx.fillStyle = PALETTE.plaza;
      ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    }
    for (const p of game.world.parking) {
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      ctx.strokeStyle = 'rgba(232,232,232,0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < p.bays; i++) {
        const x = p.x0 + 12 + i * 60;
        ctx.strokeRect(x, p.y0 + 10, 44, 26);
      }
    }
  }

  _drawBuildings(game) {
    const { ctx } = this;
    for (const b of game.world.buildings) {
      // Long sunset shadow to the east.
      ctx.fillStyle = 'rgba(30,20,30,0.28)';
      ctx.fillRect(b.x + SUN.dx * SUN.len, b.y + SUN.dy * SUN.len + b.height * 0.4, b.w, b.h);
      // Walls.
      ctx.fillStyle = '#5a4638';
      ctx.fillRect(b.x + 4, b.y + 6, b.w, b.h);
      // Roof.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Rooftop detail: a darker inset and an AC box.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 6, 16, 12);
      // Lit windows catch the sunset on tall towers.
      if (b.height > 24) {
        ctx.fillStyle = 'rgba(255,214,120,0.85)';
        for (let wy = b.y + 14; wy < b.y + b.h - 10; wy += 18) {
          for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 20) {
            if ((wx * 7 + wy * 13) % 5 < 2) ctx.fillRect(wx, wy, 8, 6);
          }
        }
      }
    }
  }

  _drawDocks(game) {
    const { ctx } = this;
    for (const d of game.world.docks) {
      ctx.fillStyle = 'rgba(30,20,30,0.28)';
      ctx.fillRect(d.x + 10, d.y + 8, d.w, d.h);
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(d.x + (d.w / 4) * i, d.y);
        ctx.lineTo(d.x + (d.w / 4) * i, d.y + d.h);
        ctx.stroke();
      }
    }
  }

  _drawProps(game) {
    const { ctx } = this;
    for (const t of game.world.trees) {
      ctx.fillStyle = 'rgba(30,20,30,0.25)';
      ctx.beginPath();
      ctx.arc(t.x + 6, t.y + 7, t.palm ? 12 : 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? '#3f8a4f' : '#2f6b34';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.palm ? 11 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b4a2c';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    }
    ctx.fillStyle = '#3a3a40';
    for (const l of game.world.lamps) {
      ctx.beginPath();
      ctx.arc(l.x, l.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawMarkers(game) {
    const { ctx } = this;
    const m = game.currentMarker();
    if (!m || m.x === null) return;
    const bob = Math.sin(game.time * 4) * 6;
    const pulse = 1 + Math.sin(game.time * 4) * 0.12;
    ctx.save();
    ctx.translate(m.x, m.y + bob);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255,214,80,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-12, -26);
    ctx.lineTo(0, -18);
    ctx.lineTo(12, -26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a4d00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,214,80,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.stroke();
    // A guide arrow at the screen edge when the marker is off screen.
    const px = game.playerScreenX();
    const py = game.playerScreenY();
    const dx = m.x - game.player.x;
    const dy = m.y - game.player.y;
    const d = Math.hypot(dx, dy);
    if (d > 520) {
      const a = Math.atan2(dy, dx);
      const ax = px + Math.cos(a) * 130;
      const ay = py + Math.sin(a) * 130;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(255,214,80,0.95)';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  _drawCarShape(car) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(20,12,20,0.35)';
    ctx.beginPath();
    ctx.ellipse(4, 6, car.model.len / 2 + 2, car.model.wid / 2 + 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    this._roundRect(-car.model.len / 2, -car.model.wid / 2, car.model.len, car.model.wid, 8);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,24,34,0.85)';
    this._roundRect(-car.model.len / 6, -car.model.wid / 2 + 4, car.model.len / 3, car.model.wid - 8, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    this._roundRect(car.model.len / 6, -car.model.wid / 2 + 4, 6, car.model.wid - 8, 2);
    ctx.fill();
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.model.len / 2 - 3, -car.model.wid / 2 + 3, 3, 5);
    ctx.fillRect(car.model.len / 2 - 3, car.model.wid / 2 - 8, 3, 5);
    // Police light bar.
    if (car.kind === 'police') {
      const on = Math.sin(car.sirenPhase) > 0;
      ctx.fillStyle = on ? '#ff2c2c' : '#2c6fff';
      ctx.fillRect(-6, -car.model.wid / 2 - 2, 7, 5);
      ctx.fillStyle = on ? '#2c6fff' : '#ff2c2c';
      ctx.fillRect(-6, car.model.wid / 2 - 3, 7, 5);
    }
    // Damage smoke.
    if (car.health < 45) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(-car.model.len / 2 + 4, 0, 4 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _roundRect(x, y, w, h, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _drawCars(game) {
    for (const car of game.allCars()) this._drawCarShape(car);
  }

  _drawPeople(game) {
    const { ctx } = this;
    const drawPed = (p, isPlayer) => {
      // Shadow.
      ctx.fillStyle = 'rgba(20,12,20,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x + 3, p.y + 4, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body with a walk bob.
      const bob = Math.sin(p.walkPhase) * 2;
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob * 0.3, isPlayer ? 11 : 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Head.
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3 + bob * 0.3, 5, 0, Math.PI * 2);
      ctx.fill();
      // Cop hat.
      if (p.kind === 'cop') {
        ctx.fillStyle = '#20242e';
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob * 0.3, 10, Math.PI, 0);
        ctx.fill();
      }
      // Punch swing.
      if (isPlayer && p.punchTimer > 0.2) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26);
        ctx.stroke();
      }
    };
    for (const ped of game.peds) drawPed(ped, false);
    for (const cop of game.police.cops) drawPed(cop, false);
    if (!game.player.inCar) drawPed(game.player, true);
  }

  _drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      if (p.skid) {
        ctx.save();
        ctx.globalAlpha = a * 0.8;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-6, -2, 12, 4);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawVignette(W, H) {
    const { ctx } = this;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(40,10,30,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  _drawMinimap(game, W, H) {
    const { ctx } = this;
    const mw = 168;
    const mh = Math.round((168 * WORLD.h) / WORLD.w);
    const mx = W - mw - 14;
    const my = 14;
    const sx = mw / WORLD.w;
    const sy = mh / WORLD.h;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(16,18,28,0.85)';
    this._roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.strokeStyle = '#ff9e5e';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Water + land.
    ctx.fillStyle = '#2a6f9e';
    ctx.fillRect(mx, my, 120 * sx, mh);
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(mx + 120 * sx, my, mw - 120 * sx, mh);
    // Roads.
    ctx.strokeStyle = '#c9c9c9';
    ctx.lineWidth = 1.5;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    // Objective marker.
    const m = game.currentMarker();
    if (m && m.x !== null) {
      const pulse = 3 + Math.sin(game.time * 5) * 1.5;
      ctx.fillStyle = '#ffd650';
      ctx.beginPath();
      ctx.arc(mx + m.x * sx, my + m.y * sy, pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#4f8cff';
    for (const c of game.police.cars) {
      ctx.beginPath();
      ctx.arc(mx + c.x * sx, my + c.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = mx + game.player.x * sx;
    const py = my + game.player.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(game.player.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // District label.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(districtAt(game.player.x, game.player.y).name, mx, my + mh + 16);
    ctx.restore();
  }
}
