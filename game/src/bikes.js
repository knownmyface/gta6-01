// bikes.js — motorcycles: 3 models, lean + wheelie handling, bike HUD, spawning.
import * as THREE from 'three';
import { box, cyl, clamp, lerp, rand, pick } from './util.js';
import { collideCircle, clampToCity } from './coralcity.js';

export const BIKE_MODELS = [
  { name: 'Coral Scooter', color: 0x7ae0a0, top: 34, accel: 22, lean: 0.9, wheelie: 0.4, price: 900 },
  { name: 'Bay Sport 600', color: 0xff4a3c, top: 52, accel: 32, lean: 1.4, wheelie: 0.9, price: 5200 },
  { name: 'Sunset Chopper', color: 0x2a2a3a, top: 42, accel: 24, lean: 1.0, wheelie: 0.6, price: 3400 },
];

export function makeBikeMesh(model) {
  const g = new THREE.Group();
  const frame = box(0.5, 0.5, 2.4, model.color, 0, 0.9, 0);
  g.add(frame);
  const tank = box(0.55, 0.45, 0.9, model.color, 0, 1.2, 0.2);
  g.add(tank);
  g.add(box(0.5, 0.35, 0.8, 0x1a1a22, 0, 1.15, -0.8));
  const bar = cyl(0.06, 0.06, 0.9, 0x888888, 0, 1.35, 0.9, 6);
  bar.rotation.z = Math.PI / 2; g.add(bar);
  const wg = new THREE.TorusGeometry(0.42, 0.14, 8, 16);
  const wm = new THREE.MeshLambertMaterial({ color: 0x14141a });
  for (const wz of [1.15, -1.15]) {
    const w = new THREE.Mesh(wg, wm);
    w.position.set(0, 0.42, wz);
    w.castShadow = true; g.add(w);
  }
  const hl = new THREE.Mesh(new THREE.CircleGeometry(0.18, 10), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(0, 1.0, 1.32); g.add(hl);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function spawnBike(G, model, x, z, heading) {
  const group = makeBikeMesh(model);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  G.scene.add(group);
  const bike = { model, group, x, z, heading, speed: 0, lean: 0, wheelie: 0, name: model.name, kind: 'bike' };
  G.bikes.push(bike);
  return bike;
}

export function spawnStreetBikes(G) {
  spawnBike(G, BIKE_MODELS[0], 40, -30, Math.PI / 2);
  spawnBike(G, BIKE_MODELS[1], -90, 130, 0);
  spawnBike(G, BIKE_MODELS[2], 170, -90, Math.PI);
}

export function updateBike(G, dt) {
  const b = G.player.bike;
  if (!b) return;
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const steer = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  const wheelieKey = k['KeyQ'];
  b.speed += fwd * b.model.accel * dt;
  b.speed *= Math.pow(0.982, dt * 60);
  b.speed = clamp(b.speed, -10, b.model.top);
  const turnRate = 2.1 * clamp(Math.abs(b.speed) / 14, 0.25, 1);
  b.heading += steer * turnRate * dt * (b.speed >= 0 ? 1 : -1);
  // lean into the turn
  const targetLean = -steer * b.model.lean * clamp(Math.abs(b.speed) / 30, 0, 1);
  b.lean = lerp(b.lean, targetLean, dt * 6);
  // wheelie on hard launch
  const targetWheelie = (wheelieKey && fwd > 0 && b.speed > 8) ? b.model.wheelie : 0;
  b.wheelie = lerp(b.wheelie, targetWheelie, dt * 5);
  let nx = b.x + Math.sin(b.heading) * b.speed * dt;
  let nz = b.z + Math.cos(b.heading) * b.speed * dt;
  if (collideCircle(G, nx, nz, 1.2)) { b.speed *= 0.5; nx = b.x; nz = b.z; G.player.damageFlash = 0.2; }
  [nx, nz] = clampToCity(nx, nz);
  b.x = nx; b.z = nz;
  b.group.position.set(b.x, 0, b.z);
  b.group.rotation.y = b.heading;
  b.group.rotation.z = b.lean * 0.35;
  b.group.rotation.x = -b.wheelie * 0.45;
  G.player.pos.set(b.x, 1.2, b.z);
  G.player.heading = b.heading;
}

export function nearestBike(G, maxD = 5) {
  let best = null, bd = maxD;
  for (const b of G.bikes) {
    if (b === G.player.bike) continue;
    const d = Math.hypot(b.x - G.player.pos.x, b.z - G.player.pos.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

export function mountBike(G, bike) {
  const p = G.player;
  p.bike = bike;
  p.vehicle = null;
  p.onFoot = false;
  p.mesh.group.visible = false;
  G.hud.say('Riding the ' + bike.name + ' — Q for a wheelie!', 2.4);
  G.sound.blip(480, 0.1);
}

export function dismountBike(G) {
  const p = G.player;
  const b = p.bike;
  if (!b) return;
  p.bike = null;
  p.onFoot = true;
  p.pos.set(b.x - 2, 1.2, b.z - 2);
  p.mesh.group.visible = true;
}
