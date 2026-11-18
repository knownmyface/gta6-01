// HUD for CORAL HEAT v2.6: the dense DOM overlay (mission panel, cash,
// wanted stars, objective banner, speed, radio, health, weapon slots,
// gun shop, toasts, mission cards) and the circular minimap canvas —
// ocean, sand, city ground, buildings, roads, pier, the pulsing gold
// beacon, red hostiles, pale traffic, flashing police and the helicopter
// ring, redrawn every frame. v2.6 is a from-scratch rewrite of v2.5's
// hud.js: same panels, same minimap, same text, different code. The DOM
// writes go through two small helpers, the timed banners share one
// show/hide helper, and the minimap layers are named per-layer methods.
// Public method names are unchanged — main.js calls them by name.
import { clamp } from './rng.js';

const el = (id) => document.getElementById(id);

// Two tiny DOM helpers: every setter below is one call to one of these, so
// the panel code reads as data, not DOM plumbing.
function writeText(id, text) { el(id).textContent = text; }
function writeHtml(id, html) { el(id).innerHTML = html; }

// Minimap geometry: the world is 560 wide, the map is 196px, so one world
// unit is 196/560 = 0.35px. The map is fixed (whole city), north up.
const MAP_SIZE = 196;
const MAP_MID = MAP_SIZE / 2;
const MAP_UNIT = MAP_SIZE / 560;
const GRID_LINES = [-160, -120, -80, -40, 0, 40, 80, 120, 160];

const HEALTH_COLORS = {
  good: 'linear-gradient(90deg,#37e08a,#a5ff6e)',
  hurt: 'linear-gradient(90deg,#ffb347,#ffd23e)',
  critical: 'linear-gradient(90deg,#ff2e2e,#ff7a5a)',
};

export class Hud {
  constructor() {
    this.minimap = el('minimap');
    this.mm = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.lastObjective = '';
    this.cardTimer = null;
    this.bannerTimer = null;
  }

  // Show an element with HTML, then hide it after `ms` — one helper for
  // the mission card, the completion banner and the toast.
  flashPanel(node, html, ms, timerField) {
    node.innerHTML = html;
    node.style.display = 'block';
    clearTimeout(this[timerField]);
    this[timerField] = setTimeout(() => { node.style.display = 'none'; }, ms);
  }

  setMission(m, done, earned) {
    writeText('missionNum', `MISSION ${m.id} / 12`);
    writeText('missionTitle', m.title.toUpperCase());
    writeText('missionBrief', `${m.giver}: ${m.brief}`);
    writeText('missionProg', `${done} / 12 missions done  •  $${earned.toLocaleString()} earned`);
  }

  setObjective(text) {
    if (text === this.lastObjective) return;
    this.lastObjective = text;
    writeText('objectiveText', text);
  }

  setCash(cash) {
    writeText('cash', `$${Math.floor(cash).toLocaleString()}`);
  }

  setWanted(n) {
    const stars = el('wanted').children;
    for (let i = 0; i < 5; i++) {
      stars[i].className = i < n ? 'on' : 'off';
    }
  }

  setDistrict(name) {
    writeText('district', `${name} • CORAL BAY`);
  }

  setSpeed(mph, carName) {
    writeHtml('speed', `${Math.round(Math.abs(mph))}<small> MPH</small>`);
    writeText('carName', carName);
  }

  setHealth(h) {
    writeText('healthNum', Math.ceil(h));
    const fill = el('healthFill');
    fill.style.width = `${clamp(h, 0, 100)}%`;
    if (h > 50) fill.style.background = HEALTH_COLORS.good;
    else if (h > 25) fill.style.background = HEALTH_COLORS.hurt;
    else fill.style.background = HEALTH_COLORS.critical;
  }

  setRadio(station) {
    writeText('radioName', station.name);
    writeText('radioTrack', station.track);
  }

  setWeapon(text) {
    writeText('weapon', text);
  }

  // One weapon slot chip: key + icon + lock when unowned, gold when active.
  slotChip(arsenal, type) {
    const spec = arsenal.defs[type];
    const owned = arsenal.owned.has(type);
    const active = type === arsenal.current;
    const border = active ? '#ffd23e' : '#555';
    const bg = active ? '#ffd23e22' : 'transparent';
    const color = owned ? '#fff' : '#777';
    const lock = owned ? '' : '🔒';
    return `<span style="display:inline-block;margin-right:4px;padding:2px 6px;border-radius:4px;border:1px solid ${border};background:${bg};color:${color}">${spec.key} ${spec.icon} ${lock}</span>`;
  }

  // Weapon widget: current weapon + mag/reserve ammo + owned slots 1-4.
  // The weapon has to be readable at a glance while driving.
  setArsenal(arsenal) {
    const spec = arsenal.def();
    const state = arsenal.ammo[arsenal.current];
    const reloading = arsenal.reloading > 0;
    const ammoText = reloading ? 'RELOADING…' : `${state.mag}/${state.reserve}`;
    const slots = arsenal.order.map((t) => this.slotChip(arsenal, t)).join('');
    writeHtml(
      'weapon',
      `<span style="font-size:15px">${spec.icon} ${spec.name}</span> ` +
      `<span style="color:#ffd23e;font-size:15px">${ammoText}</span><br>` +
      `<span style="font-size:10px">${slots}</span>`,
    );
  }

  setCoins(n) {
    writeText('coins', `🪙 ${n}/12`);
  }

  // Big mission intro card, bottom centre — the mission lands like a title card.
  showMissionCard(m) {
    this.flashPanel(el('missionCard'),
      `<div style="font-size:11px;letter-spacing:3px;color:#ff9a3d">MISSION ${m.id} / 12</div>` +
      `<div style="font-size:26px;font-weight:900;letter-spacing:1px">${m.title.toUpperCase()}</div>` +
      `<div style="font-size:13px;color:#d8d8e0">${m.giver}: ${m.brief}</div>` +
      `<div style="font-size:12px;color:#ffd23e;margin-top:4px">REWARD $${m.reward.toLocaleString()}</div>`,
      4200, 'cardTimer');
  }

  // Completion fanfare banner, centre — mission complete + payout.
  showComplete(m, cash) {
    this.flashPanel(el('completeBanner'),
      `<div style="font-size:30px;font-weight:900;color:#ffd23e;text-shadow:0 2px 12px #000">MISSION COMPLETE</div>` +
      `<div style="font-size:15px">${m.title} — <b>+$${m.reward.toLocaleString()}</b></div>` +
      `<div style="font-size:13px;color:#a5ff6e">Cash: $${Math.floor(cash).toLocaleString()}</div>`,
      3600, 'bannerTimer');
  }

  // One shop row: name + stats on the left, price/OWNED button on the right.
  shopRow(arsenal, type, cash, onBuy) {
    const spec = arsenal.defs[type];
    const owned = arsenal.owned.has(type);
    const affordable = cash >= spec.price;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;' +
      'padding:8px 10px;margin:4px 0;background:#181820;border:1px solid #333;border-radius:6px;';
    row.innerHTML = `<span style="font-size:14px">${spec.icon} <b>${spec.name}</b> ` +
      `<span style="color:#999;font-size:11px">DMG ${spec.damage} · ${spec.mag}rd</span></span>`;
    const btn = document.createElement('button');
    btn.textContent = owned ? 'OWNED ✓' : `$${spec.price.toLocaleString()}`;
    const btnBg = owned ? '#2a5a3a' : affordable ? '#ffd23e' : '#444';
    const btnColor = owned ? '#a5ff6e' : affordable ? '#111' : '#999';
    btn.style.cssText = `padding:6px 10px;border-radius:5px;border:0;cursor:pointer;` +
      `font-weight:700;background:${btnBg};color:${btnColor}`;
    btn.disabled = owned || cash < spec.price;
    btn.addEventListener('click', () => onBuy(type));
    row.appendChild(btn);
    return row;
  }

  // Gun shop panel: renders the buy list, wired by main.js.
  renderShop(arsenal, cash, onBuy) {
    const list = el('shopList');
    list.innerHTML = '';
    for (const t of arsenal.order) list.appendChild(this.shopRow(arsenal, t, cash, onBuy));
    writeText('shopCash', `Cash: $${Math.floor(cash).toLocaleString()}`);
  }

  showShop(visible) {
    el('shopPanel').style.display = visible ? 'block' : 'none';
  }

  // Pause-screen stats: fares, shots, coins — the run's receipts.
  setStats(stats, coins, missionsDone) {
    writeHtml('statsLine',
      `🪙 Coral Coins <b>${coins}/12</b> &nbsp;•&nbsp; 🚕 Taxi fares done <b>${stats.faresDone}</b><br>` +
      `🔫 Shots fired <b>${stats.shotsFired}</b> &nbsp;•&nbsp; Missions done <b>${missionsDone}/12</b>`);
  }

  toast(title, body) {
    this.flashPanel(el('toast'), `<b style="color:#ffb347">${title}</b><br>${body}`, 4200, 'toastTimer');
  }

  // --- minimap ---
  toMapX(x) { return MAP_MID + x * MAP_UNIT; }
  toMapZ(z) { return MAP_MID + z * MAP_UNIT; }

  // Small canvas helpers: a filled dot and a filled rect in map space.
  dot(g, x, z, r) {
    g.beginPath();
    g.arc(this.toMapX(x), this.toMapZ(z), r, 0, Math.PI * 2);
    g.fill();
  }

  rect(g, x0, z0, x1, z1) {
    g.fillRect(this.toMapX(x0), this.toMapZ(z0), (x1 - x0) * MAP_UNIT, (z1 - z0) * MAP_UNIT);
  }

  drawMinimap(world, player, missions) {
    const g = this.mm;
    g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    this.paintGround(g, world);
    this.paintBeacon(g, missions);
    this.paintUnits(g, world, missions);
    this.paintArrow(g, player);
    g.fillStyle = '#ffd9a0';
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'left';
    g.fillText('N', 8, 14);
  }

  // Base layers: ocean + sand + city ground + buildings + roads + pier.
  paintGround(g, world) {
    const oceanEdge = this.toMapX(-245) + 60;
    g.fillStyle = '#1d3f6e'; // ocean (west)
    g.fillRect(0, 0, oceanEdge, MAP_SIZE);
    g.fillStyle = '#d8b878'; // sand
    g.fillRect(oceanEdge, 0, this.toMapX(-180) - oceanEdge, MAP_SIZE);
    g.fillStyle = '#232830'; // city ground
    g.fillRect(this.toMapX(-180), 0, this.toMapX(180) - this.toMapX(-180), MAP_SIZE);
    g.fillStyle = '#4a5568'; // buildings
    for (const c of world.colliders) {
      if (c.maxX < -180) continue;
      this.rect(g, c.minX, c.minZ, c.maxX, c.maxZ);
    }
    // Roads: a grid of pale lines over the ground.
    g.strokeStyle = '#8a8578';
    g.lineWidth = 2.4;
    for (const c of GRID_LINES) {
      g.beginPath();
      g.moveTo(this.toMapX(c), 0);
      g.lineTo(this.toMapX(c), MAP_SIZE);
      g.stroke();
      g.beginPath();
      g.moveTo(0, this.toMapZ(c));
      g.lineTo(MAP_SIZE, this.toMapZ(c));
      g.stroke();
    }
    // The pier reaches out into the ocean from the marina.
    g.strokeStyle = '#8a6a3a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(this.toMapX(-215), this.toMapZ(145));
    g.lineTo(this.toMapX(-215), this.toMapZ(235));
    g.stroke();
  }

  paintBeacon(g, missions) {
    if (!missions.beacon.visible) return;
    const pulse = 5 + Math.sin(performance.now() / 240) * 2;
    const bx = missions.beacon.position.x;
    const bz = missions.beacon.position.z;
    g.fillStyle = '#ffd23e';
    this.dot(g, bx, bz, pulse + 2);
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(this.toMapX(bx), this.toMapZ(bz), pulse + 2, 0, Math.PI * 2);
    g.stroke();
  }

  // Moving units: red hostiles, pale traffic, flashing police + the heli.
  paintUnits(g, world, missions) {
    g.fillStyle = '#ff3030';
    for (const h of missions.hostiles) {
      if (h.dead) continue;
      this.dot(g, h.x, h.z, 3);
    }
    g.fillStyle = '#e8e8e8';
    for (const c of world.traffic.cars) {
      if (c.dead) continue;
      g.fillRect(this.toMapX(c.x) - 1.5, this.toMapZ(c.z) - 1.5, 3, 3);
    }
    const blue = Math.floor(performance.now() / 200) % 2 === 0;
    g.fillStyle = blue ? '#3a7bff' : '#ff3030';
    for (const c of world.police.cars) {
      this.dot(g, c.x, c.z, 3.5);
    }
    if (!world.police.heli) return;
    // The helicopter gets a pulsing ring + HELI label on the minimap, so the
    // player can see the air threat coming, not just a red dot.
    const hx = this.toMapX(world.police.heli.x);
    const hz = this.toMapZ(world.police.heli.z);
    const ring = 8 + Math.sin(performance.now() / 200) * 3;
    g.fillStyle = '#ff3030';
    g.beginPath();
    g.arc(hx, hz, 4.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,48,48,0.8)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(hx, hz, ring, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#ff6a6a';
    g.font = 'bold 9px sans-serif';
    g.textAlign = 'left';
    g.fillText('HELI', hx + ring + 2, hz + 3);
  }

  paintArrow(g, player) {
    const pos = player.pos;
    g.save();
    g.translate(this.toMapX(pos.x), this.toMapZ(pos.z));
    g.rotate(Math.PI - player.heading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(0, 3);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
