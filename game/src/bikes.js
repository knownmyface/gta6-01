// Coral Heat — motorcycles: three bike models with different stats,
// lean into corners, wheelies on hard acceleration, and bike spawning.
import * as THREE from 'three';
import { clamp, rand, pick } from './util.js';

export const BIKE_MODELS = [
  { name: 'Coral Rocket', color: 0xe83a2e, top: 66, accel: 30, handling: 3.2, price: 18000 },
  { name: 'Palm Cruiser', color: 0x2e6fd9, top: 52, accel: 22, handling: 2.6, price: 9000 },
  { name: 'Beach Scooter', color: 0xffd75a, top: 38, accel: 16, handling: 2.2, price: 2500 },
];

export function makeBikeMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0xc9c9c9 });
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.1), bodyMat);
  tank.position.set(0, 0.85, 0.2);
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.9), darkMat);
  seat.position.set(0, 0.82, -0.65);
  g.add(seat);
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.7), bodyMat);
  fender.position.set(0, 0.72, 0.95);
  g.add(fender);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), chromeMat);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 1.05, 0.75);
  g.add(bars);
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  light.position.set(0, 0.85, 1.25);
  g.add(light);
  const wheelGeo = new THREE.TorusGeometry(0.34, 0.1, 8, 14);
  const wheelF = new THREE.Mesh(wheelGeo, darkMat);
  wheelF.position.set(0, 0.34, 1.05);
  wheelF.rotation.y = Math.PI / 2;
  g.add(wheelF);
  const wheelB = new THREE.Mesh(wheelGeo, darkMat);
  wheelB.position.set(0, 0.34, -0.95);
  wheelB.rotation.y = Math.PI / 2;
  g.add(wheelB);
  // rider: leaning figure in a jacket
  const rider = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x22304a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), jacket);
  torso.position.set(0, 1.25, -0.35);
  torso.rotation.x = 0.5;
  rider.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color }));
  helmet.position.set(0, 1.62, 0.05);
  rider.add(helmet);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  for (const sx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), legMat);
    leg.position.set(sx, 0.95, 0.1);
    leg.rotation.x = 0.7;
    rider.add(leg);
  }
  g.add(rider);
  g.userData.rider = rider;
  return g;
}

export function spawnBike(G, modelIndex = 0, x, z) {
  const model = BIKE_MODELS[modelIndex];
  const mesh = makeBikeMesh(model.color);
  const bike = {
    kind: 'bike',
    model,
    mesh,
    pos: mesh.position,
    heading: G.player.heading,
    speed: 0,
    lean: 0,
    wheelie: 0,
  };
  mesh.position.set(x !== undefined ? x : G.player.pos.x + 3, 0, z !== undefined ? z : G.player.pos.z + 2);
  G.scene.add(mesh);
  G.bikes.push(bike);
  return bike;
}

export function mountBike(G, bike) {
  G.player.bike = bike;
  G.player.mode = 'bike';
  G.player.footMesh.visible = false;
  G.player.speed = 0;
  if (G.hud) G.hud.toast('On the bike — ' + bike.model.name);
}

export function dismountBike(G) {
  const bike = G.player.bike;
  if (!bike) return;
  G.player.mode = 'foot';
  G.player.pos.set(bike.pos.x + 2, 0, bike.pos.z + 1);
  G.player.speed = 0;
  G.player.footMesh.visible = true;
  G.player.footMesh.position.copy(G.player.pos);
  G.player.bike = null;
}

export function updateBike(G, dt) {
  const bike = G.player.bike;
  if (!bike || G.player.mode !== 'bike') return;
  const k = G.keys;
  const top = bike.model.top;
  let throttle = 0;
  if (k['KeyW'] || k['ArrowUp']) throttle = 1;
  if (k['KeyS'] || k['ArrowDown']) throttle = -0.6;
  if (k['Space']) throttle = -1.3;
  const target = throttle * top;
  const rate = throttle !== 0 ? bike.model.accel : 15;
  if (bike.speed < target) bike.speed = Math.min(target, bike.speed + rate * dt);
  else bike.speed = Math.max(target, bike.speed - rate * 1.4 * dt);
  const steerInput = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  if (Math.abs(bike.speed) > 0.5) {
    bike.heading += steerInput * bike.model.handling * 0.55 * (bike.speed / top) * dt;
  }
  // lean into the corner; wheelie on a hard launch
  const targetLean = -steerInput * 0.42 * clamp(Math.abs(bike.speed) / 30, 0, 1);
  bike.lean += (targetLean - bike.lean) * Math.min(1, dt * 6);
  const wantWheelie = throttle > 0 && bike.speed > 2 && bike.speed < 16 ? 1 : 0;
  bike.wheelie += (wantWheelie - bike.wheelie) * Math.min(1, dt * 2.5);
  bike.pos.x += Math.sin(bike.heading) * bike.speed * dt;
  bike.pos.z += Math.cos(bike.heading) * bike.speed * dt;
  bike.pos.x = clamp(bike.pos.x, -244, 300);
  bike.pos.z = clamp(bike.pos.z, -300, 300);
  bike.mesh.position.copy(bike.pos);
  bike.mesh.rotation.y = bike.heading;
  bike.mesh.rotation.z = bike.lean;
  bike.mesh.rotation.x = -bike.wheelie * 0.28;
  G.player.pos.copy(bike.pos);
  G.player.heading = bike.heading;
  G.player.speed = bike.speed;
}

export function nearestBike(G, maxDist = 6) {
  let best = null;
  let bestD = maxDist;
  for (const b of G.bikes) {
    if (b === G.player.bike) continue;
    const d = Math.hypot(b.pos.x - G.player.pos.x, b.pos.z - G.player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}
