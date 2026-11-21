// CORAL HEAT — drivable boats + marina (v2.9, fresh).
import * as THREE from 'three';
import { clamp, rand, pick, dist2d } from './util.js';

export function makeBoatMesh(color, kind = 'speed') {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, kind === 'yacht' ? 11 : 7.5), hullMat);
  hull.position.y = 0.4;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.6, 4), hullMat);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  bow.position.set(0, 0.4, kind === 'yacht' ? -6.4 : -4.8);
  g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, kind === 'yacht' ? 8 : 5), new THREE.MeshLambertMaterial({ color: 0xf0ead8 }));
  deck.position.y = 1.2;
  g.add(deck);
  if (kind === 'yacht') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 4.5), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cabin.position.set(0, 2.2, 1);
    g.add(cabin);
  } else {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    seat.position.set(0, 1.8, 1.4);
    g.add(seat);
    const engine = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    engine.position.set(0, 1.0, 4.0);
    g.add(engine);
  }
  g.userData.len = kind === 'yacht' ? 11 : 7.5;
  return g;
}

export function setupBoats(G) {
  G.boats = [];
  const defs = [
    { x: 318, z: -114, kind: 'speed', color: 0xffd76b },
    { x: 318, z: -34, kind: 'speed', color: 0x6bb8ff },
    { x: 318, z: 46, kind: 'yacht', color: 0xf0f0e8 },
    { x: 318, z: 126, kind: 'speed', color: 0xff8a5c },
  ];
  for (const d of defs) {
    const mesh = makeBoatMesh(d.color, d.kind);
    mesh.position.set(d.x, 0, d.z);
    G.scene.add(mesh);
    G.boats.push({ mesh, x: d.x, z: d.z, heading: 0, speed: 0, kind: d.kind, color: d.color, ridden: false, top: d.kind === 'yacht' ? 26 : 40 });
  }
  // extra moored decoration boats (not rideable)
  for (let i = 0; i < 5; i++) {
    const mesh = makeBoatMesh(pick([0xffffff, 0xffd76b, 0x59c2d6]), 'speed');
    mesh.position.set(340 + rand(-8, 8), 0, -150 + i * 70 + rand(-6, 6));
    mesh.rotation.y = rand(-0.3, 0.3);
    G.scene.add(mesh);
  }
}

// Boat physics: slower accel, wide drift, confined to the water (x > 298).
export function stepBoat(G, boat, input, dt) {
  if (input.throttle > 0) boat.speed += 14 * input.throttle * dt;
  else if (input.throttle < 0) boat.speed += 10 * input.throttle * dt;
  boat.speed -= boat.speed * 0.25 * dt;
  boat.speed = clamp(boat.speed, -8, boat.top);
  const steerAuthority = clamp(Math.abs(boat.speed) / 10, 0, 1);
  boat.heading += input.steer * 1.1 * steerAuthority * dt * (boat.speed >= 0 ? 1 : -1);
  const fx = -Math.sin(boat.heading), fz = -Math.cos(boat.heading);
  let nx = boat.x + fx * boat.speed * dt;
  let nz = boat.z + fz * boat.speed * dt;
  if (nx < 300) { nx = 300; boat.speed *= 0.4; }
  if (nx > 460) { nx = 460; boat.speed *= 0.4; }
  if (nz > 360) { nz = 360; boat.speed *= 0.4; }
  if (nz < -360) { nz = -360; boat.speed *= 0.4; }
  boat.x = nx; boat.z = nz;
  // bob on the swell
  boat.mesh.position.set(boat.x, Math.sin(G.time * 1.8 + boat.x * 0.05) * 0.25, boat.z);
  boat.mesh.rotation.y = boat.heading;
  boat.mesh.rotation.z = Math.sin(G.time * 1.4 + boat.z * 0.04) * 0.05 - input.steer * clamp(Math.abs(boat.speed) / 30, 0, 1) * 0.12;
  // wake
  if (Math.abs(boat.speed) > 12 && Math.random() < 0.4) {
    const wake = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xbfe8f0, transparent: true, opacity: 0.5 })
    );
    wake.position.set(boat.x + Math.sin(boat.heading) * 4, 0.1, boat.z + Math.cos(boat.heading) * 4);
    G.scene.add(wake);
    setTimeout(() => G.scene.remove(wake), 900);
  }
}
