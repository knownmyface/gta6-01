// Coral Heat — motorcycles: 3 bike models, lean + wheelie handling, bike HUD.
// Fresh write, round 7.
import * as THREE from 'three';
import { clamp, rand } from './util.js';
import { collideCircle } from './coralcity.js';

export const BIKE_MODELS = [
  { name: 'Sunset Cruiser', top: 46, accel: 22, lean: 0.5, color: 0x8a5a2e, price: 6000 },
  { name: 'Coral Sport R', top: 68, accel: 34, lean: 0.85, color: 0xff2fd6, price: 22000 },
  { name: 'Dune Dirt 450', top: 52, accel: 28, lean: 0.7, color: 0x86efac, price: 9500 },
];

export function makeBikeMesh(THREE, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.15 });
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.5), bodyMat);
  tank.position.set(0, 0.85, 0.2); g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 1.1), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  seat.position.set(0, 0.82, -0.75); g.add(seat);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), new THREE.MeshLambertMaterial({ color: 0x888888 }));
  bars.rotation.z = Math.PI / 2; bars.position.set(0, 1.15, 0.95); g.add(bars);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const wz of [1.05, -1.05]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 8, 14), wheelMat);
    w.position.set(0, 0.38, wz);
    g.add(w); wheels.push(w);
  }
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(0, 0.95, 1.05); g.add(hl);
  g.userData.wheels = wheels;
  return g;
}

export class Bikes {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    const spots = [[-26, 78], [26, -26], [130, 26], [-78, -130], [78, 130], [-130, 130]];
    for (let i = 0; i < spots.length; i++) {
      const model = BIKE_MODELS[i % BIKE_MODELS.length];
      const mesh = makeBikeMesh(THREE, model.color);
      scene.add(mesh);
      const b = { mesh, model, x: spots[i][0], z: spots[i][1], heading: rand(0, Math.PI * 2), speed: 0, taken: false, wheelie: 0 };
      mesh.position.set(b.x, 0, b.z);
      mesh.rotation.y = b.heading;
      this.list.push(b);
    }
    this.active = null;
  }
  nearest(x, z, maxD = 5) {
    let best = null, bd = maxD * maxD;
    for (const b of this.list) {
      if (b.taken) continue;
      const d = (b.x - x) ** 2 + (b.z - z) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  board(bike) { bike.taken = true; this.active = bike; return bike; }
  leave() {
    if (!this.active) return null;
    const b = this.active;
    b.taken = false; b.speed = 0; b.wheelie = 0;
    this.active = null;
    return b;
  }
  update(dt, input, city) {
    const b = this.active;
    if (!b) return;
    if (input.forward) b.speed += b.model.accel * dt;
    if (input.back) b.speed -= b.model.accel * 0.6 * dt;
    if (!input.forward && !input.back) b.speed *= Math.max(0, 1 - 1.4 * dt);
    b.speed = clamp(b.speed, -10, b.model.top);
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    b.heading += steer * clamp(Math.abs(b.speed) / 12, 0, 1) * 2.3 * dt;
    const nx = b.x + Math.sin(b.heading) * b.speed * dt;
    const nz = b.z + Math.cos(b.heading) * b.speed * dt;
    const hit = collideCircle(city, nx, nz, 1.2);
    if (hit.x !== nx || hit.z !== nz) b.speed *= 0.4;
    b.x = hit.x; b.z = hit.z;
    // wheelie while holding sprint + accelerating
    const wantWheelie = input.sprint && input.forward && b.speed > 14;
    b.wheelie = clamp(b.wheelie + (wantWheelie ? dt * 3 : -dt * 4), 0, 1);
    b.mesh.position.set(b.x, 0, b.z);
    b.mesh.rotation.y = b.heading;
    b.mesh.rotation.z = -steer * b.model.lean * clamp(Math.abs(b.speed) / 24, 0, 1);
    b.mesh.rotation.x = -b.wheelie * 0.38;
    const spin = b.speed * dt * 3;
    for (const w of b.mesh.userData.wheels) w.rotation.y += spin;
  }
}
