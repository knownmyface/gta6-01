// boats.js — drivable boats, marina district, water bobbing, 2 boat missions hook.
import * as THREE from 'three';
import { box, cyl, clamp, lerp, rand, pick } from './util.js';
import { MARINA } from './coralcity.js';

export const BOAT_MODELS = [
  { name: 'Wave Runner', color: 0xf0f0f0, top: 34, accel: 18, turn: 1.9 },
  { name: 'Coral Skiff', color: 0x3ca8ff, top: 30, accel: 15, turn: 1.7 },
  { name: 'Sunset Yacht', color: 0xffe08a, top: 38, accel: 20, turn: 1.6 },
];

export function makeBoatMesh(model) {
  const g = new THREE.Group();
  // hull: tapered box + bow wedge
  const hull = box(3.4, 1.4, 9, model.color, 0, 0.7, 0);
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3, 4), new THREE.MeshLambertMaterial({ color: model.color }));
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.7, 6); bow.scale.set(1, 1, 1); bow.castShadow = true;
  g.add(bow);
  g.add(box(2.4, 1.5, 3.4, 0x2e3a4a, 0, 1.9, -1));
  g.add(box(2.0, 0.9, 1.6, 0x9ad2e8, 0, 2.6, -1));
  const stripe = box(3.5, 0.3, 9.1, 0xff5a3c, 0, 1.1, 0); g.add(stripe);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function spawnBoat(G, model, x, z, heading) {
  const group = makeBoatMesh(model);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  G.scene.add(group);
  const boat = { model, group, x, z, heading, speed: 0, name: model.name, inWater: true };
  G.boats.push(boat);
  return boat;
}

export function spawnMarinaBoats(G) {
  spawnBoat(G, BOAT_MODELS[0], MARINA.x - 20, MARINA.z + 8, 0);
  spawnBoat(G, BOAT_MODELS[1], MARINA.x + 70, MARINA.z + 34, Math.PI / 2);
  spawnBoat(G, BOAT_MODELS[2], MARINA.x + 160, MARINA.z - 20, -Math.PI / 2);
  // moored visual boats already in coralcity; these three are drivable
}

export function updateBoat(G, dt) {
  const b = G.player.boat;
  if (!b) return;
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const steer = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  b.speed += fwd * b.model.accel * dt;
  b.speed *= Math.pow(0.97, dt * 60);
  b.speed = clamp(b.speed, -8, b.model.top);
  b.heading += steer * b.model.turn * clamp(Math.abs(b.speed) / 15, 0.2, 1) * dt * (b.speed >= 0 ? 1 : -1);
  b.x += Math.sin(b.heading) * b.speed * dt;
  b.z += Math.cos(b.heading) * b.speed * dt;
  // keep inside the bay / ocean band
  b.x = clamp(b.x, -380, 380);
  b.z = clamp(b.z, MARINA.z - 80, 760);
  // bobbing + wake
  const bob = Math.sin(G.time * 2.2 + b.x * 0.05) * 0.25;
  b.group.position.set(b.x, bob, b.z);
  b.group.rotation.y = b.heading;
  b.group.rotation.z = -steer * 0.04;
  b.group.rotation.x = Math.sin(G.time * 1.7) * 0.02;
  G.player.pos.set(b.x, 1.2, b.z);
  G.player.heading = b.heading;
  // wake particles (cheap: reuse fx splash markers)
  if (Math.abs(b.speed) > 12 && Math.random() < dt * 20) {
    G.fx.wake.push({ x: b.x - Math.sin(b.heading) * 4, z: b.z - Math.cos(b.heading) * 4, t: 0.8 });
  }
}

export function nearestBoat(G, maxD = 6) {
  let best = null, bd = maxD;
  for (const b of G.boats) {
    if (b === G.player.boat) continue;
    const d = Math.hypot(b.x - G.player.pos.x, b.z - G.player.pos.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

export function boardBoat(G, boat) {
  const p = G.player;
  p.boat = boat;
  p.vehicle = null;
  p.onFoot = false;
  p.mesh.group.visible = false;
  G.hud.say('Aboard the ' + boat.name + ' — throttle up!', 2.4);
  G.sound.blip(440, 0.1);
}

export function leaveBoat(G) {
  const p = G.player;
  const b = p.boat;
  if (!b) return;
  p.boat = null;
  p.onFoot = true;
  // step onto the nearest pier / shore
  p.pos.set(b.x - 6, 1.2, b.z);
  p.mesh.group.visible = true;
  G.sound.blip(330, 0.08);
}

export function boatRaceCheckpoints(G) {
  // buoys for the two boat missions, around the marina and out to sea
  return [
    { x: MARINA.x - 40, z: MARINA.z + 40 },
    { x: MARINA.x + 120, z: MARINA.z + 90 },
    { x: 60, z: 480 },
    { x: -140, z: 520 },
    { x: MARINA.x + 40, z: MARINA.z + 60 },
  ];
}

export function spawnBuoys(G, points) {
  const buoys = [];
  for (const pt of points) {
    const buoy = new THREE.Group();
    buoy.add(cyl(0.5, 0.9, 1.6, 0xff5a3c, 0, 0.6, 0, 8));
    buoy.add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 8), new THREE.MeshLambertMaterial({ color: 0xffd23c }))).children;
    buoy.children[buoy.children.length - 1].position.set(0, 2, 0);
    buoy.position.set(pt.x, 0, pt.z);
    G.scene.add(buoy);
    buoys.push(buoy);
  }
  return buoys;
}
