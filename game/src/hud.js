// HUD for CORAL HEAT v2.2: the dense DOM overlay (mission panel, cash, wanted
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

  // Weapon widget: current weapon + mag/reserve ammo + owned slots 1-4.
  // The weapon has to be readable at a glance while driving.
  setArsenal(arsenal) {
    const d = arsenal.def();
    const state = arsenal.ammo[arsenal.current];
    const reloading = arsenal.reloading > 0;
    const slots = arsenal.order.map((t) => {
      const def = arsenal.defs[t];
      const owned = arsenal.owned.has(t);
      const active = t === arsenal.current;
      return `<span style="display:inline-block;margin-right:4px;padding:2px 6px;border-radius:4px;border:1px solid ${active ? '#ffd23e' : '#555'};background:${active ? '#ffd23e22' : 'transparent'};color:${owned ? '#fff' : '#777'}">${def.key} ${def.icon} ${owned ? '' : '🔒'}</span>`;
    }).join('');
    $('weapon').innerHTML = `<span style="font-size:15px">${d.icon} ${d.name}</span> <span style="color:#ffd23e;font-size:15px">${reloading ? 'RELOADING…' : `${state.mag}/${state.reserve}`}</span><br><span style="font-size:10px">${slots}</span>`;
  }

  setCoins(n) { $('coins').textContent = `🪙 ${n}/12`; }

  // Big mission intro card, bottom centre — the mission lands like a title card.
  showMissionCard(m) {
    const el = $('missionCard');
    el.innerHTML = `<div style="font-size:11px;letter-spacing:3px;color:#ff9a3d">MISSION ${m.id} / 12</div><div style="font-size:26px;font-weight:900;letter-spacing:1px">${m.title.toUpperCase()}</div><div style="font-size:13px;color:#d8d8e0">${m.giver}: ${m.brief}</div><div style="font-size:12px;color:#ffd23e;margin-top:4px">REWARD $${m.reward.toLocaleString()}</div>`;
    el.style.display = 'block';
    clearTimeout(this._cardTimer);
    this._cardTimer = setTimeout(() => { el.style.display = 'none'; }, 4200);
  }

  // Completion fanfare banner, centre — mission complete + payout.
  showComplete(m, cash) {
    const el = $('completeBanner');
    el.innerHTML = `<div style="font-size:30px;font-weight:900;color:#ffd23e;text-shadow:0 2px 12px #000">MISSION COMPLETE</div><div style="font-size:15px">${m.title} — <b>+$${m.reward.toLocaleString()}</b></div><div style="font-size:13px;color:#a5ff6e">Cash: $${Math.floor(cash).toLocaleString()}</div>`;
    el.style.display = 'block';
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => { el.style.display = 'none'; }, 3600);
  }

  // Gun shop panel: renders the buy list, wired by main.js.
  renderShop(arsenal, cash, onBuy) {
    const el = $('shopList');
    el.innerHTML = '';
    for (const t of arsenal.order) {
      const def = arsenal.defs[t];
      const owned = arsenal.owned.has(t);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin:4px 0;background:#181820;border:1px solid #333;border-radius:6px;';
      row.innerHTML = `<span style="font-size:14px">${def.icon} <b>${def.name}</b> <span style="color:#999;font-size:11px">DMG ${def.damage} · ${def.mag}rd</span></span>`;
      const btn = document.createElement('button');
      btn.textContent = owned ? 'OWNED ✓' : `$${def.price.toLocaleString()}`;
      btn.style.cssText = `padding:6px 10px;border-radius:5px;border:0;cursor:pointer;font-weight:700;background:${owned ? '#2a5a3a' : cash >= def.price ? '#ffd23e' : '#444'};color:${owned ? '#a5ff6e' : cash >= def.price ? '#111' : '#999'}`;
      btn.disabled = owned || cash < def.price;
      btn.addEventListener('click', () => onBuy(t));
      row.appendChild(btn);
      el.appendChild(row);
    }
    $('shopCash').textContent = `Cash: $${Math.floor(cash).toLocaleString()}`;
  }

  showShop(visible) { $('shopPanel').style.display = visible ? 'block' : 'none'; }

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
      // v2.1: the helicopter gets a pulsing ring + HELI label on the minimap,
      // so the player can see the air threat coming, not just a red dot
      const hx = px(world.police.heli.x), hz = pz(world.police.heli.z);
      const ring = 8 + Math.sin(performance.now() / 200) * 3;
      g.fillStyle = '#ff3030';
      g.beginPath(); g.arc(hx, hz, 4.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,48,48,0.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(hx, hz, ring, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#ff6a6a'; g.font = 'bold 9px sans-serif'; g.textAlign = 'left';
      g.fillText('HELI', hx + ring + 2, hz + 3);
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
