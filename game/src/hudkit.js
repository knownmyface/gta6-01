// hudkit.js — the HUD: mission panel, cash + wanted stars, circular minimap,
// big speedometer, weapon slots, radio station, objective banner, weapon
// wheel overlay, garage shop UI, start screen and flash messages.
import { fmtCash, fmtLap, clamp } from './util.js';
import { WEAPONS, WHEEL_ORDER } from './fight.js';
import { SAFEHOUSES, UPGRADES, upgradePrice } from './garage.js';
import { RACES } from './raceway.js';

export function buildHud(W) {
  const hud = document.getElementById('hud');
  const el = (id) => document.getElementById(id);
  W.hud = {
    root: hud,
    mission: el('hud-mission'),
    cash: el('hud-cash'),
    stars: el('hud-stars'),
    speed: el('hud-speed'),
    speedUnit: el('hud-speed-unit'),
    minimap: el('minimap'),
    radio: el('hud-radio'),
    weapons: el('hud-weapons'),
    banner: el('hud-banner'),
    objective: el('hud-objective'),
    flash: el('hud-flash'),
    wheel: el('weapon-wheel'),
    shop: el('shop-panel'),
    start: el('start-screen'),
    damage: el('hud-damage'),
    race: el('hud-race'),
    showWheel(open) { hud.classList.toggle('wheel-open', open); renderWheel(W, open); },
    showShop(open) { renderShop(W, open); },
    refreshWeapons() { renderWeapons(W); },
    refreshGarage() { renderShop(W, true); },
  };
  renderWeapons(W);
  return W.hud;
}

function starRow(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
  return s;
}

export function updateHud(W) {
  const p = W.player;
  const h = W.hud;
  if (!h) return;
  const m = W.story.active || W.story2.active;
  h.mission.innerHTML = m
    ? '<b>M' + m.id + ' · ' + m.name + '</b><br>' + m.brief
    : '<b>FREE ROAM</b><br>Press N for the next mission · E to jack a car';
  h.cash.textContent = fmtCash(p.cash);
  h.stars.textContent = starRow(p.wanted);
  h.stars.style.color = p.wanted >= 4 ? '#ff2222' : p.wanted >= 2 ? '#ffb36b' : '#ffd23e';
  const v = p.vehicle;
  const speed = v ? Math.abs(v.speed || 0) * 3.2 : Math.abs(p.speed || 0) * 3.2;
  h.speed.textContent = Math.round(speed);
  h.speedUnit.textContent = p.mode === 'boat' ? 'KNOTS' : p.mode === 'bike' ? 'MPH · BIKE' : p.mode === 'foot' ? 'MPH · ON FOOT' : 'MPH';
  h.radio.textContent = '♪ ' + (W.sound?.stationName() || 'CORAL FM 98.5');
  h.objective.textContent = W.objective || '';
  h.banner.textContent = W.raceBanner || (W.race?.active && W.race.countdown > 0 ? String(Math.ceil(W.race.countdown)) : '');
  const dmg = v ? Math.round(v.damage || 0) : 0;
  h.damage.textContent = 'DAMAGE ' + dmg + '%';
  h.damage.style.color = dmg > 70 ? '#ff2222' : dmg > 40 ? '#ffb36b' : '#9fd8ff';
  // Race panel.
  const r = W.race;
  if (r?.active && r.def) {
    h.race.style.display = 'block';
    h.race.innerHTML =
      '<b>' + r.def.name + '</b> · P' + r.position + '/4<br>' +
      'LAP ' + Math.min(r.lap, r.def.laps) + '/' + r.def.laps +
      ' · ' + fmtLap(r.raceTime) + '<br>BEST ' + fmtLap(r.bestLap);
  } else {
    h.race.style.display = 'none';
  }
  drawMinimap(W);
  // Flash message fade.
  if (W.flashTimer > 0) {
    W.flashTimer -= 1 / 60;
    h.flash.style.opacity = String(Math.min(1, W.flashTimer));
  } else {
    h.flash.style.opacity = '0';
  }
}

function drawMinimap(W) {
  const cv = W.hud.minimap;
  if (!cv) return;
  const g = cv.getContext('2d');
  const S = cv.width;
  const scale = S / 480; // world -240..240 maps to the canvas
  const toX = (x) => S / 2 + x * scale;
  const toY = (z) => S / 2 + z * scale;
  g.clearRect(0, 0, S, S);
  // Sea + land.
  g.fillStyle = '#123a5a';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#3a2f28';
  g.fillRect(0, 0, S, S * 0.86);
  // Roads.
  g.strokeStyle = '#555560';
  g.lineWidth = 4;
  for (let c = -208; c <= 208; c += 52) {
    g.beginPath(); g.moveTo(toX(c), 0); g.lineTo(toX(c), S); g.stroke();
    g.beginPath(); g.moveTo(0, toY(c)); g.lineTo(S, toY(c)); g.stroke();
  }
  // Casino district glow.
  g.fillStyle = 'rgba(255,46,136,0.55)';
  g.fillRect(toX(-130), toY(-156), 104 * scale, 104 * scale);
  // Marina.
  g.fillStyle = 'rgba(34,230,255,0.5)';
  g.fillRect(toX(180), toY(0), 60 * scale, 160 * scale);
  // Objective marker.
  if (W.story.marker?.visible) {
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.arc(toX(W.story.marker.position.x), toY(W.story.marker.position.z), 7, 0, Math.PI * 2);
    g.fill();
  }
  // Cops.
  g.fillStyle = '#2266ff';
  for (const c of W.cops) {
    g.beginPath();
    g.arc(toX(c.x), toY(c.z), 3.5, 0, Math.PI * 2);
    g.fill();
  }
  // Heli.
  if (W.heli) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(toX(W.heli.x), toY(W.heli.z), 4.5, 0, Math.PI * 2);
    g.fill();
  }
  // Player arrow.
  const p = W.player;
  g.save();
  g.translate(toX(p.x), toY(p.z));
  g.rotate(-p.heading + Math.PI);
  g.fillStyle = p.mode === 'foot' ? '#ffffff' : '#ff2e33';
  g.beginPath();
  g.moveTo(0, -8);
  g.lineTo(6, 6);
  g.lineTo(0, 3);
  g.lineTo(-6, 6);
  g.closePath();
  g.fill();
  g.restore();
}

function renderWeapons(W) {
  const h = W.hud;
  if (!h || !h.weapons) return;
  const p = W.player;
  h.weapons.innerHTML = WHEEL_ORDER.map((key, i) => {
    const owned = p.weapons[key]?.owned;
    const ammo = p.weapons[key]?.ammo ?? 0;
    const active = p.weapon === key;
    return '<div class="wslot' + (active ? ' active' : '') + (owned ? '' : ' locked') + '">' +
      '<b>' + (i + 1) + ' ' + WEAPONS[key].name + '</b> ' + (owned ? '· ' + ammo : '· LOCKED') + '</div>';
  }).join('');
}

function renderWheel(W, open) {
  const wheel = W.hud.wheel;
  if (!wheel) return;
  if (!open) { wheel.style.display = 'none'; return; }
  wheel.style.display = 'flex';
  const p = W.player;
  wheel.innerHTML = '<div class="wheel-title">WEAPON WHEEL — hold Q, press 1-4</div>' +
    WHEEL_ORDER.map((key, i) => {
      const owned = p.weapons[key]?.owned;
      const ammo = p.weapons[key]?.ammo ?? 0;
      return '<div class="wheel-slot' + (p.weapon === key ? ' active' : '') + (owned ? '' : ' locked') + '">' +
        '<b>' + (i + 1) + '</b><span>' + WEAPONS[key].name + '</span><em>' +
        (owned ? ammo + ' rounds' : 'NOT OWNED') + '</em></div>';
    }).join('');
}

function renderShop(W, open) {
  const panel = W.hud.shop;
  if (!panel) return;
  if (!open) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const p = W.player;
  const up = W.garageUpgrades;
  let html = '<h2>SUNSET GARAGE — UPGRADES</h2><div class="shop-cash">CASH ' + fmtCash(p.cash) + '</div>';
  for (const key of Object.keys(UPGRADES)) {
    const u = UPGRADES[key];
    const lvl = up[key];
    const price = lvl >= u.max ? 'MAX' : fmtCash(upgradePrice(key, lvl));
    html += '<div class="shop-row"><b>' + u.name + ' LV' + lvl + '/' + u.max + '</b><span>' + u.desc +
      '</span><button data-up="' + key + '">' + price + '</button></div>';
  }
  html += '<h2>SAFEHOUSES</h2>';
  for (const sh of SAFEHOUSES) {
    const owned = W.garage.owned[sh.key];
    html += '<div class="shop-row"><b>' + sh.name + '</b><span>' + sh.slots +
      ' garage slots</span><button data-house="' + sh.key + '">' + (owned ? 'OWNED' : fmtCash(sh.price)) + '</button></div>';
  }
  html += '<div class="shop-hint">Click a price to buy · G or Esc to close</div>';
  panel.innerHTML = html;
  panel.querySelectorAll('button[data-up]').forEach((b) => {
    b.addEventListener('click', () => {
      const { buyUpgrade } = window.__garageApi;
      buyUpgrade(W, b.dataset.up);
    });
  });
  panel.querySelectorAll('button[data-house]').forEach((b) => {
    b.addEventListener('click', () => {
      const { buySafehouse } = window.__garageApi;
      buySafehouse(W, b.dataset.house);
    });
  });
}
