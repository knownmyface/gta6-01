// CORAL HEAT v2.8 — the dashboard: job panel, cash + wanted stars, health and
// vehicle damage bars, nitro meter, a circular minimap, speedometer, radio
// strip, weapon slots and the objective banner. Everything legible at a
// glance, even shrunk to a thumb. The minimap projects the world through one
// projector closure so every dot uses the same math.

import { moneyText } from './rng.js';

const HEAT_WORDS = ['CLEAR', 'SUSPICIOUS', 'PURSUIT', 'MANHUNT', 'LOCKDOWN', 'MAXIMUM HEAT'];
const HEAT_COLORS = ['#9fe8ff', '#ffd23f', '#ffb347', '#ff8a5c', '#ff5a3c', '#ff2a1a'];
const DOCK_ROWS = [84, 124, 164, 204];

export class Dashboard {
  constructor(world) {
    this.world = world;
    this.el = {
      jobLabel: document.getElementById('job-label'),
      jobName: document.getElementById('job-name'),
      jobTask: document.getElementById('job-task'),
      jobFill: document.getElementById('job-fill'),
      cash: document.getElementById('cash-amount'),
      stars: document.getElementById('wanted-stars'),
      healthFill: document.getElementById('health-bar'),
      damageFill: document.getElementById('damage-bar'),
      nitroFill: document.getElementById('nitro-bar'),
      heatLabel: document.getElementById('heat-word'),
      loc: document.getElementById('district-tag'),
      map: document.getElementById('minimap-canvas'),
      speed: document.getElementById('speed-read'),
      vehicle: document.getElementById('vehicle-tag'),
      gear: document.getElementById('driver-tag'),
      radio: document.getElementById('radio-strip'),
      objective: document.getElementById('objective-strip'),
      prompt: document.getElementById('action-cue'),
      banner: document.getElementById('mission-banner'),
      crosshair: document.getElementById('aim-dot'),
      vignette: document.getElementById('hurt-vignette'),
      toast: document.getElementById('toast-note'),
    };
    this.mapCtx = this.el.map.getContext('2d');
    this.bannerTimer = 0;
    this.toastTimer = 0;
    this.quiet = false; // staged screenshots: no banners or toasts over the scene
  }
  flashBanner(title, sub) {
    if (this.quiet) return;
    this.el.banner.innerHTML = `${title}<small>${sub || ''}</small>`;
    this.el.banner.style.display = 'block';
    this.bannerTimer = 3.2;
  }
  note(text) {
    if (this.quiet) return;
    this.el.toast.textContent = text;
    this.el.toast.style.display = 'block';
    this.toastTimer = 2.6;
  }
  cue(text) {
    if (text) {
      this.el.prompt.textContent = text;
      this.el.prompt.style.display = 'block';
    } else {
      this.el.prompt.style.display = 'none';
    }
  }
  // state: everything the frame needs, gathered by game.js
  draw(s, dt) {
    const m = s.job;
    this.el.jobLabel.textContent = m ? `MISSION ${m.id} / 12${m.boat ? ' · BOAT JOB' : ''}` : 'FREE ROAM — CORAL BAY';
    this.el.jobName.textContent = m ? m.name : 'Coral Bay';
    this.el.jobTask.textContent = s.objectiveText || 'Explore the city. Press P to save.';
    this.el.jobFill.style.width = `${Math.round((s.jobProgress || 0) * 100)}%`;
    this.el.cash.textContent = moneyText(s.cash);
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '<span class="off">★</span>';
    this.el.stars.innerHTML = stars;
    this.el.healthFill.style.width = `${Math.round(s.health)}%`;
    this.el.damageFill.style.width = `${Math.round(s.vehicleDamage || 0)}%`;
    this.el.nitroFill.style.width = `${Math.round((s.nitro ?? 1) * 100)}%`;
    const hw = HEAT_WORDS[s.wanted] || 'CLEAR';
    this.el.heatLabel.textContent = `CORAL BAY PD — ${hw}`;
    this.el.heatLabel.style.color = HEAT_COLORS[s.wanted] || '#9fe8ff';
    this.el.loc.textContent = this.world.districtName(s.x, s.z);
    const mph = Math.round(Math.abs(s.speed) * 2.2);
    this.el.speed.innerHTML = `${mph} <small>MPH</small>`;
    this.el.vehicle.textContent = s.vehicleName || 'ON FOOT';
    this.el.gear.textContent = s.gearText || 'KAI SOLANO';
    this.el.radio.innerHTML = `♪ <b>${s.stationName}</b> — “${s.trackName}”`;
    this.el.objective.textContent = s.objectiveText || '';
    // weapon slots
    for (let i = 0; i < 3; i++) {
      const slot = document.getElementById(`gun-${i}`);
      if (!slot) continue;
      slot.classList.toggle('active', s.weaponSlot === i);
      const ammo = slot.querySelector('.ammo');
      if (ammo) ammo.textContent = s.weaponAmmo[i] || '';
    }
    this.el.crosshair.style.display = s.mode === 'foot' && s.weaponOut ? 'block' : 'none';
    const lowHp = s.health < 35;
    this.el.vignette.style.opacity = lowHp ? String(0.55 + Math.sin(performance.now() / 240) * 0.25) : '0';
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.style.display = 'none';
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.style.display = 'none';
    }
    this.drawMap(s);
  }
  drawMap(s) {
    const ctx = this.mapCtx;
    const S = 196;
    const C = S / 2;
    // projector: world coords -> disc coords, player always centred
    const k = (S / 620) * 3.2;
    const project = (x, z) => [C + (x - s.x) * k, C + (z - s.z) * k];
    const line = (x1, z1, x2, z2) => {
      const [ax, ay] = project(x1, z1);
      const [bx, by] = project(x2, z2);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };
    const dot = (x, z, color, r) => {
      const [dx, dy] = project(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.clearRect(0, 0, S, S);
    // clip to the disc first: corners stay transparent
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 2, 0, Math.PI * 2);
    ctx.clip();
    // sea on the west edge of the disc, land east of it
    ctx.fillStyle = '#0f3a5c';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#3a3752';
    ctx.fillRect(C - 40, 0, S, S);
    // roads
    ctx.strokeStyle = 'rgba(220,210,170,.55)';
    ctx.lineWidth = 2;
    for (const v of this.world.roads) {
      line(v, -260, v, 260);
      line(-260, v, 260, v);
    }
    // marina docks
    ctx.strokeStyle = '#c9a06a';
    ctx.lineWidth = 3;
    for (const z of DOCK_ROWS) line(-180, z, -260, z);
    // mission marker, pulsing
    if (s.marker) {
      const [mx, my] = project(s.marker.x, s.marker.z);
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
    for (const c of s.police || []) dot(c.x, c.z, '#ff3b30', 3);
    for (const b of s.boats || []) dot(b.x, b.z, '#2fd4c4', 2.5);
    for (const c of s.traffic || []) dot(c.x, c.z, 'rgba(255,255,255,.6)', 1.8);
    // player arrow, always centred, pointing along heading
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(-s.heading);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff6b4a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    // ring
    ctx.strokeStyle = 'rgba(255,180,120,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(C, C, C - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
