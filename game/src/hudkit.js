// hudkit.js — dense legible HUD: minimap (canvas), big speed, wanted stars,
// cash, health/armor, weapon slots, radio station, objective banner, race HUD,
// toast messages, start screen + pause + wasted/busted overlays.
import { fmtCash, fmtClock, el } from './util.js';

export function createHUD(G) {
  const root = el('div', 'hud', document.body);
  // top-left: mission panel
  const mission = el('div', 'panel mission', root);
  el('div', 'mission-title', mission, 'CORAL HEAT');
  const objTitle = el('div', 'obj-title', mission, 'MISSION 1 — Welcome to Coral Bay');
  const objBrief = el('div', 'obj-brief', mission, 'Meet Riko at the plaza.');
  // top-right: cash + wanted + health
  const tr = el('div', 'panel top-right', root);
  const cash = el('div', 'cash', tr, '$2,500');
  const stars = el('div', 'stars', tr, '☆☆☆☆☆');
  const hp = el('div', 'hp', tr);
  el('span', 'hp-label', hp, 'HP ');
  const hpBar = el('div', 'bar', hp); const hpFill = el('div', 'fill hp-fill', hpBar);
  el('span', 'hp-label', hp, ' ARMOR ');
  const arBar = el('div', 'bar', hp); const arFill = el('div', 'fill ar-fill', arBar);
  // bottom-left: minimap
  const mmWrap = el('div', 'panel minimap-wrap', root);
  const mm = document.createElement('canvas');
  mm.width = 190; mm.height = 190; mm.className = 'minimap';
  mmWrap.appendChild(mm);
  // bottom-right: big speed + vehicle name
  const sp = el('div', 'panel speedo', root);
  const speed = el('div', 'speed-num', sp, '0');
  el('div', 'speed-unit', sp, 'MPH');
  const vehName = el('div', 'veh-name', sp, 'ON FOOT');
  // bottom-centre: weapon slots + radio
  const bc = el('div', 'panel bottom-centre', root);
  const weapons = el('div', 'weapons', bc);
  const slotEls = [];
  for (let i = 0; i < 4; i++) slotEls.push(el('div', 'wslot', weapons, '—'));
  const radio = el('div', 'radio', bc, '♪ CORAL FM 98.5');
  const toast = el('div', 'toast', root);
  const banner = el('div', 'banner hidden', root);
  // race HUD
  const race = el('div', 'panel race-hud hidden', root);
  const raceName = el('div', 'race-name', race, '');
  const racePos = el('div', 'race-pos', race, 'P4');
  const raceLap = el('div', 'race-lap', race, 'LAP 1/3');
  const raceTime = el('div', 'race-time', race, '00:00.0');
  const raceBest = el('div', 'race-best', race, 'BEST —');
  const countdown = el('div', 'countdown hidden', root, '3');
  // overlays
  const start = el('div', 'overlay start-screen', document.body);
  start.innerHTML = '<h1>CORAL HEAT</h1><div class="tag">16 story missions · street races · garage &amp; bikes · 5-star police · boats &amp; radio</div><div class="tag2">A sunset marina city — Coral Bay</div><button id="play-btn">▶ PLAY — enter Coral Bay</button><div class="controls">WASD drive / walk · E enter car · F carjack · Q bike wheelie · Shift nitro / run · Space handbrake · Click shoot · 1-4 weapons · R race · G garage · M mission · Tab radio</div><div class="save-note" id="save-note"></div>';
  const dead = el('div', 'overlay dead hidden', document.body);
  dead.innerHTML = '<h1 id="dead-title">WASTED</h1><div class="tag">Coral Bay is unforgiving.</div><button id="respawn-btn">Respawn — $250 hospital bill</button>';
  const paused = el('div', 'overlay paused hidden', document.body);
  paused.innerHTML = '<h1>PAUSED</h1><div class="tag">Press P to keep playing.</div>';

  const H = {
    root, mission, objTitle, objBrief, cash, stars, hpFill, arFill, mm,
    speed, vehName, slotEls, radio, toast, banner, race, raceName, racePos,
    raceLap, raceTime, raceBest, countdown, start, dead, paused,
    toastT: 0,
    say(msg, secs = 2.5) {
      toast.textContent = msg;
      toast.classList.remove('hidden');
      toast.classList.add('show');
      this.toastT = secs;
    },
    setObjective(title, brief) { objTitle.textContent = title; objBrief.textContent = brief; },
    flashWanted() { stars.classList.add('flash'); setTimeout(() => stars.classList.remove('flash'), 500); },
    showRace(c) { race.classList.remove('hidden'); raceName.textContent = '🏁 ' + c.name + ' — ' + c.laps + ' LAPS'; },
    hideRace() { race.classList.add('hidden'); },
    setCountdown(n) {
      if (n <= 0) { countdown.classList.add('hidden'); return; }
      countdown.classList.remove('hidden');
      countdown.textContent = n > 3 ? 'GO!' : String(n);
    },
    updateRace(R) {
      racePos.textContent = 'P' + R.position + '/4';
      raceLap.textContent = 'LAP ' + Math.min(R.lap, R.circuit.laps) + '/' + R.circuit.laps;
      raceTime.textContent = fmtClock(R.raceTime * 1000);
      raceBest.textContent = 'BEST ' + (R.bestLap ? fmtClock(R.bestLap * 1000) : '—');
    },
    tick(dt) {
      if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) toast.classList.remove('show'); }
    },
  };
  return H;
}

export function updateHUD(G) {
  const H = G.hud;
  const p = G.player;
  H.cash.textContent = fmtCash(p.cash);
  const w = G.wanted.level;
  H.stars.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
  H.stars.className = 'stars' + (w >= 3 ? ' hot' : w > 0 ? ' warm' : '');
  H.hpFill.style.width = p.health + '%';
  H.arFill.style.width = p.armor + '%';
  const v = p.vehicle || p.bike || p.boat;
  let spd = 0;
  if (p.vehicle) spd = Math.abs(p.vehicle.speed) * 2.237;
  else if (p.bike) spd = Math.abs(p.bike.speed) * 2.237;
  else if (p.boat) spd = Math.abs(p.boat.speed) * 2.237;
  else if (p.moving) spd = 4;
  H.speed.textContent = String(Math.round(spd));
  H.vehName.textContent = p.vehicle ? p.vehicle.name.toUpperCase() + (p.vehicle.nitro > 0 ? ' · NITRO ' + Math.round(p.vehicle.nitro) + '%' : '')
    : p.bike ? '🏍 ' + p.bike.name.toUpperCase() + ' · LEAN ' + Math.round(Math.abs(p.bike.lean) * 100) + '%'
    : p.boat ? '⛵ ' + p.boat.name.toUpperCase()
    : 'ON FOOT';
  // weapon slots
  const slots = G.arsenal.slots;
  for (let i = 0; i < 4; i++) {
    const s = slots[i];
    H.slotEls[i].textContent = s ? (i + 1) + ' ' + s.name + (s.ammo !== Infinity ? ' ·' + (G.arsenal.ammo[s.id] || 0) : '') : '—';
    H.slotEls[i].className = 'wslot' + (i === G.arsenal.current ? ' active' : '');
  }
  H.radio.textContent = '♪ ' + G.sound.stationName() + (G.sound.muted ? ' (muted)' : '');
  drawMinimap(G);
}

function drawMinimap(G) {
  const ctx = G.hud.mm.getContext('2d');
  const S = 190, half = 340;
  const to = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
  ctx.fillStyle = '#1a1a26';
  ctx.fillRect(0, 0, S, S);
  // ocean + beach on the minimap
  ctx.fillStyle = '#1d6f8e'; ctx.fillRect(0, S * 0.93, S, S * 0.07);
  ctx.fillStyle = '#e8c98a'; ctx.fillRect(0, S * 0.90, S, S * 0.03);
  ctx.fillStyle = '#ff8a5a'; ctx.fillRect(S * 0.62, S * 0.88, S * 0.38, S * 0.05); // marina
  // roads
  ctx.strokeStyle = '#4a4a5e'; ctx.lineWidth = 3;
  for (let i = -4; i <= 4; i++) {
    const c = ((i * 76 + half) / (half * 2)) * S;
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(S, c); ctx.stroke();
  }
  // mission target
  const run = G.missions.active;
  if (run && run.target) {
    const [mx, my] = to(run.target.x, run.target.z);
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(mx, my, 6 + Math.sin(G.time * 5) * 2, 0, Math.PI * 2); ctx.fill();
  }
  // traffic dots
  ctx.fillStyle = '#9ad2e8';
  for (const c of G.cars) {
    if (c.traffic) { const [x, y] = to(c.x, c.z); ctx.fillRect(x - 1, y - 1, 2, 2); }
  }
  // cops red
  ctx.fillStyle = '#ff2a2a';
  for (const c of G.cops) { const [x, y] = to(c.x, c.z); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
  if (G.heli) { const [x, y] = to(G.heli.group.position.x, G.heli.group.position.z); ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
  // player arrow (centre-ish, rotated)
  const [px, py] = to(G.player.pos.x, G.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)) + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  // ring border
  ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.stroke();
}
