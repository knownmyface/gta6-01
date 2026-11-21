// boats.js — drivable boats, the marina district with moored boats, and
// the water the player can sail on (east bay + south ocean).
import * as THREE from 'three';
import { rand, pick, clamp, damp, angleLerp } from './util.js';
import { PLACES } from './coralcity.js';

export const BOAT_NAMES = ['Wave Runner', 'Coral Cruiser', 'Reef Racer', 'Sunset Yacht'];

export function makeBoatMesh(color, big = false) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, big ? 7.5 : 5.2), hullMat);
  hull.position.y = 0.55;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.55, big ? 4.6 : 3.4);
  g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, big ? 4.5 : 3.0),
    new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 }));
  deck.position.set(0, 1.1, big ? -0.6 : -0.3);
  g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 }));
  cabin.position.set(0, 1.65, big ? -1.2 : -0.8);
  g.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.5, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1a3a5a, roughness: 0.15, metalness: 0.5 }));
  glass.position.set(0, 1.8, big ? -0.2 : 0.2);
  g.add(glass);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
  motor.position.set(0, 0.8, big ? -3.9 : -2.8);
  g.add(motor);
  // Wake strip (fades in when moving).
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 7),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.15, -3.5);
  g.add(wake);
  g.userData.wake = wake;
  return g;
}

export function makeBoat(W, color, x, z, heading, opts = {}) {
  const mesh = makeBoatMesh(color, opts.big);
  mesh.position.set(x, 0.3, z);
  mesh.rotation.y = heading;
  W.scene.add(mesh);
  return {
    mesh, x, z, heading, speed: 0,
    topSpeed: opts.topSpeed || 26,
    name: opts.name || pick(BOAT_NAMES),
    color, isPlayer: false, big: !!opts.big,
    bobPhase: rand(0, 6),
  };
}

// Moored boats at the marina docks (scenery + stealable).
export function spawnMarina(W) {
  W.boats = [];
  W.moored = [];
  const dockZ = [20, 56, 92, 128];
  for (let i = 0; i < dockZ.length; i++) {
    const b = makeBoat(W, pick([0xffffff, 0xff7a1a, 0x1a6fd4, 0xd92828]), 206, dockZ[i], Math.PI / 2, { big: i === 3 });
    b.moored = true;
    W.moored.push(b);
    W.boats.push(b);
  }
  // A couple of boats cruising the bay.
  for (let i = 0; i < 3; i++) {
    const b = makeBoat(W, pick([0xeeeeee, 0x22b573]), rand(225, 300), rand(-100, 140), rand(0, 6));
    b.cruising = true;
    b.cruiseHeading = rand(0, Math.PI * 2);
    W.boats.push(b);
  }
}

export function nearestBoat(W, maxDist = 5) {
  let best = null;
  let bestD = maxDist;
  for (const b of W.boats) {
    const d = Math.hypot(b.x - W.player.x, b.z - W.player.z);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

export function enterBoat(W, b) {
  const p = W.player;
  p.mode = 'boat';
  p.vehicle = b;
  b.isPlayer = true;
  b.moored = false;
  p.x = b.x;
  p.z = b.z;
  p.heading = b.heading;
  p.mesh.visible = false;
  W.camMode = 'chase';
  W.hudFlash(b.name.toUpperCase() + ' — SET SAIL');
}

export function exitBoat(W) {
  const p = W.player;
  const b = p.vehicle;
  if (!b) return;
  p.mode = 'foot';
  p.vehicle = null;
  b.isPlayer = false;
  // Step onto the nearest dock / shore.
  p.x = Math.min(b.x, 200);
  p.z = b.z;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  W.camMode = 'follow';
}

export function driveBoat(W, b, input, dt) {
  const acc = 11;
  if (input.throttle > 0) b.speed += acc * dt;
  else if (input.throttle < 0) b.speed -= acc * 0.8 * dt;
  if (input.brake) b.speed = damp(b.speed, 0, 4, dt);
  b.speed = damp(b.speed, 0, 0.15, dt);
  b.speed = clamp(b.speed, -7, b.topSpeed);
  b.heading += clamp(input.steer, -1, 1) * 1.1 * clamp(Math.abs(b.speed) / 8, 0.2, 1) * Math.sign(b.speed || 1) * dt;
  b.x += Math.sin(b.heading) * b.speed * dt;
  b.z += Math.cos(b.heading) * b.speed * dt;
  // Stay in the water: east bay (x > 208) or south ocean (z > 214).
  if (b.x < 206 && b.z < 210) {
    b.x = Math.max(b.x, 206);
    if (b.z < 210) b.z = Math.min(b.z, 210);
    b.speed *= 0.5;
  }
  b.x = clamp(b.x, 206, 320);
  b.z = clamp(b.z, -230, 330);
  b.bobPhase += dt * 2;
  b.mesh.position.set(b.x, 0.3 + Math.sin(b.bobPhase) * 0.12, b.z);
  b.mesh.rotation.y = b.heading;
  b.mesh.rotation.z = Math.sin(b.bobPhase * 0.7) * 0.03 - clamp(input.steer, -1, 1) * 0.06;
  b.mesh.userData.wake.material.opacity = clamp(Math.abs(b.speed) / b.topSpeed, 0, 0.55);
  return b;
}

export function updateBoats(W, dt) {
  for (const b of W.boats) {
    if (b.isPlayer) continue;
    if (b.cruising) {
      // Slow cruise around the bay, turning at the edges.
      if (b.x > 305 || b.x < 218 || b.z > 180 || b.z < -180) b.cruiseHeading += Math.PI * 0.75;
      b.heading = angleLerp(b.heading, b.cruiseHeading, 1 - Math.exp(-0.8 * dt));
      b.speed = damp(b.speed, 9, 1, dt);
      b.x += Math.sin(b.heading) * b.speed * dt;
      b.z += Math.cos(b.heading) * b.speed * dt;
      b.bobPhase += dt * 2;
      b.mesh.position.set(b.x, 0.3 + Math.sin(b.bobPhase) * 0.12, b.z);
      b.mesh.rotation.y = b.heading;
    } else if (b.moored) {
      b.bobPhase += dt * 1.4;
      b.mesh.position.y = 0.3 + Math.sin(b.bobPhase) * 0.1;
      b.mesh.rotation.z = Math.sin(b.bobPhase * 0.6) * 0.015;
    }
  }
  // Ocean swell.
  if (W.city?.ocean) {
    W.city.ocean.position.y = 0.4 + Math.sin(W.time * 0.5) * 0.08;
  }
}
