// Vehicles for CORAL HEAT v2.3: procedural car meshes (no model files),
// arcade driving physics, traffic that follows the road grid, police
// pursuit cars and the police helicopter with its searchlight. v2.3 is a
// from-scratch rewrite of v2.2's vehicles.js: same cars, same driving, same
// traffic and police behaviour, different code.
// One rule governs this file: the seeded rng calls happen in exactly the
// same order as v2.2, so the same seed deals the same traffic.
import * as THREE from 'three';
import { createRng, pick, range, clamp, angleLerp } from './rng.js';
import { ROAD_COORDS } from './city.js';
import { buildGunMesh } from './weapons.js';

// Traffic paint pool. Taxis are always coral yellow, never a random colour.
const CAR_COLORS = [0xd8d8e0, 0x2a2a30, 0x37b6ff, 0xffb347, 0x7dff9a, 0xff7ad9, 0xc9a06a, 0x5a8a6a, 0xb03a2e];
const TAXI_YELLOW = 0xffd23e;

// Dimensions per body style. len/wid/height drive every part that follows.
function carDimensions(type) {
  if (type === 'truck') return { len: 6.4, wid: 2.5, bodyH: 1.5 };
  if (type === 'bus') return { len: 9.0, wid: 2.5, bodyH: 2.2 };
  if (type === 'van') return { len: 5.6, wid: 2.5, bodyH: 0.85 };
  if (type === 'sports') return { len: 4.6, wid: 2.0, bodyH: 0.85 };
  return { len: 4.4, wid: 2.0, bodyH: 0.85 };
}

function partBox(group, w, h, d, mat, x, y, z) {
  const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  part.position.set(x, y, z);
  group.add(part);
  return part;
}

// Build one car from boxes and cylinders. type: sports | sedan | taxi | truck | van | police | bus
export function buildCarMesh(type, color) {
  const g = new THREE.Group();
  const dims = carDimensions(type);
  const { len, wid, bodyH } = dims;
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.15, metalness: 0.7, transparent: true, opacity: 0.72 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.7 });

  partBox(g, wid, bodyH, len, bodyMat, 0, 0.62, 0);
  partBox(g, wid * 0.92, 0.5, 0.9, bodyMat, 0, 0.5, len / 2 - 0.2);

  if (type === 'truck') {
    partBox(g, wid * 0.96, 1.5, 1.6, bodyMat, 0, 1.7, len / 2 - 1.4); // cab
    partBox(g, wid * 0.8, 0.9, 0.1, glassMat, 0, 1.85, len / 2 - 0.55); // shield
    partBox(g, wid * 0.9, 0.7, len - 2.6, trimMat, 0, 1.5, -len / 2 + 1.6); // bed
  } else if (type === 'bus') {
    // City bus: tall body, full window strip, route sign, 6 wheels.
    partBox(g, wid * 0.96, 0.9, len * 0.8, glassMat, 0, 1.6, 0); // windows
    partBox(g, wid * 1.01, 0.3, len * 0.98, new THREE.MeshStandardMaterial({ color: TAXI_YELLOW, roughness: 0.5 }), 0, 0.95, 0); // stripe
    partBox(g, 1.1, 0.4, 0.08, new THREE.MeshBasicMaterial({ color: TAXI_YELLOW }), 0, 2.1, len / 2 + 0.02); // sign
    partBox(g, 0.9, 1.9, 0.06, glassMat, wid / 2 + 0.01, 1.1, len / 2 - 1.6); // door
  } else if (type === 'van') {
    partBox(g, wid * 0.94, 1.3, len * 0.72, glassMat, 0, 1.5, -0.2); // cab
  } else {
    const cabinZ = type === 'sports' ? -0.25 : -0.1;
    partBox(g, wid * 0.86, 0.72, len * 0.48, glassMat, 0, 1.35, cabinZ); // cabin
    if (type === 'sports') {
      partBox(g, wid * 0.9, 0.1, 0.5, trimMat, 0, 1.15, -len / 2 + 0.15); // spoiler
      partBox(g, 0.5, 0.06, len * 0.98, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }), 0, 1.08, 0); // stripe
    }
  }

  // Wheels (bus gets a third axle).
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  const wheelSpots = [
    [-wid / 2, len / 2 - 1.1], [wid / 2, len / 2 - 1.1],
    [-wid / 2, -len / 2 + 1.1], [wid / 2, -len / 2 + 1.1],
  ];
  if (type === 'bus') wheelSpots.push([-wid / 2, 0], [wid / 2, 0]);
  for (const [wx, wz] of wheelSpots) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    g.add(wheel);
    g.add(hub);
    wheels.push(wheel);
  }

  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const s of [-1, 1]) {
    partBox(g, 0.42, 0.18, 0.08, headMat, s * wid * 0.32, 0.72, len / 2 + 0.02);
    partBox(g, 0.42, 0.18, 0.08, tailMat, s * wid * 0.32, 0.78, -len / 2 - 0.02);
  }

  if (type === 'taxi') {
    partBox(g, 0.9, 0.3, 0.5, new THREE.MeshBasicMaterial({ color: TAXI_YELLOW }), 0, 1.95, -0.1); // roof sign
  }
  if (type === 'police') {
    partBox(g, 1.2, 0.22, 0.4, new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 1.85, -0.1); // bar
    const red = partBox(g, 0.5, 0.2, 0.42, new THREE.MeshBasicMaterial({ color: 0xff2020 }), -0.32, 2.0, -0.1);
    const blue = partBox(g, 0.5, 0.2, 0.42, new THREE.MeshBasicMaterial({ color: 0x2040ff }), 0.32, 2.0, -0.1);
    g.userData.lightBar = { red, blue };
    partBox(g, 0.06, 0.5, 1.6, new THREE.MeshBasicMaterial({ color: 0x111111 }), wid / 2 + 0.01, 0.7, 0); // door
  }

  // Bumpers + side mirrors, so cars read as cars from every angle.
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, metalness: 0.6 });
  for (const s of [-1, 1]) {
    partBox(g, wid * 0.96, 0.28, 0.18, bumperMat, 0, 0.42, len / 2 + 0.05);
    partBox(g, wid * 0.96, 0.28, 0.18, bumperMat, 0, 0.42, -len / 2 - 0.05);
    partBox(g, 0.12, 0.18, 0.24, trimMat, s * (wid / 2 + 0.08), 1.15, len / 2 - 1.5);
  }
  partBox(g, 0.7, 0.22, 0.04, new THREE.MeshBasicMaterial({ color: 0xf0ead8 }), 0, 0.5, -len / 2 - 0.14); // plate

  // A visible driver in the cabin — the city feels populated, not remote-controlled.
  if (type !== 'truck' && type !== 'bus') {
    const driverZ = type === 'sports' ? -0.1 : 0.05;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.8 });
    const driverHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
    driverHead.position.set(-wid * 0.22, 1.35, driverZ);
    g.add(driverHead);
    partBox(g, 0.55, 0.5, 0.3, new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.9 }), -wid * 0.22, 0.95, driverZ);
  }

  g.userData.wheels = wheels;
  g.userData.length = len;
  g.userData.width = wid;
  return g;
}

// --- arcade driving: one car state, shared by player + police + traffic ---
function approachValue(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

export function driveCar(car, dt, input, colliders, others) {
  // input: { throttle: -1..1, steer: -1..1, brake: bool }
  const maxSpeed = car.maxSpeed ?? 42;
  const accel = car.accel ?? 22;
  if (input.brake) {
    car.speed = approachValue(car.speed, 0, 60 * dt);
  } else {
    car.speed += input.throttle * accel * dt;
    car.speed = input.throttle < 0 ? Math.max(car.speed, -12) : Math.min(car.speed, maxSpeed);
  }
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.25 * dt;
  if (Math.abs(car.speed) < 0.15 && input.throttle === 0) car.speed = 0;
  const steerAuthority = clamp(Math.abs(car.speed) / 12, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += input.steer * 1.9 * steerAuthority * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collideCircle(nx, nz, 1.5, colliders);
  if (hit) {
    // Slide along the wall: keep the axis that is free.
    if (!collideCircle(nx, car.z, 1.5, colliders)) car.x = nx;
    else if (!collideCircle(car.x, nz, 1.5, colliders)) car.z = nz;
    car.speed *= 0.55;
    car.crashed = true;
  } else {
    car.x = nx;
    car.z = nz;
    car.crashed = false;
  }
  // Soft car-car push.
  for (const o of others) {
    if (o === car || o.dead) continue;
    const dx = car.x - o.x;
    const dz = car.z - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= 9 || d2 <= 0.0001) continue;
    const d = Math.sqrt(d2);
    const push = (3 - d) * 0.5;
    car.x += (dx / d) * push;
    car.z += (dz / d) * push;
    car.speed *= 0.9;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
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
const TRAFFIC_MIX = ['sedan', 'sedan', 'taxi', 'van', 'truck', 'sports', 'sedan', 'bus'];
const LANE_OFFSET = 2.2;

export class Traffic {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = rng;
    this.cars = [];
    this.types = TRAFFIC_MIX;
  }

  spawn(n, avoid) {
    for (let i = 0; i < n; i++) {
      // Deal order per car: type, colour (unless taxi), road, along,
      // north-south, lane, speed, max speed — same deal as v2.2.
      const type = pick(this.rng, this.types);
      const color = type === 'taxi' ? TAXI_YELLOW : pick(this.rng, CAR_COLORS);
      const mesh = buildCarMesh(type, color);
      this.scene.add(mesh);
      const road = pick(this.rng, ROAD_COORDS);
      const along = range(this.rng, -170, 170);
      const ns = this.rng() < 0.5;
      const lane = this.rng() < 0.5 ? LANE_OFFSET : -LANE_OFFSET;
      const car = {
        mesh, type,
        x: ns ? road + lane : along,
        z: ns ? along : road + lane,
        heading: ns ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2),
        speed: range(this.rng, 7, 13),
        maxSpeed: range(this.rng, 10, 15),
        accel: 8, crashed: false, dead: false,
      };
      if (avoid && Math.hypot(car.x - avoid.x, car.z - avoid.z) < 25) {
        this.scene.remove(mesh);
        continue;
      }
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      this.cars.push(car);
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

  update(dt, player) {
    for (const car of this.cars) {
      if (car.dead) continue;
      // Slow for the car ahead.
      let target = car.maxSpeed;
      for (const o of this.cars) {
        if (o === car || o.dead) continue;
        if (this.carAhead(car, o, 10)) { target = 0; break; }
      }
      if (player && player.inCar && this.carAhead(car, player.car, 9)) target = 0;
      car.speed = approachValue(car.speed, target, 10 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      // At an intersection, maybe turn.
      const nearX = ROAD_COORDS.reduce((a, b) => (Math.abs(b - nx) < Math.abs(a - nx) ? b : a), ROAD_COORDS[0]);
      const nearZ = ROAD_COORDS.reduce((a, b) => (Math.abs(b - nz) < Math.abs(a - nz) ? b : a), ROAD_COORDS[0]);
      const atX = Math.abs(nx - nearX) < 0.6;
      const atZ = Math.abs(nz - nearZ) < 0.6;
      const onCrossStreet = (atX && Math.abs(Math.sin(car.heading)) < 0.1)
        || (atZ && Math.abs(Math.cos(car.heading)) < 0.1);
      if (onCrossStreet) {
        const r = this.rng();
        const turn = r < 0.25 ? -Math.PI / 2 : r < 0.5 ? Math.PI / 2 : 0;
        if (turn !== 0) {
          const nh = car.heading + turn;
          // Snap onto the new road's lane (the position snap is then
          // overwritten by nx/nz below — only the heading change sticks,
          // exactly as v2.2 drove it).
          if (Math.abs(Math.sin(nh)) < 0.1) {
            car.x = nearX + (nh === 0 ? LANE_OFFSET : -LANE_OFFSET);
            car.z = nearZ;
          } else {
            car.z = nearZ + (nh === Math.PI / 2 ? LANE_OFFSET : -LANE_OFFSET);
            car.x = nearX;
          }
          car.heading = nh;
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
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of this.cars) {
      if (car.dead) continue;
      const d = (car.x - x) ** 2 + (car.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
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
const HELI_ALTITUDE = 42;
const HELI_ORBIT = 26;

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
    if (wanted <= 1) return 1;
    if (wanted <= 2) return 2;
    if (wanted <= 3) return 3;
    if (wanted <= 4) return 4;
    return 5;
  }

  spawnCarNear(px, pz) {
    const mesh = buildCarMesh('police', 0xf0f0f0);
    this.scene.add(mesh);
    const a = this.rng() * Math.PI * 2;
    const car = {
      mesh, type: 'police',
      x: px + Math.sin(a) * 55, z: pz + Math.cos(a) * 55,
      heading: a, speed: 0, maxSpeed: 46, accel: 26, crashed: false, dead: false,
    };
    car.x = clamp(car.x, -175, 175);
    car.z = clamp(car.z, -175, 175);
    mesh.position.set(car.x, 0, car.z);
    this.cars.push(car);
    return car;
  }

  spawnHeli() {
    if (this.heli) return;
    const g = new THREE.Group();
    // Police-white body with a navy belly stripe, a flashing red/blue light
    // bar and a pale rotor disc, so it reads against the sunset. The white
    // body carries an emissive lift: its east face is in shadow at sunset
    // and went black in v2.1's first retake.
    const white = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.35, metalness: 0.25, emissive: 0x555555 });
    const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), white);
    body.position.y = 0;
    g.add(body);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.5, 5.24), navy);
    belly.position.y = -0.55;
    g.add(belly);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.6), new THREE.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.1, metalness: 0.8 }));
    glass.position.set(0, 0.2, 2.0);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), white);
    tail.position.set(0, 0.3, -4.2);
    g.add(tail);
    const tailStripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 4.5), navy);
    tailStripe.position.set(0, 0.3, -4.2);
    g.add(tailStripe);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), dark);
    rotor.position.y = 1.1;
    g.add(rotor);
    // Rotor blur disc: a spinning blade alone is a thin line; the disc sells motion.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 1.12;
    g.add(disc);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.5), dark);
    tailRotor.position.set(0.4, 0.4, -6.2);
    g.add(tailRotor);
    const skids = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 3.6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    skids.position.y = -1.1;
    g.add(skids);
    // Flashing light bar on the roof, like the pursuit cars.
    const barRed = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barRed.position.set(-0.55, 0.95, 0.4);
    g.add(barRed);
    const barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    barBlue.position.set(0.55, 0.95, 0.4);
    g.add(barBlue);
    // Red navigation light on the tail tip.
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    nav.position.set(0, 0.3, -6.5);
    g.add(nav);
    // Searchlight: narrow at the heli, wide at the ground — the cone's apex
    // sits at the heli and its base at the ground with no flip (v2.1's first
    // retake had it upside down, a lampshade over the whole frame).
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(9, 42, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.y = -22;
    g.add(cone);
    const spot = new THREE.Mesh(
      new THREE.CircleGeometry(8, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    spot.rotation.x = -Math.PI / 2;
    spot.position.y = -41.5;
    g.add(spot);
    g.userData.rotor = rotor;
    g.userData.tailRotor = tailRotor;
    g.userData.cone = cone;
    g.userData.spot = spot;
    g.userData.lightBar = { red: barRed, blue: barBlue };
    this.scene.add(g);
    this.heli = { mesh: g, angle: 0, x: 0, z: 0 };
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
      // Pursuit steering: aim at the player, ram when close.
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      const steer = clamp(((targetHeading - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
      const throttle = dist > 4 ? 1 : 0.4;
      driveCar(car, dt, { throttle, steer: clamp(steer * 2.2, -1, 1), brake: false }, this.colliders, others);
      this.flashLightBar(car.mesh.userData.lightBar);
      // Bumping the player slows them.
      if (dist < 3.4 && player.inCar) player.car.speed *= 0.985;
    }

    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.55;
      h.x = p.x + Math.cos(h.angle) * HELI_ORBIT;
      h.z = p.z + Math.sin(h.angle) * HELI_ORBIT;
      h.mesh.position.set(h.x, HELI_ALTITUDE + Math.sin(h.angle * 2) * 1.5, h.z);
      h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
      h.mesh.userData.rotor.rotation.y += dt * 22;
      h.mesh.userData.tailRotor.rotation.x += dt * 30;
      this.flashLightBar(h.mesh.userData.lightBar);
      h.mesh.userData.spot.position.set(p.x - h.x, -41.5, p.z - h.z);
    }
  }
}

// --- roadblocks: police barriers that appear ahead of the player at high wanted ---
// A foot officer: dark-blue uniform, cap, pistol in hand — roadblocks are
// manned, not just striped plastic.
function buildOfficerMesh() {
  const g = new THREE.Group();
  const uniform = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.6;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.12, 10), uniform);
  cap.position.y = 1.78;
  g.add(cap);
  partBox(g, 0.3, 0.04, 0.2, uniform, 0, 1.73, 0.24); // brim
  partBox(g, 0.6, 0.7, 0.32, uniform, 0, 1.05, 0); // torso
  partBox(g, 0.1, 0.12, 0.02, new THREE.MeshStandardMaterial({ color: 0xffd23e, metalness: 0.8, roughness: 0.3 }), -0.15, 1.2, 0.17); // badge
  for (const s of [-1, 1]) {
    partBox(g, 0.22, 0.7, 0.24, uniform, s * 0.15, 0.35, 0); // leg
    partBox(g, 0.16, 0.6, 0.18, uniform, s * 0.4, 1.08, 0); // arm
  }
  const gun = buildGunMesh('pistol');
  gun.group.scale.setScalar(1.15);
  gun.group.position.set(0.42, 1.0, 0.25);
  gun.group.rotation.x = -0.15;
  g.add(gun.group);
  return g;
}

export class Roadblocks {
  constructor(scene) {
    this.scene = scene;
    this.blocks = [];
    const barMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      for (let j = -1; j <= 1; j++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.5), j === 0 ? stripeMat : barMat);
        bar.position.set(j * 2.4, 0.7, 0);
        g.add(bar);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.5), barMat);
        leg.position.set(j * 2.4, 0.25, 0);
        g.add(leg);
      }
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      light.position.set(0, 1.6, 0);
      g.add(light);
      // Two foot officers manning the barrier, pistols in hand.
      for (const s of [-1, 1]) {
        const officer = buildOfficerMesh();
        officer.position.set(s * 4.4, 0, 1.6);
        officer.rotation.y = s * 0.5;
        g.add(officer);
      }
      g.visible = false;
      this.scene.add(g);
      this.blocks.push({ mesh: g, x: 0, z: 0, active: false, light });
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
