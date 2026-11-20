// Coral Heat — the HUD: mission panel, cash + wanted stars, health and vehicle
// damage bars, a circular minimap, speedometer, radio strip, weapon slots and
// the objective banner. Everything legible at a glance, even shrunk to a thumb.

import { cashText } from './rng.js';

const HEAT_WORDS = ['CLEAR', 'SUSPICIOUS', 'PURSUIT', 'MANHUNT', 'LOCKDOWN', 'MAXIMUM HEAT'];
const HEAT_COLORS = ['#9fe8ff', '#ffd23f', '#ffb347', '#ff8a5c', '#ff5a3c', '#ff2a1a'];

export class Hud {
  constructor(world) {
    this.world = world;
    this.el = {
      missionLabel: document.getElementById('hud-mission-label'),
      missionName: document.getElementById('hud-mission-name'),
      missionObj: document.getElementById('hud-mission-obj'),
      missionFill: document.getElementById('hud-mission-fill'),
      cash: document.getElementById('hud-cash'),
      stars: document.getElementById('hud-stars'),
      healthFill: document.getElementById('hud-health-fill'),
      damageFill: document.getElementById('hud-damage-fill'),
      heatLabel: document.getElementById('hud-heat-label'),
      loc: document.getElementById('hud-loc'),
      map: document.getElementById('minimap'),
      speed: document.getElementById('hud-speed'),
      vehicle: document.getElementById('hud-vehicle'),
      gear: document.getElementById('hud-gear'),
      radio: document.getElementById('hud-radio'),
      objective: document.getElementById('hud-objective'),
      prompt: document.getElementById('hud-prompt'),
      banner: document.getElementById('hud-banner'),
      crosshair: document.getElementById('crosshair'),
      vignette: document.getElementById('vignette'),
      toast: document.getElementById('toast'),
    };
    this.mapCtx = this.el.map.getContext('2d');
    this.bannerTimer = 0;
    this.toastTimer = 0;
    this.quiet = false; // staged screenshots: no banners or toasts over the scene
  }
  showBanner(title, sub) {
    if (this.quiet) return;
    this.el.banner.innerHTML = `${title}<small>${sub || ''}</small>`;
    this.el.banner.style.display = 'block';
    this.bannerTimer = 3.2;
  }
  toast(text) {
    if (this.quiet) return;
    this.el.toast.textContent = text;
    this.el.toast.style.display = 'block';
    this.toastTimer = 2.6;
  }
  prompt(text) {
    if (text) {
      this.el.prompt.textContent = text;
      this.el.prompt.style.display = 'block';
    } else {
      this.el.prompt.style.display = 'none';
    }
  }
  // state: everything the frame needs, gathered by main.js
  update(s, dt) {
    const m = s.mission;
    this.el.missionLabel.textContent = m ? `MISSION ${m.id} / 12${m.boat ? ' · BOAT JOB' : ''}` : 'FREE ROAM — CORAL BAY';
    this.el.missionName.textContent = m ? m.name : 'Coral Bay';
    this.el.missionObj.textContent = s.objectiveText || 'Explore the city. Press P to save.';
    this.el.missionFill.style.width = `${Math.round((s.missionProgress || 0) * 100)}%`;
    this.el.cash.textContent = cashText(s.cash);
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '<span class="off">★</span>';
    this.el.stars.innerHTML = stars;
    this.el.healthFill.style.width = `${Math.round(s.health)}%`;
    this.el.damageFill.style.width = `${Math.round(s.vehicleDamage || 0)}%`;
    const hw = HEAT_WORDS[s.wanted] || 'CLEAR';
    this.el.heatLabel.textContent = `CORAL BAY PD — ${hw}`;
    this.el.heatLabel.style.color = HEAT_COLORS[s.wanted] || '#9fe8ff';
    this.el.loc.textContent = this.world.districtAt(s.x, s.z);
    const mph = Math.round(Math.abs(s.speed) * 2.2);
    this.el.speed.innerHTML = `${mph} <small>MPH</small>`;
    this.el.vehicle.textContent = s.vehicleName || 'ON FOOT';
    this.el.gear.textContent = s.gearText || 'KAI SOLANO';
    this.el.radio.innerHTML = `♪ <b>${s.stationName}</b> — “${s.trackName}”`;
    this.el.objective.textContent = s.objectiveText || '';
    // weapon slots
    for (let i = 0; i < 3; i++) {
      const slot = document.getElementById(`slot-${i}`);
      if (!slot) continue;
      slot.classList.toggle('active', s.weaponSlot === i);
      const ammo = slot.querySelector('.ammo');
      if (ammo) ammo.textContent = s.weaponAmmo[i] || '';
    }
    this.el.crosshair.style.display = s.mode === 'foot' && s.weaponOut ? 'block' : 'none';
    this.el.vignette.style.opacity = s.health < 35 ? String(0.55 + Math.sin(performance.now() / 240) * 0.25) : '0';
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.style.display = 'none';
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.style.display = 'none';
    }
    this.drawMinimap(s);
  }
  drawMinimap(s) {
    const ctx = this.mapCtx;
    const S = 196, C = S / 2;
    const scale = S / 620; // world -310..310 maps to the disc
    const toMap = (x, z) => [C + (x - s.x) * scale * 3.2, C + (z - s.z) * scale * 3.2];
    ctx.clearRect(0, 0, S, S);
    // clip to the disc first: corners stay transparent, the circle is drawn
    // by the canvas itself (no CSS overflow clipping on the element)
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 2, 0, Math.PI * 2);
    ctx.clip();
    // sea on the west edge of the disc
    ctx.fillStyle = '#0f3a5c';
    ctx.fillRect(0, 0, S, S);
    // land
    ctx.fillStyle = '#3a3752';
    ctx.fillRect(C - 40, 0, S, S); // rough landmass east of the bay
    // roads
    ctx.strokeStyle = 'rgba(220,210,170,.55)';
    ctx.lineWidth = 2;
    for (const v of this.world.roads) {
      const [x1, y1] = toMap(v, -260);
      const [x2, y2] = toMap(v, 260);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(-260, v);
      const [x4, y4] = toMap(260, v);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // marina docks
    ctx.strokeStyle = '#c9a06a';
    ctx.lineWidth = 3;
    for (const z of [80, 120, 160, 200]) {
      const [x1, y1] = toMap(-180, z);
      const [x2, y2] = toMap(-260, z);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // mission marker
    if (s.marker) {
      const [mx, my] = toMap(s.marker.x, s.marker.z);
      const pulse = 6 + Math.sin(performance.now() / 300) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse);
      ctx.lineTo(mx + pulse * 0.7, my);
      ctx.lineTo(mx, my + pulse);
      ctx.lineTo(mx - pulse * 0.7, my);
      ctx.closePath();
      ctx.fill();
    }
    // police = red dots, boats = cyan, traffic = pale
    const dot = (x, z, color, r) => {
      const [dx, dy] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const c of s.police || []) dot(c.x, c.z, '#ff3b30', 3);
    for (const b of s.boats || []) dot(b.x, b.z, '#2fd4c4', 2.5);
    for (const c of s.traffic || []) dot(c.x, c.z, 'rgba(255,255,255,.6)', 1.8);
    // player arrow, always centred, pointing along heading
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(-s.heading);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff6b4a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    // ring
    ctx.strokeStyle = 'rgba(255,180,120,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.stroke();
  }
}
