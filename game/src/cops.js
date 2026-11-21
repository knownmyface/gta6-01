// cops.js — wanted system: stars, police cruisers, helicopter, roadblocks,
// heat decay, busted/wasted flow.
import * as THREE from 'three';
import { box, cyl, clamp, lerp, rand, pick } from './util.js';
import { spawnCar, CAR_MODELS } from './drive.js';
import { collideCircle } from './coralcity.js';

export function createWanted(G) {
  return {
    level: 0, heat: 0,
    add(n) {
      this.level = clamp(this.level + n, 0, 5);
      this.heat = 100;
      G.hud.flashWanted();
    },
    lower(n) { this.level = clamp(this.level - n, 0, 5); },
    update(dt) {
      if (this.level === 0) return;
      this.heat -= dt * 4;
      if (this.heat <= 0) { this.level = Math.max(0, this.level - 1); this.heat = this.level > 0 ? 100 : 0; }
    },
  };
}

export function spawnPolice(G, x, z) {
  const car = spawnCar(G, CAR_MODELS[0], x, z, rand(0, Math.PI * 2), { police: true });
  car.cruise = 20;
  car.policeState = 'chase';
  G.cops.push(car);
  return car;
}

export function updatePolice(G, dt) {
  const w = G.wanted.level;
  const px = G.player.pos.x, pz = G.player.pos.z;
  // keep the right number of cruisers on the street
  const want = w === 0 ? 0 : w === 1 ? 1 : w === 2 ? 2 : w === 3 ? 3 : w === 4 ? 4 : 5;
  while (G.cops.length < want) {
    const a = rand(0, Math.PI * 2);
    spawnPolice(G, px + Math.sin(a) * 55, pz + Math.cos(a) * 55);
  }
  while (G.cops.length > want) {
    const c = G.cops.pop();
    G.scene.remove(c.group);
    const i = G.cars.indexOf(c);
    if (i >= 0) G.cars.splice(i, 1);
  }
  for (const cop of G.cops) {
    // hold cops are staged for a screenshot — they stay put in frame
    if (cop.hold) continue;
    const dx = px - cop.x, dz = pz - cop.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx / d, dz / d);
    // steer toward the player, with a little wobble
    let dh = wantHeading - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    cop.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
    const target = d > 6 ? 24 + w * 2 : 8;
    cop.speed = lerp(cop.speed, target, dt * 0.8);
    let nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
    let nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
    if (!collideCircle(G, nx, nz, 2.2)) { cop.x = nx; cop.z = nz; }
    else { cop.heading += Math.PI / 2 * dt * 4; cop.speed *= 0.6; }
    cop.group.position.set(cop.x, 0, cop.z);
    cop.group.rotation.y = cop.heading;
    for (const wh of cop.wheels) wh.rotation.x += cop.speed * dt * 2.2;
    // ramming: bump the player car and add damage
    const pv = G.player.vehicle;
    if (pv && d < 4.5) {
      pv.speed *= 0.92;
      pv.hp -= dt * 6;
      G.player.damageFlash = 0.3;
      if (pv.hp <= 0) { pv.hp = 0; G.events.push('car-wrecked'); }
    }
    if (!pv && d < 2.2) {
      G.player.health -= dt * 14;
      G.player.damageFlash = 0.4;
    }
  }
  updateHelicopter(G, dt);
  updateRoadblocks(G, dt);
}

function makeHeli(G) {
  const g = new THREE.Group();
  g.add(box(3.2, 1.6, 6.5, 0x1a1a22, 0, 0, 0));
  g.add(box(2.2, 1.2, 2.4, 0x9ad2e8, 0, 0.3, 2.2));
  const rotor = box(9, 0.14, 0.7, 0x333344, 0, 1.4, 0);
  g.add(rotor);
  g.add(box(0.5, 0.5, 4.5, 0x333344, 0, 0.3, -5));
  const spot = new THREE.Mesh(new THREE.CircleGeometry(2.2, 16), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22 }));
  spot.rotation.x = -Math.PI / 2; spot.position.y = -26; g.add(spot);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  G.scene.add(g);
  return { group: g, rotor, angle: 0 };
}

export function updateHelicopter(G, dt) {
  const w = G.wanted.level;
  if (w >= 3 && !G.heli) G.heli = makeHeli(G);
  if (w < 3 && G.heli) { G.scene.remove(G.heli.group); G.heli = null; return; }
  if (!G.heli) return;
  const h = G.heli;
  h.angle += dt * 0.5;
  const px = G.player.pos.x, pz = G.player.pos.z;
  const tx = px + Math.sin(h.angle) * 22, tz = pz + Math.cos(h.angle) * 22;
  h.group.position.x = lerp(h.group.position.x, tx, dt * 0.7);
  h.group.position.z = lerp(h.group.position.z, tz, dt * 0.7);
  h.group.position.y = 30 + Math.sin(h.angle * 2) * 2;
  h.group.rotation.y = Math.atan2(px - h.group.position.x, pz - h.group.position.z);
  h.rotor.rotation.y += dt * 22;
}

export function updateRoadblocks(G, dt) {
  const w = G.wanted.level;
  if (w >= 4 && G.roadblocks.length === 0) {
    // two cruiser barricades ahead of the player on the nearest road
    for (const off of [40, -40]) {
      const px = G.player.pos.x + off, pz = G.player.pos.z;
      const a = spawnCar(G, CAR_MODELS[0], px, pz, Math.PI / 2, { police: true });
      a.policeState = 'block'; a.speed = 0;
      G.roadblocks.push(a);
    }
    G.hud.say('ROADBLOCK AHEAD — Coral Bay PD has the street sealed', 3);
  }
  if (w < 4 && G.roadblocks.length) {
    for (const r of G.roadblocks) {
      G.scene.remove(r.group);
      const i = G.cars.indexOf(r); if (i >= 0) G.cars.splice(i, 1);
      const j = G.cops.indexOf(r); if (j >= 0) G.cops.splice(j, 1);
    }
    G.roadblocks = [];
  }
}

export function checkBusted(G) {
  if (G.player.health <= 0) {
    G.player.health = 0;
    return 'wasted';
  }
  if (G.wanted.level >= 5) {
    let near = 0;
    for (const cop of G.cops) if (Math.hypot(cop.x - G.player.pos.x, cop.z - G.player.pos.z) < 5) near++;
    if (near >= 2 && !G.player.vehicle) return 'busted';
  }
  return null;
}
