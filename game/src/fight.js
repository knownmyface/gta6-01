// Coral Heat — combat: four weapons, hitscan shooting with tracers,
// the weapon wheel UI, and explosion / fire / smoke particle effects
// sized to read clearly without overwhelming the frame.
import * as THREE from 'three';
import { clamp, rand } from './util.js';

export const WEAPONS = [
  { id: 'pistol', name: 'P9 Pistol', damage: 22, rate: 0.32, range: 70, ammo: 120, color: 0xffe9a8 },
  { id: 'smg', name: 'Sting SMG', damage: 12, rate: 0.09, range: 60, ammo: 240, color: 0xffd75a },
  { id: 'shotgun', name: 'Boomstick', damage: 16, rate: 0.85, range: 34, ammo: 48, color: 0xff8a5a },
  { id: 'rifle', name: 'Coral Rifle', damage: 42, rate: 0.5, range: 130, ammo: 90, color: 0x7affc9 },
];

export function initWeapons(G) {
  G.weapons = WEAPONS.map((w) => ({ ...w, reserve: w.ammo }));
  G.weaponIndex = 0;
  G.player.weapon = G.weapons[0];
  G.player.firing = false;
  G.shotCooldown = 0;
}

export function cycleWeapon(G, dir = 1) {
  G.weaponIndex = (G.weaponIndex + dir + G.weapons.length) % G.weapons.length;
  G.player.weapon = G.weapons[G.weaponIndex];
  if (G.hud) G.hud.setWeapon(G.player.weapon);
  if (G.sfx) G.sfx('swap');
}

export function selectWeapon(G, index) {
  if (index < 0 || index >= G.weapons.length) return;
  G.weaponIndex = index;
  G.player.weapon = G.weapons[index];
  if (G.hud) G.hud.setWeapon(G.player.weapon);
}

function muzzleWorld(G) {
  const p = G.player.pos;
  const fx = Math.sin(G.player.heading);
  const fz = Math.cos(G.player.heading);
  const y = G.player.mode === 'foot' ? 1.4 : 1.1;
  return new THREE.Vector3(p.x + fx * 1.4, y, p.z + fz * 1.4);
}

export function shoot(G) {
  if (G.shotCooldown > 0) return;
  const w = G.player.weapon;
  if (!w || w.reserve <= 0) {
    if (G.sfx) G.sfx('empty');
    G.shotCooldown = 0.25;
    return;
  }
  w.reserve -= 1;
  G.shotCooldown = w.rate;
  G.player.firing = true;
  const from = muzzleWorld(G);
  const spread = w.id === 'shotgun' ? 0.09 : 0.02;
  const pellets = w.id === 'shotgun' ? 6 : 1;
  const fx = Math.sin(G.player.heading);
  const fz = Math.cos(G.player.heading);
  for (let i = 0; i < pellets; i++) {
    const a = G.player.heading + rand(-spread, spread);
    const dir = new THREE.Vector3(Math.sin(a), rand(-0.02, 0.03), Math.cos(a));
    const to = from.clone().addScaledVector(dir, w.range);
    const tracer = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, w.range),
      new THREE.MeshBasicMaterial({ color: w.color, transparent: true, opacity: 0.85 })
    );
    tracer.position.copy(from).addScaledVector(dir, w.range / 2);
    tracer.lookAt(to);
    G.scene.add(tracer);
    G.tracers.push({ mesh: tracer, life: 0.09 });
    // hit the nearest cop / ped roughly along the shot line
    const targets = [...G.cops, ...G.peds];
    for (const t of targets) {
      const tx = t.pos.x - from.x;
      const tz = t.pos.z - from.z;
      const along = tx * dir.x + tz * dir.z;
      if (along > 0 && along < w.range) {
        const perp = Math.abs(tx * dir.z - tz * dir.x);
        if (perp < 2.2) {
          if (t.health === undefined) t.health = 100;
          t.health -= w.damage;
          if (t.health <= 0) {
            if (G.cops.includes(t)) {
              const idx = G.cops.indexOf(t);
              G.cops.splice(idx, 1);
              G.scene.remove(t.mesh);
              spawnExplosion(G, t.pos, 1.1);
              G.player.cash += 150;
            } else {
              const idx = G.peds.indexOf(t);
              if (idx >= 0) {
                G.peds.splice(idx, 1);
                G.scene.remove(t.mesh);
              }
            }
          }
          break;
        }
      }
    }
  }
  // muzzle flash
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 })
  );
  flash.position.copy(from);
  G.scene.add(flash);
  G.tracers.push({ mesh: flash, life: 0.06 });
  if (G.sfx) G.sfx('shot');
  if (G.player.mode === 'foot') setWantedIfNeeded(G);
}

function setWantedIfNeeded(G) {
  // firing a gun in public draws the law
  if (G.player.wanted < 2) {
    import('./cops.js').then((m) => m.setWanted(G, 2, 'shots fired in public'));
  }
}

export function updateCombat(G, dt) {
  G.shotCooldown = Math.max(0, G.shotCooldown - dt);
  if (!G.keys['Mouse0']) G.player.firing = false;
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    const t = G.tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      G.scene.remove(t.mesh);
      G.tracers.splice(i, 1);
    }
  }
  updateExplosions(G, dt);
}

// --- explosions: fire ball + smoke column, sized to read, not swamp ---
export function spawnExplosion(G, pos, scale = 1) {
  const group = new THREE.Group();
  group.position.set(pos.x, 1.2, pos.z);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.95 });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 });
  const fire = new THREE.Mesh(new THREE.SphereGeometry(2.4 * scale, 12, 10), fireMat);
  fire.scale.y = 0.8;
  group.add(fire);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.3 * scale, 10, 8), coreMat);
  group.add(core);
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.75 });
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(0.9, 1.6) * scale, 8, 6), smokeMat);
    puff.position.set(rand(-1.6, 1.6) * scale, rand(1.5, 5.5) * scale, rand(-1.6, 1.6) * scale);
    group.add(puff);
    puffs.push(puff);
  }
  const glow = new THREE.PointLight(0xff8a2a, 5, 42 * scale);
  glow.position.y = 2;
  group.add(glow);
  G.scene.add(group);
  G.explosions.push({ group, fire, core, puffs, glow, life: 1.6, maxLife: 1.6, scale });
  if (G.sfx) G.sfx('explosion');
  // collateral: nearby cops take damage
  for (const c of [...G.cops]) {
    if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < 9 * scale) {
      c.health = (c.health ?? 100) - 120;
      if (c.health <= 0) {
        G.cops.splice(G.cops.indexOf(c), 1);
        G.scene.remove(c.mesh);
      }
    }
  }
}

export function updateExplosions(G, dt) {
  for (let i = G.explosions.length - 1; i >= 0; i--) {
    const e = G.explosions[i];
    e.life -= dt;
    const t = clamp(e.life / e.maxLife, 0, 1);
    const grow = 1 + (1 - t) * 0.9;
    e.fire.scale.set(grow, grow * 0.8, grow);
    e.fire.material.opacity = 0.95 * t;
    e.core.scale.setScalar(grow * 0.9);
    e.core.material.opacity = 0.95 * t;
    e.glow.intensity = 5 * t;
    for (const p of e.puffs) {
      p.position.y += dt * 4.5;
      p.scale.multiplyScalar(1 + dt * 1.4);
      p.material.opacity = 0.75 * t;
    }
    if (e.life <= 0) {
      G.scene.remove(e.group);
      G.explosions.splice(i, 1);
    }
  }
}

// --- weapon wheel: radial picker, hold Q ---
export function buildWeaponWheel(G) {
  const wheel = document.getElementById('weapon-wheel');
  if (!wheel) return;
  wheel.innerHTML = '';
  G.weapons.forEach((w, i) => {
    const slot = document.createElement('div');
    slot.className = 'wheel-slot';
    slot.textContent = (i + 1) + '  ' + w.name + '  ·  ' + w.reserve;
    slot.dataset.index = i;
    slot.addEventListener('click', () => {
      selectWeapon(G, i);
      wheel.style.display = 'none';
    });
    wheel.appendChild(slot);
  });
  G.weaponWheelEl = wheel;
}

export function refreshWeaponWheel(G) {
  if (!G.weaponWheelEl) return;
  const slots = G.weaponWheelEl.querySelectorAll('.wheel-slot');
  slots.forEach((s, i) => {
    const w = G.weapons[i];
    s.textContent = (i + 1) + '  ' + w.name + '  ·  ' + w.reserve;
    s.classList.toggle('active', i === G.weaponIndex);
  });
}
