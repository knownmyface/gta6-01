// drive.js — arcade car physics, the player's vehicle, traffic cars,
// and the shared car-mesh factory. Cars stay on the road grid; traffic
// follows simple waypoint loops and yields nothing.
import * as THREE from "../vendor/three/three.module.min.js";
import { clamp, lerp, lerpAngle, rand, randInt, pick, angleDiff, dist2d } from "./util.js";

export const CAR_MODELS = [
  { id: "sunset-gt", name: "Sunset GT", color: 0xff5a2a, top: 62, accel: 26, grip: 2.6, price: 0 },
  { id: "coral-coupe", name: "Coral Coupe", color: 0xffd23c, top: 55, accel: 23, grip: 2.4, price: 8500 },
  { id: "tide-sedan", name: "Tide Sedan", color: 0x37b6ff, top: 46, accel: 18, grip: 2.2, price: 3200 },
  { id: "midnight-runner", name: "Midnight Runner", color: 0x8a2be2, top: 68, accel: 30, grip: 2.9, price: 22000 },
  { id: "beach-buggy", name: "Beach Buggy", color: 0x2fd47a, top: 40, accel: 20, grip: 2.0, price: 4500 },
];

const TRAFFIC_COLORS = [0xd8d8d8, 0x3a6fd8, 0xc23a3a, 0x3ac27a, 0xe0a83a, 0x888888, 0x222831, 0xff8ac2];

export function makeCarMesh(color, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101c2c, metalness: 0.8, roughness: 0.15 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  g.add(cabin);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.35), bodyMat);
  spoiler.position.set(0, 1.0, -2.1);
  g.add(spoiler);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12), wheelMat);
    tire.rotation.z = Math.PI / 2;
    wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.08), lightMat);
    hl.position.set(lx, 0.62, 2.22);
    g.add(hl);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const lx of [-0.65, 0.65]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), tailMat);
    tl.position.set(lx, 0.62, -2.22);
    g.add(tl);
  }
  if (o.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(-0.3, 1.45, -0.2);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.35, 1.45, -0.2);
    g.add(bar2);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.1, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.set(0, 0.72, 0.4);
    g.add(stripe);
  }
  g.userData.wheels = wheels;
  return g;
}

export function spawnPlayerCar(G, modelId, x, z, heading) {
  const model = CAR_MODELS.find((m) => m.id === modelId) || CAR_MODELS[0];
  const mesh = makeCarMesh(model.color, {});
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    kind: "car",
    model,
    mesh,
    x, z,
    heading,
    speed: 0,
    steer: 0,
    throttle: 0,
    damage: 0,
    onRoad: true,
  };
  G.playerCar = car;
  return car;
}

function trafficRoute(rng) {
  // Loop around two adjacent blocks: pick a rectangle of roads.
  const x0 = (Math.floor(rng() * 9) - 4) * 60;
  const z0 = (Math.floor(rng() * 7) - 3) * 60 - 60;
  const w = 60 + Math.floor(rng() * 3) * 60;
  const d = 60 + Math.floor(rng() * 2) * 60;
  return [
    { x: x0, z: z0 }, { x: x0 + w, z: z0 },
    { x: x0 + w, z: z0 + d }, { x: x0, z: z0 + d },
  ];
}

export function spawnTraffic(G, count) {
  G.traffic = G.traffic || [];
  const rng = Math.random;
  for (let i = 0; i < count; i++) {
    const route = trafficRoute(rng);
    const wp = Math.floor(rng() * route.length);
    const mesh = makeCarMesh(pick(TRAFFIC_COLORS), {});
    const start = route[wp];
    mesh.position.set(start.x + rand(-2, 2), 0, start.z + rand(-2, 2));
    G.scene.add(mesh);
    G.traffic.push({
      mesh, route, wp,
      speed: rand(9, 16),
      x: start.x, z: start.z,
      heading: 0,
    });
  }
  return G.traffic;
}

export function updateTraffic(G, dt) {
  if (!G.traffic) return;
  for (const t of G.traffic) {
    const target = t.route[(t.wp + 1) % t.route.length];
    const dx = target.x - t.x;
    const dz = target.z - t.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 3) {
      t.wp = (t.wp + 1) % t.route.length;
      continue;
    }
    const want = Math.atan2(dx, dz);
    t.heading = lerpAngle(t.heading, want, clamp(dt * 3, 0, 1));
    t.x += Math.sin(t.heading) * t.speed * dt;
    t.z += Math.cos(t.heading) * t.speed * dt;
    t.mesh.position.set(t.x, 0, t.z);
    t.mesh.rotation.y = t.heading;
  }
}

export function updatePlayerCar(G, dt, input) {
  const car = G.playerCar;
  if (!car || G.player.mode !== "car") return;
  const m = car.model;
  const fwd = input.forward ? 1 : input.back ? -0.55 : 0;
  car.throttle = fwd;
  const targetSpeed = fwd * m.top;
  const accelRate = fwd !== 0 ? m.accel : 14;
  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + accelRate * dt);
  else if (car.speed > targetSpeed) car.speed = Math.max(targetSpeed, car.speed - accelRate * 1.4 * dt);
  if (input.brake) car.speed = lerp(car.speed, 0, clamp(dt * 5, 0, 1));
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer = lerp(car.steer, steerTarget, clamp(dt * 6, 0, 1));
  const spd01 = clamp(Math.abs(car.speed) / m.top, 0, 1);
  const turnRate = car.steer * m.grip * (0.35 + spd01 * 0.85) * Math.sign(car.speed || 1);
  car.heading += turnRate * dt * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // Keep the car inside the city; soft bounce at the edge.
  if (Math.abs(car.x) > 335 || Math.abs(car.z) > 335 || car.z < -200) {
    car.heading += Math.PI;
    car.speed *= 0.4;
    car.x = clamp(car.x, -330, 330);
    car.z = clamp(car.z, -198, 330);
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.mesh.rotation.z = -car.steer * spd01 * 0.06;
  const wheels = car.mesh.userData.wheels || [];
  for (const w of wheels) w.rotation.x += car.speed * dt * 2.4;
  if (wheels[0]) wheels[0].rotation.y = car.steer * 0.35;
  if (wheels[1]) wheels[1].rotation.y = car.steer * 0.35;
  G.player.pos.set(car.x, 0, car.z);
  G.player.heading = car.heading;
  G.player.speed = car.speed;
  G.displaySpeed = Math.abs(car.speed) * 2.6; // m/s -> MPH-ish arcade scale
  if (G.sound) G.sound.setEngine(spd01, fwd !== 0 ? 1 : 0);
}

// Nearest traffic car within reach for carjacking (F).
export function nearestStealableCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const t of G.traffic || []) {
    const d = dist2d(G.player.pos.x, G.player.pos.z, t.x, t.z);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

// Pull the player out of a traffic car and into it (carjacking).
export function jackCar(G, trafficCar) {
  if (!trafficCar) return false;
  const idx = G.traffic.indexOf(trafficCar);
  if (idx >= 0) G.traffic.splice(idx, 1);
  G.scene.remove(trafficCar.mesh);
  const old = G.playerCar;
  if (old) G.scene.remove(old.mesh);
  const model = pick(CAR_MODELS);
  const mesh = makeCarMesh(trafficCar.mesh.userData.color || model.color, {});
  mesh.position.set(trafficCar.x, 0, trafficCar.z);
  mesh.rotation.y = trafficCar.heading;
  G.scene.add(mesh);
  G.playerCar = {
    kind: "car", model, mesh,
    x: trafficCar.x, z: trafficCar.z,
    heading: trafficCar.heading, speed: 0, steer: 0, throttle: 0, damage: 0, onRoad: true,
  };
  G.player.mode = "car";
  G.player.pos.set(trafficCar.x, 0, trafficCar.z);
  G.player.heading = trafficCar.heading;
  if (G.wanted !== undefined) G.setWanted(Math.min(5, (G.wanted || 0) + 1));
  if (G.toast) G.toast("Car jacked — the Bay PD is on you now");
  return true;
}
