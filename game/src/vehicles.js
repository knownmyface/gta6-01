// CORAL HEAT v2.8 — everything with wheels: the player's cars, street
// traffic, the Coral Bay PD pursuit, roadblocks and the police helicopter
// "Air One". Plus nitro: hold Shift in a car for a short burst of speed.
// Car bodies are built from a parts table so every model shares one builder.

import * as THREE from 'three';
import { makeRandom, clampVal, mix, easeTo, headingGap, gap2d } from './rng.js';

// Original Coral Bay cars — nothing borrowed from any commercial game.
export const CAR_DEFS = {
  flare:       { name: 'FLARE GT',      top: 48, accel: 28, grip: 2.7, color: 0xff4d2e, sport: true },
  ray:         { name: 'RAY S',         top: 44, accel: 25, grip: 2.5, color: 0x19c8b8, sport: true },
  sedan:       { name: 'CORAL SEDAN',   top: 32, accel: 16, grip: 2.0, color: 0xe8dcc0, sport: false },
  cab:         { name: 'BAY CAB',       top: 33, accel: 17, grip: 2.0, color: 0xffc93c, sport: false },
  hauler:      { name: 'DUNE HAULER',   top: 35, accel: 18, grip: 1.9, color: 0x7a9e4d, sport: false },
  carrier:     { name: 'REEF CARRIER',  top: 28, accel: 13, grip: 1.8, color: 0x8a7fb8, sport: false },
  interceptor: { name: 'PD INTERCEPTOR', top: 42, accel: 25, grip: 2.8, color: 0xf2f2f2, sport: true },
};

const LAND_LINE = -154; // cars stay east of the beach
const WHEEL_SPOTS = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function makeCarMesh(kind) {
  const def = CAR_DEFS[kind];
  const g = new THREE.Group();
  g.name = 'car-' + kind;
  const paint = new THREE.MeshPhongMaterial({ color: def.color, shininess: 90, specular: 0x888888 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x18242e, shininess: 140, specular: 0xffffff });
  // body, cabin, nose — one table, no repeated constructors
  const parts = [
    [2.0, 0.62, 4.4, paint, 0, 0.62, 0],
    [1.7, 0.55, 2.1, glass, 0, 1.15, -0.25],
    [1.9, 0.34, 0.5, paint, 0, 0.5, 2.35],
  ];
  for (const [w, h, d, mat, x, y, z] of parts) g.add(box(w, h, d, mat, x, y, z));
  // headlights + taillights so the chase reads at dusk
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const s of [-0.65, 0.65]) {
    g.add(box(0.42, 0.16, 0.08, headMat, s, 0.62, 2.62));
    g.add(box(0.42, 0.16, 0.08, tailMat, s, 0.66, -2.24));
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141c });
  const wheels = [];
  for (const [wx, wz] of WHEEL_SPOTS) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  if (def.sport && kind !== 'interceptor') {
    g.add(box(1.9, 0.08, 0.5, paint, 0, 1.05, -2.1)); // rear wing
  }
  if (kind === 'interceptor') {
    const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
    g.add(box(1.1, 0.22, 0.5, dark, 0, 1.52, -0.25));
    const red = box(0.5, 0.16, 0.52, new THREE.MeshBasicMaterial({ color: 0xff2020 }), -0.28, 1.64, -0.25);
    const blue = box(0.5, 0.16, 0.52, new THREE.MeshBasicMaterial({ color: 0x2040ff }), 0.28, 1.64, -0.25);
    g.add(red);
    g.add(blue);
    g.userData.flashRed = red;
    g.userData.flashBlue = blue;
    g.add(box(2.02, 0.2, 4.42, new THREE.MeshLambertMaterial({ color: 0x1a2a44 }), 0, 0.72, 0));
  }
  if (kind === 'cab') {
    g.add(box(0.7, 0.22, 0.4, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), 0, 1.55, -0.25));
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(scene, kind, x, z, heading) {
    this.def = CAR_DEFS[kind];
    this.kind = kind;
    this.mesh = makeCarMesh(kind);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.smoke = 0;
    this.nitro = 1; // 0..1, refills when not boosting
    this.boosting = false;
    this.driver = null; // pedestrian mesh standing in for the driver during a theft
  }
  get pos() { return { x: this.x, z: this.z }; }
  roll(input, dt, world) {
    const d = this.def;
    const throttle = (input.up ? 1 : 0) - (input.down ? 0.6 : 0);
    // nitro: Shift burns the meter for +28% top speed, then it refills
    this.boosting = !!input.sprint && this.nitro > 0.05 && throttle > 0;
    this.nitro = this.boosting
      ? Math.max(0, this.nitro - dt * 0.34)
      : Math.min(1, this.nitro + dt * 0.12);
    const top = d.top * (this.boosting ? 1.28 : 1);
    this.speed = easeTo(this.speed, throttle * top, d.accel / d.top, dt);
    if (input.brake) this.speed = easeTo(this.speed, 0, 6, dt);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer = mix(this.steer, steerTarget, 1 - Math.exp(-8 * dt));
    const turnRate = this.steer * d.grip * clampVal(Math.abs(this.speed) / 14, 0, 1) * Math.sign(this.speed || 1);
    this.heading += turnRate * dt;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    if (!world.solid(nx, nz, 1.6) && nx > LAND_LINE) {
      this.x = nx;
      this.z = nz;
    } else {
      this.speed *= 0.35; // bump: scrape speed off, no full stop
      this.health = Math.max(0, this.health - Math.abs(this.speed) * 0.12);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = -this.steer * 0.05 * clampVal(this.speed / 20, -1, 1);
    const spin = this.speed * dt * 2.6;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    if (this.health < 45) this.smoke += dt;
  }
}

// --- traffic: ordinary Coral Bay drivers looping the road grid ---
export class StreetTraffic {
  constructor(scene, world) {
    this.dice = makeRandom(4451);
    this.cars = [];
    this.world = world;
    this.spawnAll(scene);
  }
  spawnAll(scene) {
    const kinds = ['sedan', 'cab', 'hauler', 'carrier', 'sedan', 'hauler'];
    const openRoads = this.world.roads.filter((v) => v >= -140);
    for (let i = 0; i < 14; i++) {
      const kind = kinds[i % kinds.length];
      const road = this.dice.choose(openRoads);
      const along = this.dice.range(-240, 240);
      const vertical = this.dice.odds(0.5);
      const x = vertical ? road : along;
      const z = vertical ? along : road;
      const heading = vertical
        ? (this.dice.odds(0.5) ? 0 : Math.PI)
        : (this.dice.odds(0.5) ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car(scene, kind, x, z, heading);
      car.speed = car.def.top * this.dice.range(0.45, 0.7);
      car.cruise = car.speed;
      this.cars.push({ car, vertical, road, dir: this.dice.flip(), wait: 0 });
    }
  }
  closestStealable(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of this.cars) {
      const d = gap2d(x, z, c.car.x, c.car.z);
      if (d < bestD) { bestD = d; best = c.car; }
    }
    return best;
  }
  update(dt, playerX, playerZ) {
    for (const c of this.cars) {
      const r = c.car;
      // ease off when the player is right in front (no murder-traffic)
      const ahead = gap2d(playerX, playerZ, r.x + Math.sin(r.heading) * 8, r.z + Math.cos(r.heading) * 8);
      const target = ahead < 9 ? 0 : r.cruise;
      r.speed = easeTo(r.speed, target, 1.2, dt);
      const nx = r.x + Math.sin(r.heading) * r.speed * dt;
      const nz = r.z + Math.cos(r.heading) * r.speed * dt;
      if (this.world.solid(nx, nz, 1.6) || Math.abs(nx) > 258 || Math.abs(nz) > 258) {
        // reached the end of the road: turn around at the next junction
        r.heading += Math.PI / 2;
        r.heading = Math.round(r.heading / (Math.PI / 2)) * (Math.PI / 2);
      } else {
        r.x = nx;
        r.z = nz;
      }
      r.mesh.position.set(r.x, 0, r.z);
      r.mesh.rotation.y = r.heading;
      const spin = r.speed * dt * 2.6;
      for (const w of r.mesh.userData.wheels) w.rotation.x += spin;
    }
  }
}

// --- the PD: wanted stars, pursuit interceptors, roadblocks, Air One ---
export class Pursuit {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.dice = makeRandom(777);
    this.wanted = 0;
    this.heat = 0; // 0..100, decays when the player keeps clean
    this.cruisers = [];
    this.blocks = [];
    this.heli = null;
    this.heliAngle = 0;
    this.spawnTimer = 0;
    this.blockTimer = 0;
    this.sirenPhase = 0;
    this.stageHold = false; // staged screenshot: hold every position, flash only
  }
  raiseHeat(n) {
    this.heat = clampVal(this.heat + n, 0, 100);
    const next = this.heat < 12 ? 0 : this.heat < 28 ? 1 : this.heat < 45 ? 2 : this.heat < 65 ? 3 : this.heat < 85 ? 4 : 5;
    if (next !== this.wanted) {
      this.wanted = next;
      return true; // caller flashes the HUD
    }
    return false;
  }
  heatWord() {
    return ['CLEAR', 'SUSPICIOUS', 'PURSUIT', 'MANHUNT', 'LOCKDOWN', 'MAXIMUM HEAT'][this.wanted];
  }
  makeHeli() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a2a44, shininess: 60 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 5.2), bodyMat);
    g.add(body);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.0, 1.6),
      new THREE.MeshPhongMaterial({ color: 0x9fd8e8, shininess: 160 }),
    );
    glass.position.set(0, 0.2, 2.0);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5.5), bodyMat);
    tail.position.set(0, 0.3, -4.6);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 1.2), bodyMat);
    fin.position.set(0, 1.0, -7.0);
    g.add(fin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x22222c }));
    rotor.position.y = 1.1;
    g.add(rotor);
    g.userData.rotor = rotor;
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(7, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = -13;
    beam.rotation.x = Math.PI;
    g.add(beam);
    g.userData.beam = beam;
    this.scene.add(g);
    return g;
  }
  flashBar(c, t) {
    const flash = Math.sin(t * 9) > 0;
    if (c.mesh.userData.flashRed) c.mesh.userData.flashRed.material.color.setHex(flash ? 0xff2020 : 0x551111);
    if (c.mesh.userData.flashBlue) c.mesh.userData.flashBlue.material.color.setHex(flash ? 0x2040ff : 0x111155);
  }
  spawnCruiser(px, pz) {
    const a = this.dice.range(0, Math.PI * 2);
    const car = new Car(this.scene, 'interceptor', px + Math.sin(a) * 55, pz + Math.cos(a) * 55, a);
    this.cruisers.push(car);
  }
  spawnBlock(px, pz) {
    for (const s of [-1, 1]) {
      const b = new Car(this.scene, 'interceptor', px + 26, pz + 18 * s, Math.PI / 2);
      b.speed = 0;
      this.blocks.push(b);
    }
  }
  updateHeli(dt, px, pz, t) {
    if (this.wanted >= 3 && !this.heli) this.heli = this.makeHeli();
    if (this.wanted < 3 && this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (!this.heli) return;
    this.heliAngle += dt * 0.35;
    const hx = px + Math.cos(this.heliAngle) * 26;
    const hz = pz + Math.sin(this.heliAngle) * 26;
    this.heli.position.set(hx, 34 + Math.sin(t * 0.7) * 1.5, hz);
    this.heli.rotation.y = Math.atan2(px - hx, pz - hz);
    this.heli.userData.rotor.rotation.y += dt * 22;
    this.heli.userData.beam.lookAt(px, 0, pz);
  }
  update(dt, px, pz, playerSpeed, t) {
    this.sirenPhase += dt;
    if (this.stageHold) {
      // staged still: light bars flash, the rotor spins, nobody moves
      for (const c of this.cruisers) this.flashBar(c, t);
      for (const b of this.blocks) this.flashBar(b, t);
      if (this.heli) this.heli.userData.rotor.rotation.y += dt * 22;
      return;
    }
    // heat decays when the player keeps their nose clean
    if (this.wanted > 0) this.heat = Math.max(0, this.heat - dt * (this.wanted >= 3 ? 0.55 : 1.6));
    if (this.heat <= 0 && this.wanted > 0) this.wanted = 0;
    // spawn pursuit interceptors up to the wanted level
    this.spawnTimer -= dt;
    const wantCruisers = this.wanted === 0 ? 0 : this.wanted + 1;
    if (this.cruisers.length < wantCruisers && this.spawnTimer <= 0) {
      this.spawnTimer = 2.2;
      this.spawnCruiser(px, pz);
    }
    // interceptors hunt: steer toward the player, ram speed slightly above traffic
    for (const c of this.cruisers) {
      const wantHeading = Math.atan2(px - c.x, pz - c.z);
      c.heading += clampVal(headingGap(c.heading, wantHeading), -2.4 * dt, 2.4 * dt);
      const target = 30 + this.wanted * 2.5;
      c.speed = easeTo(c.speed, target, 1.4, dt);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      if (!this.world.solid(nx, nz, 1.6)) { c.x = nx; c.z = nz; }
      else c.speed *= 0.5;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      this.flashBar(c, t);
      // caught the player: bump heat back up
      if (gap2d(px, pz, c.x, c.z) < 3.4) this.heat = clampVal(this.heat + dt * 6, 0, 100);
    }
    // roadblocks at 4+ stars: two interceptors parked across the road ahead
    this.blockTimer -= dt;
    if (this.wanted >= 4 && this.blocks.length === 0 && this.blockTimer <= 0) {
      this.blockTimer = 14;
      this.spawnBlock(px, pz);
    }
    if (this.wanted < 4) {
      for (const b of this.blocks) this.scene.remove(b.mesh);
      this.blocks = [];
    }
    // Air One circles overhead at 3+ stars
    this.updateHeli(dt, px, pz, t);
  }
  standDown() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = [];
    for (const b of this.blocks) this.scene.remove(b.mesh);
    this.blocks = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
    this.wanted = 0;
    this.heat = 0;
  }
}
