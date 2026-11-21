// drive.js — cars: low-poly car models, arcade driving physics for the player,
// and the traffic system (AI cars cruising the road grid, pedestrians' cars too).
import * as THREE from 'three';
import { rand, randi, pick, chance, clamp, damp, angleLerp, dist2 } from './util.js';
import { collides, resolveCollision, clampToCity, GRID } from './coralcity.js';

export const CAR_COLORS = [0xd92828, 0x1a6fd4, 0xffc21a, 0x22b573, 0xeeeeee, 0x222226, 0xff7a1a, 0x8a2be2];
export const CAR_NAMES = ['Comet GT', 'Sunset Coupe', 'Reef Runner', 'Palm Cruiser', 'Bay Sedan', 'Coral Taxi', 'Harbor Van'];

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), dark);
  cabin.position.set(0, 1.18, -0.25);
  g.add(cabin);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), dark);
  spoiler.position.set(0, 1.05, -2.1);
  g.add(spoiler);
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    h.position.set(sx, 0.72, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const sx of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
    t.position.set(sx, 0.72, -2.22);
    g.add(t);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    sign.position.set(0, 1.62, -0.25);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

// One drivable vehicle (player car, traffic car or police car).
export function makeVehicle(W, color, x, z, heading, opts = {}) {
  const mesh = makeCarMesh(color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  W.scene.add(mesh);
  const v = {
    mesh, x, z, heading,
    speed: 0, steer: 0,
    topSpeed: opts.topSpeed || 34,
    accel: opts.accel || 16,
    grip: opts.grip || 1,
    nitro: opts.nitro || 0,
    nitroMax: 100,
    damage: 0,
    isPlayer: !!opts.player,
    name: opts.name || pick(CAR_NAMES),
    color,
  };
  return v;
}

export function driveVehicle(W, v, input, dt) {
  // input: { throttle: -1..1, steer: -1..1, brake, nitro }
  const up = W.garageUpgrades || { engine: 0, tires: 0, armor: 0, nitro: 0 };
  const top = v.topSpeed * (1 + 0.12 * (v.isPlayer ? up.engine : 0)) * (input.nitro && v.nitro > 0 ? 1.45 : 1);
  const acc = v.accel * (1 + 0.1 * (v.isPlayer ? up.engine : 0));
  if (input.throttle > 0) v.speed += acc * input.throttle * dt;
  else if (input.throttle < 0) v.speed += acc * input.throttle * dt * 0.9;
  if (input.brake) v.speed = damp(v.speed, 0, 6, dt);
  // Drag + rolling resistance.
  v.speed = damp(v.speed, 0, 0.25, dt);
  v.speed = clamp(v.speed, -12, top);
  if (input.nitro && v.nitro > 0 && v.speed > 4) v.nitro = Math.max(0, v.nitro - 34 * dt);
  else if (v.isPlayer) v.nitro = Math.min(v.nitroMax, v.nitro + 4 * dt);

  const steerTarget = clamp(input.steer, -1, 1) * (v.speed >= 0 ? 1 : -1);
  v.steer = damp(v.steer, steerTarget, 8, dt);
  const turnRate = 1.9 * (v.grip + 0.08 * (v.isPlayer ? up.tires : 0)) * clamp(Math.abs(v.speed) / 10, 0.25, 1);
  v.heading += v.steer * turnRate * Math.sign(v.speed || 1) * dt;

  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  const p = clampToCity(nx, nz);
  v.x = p.x;
  v.z = p.z;
  const pos = { x: v.x, z: v.z };
  resolveCollision(W, pos, 1.6);
  // A hard hit on a building costs speed + a little damage.
  if (pos.x !== v.x || pos.z !== v.z) {
    if (Math.abs(v.speed) > 12) {
      v.damage = Math.min(100, v.damage + Math.abs(v.speed) * 0.5);
      W.events?.push({ type: 'crash', speed: Math.abs(v.speed) });
    }
    v.speed *= 0.45;
    v.x = pos.x;
    v.z = pos.z;
  }
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
  // Body roll + pitch for feel.
  v.mesh.rotation.z = -v.steer * 0.05 * clamp(Math.abs(v.speed) / 20, 0, 1);
  v.mesh.rotation.x = clamp(-v.speed * 0.0012, -0.03, 0.03);
  const spin = v.speed * dt / 0.38;
  for (const w of v.mesh.userData.wheels) w.rotation.x += spin;
  return v;
}

// --- traffic -------------------------------------------------------------------
export function spawnTraffic(W, count) {
  W.traffic = [];
  for (let i = 0; i < count; i++) {
    const road = pick([GRID.min, GRID.min + GRID.step, GRID.min + 2 * GRID.step, GRID.min + 3 * GRID.step,
      GRID.min + 4 * GRID.step, GRID.min + 5 * GRID.step, GRID.min + 6 * GRID.step, GRID.min + 7 * GRID.step, GRID.max]);
    const along = rand(GRID.min, GRID.max);
    const vertical = chance(0.5);
    const x = vertical ? road + pick([-3, 3]) : along;
    const z = vertical ? along : road + pick([-3, 3]);
    const heading = vertical ? (chance(0.5) ? 0 : Math.PI) : (chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const v = makeVehicle(W, pick(CAR_COLORS), x, z, heading, {
      topSpeed: rand(11, 17), name: pick(CAR_NAMES), taxi: chance(0.12),
    });
    v.cruise = rand(10, 16);
    v.vertical = vertical;
    v.road = road;
    W.traffic.push(v);
  }
}

export function updateTraffic(W, dt) {
  for (const v of W.traffic) {
    // Cruise along the road grid; turn at intersections sometimes.
    const onRoadLine = v.vertical
      ? Math.abs(v.x - v.road) < 4
      : Math.abs(v.z - v.road) < 4;
    const atIntersection = v.vertical
      ? Math.abs(((v.z - GRID.min) % GRID.step + GRID.step) % GRID.step) < 3
      : Math.abs(((v.x - GRID.min) % GRID.step + GRID.step) % GRID.step) < 3;
    if (onRoadLine && atIntersection && chance(dt * 0.25)) {
      // Turn left or right onto the cross street.
      const turn = pick([-1, 1]);
      v.heading += turn * Math.PI / 2;
      v.vertical = !v.vertical;
      v.road = v.vertical ? Math.round(v.x / GRID.step) * GRID.step : Math.round(v.z / GRID.step) * GRID.step;
      v.road = clamp(v.road, GRID.min, GRID.max);
    }
    // Slow down when the player is right ahead.
    const pd = dist2(v.x, v.z, W.player.x, W.player.z);
    const target = pd < 14 ? v.cruise * 0.25 : v.cruise;
    v.speed = damp(v.speed, target, 2, dt);
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    const p = clampToCity(v.x, v.z);
    v.x = p.x;
    v.z = p.z;
    const pos = { x: v.x, z: v.z };
    resolveCollision(W, pos, 1.6);
    v.x = pos.x;
    v.z = pos.z;
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.heading;
    const spin = v.speed * dt / 0.38;
    for (const w of v.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// --- pedestrians ------------------------------------------------------------------
const PED_SHIRTS = [0xe85d3d, 0x2e9e6b, 0x3d7ae8, 0xe8c23d, 0x9b3de8, 0xeeeeee, 0x222226];

export function makePedMesh(shirt) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.9 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.24), pantsMat);
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirtMat);
  torso.position.y = 1.1;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62;
  g.add(head);
  const armGeo = new THREE.BoxGeometry(0.13, 0.55, 0.13);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.34, 1.1, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.34, 1.1, 0);
  g.add(armR);
  g.userData.arms = [armL, armR];
  return g;
}

export function spawnPeds(W, count) {
  W.peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePedMesh(pick(PED_SHIRTS));
    const x = rand(-200, 200);
    const z = rand(-200, 200);
    mesh.position.set(x, 0, z);
    W.scene.add(mesh);
    W.peds.push({
      mesh, x, z,
      heading: rand(0, Math.PI * 2),
      speed: rand(1.2, 2.4),
      walkPhase: rand(0, Math.PI * 2),
      sidewalk: chance(0.7),
    });
  }
}

export function updatePeds(W, dt) {
  for (const p of W.peds) {
    p.walkPhase += dt * 6;
    // Amble along; occasionally change direction, stay out of buildings.
    if (chance(dt * 0.08)) p.heading += rand(-1.2, 1.2);
    const nx = p.x + Math.sin(p.heading) * p.speed * dt;
    const nz = p.z + Math.cos(p.heading) * p.speed * dt;
    if (!collides(W, nx, nz, 0.6) && Math.abs(nx) < 210 && Math.abs(nz) < 220) {
      p.x = nx;
      p.z = nz;
    } else {
      p.heading += Math.PI / 2;
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    const swing = Math.sin(p.walkPhase) * 0.5;
    p.mesh.userData.arms[0].rotation.x = swing;
    p.mesh.userData.arms[1].rotation.x = -swing;
  }
}
