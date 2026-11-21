// bikes.js — motorcycles: three models with different stats, lean-into-turn
// handling, wheelies on hard acceleration, and bike spawning around the city.
import * as THREE from 'three';
import { rand, pick, clamp, damp } from './util.js';

export const BIKE_MODELS = [
  { key: 'scooter', name: 'Reef Scooter', color: 0x22b573, topSpeed: 26, accel: 12, price: 0 },
  { key: 'sport', name: 'Coral Sport 600', color: 0xd92828, topSpeed: 40, accel: 20, price: 4500 },
  { key: 'chopper', name: 'Sunset Chopper', color: 0x1a1a1a, topSpeed: 34, accel: 15, price: 6800 },
];

export function makeBikeMesh(color, model = 'sport') {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.5, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.25, metalness: 0.9 });
  // Frame + tank + seat.
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 1.1), paint);
  tank.position.set(0, 0.85, 0.1);
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.9), dark);
  seat.position.set(0, 0.82, -0.75);
  g.add(seat);
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.7), paint);
  fender.position.set(0, 0.78, 1.05);
  g.add(fender);
  // Handlebars.
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), chrome);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 1.12, 0.75);
  g.add(bars);
  // Headlight.
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  light.position.set(0, 0.9, 1.28);
  g.add(light);
  // Exhaust pipe.
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 8), chrome);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(0.28, 0.45, -0.6);
  g.add(pipe);
  // Wheels.
  const wheelGeo = new THREE.TorusGeometry(0.36, 0.1, 8, 18);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wF = new THREE.Mesh(wheelGeo, wheelMat);
  wF.position.set(0, 0.36, 1.05);
  g.add(wF);
  const wB = new THREE.Mesh(wheelGeo, wheelMat);
  wB.position.set(0, 0.36, -0.95);
  g.add(wB);
  g.userData.wheels = [wF, wB];
  // Rider (simple, leans with the bike).
  const rider = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x22304a, roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.3), jacket);
  torso.position.set(0, 1.35, -0.35);
  torso.rotation.x = 0.35;
  rider.add(torso);
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.9 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.set(0, 1.72, -0.18);
  rider.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 }));
  helmet.position.set(0, 1.76, -0.18);
  rider.add(helmet);
  const legGeo = new THREE.BoxGeometry(0.14, 0.5, 0.14);
  const legL = new THREE.Mesh(legGeo, jacket);
  legL.position.set(-0.26, 0.95, -0.1);
  legL.rotation.x = -0.7;
  rider.add(legL);
  const legR = new THREE.Mesh(legGeo, jacket);
  legR.position.set(0.26, 0.95, -0.1);
  legR.rotation.x = -0.7;
  rider.add(legR);
  g.add(rider);
  g.userData.rider = rider;
  return g;
}

export function makeBike(W, model, x, z, heading) {
  const mesh = makeBikeMesh(model.color, model.key);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  W.scene.add(mesh);
  return {
    mesh, x, z, heading, speed: 0, steer: 0,
    topSpeed: model.topSpeed, accel: model.accel,
    model, name: model.name, color: model.color,
    isPlayer: false, isBike: true,
    nitro: 100, nitroMax: 100, damage: 0,
    wheelie: 0,
  };
}

export function spawnBikes(W) {
  W.bikes = [];
  const spots = [
    { model: BIKE_MODELS[0], x: 100, z: 100 },
    { model: BIKE_MODELS[1], x: -52, z: 104 },
    { model: BIKE_MODELS[2], x: 156, z: -52 },
    { model: BIKE_MODELS[1], x: 52, z: -156 },
  ];
  for (const s of spots) {
    W.bikes.push(makeBike(W, s.model, s.x, s.z, rand(0, Math.PI * 2)));
  }
}

export function nearestBike(W, maxDist = 4) {
  let best = null;
  let bestD = maxDist;
  for (const b of W.bikes) {
    const d = Math.hypot(b.x - W.player.x, b.z - W.player.z);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

export function driveBike(W, b, input, dt) {
  const top = b.topSpeed * (input.nitro && b.nitro > 0 ? 1.4 : 1);
  if (input.throttle > 0) b.speed += b.accel * input.throttle * dt;
  else if (input.throttle < 0) b.speed -= b.accel * 0.8 * dt;
  if (input.brake) b.speed = damp(b.speed, 0, 5, dt);
  b.speed = damp(b.speed, 0, 0.2, dt);
  b.speed = clamp(b.speed, -8, top);
  if (input.nitro && b.nitro > 0 && b.speed > 4) b.nitro = Math.max(0, b.nitro - 30 * dt);
  else b.nitro = Math.min(b.nitroMax, b.nitro + 5 * dt);

  b.steer = damp(b.steer, clamp(input.steer, -1, 1), 7, dt);
  // Bikes turn sharper than cars but lean hard.
  b.heading += b.steer * 2.6 * clamp(Math.abs(b.speed) / 12, 0.25, 1) * Math.sign(b.speed || 1) * dt;
  const nx = b.x + Math.sin(b.heading) * b.speed * dt;
  const nz = b.z + Math.cos(b.heading) * b.speed * dt;
  b.x = clamp(nx, -212, 212);
  b.z = clamp(nz, -212, 222);
  // Wheelie on hard acceleration from low speed.
  const wantWheelie = input.throttle > 0.8 && b.speed > 6 && b.speed < 18 ? 1 : 0;
  b.wheelie = damp(b.wheelie, wantWheelie, 4, dt);
  b.mesh.position.set(b.x, 0, b.z);
  b.mesh.rotation.y = b.heading;
  // Lean into the turn, pitch up on a wheelie.
  b.mesh.rotation.z = -b.steer * 0.42 * clamp(Math.abs(b.speed) / 18, 0, 1);
  b.mesh.rotation.x = -b.wheelie * 0.38;
  const spin = b.speed * dt / 0.36;
  for (const w of b.mesh.userData.wheels) w.rotation.y += spin;
  return b;
}

export function enterBike(W, b) {
  const p = W.player;
  p.mode = 'bike';
  p.vehicle = b;
  b.isPlayer = true;
  p.x = b.x;
  p.z = b.z;
  p.heading = b.heading;
  p.mesh.visible = false;
  W.camMode = 'chase';
  W.hudFlash(b.name.toUpperCase() + ' — RIDE OUT');
}

export function exitBike(W) {
  const p = W.player;
  const b = p.vehicle;
  if (!b) return;
  p.mode = 'foot';
  p.vehicle = null;
  b.isPlayer = false;
  p.x = b.x + 1.5;
  p.z = b.z;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  W.camMode = 'follow';
}
