// Coral Heat — the HUD: minimap, speedometer, wanted stars, cash,
// health, weapon slots, radio, objective banner, mission panel, toasts,
// race HUD, weapon-wheel host and the upgrade shop panel.
import { fmtMoney, fmtClock, fmtMph, clamp } from './util.js';
import { MARINA_X, WATER_X } from './coralcity.js';

export function buildHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: $('hud'),
    minimap: $('minimap'),
    speed: $('speed'),
    speedUnit: $('speed-unit'),
    mode: $('drive-mode'),
    stars: $('stars'),
    cash: $('cash'),
    health: $('health'),
    armor: $('armor'),
    weapons: $('weapon-slots'),
    radio: $('radio'),
    objective: $('objective'),
    missionPanel: $('mission-panel'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    toastEl: $('toast'),
    raceHud: $('race-hud'),
    raceCountdown: $('race-countdown'),
    shop: $('shop-panel'),
    wheel: $('weapon-wheel'),
    ctx: $('minimap').getContext('2d'),
    bannerTimer: 0,
    toastTimer: 0,
    setStars(n) {
      this.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
      this.stars.classList.toggle('hot', n >= 3);
    },
    setWeapon(w) {
      if (!w) return;
      const slots = this.weapons.querySelectorAll('.wslot');
      slots.forEach((s, i) => {
        const ww = G.weapons[i];
        s.textContent = (i + 1) + ' ' + ww.name + ' · ' + ww.reserve;
        s.classList.toggle('active', ww.id === w.id);
      });
    },
    setObjective(text) {
      this.objective.textContent = text;
    },
    banner(title, sub = '') {
      this.bannerTitle.textContent = title;
      this.bannerSub.textContent = sub;
      this.el.classList.add('show-banner');
      this.bannerTimer = 3.2;
    },
    toast(text) {
      this.toastEl.textContent = text;
      this.toastTimer = 3.5;
    },
    setRace(r) {
      if (!r) {
        this.raceHud.style.display = 'none';
        return;
      }
      this.raceHud.style.display = 'block';
      this.raceHud.innerHTML =
        '<div class="race-pos">P' + r.position + '</div>' +
        '<div class="race-line">' + r.name + ' · LAP ' + r.lap + '/' + r.laps + '</div>' +
        '<div class="race-line">TIME ' + fmtClock(r.time) + (r.best ? ' · BEST ' + fmtClock(r.best) : '') + '</div>' +
        '<div class="race-line">GATE ' + r.gate + '/' + r.gates + '</div>';
    },
    setRaceCountdown(text) {
      this.raceCountdown.textContent = text;
      this.raceCountdown.style.display = text ? 'block' : 'none';
    },
    showShop(open) {
      this.shop.style.display = open ? 'block' : 'none';
      if (open) this.refreshShop();
    },
    refreshShop() {
      const car = G.player.car;
      const rows = (G.shopRows || []).map((u) => {
        const level = car ? car.upgrades[u.id] || 0 : 0;
        const price = u.base * (level + 1);
        const maxed = level >= u.levels;
        return '<div class="shop-row"><b>' + u.name + '</b> Lv' + level + '/' + u.levels +
          ' <span>' + u.desc + '</span>' +
          (maxed ? ' <i>MAXED</i>' : ' <button data-part="' + u.id + '">' + fmtMoney(price) + '</button>') +
          '</div>';
      }).join('');
      const houses = (G.houseRows || []).map((s) => {
        const owned = G.garage.owned.includes(s.id);
        return '<div class="shop-row"><b>' + s.name + '</b> · ' + s.slots + ' slots ' +
          (owned ? '<i>OWNED</i>' : '<button data-house="' + s.id + '">' + fmtMoney(s.price) + '</button>') + '</div>';
      }).join('');
      this.shop.innerHTML = '<h2>CORAL GARAGE & PROPERTY</h2>' +
        '<div class="shop-cash">Cash: ' + fmtMoney(G.player.cash) + '</div>' +
        '<h3>UPGRADES — ' + (car ? car.model.name : 'no car') + '</h3>' + rows +
        '<h3>SAFEHOUSES</h3>' + houses +
        '<div class="shop-hint">Click a price to buy · U closes · G stores your car at an owned safehouse</div>';
      this.shop.querySelectorAll('[data-part]').forEach((b) => {
        b.addEventListener('click', () => G.buyUpgrade(b.dataset.part));
      });
      this.shop.querySelectorAll('[data-house]').forEach((b) => {
        b.addEventListener('click', () => G.buySafehouse(b.dataset.house));
      });
    },
  };
  G.hud = hud;
  // weapon slots
  hud.weapons.innerHTML = '';
  G.weapons.forEach((w, i) => {
    const s = document.createElement('div');
    s.className = 'wslot' + (i === 0 ? ' active' : '');
    s.textContent = (i + 1) + ' ' + w.name + ' · ' + w.reserve;
    hud.weapons.appendChild(s);
  });
  return hud;
}

function drawMinimap(G) {
  const hud = G.hud;
  if (!hud || !hud.ctx) return;
  const ctx = hud.ctx;
  const S = 200;
  const scale = S / 640; // world -320..320 -> 0..200
  const toMap = (x, z) => [(x + 320) * scale, (z + 320) * scale];
  ctx.clearRect(0, 0, S, S);
  // water west
  ctx.fillStyle = '#1f6f8b';
  const [wx] = toMap(WATER_X, 0);
  ctx.fillRect(0, 0, wx, S);
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(wx, 0, toMap(-246, 0)[0] - wx, S);
  // land
  ctx.fillStyle = '#3a3340';
  ctx.fillRect(toMap(-246, 0)[0], 0, S, S);
  // roads
  ctx.strokeStyle = '#8a8494';
  ctx.lineWidth = 3;
  const roadsV = [-180, -120, -60, 0, 60, 120, 180, 240, MARINA_X];
  const roadsH = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
  for (const rx of roadsV) {
    const [x0, y0] = toMap(rx, -300);
    const [x1, y1] = toMap(rx, 300);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  for (const rz of roadsH) {
    const [x0, y0] = toMap(-300, rz);
    const [x1, y1] = toMap(300, rz);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  // casino district
  const [cx, cy] = toMap(186, -186);
  ctx.fillStyle = '#ff5ad0';
  ctx.fillRect(cx - 5, cy - 5, 10, 10);
  // mission target
  const m = G.missions.active;
  if (m && m.target) {
    const [tx, ty] = toMap(m.target[0], m.target[1]);
    ctx.fillStyle = '#ffd75a';
    ctx.beginPath();
    ctx.arc(tx, ty, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // traffic (grey), cops (red), police boats (orange)
  ctx.fillStyle = '#c9c9c9';
  for (const t of G.traffic) {
    const [x, y] = toMap(t.pos.x, t.pos.z);
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  ctx.fillStyle = '#ff2020';
  for (const c of G.cops) {
    const [x, y] = toMap(c.pos.x, c.pos.z);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8a1e';
  for (const pb of G.policeBoats) {
    const [x, y] = toMap(pb.pos.x, pb.pos.z);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // player arrow
  const [px, py] = toMap(G.player.pos.x, G.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)) + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // north tick
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('N', S - 14, 14);
}

export function updateHud(G, dt) {
  const hud = G.hud;
  if (!hud) return;
  const mph = fmtMph(Math.abs(G.player.speed));
  hud.speed.textContent = mph;
  hud.mode.textContent =
    G.player.mode === 'car' ? (G.player.car ? G.player.car.model.name : 'ON FOOT') :
    G.player.mode === 'boat' ? (G.player.boat ? G.player.boat.model.name : 'ON FOOT') :
    G.player.mode === 'bike' ? (G.player.bike ? G.player.bike.model.name : 'ON FOOT') :
    'ON FOOT';
  hud.cash.textContent = fmtMoney(G.player.cash);
  const hp = G.player.car ? G.player.car.health : G.player.health;
  hud.health.textContent = 'HP ' + Math.round(hp);
  hud.health.classList.toggle('low', hp < 35);
  hud.armor.textContent = 'ARMOR ' + Math.round(G.player.armor || 0);
  hud.radio.textContent = 'RADIO · ' + (G.radioStations?.[G.radioIndex]?.name || 'CORAL FM');
  if (G.player.weapon) {
    hud.setWeapon(G.player.weapon);
  }
  // mission panel
  const done = G.missions.list.filter((x) => x.state === 'done').length;
  const active = G.missions.active;
  hud.missionPanel.innerHTML =
    '<div class="mp-title">CORAL HEAT — ' + done + '/22 MISSIONS</div>' +
    (active
      ? '<div class="mp-active">MISSION ' + active.id + ' · ' + active.name + '</div><div class="mp-desc">' + active.desc + '</div>'
      : '<div class="mp-desc">Press N for the next job · T to race · U for the garage</div>');
  // banner + toast timers
  if (hud.bannerTimer > 0) {
    hud.bannerTimer -= dt;
    if (hud.bannerTimer <= 0) hud.el.classList.remove('show-banner');
  }
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    hud.toastEl.style.opacity = hud.toastTimer > 0 ? '1' : '0';
  }
  drawMinimap(G);
}
