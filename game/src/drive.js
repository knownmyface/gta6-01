// drive.js — cars: player driving, traffic flow, stealable parked cars.
import * as THREE from 'three';
import { box, cyl, clamp, lerp, rand, randi, pick, angLerp } from './util.js';
import { collideCircle, clampToCity, CITY } from './coralcity.js';

export const CAR_MODELS = [
  { name: 'Coral GT', color: 0xff4a3c, top: 46, accel: 26, grip: 2.6, price: 0 },
  { name: 'Bay Runner', color: 0x3ca8ff, top: 40, accel: 22, grip: 2.4, price: 1200 },
  { name: 'Sunset Coupe', color: 0xffd23c, top: 44, accel: 24, grip: 2.5, price: 2400 },
  { name: 'Marina Van', color: 0x7ae0a0, top: 32, accel: 16, grip: 2.0, price: 800 },
  { name: 'Palm Cruiser', color: 0xff8ac2, top: 38, accel: 20, grip: 2.3, price: 1600 },
  { name: 'Harbor Taxi', color: 0xf5f5f5, top: 36, accel: 19, grip: 2.2, price: 0 },
];

export function makeCarMesh(model, isPolice = false) {
  const g = new THREE.Group();
  const body = box(2.1, 0.75, 4.6, isPolice ? 0x1a1a22 : model.color, 0, 0.75, 0);
  g.add(body);
  const cabin = box(1.8, 0.65, 2.2, 0x18202c, 0, 1.4, -0.2);
  g.add(cabin);
  const glass = box(1.82, 0.4, 2.0, 0x9ad2e8, 0, 1.45, -0.2);
  glass.material = new THREE.MeshPhongMaterial({ color: 0x9ad2e8, shininess: 90 });
  g.add(glass);
  // headlights + taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.7, 0.7]) {
    const h = box(0.4, 0.18, 0.1, 0xfff2b0, sx, 0.75, 2.32); h.material = hl; g.add(h);
    const t = box(0.4, 0.18, 0.1, 0xff2a2a, sx, 0.75, -2.32); t.material = new THREE.MeshBasicMaterial({ color: 0xff2a2a }); g.add(t);
  }
  if (isPolice) {
    g.add(box(1.2, 0.28, 0.5, 0xff2a2a, -0.4, 1.85, -0.2));
    g.add(box(1.2, 0.28, 0.5, 0x2a6aff, 0.4, 1.85, -0.2));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.82, -0.2); g.add(bar);
  }
  // wheels
  const wheels = [];
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wm = new THREE.MeshLambertMaterial({ color: 0x14141a });
  for (const [wx, wz] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(wg, wm);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz);
    w.castShadow = true; g.add(w); wheels.push(w);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, wheels };
}

export function spawnCar(G, model, x, z, heading, opts = {}) {
  const { group, wheels } = makeCarMesh(model, opts.police);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  G.scene.add(group);
  const car = {
    model, group, wheels, x, z, heading, speed: 0, steer: 0,
    police: !!opts.police, traffic: !!opts.traffic, parked: !!opts.parked,
    driver: opts.driver || null, hp: 100, nitro: opts.nitro || 0,
    engine: opts.engine || 0, tires: opts.tires || 0, armor: opts.armor || 0,
    color: model.color, name: model.name, dead: false,
  };
  G.cars.push(car);
  return car;
}

export function carTopSpeed(car) {
  return car.model.top * (1 + car.engine * 0.09) + (car.nitro > 0 ? 6 : 0);
}

export function updatePlayerCar(G, dt) {
  const car = G.player.vehicle;
  if (!car) return;
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const steerIn = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  const hand = k['Space'] ? 1 : 0;
  const boost = (k['ShiftLeft'] || k['ShiftRight']) && car.nitro > 0;
  const top = carTopSpeed(car) * (boost ? 1.35 : 1);
  const accel = car.model.accel * (1 + car.engine * 0.08);
  car.speed += fwd * accel * dt;
  car.speed *= Math.pow(hand ? 0.86 : 0.985, dt * 60);
  car.speed = clamp(car.speed, -14, top);
  if (Math.abs(car.speed) < 0.05 && fwd === 0) car.speed = 0;
  const steerTarget = steerIn * 0.55 * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 12, 0.25, 1);
  car.steer = lerp(car.steer, steerTarget, 1 - Math.pow(0.001, dt));
  car.heading += car.steer * (car.speed / 14) * dt * (car.tires ? 1.12 : 1);
  if (boost) { car.nitro = Math.max(0, car.nitro - dt * 34); G.fx.nitro = true; }
  else G.fx.nitro = false;
  let nx = car.x + Math.sin(car.heading) * car.speed * dt;
  let nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collideCircle(G, nx, nz, 2.2);
  if (hit) {
    // slide along the collider face
    const tryX = collideCircle(G, nx, car.z, 2.2) ? car.x : nx;
    const tryZ = collideCircle(G, car.x, nz, 2.2) ? car.z : nz;
    nx = tryX; nz = tryZ;
    car.speed *= 0.55; car.hp -= 2; G.player.damageFlash = 0.25;
    if (car.hp <= 0) { car.hp = 0; G.events.push('car-wrecked'); }
  }
  [nx, nz] = clampToCity(nx, nz);
  car.x = nx; car.z = nz;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  car.group.rotation.z = -car.steer * 0.06;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
  if (car.wheels[0]) car.wheels[0].rotation.y = car.steer * 0.5;
  if (car.wheels[1]) car.wheels[1].rotation.y = car.steer * 0.5;
  G.player.pos.set(car.x, 1.2, car.z);
  G.player.heading = car.heading;
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.traffic || car.dead) continue;
    // traffic follows the road grid: drive along current axis, turn at intersections
    car.speed = lerp(car.speed, car.cruise || 12, dt);
    let nx = car.x + Math.sin(car.heading) * car.speed * dt;
    let nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const onRoadX = Math.abs(((car.x % CITY.roadGap) + CITY.roadGap) % CITY.roadGap) < 9;
    const onRoadZ = Math.abs(((car.z % CITY.roadGap) + CITY.roadGap) % CITY.roadGap) < 9;
    if (Math.abs(car.x) > CITY.half - 20 || Math.abs(car.z) > CITY.half - 20) {
      car.heading += Math.PI; // turn around at city edge
    } else if (onRoadX && onRoadZ && Math.random() < dt * 0.25) {
      car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; // random turn at intersection
    }
    // avoid the player car
    const pv = G.player.vehicle;
    if (pv && Math.hypot(nx - pv.x, nz - pv.z) < 7) { car.speed *= 0.4; nx = car.x; nz = car.z; }
    car.x = nx; car.z = nz;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
  }
}

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const lane = randi(-4, 4) * CITY.roadGap;
    const along = rand(-300, 300);
    const horizontal = Math.random() < 0.5;
    const model = pick(CAR_MODELS);
    const car = spawnCar(G, model, horizontal ? along : lane + rand(-3, 3), horizontal ? lane + rand(-3, 3) : along, horizontal ? Math.PI / 2 : 0, { traffic: true });
    car.cruise = rand(9, 15);
    car.speed = car.cruise;
  }
}

export function spawnParkedCars(G, n) {
  for (let i = 0; i < n; i++) {
    const lane = randi(-4, 4) * CITY.roadGap;
    const along = rand(-300, 300);
    const horizontal = Math.random() < 0.5;
    spawnCar(G, pick(CAR_MODELS), horizontal ? along : lane + 8, horizontal ? lane + 8 : along, horizontal ? Math.PI / 2 : 0, { parked: true });
  }
}

export function nearestStealableCar(G, maxD = 5) {
  let best = null, bd = maxD;
  for (const car of G.cars) {
    if (car.police || car.traffic || car === G.player.vehicle) continue;
    const d = Math.hypot(car.x - G.player.pos.x, car.z - G.player.pos.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
