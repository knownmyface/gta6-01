// walk.js — the player on foot: third-person walking, running, and the
// carjacking sequence (pull a driver out of a stopped car and take it).
import * as THREE from 'three';
import { clamp, damp, angleLerp, dist2, chance, rand } from './util.js';
import { collides, resolveCollision, clampToCity } from './coralcity.js';
import { makePedMesh, makeCarMesh } from './drive.js';

export function makePlayerMesh() {
  // The player: coral-red jacket, dark jeans — readable at a glance.
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.9 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0xd92828, roughness: 0.8 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x22304a, roughness: 0.9 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.85, 0.26), jeans);
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), jacket);
  torso.position.y = 1.18;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.72;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }));
  cap.position.y = 1.92;
  g.add(cap);
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.37, 1.18, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.37, 1.18, 0);
  g.add(armR);
  g.userData.arms = [armL, armR];
  g.userData.legs = legs;
  return g;
}

export function initPlayer(W) {
  const mesh = makePlayerMesh();
  mesh.position.set(0, 0, 12);
  W.scene.add(mesh);
  W.player = {
    mesh,
    x: 0, z: 12,
    heading: 0,
    speed: 0,
    mode: 'foot', // foot | car | bike | boat
    vehicle: null,
    cash: 2450,
    wanted: 0,
    health: 100,
    armor: 0,
    weapon: 'pistol',
    weapons: { pistol: { ammo: 48, owned: true }, smg: { ammo: 0, owned: false }, shotgun: { ammo: 0, owned: false }, rifle: { ammo: 0, owned: false } },
    walkPhase: 0,
    jackTimer: 0,
    jackTarget: null,
    punchTimer: 0,
  };
  return W.player;
}

// Find the nearest stealable car (traffic car or parked car) within reach.
export function nearestStealable(W, maxDist = 4.5) {
  let best = null;
  let bestD = maxDist;
  for (const v of W.traffic) {
    const d = dist2(v.x, v.z, W.player.x, W.player.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  for (const v of W.parked || []) {
    const d = dist2(v.x, v.z, W.player.x, W.player.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function updateOnFoot(W, dt) {
  const p = W.player;
  const k = W.keys;
  const run = k.has('ShiftLeft') || k.has('ShiftRight');
  const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
  const strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
  const targetSpeed = fwd !== 0 || strafe !== 0 ? (run ? 8.5 : 4.6) : 0;
  p.speed = damp(p.speed, targetSpeed, 8, dt);

  // Movement is camera-relative: W goes away from the camera.
  const camYaw = W.camYaw;
  const mx = Math.sin(camYaw) * -fwd + Math.cos(camYaw) * strafe;
  const mz = Math.cos(camYaw) * -fwd - Math.sin(camYaw) * strafe;
  const len = Math.hypot(mx, mz) || 1;
  if (p.speed > 0.2) {
    p.heading = angleLerp(p.heading, Math.atan2(mx / len, mz / len), 1 - Math.exp(-12 * dt));
    const nx = p.x + Math.sin(p.heading) * p.speed * dt;
    const nz = p.z + Math.cos(p.heading) * p.speed * dt;
    const c = clampToCity(nx, nz);
    const pos = { x: c.x, z: c.z };
    resolveCollision(W, pos, 0.6);
    p.x = pos.x;
    p.z = pos.z;
    p.walkPhase += dt * p.speed * 1.6;
  }
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  const swing = Math.sin(p.walkPhase) * 0.55 * clamp(p.speed / 5, 0, 1);
  p.mesh.userData.arms[0].rotation.x = swing;
  p.mesh.userData.arms[1].rotation.x = -swing;

  // Carjacking: press E near a car — the driver bails, you take the wheel.
  if (p.jackTimer > 0) {
    p.jackTimer -= dt;
    if (p.jackTimer <= 0 && p.jackTarget) {
      const v = p.jackTarget;
      // The driver flees on foot.
      const driver = makePedMesh(0x3d7ae8);
      driver.position.set(v.x + 2, 0, v.z + 2);
      W.scene.add(driver);
      W.peds.push({ mesh: driver, x: v.x + 2, z: v.z + 2, heading: rand(0, 6), speed: 5.5, walkPhase: 0, sidewalk: false, fleeing: true });
      W.traffic = W.traffic.filter((t) => t !== v);
      enterVehicle(W, v);
      W.player.wanted = Math.min(5, W.player.wanted + 1);
      W.hudFlash('CARJACKED — ' + v.name.toUpperCase());
      W.events.push({ type: 'carjack', name: v.name });
      p.jackTarget = null;
    }
    return;
  }
  if (k.has('KeyE')) {
    const target = nearestStealable(W);
    if (target) {
      p.jackTimer = 0.9;
      p.jackTarget = target;
      W.hudFlash('JACKING ' + target.name.toUpperCase() + '…');
      k.delete('KeyE');
    }
  }
}

export function enterVehicle(W, v) {
  const p = W.player;
  p.mode = v.isBike ? 'bike' : 'car';
  p.vehicle = v;
  v.isPlayer = true;
  p.x = v.x;
  p.z = v.z;
  p.heading = v.heading;
  p.mesh.visible = false;
  W.camMode = 'chase';
}

export function exitVehicle(W) {
  const p = W.player;
  const v = p.vehicle;
  if (!v) return;
  p.mode = 'foot';
  p.vehicle = null;
  v.isPlayer = false;
  // Step out to the side of the car.
  p.x = v.x + Math.cos(v.heading) * 2.4;
  p.z = v.z - Math.sin(v.heading) * 2.4;
  p.heading = v.heading;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  W.camMode = 'follow';
  W.events.push({ type: 'exitcar' });
}

// A few parked cars the player can steal without a chase.
export function spawnParkedCars(W) {
  W.parked = [];
  const spots = [
    { x: 26, z: -60, color: 0xd92828, name: 'Comet GT' },
    { x: -60, z: 26, color: 0x1a6fd4, name: 'Sunset Coupe' },
    { x: 130, z: -26, color: 0xffc21a, name: 'Reef Runner' },
    { x: -26, z: 130, color: 0x22b573, name: 'Palm Cruiser' },
    { x: 60, z: 156, color: 0xeeeeee, name: 'Bay Sedan' },
  ];
  for (const s of spots) {
    const mesh = makeCarMesh(s.color);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = rand(0, Math.PI * 2);
    W.scene.add(mesh);
    W.parked.push({
      mesh, x: s.x, z: s.z, heading: mesh.rotation.y,
      speed: 0, steer: 0, topSpeed: 34, accel: 16, grip: 1,
      nitro: 100, nitroMax: 100, damage: 0, isPlayer: false, name: s.name, color: s.color,
    });
  }
}
