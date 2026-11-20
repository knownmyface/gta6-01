// CORAL HEAT v2.8 — boats and the bay. Drivable runners, a queen yacht and
// harbor patrol boats, with wake, bob and a marina full of moored hulls.
// The water is a place to play, not a backdrop.

import * as THREE from 'three';
import { makeRandom, clampVal, mix, headingGap, gap2d } from './rng.js';

export const HULLS = {
  runner: { name: 'REEF RUNNER', top: 34, accel: 20, turn: 1.9, color: 0xff6b4a, len: 5.2 },
  queen:  { name: 'CORAL QUEEN', top: 22, accel: 10, turn: 1.1, color: 0xf2ead8, len: 9.0 },
  dinghy: { name: 'BAY DINGHY',  top: 26, accel: 15, turn: 2.3, color: 0x2fd4c4, len: 4.0 },
  harbor: { name: 'PD HARBOR',   top: 30, accel: 18, turn: 2.0, color: 0x1a2a44, len: 6.0 },
};

export function makeHullMesh(kind) {
  const def = HULLS[kind];
  const g = new THREE.Group();
  g.name = 'hull-' + kind;
  const hullMat = new THREE.MeshPhongMaterial({ color: def.color, shininess: 80, specular: 0x666666 });
  const L = def.len;
  // hull: a stretched box with a wedge bow
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, L * 0.72), hullMat);
  hull.position.set(0, 0.45, -L * 0.12);
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.0, L * 0.34, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.55);
  bow.position.set(0, 0.45, L * 0.42);
  g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, L * 0.6), new THREE.MeshLambertMaterial({ color: 0xefe6d0 }));
  deck.position.set(0, 0.95, -L * 0.1);
  g.add(deck);
  if (kind === 'queen') {
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.5, 3.4),
      new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 60 }),
    );
    cabin.position.set(0, 1.8, -0.6);
    g.add(cabin);
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.5, 3.0),
      new THREE.MeshPhongMaterial({ color: 0x18242e, shininess: 160 }),
    );
    win.position.set(0, 2.0, -0.6);
    g.add(win);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 6), new THREE.MeshLambertMaterial({ color: 0x8a7a5a }));
    mast.position.set(0, 4.2, 1.4);
    g.add(mast);
  } else {
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.9), new THREE.MeshLambertMaterial({ color: 0x2c2c38 }));
    console_.position.set(0, 1.4, 0.2);
    g.add(console_);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.7), new THREE.MeshLambertMaterial({ color: 0x33404f }));
    seat.position.set(0, 1.25, -1.1);
    g.add(seat);
  }
  if (kind === 'harbor') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x14141c }));
    bar.position.set(0, 2.1, 0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.24, 2.24, 0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.24, 2.24, 0.2);
    g.add(blue);
    g.userData.flashRed = red;
    g.userData.flashBlue = blue;
  }
  // outboard motor at the stern
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.4), new THREE.MeshLambertMaterial({ color: 0x22222c }));
  motor.position.set(0, 0.5, -L * 0.5);
  g.add(motor);
  return g;
}

export class Hull {
  constructor(scene, kind, x, z, heading) {
    this.def = HULLS[kind];
    this.kind = kind;
    this.mesh = makeHullMesh(kind);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.bobPhase = Math.random() * 6;
    this.health = 100;
    this.wakeTimer = 0;
  }
  cruise(input, dt, t) {
    const d = this.def;
    const throttle = (input.up ? 1 : 0) - (input.down ? 0.5 : 0);
    const target = throttle * d.top;
    this.speed = mix(this.speed, target, 1 - Math.exp(-(d.accel / d.top) * dt));
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer = mix(this.steer, steerTarget, 1 - Math.exp(-6 * dt));
    // boats turn slower at speed and drift: heading follows with a lag
    const turnRate = this.steer * d.turn * clampVal(Math.abs(this.speed) / 12, 0.15, 1) * Math.sign(this.speed || 1);
    this.heading += turnRate * dt;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    // stay in the bay: soft-push back at the water's edge and the map bounds
    if (nx > -178 && this.speed > 0) {
      this.speed *= 0.4;
      this.heading += 0.6 * dt * (this.steer >= 0 ? 1 : -1);
    } else if (nx < -430 || Math.abs(nz) > 300) {
      this.heading += Math.PI * dt * 0.5;
    } else {
      this.x = nx;
      this.z = nz;
    }
    const bob = Math.sin(t * 1.6 + this.bobPhase) * 0.18 + Math.sin(t * 2.7 + this.bobPhase * 2) * 0.07;
    this.mesh.position.set(this.x, bob, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = -this.steer * 0.08 + Math.sin(t * 1.3 + this.bobPhase) * 0.02;
    this.mesh.rotation.x = Math.sin(t * 1.1 + this.bobPhase) * 0.02 - clampVal(this.speed / d.top, 0, 1) * 0.05;
    this.wakeTimer -= dt;
    return this.wakeTimer <= 0 && Math.abs(this.speed) > 8;
  }
  leaveWake() { this.wakeTimer = 0.12; }
}

// Moored boats sit in the marina slips; one of them is always stealable.
export class Mooring {
  constructor(scene, slips) {
    this.dice = makeRandom(31337);
    this.moored = [];
    this.scene = scene;
    for (const slip of slips) {
      const boat = new Hull(scene, slip.kind, slip.x, slip.z, slip.heading);
      boat.moored = true;
      this.moored.push(boat);
    }
    // a couple of yachts anchored further out for the skyline
    for (const [x, z] of [[-300, -60], [-320, 140], [-290, 220]]) {
      const yacht = new Hull(scene, 'queen', x, z, this.dice.range(0, 6.28));
      yacht.moored = true;
      yacht.anchored = true;
      this.moored.push(yacht);
    }
  }
  closestDocked(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const b of this.moored) {
      if (b.anchored) continue;
      const d = gap2d(x, z, b.x, b.z);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }
  update(dt, t) {
    for (const b of this.moored) {
      if (!b.moored) continue;
      const bob = Math.sin(t * 1.4 + b.bobPhase) * 0.14;
      b.mesh.position.y = bob;
      b.mesh.rotation.z = Math.sin(t * 1.1 + b.bobPhase) * 0.015;
    }
  }
  castOff(boat) {
    boat.moored = false;
    this.moored = this.moored.filter((b) => b !== boat);
    return boat;
  }
}

// Harbor patrol boats: the PD's answer to a getaway by water.
export class HarborWatch {
  constructor(scene) {
    this.scene = scene;
    this.dice = makeRandom(808);
    this.boats = [];
    this.spawnTimer = 0;
    this.stageHold = false; // staged screenshot: hold positions, spawn nothing
  }
  update(dt, px, pz, wanted, t) {
    if (this.stageHold) return;
    this.spawnTimer -= dt;
    const wantBoats = wanted >= 2 && px < -150 ? Math.min(2, wanted - 1) : 0;
    const active = this.boats.filter((b) => !b.staged).length;
    if (active < wantBoats && this.spawnTimer <= 0) {
      this.spawnTimer = 3;
      const b = new Hull(this.scene, 'harbor', px - 40, pz + this.dice.range(-30, 30), 0);
      this.boats.push(b);
    }
    for (const b of this.boats) {
      const wantHeading = Math.atan2(px - b.x, pz - b.z);
      b.heading += clampVal(headingGap(b.heading, wantHeading), -1.6 * dt, 1.6 * dt);
      b.speed = mix(b.speed, 26, 1 - Math.exp(-1.2 * dt));
      b.x += Math.sin(b.heading) * b.speed * dt;
      b.z += Math.cos(b.heading) * b.speed * dt;
      b.mesh.position.set(b.x, Math.sin(t * 1.6 + b.bobPhase) * 0.15, b.z);
      b.mesh.rotation.y = b.heading;
      const flash = Math.sin(t * 9) > 0;
      if (b.mesh.userData.flashRed) b.mesh.userData.flashRed.material.color.setHex(flash ? 0xff2020 : 0x551111);
      if (b.mesh.userData.flashBlue) b.mesh.userData.flashBlue.material.color.setHex(flash ? 0x2040ff : 0x111155);
    }
    if (wantBoats === 0) {
      const live = [];
      for (const b of this.boats) {
        if (b.staged) live.push(b);
        else this.scene.remove(b.mesh);
      }
      this.boats = live;
    }
  }
}
