// HUD for CORAL HEAT: the dense DOM overlay (mission panel, cash, wanted
// stars, objective banner, speed, radio, health) and the circular minimap
// canvas — roads, beach, buildings, player, traffic, police, hostiles and
// the gold mission marker, redrawn every frame.
import { clamp } from './rng.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.minimap = $('minimap');
    this.mm = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.lastObjective = '';
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

  setCash(cash) { $('cash').textContent = `$${Math.floor(cash).toLocaleString()}`; }

  setWanted(n) {
    const stars = $('wanted').children;
    for (let i = 0; i < 5; i++) {
      stars[i].className = i < n ? 'on' : 'off';
    }
  }

  setDistrict(name) { $('district').textContent = `${name} • CORAL BAY`; }

  setSpeed(mph, carName) {
    $('speed').innerHTML = `${Math.round(Math.abs(mph))}<small> MPH</small>`;
    $('carName').textContent = carName;
  }

  setHealth(h) {
    $('healthNum').textContent = Math.ceil(h);
    $('healthFill').style.width = `${clamp(h, 0, 100)}%`;
    $('healthFill').style.background = h > 50
      ? 'linear-gradient(90deg,#37e08a,#a5ff6e)'
      : h > 25 ? 'linear-gradient(90deg,#ffb347,#ffd23e)' : 'linear-gradient(90deg,#ff2e2e,#ff7a5a)';
  }

  setRadio(station) {
    $('radioName').textContent = station.name;
    $('radioTrack').textContent = station.track;
  }

  setWeapon(text) { $('weapon').textContent = text; }

  toast(title, body) {
    const el = $('toast');
    el.innerHTML = `<b style="color:#ffb347">${title}</b><br>${body}`;
    el.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 4200);
  }

  // --- minimap: world is 560 wide, map is 196px ---
  drawMinimap(world, player, missions) {
    const g = this.mm;
    const S = 196, C = S / 2, K = S / 560;
    const px = (x) => C + x * K;
    const pz = (z) => C + z * K;
    g.clearRect(0, 0, S, S);
    // ocean + sand (west)
    g.fillStyle = '#1d3f6e'; g.fillRect(0, 0, px(-245) + 60, S);
    g.fillStyle = '#d8b878'; g.fillRect(px(-245) + 60, 0, px(-180) - (px(-245) + 60), S);
    // city ground
    g.fillStyle = '#232830'; g.fillRect(px(-180), 0, px(180) - px(-180), S);
    // buildings
    g.fillStyle = '#4a5568';
    for (const c of world.colliders) {
      if (c.maxX < -180) continue;
      g.fillRect(px(c.minX), pz(c.minZ), (c.maxX - c.minX) * K, (c.maxZ - c.minZ) * K);
    }
    // roads
    g.strokeStyle = '#8a8578'; g.lineWidth = 2.4;
    for (const c of [-160, -120, -80, -40, 0, 40, 80, 120, 160]) {
      g.beginPath(); g.moveTo(px(c), 0); g.lineTo(px(c), S); g.stroke();
      g.beginPath(); g.moveTo(0, pz(c)); g.lineTo(S, pz(c)); g.stroke();
    }
    // marina pier
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(px(-215), pz(145)); g.lineTo(px(-215), pz(235)); g.stroke();
    // mission marker (gold, pulsing)
    const pulse = 5 + Math.sin(performance.now() / 240) * 2;
    if (missions.beacon.visible) {
      const bx = missions.beacon.position.x, bz = missions.beacon.position.z;
      g.fillStyle = '#ffd23e';
      g.beginPath(); g.arc(px(bx), pz(bz), pulse + 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(px(bx), pz(bz), pulse + 2, 0, Math.PI * 2); g.stroke();
    }
    // hostiles (red)
    g.fillStyle = '#ff3030';
    for (const h of missions.hostiles) {
      if (h.dead) continue;
      g.beginPath(); g.arc(px(h.x), pz(h.z), 3, 0, Math.PI * 2); g.fill();
    }
    // traffic (white)
    g.fillStyle = '#e8e8e8';
    for (const c of world.traffic.cars) {
      if (c.dead) continue;
      g.fillRect(px(c.x) - 1.5, pz(c.z) - 1.5, 3, 3);
    }
    // police (flashing blue/red)
    const blue = Math.floor(performance.now() / 200) % 2 === 0;
    g.fillStyle = blue ? '#3a7bff' : '#ff3030';
    for (const c of world.police.cars) {
      g.beginPath(); g.arc(px(c.x), pz(c.z), 3.5, 0, Math.PI * 2); g.fill();
    }
    if (world.police.heli) {
      g.fillStyle = '#ff3030';
      g.beginPath(); g.arc(px(world.police.heli.x), pz(world.police.heli.z), 4.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ff3030'; g.lineWidth = 1;
      g.beginPath(); g.arc(px(world.police.heli.x), pz(world.police.heli.z), 7, 0, Math.PI * 2); g.stroke();
    }
    // player arrow (white, heading)
    const p = player.pos;
    g.save();
    g.translate(px(p.x), pz(p.z));
    g.rotate(Math.PI - player.heading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111'; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath();
    g.fill(); g.stroke();
    g.restore();
    // north + border
    g.fillStyle = '#ffd9a0'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left';
    g.fillText('N', 8, 14);
  }
}
