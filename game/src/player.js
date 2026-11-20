// Coral Heat — Kai Solano on foot: third-person walking, sprinting, swimming
// is out (the bay is for boats), and the hands that do the carjacking.

import * as THREE from 'three';
import { clamp, lerp } from './rng.js';

function buildWalkerMesh() {
  const g = new THREE.Group();
  g.name = 'kai-solano';
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff6b4a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3550 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1410 });
  // legs
  for (const s of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.85, 6), pants);
    leg.position.set(s, 0.42, 0);
    g.add(leg);
  }
  // torso — coral tee, open jacket look via a darker vest box
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirt);
  torso.position.y = 1.24;
  g.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.6, 0.36), new THREE.MeshLambertMaterial({ color: 0x1e2a3a }));
  vest.position.y = 1.28;
  vest.scale.set(1, 1, 0.4);
  g.add(vest);
  // arms, swinging when walking
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.72, 6), skin);
  armL.position.set(-0.4, 1.2, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(armR);
  // head + hair + cap
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.86;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, 1.1), new THREE.MeshLambertMaterial({ color: 0x2fd4c4 }));
  cap.position.y = 1.9;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.3), new THREE.MeshLambertMaterial({ color: 0x2fd4c4 }));
  brim.position.set(0, 1.94, 0.24);
  g.add(brim);
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

// A background pedestrian: same skeleton, random shirt, walks a sidewalk loop.
export function buildPedestrianMesh(shirtColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: [0xc98d64, 0x8a5a3a, 0xe8b88a, 0x6a4230][Math.floor(Math.random() * 4)] });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x333a4a });
  for (const s of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.8, 6), pants);
    leg.position.set(s, 0.4, 0);
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.32), shirt);
  torso.position.y = 1.16;
  g.add(torso);
  for (const s of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.66, 6), skin);
    arm.position.set(s, 1.12, 0);
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.76;
  g.add(head);
  return g;
}

export class Walker {
  constructor(scene, x, z) {
    this.mesh = buildWalkerMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = 0;
    this.walkSpeed = 0;
    this.health = 100;
    this.walkPhase = 0;
    this.aiming = false;
  }
  // input is camera-relative: up = away from camera
  step(input, camHeading, dt, world) {
    const sprint = input.sprint ? 1.7 : 1;
    const top = 6.2 * sprint;
    let mx = 0, mz = 0;
    if (input.up) { mx += Math.sin(camHeading); mz += Math.cos(camHeading); }
    if (input.down) { mx -= Math.sin(camHeading); mz -= Math.cos(camHeading); }
    if (input.left) { mx -= Math.cos(camHeading); mz += Math.sin(camHeading); }
    if (input.right) { mx += Math.cos(camHeading); mz -= Math.sin(camHeading); }
    const len = Math.hypot(mx, mz);
    const target = len > 0 ? top : 0;
    this.walkSpeed = lerp(this.walkSpeed, target, 1 - Math.exp(-10 * dt));
    if (len > 0) {
      mx /= len; mz /= len;
      const nx = this.x + mx * this.walkSpeed * dt;
      const nz = this.z + mz * this.walkSpeed * dt;
      if (!world.blocked(nx, nz, 0.6) && nx > -154) {
        this.x = nx; this.z = nz;
      }
      const wantHeading = Math.atan2(mx, mz);
      let gap = wantHeading - this.heading;
      while (gap > Math.PI) gap -= Math.PI * 2;
      while (gap < -Math.PI) gap += Math.PI * 2;
      this.heading += clamp(gap, -7 * dt, 7 * dt);
    }
    this.walkPhase += this.walkSpeed * dt * 1.6;
    const swing = Math.sin(this.walkPhase) * 0.5 * clamp(this.walkSpeed / 6, 0, 1);
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.05, this.z);
    this.mesh.rotation.y = this.heading;
  }
  hurt(n) {
    this.health = clamp(this.health - n, 0, 100);
    return this.health <= 0;
  }
  heal(n) { this.health = clamp(this.health + n, 0, 100); }
}

// Street life: pedestrians strolling the sidewalks, scattering at gunfire.
export class Crowd {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.peds = [];
    const shirts = [0xffd23f, 0x2fd4c4, 0xff8ab0, 0x9fe8ff, 0xf2ead8, 0x8a7fb8];
    for (let i = 0; i < 16; i++) {
      const mesh = buildPedestrianMesh(shirts[i % shirts.length]);
      const road = world.roads[Math.floor(Math.random() * world.roads.length)];
      const x = Math.max(-140, road) + (Math.random() < 0.5 ? 7 : -7);
      const z = (Math.random() - 0.5) * 460;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.peds.push({
        mesh, x, z,
        heading: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 1.1,
        panic: 0,
        road, vertical: Math.random() < 0.5,
      });
    }
  }
  nearest(x, z, maxD) {
    let best = null, bestD = maxD;
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  scare(x, z, radius) {
    for (const p of this.peds) {
      if (Math.hypot(p.x - x, p.z - z) < radius) p.panic = 3;
    }
  }
  update(dt) {
    for (const p of this.peds) {
      if (p.panic > 0) {
        p.panic -= dt;
        p.speed = 5.5;
      } else {
        p.speed = 1.2 + Math.sin(p.x * 0.1 + p.z * 0.07) * 0.4 + 0.8;
      }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      if (Math.abs(p.x) > 250 || Math.abs(p.z) > 250 || this.world.blocked(p.x, p.z, 0.5)) {
        p.heading += Math.PI / 2 + (Math.random() - 0.5);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
}
