// fight.js — combat, weapon wheel UI, and the explosion / fire / smoke
// particle system. Explosions are sized to read on camera without blinding.
import * as THREE from "../vendor/three/three.module.min.js";
import { clamp, rand, pick } from "./util.js";

export const WEAPONS = [
  { id: "fists", name: "Fists", damage: 12, range: 2.2, rate: 0.45, price: 0 },
  { id: "pistol", name: "P9 Pistol", damage: 26, range: 34, rate: 0.32, price: 1200 },
  { id: "smg", name: "Sting SMG", damage: 17, range: 30, rate: 0.09, price: 4500 },
  { id: "shotgun", name: "Harbor 12G", damage: 55, range: 16, rate: 0.85, price: 6800 },
  { id: "rifle", name: "Longshore Rifle", damage: 48, range: 60, rate: 0.5, price: 12000 },
];

class ParticlePool {
  constructor(scene, max) {
    this.scene = scene;
    this.max = max || 420;
    this.items = [];
    const geo = new THREE.SphereGeometry(0.32, 6, 5);
    this.geo = geo;
    this.mats = {
      fire: new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 }),
      smoke: new THREE.MeshBasicMaterial({ color: 0x555560, transparent: true, opacity: 0.55 }),
      spark: new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 1 }),
    };
  }

  burst(x, y, z, kind, count, power) {
    const n = count || 26;
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.max) {
        const old = this.items.shift();
        this.scene.remove(old.mesh);
      }
      const mat = this.mats[kind] || this.mats.fire;
      const mesh = new THREE.Mesh(this.geo, mat);
      const a = rand(0, Math.PI * 2);
      const up = rand(0.2, 1);
      const sp = (power || 9) * rand(0.4, 1);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(rand(0.6, 1.6));
      this.scene.add(mesh);
      this.items.push({
        mesh, kind,
        vx: Math.sin(a) * sp, vy: up * sp, vz: Math.cos(a) * sp,
        life: rand(0.5, 1.4), maxLife: 1.4,
        grow: kind === "smoke" ? 2.4 : 0.4,
      });
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.items.splice(i, 1);
        continue;
      }
      p.vy -= (p.kind === "smoke" ? -1.2 : 6) * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.15, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      const s = p.mesh.scale.x + p.grow * dt;
      p.mesh.scale.setScalar(Math.min(s, 4.2));
      p.mesh.material.opacity = clamp(p.life / p.maxLife, 0, 1) * (p.kind === "fire" ? 0.9 : 0.55);
    }
  }
}

export function initFight(G) {
  G.fxPool = new ParticlePool(G.scene, 420);
  G.fx = {
    burst(x, y, z, kind, count, power) {
      G.fxPool.burst(x, y, z, kind, count, power);
    },
    explosion(x, y, z) {
      G.fxPool.burst(x, y + 0.5, z, "fire", 34, 11);
      G.fxPool.burst(x, y + 1.2, z, "smoke", 22, 6);
      G.fxPool.burst(x, y + 0.5, z, "spark", 18, 16);
      const light = new THREE.PointLight(0xff7a2a, 260, 55, 1.6);
      light.position.set(x, 4, z);
      G.scene.add(light);
      G.explosionLights = G.explosionLights || [];
      G.explosionLights.push({ light, t: 0 });
      if (G.sound) G.sound.explosion();
      if (G.shake) G.shake(0.6);
    },
  };
  G.weapons = WEAPONS;
  G.weaponIndex = 0;
  G.lastShotAt = 0;
  return G.fx;
}

export function updateExplosions(G, dt) {
  if (G.fxPool) G.fxPool.update(dt);
  if (G.explosionLights) {
    for (let i = G.explosionLights.length - 1; i >= 0; i--) {
      const e = G.explosionLights[i];
      e.t += dt;
      e.light.intensity = 260 * Math.max(0, 1 - e.t / 1.1);
      if (e.t > 1.1) {
        G.scene.remove(e.light);
        G.explosionLights.splice(i, 1);
      }
    }
  }
}

export function currentWeapon(G) {
  return WEAPONS[G.weaponIndex % WEAPONS.length];
}

export function cycleWeapon(G, dir) {
  const owned = (G.save && G.save.weapons) || ["fists"];
  const avail = WEAPONS.filter((w) => owned.includes(w.id));
  if (avail.length === 0) return currentWeapon(G);
  const cur = currentWeapon(G);
  let i = avail.findIndex((w) => w.id === cur.id);
  i = (i + dir + avail.length) % avail.length;
  G.weaponIndex = WEAPONS.findIndex((w) => w.id === avail[i].id);
  if (G.hud) G.hud.setWeapon(avail[i]);
  return avail[i];
}

// Fire the current weapon. On foot only; from a car it is a drive-by burst.
export function shoot(G) {
  const now = performance.now() / 1000;
  const w = currentWeapon(G);
  if (now - G.lastShotAt < w.rate) return false;
  G.lastShotAt = now;
  const p = G.player;
  const ox = p.pos.x + Math.sin(p.heading) * 1.2;
  const oz = p.pos.z + Math.cos(p.heading) * 1.2;
  if (w.id !== "fists" && G.sound) G.sound.gunshot();
  if (G.fx) G.fxPool.burst(ox, 1.3, oz, "spark", w.id === "shotgun" ? 10 : 5, 14);
  // Hit check: nearest police car inside range + a forward cone.
  let hit = null;
  let bestD = w.range;
  for (const cop of G.police || []) {
    const dx = cop.x - p.pos.x;
    const dz = cop.z - p.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > w.range) continue;
    const dot = (Math.sin(p.heading) * dx + Math.cos(p.heading) * dz) / (d || 1);
    if (dot > 0.55 && d < bestD) { bestD = d; hit = cop; }
  }
  if (hit) {
    hit.hp = (hit.hp || 60) - w.damage;
    if (G.toast) G.toast("Hit Bay PD unit — " + Math.max(0, Math.round(hit.hp)) + " HP left");
    if (hit.hp <= 0) {
      if (G.fx) G.fx.explosion(hit.x, 1, hit.z);
      G.scene.remove(hit.mesh);
      G.police.splice(G.police.indexOf(hit), 1);
      if (G.save) {
        G.save.cash += 150;
        if (G.hud) G.hud.setCash(G.save.cash);
      }
      if (G.wanted < 5 && G.setWanted) G.setWanted(G.wanted + 1);
    }
  } else if (w.id !== "fists") {
    // Missed shot still raises heat a touch when cops are near.
    if ((G.police || []).length > 0 && Math.random() < 0.3 && G.setWanted) {
      G.setWanted(Math.min(5, G.wanted + 0));
    }
  }
  return true;
}

// Weapon wheel: DOM ring built by hudkit; this just toggles it.
export function toggleWeaponWheel(G, show) {
  if (G.hud) G.hud.showWeaponWheel(show);
}
