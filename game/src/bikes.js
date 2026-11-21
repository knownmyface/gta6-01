// bikes.js — three rideable motorcycle models. Bikes lean into turns,
// accelerate hard, and are the fastest way through boulevard traffic.
import * as THREE from "../vendor/three/three.module.min.js";
import { clamp, lerp, lerpAngle, rand } from "./util.js";

export const BIKE_MODELS = [
  { id: "coast-125", name: "Coast 125", color: 0x37b6ff, top: 48, accel: 24, price: 0 },
  { id: "neon-600", name: "Neon 600", color: 0xff5ad1, top: 58, accel: 30, price: 9000 },
  { id: "ember-1000", name: "Ember 1000", color: 0xff5a2a, top: 70, accel: 34, price: 18000 },
];

export function makeBikeMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.85 });
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 1.1), bodyMat);
  tank.position.set(0, 0.82, 0.1);
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.85), darkMat);
  seat.position.set(0, 0.8, -0.62);
  g.add(seat);
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.6), bodyMat);
  fender.position.set(0, 0.72, 0.95);
  g.add(fender);
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), darkMat);
  fork.position.set(0, 0.62, 0.95);
  fork.rotation.x = 0.5;
  g.add(fork);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), darkMat);
  bars.position.set(0, 1.05, 0.72);
  g.add(bars);
  const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  headlight.position.set(0, 0.85, 1.15);
  g.add(headlight);
  const wheels = [];
  for (const wz of [1.05, -0.85]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 8, 18), darkMat);
    wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 }));
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(0, 0.34, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  g.userData.wheels = wheels;
  return g;
}

export function spawnBike(G, modelId, x, z, heading) {
  const model = BIKE_MODELS.find((m) => m.id === modelId) || BIKE_MODELS[0];
  const mesh = makeBikeMesh(model.color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const bike = {
    kind: "bike", model, mesh,
    x, z, heading, speed: 0, steer: 0,
  };
  G.playerBike = bike;
  return bike;
}

export function updateBike(G, dt, input) {
  const bike = G.playerBike;
  if (!bike || G.player.mode !== "bike") return;
  const m = bike.model;
  const fwd = input.forward ? 1 : input.back ? -0.5 : 0;
  const targetSpeed = fwd * m.top;
  const accelRate = fwd !== 0 ? m.accel : 16;
  if (bike.speed < targetSpeed) bike.speed = Math.min(targetSpeed, bike.speed + accelRate * dt);
  else if (bike.speed > targetSpeed) bike.speed = Math.max(targetSpeed, bike.speed - accelRate * 1.5 * dt);
  if (input.brake) bike.speed = lerp(bike.speed, 0, clamp(dt * 6, 0, 1));
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  bike.steer = lerp(bike.steer, steerTarget, clamp(dt * 7, 0, 1));
  const spd01 = clamp(Math.abs(bike.speed) / m.top, 0, 1);
  bike.heading += bike.steer * 3.1 * (0.3 + spd01) * dt * Math.sign(bike.speed || 1) * clamp(Math.abs(bike.speed) / 8, 0, 1);
  bike.x += Math.sin(bike.heading) * bike.speed * dt;
  bike.z += Math.cos(bike.heading) * bike.speed * dt;
  bike.x = clamp(bike.x, -330, 330);
  bike.z = clamp(bike.z, -198, 330);
  bike.mesh.position.set(bike.x, 0, bike.z);
  bike.mesh.rotation.y = bike.heading;
  bike.mesh.rotation.z = -bike.steer * spd01 * 0.5;
  const wheels = bike.mesh.userData.wheels || [];
  for (const w of wheels) w.rotation.y += bike.speed * dt * 2.6;
  G.player.pos.set(bike.x, 0, bike.z);
  G.player.heading = bike.heading;
  G.player.speed = bike.speed;
  G.displaySpeed = Math.abs(bike.speed) * 2.6;
  if (G.sound) G.sound.setEngine(spd01, fwd !== 0 ? 1 : 0);
}
