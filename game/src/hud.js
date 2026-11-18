// HUD for CORAL HEAT v2.3: the dense DOM overlay (mission panel, cash,
// wanted stars, objective banner, speed, radio, health) and the circular
// minimap canvas — roads, beach, buildings, player, traffic, police,
// hostiles and the gold mission marker, redrawn every frame. v2.3 is a
// from-scratch rewrite of v2.2's hud.js: same panels, same minimap, same
// text, different code.
import { clamp } from './rng.js';

const $ = (id) => document.getElementById(id);

// Minimap geometry: the world is 560 wide, the map is 196px.
const MAP_SIZE = 196;
const MAP_HALF = MAP_SIZE / 2;
const MAP_SCALE = MAP_SIZE / 560;
const ROAD_LINES = [-160, -120, -80, -40, 0, 40, 80, 120, 160];

const HEALTH_GRADIENTS = {
  good: 'linear-gradient(90deg,#37e08a,#a5ff6e)',
  hurt: 'linear-gradient(90deg,#ffb347,#ffd23e)',
  critical: 'linear-gradient(90deg,#ff2e2e,#ff7a5a)',
};

export class Hud {
  constructor() {
    this.minimap = $('minimap');
    this.mm = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.lastObjective = '';
    this.cardTimer = null;
    this.bannerTimer = null;
  }

  setMission(m, done, earned) {
    $('missionNum').textContent = `MISSION ${m.id} / 12`;
    $('missionTitle').textContent = m.title.toUpperCase();
    $('missionBrief').textContent = `${m.giver}: ${m.brief}`;
    $('missionProg').textContent = `${done} / 12 missions done  •  $${earned.toLocaleString()} earned`;
  }

  setObjective(text) {
    if (text === this.lastObjective) return;
    this.lastObjective = text;
    $('objectiveText').textContent = text;
  }

  setCash(cash) {
    $('cash').textContent = `$${Math.floor(cash).toLocaleString()}`;
  }

  setWanted(n) {
    const stars = $('wanted').children;
    for (let i = 0; i < 5; i++) {
      stars[i].className = i < n ? 'on' : 'off';
    }
  }

  setDistrict(name) {
    $('district').textContent = `${name} • CORAL BAY`;
  }

  setSpeed(mph, carName) {
    $('speed').innerHTML = `${Math.round(Math.abs(mph))}<small> MPH</small>`;
    $('carName').textContent = carName;
  }

  setHealth(h) {
    $('healthNum').textContent = Math.ceil(h);
    const fill = $('healthFill');
    fill.style.width = `${clamp(h, 0, 100)}%`;
    fill.style.background = h > 50 ? HEALTH_GRADIENTS.good
      : h > 25 ? HEALTH_GRADIENTS.hurt : HEALTH_GRADIENTS.critical;
  }

  setRadio(station) {
    $('radioName').textContent = station.name;
    $('radioTrack').textContent = station.track;
  }

  setWeapon(text) {
    $('weapon').textContent = text;
  }

  // Weapon widget: current weapon + mag/reserve ammo + owned slots 1-4.
  // The weapon has to be readable at a glance while driving.
  setArsenal(arsenal) {
    const def = arsenal.def();
    const state = arsenal.ammo[arsenal.current];
    const reloading = arsenal.reloading > 0;
    const ammoText = reloading ? 'RELOADING…' : `${state.mag}/${state.reserve}`;
    const slots = arsenal.order.map((t) => {
      const slotDef = arsenal.defs[t];
      const owned = arsenal.owned.has(t);
      const active = t === arsenal.current;
      const border = active ? '#ffd23e' : '#555';
      const bg = active ? '#ffd23e22' : 'transparent';
      const color = owned ? '#fff' : '#777';
      const lock = owned ? '' : '🔒';
      return `<span style="display:inline-block;margin-right:4px;padding:2px 6px;border-radius:4px;border:1px solid ${border};background:${bg};color:${color}">${slotDef.key} ${slotDef.icon} ${lock}</span>`;
    }).join('');
    $('weapon').innerHTML = `<span style="font-size:15px">${def.icon} ${def.name}</span> <span style="color:#ffd23e;font-size:15px">${ammoText}</span><br><span style="font-size:10px">${slots}</span>`;
  }

  setCoins(n) {
    $('coins').textContent = `🪙 ${n}/12`;
  }

  // Big mission intro card, bottom centre — the mission lands like a title card.
  showMissionCard(m) {
    const el = $('missionCard');
    el.innerHTML = `<div style="font-size:11px;letter-spacing:3px;color:#ff9a3d">MISSION ${m.id} / 12</div><div style="font-size:26px;font-weight:900;letter-spacing:1px">${m.title.toUpperCase()}</div><div style="font-size:13px;color:#d8d8e0">${m.giver}: ${m.brief}</div><div style="font-size:12px;color:#ffd23e;margin-top:4px">REWARD $${m.reward.toLocaleString()}</div>`;
    el.style.display = 'block';
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => { el.style.display = 'none'; }, 4200);
  }

  // Completion fanfare banner, centre — mission complete + payout.
  showComplete(m, cash) {
    const el = $('completeBanner');
    el.innerHTML = `<div style="font-size:30px;font-weight:900;color:#ffd23e;text-shadow:0 2px 12px #000">MISSION COMPLETE</div><div style="font-size:15px">${m.title} — <b>+$${m.reward.toLocaleString()}</b></div><div style="font-size:13px;color:#a5ff6e">Cash: $${Math.floor(cash).toLocaleString()}</div>`;
    el.style.display = 'block';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { el.style.display = 'none'; }, 3600);
  }

  // Gun shop panel: renders the buy list, wired by main.js.
  renderShop(arsenal, cash, onBuy) {
    const el = $('shopList');
    el.innerHTML = '';
    for (const t of arsenal.order) {
      const def = arsenal.defs[t];
      const owned = arsenal.owned.has(t);
      const affordable = cash >= def.price;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin:4px 0;background:#181820;border:1px solid #333;border-radius:6px;';
      row.innerHTML = `<span style="font-size:14px">${def.icon} <b>${def.name}</b> <span style="color:#999;font-size:11px">DMG ${def.damage} · ${def.mag}rd</span></span>`;
      const btn = document.createElement('button');
      btn.textContent = owned ? 'OWNED ✓' : `$${def.price.toLocaleString()}`;
      const btnBg = owned ? '#2a5a3a' : affordable ? '#ffd23e' : '#444';
      const btnColor = owned ? '#a5ff6e' : affordable ? '#111' : '#999';
      btn.style.cssText = `padding:6px 10px;border-radius:5px;border:0;cursor:pointer;font-weight:700;background:${btnBg};color:${btnColor}`;
      btn.disabled = owned || cash < def.price;
      btn.addEventListener('click', () => onBuy(t));
      row.appendChild(btn);
      el.appendChild(row);
    }
    $('shopCash').textContent = `Cash: $${Math.floor(cash).toLocaleString()}`;
  }

  showShop(visible) {
    $('shopPanel').style.display = visible ? 'block' : 'none';
  }

  // Pause-screen stats: fares, shots, coins — the run's receipts.
  setStats(stats, coins, missionsDone) {
    $('statsLine').innerHTML =
      `🪙 Coral Coins <b>${coins}/12</b> &nbsp;•&nbsp; 🚕 Taxi fares done <b>${stats.faresDone}</b><br>` +
      `🔫 Shots fired <b>${stats.shotsFired}</b> &nbsp;•&nbsp; Missions done <b>${missionsDone}/12</b>`;
  }

  toast(title, body) {
    const el = $('toast');
    el.innerHTML = `<b style="color:#ffb347">${title}</b><br>${body}`;
    el.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 4200);
  }

  // --- minimap ---
  mapX(x) { return MAP_HALF + x * MAP_SCALE; }
  mapZ(z) { return MAP_HALF + z * MAP_SCALE; }

  drawMinimap(world, player, missions) {
    const g = this.mm;
    g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    this.drawMapGround(g, world);
    this.drawMapRoads(g);
    this.drawMapPier(g);
    this.drawMapMarker(g, missions);
    this.drawMapHostiles(g, missions);
    this.drawMapTraffic(g, world);
    this.drawMapPolice(g, world);
    this.drawMapPlayer(g, player);
    g.fillStyle = '#ffd9a0';
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'left';
    g.fillText('N', 8, 14);
  }

  drawMapGround(g, world) {
    const oceanEdge = this.mapX(-245) + 60;
    g.fillStyle = '#1d3f6e'; // ocean (west)
    g.fillRect(0, 0, oceanEdge, MAP_SIZE);
    g.fillStyle = '#d8b878'; // sand
    g.fillRect(oceanEdge, 0, this.mapX(-180) - oceanEdge, MAP_SIZE);
    g.fillStyle = '#232830'; // city ground
    g.fillRect(this.mapX(-180), 0, this.mapX(180) - this.mapX(-180), MAP_SIZE);
    g.fillStyle = '#4a5568'; // buildings
    for (const c of world.colliders) {
      if (c.maxX < -180) continue;
      g.fillRect(this.mapX(c.minX), this.mapZ(c.minZ), (c.maxX - c.minX) * MAP_SCALE, (c.maxZ - c.minZ) * MAP_SCALE);
    }
  }

  drawMapRoads(g) {
    g.strokeStyle = '#8a8578';
    g.lineWidth = 2.4;
    for (const c of ROAD_LINES) {
      g.beginPath();
      g.moveTo(this.mapX(c), 0);
      g.lineTo(this.mapX(c), MAP_SIZE);
      g.stroke();
      g.beginPath();
      g.moveTo(0, this.mapZ(c));
      g.lineTo(MAP_SIZE, this.mapZ(c));
      g.stroke();
    }
  }

  drawMapPier(g) {
    g.strokeStyle = '#8a6a3a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(this.mapX(-215), this.mapZ(145));
    g.lineTo(this.mapX(-215), this.mapZ(235));
    g.stroke();
  }

  drawMapMarker(g, missions) {
    if (!missions.beacon.visible) return;
    const pulse = 5 + Math.sin(performance.now() / 240) * 2;
    const bx = missions.beacon.position.x;
    const bz = missions.beacon.position.z;
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.arc(this.mapX(bx), this.mapZ(bz), pulse + 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(this.mapX(bx), this.mapZ(bz), pulse + 2, 0, Math.PI * 2);
    g.stroke();
  }

  drawMapHostiles(g, missions) {
    g.fillStyle = '#ff3030';
    for (const h of missions.hostiles) {
      if (h.dead) continue;
      g.beginPath();
      g.arc(this.mapX(h.x), this.mapZ(h.z), 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  drawMapTraffic(g, world) {
    g.fillStyle = '#e8e8e8';
    for (const c of world.traffic.cars) {
      if (c.dead) continue;
      g.fillRect(this.mapX(c.x) - 1.5, this.mapZ(c.z) - 1.5, 3, 3);
    }
  }

  drawMapPolice(g, world) {
    const blue = Math.floor(performance.now() / 200) % 2 === 0;
    g.fillStyle = blue ? '#3a7bff' : '#ff3030';
    for (const c of world.police.cars) {
      g.beginPath();
      g.arc(this.mapX(c.x), this.mapZ(c.z), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    if (!world.police.heli) return;
    // The helicopter gets a pulsing ring + HELI label on the minimap, so the
    // player can see the air threat coming, not just a red dot.
    const hx = this.mapX(world.police.heli.x);
    const hz = this.mapZ(world.police.heli.z);
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

  drawMapPlayer(g, player) {
    const p = player.pos;
    g.save();
    g.translate(this.mapX(p.x), this.mapZ(p.z));
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
