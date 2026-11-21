// Coral Heat — on foot: the player walker, pedestrians, entering cars
// and the carjacking sequence (pull a driver out, take the car, wanted +1).
import * as THREE from 'three';
import { clamp, rand, pick } from './util.js';
import { nearestTrafficCar, stealTrafficCar } from './drive.js';

const PED_SHIRTS = [0xe8e8e8, 0x3a6fd9, 0xe8a832, 0x7a4ad9, 0x2ed9a8, 0xd95a7a, 0x8a8a8a];

export function makeWalkerMesh(shirt = 0xe83a2e, pants = 0x2a2a3a) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a075 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin);
  head.position.y = 1.62;
  g.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.08;
  g.add(torso);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pantsMat);
  legL.position.set(-0.16, 0.36, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirtMat);
  armL.position.set(-0.42, 1.08, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export function createWalker(G) {
  const mesh = makeWalkerMesh(0xe83a2e, 0x22304a);
  mesh.position.set(-200, 0, 20);
  G.scene.add(mesh);
  G.player.footMesh = mesh;
  G.player.pos.set(-200, 0, 20);
  G.player.heading = 0;
  G.player.speed = 0;
  G.player.mode = 'foot';
  return mesh;
}

export function updateOnFoot(G, dt) {
  if (G.player.mode !== 'foot') return;
  const k = G.keys;
  const mesh = G.player.footMesh;
  let ix = 0;
  let iz = 0;
  if (k['KeyW'] || k['ArrowUp']) iz += 1;
  if (k['KeyS'] || k['ArrowDown']) iz -= 1;
  if (k['KeyA'] || k['ArrowLeft']) ix -= 1;
  if (k['KeyD'] || k['ArrowRight']) ix += 1;
  const sprint = k['ShiftLeft'] ? 1.7 : 1;
  const speed = 5.2 * sprint;
  // camera-relative movement: forward is away from the camera
  const camFwd = new THREE.Vector3();
  G.camera.getWorldDirection(camFwd);
  camFwd.y = 0;
  camFwd.normalize();
  const camRight = new THREE.Vector3().crossVectors(camFwd, new THREE.Vector3(0, 1, 0)).negate();
  const move = new THREE.Vector3()
    .addScaledVector(camFwd, iz)
    .addScaledVector(camRight, ix);
  if (move.lengthSq() > 0) {
    move.normalize();
    G.player.pos.addScaledVector(move, speed * dt);
    const targetHeading = Math.atan2(move.x, move.z);
    let d = targetHeading - G.player.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    G.player.heading += d * Math.min(1, dt * 10);
    G.player.speed = speed;
    const swing = Math.sin(G.time * 11) * 0.55;
    mesh.userData.legL.rotation.x = swing;
    mesh.userData.legR.rotation.x = -swing;
    mesh.userData.armL.rotation.x = -swing * 0.8;
    mesh.userData.armR.rotation.x = swing * 0.8;
  } else {
    G.player.speed = 0;
    mesh.userData.legL.rotation.x *= 0.8;
    mesh.userData.legR.rotation.x *= 0.8;
    mesh.userData.armL.rotation.x *= 0.8;
    mesh.userData.armR.rotation.x *= 0.8;
  }
  G.player.pos.x = clamp(G.player.pos.x, -250, 300);
  G.player.pos.z = clamp(G.player.pos.z, -300, 300);
  // keep out of the water on foot
  if (G.player.pos.x < -248) G.player.pos.x = -248;
  mesh.position.copy(G.player.pos);
  mesh.rotation.y = G.player.heading;
}

export function enterNearestCar(G) {
  const t = nearestTrafficCar(G, 8);
  if (t) {
    stealTrafficCar(G, t);
    G.player.footMesh.visible = false;
    if (G.hud) G.hud.toast('Car taken — enjoy the ride');
    return true;
  }
  const car = G.player.car;
  if (car) {
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < 8) {
      G.player.mode = 'car';
      G.player.footMesh.visible = false;
      return true;
    }
  }
  return false;
}

export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  G.player.mode = 'foot';
  G.player.pos.set(car.pos.x + 2.5, 0, car.pos.z + 1.5);
  G.player.speed = 0;
  G.player.footMesh.visible = true;
  G.player.footMesh.position.copy(G.player.pos);
}

// F: yank the driver out of a nearby traffic car and take it. Wanted +1.
export function carjack(G) {
  const t = nearestTrafficCar(G, 7);
  if (!t) return false;
  // the pulled-out driver stumbles away on foot
  const driver = makeWalkerMesh(pick(PED_SHIRTS), 0x2a2a3a);
  driver.position.set(t.pos.x + 2, 0, t.pos.z);
  G.scene.add(driver);
  G.peds.push({
    mesh: driver, pos: driver.position, heading: Math.random() * Math.PI * 2,
    speed: 3.2, flee: true, panic: 6, wander: 0,
  });
  stealTrafficCar(G, t);
  G.player.footMesh.visible = false;
  G.player.wanted = Math.min(5, G.player.wanted + 1);
  if (G.hud) {
    G.hud.toast('CARJACKED — driver pulled out! Wanted level up');
    G.hud.banner('CARJACKED', 'You stole a ride in broad daylight');
  }
  if (G.sfx) G.sfx('carjack');
  return true;
}

export function spawnPedestrians(G, count = 26) {
  for (let i = 0; i < count; i++) {
    const mesh = makeWalkerMesh(pick(PED_SHIRTS), pick([0x2a2a3a, 0x3a2a1a, 0x1a2a3a]));
    let x = rand(-240, 290);
    let z = rand(-290, 290);
    // pedestrians walk on sidewalks, near roads
    if (Math.random() < 0.6) {
      const roads = [-180, -120, -60, 0, 60, 120, 180, 240];
      x = pick(roads) + rand(-11, 11);
    }
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.peds.push({
      mesh, pos: mesh.position, heading: rand(0, Math.PI * 2),
      speed: rand(1.2, 2.4), flee: false, panic: 0, wander: rand(0, 4),
    });
  }
}

export function updatePedestrians(G, dt) {
  for (const p of G.peds) {
    p.wander -= dt;
    if (p.panic > 0) {
      p.panic -= dt;
      p.speed = 4.5;
    } else if (p.wander <= 0) {
      p.wander = rand(2, 5);
      p.heading = rand(0, Math.PI * 2);
      p.speed = p.flee ? 3.4 : rand(1.2, 2.4);
    }
    // flee from the player car / gunfire
    const dx = p.pos.x - G.player.pos.x;
    const dz = p.pos.z - G.player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 12 && (G.player.mode === 'car' || G.player.firing)) {
      p.heading = Math.atan2(dx, dz);
      p.panic = 2.5;
    }
    p.pos.x += Math.sin(p.heading) * p.speed * dt;
    p.pos.z += Math.cos(p.heading) * p.speed * dt;
    p.pos.x = clamp(p.pos.x, -248, 298);
    p.pos.z = clamp(p.pos.z, -298, 298);
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.heading;
    const swing = Math.sin(G.time * 9 + p.pos.x) * 0.5;
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
  }
}
