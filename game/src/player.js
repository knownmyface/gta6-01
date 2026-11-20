// CORAL HEAT v2.8 — Kai Solano on foot: third-person walking, sprinting, and
// the hands that do the carjacking. Swimming is out (the bay is for boats).
// Figures are built from a small parts table so the hero, the pedestrians
// and the victims all share one skeleton.

import * as THREE from 'three';
import { clampVal, mix } from './rng.js';

const SKINS = [0xc98d64, 0x8a5a3a, 0xe8b88a, 0x6a4230];

// One body part: shape, size, offset, material kind.
function part(kind, size, at, mat) {
  let mesh;
  if (kind === 'box') mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  else if (kind === 'ball') mesh = new THREE.Mesh(new THREE.SphereGeometry(size[0], 10, 8), mat);
  else mesh = new THREE.Mesh(new THREE.CylinderGeometry(size[0], size[1], size[2], 6), mat);
  mesh.position.set(at[0], at[1], at[2]);
  return mesh;
}

function lam(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function makeFigure(shirtColor, skinColor, opts = {}) {
  const g = new THREE.Group();
  const skin = lam(skinColor);
  const shirt = lam(shirtColor);
  const pants = lam(0x333a4a);
  const legH = opts.legH || 0.85;
  for (const s of [-0.14, 0.14]) {
    g.add(part('tube', [0.09, 0.11, legH], [s, legH / 2, 0], pants));
  }
  g.add(part('box', [0.62, 0.78, 0.34], [0, 1.24, 0], shirt));
  const armL = part('tube', [0.08, 0.09, 0.72], [-0.4, 1.2, 0], skin);
  const armR = part('tube', [0.08, 0.09, 0.72], [0.4, 1.2, 0], skin);
  g.add(armL);
  g.add(armR);
  g.add(part('ball', [0.24], [0, 1.86, 0], skin));
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

function makeHeroMesh() {
  const g = makeFigure(0xff6b4a, 0xc98d64);
  g.name = 'kai-solano';
  // open jacket look: a darker vest box over the tee
  const vest = part('box', [0.66, 0.6, 0.36], [0, 1.28, 0], lam(0x1e2a3a));
  vest.scale.set(1, 1, 0.4);
  g.add(vest);
  // teal cap + brim
  const capMat = lam(0x2fd4c4);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, 1.1), capMat);
  cap.position.y = 1.9;
  g.add(cap);
  g.add(part('box', [0.34, 0.05, 0.3], [0, 1.94, 0.24], capMat));
  return g;
}

// A background pedestrian: same skeleton, random shirt, walks a sidewalk loop.
export function makePedMesh(shirtColor) {
  const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
  return makeFigure(shirtColor, skin, { legH: 0.8 });
}

export class Hero {
  constructor(scene, x, z) {
    this.mesh = makeHeroMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.walkSpeed = 0;
    this.health = 100;
    this.walkPhase = 0;
    this.aiming = false;
  }
  // input is camera-relative: up = away from camera
  walk(input, camHeading, dt, world) {
    const top = 6.2 * (input.sprint ? 1.7 : 1);
    const fx = Math.sin(camHeading);
    const fz = Math.cos(camHeading);
    const rx = Math.cos(camHeading);
    const rz = -Math.sin(camHeading);
    let mx = 0;
    let mz = 0;
    if (input.up) { mx += fx; mz += fz; }
    if (input.down) { mx -= fx; mz -= fz; }
    if (input.left) { mx -= rx; mz -= rz; }
    if (input.right) { mx += rx; mz += rz; }
    const len = Math.hypot(mx, mz);
    const target = len > 0 ? top : 0;
    this.walkSpeed = mix(this.walkSpeed, target, 1 - Math.exp(-10 * dt));
    if (len > 0) {
      mx /= len;
      mz /= len;
      const nx = this.x + mx * this.walkSpeed * dt;
      const nz = this.z + mz * this.walkSpeed * dt;
      if (!world.solid(nx, nz, 0.6) && nx > -154) {
        this.x = nx;
        this.z = nz;
      }
      const wantHeading = Math.atan2(mx, mz);
      let gap = wantHeading - this.heading;
      while (gap > Math.PI) gap -= Math.PI * 2;
      while (gap < -Math.PI) gap += Math.PI * 2;
      this.heading += clampVal(gap, -7 * dt, 7 * dt);
    }
    this.walkPhase += this.walkSpeed * dt * 1.6;
    const swing = Math.sin(this.walkPhase) * 0.5 * clampVal(this.walkSpeed / 6, 0, 1);
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.05, this.z);
    this.mesh.rotation.y = this.heading;
  }
  takeHit(n) {
    this.health = clampVal(this.health - n, 0, 100);
    return this.health <= 0;
  }
  patchUp(n) { this.health = clampVal(this.health + n, 0, 100); }
}

// Street life: pedestrians strolling the sidewalks, scattering at gunfire.
export class StreetCrowd {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.peds = [];
    const shirts = [0xffd23f, 0x2fd4c4, 0xff8ab0, 0x9fe8ff, 0xf2ead8, 0x8a7fb8];
    for (let i = 0; i < 16; i++) {
      const mesh = makePedMesh(shirts[i % shirts.length]);
      const road = world.roads[Math.floor(Math.random() * world.roads.length)];
      const x = Math.max(-140, road) + (Math.random() < 0.5 ? 7 : -7);
      const z = (Math.random() - 0.5) * 460;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.peds.push({
        mesh,
        x,
        z,
        heading: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 1.1,
        panic: 0,
        road,
        vertical: Math.random() < 0.5,
      });
    }
  }
  nearest(x, z, maxD) {
    let best = null;
    let bestD = maxD;
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
      if (Math.abs(p.x) > 250 || Math.abs(p.z) > 250 || this.world.solid(p.x, p.z, 0.5)) {
        p.heading += Math.PI / 2 + (Math.random() - 0.5);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
}
