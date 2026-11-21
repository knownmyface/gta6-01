// CORAL HEAT — HUD, minimap, menus, race UI (v2.9, fresh).
import { fmtCash, fmtTime, clamp } from './util.js';
import { MISSIONS } from './story.js';
import { MISSIONS2 } from './story2.js';
import { CIRCUITS } from './raceway.js';

export function setupHud(G) {
  const $ = (id) => document.getElementById(id);
  G.hud = {
    el: {
      cash: $('cash'), stars: $('stars'), speed: $('speed'), damage: $('damage'),
      weapons: $('weapons'), radio: $('radio'), objective: $('objective'),
      missionPanel: $('mission-panel'), minimap: $('minimap'),
      toast: $('toast'), prompt: $('prompt'), carjack: $('carjack-bar'),
      raceHud: $('race-hud'), banner: $('banner'),
      start: $('start-screen'), pause: $('pause-screen'),
      garagePanel: $('garage-panel'), racePanel: $('race-panel'),
      missionsPanel: $('missions-panel'), health: $('health'),
    },
    setCash(v) { this.el.cash.textContent = fmtCash(v); },
    setWanted(n) {
      this.el.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
      this.el.stars.style.color = n >= 4 ? '#ff3b30' : n >= 2 ? '#ffb347' : '#fff';
    },
    setSpeed(mph, label) {
      this.el.speed.innerHTML = '<b>' + Math.round(mph) + '</b><span>MPH ' + (label || '') + '</span>';
    },
    setHealth(h) {
      this.el.health.style.width = clamp(h, 0, 100) + '%';
      this.el.health.style.background = h > 50 ? '#37d67a' : h > 25 ? '#ffb347' : '#ff3b30';
    },
    setDamage(d) {
      this.el.damage.style.width = clamp(d, 0, 100) + '%';
    },
    setWeapons(list, active) {
      this.el.weapons.innerHTML = list.map((w, i) =>
        '<div class="wslot' + (i === active ? ' active' : '') + '"><b>' + (i + 1) + '</b> ' + w.name + ' <span>' + w.ammo + '</span></div>'
      ).join('');
    },
    setRadio(name) { this.el.radio.textContent = '♪ ' + name; },
    setObjective(text) { this.el.objective.textContent = text; },
    setMission(def, step) {
      if (!def) {
        this.el.missionPanel.innerHTML = '<h3>MISSIONS</h3><div class="m-sub">Press M for the mission list</div>';
        this.el.objective.textContent = 'Free roam — cause chaos or start a mission (M)';
        return;
      }
      const s = def.steps[step];
      this.el.missionPanel.innerHTML = '<h3>' + def.title + '</h3>' +
        '<div class="m-sub">' + def.giver + ' • Reward ' + fmtCash(def.reward) + '</div>' +
        '<div class="m-step">' + (step + 1) + '/' + def.steps.length + ' — ' + (s ? s.text : '') + '</div>' +
        '<div class="m-bar"><i id="m-progress" style="width:0%"></i></div>';
      this.el.objective.textContent = '◆ ' + (s ? s.text : '');
    },
    setMissionProgress(f) {
      const bar = document.getElementById('m-progress');
      if (bar) bar.style.width = Math.round(clamp(f, 0, 1) * 100) + '%';
    },
    setPrompt(text) {
      this.el.prompt.textContent = text;
      this.el.prompt.style.display = text ? 'block' : 'none';
    },
    setCarjack(f) {
      const bar = this.el.carjack;
      bar.style.display = f > 0 ? 'block' : 'none';
      bar.firstElementChild.style.width = Math.round(clamp(f, 0, 1) * 100) + '%';
    },
    toast(msg) {
      const t = this.el.toast;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
    },
    banner(text, sub) {
      const b = this.el.banner;
      b.innerHTML = '<b>' + text + '</b>' + (sub ? '<span>' + sub + '</span>' : '');
      b.classList.add('show');
      clearTimeout(this._bannerTimer);
      this._bannerTimer = setTimeout(() => b.classList.remove('show'), 2800);
    },
    showRace(race) {
      this.el.raceHud.style.display = 'block';
      this.el.raceHud.innerHTML = '<div class="r-title">' + race.circuit.name.toUpperCase() + '</div>' +
        '<div class="r-row">POS <b id="r-pos">4/4</b> &nbsp; LAP <b id="r-lap">1/' + race.circuit.laps + '</b></div>' +
        '<div class="r-row">TIME <b id="r-time">00:00.000</b> &nbsp; BEST <b id="r-best">' + fmtTime(race.bestMs) + '</b></div>' +
        '<div class="r-count" id="r-count">3</div>';
    },
    setCountdown(n) {
      const c = document.getElementById('r-count');
      if (c) c.textContent = n > 0 ? String(n) : 'GO!';
      if (c) c.style.display = n > 0 || n === 0 ? 'block' : 'none';
    },
    updateRaceHud(race, pos, entries) {
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      set('r-pos', pos + '/4');
      set('r-lap', race.lap + '/' + race.circuit.laps);
      set('r-time', fmtTime(G.time * 1000 - race.startMs));
      set('r-best', fmtTime(race.bestMs));
    },
    showRaceResult(race, pos, entries, reward) {
      const rows = entries.map((e, i) => '<div class="r-row">' + (i + 1) + '. ' + e.name + ' — ' + fmtTime(e.ms) + '</div>').join('');
      this.el.raceHud.innerHTML = '<div class="r-title">RACE FINISHED</div>' + rows +
        '<div class="r-row">You finished <b>P' + pos + '</b> — reward <b>' + fmtCash(reward) + '</b></div>' +
        '<div class="r-row">Best lap: ' + fmtTime(race.bestMs) + '</div>';
      if (pos === 1) G.lastRaceWin = true; else G.lastRaceLose = true;
    },
    toggleGarage(show) {
      const panel = this.el.garagePanel;
      if (show === undefined) show = panel.style.display !== 'block';
      panel.style.display = show ? 'block' : 'none';
      if (show) {
        import('./garage.js').then((g) => g.renderGaragePanel(G));
        G.paused = true;
      } else {
        G.paused = false;
      }
    },
    toggleMissions(show) {
      const panel = this.el.missionsPanel;
      if (show === undefined) show = panel.style.display !== 'block';
      panel.style.display = show ? 'block' : 'none';
      if (show) {
        const all = [...MISSIONS, ...MISSIONS2];
        panel.innerHTML = '<h2>STORY MISSIONS — 16</h2>' + all.map((m) => {
          const done = G.missionDone.includes(m.id);
          const active = G.mission && G.mission.def.id === m.id;
          return '<div class="g-row"><div><b>' + m.id + '. ' + m.title + '</b> <span class="g-sub">' + m.giver + ' • ' + fmtCash(m.reward) + '</span></div>' +
            (done ? '<span class="g-owned">DONE</span>' : active ? '<span class="g-owned">ACTIVE</span>' :
              '<button data-start-mission="' + m.id + '">Start</button>') + '</div>';
        }).join('') + '<div class="g-row"><button data-close-missions="1">Close [M]</button></div>';
        panel.querySelectorAll('[data-start-mission]').forEach((b) => b.onclick = () => {
          const id = parseInt(b.dataset.startMission, 10);
          const ok = id <= 12 ? G.story.start(id) : null;
          if (id > 12) import('./story2.js').then((s2) => s2.startMission2(G, id));
          if (ok !== false) this.toggleMissions(false);
        });
        panel.querySelectorAll('[data-close-missions]').forEach((b) => b.onclick = () => this.toggleMissions(false));
        G.paused = true;
      } else {
        G.paused = false;
      }
    },
    toggleRaceMenu(show) {
      const panel = this.el.racePanel;
      if (show === undefined) show = panel.style.display !== 'block';
      panel.style.display = show ? 'block' : 'none';
      if (show) {
        panel.innerHTML = '<h2>STREET RACES</h2>' + CIRCUITS.map((c, i) =>
          '<div class="g-row"><div><b>' + c.name + '</b><br><span class="g-sub">' + c.laps + ' laps • Reward ' + fmtCash(c.reward) +
          (G.bestLaps[c.id] ? ' • Best lap ' + fmtTime(G.bestLaps[c.id]) : '') + '</span></div>' +
          '<button data-start-race="' + i + '">Race</button></div>'
        ).join('') + '<div class="g-row"><button data-close-race="1">Close</button></div>';
        panel.querySelectorAll('[data-start-race]').forEach((b) => b.onclick = () => {
          import('./raceway.js').then((rw) => {
            if (rw.startRace(G, parseInt(b.dataset.startRace, 10))) this.toggleRaceMenu(false);
          });
        });
        panel.querySelectorAll('[data-close-race]').forEach((b) => b.onclick = () => this.toggleRaceMenu(false));
        G.paused = true;
      } else {
        G.paused = false;
      }
    },
  };
  // minimap is drawn from boot each frame
  G.drawMinimap = function () {
    const cv = G.hud.el.minimap;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const half = G.city.half;
    const toMap = (x, z) => [((x + half) / (half * 2)) * W, ((z + half) / (half * 2)) * H];
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(0, 0, W, H);
    // ocean
    ctx.fillStyle = '#2a7a8c';
    ctx.fillRect(((296 + half) / (half * 2)) * W, 0, W, H);
    // roads
    ctx.strokeStyle = '#5a5a66';
    ctx.lineWidth = 4;
    const coords = [-280, -210, -140, -70, 0, 70, 140, 210, 280];
    for (const c of coords) {
      const [x1, y1] = toMap(c, -half);
      const [x2, y2] = toMap(c, half);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [ax, ay] = toMap(-half, c);
      const [bx, by] = toMap(half, c);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    // mission beacon
    if (G.beacon) {
      const [bx, by] = toMap(G.beacon.x, G.beacon.z);
      ctx.fillStyle = '#ffd76b';
      ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd76b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 10 + Math.sin(G.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
    }
    // race gate
    if (G.race) {
      const gate = G.race.circuit.gates[G.race.gate];
      if (gate) {
        const [gx, gy] = toMap(gate[0], gate[1]);
        ctx.fillStyle = '#ff5a3c';
        ctx.beginPath(); ctx.arc(gx, gy, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // police
    ctx.fillStyle = '#ff3b30';
    for (const car of G.copsList) {
      if (!car.isPolice || car.isRoadblock) continue;
      const [px, py] = toMap(car.x, car.z);
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
    // player arrow
    const [px, py] = toMap(G.player.x, G.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-G.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
}
