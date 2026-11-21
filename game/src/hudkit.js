// Coral Heat — HUD kit: dense legible HUD (mission panel, cash, wanted stars,
// minimap, big speed, weapon slots, radio, banners, weapon wheel, menus).
// Fresh write, round 7.
import { makeEl, fmtMoney, fmtClock, fmtLap } from './util.js';
import { WEAPONS } from './fight.js';
import { SAFEHOUSES, UPGRADES } from './garage.js';

export class Hud {
  constructor(G) {
    this.G = G;
    this.root = null;
    this.els = {};
    this.toasts = [];
    this.wheelOpen = false;
  }
  build() {
    const root = makeEl('div', 'hud', document.getElementById('game'));
    this.root = root;
    // --- mission panel top-left ---
    const mp = makeEl('div', 'panel mission-panel', root);
    makeEl('div', 'mp-title', mp, '★ MISSION');
    this.els.missionName = makeEl('div', 'mp-name', mp, '—');
    this.els.missionDesc = makeEl('div', 'mp-desc', mp, 'Press M to start the story');
    this.els.missionHint = makeEl('div', 'mp-hint', mp, '');
    this.els.objective = makeEl('div', 'mp-obj', mp, 'OBJECTIVE: —');
    // --- cash + wanted top-right ---
    const tr = makeEl('div', 'panel top-right', root);
    this.els.cash = makeEl('div', 'cash', tr, '$0');
    this.els.wanted = makeEl('div', 'wanted', tr, '☆☆☆☆☆');
    this.els.wantedLabel = makeEl('div', 'wanted-label', tr, 'CLEAN');
    this.els.health = makeEl('div', 'health', tr, '♥ 100  🛡 0');
    this.els.clock = makeEl('div', 'clock', tr, '18:42');
    // --- minimap bottom-left ---
    const mm = makeEl('div', 'panel minimap-wrap', root);
    this.els.minimap = makeEl('canvas', 'minimap', mm);
    this.els.minimap.width = 190; this.els.minimap.height = 190;
    this.els.zone = makeEl('div', 'zone', mm, 'CORAL BAY');
    // --- speed bottom-right ---
    const sp = makeEl('div', 'panel speed-panel', root);
    this.els.speed = makeEl('div', 'speed', sp, '0');
    makeEl('div', 'speed-unit', sp, 'MPH');
    this.els.vehicle = makeEl('div', 'vehicle', sp, 'ON FOOT');
    this.els.damage = makeEl('div', 'damage', sp, 'DAMAGE 0%');
    this.els.nitro = makeEl('div', 'nitro', sp, 'NITRO ▰▰▰▰▰');
    // --- weapon slots bottom-centre-left ---
    const ws = makeEl('div', 'panel weapon-slots', root);
    this.els.slots = [];
    WEAPONS.forEach((w, i) => {
      const s = makeEl('div', 'wslot', ws, w.slot + ' ' + w.name);
      this.els.slots.push(s);
    });
    // --- radio + objective banner bottom-centre ---
    const bc = makeEl('div', 'panel bottom-centre', root);
    this.els.radio = makeEl('div', 'radio', bc, '♪ BAY FM 98.5 — Sunset Drive');
    this.els.bannerTitle = makeEl('div', 'banner-title', bc, '');
    this.els.bannerSub = makeEl('div', 'banner-sub', bc, '');
    this.els.hint = makeEl('div', 'hint-line', bc, '');
    // --- race HUD ---
    const rh = makeEl('div', 'panel race-hud', root);
    this.els.raceName = makeEl('div', 'race-name', rh, '');
    this.els.racePos = makeEl('div', 'race-pos', rh, '');
    this.els.raceLap = makeEl('div', 'race-lap', rh, '');
    this.els.raceTime = makeEl('div', 'race-time', rh, '');
    rh.style.display = 'none';
    this.els.raceHud = rh;
    // --- toasts ---
    this.els.toastBox = makeEl('div', 'toast-box', root);
    // --- weapon wheel ---
    const wheel = makeEl('div', 'wheel', root);
    wheel.style.display = 'none';
    this.els.wheel = wheel;
    makeEl('div', 'wheel-centre', wheel, 'WEAPON');
    WEAPONS.forEach((w, i) => {
      const a = (i / WEAPONS.length) * Math.PI * 2 - Math.PI / 2;
      const seg = makeEl('div', 'wheel-seg', wheel, w.slot + ' ' + w.name);
      seg.style.left = (50 + Math.cos(a) * 36) + '%';
      seg.style.top = (50 + Math.sin(a) * 36) + '%';
      seg.dataset.idx = i;
      seg.addEventListener('click', () => { this.G.combat.select(i); this.hideWheel(); });
    });
    // --- start screen ---
    const start = makeEl('div', 'overlay start-screen', root);
    makeEl('div', 'game-title', start, 'CORAL HEAT');
    makeEl('div', 'game-sub', start, '20 STORY MISSIONS • CASINO HEIST • STREET RACES • GARAGE & BIKES');
    makeEl('div', 'game-sub2', start, '5-STAR POLICE • HELICOPTER CHASES • ROADBLOCKS • CARJACKING • BOATS & RADIO');
    const ctrl = makeEl('div', 'controls', start);
    ctrl.innerHTML = 'WASD drive / walk &nbsp;•&nbsp; E enter car / boat / bike &nbsp;•&nbsp; F carjack<br>' +
      'Q weapon wheel &nbsp;•&nbsp; CLICK shoot &nbsp;•&nbsp; SHIFT nitro / sprint &nbsp;•&nbsp; R radio<br>' +
      'G garage &amp; safehouses &nbsp;•&nbsp; M mission &nbsp;•&nbsp; P pause &nbsp;•&nbsp; C camera &nbsp;•&nbsp; H help';
    const playBtn = makeEl('button', 'play-btn', start, '▶  START ENGINE');
    playBtn.addEventListener('click', () => this.G.startGame());
    this.els.startScreen = start;
    // --- pause overlay ---
    const pause = makeEl('div', 'overlay pause-screen', root);
    pause.style.display = 'none';
    makeEl('div', 'pause-title', pause, 'PAUSED');
    const resumeBtn = makeEl('button', 'play-btn', pause, 'RESUME');
    resumeBtn.addEventListener('click', () => this.G.togglePause(false));
    const saveBtn = makeEl('button', 'play-btn', pause, 'SAVE GAME');
    saveBtn.addEventListener('click', () => { this.G.save?.save(); this.toast('GAME SAVED', '#7CFC00'); });
    this.els.pauseScreen = pause;
    // --- garage / shop panel ---
    const shop = makeEl('div', 'overlay shop-panel', root);
    shop.style.display = 'none';
    makeEl('div', 'shop-title', shop, 'GARAGE & SAFEHOUSES');
    this.els.shopBody = makeEl('div', 'shop-body', shop);
    const closeBtn = makeEl('button', 'play-btn', shop, 'CLOSE (G)');
    closeBtn.addEventListener('click', () => this.closeShop());
    this.els.shop = shop;
    return root;
  }

  toast(text, color = '#ffffff') {
    const t = makeEl('div', 'toast', this.els.toastBox, text);
    t.style.borderLeftColor = color;
    this.toasts.push(t);
    setTimeout(() => { t.remove(); this.toasts = this.toasts.filter((x) => x !== t); }, 4200);
    while (this.toasts.length > 4) { const old = this.toasts.shift(); old.remove(); }
  }
  banner(title, sub) {
    this.els.bannerTitle.textContent = title;
    this.els.bannerSub.textContent = sub || '';
    this.els.bannerTitle.classList.add('flash');
    setTimeout(() => this.els.bannerTitle.classList.remove('flash'), 3000);
  }
  hint(text) { this.els.hint.textContent = text; }
  showWheel() {
    this.els.wheel.style.display = 'block';
    this.wheelOpen = true;
    this.els.slots.forEach((s, i) => s.classList.toggle('active', i === this.G.combat.weaponIndex));
  }
  hideWheel() { this.els.wheel.style.display = 'none'; this.wheelOpen = false; }

  openShop() {
    const G = this.G;
    const body = this.els.shopBody;
    body.innerHTML = '';
    makeEl('div', 'shop-sec', body, '— SAFEHOUSES —');
    for (const sh of SAFEHOUSES) {
      const row = makeEl('div', 'shop-row', body);
      makeEl('span', '', row, sh.name + ' — ' + sh.desc);
      const b = makeEl('button', 'buy-btn', row, G.garage.owned[sh.id] ? 'OWNED ✓' : 'BUY ' + fmtMoney(sh.price));
      b.disabled = !!G.garage.owned[sh.id];
      b.addEventListener('click', () => {
        const r = G.garage.buySafehouse(G, sh);
        this.toast(r.msg, r.ok ? '#7CFC00' : '#ff8844');
        if (r.ok) { G.missions2?.onHouseBought?.(); this.openShop(); }
      });
    }
    makeEl('div', 'shop-sec', body, '— UPGRADES (' + G.playerCar.model.name + ') —');
    for (const up of UPGRADES) {
      const lvl = G.playerCar.upgrades[up.id] || 0;
      const row = makeEl('div', 'shop-row', body);
      makeEl('span', '', row, up.name + ' Lv' + lvl + '/' + up.levels.length + ' — ' + up.desc);
      const price = lvl >= up.levels.length ? 'MAXED' : 'BUY ' + fmtMoney(up.levels[lvl]);
      const b = makeEl('button', 'buy-btn', row, price);
      b.disabled = lvl >= up.levels.length;
      b.addEventListener('click', () => {
        const r = G.garage.buyUpgrade(G, up);
        this.toast(r.msg, r.ok ? '#7CFC00' : '#ff8844');
        if (r.ok) { G.missions2?.onUpgradeBought?.(); this.openShop(); }
      });
    }
    const storeBtn = makeEl('button', 'buy-btn', body, 'STORE CURRENT CAR IN NEAREST OWNED SAFEHOUSE');
    storeBtn.addEventListener('click', () => {
      const sh = G.garage.markers.map((m) => m.sh).find((s) => G.garage.owned[s.id]);
      if (!sh) { this.toast('Buy a safehouse first.', '#ff8844'); return; }
      const r = G.garage.storeCar(G, sh);
      this.toast(r.msg, r.ok ? '#7CFC00' : '#ff8844');
    });
    this.els.shop.style.display = 'flex';
    G.shopOpen = true;
  }
  closeShop() { this.els.shop.style.display = 'none'; this.G.shopOpen = false; }

  update(G, dt) {
    const e = this.els;
    const p = G.player;
    e.cash.textContent = fmtMoney(p.cash);
    const w = G.police.wanted;
    e.wanted.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
    e.wanted.className = 'wanted w' + w;
    e.wantedLabel.textContent = w === 0 ? 'CLEAN' : 'WANTED — ' + ['','ONE','TWO','THREE','FOUR','FIVE'][w] + ' STAR' + (w > 1 ? 'S' : '');
    const armor = Math.max(0, 100 - G.playerCar.damage);
    e.health.textContent = '♥ ' + Math.max(0, Math.floor(p.health)) + '  🛡 ' + Math.floor(armor);
    e.clock.textContent = fmtClock(G.timeOfDay);
    // mission
    const m1 = G.missions.active;
    const m2 = G.missions2.active;
    const act = m1 || m2;
    if (act) {
      e.missionName.textContent = 'MISSION ' + act.def.id + ' — ' + act.def.title;
      e.missionDesc.textContent = act.def.giver + ': ' + act.def.desc;
      e.missionHint.textContent = act.def.hint || '';
      let obj = 'OBJECTIVE: ';
      if (act.def.type === 'timed') obj += 'REACH THE MARKER — ' + Math.ceil(G.missions.timer) + 's LEFT';
      else if (act.def.type === 'collect') obj += 'CASH DROPS ' + act.collected + '/' + act.def.count;
      else if (act.def.type === 'survive') obj += 'SURVIVE ' + Math.ceil(G.missions.surviveTimer) + 's AT 3 STARS';
      else if (act.def.type === 'vault') obj += 'CRACK THE VAULT — STAY INSIDE THE CASINO';
      else if (act.def.type === 'race') obj += 'WIN THE RACE — ' + act.def.circuit;
      else obj += act.def.title;
      e.objective.textContent = obj;
    } else {
      const next = G.missions.current || G.missions2.current;
      e.missionName.textContent = next ? 'NEXT: MISSION ' + next.id + ' — ' + next.title : 'STORY COMPLETE — FREE ROAM';
      e.missionDesc.textContent = next ? next.desc : 'You own Coral Bay.';
      e.missionHint.textContent = 'Press M to start the mission';
      e.objective.textContent = 'OBJECTIVE: —';
    }
    // speed / vehicle
    if (G.inCar) {
      e.speed.textContent = String(Math.round(G.playerCar.mph));
      e.vehicle.textContent = G.playerCar.model.name.toUpperCase() + '  •  ' + (G.playerCar.nitroActive ? 'NITRO!' : 'DRIVE');
      e.damage.textContent = 'DAMAGE ' + Math.floor(G.playerCar.damage) + '%';
      const nb = Math.round(G.playerCar.nitro / 20);
      e.nitro.textContent = 'NITRO ' + '▰'.repeat(nb) + '▱'.repeat(5 - nb);
    } else if (G.boats.active) {
      e.speed.textContent = String(Math.round(Math.abs(G.boats.active.speed) * 2.237));
      e.vehicle.textContent = G.boats.active.model.name.toUpperCase() + '  •  BOAT';
      e.damage.textContent = 'WATER: MARINA';
      e.nitro.textContent = '';
    } else if (G.bikes.active) {
      e.speed.textContent = String(Math.round(Math.abs(G.bikes.active.speed) * 2.237));
      e.vehicle.textContent = G.bikes.active.model.name.toUpperCase() + '  •  BIKE' + (G.bikes.active.wheelie > 0.5 ? '  •  WHEELIE!' : '');
      e.damage.textContent = 'LEAN WITH A / D';
      e.nitro.textContent = '';
    } else {
      e.speed.textContent = String(Math.round(G.walker.speed * 2.237));
      e.vehicle.textContent = 'ON FOOT — MAYA "REEF" SANTOS';
      e.damage.textContent = 'PRESS E NEAR A CAR / BOAT / BIKE';
      e.nitro.textContent = '';
    }
    // weapon slots
    const cw = G.combat;
    this.els.slots.forEach((s, i) => {
      const w = WEAPONS[i];
      const ammo = cw.ammo[w.id] === Infinity ? '∞' : cw.ammo[w.id];
      s.textContent = w.slot + ' ' + w.name + ' [' + ammo + ']';
      s.classList.toggle('active', i === cw.weaponIndex);
    });
    // radio
    e.radio.textContent = '♪ ' + G.sound.stationName() + ' — ' + G.sound.stationTrack();
    // race HUD
    const r = G.raceway.active;
    if (r) {
      this.els.raceHud.style.display = 'block';
      this.els.raceName.textContent = '🏁 ' + r.circuit.name.toUpperCase();
      this.els.racePos.textContent = r.state === 'countdown' ? 'GET READY… ' + Math.ceil(r.countdown) : 'POSITION P' + r.position + '/4';
      this.els.raceLap.textContent = 'LAP ' + Math.min(r.lap, r.circuit.laps) + '/' + r.circuit.laps;
      this.els.raceTime.textContent = 'TIME ' + fmtLap(r.totalTime) + '  •  BEST ' + fmtLap(G.raceway.bestLaps[r.circuit.name]);
    } else {
      this.els.raceHud.style.display = 'none';
    }
    // zone label
    const pos = G.playerPos();
    e.zone.textContent = pos ? zoneName(pos.x, pos.z) : 'CORAL BAY';
    this.drawMinimap(G);
  }

  drawMinimap(G) {
    const c = this.els.minimap;
    const g = c.getContext('2d');
    const W = 190, S = 190 / 560; // world -280..280 -> 0..190
    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(10,14,24,0.82)';
    g.fillRect(0, 0, W, W);
    const toX = (x) => (x + 280) * S;
    const toY = (z) => (z + 280) * S;
    // water
    g.fillStyle = '#1d6f8e';
    g.fillRect(0, toY(220), W, W - toY(220));
    g.fillRect(0, 0, toX(-244), W);
    // roads
    g.strokeStyle = '#5a6272';
    g.lineWidth = 4;
    for (let i = -4; i <= 4; i++) {
      const v = toX(i * 52);
      g.beginPath(); g.moveTo(v, 0); g.lineTo(v, W); g.stroke();
      const h = toY(i * 52);
      g.beginPath(); g.moveTo(0, h); g.lineTo(W, h); g.stroke();
    }
    // casino district
    g.fillStyle = '#ff2fd6';
    g.fillRect(toX(120), toY(-180), 26, 26);
    // dots: boats
    g.fillStyle = '#4ecdc4';
    for (const b of G.boats.list) { g.beginPath(); g.arc(toX(b.x), toY(b.z), 2.5, 0, 7); g.fill(); }
    // police
    g.fillStyle = '#ff3333';
    for (const pc of G.police.cars) { g.beginPath(); g.arc(toX(pc.x), toY(pc.z), 3, 0, 7); g.fill(); }
    if (G.police.heli) { g.fillStyle = '#ff8800'; g.beginPath(); g.arc(toX(G.police.heli.x), toY(G.police.heli.z), 3.5, 0, 7); g.fill(); }
    // beacon
    const bc = G.missions.beacon || G.missions2.beacon;
    if (bc) {
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(toX(bc.x), toY(bc.z), 5, 0, 7); g.fill();
      g.strokeStyle = '#ffd166'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(toX(bc.x), toY(bc.z), 8 + Math.sin(G.time * 4) * 2, 0, 7); g.stroke();
    }
    // player arrow
    const pos = G.playerPos();
    if (pos) {
      g.save();
      g.translate(toX(pos.x), toY(pos.z));
      g.rotate(G.playerHeading());
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
      g.restore();
    }
    // frame
    g.strokeStyle = '#ffd166'; g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, W - 2);
  }
}

export function zoneName(x, z) {
  if (z > 200) return 'MARINA — CORAL BAY';
  if (x > 100 && z < -80) return 'NEON DISTRICT — CASINO ROW';
  if (x < -230) return 'SUNSET BEACH';
  if (Math.abs(x) < 30 && Math.abs(z) < 30) return 'DOWNTOWN — CORAL BAY';
  if (z > 150) return 'MARINA ROW';
  if (x > 150) return 'EASTSIDE';
  if (x < -150) return 'WESTSIDE';
  return 'CORAL BAY';
}
