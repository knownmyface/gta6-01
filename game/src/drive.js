// CORAL HEAT — vehicles: meshes, arcade driving, traffic AI (v2.9, fresh).
import * as THREE from 'three';
import { clamp, rand, randi, pick, angDiff, collideCircle } from './util.js';

export const CAR_COLORS = [0xd9302a, 0x2a6bd9, 0xf2b705, 0x22a06b, 0xe8e8e8, 0x1c1c22, 0xff7a1a, 0x8a2be2, 0x59c2d6];

// Build a low-poly car from boxes. kind: 'sport' | 'sedan' | 'taxi' | 'police' | 'van' | 'truck'
export function makeCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const long = kind === 'van' || kind === 'truck' ? 5.6 : kind === 'sport' ? 4.6 : 4.4;
  const wide = 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.72, long), bodyMat);
  body.position.y = 0.62;
  g.add(body);
  const cabinH = kind === 'van' ? 1.1 : 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.86, cabinH, long * 0.5), glassMat);
  cabin.position.set(0, 0.62 + 0.36 + cabinH / 2 - 0.1, kind === 'sport' ? -0.3 : -0.1);
  g.add(cabin);
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xff2222, emissiveIntensity: 1.4 }));
    bar.position.set(0, 1.62, -0.1);
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wide + 0.04, 0.3, long * 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    stripe.position.y = 0.66;
    g.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 0.5), new THREE.MeshLambertMaterial({ color: 0xffe94a, emissive: 0xaa8800, emissiveIntensity: 0.8 }));
    sign.position.set(0, 1.5, -0.1);
    g.add(sign);
  }
  if (kind === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.95, 0.1, 0.5), darkMat);
    wing.position.set(0, 1.05, long / 2 - 0.2);
    g.add(wing);
  }
  // headlights + taillights
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe98a, emissiveIntensity: 1.0 });
  for (const s of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), hl);
    h.position.set(s, 0.62, -long / 2 - 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0xdd1111, emissiveIntensity: 0.8 }));
    t.position.set(s, 0.62, long / 2 + 0.02);
    g.add(t);
  }
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, -long / 2 + 0.8], [0.95, -long / 2 + 0.8], [-0.95, long / 2 - 0.8], [0.95, long / 2 - 0.8]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.bodyLen = long;
  return g;
}

export function createCar(G, x, z, heading, color, kind = 'sedan') {
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    mesh, x, z, heading, speed: 0,
    kind, color, isPlayer: false, isPolice: false, isTraffic: false,
    top: kind === 'sport' ? 52 : kind === 'police' ? 50 : kind === 'taxi' ? 40 : 34,
    accel: kind === 'sport' ? 26 : 18,
    steer: 0, target: null, wait: 0, driver: null, health: 100,
    ai: null, brakeLight: false,
  };
  G.cars.push(car);
  return car;
}

export function removeCar(G, car) {
  G.scene.remove(car.mesh);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}

// Arcade car step. input: {throttle:-1..1, steer:-1..1, brake, nitro}
export function stepCar(G, car, input, dt) {
  const up = G.player.upgrades || { engine: 0, tires: 0, armor: 0, nitro: 0 };
  const topMul = car.isPlayer ? 1 + up.engine * 0.12 : 1;
  const grip = car.isPlayer ? 1 + up.tires * 0.15 : 1;
  const top = car.top * topMul * (input.nitro && up.nitro > 0 ? 1 + 0.12 * up.nitro : 1);
  if (input.throttle > 0) car.speed += car.accel * input.throttle * dt;
  else if (input.throttle < 0) car.speed += car.accel * 0.8 * input.throttle * dt;
  if (input.brake) car.speed = Math.max(0, car.speed - 40 * dt);
  // drag + rolling resistance
  car.speed -= car.speed * 0.35 * dt;
  if (Math.abs(car.speed) < 0.15 && input.throttle === 0) car.speed = 0;
  car.speed = clamp(car.speed, -12, top);
  // steering scales with speed, less at very high speed
  const steerAuthority = clamp(Math.abs(car.speed) / 12, 0, 1) * (1 - clamp(Math.abs(car.speed) / 90, 0, 0.45));
  car.heading += input.steer * 1.9 * grip * steerAuthority * dt * (car.speed >= 0 ? 1 : -1);
  const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  [nx, nz] = collideCircle(nx, nz, 1.6, G.city.colliders);
  if (nx !== car.x + fx * car.speed * dt || nz !== car.z + fz * car.speed * dt) {
    if (Math.abs(car.speed) > 14 && car.isPlayer) G.audio?.thud();
    car.speed *= 0.45;
  }
  // keep inside the map (ocean blocks cars)
  if (nx > 296) { nx = 296; car.speed *= 0.5; }
  if (nx < -340) { nx = -340; car.speed *= 0.5; }
  if (nz > 340) { nz = 340; car.speed *= 0.5; }
  if (nz < -340) { nz = -340; car.speed *= 0.5; }
  car.x = nx; car.z = nz;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // wheels spin + front wheels steer visually
  const spin = (car.speed * dt) / 0.38;
  const wheels = car.mesh.userData.wheels;
  for (let i = 0; i < wheels.length; i++) {
    wheels[i].rotation.x += spin;
    if (i < 2) wheels[i].rotation.y = input.steer * 0.35;
  }
  // slight body roll
  car.mesh.rotation.z = -input.steer * clamp(Math.abs(car.speed) / 40, 0, 1) * 0.06;
}

function pickRoadTarget(G, car) {
  const n = pick(G.city.intersections);
  return { x: n.x + rand(-6, 6), z: n.z + rand(-6, 6) };
}

export function spawnTraffic(G, count) {
  const kinds = ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'truck'];
  for (let i = 0; i < count; i++) {
    const node = pick(G.city.intersections);
    const car = createCar(G, node.x + rand(-8, 8), node.z + rand(-8, 8), rand(0, Math.PI * 2), pick(CAR_COLORS), pick(kinds));
    car.isTraffic = true;
    car.target = pickRoadTarget(G, car);
    car.driver = { name: 'driver' };
  }
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.isTraffic) continue;
    if (!car.target || Math.hypot(car.target.x - car.x, car.target.z - car.z) < 9) {
      car.target = pickRoadTarget(G, car);
      continue;
    }
    const want = Math.atan2(-(car.target.x - car.x), -(car.target.z - car.z));
    const d = angDiff(car.heading, want);
    let steer = clamp(d * 1.6, -1, 1);
    // slow down for a car right ahead
    let throttle = 0.55;
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const ahead = dx * -Math.sin(car.heading) + dz * -Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 12 && side < 3) { throttle = 0; break; }
    }
    stepCar(G, car, { throttle, steer, brake: throttle === 0, nitro: false }, dt);
  }
}
