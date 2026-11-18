// Vehicles for CORAL HEAT: procedural car meshes (no model files), arcade
// driving physics, traffic that follows the road grid, police pursuit cars
// and the police helicopter with its searchlight.
import * as THREE from 'three';
import { createRng, pick, range, clamp, angleLerp } from './rng.js';
import { ROAD_COORDS } from './city.js';

const CAR_COLORS = [0xd8d8e0, 0x2a2a30, 0x37b6ff, 0xffb347, 0x7dff9a, 0xff7ad9, 0xc9a06a, 0x5a8a6a, 0xb03a2e];

// Build one car from boxes and cylinders. type: sports | sedan | taxi | truck | van | police
export function buildCarMesh(type, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.15, metalness: 0.7 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.7 });
  const isTruck = type === 'truck';
  const isVan = type === 'van';
  const len = isTruck ? 6.4 : isVan ? 5.6 : type === 'sports' ? 4.6 : 4.4;
  const wid = isTruck || isVan ? 2.3 : 2.0;
  const bodyH = isTruck ? 1.5 : 0.85;

  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, bodyH, len), bodyMat);
  body.position.y = 0.62;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, 0.5, 0.9), bodyMat);
  nose.position.set(0, 0.5, len / 2 - 0.2);
  g.add(nose);

  if (isTruck) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.96, 1.5, 1.6), bodyMat);
    cab.position.set(0, 1.7, len / 2 - 1.4); g.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.9, 0.1), glassMat);
    shield.position.set(0, 1.85, len / 2 - 0.55); g.add(shield);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.7, len - 2.6), trimMat);
    bed.position.set(0, 1.5, -len / 2 + 1.6); g.add(bed);
  } else if (isVan) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.94, 1.3, len * 0.72), glassMat);
    cab.position.set(0, 1.5, -0.2); g.add(cab);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.86, 0.72, len * 0.48), glassMat);
    cabin.position.set(0, 1.35, type === 'sports' ? -0.25 : -0.1);
    g.add(cabin);
    if (type === 'sports') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.1, 0.5), trimMat);
      spoiler.position.set(0, 1.15, -len / 2 + 0.15); g.add(spoiler);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, len * 0.98), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
      stripe.position.set(0, 1.08, 0); g.add(stripe);
    }
  }

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [wx, wz] of [[-wid / 2, len / 2 - 1.1], [wid / 2, len / 2 - 1.1], [-wid / 2, -len / 2 + 1.1], [wid / 2, -len / 2 + 1.1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(w.position);
    g.add(w); g.add(hub);
    wheels.push(w);
  }

  // headlights + taillights
  const lightGeo = new THREE.BoxGeometry(0.42, 0.18, 0.08);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(lightGeo, headMat); h.position.set(s * wid * 0.32, 0.72, len / 2 + 0.02); g.add(h);
    const t = new THREE.Mesh(lightGeo, tailMat); t.position.set(s * wid * 0.32, 0.78, -len / 2 - 0.02); g.add(t);
  }

  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    sign.position.set(0, 1.95, -0.1); g.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.85, -0.1); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.32, 2.0, -0.1); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.32, 2.0, -0.1); g.add(blue);
    g.userData.lightBar = { red, blue };
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    door.position.set(wid / 2 + 0.01, 0.7, 0); g.add(door);
  }

  g.userData.wheels = wheels;
  g.userData.length = len;
  g.userData.width = wid;
  return g;
}

// --- arcade driving: one car state, shared by player + police + traffic ---
export function driveCar(car, dt, input, colliders, others) {
  // input: { throttle: -1..1, steer: -1..1, brake: bool }
  const maxSpeed = car.maxSpeed ?? 42;
  const accel = car.accel ?? 22;
  if (input.brake) car.speed = approach(car.speed, 0, 60 * dt);
  else {
    car.speed += input.throttle * accel * dt;
    if (input.throttle < 0) car.speed = Math.max(car.speed, -12);
    else car.speed = Math.min(car.speed, maxSpeed);
  }
  // drag + rolling resistance
  car.speed -= car.speed * 0.25 * dt;
  if (Math.abs(car.speed) < 0.15 && input.throttle === 0) car.speed = 0;
  const steerAuthority = clamp(Math.abs(car.speed) / 12, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += input.steer * 1.9 * steerAuthority * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collideCircle(nx, nz, 1.5, colliders);
  if (hit) {
    // slide along the wall: keep the axis that is free
    if (!collideCircle(nx, car.z, 1.5, colliders)) car.x = nx;
    else if (!collideCircle(car.x, nz, 1.5, colliders)) car.z = nz;
    car.speed *= 0.55;
    car.crashed = true;
  } else {
    car.x = nx; car.z = nz;
    car.crashed = false;
  }
  // soft car-car push
  for (const o of others) {
    if (o === car || o.dead) continue;
    const dx = car.x - o.x, dz = car.z - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 9 && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (3 - d) * 0.5;
      car.x += (dx / d) * push; car.z += (dz / d) * push;
      car.speed *= 0.9;
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return car;
}

function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

export function collideCircle(x, z, r, colliders) {
  for (const c of colliders) {
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return c;
  }
  return null;
}

// --- traffic: cars looping the road grid, right-hand lanes ---
export class Traffic {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = rng;
    this.cars = [];
    this.types = ['sedan', 'sedan', 'taxi', 'van', 'truck', 'sports'];
  }

  spawn(n, avoid) {
    for (let i = 0; i < n; i++) {
      const type = pick(this.rng, this.types);
      const color = type === 'taxi' ? 0xffd23e : pick(this.rng, CAR_COLORS);
      const mesh = buildCarMesh(type, color);
      this.scene.add(mesh);
      const road = pick(this.rng, ROAD_COORDS);
      const along = range(this.rng, -170, 170);
      const ns = this.rng() < 0.5;
      const lane = this.rng() < 0.5 ? 2.2 : -2.2;
      const car = {
        mesh, type,
        x: ns ? road + lane : along,
        z: ns ? along : road + lane,
        heading: ns ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2),
        speed: range(this.rng, 7, 13),
        maxSpeed: range(this.rng, 10, 15),
        accel: 8, crashed: false, dead: false,
      };
      if (avoid && Math.hypot(car.x - avoid.x, car.z - avoid.z) < 25) { this.scene.remove(mesh); continue; }
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      this.cars.push(car);
    }
  }

  update(dt, player) {
    for (const car of this.cars) {
      if (car.dead) continue;
      // slow for the car ahead
      let target = car.maxSpeed;
      for (const o of this.cars) {
        if (o === car || o.dead) continue;
        const dx = o.x - car.x, dz = o.z - car.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 10 && side < 2.5) { target = 0; break; }
      }
      if (player && player.inCar) {
        const dx = player.car.x - car.x, dz = player.car.z - car.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 2.5) target = 0;
      }
      car.speed = approach(car.speed, target, 10 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      // at an intersection, maybe turn
      const nearX = ROAD_COORDS.reduce((a, b) => Math.abs(b - nx) < Math.abs(a - nx) ? b : a, ROAD_COORDS[0]);
      const nearZ = ROAD_COORDS.reduce((a, b) => Math.abs(b - nz) < Math.abs(a - nz) ? b : a, ROAD_COORDS[0]);
      const atX = Math.abs(nx - nearX) < 0.6;
      const atZ = Math.abs(nz - nearZ) < 0.6;
      if ((atX && Math.abs(Math.sin(car.heading)) < 0.1) || (atZ && Math.abs(Math.cos(car.heading)) < 0.1)) {
        const r = this.rng();
        const turn = r < 0.25 ? -Math.PI / 2 : r < 0.5 ? Math.PI / 2 : 0;
        if (turn !== 0) {
          const lane = 2.2;
          const nh = car.heading + turn;
          // snap onto the new road's lane
          if (Math.abs(Math.sin(nh)) < 0.1) { car.x = nearX + (nh === 0 ? lane : -lane); car.z = nearZ; }
          else { car.z = nearZ + (nh === Math.PI / 2 ? lane : -lane); car.x = nearX; }
          car.heading = nh;
        }
      }
      // stay inside the city; bounce at the edge roads
      if (nx > 175 || nx < -175 || nz > 175 || nz < -175) car.heading += Math.PI;
      car.x = nx; car.z = nz;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt * 2.4;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
  }

  nearest(x, z, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const car of this.cars) {
      if (car.dead) continue;
      const d = (car.x - x) ** 2 + (car.z - z) ** 2;
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  remove(car) {
    car.dead = true;
    this.scene.remove(car.mesh);
  }
}

// --- police: pursuit cars + helicopter ---
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
    return wanted <= 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 4 : 5;
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
    car.x = clamp(car.x, -175, 175); car.z = clamp(car.z, -175, 175);
    mesh.position.set(car.x, 0, car.z);
    this.cars.push(car);
    return car;
  }

  spawnHeli() {
    if (this.heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 }));
    body.position.y = 0; g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.6), new THREE.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.1, metalness: 0.8 }));
    glass.position.set(0, 0.2, 2.0); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4 }));
    tail.position.set(0, 0.3, -4.2); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    rotor.position.y = 1.1; g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    tailRotor.position.set(0.4, 0.4, -6.2); g.add(tailRotor);
    const skids = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 3.6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    skids.position.y = -1.1; g.add(skids);
    const coneGeo = new THREE.ConeGeometry(7, 42, 16, 1, true);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    cone.rotation.x = Math.PI; cone.position.y = -22; g.add(cone);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.3, depthWrite: false }));
    spot.rotation.x = -Math.PI / 2; spot.position.y = -41.5; g.add(spot);
    g.userData.rotor = rotor;
    g.userData.tailRotor = tailRotor;
    g.userData.spot = spot;
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
    if (wanted >= 3) this.spawnHeli(); else this.removeHeli();

    for (const car of this.cars) {
      // pursuit steering: aim at the player, ram when close
      const dx = p.x - car.x, dz = p.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      const steer = clamp(((targetHeading - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
      const throttle = dist > 4 ? 1 : 0.4;
      driveCar(car, dt, { throttle, steer: clamp(steer * 2.2, -1, 1), brake: false }, this.colliders, others);
      // light bar flash
      const lb = car.mesh.userData.lightBar;
      if (lb) {
        const phase = Math.floor(performance.now() / 180) % 2 === 0;
        lb.red.material.color.setHex(phase ? 0xff2020 : 0x550000);
        lb.blue.material.color.setHex(phase ? 0x101040 : 0x2040ff);
      }
      // bumping the player slows them
      if (dist < 3.4 && player.inCar) player.car.speed *= 0.985;
    }

    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.55;
      const r = 26;
      h.x = p.x + Math.cos(h.angle) * r;
      h.z = p.z + Math.sin(h.angle) * r;
      h.mesh.position.set(h.x, 42 + Math.sin(h.angle * 2) * 1.5, h.z);
      h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
      h.mesh.userData.rotor.rotation.y += dt * 22;
      h.mesh.userData.tailRotor.rotation.x += dt * 30;
      h.mesh.userData.spot.position.set(p.x - h.x, -41.5, p.z - h.z);
    }
  }
}

// --- roadblocks: police barriers that appear ahead of the player at high wanted ---
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
        bar.position.set(j * 2.4, 0.7, 0); g.add(bar);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.5), barMat);
        leg.position.set(j * 2.4, 0.25, 0); g.add(leg);
      }
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      light.position.set(0, 1.6, 0); g.add(light);
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

  clear() { for (const b of this.blocks) { b.mesh.visible = false; b.active = false; } }

  hitTest(x, z) {
    for (const b of this.blocks) {
      if (!b.active) continue;
      if (Math.hypot(x - b.x, z - b.z) < 3.6) return b;
    }
    return null;
  }
}
