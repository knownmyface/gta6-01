// fight.js — combat: four weapons, hitscan shooting with tracer + muzzle flash,
// the weapon wheel UI (hold Q), and explosion / fire / smoke particle effects.
import * as THREE from 'three';
import { rand, pick, clamp, chance } from './util.js';

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 22, rate: 0.32, range: 60, spread: 0.012, color: 0xffd23e, auto: false },
  smg: { name: 'Reef SMG', damage: 11, rate: 0.09, range: 46, spread: 0.03, color: 0x22e6ff, auto: true },
  shotgun: { name: 'Tide Shotgun', damage: 16, rate: 0.85, range: 26, spread: 0.07, color: 0xff7a1a, auto: false, pellets: 6 },
  rifle: { name: 'Coral Rifle', damage: 38, rate: 0.55, range: 95, spread: 0.006, color: 0xc86bff, auto: false },
};

export const WHEEL_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

export function initFight(W) {
  W.fx = {
    parts: [],
    burst(x, y, z, kind, n = 12) { burst(W, x, y, z, kind, n); },
    explode(x, y, z, big = false) { explode(W, x, y, z, big); },
  };
  W.shootCooldown = 0;
  W.wheelOpen = false;
  W.muzzle = null;
}

function spawnPart(W, x, y, z, vx, vy, vz, color, size, life, kind) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 5), mat);
  m.position.set(x, y, z);
  W.scene.add(m);
  W.fx.parts.push({ m, vx, vy, vz, life, maxLife: life, kind, size });
}

export function burst(W, x, y, z, kind, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const up = rand(0.5, 1);
    if (kind === 'fire') {
      spawnPart(W, x, y, z, Math.sin(a) * rand(1, 5), rand(2, 8), Math.cos(a) * rand(1, 5),
        pick([0xff7a1a, 0xffc21a, 0xff3d00]), rand(0.3, 0.8), rand(0.5, 1.1), 'fire');
    } else if (kind === 'smoke') {
      spawnPart(W, x, y + rand(0, 1), z, Math.sin(a) * rand(0.3, 1.2), rand(1, 2.5), Math.cos(a) * rand(0.3, 1.2),
        0x555560, rand(0.5, 0.9), rand(1.6, 3), 'smoke');
    } else if (kind === 'spark') {
      spawnPart(W, x, y, z, Math.sin(a) * rand(4, 12), rand(2, 9), Math.cos(a) * rand(4, 12),
        0xfff2b0, rand(0.1, 0.25), rand(0.3, 0.7), 'spark');
    } else if (kind === 'blood') {
      spawnPart(W, x, y, z, Math.sin(a) * rand(1, 3), rand(1, 3), Math.cos(a) * rand(1, 3),
        0xaa1111, rand(0.15, 0.3), rand(0.4, 0.8), 'blood');
    }
  }
}

export function explode(W, x, y, z, big = false) {
  const n = big ? 42 : 22;
  burst(W, x, y + 0.5, z, 'fire', n);
  burst(W, x, y + 1, z, 'smoke', big ? 20 : 10);
  burst(W, x, y + 0.5, z, 'spark', big ? 26 : 12);
  // Flash light so the explosion reads at dusk.
  const light = new THREE.PointLight(0xff7a1a, 500, 60, 1.6);
  light.position.set(x, y + 2, z);
  W.scene.add(light);
  W.fx.parts.push({ m: light, vx: 0, vy: 0, vz: 0, life: 0.35, maxLife: 0.35, kind: 'flash', size: 0 });
  W.sound?.boom();
  W.events.push({ type: 'explosion', big });
}

// Tracer line from the muzzle to the hit point.
function tracer(W, from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  W.scene.add(line);
  W.fx.parts.push({ m: line, vx: 0, vy: 0, vz: 0, life: 0.09, maxLife: 0.09, kind: 'tracer', size: 0 });
}

export function shoot(W) {
  const p = W.player;
  const w = WEAPONS[p.weapon];
  const owned = p.weapons[p.weapon];
  if (!w || !owned?.owned || owned.ammo <= 0 || W.shootCooldown > 0) return false;
  W.shootCooldown = w.rate;
  owned.ammo -= 1;
  const origin = new THREE.Vector3(p.x, 1.5, p.z);
  const dir = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  // Slight aim from the camera: shoot toward the screen centre.
  dir.x += rand(-w.spread, w.spread);
  dir.z += rand(-w.spread, w.spread);
  dir.normalize();
  const pellets = w.pellets || 1;
  let hitAnything = false;
  for (let i = 0; i < pellets; i++) {
    const end = origin.clone().addScaledVector(dir, w.range);
    // Hit test against cops, peds and traffic (simple distance-to-ray).
    let bestD = w.range;
    let bestTarget = null;
    const targets = [];
    for (const c of W.cops) targets.push({ x: c.x, z: c.z, kind: 'cop', ref: c });
    for (const pd of W.peds) targets.push({ x: pd.x, z: pd.z, kind: 'ped', ref: pd });
    for (const t of W.traffic) targets.push({ x: t.x, z: t.z, kind: 'car', ref: t });
    for (const t of targets) {
      const rx = t.x - origin.x;
      const rz = t.z - origin.z;
      const along = rx * dir.x + rz * dir.z;
      if (along < 0 || along > bestD) continue;
      const perp = Math.abs(rx * dir.z - rz * dir.x);
      if (perp < 1.8) { bestD = along; bestTarget = t; }
    }
    if (bestTarget) {
      const hit = origin.clone().addScaledVector(dir, bestD);
      tracer(W, origin, hit, w.color);
      burst(W, hit.x, 1.2, hit.z, bestTarget.kind === 'car' ? 'spark' : 'blood', 6);
      if (bestTarget.kind === 'cop') {
        W.scene.remove(bestTarget.ref.mesh);
        W.cops = W.cops.filter((c) => c !== bestTarget.ref);
        p.wanted = Math.min(5, p.wanted + 1);
        p.cash += 50;
        W.events.push({ type: 'copdown' });
        W.hudFlash('COP DOWN — WANTED UP');
      } else if (bestTarget.kind === 'ped') {
        burst(W, bestTarget.x, 1, bestTarget.z, 'blood', 8);
        W.scene.remove(bestTarget.ref.mesh);
        W.peds = W.peds.filter((pd) => pd !== bestTarget.ref);
        p.wanted = Math.min(5, p.wanted + 1);
      } else {
        bestTarget.ref.damage = (bestTarget.ref.damage || 0) + w.damage;
        if (bestTarget.ref.damage > 90) {
          explode(W, bestTarget.ref.x, 1, bestTarget.ref.z, true);
          W.scene.remove(bestTarget.ref.mesh);
          W.traffic = W.traffic.filter((t) => t !== bestTarget.ref);
          p.wanted = Math.min(5, p.wanted + 1);
        }
      }
      hitAnything = true;
    } else {
      tracer(W, origin, end, w.color);
    }
  }
  // Muzzle flash.
  const flash = new THREE.PointLight(w.color, 120, 14, 1.8);
  flash.position.copy(origin).addScaledVector(dir, 1.2);
  W.scene.add(flash);
  W.fx.parts.push({ m: flash, vx: 0, vy: 0, vz: 0, life: 0.07, maxLife: 0.07, kind: 'flash', size: 0 });
  W.sound?.shot(w.name);
  return hitAnything;
}

export function updateFight(W, dt) {
  W.shootCooldown = Math.max(0, W.shootCooldown - dt);
  // Weapon wheel: hold Q, pick with 1-4 or click, release to close.
  const k = W.keys;
  if (k.has('KeyQ') && !W.wheelOpen) {
    W.wheelOpen = true;
    W.hud?.showWheel(true);
  } else if (!k.has('KeyQ') && W.wheelOpen) {
    W.wheelOpen = false;
    W.hud?.showWheel(false);
  }
  if (W.wheelOpen) {
    for (let i = 0; i < WHEEL_ORDER.length; i++) {
      if (k.has('Digit' + (i + 1))) {
        selectWeapon(W, WHEEL_ORDER[i]);
        k.delete('Digit' + (i + 1));
      }
    }
  } else {
    for (let i = 0; i < WHEEL_ORDER.length; i++) {
      if (k.has('Digit' + (i + 1))) {
        selectWeapon(W, WHEEL_ORDER[i]);
        k.delete('Digit' + (i + 1));
      }
    }
  }
  // Fire with mouse click (or F on keyboard).
  if ((W.mouseDown || k.has('KeyF')) && W.player.mode === 'foot') {
    shoot(W);
  }
  // Particles.
  for (let i = W.fx.parts.length - 1; i >= 0; i--) {
    const pt = W.fx.parts[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      W.scene.remove(pt.m);
      if (pt.m.material) pt.m.material.dispose?.();
      W.fx.parts.splice(i, 1);
      continue;
    }
    if (pt.kind === 'fire') {
      pt.m.position.x += pt.vx * dt;
      pt.m.position.y += pt.vy * dt;
      pt.m.position.z += pt.vz * dt;
      pt.vy += 3 * dt;
      const s = pt.size * (0.5 + pt.life / pt.maxLife);
      pt.m.scale.setScalar(Math.max(0.05, s / pt.size));
      pt.m.material.opacity = clamp(pt.life / pt.maxLife, 0, 1);
    } else if (pt.kind === 'smoke') {
      pt.m.position.x += pt.vx * dt;
      pt.m.position.y += pt.vy * dt;
      pt.m.position.z += pt.vz * dt;
      const s = pt.size * (2.2 - pt.life / pt.maxLife);
      pt.m.scale.setScalar(Math.max(0.05, s / pt.size));
      pt.m.material.opacity = 0.28 * clamp(pt.life / pt.maxLife, 0, 1);
    } else if (pt.kind === 'spark' || pt.kind === 'blood') {
      pt.m.position.x += pt.vx * dt;
      pt.m.position.y += pt.vy * dt;
      pt.m.position.z += pt.vz * dt;
      pt.vy -= 9 * dt;
      pt.m.material.opacity = clamp(pt.life / pt.maxLife, 0, 1);
    } else if (pt.kind === 'flash') {
      if (pt.m.isPointLight) pt.m.intensity *= 0.6;
      else pt.m.material.opacity = clamp(pt.life / pt.maxLife, 0, 1);
    } else if (pt.kind === 'tracer') {
      pt.m.material.opacity = clamp(pt.life / pt.maxLife, 0, 1) * 0.9;
    }
  }
}

export function selectWeapon(W, key) {
  const p = W.player;
  if (p.weapons[key]?.owned) {
    p.weapon = key;
    W.hudFlash(WEAPONS[key].name.toUpperCase() + ' EQUIPPED');
    W.hud?.refreshWeapons();
  } else {
    W.hudFlash(WEAPONS[key].name.toUpperCase() + ' — NOT OWNED (BUY AT AMMU-NATION)');
  }
}

export function giveWeapon(W, key, ammo) {
  const p = W.player;
  p.weapons[key] = { owned: true, ammo: (p.weapons[key]?.ammo || 0) + ammo };
  W.hud?.refreshWeapons();
}
