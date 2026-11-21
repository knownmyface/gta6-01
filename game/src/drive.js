// Coral Heat — driving: player car physics, traffic AI, car meshes.
// Fresh write, round 7.
import * as THREE from 'three';
import { clamp, rand, pick, angleLerp } from './util.js';
import { collideCircle } from './coralcity.js';

export const CAR_MODELS = [
  { name: 'Coral GT', top: 62, accel: 26, color: 0xff5a3c, price: 0 },
  { name: 'Bay Runner', top: 48, accel: 20, color: 0x2fa8ff, price: 8000 },
  { name: 'Sunset Taxi', top: 44, accel: 18, color: 0xffd166, price: 3500 },
  { name: 'Reef Cruiser', top: 55, accel: 22, color: 0x9b5de5, price: 15000 },
  { name: 'Marina Pickup', top: 50, accel: 21, color: 0x4ecdc4, price: 12000 },
];

export function makeCarMesh(THREE, color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.12 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 4.4), bodyMat);
  body.position.y = 0.62; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 2.1), new THREE.MeshLambertMaterial({ color: 0x182233 }));
  cabin.position.set(0, 1.2, -0.25); g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 10), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  // headlights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), hl);
    lamp.position.set(sx, 0.7, 2.22); g.add(lamp);
  }
  // tail lights
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const sx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tl);
    lamp.position.set(sx, 0.72, -2.22); g.add(lamp);
  }
  if (opts.police) {
    const bar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    r.position.x = -0.3; bar.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x0044ff }));
    b.position.x = 0.3; bar.add(b);
    bar.position.set(0, 1.62, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
    stripe.position.y = 0.62; g.add(stripe);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    door.position.set(0, 0.66, 2.21); g.add(door);
  }
  g.userData.wheels = wheels;
  return g;
}

export class PlayerCar {
  constructor(scene, model) {
    this.model = model;
    this.mesh = makeCarMesh(THREE, model.color);
    scene.add(this.mesh);
    this.x = 0; this.z = 40; this.heading = Math.PI;
    this.speed = 0;           // m/s forward
    this.steer = 0;
    this.damage = 0;          // 0..100
    this.nitro = 100;
    this.upgrades = { engine: 0, tires: 0, armor: 0, nitro: 0 };
    this.spiked = 0;          // seconds of spike-strip slowdown
    this.exploded = false;
  }
  get topSpeed() {
    return this.model.top * (1 + this.upgrades.engine * 0.12) + (this.nitroActive ? 14 : 0);
  }
  get mph() { return Math.abs(this.speed) * 2.237; }
  reset(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.damage = 0; this.spiked = 0; this.nitro = 100;
  }
  update(dt, input, city, nitroOn) {
    const up = this.upgrades;
    this.nitroActive = nitroOn && this.nitro > 0 && input.forward;
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - 22 * dt);
    else this.nitro = Math.min(100, this.nitro + 4 * dt);
    const top = this.model.top * (1 + up.engine * 0.12) + (this.nitroActive ? 16 : 0);
    const grip = 1 + up.tires * 0.15;
    const accel = this.model.accel * (1 + up.engine * 0.1);
    if (input.forward) this.speed += accel * dt;
    if (input.back) this.speed -= accel * 0.7 * dt;
    if (!input.forward && !input.back) this.speed *= Math.max(0, 1 - 1.6 * dt);
    if (input.brake) this.speed *= Math.max(0, 1 - 4 * dt);
    if (this.spiked > 0) { this.spiked -= dt; this.speed *= Math.max(0, 1 - 2.2 * dt); }
    this.speed = clamp(this.speed, -top * 0.45, top);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer = angleLerp(this.steer, steerTarget * 0.55 * grip, Math.min(1, dt * 8));
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += this.steer * dir * clamp(Math.abs(this.speed) / 14, 0, 1) * 1.9 * dt;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const hit = collideCircle(city, nx, nz, 2.1);
    if (hit.x !== nx || hit.z !== nz) {
      if (Math.abs(this.speed) > 12) this.damage = Math.min(100, this.damage + Math.abs(this.speed) * 0.5);
      this.speed *= 0.4;
    }
    this.x = hit.x; this.z = hit.z;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // wheel spin + body lean
    const spin = this.speed * dt * 2.4;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    this.mesh.rotation.z = -this.steer * 0.06 * clamp(Math.abs(this.speed) / 20, 0, 1);
    this.mesh.rotation.x = clamp(-this.speed * 0.0012, -0.03, 0.03);
    if (this.damage >= 100 && !this.exploded) { this.exploded = true; }
  }
}

// --- traffic: cars looping the road grid ---
export class Traffic {
  constructor(scene, count = 26) {
    this.cars = [];
    this.scene = scene;
    const colors = [0xe8e8e8, 0x9aa5b1, 0xff8c5a, 0x4ecdc4, 0xffd166, 0xc084fc, 0x86efac];
    for (let i = 0; i < count; i++) {
      const mesh = makeCarMesh(THREE, pick(colors));
      scene.add(mesh);
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const lane = (Math.floor(rand(-4, 4)) * 52) + (Math.random() < 0.5 ? -3.5 : 3.5);
      const along = rand(-240, 240);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.cars.push({
        mesh, axis, lane, along, dir,
        speed: rand(9, 16), baseSpeed: 0, color: colors[i % colors.length],
        stopped: 0,
      });
      this.cars[i].baseSpeed = this.cars[i].speed;
    }
  }
  update(dt, playerPos) {
    for (const c of this.cars) {
      // slow down if the player car is right ahead
      let slow = 1;
      if (playerPos) {
        const px = c.axis === 'x' ? c.along : c.lane;
        const pz = c.axis === 'x' ? c.lane : c.along;
        const d = Math.hypot(px - playerPos.x, pz - playerPos.z);
        if (d < 14) slow = 0.25;
      }
      c.along += c.dir * c.speed * slow * dt;
      if (c.along > 252) c.along = -252;
      if (c.along < -252) c.along = 252;
      const x = c.axis === 'x' ? c.along : c.lane;
      const z = c.axis === 'x' ? c.lane : c.along;
      c.mesh.position.set(x, 0, z);
      c.mesh.rotation.y = c.axis === 'x' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
      const spin = c.speed * dt * 2.4;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
    }
  }
  nearest(x, z, maxD = 7) {
    let best = null, bd = maxD * maxD;
    for (const c of this.cars) {
      const cx = c.axis === 'x' ? c.along : c.lane;
      const cz = c.axis === 'x' ? c.lane : c.along;
      const d = (cx - x) ** 2 + (cz - z) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  remove(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
  }
}
