// CORAL HEAT — combat, weapons, pedestrians (v2.9, fresh).
import * as THREE from 'three';
import { clamp, rand, randi, pick, dist2d } from './util.js';
import { makeWalkerMesh } from './walk.js';

export const WEAPONS = [
  { id: 'pistol', name: 'P9 Pistol', damage: 34, rate: 0.28, range: 60, ammo: 120, mag: 12, spread: 0.012, color: 0x222222 },
  { id: 'smg', name: 'VK-9 SMG', damage: 18, rate: 0.09, range: 48, ammo: 240, mag: 32, spread: 0.035, color: 0x333a44 },
  { id: 'shotgun', name: 'Boomstick', damage: 22, rate: 0.85, range: 26, ammo: 40, mag: 6, spread: 0.09, pellets: 6, color: 0x4a2a1a },
];

const PED_SHIRTS = [0x3a7bd5, 0xe8b13c, 0x7bc47f, 0xd95f7b, 0x8a6fd6, 0xe8e8e8, 0x3c3c46];

export function setupFight(G) {
  G.raycaster = new THREE.Raycaster();
  G.shootCooldown = 0;
  G.muzzle = null;
}

export function spawnPedestrians(G, count) {
  for (let i = 0; i < count; i++) {
    const node = pick(G.city.intersections);
    const mesh = makeWalkerMesh();
    mesh.children[0].material = new THREE.MeshLambertMaterial({ color: pick(PED_SHIRTS) });
    mesh.position.set(node.x + rand(-10, 10), 0, node.z + rand(-10, 10));
    G.scene.add(mesh);
    G.peds.push({
      x: mesh.position.x, z: mesh.position.z, heading: rand(0, Math.PI * 2),
      speed: rand(1.2, 2.4), mesh, health: 100, kind: 'ped',
      target: null, walkPhase: rand(0, 6), panic: 0,
    });
  }
}

export function updatePedestrians(G, dt) {
  for (const ped of [...G.peds]) {
    if (ped.flee) {
      // driver who just got carjacked runs away
      ped.heading += Math.sin(G.time * 3 + ped.x) * dt * 0.6;
      ped.x += -Math.sin(ped.heading) * ped.speed * dt;
      ped.z += -Math.cos(ped.heading) * ped.speed * dt;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      if (dist2d(ped.x, ped.z, G.player.x, G.player.z) > 90) {
        G.scene.remove(ped.mesh);
        G.peds.splice(G.peds.indexOf(ped), 1);
      }
      continue;
    }
    if (ped.panic > 0) ped.panic -= dt;
    const speed = ped.panic > 0 ? 6.5 : ped.speed;
    if (!ped.target || dist2d(ped.x, ped.z, ped.target.x, ped.target.z) < 4) {
      const n = pick(G.city.intersections);
      ped.target = { x: n.x + rand(-8, 8), z: n.z + rand(-8, 8) };
    }
    const want = Math.atan2(-(ped.target.x - ped.x), -(ped.target.z - ped.z));
    ped.heading += clamp(((want - ped.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2 * dt, 2 * dt);
    ped.x += -Math.sin(ped.heading) * speed * dt;
    ped.z += -Math.cos(ped.heading) * speed * dt;
    ped.walkPhase += dt * (speed * 2.4);
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    const swing = Math.sin(ped.walkPhase) * 0.45;
    ped.mesh.userData.legs[0].rotation.x = swing;
    ped.mesh.userData.legs[1].rotation.x = -swing;
  }
}

// Hitscan shot from the camera centre. Returns what was hit.
export function shoot(G) {
  const p = G.player;
  if (G.shootCooldown > 0) return null;
  const w = WEAPONS[p.weapon];
  const slot = p.weapons[p.weapon];
  if (!slot || slot.ammo <= 0) {
    G.hud.toast('Out of ammo — find a weapon pickup (press 1/2/3 to switch)');
    G.audio?.click();
    G.shootCooldown = 0.3;
    return null;
  }
  G.shootCooldown = w.rate;
  slot.ammo -= 1;
  G.audio?.shot(w.id);
  flashMuzzle(G);
  // aim from camera through screen centre with a little spread
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  dir.x += rand(-w.spread, w.spread);
  dir.y += rand(-w.spread, w.spread);
  dir.z += rand(-w.spread, w.spread);
  dir.normalize();
  G.raycaster.set(G.camera.position, dir);
  G.raycaster.far = w.range;
  const targets = [];
  for (const ped of G.peds) targets.push(ped.mesh);
  for (const car of G.cars) if (car.isPolice) targets.push(car.mesh);
  const hits = G.raycaster.intersectObjects(targets, true);
  if (hits.length === 0) {
    // tracer into the sky / ground
    return { hit: 'none' };
  }
  let obj = hits[0].object;
  while (obj.parent && obj.parent !== G.scene) obj = obj.parent;
  // find the owning ped or police car
  const ped = G.peds.find((pd) => pd.mesh === obj);
  if (ped) {
    const pellets = w.pellets || 1;
    ped.health -= w.damage * pellets;
    ped.panic = 3;
    if (ped.health <= 0) {
      G.scene.remove(ped.mesh);
      G.peds.splice(G.peds.indexOf(ped), 1);
      p.cash += 25;
      if (G.mission && G.mission.def.steps[G.mission.step] && G.mission.def.steps[G.mission.step].type === 'fight') G.mission.kills++;
      G.cops.addWanted(1);
      G.hud.toast('Target down — +$25 (wanted up)');
    }
    return { hit: 'ped' };
  }
  const car = G.cars.find((c) => c.mesh === obj);
  if (car && car.isPolice) {
    car.health -= w.damage;
    if (car.health <= 0) {
      car.health = 100;
      G.hud.toast('Police car disabled — +$150');
      p.cash += 150;
      G.cops.addWanted(1);
    }
    return { hit: 'cop' };
  }
  return { hit: 'world' };
}

function flashMuzzle(G) {
  if (G.muzzle) G.scene.remove(G.muzzle);
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffe98a })
  );
  const p = G.player;
  const fwd = p.mode === 'foot' ? { x: -Math.sin(p.heading), z: -Math.cos(p.heading) } : { x: -Math.sin(G.camYaw), z: -Math.cos(G.camYaw) };
  m.position.set(p.x + fwd.x * 1.4, 1.4, p.z + fwd.z * 1.4);
  G.scene.add(m);
  G.muzzle = m;
  setTimeout(() => { if (G.muzzle === m) { G.scene.remove(m); G.muzzle = null; } }, 60);
}

export function giveAmmo(G, weaponId, amount) {
  const idx = WEAPONS.findIndex((w) => w.id === weaponId);
  if (idx < 0) return;
  G.player.weapons[idx].ammo += amount;
  G.hud.toast(WEAPONS[idx].name + ' +' + amount + ' ammo');
}
