// Coral Heat — boats: marina district, drivable speedboats, wake + bobbing.
// Fresh write, round 7.
import * as THREE from 'three';
import { clamp, rand, pick } from './util.js';

export const BOAT_MODELS = [
  { name: 'Coral Skiff', top: 26, accel: 12, color: 0xf8f8f8 },
  { name: 'Bay Runner 280', top: 38, accel: 18, color: 0xff6b6b },
  { name: 'Neon Jet', top: 48, accel: 24, color: 0x4ecdc4 },
];

export function makeBoatMesh(THREE, color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 8.5), new THREE.MeshLambertMaterial({ color }));
  hull.position.y = 0.6; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.6, 4), new THREE.MeshLambertMaterial({ color }));
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.6, 5.4); g.add(bow);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 3.2), new THREE.MeshLambertMaterial({ color: 0x223344 }));
  cab.position.set(0, 1.8, -0.6); g.add(cab);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.3, 8.5), new THREE.MeshBasicMaterial({ color: 0xff2fd6 }));
  stripe.position.y = 1.1; g.add(stripe);
  g.userData = {};
  return g;
}

export class Boats {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    const spots = [[-104, 240], [-96, 244], [0, 240], [8, 244], [104, 240], [112, 244], [-52, 242], [52, 242]];
    for (let i = 0; i < spots.length; i++) {
      const model = BOAT_MODELS[i % BOAT_MODELS.length];
      const mesh = makeBoatMesh(THREE, model.color);
      scene.add(mesh);
      const b = { mesh, model, x: spots[i][0], z: spots[i][1], heading: Math.PI, speed: 0, taken: false, bob: rand(0, 6) };
      mesh.position.set(b.x, 0, b.z);
      mesh.rotation.y = b.heading;
      this.list.push(b);
    }
    this.active = null;   // boat the player is driving
  }
  nearest(x, z, maxD = 6) {
    let best = null, bd = maxD * maxD;
    for (const b of this.list) {
      if (b.taken) continue;
      const d = (b.x - x) ** 2 + (b.z - z) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  board(boat) {
    boat.taken = true;
    this.active = boat;
    return boat;
  }
  leave() {
    if (!this.active) return null;
    const b = this.active;
    b.taken = false;
    b.speed = 0;
    this.active = null;
    return b;
  }
  update(dt, input, t) {
    for (const b of this.list) {
      if (b === this.active) continue;
      b.bob += dt;
      b.mesh.position.y = Math.sin(b.bob * 1.4) * 0.12;
      b.mesh.rotation.z = Math.sin(b.bob * 1.1) * 0.02;
    }
    const b = this.active;
    if (!b) return;
    if (input.forward) b.speed += b.model.accel * dt;
    if (input.back) b.speed -= b.model.accel * 0.6 * dt;
    if (!input.forward && !input.back) b.speed *= Math.max(0, 1 - 0.8 * dt);
    b.speed = clamp(b.speed, -8, b.model.top);
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    b.heading += steer * clamp(Math.abs(b.speed) / 12, 0, 1) * 1.1 * dt;
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    // stay in the water: south marina + west ocean
    if (b.z < 196 && b.x > -240) { b.z = 196; b.speed *= 0.5; }
    b.x = clamp(b.x, -330, 258);
    b.z = clamp(b.z, 196, 300);
    b.bob += dt;
    b.mesh.position.set(b.x, Math.sin(b.bob * 2) * 0.1, b.z);
    b.mesh.rotation.y = b.heading;
    b.mesh.rotation.z = -steer * 0.08;
  }
}
