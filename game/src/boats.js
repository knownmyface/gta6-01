// boats.js — speedboats, the marina, and police boats. Boats run on the
// water strip north of the beach; mission 21 escapes by boat, mission 22
// is a waterfront pursuit with police boats in the wake.
import * as THREE from "../vendor/three/three.module.min.js";
import { clamp, lerp, lerpAngle, rand, pick } from "./util.js";

export const BOAT_MODELS = [
  { id: "harbor-skiff", name: "Harbor Skiff", color: 0xf2f2f2, top: 34, accel: 16, price: 6000 },
  { id: "coral-speedster", name: "Coral Speedster", color: 0xff5a2a, top: 52, accel: 24, price: 16000 },
  { id: "neon-yacht", name: "Neon Yacht", color: 0x37b6ff, top: 40, accel: 18, price: 28000 },
];

export function makeBoatMesh(color, police) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 8.5), hullMat);
  hull.position.y = 0.8;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.4, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.8, 5.4);
  bow.scale.set(1, 1, 0.6);
  g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3.0),
    new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.6, roughness: 0.3 }));
  cabin.position.set(0, 1.85, -0.8);
  g.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, metalness: 0.9, roughness: 0.1 }));
  windshield.position.set(0, 1.9, 0.9);
  windshield.rotation.x = -0.4;
  g.add(windshield);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x181818 }));
  engine.position.set(0, 1.0, -4.3);
  g.add(engine);
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 2.55, -0.8);
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.25, 3.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.set(0, 1.0, 0.5);
    g.add(stripe);
  }
  // Wake: a fading trail mesh the boat drags behind it.
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.15, -8);
  g.add(wake);
  g.userData.wake = wake;
  return g;
}

export function spawnBoat(G, modelId, x, z, heading) {
  const model = BOAT_MODELS.find((m) => m.id === modelId) || BOAT_MODELS[0];
  const mesh = makeBoatMesh(model.color, false);
  mesh.position.set(x, 0.5, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const boat = {
    kind: "boat", model, mesh,
    x, z, heading, speed: 0, steer: 0,
  };
  G.playerBoat = boat;
  return boat;
}

export function updateBoat(G, dt, input) {
  const boat = G.playerBoat;
  if (!boat || G.player.mode !== "boat") return;
  const m = boat.model;
  const fwd = input.forward ? 1 : input.back ? -0.4 : 0;
  const targetSpeed = fwd * m.top;
  const accelRate = fwd !== 0 ? m.accel : 10;
  if (boat.speed < targetSpeed) boat.speed = Math.min(targetSpeed, boat.speed + accelRate * dt);
  else if (boat.speed > targetSpeed) boat.speed = Math.max(targetSpeed, boat.speed - accelRate * 1.2 * dt);
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  boat.steer = lerp(boat.steer, steerTarget, clamp(dt * 4, 0, 1));
  const spd01 = clamp(Math.abs(boat.speed) / m.top, 0, 1);
  boat.heading += boat.steer * 1.5 * (0.3 + spd01) * dt * Math.sign(boat.speed || 1) * clamp(Math.abs(boat.speed) / 6, 0, 1);
  boat.x += Math.sin(boat.heading) * boat.speed * dt;
  boat.z += Math.cos(boat.heading) * boat.speed * dt;
  // Boats stay on the water: z between -360 and -200, x inside the bay.
  boat.x = clamp(boat.x, -330, 330);
  boat.z = clamp(boat.z, -355, -202);
  const t = performance.now() / 1000;
  boat.mesh.position.set(boat.x, 0.5 + Math.sin(t * 1.6) * 0.14, boat.z);
  boat.mesh.rotation.y = boat.heading;
  boat.mesh.rotation.z = -boat.steer * spd01 * 0.16 + Math.sin(t * 1.3) * 0.02;
  boat.mesh.rotation.x = Math.sin(t * 1.1) * 0.02 - spd01 * 0.05;
  const wake = boat.mesh.userData.wake;
  if (wake) wake.material.opacity = 0.08 + spd01 * 0.3;
  G.player.pos.set(boat.x, 0, boat.z);
  G.player.heading = boat.heading;
  G.player.speed = boat.speed;
  G.displaySpeed = Math.abs(boat.speed) * 2.6;
  if (G.sound) G.sound.setEngine(spd01 * 0.8, fwd !== 0 ? 1 : 0);
}

export function spawnPoliceBoat(G, x, z) {
  const mesh = makeBoatMesh(0x1a2a44, true);
  mesh.position.set(x, 0.5, z);
  G.scene.add(mesh);
  const b = { mesh, x, z, heading: 0, speed: 0, top: 46 };
  G.policeBoats = G.policeBoats || [];
  G.policeBoats.push(b);
  return b;
}

export function updatePoliceBoats(G, dt) {
  const px = G.player.pos.x;
  const pz = G.player.pos.z;
  for (const b of G.policeBoats || []) {
    const dx = px - b.x;
    const dz = pz - b.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const want = Math.atan2(dx, dz);
    b.heading = lerpAngle(b.heading, want, clamp(dt * 1.8, 0, 1));
    const cruise = d > 50 ? b.top : d > 15 ? b.top * 0.7 : b.top * 0.3;
    b.speed = lerp(b.speed, cruise, clamp(dt * 1.2, 0, 1));
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    b.x = clamp(b.x, -330, 330);
    b.z = clamp(b.z, -355, -202);
    const t = performance.now() / 1000;
    b.mesh.position.set(b.x, 0.5 + Math.sin(t * 1.6 + b.x) * 0.12, b.z);
    b.mesh.rotation.y = b.heading;
    if (d < 6 && G.player.mode === "boat" && G.playerBoat) {
      G.playerBoat.speed *= 1 - dt * 0.4;
    }
  }
}

export function clearPoliceBoats(G) {
  for (const b of G.policeBoats || []) G.scene.remove(b.mesh);
  G.policeBoats = [];
}
