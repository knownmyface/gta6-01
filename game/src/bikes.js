// CORAL HEAT — motorcycle system (NEW in v2.9).
// Three bike models with different stats, lean + wheelie handling,
// parked bike spawns around the city, bike HUD data.
import * as THREE from 'three';
import { clamp, rand, pick, dist2d } from './util.js';

export const BIKE_MODELS = [
  { id: 'scoot', name: 'Coral Scoot 125', top: 34, accel: 16, lean: 0.22, wheelie: 0.4, color: 0xffd76b, price: 0 },
  { id: 'street', name: 'Bay Street 600', top: 52, accel: 26, lean: 0.38, wheelie: 0.7, color: 0xd9302a, price: 1800 },
  { id: 'racer', name: 'Sunset Racer 1000', top: 68, accel: 34, lean: 0.55, wheelie: 1.0, color: 0x2a6bd9, price: 6500 },
];

export function makeBikeMesh(color, model) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.9), bodyMat);
  frame.position.y = 0.75;
  g.add(frame);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.8), bodyMat);
  tank.position.set(0, 1.05, -0.15);
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.9), dark);
  seat.position.set(0, 1.0, 0.65);
  g.add(seat);
  if (model === 'racer') {
    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.7), bodyMat);
    fairing.position.set(0, 0.95, -0.95);
    g.add(fairing);
  }
  if (model === 'scoot') {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.12), new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }));
    shield.position.set(0, 1.25, -0.9);
    g.add(shield);
  }
  const wheelGeo = new THREE.TorusGeometry(0.36, 0.11, 8, 14);
  const front = new THREE.Mesh(wheelGeo, dark);
  front.position.set(0, 0.36, -0.95);
  front.rotation.y = Math.PI / 2;
  g.add(front);
  const rear = new THREE.Mesh(wheelGeo, dark);
  rear.position.set(0, 0.36, 0.95);
  rear.rotation.y = Math.PI / 2;
  g.add(rear);
  g.userData.wheels = [front, rear];
  // handlebar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), dark);
  bar.position.set(0, 1.2, -0.75);
  g.add(bar);
  return g;
}

export function setupBikes(G) {
  G.bikes = [];
  for (const s of G.city.bikeSpawns) {
    const def = BIKE_MODELS.find((m) => m.id === s.model);
    const mesh = makeBikeMesh(def.color, def.id);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = rand(0, Math.PI * 2);
    G.scene.add(mesh);
    G.bikes.push({
      mesh, x: s.x, z: s.z, heading: mesh.rotation.y, speed: 0,
      def, ridden: false, lean: 0, wheelie: 0, model: def.id,
    });
  }
}

// Bike physics: quick steering, lean into corners, wheelie on SPACE.
export function stepBike(G, bike, input, dt) {
  const def = bike.def;
  let accel = def.accel;
  if (input.wheelie && bike.speed > 8) {
    bike.wheelie = clamp(bike.wheelie + dt * 2.2, 0, def.wheelie);
    accel *= 1.15;
  } else {
    bike.wheelie = clamp(bike.wheelie - dt * 3, 0, def.wheelie);
  }
  if (input.throttle > 0) bike.speed += accel * input.throttle * dt;
  else if (input.throttle < 0) bike.speed += accel * 0.7 * input.throttle * dt;
  if (input.brake) bike.speed = Math.max(0, bike.speed - 46 * dt);
  bike.speed -= bike.speed * 0.22 * dt;
  bike.speed = clamp(bike.speed, -8, def.top * (bike.wheelie > 0.5 ? 1.08 : 1));
  const steerAuthority = clamp(Math.abs(bike.speed) / 10, 0, 1);
  bike.heading += input.steer * 2.4 * steerAuthority * dt * (bike.speed >= 0 ? 1 : -1);
  // lean follows steering + speed
  const targetLean = -input.steer * def.lean * clamp(Math.abs(bike.speed) / 30, 0.2, 1);
  bike.lean += (targetLean - bike.lean) * Math.min(1, dt * 8);
  const fx = -Math.sin(bike.heading), fz = -Math.cos(bike.heading);
  let nx = bike.x + fx * bike.speed * dt;
  let nz = bike.z + fz * bike.speed * dt;
  nx = clamp(nx, -338, 296);
  nz = clamp(nz, -338, 338);
  // simple building push-out (radius 0.9)
  for (const c of G.city.colliders) {
    const cx = clamp(nx, c.x - c.hx, c.x + c.hx);
    const cz = clamp(nz, c.z - c.hz, c.z + c.hz);
    const dx = nx - cx, dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < 0.81) {
      if (d2 > 0.000001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * 0.9;
        nz = cz + (dz / d) * 0.9;
      }
      bike.speed *= 0.5;
      if (Math.abs(bike.speed) > 16) G.audio?.thud();
    }
  }
  bike.x = nx; bike.z = nz;
  bike.mesh.position.set(bike.x, 0, bike.z);
  bike.mesh.rotation.y = bike.heading;
  bike.mesh.rotation.z = bike.lean;
  // wheelie lifts the front
  bike.mesh.rotation.x = -bike.wheelie * 0.5;
  const spin = (bike.speed * dt) / 0.36;
  for (const w of bike.mesh.userData.wheels) w.rotation.x += spin;
}
