// walk.js — on-foot player: capsule character, walk/run, carjacking sequence,
// enter/exit vehicles, punch combat hooks.
import * as THREE from 'three';
import { box, cyl, clamp, lerp, rand, pick } from './util.js';
import { collideCircle, clampToCity } from './coralcity.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.Color(0xff5a3c);
  const body = box(0.9, 1.1, 0.5, 0xff5a3c, 0, 1.35, 0); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
  head.position.set(0, 2.25, 0); head.castShadow = true; g.add(head);
  const cap = cyl(0.36, 0.38, 0.16, 0x2a4a6a, 0, 2.5, 0, 12); g.add(cap);
  const legs = [];
  for (const sx of [-0.22, 0.22]) {
    const leg = box(0.32, 0.9, 0.36, 0x2a3a5a, sx, 0.45, 0); g.add(leg); legs.push(leg);
  }
  const arms = [];
  for (const sx of [-0.55, 0.55]) {
    const arm = box(0.26, 0.85, 0.3, 0xff5a3c, sx, 1.35, 0); g.add(arm); arms.push(arm);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs, arms };
}

export function updateOnFoot(G, dt) {
  const p = G.player;
  const k = G.keys;
  let ix = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
  let iz = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const run = k['ShiftLeft'] || k['ShiftRight'];
  const speed = run ? 9.5 : 5.2;
  // camera-relative movement: W walks AWAY from the camera (camera sits behind
  // the player at +dir(camYaw), so forward is -dir(camYaw)); this keeps camYaw
  // stable instead of chasing the heading around in a circle.
  const cy = G.camYaw || 0;
  const mx = -(ix * Math.cos(cy) + iz * Math.sin(cy));
  const mz = -(-ix * Math.sin(cy) + iz * Math.cos(cy));
  const len = Math.hypot(mx, mz);
  p.moving = len > 0.1;
  if (p.moving) {
    const nx = p.pos.x + (mx / len) * speed * dt;
    const nz = p.pos.z + (mz / len) * speed * dt;
    const hit = collideCircle(G, nx, nz, 0.8);
    if (!hit) { p.pos.x = nx; p.pos.z = nz; }
    else {
      if (!collideCircle(G, nx, p.pos.z, 0.8)) p.pos.x = nx;
      else if (!collideCircle(G, p.pos.x, nz, 0.8)) p.pos.z = nz;
    }
    p.heading = Math.atan2(mx / len, mz / len);
    p.walkPhase += dt * (run ? 13 : 9);
  }
  const [cx, cz] = clampToCity(p.pos.x, p.pos.z);
  p.pos.x = cx; p.pos.z = cz;
  p.mesh.group.position.set(p.pos.x, 0, p.pos.z);
  p.mesh.group.rotation.y = p.heading;
  // walk-cycle swing
  const sw = p.moving ? Math.sin(p.walkPhase) * 0.5 : 0;
  p.mesh.legs[0].rotation.x = sw; p.mesh.legs[1].rotation.x = -sw;
  p.mesh.arms[0].rotation.x = -sw * 0.8; p.mesh.arms[1].rotation.x = sw * 0.8;
  // punch animation
  if (p.punchT > 0) {
    p.punchT -= dt;
    p.mesh.arms[1].rotation.x = -1.6;
  }
}

export function tryEnterVehicle(G) {
  const p = G.player;
  if (p.vehicle) return false;
  // nearest car (parked or traffic with driver) within reach
  let best = null, bd = 5.5;
  for (const car of G.cars) {
    if (car.police || car === p.vehicle || car.dead) continue;
    const d = Math.hypot(car.x - p.pos.x, car.z - p.pos.z);
    if (d < bd) { bd = d; best = car; }
  }
  if (!best) return false;
  if (best.traffic && best.driver) {
    // carjacking sequence: yank the driver out, they stumble away
    startCarjack(G, best);
    return true;
  }
  best.parked = false; best.traffic = false;
  enterCar(G, best);
  return true;
}

export function enterCar(G, car) {
  const p = G.player;
  p.vehicle = car;
  p.onFoot = false;
  p.mesh.group.visible = false;
  car.speed = 0;
  G.hud.say('You took the ' + car.name, 2.2);
  G.sound.blip(520, 0.08);
}

export function exitCar(G) {
  const p = G.player;
  const car = p.vehicle;
  if (!car) return;
  p.vehicle = null;
  p.onFoot = true;
  p.pos.set(car.x - Math.sin(car.heading) * 3, 1.2, car.z - Math.cos(car.heading) * 3);
  p.heading = car.heading;
  p.mesh.group.visible = true;
  G.sound.blip(330, 0.08);
}

export function startCarjack(G, car) {
  const p = G.player;
  p.carjack = { t: 0, car, phase: 'approach' };
  G.hud.say('CARJACKING — hold on!', 2.5);
  G.sound.horn();
}

export function updateCarjack(G, dt) {
  const p = G.player;
  const cj = p.carjack;
  if (!cj) return;
  cj.t += dt;
  const car = cj.car;
  // phase 1: yank driver — driver ped stumbles out and runs
  if (cj.phase === 'approach' && cj.t > 0.5) {
    cj.phase = 'yank';
    if (car.driver) {
      car.driver.fleeing = true;
      car.driver = null;
    }
    G.hud.say('Driver pulled out — the ' + car.name + ' is yours!', 2.5);
    G.wanted.add(1);
    G.sound.blip(180, 0.2);
  }
  // phase 2: slide in
  if (cj.phase === 'yank' && cj.t > 1.4) {
    cj.phase = 'done';
    car.traffic = false; car.parked = false;
    p.carjack = null;
    enterCar(G, car);
  }
  // player walks to the door during the sequence
  if (cj.phase === 'approach') {
    const dx = car.x - p.pos.x, dz = car.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5) {
      p.pos.x += (dx / d) * 4 * dt;
      p.pos.z += (dz / d) * 4 * dt;
      p.heading = Math.atan2(dx, dz);
      p.mesh.group.position.set(p.pos.x, 0, p.pos.z);
      p.mesh.group.rotation.y = p.heading;
    }
  }
}

export function spawnPedestrians(G, n) {
  const colors = [0xffd23c, 0x7ae0a0, 0xff8ac2, 0x9ad2e8, 0xf0f0f0, 0xc98a4b];
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const shirt = pick(colors);
    g.add(box(0.85, 1.05, 0.45, shirt, 0, 1.3, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshLambertMaterial({ color: pick([0xe8b98a, 0x8a5a3a, 0xf0c8a0]) }));
    head.position.set(0, 2.15, 0); head.castShadow = true; g.add(head);
    g.add(box(0.3, 0.85, 0.32, 0x2a3a5a, -0.2, 0.42, 0));
    g.add(box(0.3, 0.85, 0.32, 0x2a3a5a, 0.2, 0.42, 0));
    g.position.set(rand(-300, 300), 0, rand(-300, 300));
    G.scene.add(g);
    G.peds.push({ group: g, x: g.position.x, z: g.position.z, heading: rand(0, Math.PI * 2), speed: rand(1, 2.2), phase: rand(0, 6), fleeing: false, panic: 0 });
  }
}

export function updatePedestrians(G, dt) {
  const px = G.player.pos.x, pz = G.player.pos.z;
  for (const ped of G.peds) {
    const d = Math.hypot(ped.x - px, ped.z - pz);
    if (G.wanted.level >= 3 && d < 18) ped.fleeing = true;
    if (ped.fleeing) {
      ped.speed = 5;
      const dx = ped.x - px, dz = ped.z - pz;
      const l = Math.hypot(dx, dz) || 1;
      ped.heading = Math.atan2(dx / l, dz / l);
    } else if (Math.random() < dt * 0.08) {
      ped.heading = rand(0, Math.PI * 2);
    }
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    ped.x = clamp(ped.x, -330, 330); ped.z = clamp(ped.z, -330, 360);
    ped.phase += dt * 7;
    ped.group.position.set(ped.x, Math.abs(Math.sin(ped.phase)) * 0.08, ped.z);
    ped.group.rotation.y = ped.heading;
    if (d > 40) ped.fleeing = false;
  }
}
