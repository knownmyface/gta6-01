// hudkit.js — the whole HUD: circular minimap (2D canvas), big speedometer,
// wanted stars, cash, mission panel, objective banner, radio label, weapon
// wheel, race panel, toasts, start / pause screens. All DOM, no assets.
import { $, formatCash, formatTime, clamp } from "./util.js";
import { WEAPONS } from "./fight.js";

export class Hud {
  constructor(G) {
    this.G = G;
    this.minimap = $("minimap");
    this.mm = this.minimap ? this.minimap.getContext("2d") : null;
    this.toastTimer = null;
    this.wheelVisible = false;
  }

  setWanted(level) {
    const w = $("wanted");
    if (!w) return;
    w.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const s = document.createElement("span");
      s.className = "star" + (i < level ? " lit" : "");
      s.textContent = "★";
      w.appendChild(s);
    }
    w.classList.toggle("hot", level >= 4);
  }

  setCash(cash) {
    const c = $("cash");
    if (c) c.textContent = formatCash(cash);
  }

  setMission(m) {
    const panel = $("mission-panel");
    const title = $("mission-title");
    const obj = $("mission-objective");
    if (!panel) return;
    if (!m) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";
    if (title) title.textContent = "MISSION " + m.id + " — " + m.title.toUpperCase();
    if (obj) obj.textContent = m.objective;
    this.banner(m.title + " — " + m.objective);
  }

  setWeapon(w) {
    const n = $("weapon-name");
    if (n) n.textContent = w ? w.name : "";
    if (this.wheelVisible) this.renderWheel();
  }

  setRace(race) {
    const panel = $("race-panel");
    if (!panel) return;
    if (!race) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";
    const name = $("race-name");
    const pos = $("race-pos");
    const lap = $("race-lap");
    const time = $("race-time");
    if (name) name.textContent = race.circuit.name.toUpperCase();
    if (pos) pos.textContent = "P" + (race.position || 4) + "/4";
    if (lap) lap.textContent = "LAP " + Math.min(race.lap, race.circuit.laps) + "/" + race.circuit.laps;
    if (time) {
      time.textContent = race.countdown > 0 ? String(Math.max(1, race.countdown)) : formatTime(race.elapsed || 0);
    }
  }

  banner(text) {
    const b = $("banner");
    if (!b) return;
    b.textContent = text;
    b.classList.add("show");
    window.clearTimeout(this._bannerTimer);
    this._bannerTimer = window.setTimeout(() => b.classList.remove("show"), 4200);
  }

  toast(text) {
    const t = $("toast");
    if (!t) return;
    t.textContent = text;
    t.classList.add("show");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove("show"), 3600);
  }

  setRadio(name) {
    const r = $("radio-label");
    if (r) r.textContent = "♪ " + name;
  }

  showWeaponWheel(show) {
    this.wheelVisible = show;
    const wheel = $("weapon-wheel");
    if (!wheel) return;
    wheel.style.display = show ? "block" : "none";
    if (show) this.renderWheel();
  }

  renderWheel() {
    const wheel = $("weapon-wheel");
    if (!wheel) return;
    wheel.innerHTML = "";
    const owned = (this.G.save && this.G.save.weapons) || ["fists"];
    const avail = WEAPONS.filter((w) => owned.includes(w.id));
    for (let i = 0; i < avail.length; i++) {
      const w = avail[i];
      const slot = document.createElement("div");
      slot.className = "wheel-slot" + (this.G.weaponIndex === WEAPONS.indexOf(w) ? " active" : "");
      const angle = (i / avail.length) * Math.PI * 2 - Math.PI / 2;
      slot.style.left = 50 + Math.cos(angle) * 34 + "%";
      slot.style.top = 50 + Math.sin(angle) * 34 + "%";
      slot.textContent = (i + 1) + " " + w.name;
      slot.onclick = () => {
        this.G.weaponIndex = WEAPONS.indexOf(w);
        this.setWeapon(w);
        this.showWeaponWheel(false);
      };
      wheel.appendChild(slot);
    }
    const center = document.createElement("div");
    center.className = "wheel-center";
    center.textContent = "WEAPONS";
    wheel.appendChild(center);
  }

  setDamage(dmg) {
    const bar = $("damage-fill");
    if (bar) bar.style.width = clamp(dmg || 0, 0, 100) + "%";
  }

  setSpeed(mph) {
    const s = $("speedo");
    if (s) s.textContent = String(Math.round(mph));
  }

  showStart(save) {
    const sc = $("start-screen");
    if (!sc) return;
    sc.style.display = "flex";
    const sub = $("start-save");
    if (sub) {
      sub.textContent = save && save.mission > 1
        ? "Continue — Mission " + save.mission + " • " + formatCash(save.cash)
        : "New game — Reef arrives in Coral Bay";
    }
  }

  hideStart() {
    const sc = $("start-screen");
    if (sc) sc.style.display = "none";
  }

  showPause(show) {
    const p = $("pause-screen");
    if (p) p.style.display = show ? "flex" : "none";
  }

  // Minimap: top-down 2D canvas — roads, water, casino, marina, player arrow,
  // police dots, mission beacon. Drawn every frame, cheap.
  drawMinimap() {
    if (!this.mm || !this.minimap) return;
    const G = this.G;
    const ctx = this.mm;
    const S = 168;
    const half = 360;
    const px = (x) => ((x + half) / (half * 2)) * S;
    const pz = (z) => ((z + half) / (half * 2)) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#20242e";
    ctx.fillRect(0, 0, S, S);
    // Water band (north).
    ctx.fillStyle = "#1d6f8f";
    ctx.fillRect(0, 0, S, pz(-190));
    ctx.fillStyle = "#d9b380";
    ctx.fillRect(0, pz(-190), S, pz(-168) - pz(-190));
    // Roads.
    ctx.strokeStyle = "#4a4d58";
    ctx.lineWidth = 4;
    for (let x = -300; x <= 300; x += 60) {
      ctx.beginPath(); ctx.moveTo(px(x), pz(-200)); ctx.lineTo(px(x), pz(330)); ctx.stroke();
    }
    for (let z = -180; z <= 300; z += 60) {
      ctx.beginPath(); ctx.moveTo(px(-330), pz(z)); ctx.lineTo(px(330), pz(z)); ctx.stroke();
    }
    ctx.strokeStyle = "#5a5d68";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(px(-330), pz(-168)); ctx.lineTo(px(330), pz(-168)); ctx.stroke();
    // Casino + marina markers.
    ctx.fillStyle = "#ff5ad1";
    ctx.beginPath(); ctx.arc(px(30), pz(-120), 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#37b6ff";
    ctx.beginPath(); ctx.arc(px(-120), pz(-185), 4, 0, Math.PI * 2); ctx.fill();
    // Mission beacon.
    const m = G.missions ? G.missions[G.missionIndex] : null;
    if (m) {
      const bx = px(m.target.x);
      const bz = pz(m.target.z);
      const pulse = 5 + Math.sin(performance.now() / 300) * 2;
      ctx.fillStyle = "#ffd23c";
      ctx.beginPath(); ctx.arc(bx, bz, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffd23c";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, bz, pulse + 4, 0, Math.PI * 2); ctx.stroke();
    }
    // Police dots.
    ctx.fillStyle = "#5a8cff";
    for (const cop of G.police || []) {
      ctx.beginPath(); ctx.arc(px(cop.x), pz(cop.z), 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Traffic dots.
    ctx.fillStyle = "#c8c8c8";
    for (const t of G.traffic || []) {
      ctx.fillRect(px(t.x) - 1, pz(t.z) - 1, 2, 2);
    }
    // Player arrow.
    const pxx = px(G.player.pos.x);
    const pzz = pz(G.player.pos.z);
    ctx.save();
    ctx.translate(pxx, pzz);
    ctx.rotate(-G.player.heading + Math.PI);
    ctx.fillStyle = "#ff5a2a";
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Ring + N label.
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("N", S / 2, 13);
  }
}
