// Coral Heat — vehicles: player car physics, traffic cars, stealing.
// Arcade handling: accelerate / brake / steer / handbrake drift, with a
// simple speed model the HUD reads as MPH.
import * as THREE from 'three';
import { clamp, rand, pick, angleDelta } from './util.js';
import { MARINA_X } from './coralcity.js';

export const CAR_MODELS = [
  { name: 'Coral GT', color: 0xe83a2e, top: 62, accel: 26, grip: 2.6, price: 0 },
  { name: 'Sunset Coupe', color: 0xff8a1e, top: 56, accel: 22, grip: 2.4, price: 12000 },
  { name: 'Palms Sedan', color: 0x2e6fd9, top: 48, accel: 18, grip: 2.2, price: 6000 },
  { name: 'Marina Cruiser', color: 0x2ed9a8, top: 44, accel: 16, grip: 2.0, price: 4500 },
  { name: 'Vice Van', color: 0xd9d9d9, top: 38, accel: 13, grip: 1.8, price: 3000 },
];

const TRAFFIC_COLORS = [0xd9d9d9, 0x3a3a3a, 0x2e6fd9, 0xe8c832, 0x7a4ad9, 0x2ed9a8, 0xc96f4a];

export function makeVehicleMesh(color, kind = 'car') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x182430 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const len = kind === 'van' ? 5.4 : 4.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, len), bodyMat);
  body.position.y = 0.62;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, kind === 'van' ? 3.6 : 2.1), glassMat);
  cabin.position.set(0, 1.2, kind === 'van' ? -0.2 : -0.25);
  g.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.5), bodyMat);
  nose.position.set(0, 0.55, len / 2);
  g.add(nose);
  // headlights + taillights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    hl.position.set(sx, 0.62, len / 2 + 0.26);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tl.position.set(sx, 0.62, -len / 2 - 0.26);
    g.add(tl);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  // spoiler on sports models
  if (kind === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.45), darkMat);
    wing.position.set(0, 1.15, -len / 2 + 0.15);
    g.add(wing);
  }
  g.userData.length = len;
  return g;
}

export function createPlayerCar(G, modelIndex = 0) {
  const model = CAR_MODELS[modelIndex];
  const mesh = makeVehicleMesh(model.color, modelIndex === 0 ? 'sport' : 'car');
  const car = {
    kind: 'car',
    model,
    mesh,
    pos: mesh.position,
    heading: 0,
    speed: 0,
    steer: 0,
    health: 100,
    nitro: 0,
    upgrades: { engine: 0, tires: 0, armor: 0, nitro: 0 },
  };
  G.scene.add(mesh);
  G.player.car = car;
  return car;
}

export function carTopSpeed(G) {
  const car = G.player.car;
  if (!car) return 0;
  return car.model.top * (1 + 0.08 * car.upgrades.engine);
}

export function updateDriving(G, dt) {
  const car = G.player.car;
  if (!car || G.player.mode !== 'car') return;
  const k = G.keys;
  const top = carTopSpeed(G);
  const accel = car.model.accel * (1 + 0.1 * car.upgrades.engine);
  let throttle = 0;
  if (k['KeyW'] || k['ArrowUp']) throttle = 1;
  if (k['KeyS'] || k['ArrowDown']) throttle = -0.6;
  if (k['Space']) throttle = -1.4; // brake / handbrake
  let target = throttle * top;
  if (k['ShiftLeft'] && car.upgrades.nitro > 0 && car.nitro > 0) {
    target = top * 1.35;
    car.nitro = Math.max(0, car.nitro - dt * 30);
  }
  const rate = throttle !== 0 ? accel : 14;
  if (car.speed < target) car.speed = Math.min(target, car.speed + rate * dt);
  else car.speed = Math.max(target, car.speed - rate * 1.4 * dt);
  // steering: sharper at low speed, steadier at high speed
  const steerInput = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  const steerMax = 0.55 / (1 + Math.abs(car.speed) * 0.045);
  car.steer += (steerInput * steerMax - car.steer) * Math.min(1, dt * 8);
  if (Math.abs(car.speed) > 0.4) {
    car.heading += car.steer * (car.speed / top) * 2.4 * dt * (car.speed >= 0 ? 1 : -1);
  }
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  // stay inside the city + water edge (cars cannot drive into the ocean)
  car.pos.x = clamp(car.pos.x, -244, 300);
  car.pos.z = clamp(car.pos.z, -300, 300);
  // buildings block: cheap push-out against building boxes
  for (const b of G.world.buildings) {
    const dx = car.pos.x - b.position.x;
    const dz = car.pos.z - b.position.z;
    if (Math.abs(dx) < 16 && Math.abs(dz) < 16) {
      const push = 16 - Math.max(Math.abs(dx), Math.abs(dz));
      if (Math.abs(dx) > Math.abs(dz)) car.pos.x += Math.sign(dx) * push;
      else car.pos.z += Math.sign(dz) * push;
      car.speed *= 0.55;
      car.health = Math.max(0, car.health - 0.4);
    }
  }
  car.mesh.position.copy(car.pos);
  car.mesh.position.y = 0;
  car.mesh.rotation.y = car.heading;
  // body roll + pitch for feel
  car.mesh.rotation.z = -car.steer * 0.12;
  car.mesh.rotation.x = clamp(-throttle * 0.03, -0.05, 0.05);
  G.player.pos.copy(car.pos);
  G.player.heading = car.heading;
  G.player.speed = car.speed;
}

export function spawnTraffic(G, count = 16) {
  const roads = [-180, -120, -60, 0, 60, 120, 180, 240, MARINA_X];
  for (let i = 0; i < count; i++) {
    const vertical = Math.random() < 0.5;
    const road = pick(roads);
    const mesh = makeVehicleMesh(pick(TRAFFIC_COLORS), Math.random() < 0.15 ? 'van' : 'car');
    const t = {
      mesh,
      pos: mesh.position,
      heading: vertical ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: rand(9, 15),
      lane: vertical ? road + (Math.random() < 0.5 ? -3.5 : 3.5) : road + (Math.random() < 0.5 ? -3.5 : 3.5),
      vertical,
      pause: 0,
    };
    if (vertical) t.pos.set(t.lane, 0, rand(-280, 280));
    else t.pos.set(rand(-280, 280), 0, t.lane);
    mesh.rotation.y = t.heading;
    G.scene.add(mesh);
    G.traffic.push(t);
  }
}

export function updateTraffic(G, dt) {
  for (const t of G.traffic) {
    if (t.pause > 0) {
      t.pause -= dt;
      continue;
    }
    // slow down if the player car is right ahead
    const dx = G.player.pos.x - t.pos.x;
    const dz = G.player.pos.z - t.pos.z;
    const dist = Math.hypot(dx, dz);
    let speed = t.speed;
    if (dist < 14 && G.player.mode === 'car') speed = Math.min(speed, 4);
    const fx = Math.sin(t.heading);
    const fz = Math.cos(t.heading);
    t.pos.x += fx * speed * dt;
    t.pos.z += fz * speed * dt;
    if (t.pos.x > 305 || t.pos.x < -250 || t.pos.z > 305 || t.pos.z < -305) {
      // wrap around to the other end of the same road
      if (t.vertical) t.pos.z = -t.pos.z * 0.95;
      else t.pos.x = -t.pos.x * 0.95;
    }
    // avoid driving through the player: gentle swerve
    if (dist < 9 && G.player.mode === 'car') {
      t.pos.x += (dx > 0 ? -1 : 1) * dt * 3;
    }
    t.mesh.position.copy(t.pos);
    t.mesh.rotation.y = t.heading;
  }
}

// Nearest traffic car within reach for stealing / carjacking.
export function nearestTrafficCar(G, maxDist = 7) {
  let best = null;
  let bestD = maxDist;
  for (const t of G.traffic) {
    const d = Math.hypot(t.pos.x - G.player.pos.x, t.pos.z - G.player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function stealTrafficCar(G, t) {
  const idx = G.traffic.indexOf(t);
  if (idx >= 0) G.traffic.splice(idx, 1);
  G.scene.remove(t.mesh);
  const model = pick(CAR_MODELS.slice(1));
  const car = {
    kind: 'car',
    model,
    mesh: t.mesh,
    pos: t.pos,
    heading: t.heading,
    speed: 0,
    steer: 0,
    health: 100,
    nitro: 0,
    upgrades: { engine: 0, tires: 0, armor: 0, nitro: 0 },
  };
  G.player.car = car;
  G.player.mode = 'car';
  G.player.speed = 0;
  return car;
}
