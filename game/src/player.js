// The player — Mara Voss on foot and behind the wheel — plus the pedestrians
// who fill Coral Bay's sidewalks. v2.3 is a from-scratch rewrite of v2.2's
// player.js: same Mara (red bandana, teal shirt), same crowd variety, same
// carjacking and wanted-level rules, different code.
// One rule governs this file: the seeded rng calls happen in exactly the
// same order as v2.2, so the same seed deals the same crowd.
import * as THREE from 'three';
import { createRng, pick, range, clamp, angleLerp } from './rng.js';
import { ROAD_COORDS, CITY_MIN, CITY_MAX } from './city.js';
import { buildCarMesh, collideCircle } from './vehicles.js';
import { buildGunMesh, makeFlashSprite } from './weapons.js';

// Crowd variety palettes — picked per person, in a fixed order.
const CROWD = {
  shirts: [0xe05a5a, 0x5a9ae0, 0x7ad95a, 0xe0c95a, 0xc95ae0, 0x5ad9c9, 0xe08a3a, 0x9a9a9a],
  skins: [0xf0c8a0, 0xc98a5a, 0x8a5a34, 0xffd9b0],
  hair: [0x1a1a1a, 0x6a3a1a, 0xd8b060, 0x8a8a8a],
  caps: [0xd83a2e, 0x37b6ff, 0xffd23e, 0x2a2a30],
};

const DEFAULT_PANTS = 0x2a2a3a;
const CAP_CHANCE = 0.35;

// Resolve a person's colours. The picks run skin, shirt, hair — in that
// order — because the rng stream is shared and order is the deal.
function personColours(rng, opts) {
  return {
    skin: opts.skin ?? pick(rng, CROWD.skins),
    shirt: opts.shirt ?? pick(rng, CROWD.shirts),
    pants: opts.pants ?? DEFAULT_PANTS,
    hair: opts.hair ?? pick(rng, CROWD.hair),
  };
}

function skinMaterial(colour) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8 });
}

function clothMaterial(colour) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 });
}

function addPart(group, geometry, material, x, y, z) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  group.add(part);
  return part;
}

export function buildPersonMesh(rng, opts = {}) {
  const colours = personColours(rng, opts);
  const skin = skinMaterial(colours.skin);
  const shirt = clothMaterial(colours.shirt);
  const pants = clothMaterial(colours.pants);
  const hair = clothMaterial(colours.hair);

  const body = new THREE.Group();
  // Head + hair cap of hair (a sphere segment, open at the bottom).
  const head = addPart(body, new THREE.SphereGeometry(0.26, 10, 8), skin, 0, 1.62, 0);
  addPart(body, new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.66, 0);
  // Torso, legs, arms.
  addPart(body, new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt, 0, 1.08, 0);
  const legL = addPart(body, new THREE.BoxGeometry(0.24, 0.72, 0.26), pants, -0.16, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  body.add(legR);
  const armL = addPart(body, new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt, -0.42, 1.1, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  body.add(armR);
  // A cap on some heads, so the crowd is not clones. The rng check runs
  // after the colour picks, exactly as v2.2 dealt it.
  if (opts.cap || (rng && rng() < CAP_CHANCE)) {
    const capMat = clothMaterial(opts.capColor ?? pick(rng, CROWD.caps));
    addPart(body, new THREE.CylinderGeometry(0.27, 0.28, 0.1, 10), capMat, 0, 1.82, 0);
    addPart(body, new THREE.BoxGeometry(0.3, 0.04, 0.22), capMat, 0, 1.78, 0.26);
  }
  // Gun anchor: the right hand holds the current weapon, pointing forward (+Z).
  const gunAnchor = new THREE.Group();
  gunAnchor.position.set(0.42, 1.05, 0.22);
  body.add(gunAnchor);
  body.userData = { legL, legR, armL, armR, head, gunAnchor };
  return body;
}

// Swap the gun in a person's right hand. Returns the muzzle Object3D.
export function setPersonGun(personMesh, type) {
  const anchor = personMesh.userData.gunAnchor;
  if (!anchor) return null;
  while (anchor.children.length > 0) anchor.remove(anchor.children[0]);
  if (!type) return null;
  const gun = buildGunMesh(type);
  gun.group.rotation.x = 0; // points +Z, the person's facing
  anchor.add(gun.group);
  return gun.muzzle;
}

export function walkCycle(mesh, phase, speed) {
  const swing = clamp(speed / 4, 0, 1);
  const s = Math.sin(phase) * swing * 0.6;
  mesh.userData.legL.rotation.x = s;
  mesh.userData.legR.rotation.x = -s;
  mesh.userData.armL.rotation.x = -s * 0.8;
  mesh.userData.armR.rotation.x = s * 0.8;
  mesh.position.y = Math.abs(Math.sin(phase)) * 0.05 * swing;
}

// Mara Voss: teal shirt, red bandana, starts at the Coral Strip.
const MARA_START = { x: -160, z: 20, heading: Math.PI / 2 };
const MARA_LOOK = { shirt: 0x2a9a8a, skin: 0xf0c8a0, hair: 0x1a1a1a, pants: 0x1a1a2a };
const BANDANA_RED = 0xd83a2e;
const WALK_SPEED = 5;
const RUN_SPEED = 8.5;
const TURN_RATE = 2.6;

export class Player {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.x = MARA_START.x;
    this.z = MARA_START.z;
    this.heading = MARA_START.heading;
    this.speed = 0;
    this.inCar = false;
    this.car = null;
    this.health = 100;
    this.cash = 1250;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.walkPhase = 0;
    this.mesh = buildPersonMesh(rng, MARA_LOOK);
    // Mara wears a red bandana — the protagonist reads at a glance in third
    // person, and the foot shot shows her, not just another ped.
    const bandanaMat = clothMaterial(BANDANA_RED);
    addPart(this.mesh, new THREE.CylinderGeometry(0.28, 0.29, 0.12, 10), bandanaMat, 0, 1.8, 0);
    addPart(this.mesh, new THREE.BoxGeometry(0.12, 0.22, 0.06), bandanaMat, 0, 1.72, -0.28);
    this.mesh.position.set(this.x, 0, this.z);
    scene.add(this.mesh);
    this.muzzle = null;
    // Mara carries her pistol in her right hand — visible in third person.
    this.gunType = 'pistol';
    this.gunFlash = makeFlashSprite(0.5);
    this.setWeapon('pistol');
  }

  setWeapon(type) {
    this.gunType = type;
    this.muzzle = setPersonGun(this.mesh, type);
    if (this.muzzle) this.muzzle.add(this.gunFlash);
    this.gunFlash.visible = false;
  }

  showGunFlash() {
    this.gunFlash.visible = true;
    this.gunFlash.material.rotation = Math.random() * Math.PI;
    setTimeout(() => { this.gunFlash.visible = false; }, 70);
  }

  get pos() {
    if (this.inCar && this.car) return { x: this.car.x, z: this.car.z };
    return { x: this.x, z: this.z };
  }

  onFootMove(dt, input, colliders) {
    const speed = input.run ? RUN_SPEED : WALK_SPEED;
    let mx = 0;
    let mz = 0;
    if (input.forward) {
      mx += Math.sin(this.heading);
      mz += Math.cos(this.heading);
    }
    if (input.back) {
      mx -= Math.sin(this.heading);
      mz -= Math.cos(this.heading);
    }
    if (input.left) this.heading += TURN_RATE * dt;
    if (input.right) this.heading -= TURN_RATE * dt;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      this.speed = speed;
      const nx = this.x + mx * speed * dt;
      const nz = this.z + mz * speed * dt;
      if (!collideCircle(nx, nz, 0.6, colliders)) {
        this.x = nx;
        this.z = nz;
      } else if (!collideCircle(nx, this.z, 0.6, colliders)) {
        this.x = nx;
      } else if (!collideCircle(this.x, nz, 0.6, colliders)) {
        this.z = nz;
      }
      this.walkPhase += dt * speed * 1.6;
    } else {
      this.speed = 0;
    }
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
const PED_BOUND = 178;
const PED_FLEE_SPEED = 6.5;
const PED_STROLL_SPEED = 1.6;

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
      // The crowd is not clones: height and cap variety.
      mesh.scale.setScalar(range(this.rng, 0.92, 1.08));
      this.scene.add(mesh);
      const road = pick(this.rng, ROAD_COORDS);
      const along = range(this.rng, -170, 170);
      const northSouth = this.rng() < 0.5;
      const side = this.rng() < 0.5 ? 5.8 : -5.8;
      const ped = {
        mesh,
        x: northSouth ? road + side : along,
        z: northSouth ? along : road + side,
        heading: this.rng() * Math.PI * 2,
        speed: range(this.rng, 1.2, 2.2),
        phase: this.rng() * 10,
        fleeing: 0,
        dead: false,
        driver: false,
      };
      if (avoid && Math.hypot(ped.x - avoid.x, ped.z - avoid.z) < 12) {
        this.scene.remove(mesh);
        continue;
      }
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
      if (Math.hypot(p.x - x, p.z - z) >= radius) continue;
      p.fleeing = 5;
      p.heading = Math.atan2(p.x - x, p.z - z);
    }
  }

  update(dt) {
    for (const p of this.peds) {
      if (p.dead) continue;
      if (p.fleeing > 0) {
        p.fleeing -= dt;
        p.speed = PED_FLEE_SPEED;
      } else {
        p.speed = PED_STROLL_SPEED;
      }
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z + Math.cos(p.heading) * p.speed * dt;
      const blocked = collideCircle(nx, nz, 0.6, this.colliders)
        || nx > PED_BOUND || nx < -PED_BOUND || nz > PED_BOUND || nz < -PED_BOUND;
      if (blocked) {
        // Stay on sidewalks: if the next step hits a building, turn around.
        p.heading += Math.PI * (0.5 + this.rng() * 0.5);
      } else {
        p.x = nx;
        p.z = nz;
        // At intersections, sometimes turn onto another sidewalk.
        if (this.rng() < dt * 0.25) {
          p.heading += pick(this.rng, [-Math.PI / 2, Math.PI / 2]);
        }
      }
      p.phase += dt * p.speed * 1.6;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      walkCycle(p.mesh, p.phase, p.speed);
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  kill(p) {
    p.dead = true;
    p.mesh.rotation.x = Math.PI / 2;
    p.mesh.position.y = 0.3;
  }
}
