// Vehicles for CORAL HEAT v2.5: procedural car meshes (no model files),
// arcade driving physics, traffic that follows the road grid, police
// pursuit cars and the police helicopter with its searchlight. v2.5 rewrites
// v2.4's vehicles.js from scratch: same cars, same driving, same traffic
// and police behaviour, written as new code. Car bodies are data now — each
// style is a table of box parts that one assembler turns into a mesh — and
// the driving model is split into small named steps (throttle, steering,
// collision slide, car-car push, mesh sync).
// One rule governs this file: the seeded dice calls happen in exactly the
// same order as v2.4, so the same seed deals the same traffic.
import * as THREE from 'three';
import { createRng, pick, range, clamp, angleLerp } from './rng.js';
import { ROAD_COORDS } from './city.js';
import { buildGunMesh } from './weapons.js';

// Traffic paint pool. Taxis are always coral yellow, never a random colour.
const PAINTS = [0xd8d8e0, 0x2a2a30, 0x37b6ff, 0xffb347, 0x7dff9a, 0xff7ad9, 0xc9a06a, 0x5a8a6a, 0xb03a2e];
const CAB_YELLOW = 0xffd23e;

// Dimensions per body style. len/wid/height drive every part that follows.
const BODY_SIZES = {
  truck: { len: 6.4, wid: 2.5, bodyH: 1.5 },
  bus: { len: 9.0, wid: 2.5, bodyH: 2.2 },
  van: { len: 5.6, wid: 2.5, bodyH: 0.85 },
  sports: { len: 4.6, wid: 2.0, bodyH: 0.85 },
  sedan: { len: 4.4, wid: 2.0, bodyH: 0.85 },
  taxi: { len: 4.4, wid: 2.0, bodyH: 0.85 },
  police: { len: 4.4, wid: 2.0, bodyH: 0.85 },
};

// A part spec: [width, height, depth, material key, x, y, z].
// Material keys resolve against the per-car material set built below.
function shellParts(type, len, wid, bodyH) {
  const shell = [
    [wid, bodyH, len, 'body', 0, 0.62, 0],
    [wid * 0.92, 0.5, 0.9, 'body', 0, 0.5, len / 2 - 0.2],
  ];
  if (type === 'truck') {
    shell.push(
      [wid * 0.96, 1.5, 1.6, 'body', 0, 1.7, len / 2 - 1.4], // cab
      [wid * 0.8, 0.9, 0.1, 'glass', 0, 1.85, len / 2 - 0.55], // shield
      [wid * 0.9, 0.7, len - 2.6, 'trim', 0, 1.5, -len / 2 + 1.6], // bed
    );
  } else if (type === 'bus') {
    shell.push(
      [wid * 0.96, 0.9, len * 0.8, 'glass', 0, 1.6, 0], // windows
      [wid * 1.01, 0.3, len * 0.98, 'stripe', 0, 0.95, 0], // stripe
      [1.1, 0.4, 0.08, 'sign', 0, 2.1, len / 2 + 0.02], // route sign
      [0.9, 1.9, 0.06, 'glass', wid / 2 + 0.01, 1.1, len / 2 - 1.6], // door
    );
  } else if (type === 'van') {
    shell.push([wid * 0.94, 1.3, len * 0.72, 'glass', 0, 1.5, -0.2]); // cab
  } else {
    const cabinZ = type === 'sports' ? -0.25 : -0.1;
    shell.push([wid * 0.86, 0.72, len * 0.48, 'glass', 0, 1.35, cabinZ]); // cabin
    if (type === 'sports') {
      shell.push(
        [wid * 0.9, 0.1, 0.5, 'trim', 0, 1.15, -len / 2 + 0.15], // spoiler
        [0.5, 0.06, len * 0.98, 'stripeDark', 0, 1.08, 0], // stripe
      );
    }
  }
  return shell;
}

function trimPieces(len, wid) {
  const pieces = [];
  for (const s of [-1, 1]) {
    pieces.push(
      [wid * 0.96, 0.28, 0.18, 'bumper', 0, 0.42, len / 2 + 0.05],
      [wid * 0.96, 0.28, 0.18, 'bumper', 0, 0.42, -len / 2 - 0.05],
      [0.12, 0.18, 0.24, 'trim', s * (wid / 2 + 0.08), 1.15, len / 2 - 1.5],
    );
  }
  pieces.push([0.7, 0.22, 0.04, 'plate', 0, 0.5, -len / 2 - 0.14]); // plate
  return pieces;
}

function makeMats(color) {
  return {
    body: new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.15, metalness: 0.7, transparent: true, opacity: 0.72 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.7 }),
    stripe: new THREE.MeshStandardMaterial({ color: CAB_YELLOW, roughness: 0.5 }),
    stripeDark: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }),
    sign: new THREE.MeshBasicMaterial({ color: CAB_YELLOW }),
    bumper: new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, metalness: 0.6 }),
    plate: new THREE.MeshBasicMaterial({ color: 0xf0ead8 }),
  };
}

function placeBoxes(grp, parts, finishes) {
  const built = [];
  for (const [w, h, d, key, x, y, z] of parts) {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), finishes[key]);
    piece.position.set(x, y, z);
    grp.add(piece);
    built.push(piece);
  }
  return built;
}

function fitWheels(grp, len, wid, type) {
  const tyreGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.3, metalness: 0.8 });
  const rims = [];
  const spots = [
    [-wid / 2, len / 2 - 1.1], [wid / 2, len / 2 - 1.1],
    [-wid / 2, -len / 2 + 1.1], [wid / 2, -len / 2 + 1.1],
  ];
  if (type === 'bus') spots.push([-wid / 2, 0], [wid / 2, 0]);
  for (const [wx, wz] of spots) {
    const tyre = new THREE.Mesh(tyreGeo, tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(wx, 0.42, wz);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(tyre.position);
    grp.add(tyre);
    grp.add(hub);
    rims.push(tyre);
  }
  return rims;
}

function fitLights(grp, len, wid) {
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const s of [-1, 1]) {
    const headlamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headMat);
    headlamp.position.set(s * wid * 0.32, 0.72, len / 2 + 0.02);
    grp.add(headlamp);
    const taillamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), tailMat);
    taillamp.position.set(s * wid * 0.32, 0.78, -len / 2 - 0.02);
    grp.add(taillamp);
  }
}

function fitPoliceKit(grp, wid) {
  const barMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4), barMat);
  bar.position.set(0, 1.85, -0.1);
  grp.add(bar);
  const redLamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  redLamp.position.set(-0.32, 2.0, -0.1);
  grp.add(redLamp);
  const blueLamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
  blueLamp.position.set(0.32, 2.0, -0.1);
  grp.add(blueLamp);
  grp.userData.lightBar = { red: redLamp, blue: blueLamp };
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  doorPanel.position.set(wid / 2 + 0.01, 0.7, 0);
  grp.add(doorPanel);
}

function seatDriver(grp, wid, type) {
  // A visible driver in the cabin — the city feels populated, not remote-controlled.
  if (type === 'truck' || type === 'bus') return;
  const driverZ = type === 'sports' ? -0.1 : 0.05;
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.8 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
  skull.position.set(-wid * 0.22, 1.35, driverZ);
  grp.add(skull);
  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.5, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.9 }),
  );
  chest.position.set(-wid * 0.22, 0.95, driverZ);
  grp.add(chest);
}

// Build one car from boxes and cylinders. type: sports | sedan | taxi | truck | van | police | bus
export function buildCarMesh(type, color) {
  const grp = new THREE.Group();
  const { len, wid, bodyH } = BODY_SIZES[type] ?? BODY_SIZES.sedan;
  const finishes = makeMats(color);

  placeBoxes(grp, shellParts(type, len, wid, bodyH), finishes);
  const rims = fitWheels(grp, len, wid, type);
  fitLights(grp, len, wid);
  if (type === 'taxi') {
    const cabSign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: CAB_YELLOW }));
    cabSign.position.set(0, 1.95, -0.1);
    grp.add(cabSign);
  }
  if (type === 'police') fitPoliceKit(grp, wid);
  placeBoxes(grp, trimPieces(len, wid), finishes);
  seatDriver(grp, wid, type);

  grp.userData.wheels = rims;
  grp.userData.length = len;
  grp.userData.width = wid;
  return grp;
}

// --- arcade driving: one car state, shared by player + police + traffic ---
function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

function throttleStep(car, input, dt) {
  const topSpeed = car.maxSpeed ?? 42;
  const accel = car.accel ?? 22;
  if (input.brake) {
    car.speed = approach(car.speed, 0, dt * 60);
    return;
  }
  car.speed += input.throttle * accel * dt;
  if (input.throttle < 0) car.speed = Math.max(car.speed, -12);
  else car.speed = Math.min(car.speed, topSpeed);
  // Drag + rolling resistance, then a dead stop at a crawl with no input.
  car.speed *= 1 - 0.25 * dt;
  if (input.throttle === 0 && Math.abs(car.speed) < 0.15) car.speed = 0;
}

function steerStep(car, input, dt) {
  const grip = clamp(Math.abs(car.speed) / 12, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += input.steer * 1.9 * grip * dt;
}

function slideWalls(car, nx, nz, colliders) {
  const hit = collideCircle(nx, nz, 1.5, colliders);
  if (!hit) {
    car.x = nx;
    car.z = nz;
    car.crashed = false;
    return;
  }
  // Slide along the wall: keep the axis that is free.
  if (!collideCircle(nx, car.z, 1.5, colliders)) car.x = nx;
  else if (!collideCircle(car.x, nz, 1.5, colliders)) car.z = nz;
  car.speed *= 0.55;
  car.crashed = true;
}

function separate(car, others) {
  for (const o of others) {
    if (o === car || o.dead) continue;
    const dx = car.x - o.x;
    const dz = car.z - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= 9 || d2 <= 0.0001) continue;
    const dist = Math.sqrt(d2);
    const push = (3 - dist) * 0.5;
    car.x += (dx / dist) * push;
    car.z += (dz / dist) * push;
    car.speed *= 0.9;
  }
}

function syncMesh(car, dt) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
}

export function driveCar(car, dt, input, colliders, others) {
  // input: { throttle: -1..1, steer: -1..1, brake: bool }
  throttleStep(car, input, dt);
  steerStep(car, input, dt);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  slideWalls(car, nx, nz, colliders);
  separate(car, others);
  syncMesh(car, dt);
  return car;
}

export function collideCircle(x, z, r, colliders) {
  for (const c of colliders) {
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return c;
  }
  return null;
}

// --- traffic: cars looping the road grid, right-hand lanes ---
const MIX = ['sedan', 'sedan', 'taxi', 'van', 'truck', 'sports', 'sedan', 'bus'];
const LANE = 2.2;

export class Traffic {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = rng;
    this.cars = [];
    this.types = MIX;
  }

  spawn(n, avoid) {
    for (let i = 0; i < n; i++) {
      // Deal order per car: type, colour (unless taxi), road, along,
      // north-south, lane, speed, max speed — same deal as v2.4.
      const kind = pick(this.rng, this.types);
      const paint = kind === 'taxi' ? CAB_YELLOW : pick(this.rng, PAINTS);
      const body = buildCarMesh(kind, paint);
      this.scene.add(body);
      const street = pick(this.rng, ROAD_COORDS);
      const pos = range(this.rng, -170, 170);
      const northSouth = this.rng() < 0.5;
      const offset = this.rng() < 0.5 ? LANE : -LANE;
      const auto = {
        mesh: body, type: kind,
        x: northSouth ? street + offset : pos,
        z: northSouth ? pos : street + offset,
        heading: northSouth ? (offset > 0 ? 0 : Math.PI) : (offset > 0 ? Math.PI / 2 : -Math.PI / 2),
        speed: range(this.rng, 7, 13),
        maxSpeed: range(this.rng, 10, 15),
        accel: 8, crashed: false, dead: false,
      };
      if (avoid && Math.hypot(auto.x - avoid.x, auto.z - avoid.z) < 25) {
        this.scene.remove(body);
        continue;
      }
      body.position.set(auto.x, 0, auto.z);
      body.rotation.y = auto.heading;
      this.cars.push(auto);
    }
  }

  // Is there a car directly ahead of `car` within `dist`, in its lane?
  carAhead(car, other, dist) {
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
    const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
    return ahead > 0 && ahead < dist && side < 2.5;
  }

  stepCar(car, dt, player) {
    // Slow for the car ahead.
    let goal = car.maxSpeed;
    for (const o of this.cars) {
      if (o === car || o.dead) continue;
      if (this.carAhead(car, o, 10)) { goal = 0; break; }
    }
    if (player && player.inCar && this.carAhead(car, player.car, 9)) goal = 0;
    car.speed = approach(car.speed, goal, dt * 10);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // At an intersection, maybe turn.
    const closeX = ROAD_COORDS.reduce((a, b) => (Math.abs(b - nx) < Math.abs(a - nx) ? b : a), ROAD_COORDS[0]);
    const closeZ = ROAD_COORDS.reduce((a, b) => (Math.abs(b - nz) < Math.abs(a - nz) ? b : a), ROAD_COORDS[0]);
    const onX = Math.abs(nx - closeX) < 0.6;
    const onZ = Math.abs(nz - closeZ) < 0.6;
    const atJunction = (onX && Math.abs(Math.sin(car.heading)) < 0.1)
      || (onZ && Math.abs(Math.cos(car.heading)) < 0.1);
    if (atJunction) {
      const roll = this.rng();
      const bend = roll < 0.25 ? -Math.PI / 2 : roll < 0.5 ? Math.PI / 2 : 0;
      if (bend !== 0) {
        const newHeading = car.heading + bend;
        // Snap onto the new road's lane (the position snap is then
        // overwritten by nx/nz below — only the heading change sticks,
        // exactly as v2.4 drove it).
        if (Math.abs(Math.sin(newHeading)) < 0.1) {
          car.x = closeX + (newHeading === 0 ? LANE : -LANE);
          car.z = closeZ;
        } else {
          car.z = closeZ + (newHeading === Math.PI / 2 ? LANE : -LANE);
          car.x = closeX;
        }
        car.heading = newHeading;
      }
    }
    // Stay inside the city; bounce at the edge roads.
    if (nx > 175 || nx < -175 || nz > 175 || nz < -175) car.heading += Math.PI;
    car.x = nx;
    car.z = nz;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }

  update(dt, player) {
    for (const car of this.cars) {
      if (car.dead) continue;
      this.stepCar(car, dt, player);
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of this.cars) {
      if (car.dead) continue;
      const dist = (car.x - x) ** 2 + (car.z - z) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = car;
      }
    }
    return best;
  }

  remove(car) {
    car.dead = true;
    this.scene.remove(car.mesh);
  }
}

// --- police: pursuit cars + helicopter ---
const HELI_ALT = 42;
const HELI_RING = 26;

// Pursuit-car counts per wanted level, 0 to 5 stars.
const WANTED_CARS = [0, 1, 2, 3, 4, 5];

// Build the helicopter mesh: white body, navy belly stripe, rotor disc,
// flashing light bar, searchlight cone + ground pool.
function makeHeli() {
  const grp = new THREE.Group();
  const shellWhite = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.35, metalness: 0.25, emissive: 0x555555 });
  const navyBlue = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x666666 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), shellWhite);
  hull.position.y = 0;
  grp.add(hull);
  const underside = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.5, 5.24), navyBlue);
  underside.position.y = -0.55;
  grp.add(underside);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.6), new THREE.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.1, metalness: 0.8 }));
  canopy.position.set(0, 0.2, 2.0);
  grp.add(canopy);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), shellWhite);
  tailFin.position.set(0, 0.3, -4.2);
  grp.add(tailFin);
  const tailBand = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 4.5), navyBlue);
  tailBand.position.set(0, 0.3, -4.2);
  grp.add(tailBand);
  const blades = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), darkMetal);
  blades.position.y = 1.1;
  grp.add(blades);
  // Rotor blur disc: a spinning blade alone is a thin line; the disc sells motion.
  const blurDisc = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.y = 1.12;
  grp.add(blurDisc);
  const tailSpin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.5), darkMetal);
  tailSpin.position.set(0.4, 0.4, -6.2);
  grp.add(tailSpin);
  const skidPair = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 3.6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  skidPair.position.y = -1.1;
  grp.add(skidPair);
  // Flashing light bar on the roof, like the pursuit cars.
  const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  redBar.position.set(-0.55, 0.95, 0.4);
  grp.add(redBar);
  const blueBar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
  blueBar.position.set(0.55, 0.95, 0.4);
  grp.add(blueBar);
  // Red navigation light on the tail tip.
  const navLamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  navLamp.position.set(0, 0.3, -6.5);
  grp.add(navLamp);
  // Searchlight: narrow at the heli, wide at the ground — the cone's apex
  // sits at the heli and its base at the ground with no flip (v2.4's first
  // retake had it upside down, a lampshade over the whole frame).
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(9, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = -22;
  grp.add(beam);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(8, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -41.5;
  grp.add(pool);
  grp.userData.rotor = blades;
  grp.userData.tailRotor = tailSpin;
  grp.userData.cone = beam;
  grp.userData.spot = pool;
  grp.userData.lightBar = { red: redBar, blue: blueBar };
  return grp;
}

export class Police {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.cars = [];
    this.heli = null;
    this.spawnTimer = 0;
  }

  desiredCount(wanted) {
    if (wanted <= 0) return 0;
    if (wanted >= 5) return 5;
    return WANTED_CARS[wanted];
  }

  spawnCarNear(px, pz) {
    const body = buildCarMesh('police', 0xf0f0f0);
    this.scene.add(body);
    const a = this.rng() * Math.PI * 2;
    const car = {
      mesh: body, type: 'police',
      x: px + Math.sin(a) * 55, z: pz + Math.cos(a) * 55,
      heading: a, speed: 0, maxSpeed: 46, accel: 26, crashed: false, dead: false,
    };
    car.x = clamp(car.x, -175, 175);
    car.z = clamp(car.z, -175, 175);
    body.position.set(car.x, 0, car.z);
    this.cars.push(car);
    return car;
  }

  spawnHeli() {
    if (this.heli) return;
    const grp = makeHeli();
    this.scene.add(grp);
    this.heli = { mesh: grp, angle: 0, x: 0, z: 0 };
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.mesh);
    this.heli = null;
  }

  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    this.removeHeli();
  }

  // One light-bar flash phase, shared by pursuit cars and the helicopter.
  flashLightBar(lightBar) {
    if (!lightBar) return;
    const phase = Math.floor(performance.now() / 180) % 2 === 0;
    lightBar.red.material.color.setHex(phase ? 0xff2020 : 0x550000);
    lightBar.blue.material.color.setHex(phase ? 0x101040 : 0x2040ff);
  }

  chaseCar(car, dt, p, others) {
    // Pursuit steering: aim at the player, ram when close.
    const dx = p.x - car.x;
    const dz = p.z - car.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    const steer = clamp(((targetHeading - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
    const throttle = dist > 4 ? 1 : 0.4;
    driveCar(car, dt, { throttle, steer: clamp(steer * 2.2, -1, 1), brake: false }, this.colliders, others);
    this.flashLightBar(car.mesh.userData.lightBar);
    return dist;
  }

  flyHeli(dt, p) {
    const h = this.heli;
    h.angle += dt * 0.55;
    h.x = p.x + Math.cos(h.angle) * HELI_RING;
    h.z = p.z + Math.sin(h.angle) * HELI_RING;
    h.mesh.position.set(h.x, HELI_ALT + Math.sin(h.angle * 2) * 1.5, h.z);
    h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
    h.mesh.userData.rotor.rotation.y += dt * 22;
    h.mesh.userData.tailRotor.rotation.x += dt * 30;
    this.flashLightBar(h.mesh.userData.lightBar);
    h.mesh.userData.spot.position.set(p.x - h.x, -41.5, p.z - h.z);
  }

  update(dt, player, wanted, others) {
    const p = player.pos || { x: player.x, z: player.z };
    const want = this.desiredCount(wanted);
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      this.spawnCarNear(p.x, p.z);
      this.spawnTimer = 2.5;
    }
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    if (wanted >= 3) this.spawnHeli();
    else this.removeHeli();

    for (const car of this.cars) {
      const dist = this.chaseCar(car, dt, p, others);
      // Bumping the player slows them.
      if (dist < 3.4 && player.inCar) player.car.speed *= 0.985;
    }
    if (this.heli) this.flyHeli(dt, p);
  }
}

// --- roadblocks: police barriers that appear ahead of the player at high wanted ---
// A foot officer: dark-blue uniform, cap, pistol in hand — roadblocks are
// manned, not just striped plastic.
function makeOfficer() {
  const grp = new THREE.Group();
  const kit = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.85 });
  const flesh = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.8 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), flesh);
  skull.position.y = 1.6;
  grp.add(skull);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.12, 10), kit);
  hat.position.y = 1.78;
  grp.add(hat);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.2), kit);
  visor.position.set(0, 1.73, 0.24);
  grp.add(visor);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), kit);
  chest.position.set(0, 1.05, 0);
  grp.add(chest);
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.12, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffd23e, metalness: 0.8, roughness: 0.3 }),
  );
  shield.position.set(-0.15, 1.2, 0.17);
  grp.add(shield);
  for (const s of [-1, 1]) {
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), kit);
    shin.position.set(s * 0.15, 0.35, 0);
    grp.add(shin);
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), kit);
    limb.position.set(s * 0.4, 1.08, 0);
    grp.add(limb);
  }
  const sidearm = buildGunMesh('pistol');
  sidearm.group.scale.setScalar(1.15);
  sidearm.group.position.set(0.42, 1.0, 0.25);
  sidearm.group.rotation.x = -0.15;
  grp.add(sidearm.group);
  return grp;
}

export class Roadblocks {
  constructor(scene) {
    this.scene = scene;
    this.blocks = [];
    const barMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const grp = new THREE.Group();
      for (let j = -1; j <= 1; j++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.5), j === 0 ? stripeMat : barMat);
        bar.position.set(j * 2.4, 0.7, 0);
        grp.add(bar);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.5), barMat);
        leg.position.set(j * 2.4, 0.25, 0);
        grp.add(leg);
      }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      lamp.position.set(0, 1.6, 0);
      grp.add(lamp);
      // Two foot officers manning the barrier, pistols in hand.
      for (const s of [-1, 1]) {
        const officer = makeOfficer();
        officer.position.set(s * 4.4, 0, 1.6);
        officer.rotation.y = s * 0.5;
        grp.add(officer);
      }
      grp.visible = false;
      this.scene.add(grp);
      this.blocks.push({ mesh: grp, x: 0, z: 0, active: false, light: lamp });
    }
  }

  placeAhead(player, wanted) {
    const p = player.pos || { x: player.x, z: player.z };
    const heading = player.inCar && player.car ? player.car.heading : player.heading;
    const want = wanted >= 4 ? 2 : wanted >= 3 ? 1 : 0;
    let idx = 0;
    for (const b of this.blocks) {
      if (idx < want) {
        const ahead = 38 + idx * 20;
        const side = idx === 0 ? 0 : (idx % 2 ? 8 : -8);
        b.x = p.x + Math.sin(heading) * ahead + Math.cos(heading) * side;
        b.z = p.z + Math.cos(heading) * ahead - Math.sin(heading) * side;
        b.mesh.position.set(b.x, 0, b.z);
        b.mesh.rotation.y = heading;
        b.mesh.visible = true;
        b.active = true;
      } else {
        b.mesh.visible = false;
        b.active = false;
      }
      idx++;
    }
  }

  clear() {
    for (const b of this.blocks) {
      b.mesh.visible = false;
      b.active = false;
    }
  }

  hitTest(x, z) {
    for (const b of this.blocks) {
      if (!b.active) continue;
      if (Math.hypot(x - b.x, z - b.z) < 3.6) return b;
    }
    return null;
  }
}
