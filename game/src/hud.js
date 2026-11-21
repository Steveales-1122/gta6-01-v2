// The HUD and the menus. One job: everything the player reads on screen
// that is not drawn on the canvas — cash, wanted stars, health, objectives,
// and the start, pause, busted and wasted screens.

export class Hud {
  constructor(root) {
    this.root = root;
    this.el = {};
    for (const id of ['cash', 'stars', 'health', 'healthbar-fill', 'speed', 'objective', 'toast', 'clock', 'menu', 'menu-title', 'menu-body', 'menu-hint']) {
      this.el[id] = root.querySelector('#' + id);
    }
    this._last = {};
  }

  _set(key, value) {
    if (this._last[key] !== value) {
      this._last[key] = value;
      this.el[key].textContent = value;
    }
  }

  update(game) {
    const p = game.player;
    this._set('cash', '$' + game.cash.toLocaleString('en-US'));
    const stars = '★'.repeat(game.wanted.stars) + '☆'.repeat(5 - game.wanted.stars);
    this._set('stars', stars);
    this.el.stars.className = game.wanted.stars > 0 ? 'stars hot' : 'stars';
    const hp = Math.max(0, Math.round(p.health));
    this._set('health', hp + '');
    this.el['healthbar-fill'].style.width = hp + '%';
    this.el['healthbar-fill'].className = hp < 30 ? 'fill low' : 'fill';
    const spd = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 0.18) : Math.round(p.speed * 0.18);
    this._set('speed', p.inCar ? spd + ' km/h' : 'on foot');
    const m = game.missions.mission;
    const obj = game.currentMarker();
    let objText = 'Free roam — explore Port Alba, E to steal a car, F to punch.';
    if (game.fares.state !== 'idle' && game.fares.marker()) objText = game.fares.marker().label;
    else if (m && game.missions.active && obj) objText = `${m.title}: ${obj.label}`;
    else if (m && game.missions.done) objText = `${m.title} complete! Press Enter for the next mission.`;
    this._set('objective', objText);
    const mins = Math.floor(game.clock / 60);
    const secs = Math.floor(game.clock % 60);
    this._set('clock', `Day ${game.day} · ${String(17 + mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} · Sunset`);
    if (game.missions.messageTimer > 0) {
      this._set('toast', game.missions.message);
      this.el.toast.classList.add('show');
    } else {
      this.el.toast.classList.remove('show');
    }
    // Bust meter.
    const bust = game.wanted.bust;
    this.root.querySelector('#bust').style.opacity = bust > 0.02 ? '1' : '0';
    this.root.querySelector('#bustfill').style.width = Math.round(bust * 100) + '%';
  }

  showMenu(kind, game) {
    const menu = this.el.menu;
    menu.classList.remove('hidden');
    const titles = {
      start: 'SUNSET KEYS',
      pause: 'PAUSED',
      busted: 'BUSTED',
      wasted: 'WASTED',
      complete: 'CITY COMPLETE',
    };
    this.el['menu-title'].textContent = titles[kind] || kind;
    if (kind === 'start') {
      this.el['menu-body'].innerHTML =
        'Port Alba, golden hour. Steal cars, outrun the PD, and run the Sunset Keys story — seven missions from the marina to the lighthouse.<br><br>' +
        '<b>WASD / arrows</b> move &amp; drive &nbsp;·&nbsp; <b>E</b> enter / exit car &nbsp;·&nbsp; <b>Space</b> handbrake<br>' +
        '<b>Shift</b> sprint &nbsp;·&nbsp; <b>F</b> punch &nbsp;·&nbsp; <b>H</b> horn &nbsp;·&nbsp; <b>M</b> mute &nbsp;·&nbsp; <b>P</b> pause<br><br>' +
        `Missions done: ${game.missionsCompleted} / 7 &nbsp;·&nbsp; Hidden keys: ${game.keysFound} / 8 &nbsp;·&nbsp; Cash: $${game.cash}`;
      this.el['menu-hint'].textContent = 'Press Enter or click to start';
    } else if (kind === 'pause') {
      this.el['menu-body'].innerHTML =
        `Cash $${game.cash} &nbsp;·&nbsp; Missions ${game.missionsCompleted} / 7 &nbsp;·&nbsp; Keys ${game.keysFound} / 8<br><br>` +
        'R — restart the current mission &nbsp;·&nbsp; N — skip to the next mission (forfeits the reward)';
      this.el['menu-hint'].textContent = 'Press P or Esc to resume';
    } else if (kind === 'busted') {
      this.el['menu-body'].innerHTML =
        'The Port Alba PD caught up with you. Bail is $200 — the story goes on, but the heat stays on your record.<br><br>' +
        `Cash $${game.cash}`;
      this.el['menu-hint'].textContent = 'Press Enter to get back out there';
    } else if (kind === 'wasted') {
      this.el['menu-body'].innerHTML =
        'Alba General patched you up for $150. Your car is gone, but the city is still yours.<br><br>' +
        `Cash $${game.cash}`;
      this.el['menu-hint'].textContent = 'Press Enter to walk out of the hospital';
    } else if (kind === 'complete') {
      this.el['menu-body'].innerHTML =
        'All seven missions done. Every key turned, every street yours — Port Alba belongs to you now.<br><br>' +
        `Final cash: $${game.cash} &nbsp;·&nbsp; Hidden keys: ${game.keysFound} / 8`;
      this.el['menu-hint'].textContent = 'Press Enter to keep roaming free';
    }
  }

  hideMenu() {
    this.el.menu.classList.add('hidden');
  }
}
