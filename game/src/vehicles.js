// Coral Heat — everything with wheels: the player's rides, street traffic, the
// Coral Bay PD pursuit, roadblocks and the police helicopter "Air One".

import * as THREE from 'three';
import { makeDice, clamp, lerp, angleGap, dist2d } from './rng.js';

// Original Coral Bay rides — nothing borrowed from any commercial game.
export const RIDE_DEFS = {
  comet:   { name: 'COMET GT',      top: 46, accel: 26, grip: 2.6, color: 0xff5a3c, sport: true },
  sting:   { name: 'STINGRAY S',    top: 42, accel: 23, grip: 2.4, color: 0x2fd4c4, sport: true },
  sedan:   { name: 'CORAL SEDAN',   top: 32, accel: 16, grip: 2.0, color: 0xe8dcc0, sport: false },
  taxi:    { name: 'BAY TAXI',      top: 33, accel: 17, grip: 2.0, color: 0xffc93c, sport: false },
  pickup:  { name: 'DUNE PICKUP',   top: 34, accel: 18, grip: 1.9, color: 0x7a9e4d, sport: false },
  van:     { name: 'REEF VAN',      top: 28, accel: 13, grip: 1.8, color: 0x8a7fb8, sport: false },
  cruiser: { name: 'PD CRUISER',    top: 40, accel: 24, grip: 2.7, color: 0xf2f2f2, sport: true },
};

function buildCarMesh(kind, dice) {
  const def = RIDE_DEFS[kind];
  const g = new THREE.Group();
  g.name = 'ride-' + kind;
  const paint = new THREE.MeshPhongMaterial({ color: def.color, shininess: 90, specular: 0x888888 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x18242e, shininess: 140, specular: 0xffffff });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.15, -0.25);
  g.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.5), paint);
  nose.position.set(0, 0.5, 2.35);
  g.add(nose);
  // headlights + taillights so the chase reads at dusk
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hl);
    lamp.position.set(s, 0.62, 2.62);
    g.add(lamp);
  }
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const s of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tl);
    lamp.position.set(s, 0.66, -2.24);
    g.add(lamp);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141c });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  if (kind === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
    bar.position.set(0, 1.52, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 1.64, -0.25);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.52), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.28, 1.64, -0.25);
    g.add(blue);
    g.userData.flashRed = red;
    g.userData.flashBlue = blue;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
    stripe.position.y = 0.72;
    g.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    sign.position.set(0, 1.55, -0.25);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Ride {
  constructor(scene, kind, x, z, heading, dice) {
    this.def = RIDE_DEFS[kind];
    this.kind = kind;
    this.mesh = buildCarMesh(kind, dice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0;
    this.health = 100; this.smoke = 0;
    this.driver = null; // pedestrian mesh standing in for the driver during a carjack
  }
  get pos() { return { x: this.x, z: this.z }; }
  drive(input, dt, world) {
    const d = this.def;
    const throttle = (input.up ? 1 : 0) - (input.down ? 0.6 : 0);
    const target = throttle * d.top;
    this.speed = dampTo(this.speed, target, d.accel / d.top, dt);
    if (input.brake) this.speed = dampTo(this.speed, 0, 6, dt);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer = lerp(this.steer, steerTarget, 1 - Math.exp(-8 * dt));
    const turnRate = this.steer * d.grip * clamp(Math.abs(this.speed) / 14, 0, 1) * Math.sign(this.speed || 1);
    this.heading += turnRate * dt;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    if (!world.blocked(nx, nz, 1.6) && nx > WATER_EDGE_LAND) {
      this.x = nx; this.z = nz;
    } else {
      this.speed *= 0.35; // bump: scrape speed off, no full stop
      this.health = Math.max(0, this.health - Math.abs(this.speed) * 0.12);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = -this.steer * 0.05 * clamp(this.speed / 20, -1, 1);
    const spin = this.speed * dt * 2.6;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    if (this.health < 45) this.smoke += dt;
  }
}

const WATER_EDGE_LAND = -154;
function dampTo(v, target, lambda, dt) {
  return lerp(v, target, 1 - Math.exp(-lambda * dt));
}

// --- traffic: ordinary Coral Bay drivers looping the road grid ---
export class Traffic {
  constructor(scene, world) {
    this.dice = makeDice(4451);
    this.cars = [];
    this.world = world;
    const kinds = ['sedan', 'taxi', 'pickup', 'van', 'sedan', 'pickup'];
    for (let i = 0; i < 14; i++) {
      const kind = kinds[i % kinds.length];
      const road = this.dice.pick(world.roads.filter((v) => v >= -140));
      const along = this.dice.span(-240, 240);
      const vertical = this.dice.chance(0.5);
      const x = vertical ? road : along;
      const z = vertical ? along : road;
      const ride = new Ride(scene, kind, x, z, vertical ? (this.dice.chance(0.5) ? 0 : Math.PI) : (this.dice.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), this.dice);
      ride.speed = ride.def.top * this.dice.span(0.45, 0.7);
      ride.cruise = ride.speed;
      this.cars.push({ ride, vertical, road, dir: this.dice.chance(0.5) ? 1 : -1, wait: 0 });
    }
  }
  nearestStealable(x, z, maxD) {
    let best = null, bestD = maxD;
    for (const c of this.cars) {
      const d = dist2d(x, z, c.ride.x, c.ride.z);
      if (d < bestD) { bestD = d; best = c.ride; }
    }
    return best;
  }
  update(dt, playerX, playerZ) {
    for (const c of this.cars) {
      const r = c.ride;
      // ease off when the player is right in front (no murder-traffic)
      const ahead = dist2d(playerX, playerZ, r.x + Math.sin(r.heading) * 8, r.z + Math.cos(r.heading) * 8);
      const target = ahead < 9 ? 0 : r.cruise;
      r.speed = dampTo(r.speed, target, 1.2, dt);
      const nx = r.x + Math.sin(r.heading) * r.speed * dt;
      const nz = r.z + Math.cos(r.heading) * r.speed * dt;
      if (this.world.blocked(nx, nz, 1.6) || Math.abs(nx) > 258 || Math.abs(nz) > 258) {
        // reached the end of the road: turn around at the next junction
        r.heading += Math.PI / 2;
        r.heading = Math.round(r.heading / (Math.PI / 2)) * (Math.PI / 2);
      } else {
        r.x = nx; r.z = nz;
      }
      r.mesh.position.set(r.x, 0, r.z);
      r.mesh.rotation.y = r.heading;
      const spin = r.speed * dt * 2.6;
      for (const w of r.mesh.userData.wheels) w.rotation.x += spin;
    }
  }
}

// --- the PD: wanted stars, pursuit cruisers, roadblocks, Air One ---
export class PoliceDirector {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.dice = makeDice(777);
    this.wanted = 0;
    this.heat = 0;          // 0..100, decays when unseen
    this.cruisers = [];
    this.blocks = [];
    this.heli = null;
    this.heliAngle = 0;
    this.spawnTimer = 0;
    this.blockTimer = 0;
    this.sirenPhase = 0;
    this.stageHold = false; // staged screenshot: hold every position, flash only
  }
  addHeat(n) {
    this.heat = clamp(this.heat + n, 0, 100);
    const next = this.heat < 12 ? 0 : this.heat < 28 ? 1 : this.heat < 45 ? 2 : this.heat < 65 ? 3 : this.heat < 85 ? 4 : 5;
    if (next !== this.wanted) {
      this.wanted = next;
      return true; // caller flashes the HUD
    }
    return false;
  }
  wantedLabel() {
    return ['CLEAR', 'SUSPICIOUS', 'PURSUIT', 'MANHUNT', 'LOCKDOWN', 'MAXIMUM HEAT'][this.wanted];
  }
  buildHeli() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a2a44, shininess: 60 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 5.2), bodyMat);
    body.position.y = 0;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.6), new THREE.MeshPhongMaterial({ color: 0x9fd8e8, shininess: 160 }));
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
    // spawn pursuit cruisers up to the wanted level
    this.spawnTimer -= dt;
    const wantCruisers = this.wanted === 0 ? 0 : this.wanted + 1;
    if (this.cruisers.length < wantCruisers && this.spawnTimer <= 0) {
      this.spawnTimer = 2.2;
      const a = this.dice.span(0, Math.PI * 2);
      const ride = new Ride(this.scene, 'cruiser', px + Math.sin(a) * 55, pz + Math.cos(a) * 55, a, this.dice);
      this.cruisers.push(ride);
    }
    // cruisers hunt: steer toward the player, ram speed slightly above traffic
    for (const c of this.cruisers) {
      const wantHeading = Math.atan2(px - c.x, pz - c.z);
      c.heading += clamp(angleGap(c.heading, wantHeading), -2.4 * dt, 2.4 * dt);
      const target = 30 + this.wanted * 2.5;
      c.speed = dampTo(c.speed, target, 1.4, dt);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      if (!this.world.blocked(nx, nz, 1.6)) { c.x = nx; c.z = nz; }
      else c.speed *= 0.5;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      this.flashBar(c, t);
      // caught the player: bump heat back up, shove the player ride
      if (dist2d(px, pz, c.x, c.z) < 3.4) this.heat = clamp(this.heat + dt * 6, 0, 100);
    }
    // roadblocks at 4+ stars: two cruisers parked across the road ahead
    this.blockTimer -= dt;
    if (this.wanted >= 4 && this.blocks.length === 0 && this.blockTimer <= 0) {
      this.blockTimer = 14;
      for (const s of [-1, 1]) {
        const b = new Ride(this.scene, 'cruiser', px + 26 + s * 0, pz + 18 * s, Math.PI / 2, this.dice);
        b.speed = 0;
        this.blocks.push(b);
      }
    }
    if (this.wanted < 4) {
      for (const b of this.blocks) this.scene.remove(b.mesh);
      this.blocks = [];
    }
    // Air One circles overhead at 3+ stars
    if (this.wanted >= 3 && !this.heli) this.heli = this.buildHeli();
    if (this.wanted < 3 && this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (this.heli) {
      this.heliAngle += dt * 0.35;
      const hx = px + Math.cos(this.heliAngle) * 26;
      const hz = pz + Math.sin(this.heliAngle) * 26;
      this.heli.position.set(hx, 34 + Math.sin(t * 0.7) * 1.5, hz);
      this.heli.rotation.y = Math.atan2(px - hx, pz - hz);
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heli.userData.beam.lookAt(px, 0, pz);
    }
  }
  clearPursuit() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = [];
    for (const b of this.blocks) this.scene.remove(b.mesh);
    this.blocks = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
    this.wanted = 0; this.heat = 0;
  }
}
