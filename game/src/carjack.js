// CORAL HEAT v2.8 — the carjacking scene. Stealing a car is a visible moment,
// not a teleport. Kai walks up, yanks the door, drags the driver out, and the
// driver stumbles away while Kai slides in. The whole beat takes about two
// seconds and the camera stays on it.

import * as THREE from 'three';
import { clampVal, mix } from './rng.js';

export const THEFT_PHASES = {
  IDLE: 'idle',
  APPROACH: 'approach', // Kai closes the last steps to the door
  YANK: 'yank',         // door swings, driver is grabbed
  DRAG: 'drag',         // driver pulled out, stumbles to the sidewalk
  SLIDE: 'slide',       // Kai slides into the seat
  DONE: 'done',
};

export class TheftScene {
  constructor(scene) {
    this.scene = scene;
    this.phase = THEFT_PHASES.IDLE;
    this.timer = 0;
    this.car = null;
    this.victim = null; // pedestrian mesh playing the driver
    this.onDone = null;
    this.onPhase = null; // HUD hook: (phase, text) => void
  }
  get active() { return this.phase !== THEFT_PHASES.IDLE && this.phase !== THEFT_PHASES.DONE; }

  start(car, victimMesh, hero, onDone) {
    this.car = car;
    this.victim = victimMesh;
    this.onDone = onDone;
    this.phase = THEFT_PHASES.APPROACH;
    this.timer = 0;
    this.hero = hero;
    this.startX = hero.x;
    this.startZ = hero.z;
    // door target: driver's side of the car
    const dx = Math.cos(car.heading);
    const dz = -Math.sin(car.heading);
    this.doorX = car.x - dx * 1.25;
    this.doorZ = car.z - dz * 1.25;
    this.announce(THEFT_PHASES.APPROACH, 'Closing in…');
  }
  announce(phase, text) {
    if (this.onPhase) this.onPhase(phase, text);
  }
  abort() {
    this.phase = THEFT_PHASES.IDLE;
    this.car = null;
    this.victim = null;
  }
  tick(dt) {
    if (!this.active) return;
    this.timer += dt;
    const w = this.hero;
    const r = this.car;
    if (this.phase === THEFT_PHASES.APPROACH) {
      // walk Kai to the door in a straight line
      const dx = this.doorX - w.x;
      const dz = this.doorZ - w.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const step = Math.min(d, 5.5 * dt);
        w.x += (dx / d) * step;
        w.z += (dz / d) * step;
        w.heading = Math.atan2(dx, dz);
        w.mesh.position.set(w.x, 0, w.z);
        w.mesh.rotation.y = w.heading;
      } else if (this.timer > 0.35) {
        this.phase = THEFT_PHASES.YANK;
        this.timer = 0;
        this.announce(THEFT_PHASES.YANK, 'YANK THE DOOR!');
      }
    } else if (this.phase === THEFT_PHASES.YANK) {
      // Kai leans in; the car rocks on its suspension
      r.mesh.rotation.z = Math.sin(this.timer * 18) * 0.05;
      r.mesh.position.y = Math.abs(Math.sin(this.timer * 18)) * 0.08;
      w.mesh.rotation.y = r.heading + Math.PI / 2;
      if (this.timer > 0.55) {
        this.phase = THEFT_PHASES.DRAG;
        this.timer = 0;
        this.announce(THEFT_PHASES.DRAG, 'OUT! OUT! OUT!');
      }
    } else if (this.phase === THEFT_PHASES.DRAG) {
      // driver mesh slides out of the car and stumbles away
      if (this.victim) {
        const t = clampVal(this.timer / 0.8, 0, 1);
        const sx = r.x - Math.cos(r.heading) * 1.25;
        const sz = r.z + Math.sin(r.heading) * 1.25;
        const ex = sx - Math.cos(r.heading) * 2.6;
        const ez = sz + Math.sin(r.heading) * 2.6;
        this.victim.position.set(mix(sx, ex, t), 0, mix(sz, ez, t));
        this.victim.rotation.y = r.heading;
        this.victim.rotation.z = Math.sin(t * Math.PI) * 0.5; // stumble
        this.victim.visible = true;
      }
      r.mesh.rotation.z = 0;
      r.mesh.position.y = 0;
      if (this.timer > 0.85) {
        this.phase = THEFT_PHASES.SLIDE;
        this.timer = 0;
        this.announce(THEFT_PHASES.SLIDE, 'GO GO GO!');
      }
    } else if (this.phase === THEFT_PHASES.SLIDE) {
      // Kai slides into the seat and the hero mesh hides inside the car
      const t = clampVal(this.timer / 0.4, 0, 1);
      w.x = mix(this.doorX, r.x, t);
      w.z = mix(this.doorZ, r.z, t);
      w.mesh.position.set(w.x, 0, w.z);
      w.mesh.visible = t < 0.85;
      if (this.timer > 0.45) {
        this.phase = THEFT_PHASES.DONE;
        const done = this.onDone;
        this.onDone = null;
        if (done) done(r);
      }
    }
  }
}

// A spare driver figure kept parked by the traffic car until someone yanks him.
export function makeVictim(shirtColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.3), shirt);
  torso.position.y = 1.15;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.72;
  g.add(head);
  for (const s of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 6), skin);
    arm.position.set(s, 1.1, 0.1);
    arm.rotation.x = -0.9;
    g.add(arm);
  }
  g.visible = false;
  return g;
}
