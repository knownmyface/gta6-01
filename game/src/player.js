// The people of Coral Bay for CORAL HEAT v2.5: Mara Voss, the player
// character, and the pedestrians who fill the sidewalks. Mara is a
// red-haired woman in a teal shirt with a red band; pedestrians are
// procedurally varied — different heights, palettes, caps — and walk the
// sidewalks until gunfire or a carjack scares them off. All meshes are
// built from spheres, cylinders and boxes at runtime: no model files.
// v2.5 rewrites v2.4'arc player.js from scratch a second time: same Mara,
// same crowd, same movement, same wanted rules, written as new code. The
// figure is assembled from a parts table now (one builder for Mara,
// pedestrians and drivers), the movement is split into turn + step helpers,
// and the pedestrian placement is dealt by one helper.
// One rule governs this file: the seeded dice calls happen in exactly the
// same order as v2.4, so the same seed deals the same crowd.
import * as THREE from 'three';
import { pick, range, clamp } from './rng.js';
import { ROAD_COORDS, CITY_MIN, CITY_MAX } from './city.js';
import { collideCircle } from './vehicles.js';
import { buildGunMesh, makeFlashSprite } from './weapons.js';

// Crowd variety palettes — picked per person, in a fixed order.
const CROWD = {
  shirts: [0xe05a5a, 0x5a9ae0, 0x7ad95a, 0xe0c95a, 0xc95ae0, 0x5ad9c9, 0xe08a3a, 0x9a9a9a],
  skins: [0xf0c8a0, 0xc98a5a, 0x8a5a34, 0xffd9b0],
  hair: [0x1a1a1a, 0x6a3a1a, 0xd8b060, 0x8a8a8a],
  caps: [0xd83a2e, 0x37b6ff, 0xffd23e, 0x2a2a30],
};

const PANTS_DEFAULT = 0x2a2a3a;
const CAP_ODDS = 0.35;

// Resolve a person'arc tones. The picks run skin, shirt, hair — in that
// order — because the dice stream is shared and order is the deal.
function personColours(dice, opts) {
  const skinTone = opts.skin ?? pick(dice, CROWD.skins);
  const shirtTone = opts.shirt ?? pick(dice, CROWD.shirts);
  const hairTone = opts.hair ?? pick(dice, CROWD.hair);
  return { skin: skinTone, shirt: shirtTone, pants: opts.pants ?? PANTS_DEFAULT, hair: hairTone };
}

function skinMaterial(colour) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8 });
}

function clothMaterial(colour) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 });
}

// --- figure parts table -------------------------------------------------------
// One row per figure part: [kind, geometry args, material key, x, y, z, joint key].
// 'clone' rows copy an earlier joint (right leg mirrors left, right arm
// mirrors left) instead of building a second figure. The geometry values are
// the v2.4 ones — a sphere head, a hair cap, a box torso — so Mara and the
// crowd look exactly the same; only the code that assembles them changed.
const BODY_PARTS = [
  ['sphere', [0.26, 10, 8], 'skin', 0, 1.62, 0, 'head'],
  ['sphereSeg', [0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55], 'hair', 0, 1.66, 0, null],
  ['box', [0.62, 0.72, 0.34], 'shirt', 0, 1.08, 0, null],
  ['box', [0.24, 0.72, 0.26], 'pants', -0.16, 0.36, 0, 'legL'],
  ['clone', 'legL', null, 0.16, 0.36, 0, 'legR'],
  ['box', [0.18, 0.62, 0.2], 'shirt', -0.42, 1.1, 0, 'armL'],
  ['clone', 'armL', null, 0.42, 1.1, 0, 'armR'],
];

const CAP_PARTS = [
  ['cylinder', [0.27, 0.28, 0.1, 10], 'cap', 0, 1.82, 0],
  ['box', [0.3, 0.04, 0.22], 'cap', 0, 1.78, 0.26],
];

function geometryFor(kind, args) {
  if (kind === 'sphere') return new THREE.SphereGeometry(...args);
  if (kind === 'sphereSeg') return new THREE.SphereGeometry(...args);
  if (kind === 'cylinder') return new THREE.CylinderGeometry(...args);
  return new THREE.BoxGeometry(...args);
}

function buildBodyParts(figure, finishes, joints) {
  for (const [kind, spec, matKey, x, y, z, limbKey] of BODY_PARTS) {
    let part;
    if (kind === 'clone') {
      part = joints[spec].clone();
      part.position.set(x, y, z);
    } else {
      part = new THREE.Mesh(geometryFor(kind, spec), finishes[matKey]);
      part.position.set(x, y, z);
    }
    figure.add(part);
    if (limbKey) joints[limbKey] = part;
  }
}

export function buildPersonMesh(dice, opts = {}) {
  const tones = personColours(dice, opts);
  const finishes = {
    skin: skinMaterial(tones.skin),
    shirt: clothMaterial(tones.shirt),
    pants: clothMaterial(tones.pants),
    hair: clothMaterial(tones.hair),
  };
  const figure = new THREE.Group();
  const joints = {};
  buildBodyParts(figure, finishes, joints);
  // A cap on some heads, so the crowd is not clones. The dice check runs
  // after the colour picks, exactly as v2.4 dealt it.
  if (opts.cap || (dice && dice() < CAP_ODDS)) {
    const hatMat = clothMaterial(opts.capColor ?? pick(dice, CROWD.caps));
    for (const [kind, args, , x, y, z] of CAP_PARTS) {
      const part = new THREE.Mesh(geometryFor(kind, args), hatMat);
      part.position.set(x, y, z);
      figure.add(part);
    }
  }
  // Gun anchor: the right hand holds the current weapon, pointing forward (+Z).
  const grip = new THREE.Group();
  grip.position.set(0.42, 1.05, 0.22);
  figure.add(grip);
  figure.userData = { ...joints, gunAnchor: grip };
  return figure;
}

// Swap the gun in a person'arc right hand. Returns the muzzle Object3D.
export function setPersonGun(figure, type) {
  const anchor = figure.userData.gunAnchor;
  if (!anchor) return null;
  while (anchor.children.length > 0) anchor.remove(anchor.children[0]);
  if (!type) return null;
  const gun = buildGunMesh(type);
  gun.group.rotation.x = 0; // points +Z, the person'arc facing
  anchor.add(gun.group);
  return gun.muzzle;
}

export function walkCycle(figure, phase, speed) {
  const sway = clamp(speed / 4, 0, 1);
  const arc = Math.sin(phase) * sway * 0.6;
  // Legs and arms sway in opposition; the figure bobs a little with each step.
  const joints = [
    [figure.userData.legL, arc],
    [figure.userData.legR, -arc],
    [figure.userData.armL, -arc * 0.8],
    [figure.userData.armR, arc * 0.8],
  ];
  for (const [joint, tilt] of joints) joint.rotation.x = tilt;
  figure.position.y = Math.abs(Math.sin(phase)) * 0.05 * sway;
}

// Mara Voss: teal shirt, red band, starts at the Coral Strip.
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
    // Mara wears a red band — the protagonist reads at a glance in third
    // person, and the foot shot shows her, not just another walker.
    const cloth = clothMaterial(BANDANA_RED);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.29, 0.12, 10), cloth);
    band.position.set(0, 1.8, 0);
    this.mesh.add(band);
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.06), cloth);
    knot.position.set(0, 1.72, -0.28);
    this.mesh.add(knot);
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

  // Turn in spot with A/D, then step forward/back along the heading.
  turnMara(dt, input) {
    if (input.left) this.heading += TURN_RATE * dt;
    if (input.right) this.heading -= TURN_RATE * dt;
  }

  stepMara(dt, speed, colliders) {
    // Forward/back run along the heading.
    let mx = 0;
    let mz = 0;
    if (this._moveForward) {
      mx += Math.sin(this.heading);
      mz += Math.cos(this.heading);
    }
    if (this._moveBack) {
      mx -= Math.sin(this.heading);
      mz -= Math.cos(this.heading);
    }
    const len = Math.hypot(mx, mz);
    if (len <= 0) {
      this.speed = 0;
      return;
    }
    mx /= len;
    mz /= len;
    this.speed = speed;
    const nextX = this.x + mx * speed * dt;
    const nextZ = this.z + mz * speed * dt;
    // Axis-separated slide: try both axes, then each alone, so Mara slides
    // along walls instead of sticking to them.
    if (!collideCircle(nextX, nextZ, 0.6, colliders)) {
      this.x = nextX;
      this.z = nextZ;
    } else if (!collideCircle(nextX, this.z, 0.6, colliders)) {
      this.x = nextX;
    } else if (!collideCircle(this.x, nextZ, 0.6, colliders)) {
      this.z = nextZ;
    }
    this.walkPhase += dt * speed * 1.6;
  }

  onFootMove(dt, input, colliders) {
    const speed = input.run ? RUN_SPEED : WALK_SPEED;
    // The step runs along the heading as it was when the frame began;
    // the turn applies after, so Mara faces the new heading while the
    // step itself follows the old one — exactly as v2.4 ordered it.
    this._moveForward = input.forward;
    this._moveBack = input.back;
    this.stepMara(dt, speed, colliders);
    this.turnMara(dt, input);
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

// Deal one pedestrian'arc placement: road, distance along it, side, heading,
// speed and walk phase — in that order, from the shared stream.
function dealPedPlacement(dice) {
  const road = pick(dice, ROAD_COORDS);
  const along = range(dice, -170, 170);
  const northSouth = dice() < 0.5;
  const side = dice() < 0.5 ? 5.8 : -5.8;
  return {
    road, along, northSouth, side,
    heading: dice() * Math.PI * 2,
    speed: range(dice, 1.2, 2.2),
    phase: dice() * 10,
  };
}

export class Pedestrians {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.peds = [];
  }

  spawn(n, avoid) {
    for (let i = 0; i < n; i++) {
      const figure = buildPersonMesh(this.rng);
      // The crowd is not clones: height and cap variety.
      figure.scale.setScalar(range(this.rng, 0.92, 1.08));
      this.scene.add(figure);
      const spot = dealPedPlacement(this.rng);
      const walker = {
        mesh: figure,
        x: spot.northSouth ? spot.road + spot.side : spot.along,
        z: spot.northSouth ? spot.along : spot.road + spot.side,
        heading: spot.heading,
        speed: spot.speed,
        phase: spot.phase,
        fleeing: 0,
        dead: false,
        driver: false,
      };
      if (avoid && Math.hypot(walker.x - avoid.x, walker.z - avoid.z) < 12) {
        this.scene.remove(figure);
        continue;
      }
      figure.position.set(walker.x, 0, walker.z);
      this.peds.push(walker);
    }
  }

  spawnDriver(x, z, heading) {
    const figure = buildPersonMesh(this.rng);
    this.scene.add(figure);
    const walker = { mesh: figure, x, z, heading, speed: 2.5, phase: 0, fleeing: 6, dead: false, driver: true };
    figure.position.set(x, 0, z);
    this.peds.push(walker);
    return walker;
  }

  scare(x, z, radius) {
    for (const one of this.peds) {
      if (one.dead) continue;
      if (Math.hypot(one.x - x, one.z - z) >= radius) continue;
      one.fleeing = 5;
      one.heading = Math.atan2(one.x - x, one.z - z);
    }
  }

  update(dt) {
    for (const one of this.peds) {
      if (one.dead) continue;
      if (one.fleeing > 0) {
        one.fleeing -= dt;
        one.speed = PED_FLEE_SPEED;
      } else {
        one.speed = PED_STROLL_SPEED;
      }
      const nextX = one.x + Math.sin(one.heading) * one.speed * dt;
      const nextZ = one.z + Math.cos(one.heading) * one.speed * dt;
      const stuck = collideCircle(nextX, nextZ, 0.6, this.colliders)
        || nextX > PED_BOUND || nextX < -PED_BOUND || nextZ > PED_BOUND || nextZ < -PED_BOUND;
      if (stuck) {
        // Stay on sidewalks: if the next step hits a building, turn around.
        one.heading += Math.PI * (0.5 + this.rng() * 0.5);
      } else {
        one.x = nextX;
        one.z = nextZ;
        // At intersections, sometimes turn onto another sidewalk.
        if (this.rng() < dt * 0.25) {
          one.heading += pick(this.rng, [-Math.PI / 2, Math.PI / 2]);
        }
      }
      one.phase += dt * one.speed * 1.6;
      one.mesh.position.set(one.x, 0, one.z);
      one.mesh.rotation.y = one.heading;
      walkCycle(one.mesh, one.phase, one.speed);
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const one of this.peds) {
      if (one.dead) continue;
      const dist = (one.x - x) ** 2 + (one.z - z) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = one;
      }
    }
    return best;
  }

  kill(one) {
    p.dead = true;
    p.mesh.rotation.x = Math.PI / 2;
    p.mesh.position.y = 0.3;
  }
}
