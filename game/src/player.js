// The player — Mara Voss on foot and behind the wheel — plus the pedestrians
// who fill Coral Bay's sidewalks. Carjacking, entering and exiting cars,
// on-foot movement and the wanted-level consequences of stealing.
import * as THREE from 'three';
import { createRng, pick, range, clamp, angleLerp } from './rng.js';
import { ROAD_COORDS, CITY_MIN, CITY_MAX } from './city.js';
import { buildCarMesh, collideCircle } from './vehicles.js';

const SHIRT_COLORS = [0xe05a5a, 0x5a9ae0, 0x7ad95a, 0xe0c95a, 0xc95ae0, 0x5ad9c9, 0xe08a3a, 0x9a9a9a];
const SKIN_COLORS = [0xf0c8a0, 0xc98a5a, 0x8a5a34, 0xffd9b0];
const HAIR_COLORS = [0x1a1a1a, 0x6a3a1a, 0xd8b060, 0x8a8a8a];

export function buildPersonMesh(rng, opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: opts.skin ?? pick(rng, SKIN_COLORS), roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: opts.shirt ?? pick(rng, SHIRT_COLORS), roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: opts.pants ?? 0x2a2a3a, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: opts.hair ?? pick(rng, HAIR_COLORS), roughness: 0.9 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.62; g.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.y = 1.66; g.add(hairM);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.08; g.add(torso);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.16, 0.36, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.1, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  g.userData = { legL, legR, armL, armR, head };
  return g;
}

export function walkCycle(mesh, phase, speed) {
  const s = Math.sin(phase) * clamp(speed / 4, 0, 1) * 0.6;
  mesh.userData.legL.rotation.x = s;
  mesh.userData.legR.rotation.x = -s;
  mesh.userData.armL.rotation.x = -s * 0.8;
  mesh.userData.armR.rotation.x = s * 0.8;
  mesh.position.y = Math.abs(Math.sin(phase)) * 0.05 * clamp(speed / 4, 0, 1);
}

export class Player {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.x = -160; this.z = 20;
    this.heading = Math.PI / 2;
    this.speed = 0;
    this.inCar = false;
    this.car = null;
    this.health = 100;
    this.cash = 1250;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.walkPhase = 0;
    this.mesh = buildPersonMesh(rng, { shirt: 0x2a9a8a, skin: 0xf0c8a0, hair: 0x1a1a1a, pants: 0x1a1a2a });
    this.mesh.position.set(this.x, 0, this.z);
    scene.add(this.mesh);
    this.muzzle = null;
  }

  get pos() { return this.inCar && this.car ? { x: this.car.x, z: this.car.z } : { x: this.x, z: this.z }; }

  onFootMove(dt, input, colliders) {
    const speed = input.run ? 8.5 : 5;
    let mx = 0, mz = 0;
    if (input.forward) { mx += Math.sin(this.heading); mz += Math.cos(this.heading); }
    if (input.back) { mx -= Math.sin(this.heading); mz -= Math.cos(this.heading); }
    if (input.left) this.heading += 2.6 * dt;
    if (input.right) this.heading -= 2.6 * dt;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      this.speed = speed;
      const nx = this.x + mx * speed * dt;
      const nz = this.z + mz * speed * dt;
      if (!collideCircle(nx, nz, 0.6, colliders)) { this.x = nx; this.z = nz; }
      else if (!collideCircle(nx, this.z, 0.6, colliders)) this.x = nx;
      else if (!collideCircle(this.x, nz, 0.6, colliders)) this.z = nz;
      this.walkPhase += dt * speed * 1.6;
    } else this.speed = 0;
    this.x = clamp(this.x, CITY_MIN - 60, CITY_MAX + 20);
    this.z = clamp(this.z, CITY_MIN, CITY_MAX);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    walkCycle(this.mesh, this.walkPhase, this.speed);
  }

  enterCar(car) {
    this.inCar = true;
    this.car = car;
    this.mesh.visible = false;
    return car;
  }

  exitCar() {
    if (!this.car) return;
    const side = 2.6;
    this.x = this.car.x + Math.cos(this.car.heading) * side;
    this.z = this.car.z - Math.sin(this.car.heading) * side;
    this.heading = this.car.heading;
    this.inCar = false;
    this.car = null;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  addWanted(n, reason) {
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.wantedTimer = 0;
    return reason;
  }

  decayWanted(dt) {
    if (this.wanted === 0) return;
    this.wantedTimer += dt;
    const cool = 45 - this.wanted * 4; // hotter = slower to cool
    if (this.wantedTimer > cool) {
      this.wanted -= 1;
      this.wantedTimer = 0;
    }
  }
}

// --- pedestrians: sidewalk walkers who flee gunfire and police ---
export class Pedestrians {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.peds = [];
  }

  spawn(n, avoid) {
    for (let i = 0; i < n; i++) {
      const mesh = buildPersonMesh(this.rng);
      this.scene.add(mesh);
      const road = pick(this.rng, ROAD_COORDS);
      const along = range(this.rng, -170, 170);
      const ns = this.rng() < 0.5;
      const side = this.rng() < 0.5 ? 5.8 : -5.8;
      const ped = {
        mesh,
        x: ns ? road + side : along,
        z: ns ? along : road + side,
        heading: this.rng() * Math.PI * 2,
        speed: range(this.rng, 1.2, 2.2),
        phase: this.rng() * 10,
        fleeing: 0,
        dead: false,
        driver: false,
      };
      if (avoid && Math.hypot(ped.x - avoid.x, ped.z - avoid.z) < 12) { this.scene.remove(mesh); continue; }
      mesh.position.set(ped.x, 0, ped.z);
      this.peds.push(ped);
    }
  }

  spawnDriver(x, z, heading) {
    const mesh = buildPersonMesh(this.rng);
    this.scene.add(mesh);
    const ped = { mesh, x, z, heading, speed: 2.5, phase: 0, fleeing: 6, dead: false, driver: true };
    mesh.position.set(x, 0, z);
    this.peds.push(ped);
    return ped;
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.dead) continue;
      if (Math.hypot(p.x - x, p.z - z) < radius) {
        p.fleeing = 5;
        p.heading = Math.atan2(p.x - x, p.z - z);
      }
    }
  }

  update(dt) {
    for (const p of this.peds) {
      if (p.dead) continue;
      if (p.fleeing > 0) {
        p.fleeing -= dt;
        p.speed = 6.5;
      } else p.speed = 1.6;
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z + Math.cos(p.heading) * p.speed * dt;
      // stay on sidewalks: if next step hits a building, turn around
      if (collideCircle(nx, nz, 0.6, this.colliders) || nx > 178 || nx < -178 || nz > 178 || nz < -178) {
        p.heading += Math.PI * (0.5 + this.rng() * 0.5);
      } else {
        p.x = nx; p.z = nz;
        // at intersections, sometimes turn onto another sidewalk
        if (this.rng() < dt * 0.25) p.heading += pick(this.rng, [-Math.PI / 2, Math.PI / 2]);
      }
      p.phase += dt * p.speed * 1.6;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      walkCycle(p.mesh, p.phase, p.speed);
    }
  }

  nearest(x, z, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  kill(p) {
    p.dead = true;
    p.mesh.rotation.x = Math.PI / 2;
    p.mesh.position.y = 0.3;
  }
}
