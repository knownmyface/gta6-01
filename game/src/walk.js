// CORAL HEAT — on-foot movement, enter/exit vehicles, carjacking (v2.9, fresh).
import * as THREE from 'three';
import { clamp, collideCircle, dist2d, rand } from './util.js';

export function makeWalkerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff5a3c });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3a5c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirt);
  body.position.y = 1.15;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.82;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0x1c1c22 }));
  cap.position.y = 2.06;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), pants);
  legL.position.set(-0.17, 0.38, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), shirt);
  armL.position.set(-0.42, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  g.userData.legs = [legL, legR];
  g.userData.arms = [armL, armR];
  return g;
}

// Nearest drivable thing (car / bike / boat) within reach of the walker.
export function nearestRideable(G, maxD = 4.5) {
  const p = G.player;
  let best = null, bestD = maxD;
  for (const car of G.cars) {
    if (car.isPolice) continue;
    const d = dist2d(p.x, p.z, car.x, car.z);
    if (d < bestD) { bestD = d; best = { kind: 'car', obj: car, d }; }
  }
  for (const bike of G.bikes || []) {
    if (bike.ridden) continue;
    const d = dist2d(p.x, p.z, bike.x, bike.z);
    if (d < bestD) { bestD = d; best = { kind: 'bike', obj: bike, d }; }
  }
  for (const boat of G.boats || []) {
    if (boat.ridden) continue;
    const d = dist2d(p.x, p.z, boat.x, boat.z);
    if (d < bestD) { bestD = d; best = { kind: 'boat', obj: boat, d }; }
  }
  return best;
}

export function setupWalker(G) {
  const mesh = makeWalkerMesh();
  G.scene.add(mesh);
  G.player.mesh = mesh;
  G.player.x = G.city.spawn.x;
  G.player.z = G.city.spawn.z;
  G.player.heading = G.city.spawn.heading;
  G.player.walkPhase = 0;
  mesh.position.set(G.player.x, 0, G.player.z);
  mesh.visible = true;
}

export function enterVehicle(G, ride) {
  const p = G.player;
  if (ride.kind === 'car') {
    p.mode = 'car';
    p.car = ride.obj;
    ride.obj.isPlayer = true;
    ride.obj.driver = null;
    p.mesh.visible = false;
    G.hud.toast('You took the ' + (ride.obj.kind === 'sport' ? 'sports car' : ride.obj.kind) + ' — drive!');
    G.audio?.blip(660);
  } else if (ride.kind === 'bike') {
    p.mode = 'bike';
    p.bike = ride.obj;
    ride.obj.ridden = true;
    p.mesh.visible = false;
    G.hud.toast('On the bike — lean with A/D, wheelie with SPACE');
    G.audio?.blip(880);
  } else if (ride.kind === 'boat') {
    p.mode = 'boat';
    p.boat = ride.obj;
    ride.obj.ridden = true;
    p.mesh.visible = false;
    G.hud.toast('On the boat — cruise the marina');
    G.audio?.blip(520);
  }
}

export function exitVehicle(G) {
  const p = G.player;
  if (p.mode === 'car' && p.car) {
    p.x = p.car.x + Math.sin(p.car.heading + Math.PI / 2) * 3;
    p.z = p.car.z + Math.cos(p.car.heading + Math.PI / 2) * 3;
    p.car.isPlayer = false;
    p.car.speed = 0;
    p.car = null;
  } else if (p.mode === 'bike' && p.bike) {
    p.x = p.bike.x + 2; p.z = p.bike.z + 2;
    p.bike.ridden = false;
    p.bike.speed = 0;
    p.bike = null;
  } else if (p.mode === 'boat' && p.boat) {
    // hop back to the nearest dock
    let dock = G.city.docks[0];
    let bd = 1e9;
    for (const d of G.city.docks) {
      const dd = dist2d(p.boat.x, p.boat.z, d.x, d.z);
      if (dd < bd) { bd = dd; dock = d; }
    }
    p.x = dock.x - 6; p.z = dock.z;
    p.boat.ridden = false;
    p.boat.speed = 0;
    p.boat = null;
  } else return;
  p.mode = 'foot';
  p.heading = rand(0, Math.PI * 2);
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
}

// On-foot update: WASD relative to camera, E to enter, F to carjack.
export function updateWalker(G, dt) {
  const p = G.player;
  const k = G.keys;
  const camYaw = G.camYaw || 0;
  let mx = 0, mz = 0;
  if (k['KeyW']) mz -= 1;
  if (k['KeyS']) mz += 1;
  if (k['KeyA']) mx -= 1;
  if (k['KeyD']) mx += 1;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len; mz /= len;
    const run = k['ShiftLeft'] ? 8.5 : 5.2;
    // camera-relative: forward is -sin/-cos of camYaw
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = -fz, rz = fx;
    const vx = fx * -mz + rx * mx;
    const vz = fz * -mz + rz * mx;
    let nx = p.x + vx * run * dt;
    let nz = p.z + vz * run * dt;
    [nx, nz] = collideCircle(nx, nz, 0.6, G.city.colliders);
    nx = clamp(nx, -338, 338); nz = clamp(nz, -338, 338);
    p.x = nx; p.z = nz;
    p.heading = Math.atan2(-vx, -vz);
    p.walkPhase += dt * 11;
  } else {
    p.walkPhase *= 0.85;
  }
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  const swing = Math.sin(p.walkPhase) * 0.5;
  p.mesh.userData.legs[0].rotation.x = swing;
  p.mesh.userData.legs[1].rotation.x = -swing;
  p.mesh.userData.arms[0].rotation.x = -swing * 0.8;
  p.mesh.userData.arms[1].rotation.x = swing * 0.8;

  // --- carjacking: hold F near an occupied traffic car -------------------
  const near = nearestRideable(G, 4.5);
  G.hud.setPrompt(near ? (near.kind === 'car' && near.obj.isTraffic ? 'Hold F — carjack this car' : 'Press E — get in') : '');
  if (near && near.kind === 'car' && near.obj.isTraffic && k['KeyF']) {
    G.carjack = G.carjack || { car: near.obj, t: 0 };
    if (G.carjack.car !== near.obj) G.carjack = { car: near.obj, t: 0 };
    G.carjack.t += dt;
    G.hud.setCarjack(G.carjack.t / 1.2);
    if (G.carjack.t >= 1.2) {
      const car = near.obj;
      car.isTraffic = false;
      // driver bails and runs away on foot
      spawnFleeingDriver(G, car);
      G.carjack = null;
      G.hud.setCarjack(0);
      G.audio?.alarm();
      enterVehicle(G, { kind: 'car', obj: car });
      G.hud.toast('CARJACKED! The driver ran off — wanted level up');
      G.cops.addWanted(1);
    }
  } else {
    if (G.carjack) { G.carjack = null; G.hud.setCarjack(0); }
  }
}

function spawnFleeingDriver(G, car) {
  const ped = {
    x: car.x + 2, z: car.z + 2, heading: rand(0, Math.PI * 2),
    speed: 6, mesh: makeWalkerMesh(), flee: true, health: 100, kind: 'driver',
  };
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.scale.set(0.96, 0.96, 0.96);
  const shirt = ped.mesh.children[0];
  G.scene.add(ped.mesh);
  G.peds.push(ped);
  G.fleeingDriver = ped;
}
