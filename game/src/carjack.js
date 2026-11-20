// Coral Heat — the carjacking sequence. New in v2.7: stealing a car is a visible
// moment, not a teleport. Kai walks up, yanks the door, drags the driver out,
// and the driver stumbles away while Kai slides in. The whole beat takes about
// two seconds and the camera stays on it.

import * as THREE from 'three';
import { clamp, lerp } from './rng.js';

export const JACK_STAGES = {
  IDLE: 'idle',
  APPROACH: 'approach',   // Kai closes the last steps to the door
  YANK: 'yank',           // door swings, driver is grabbed
  DRAG: 'drag',           // driver pulled out, stumbles to the sidewalk
  SLIDE: 'slide',         // Kai slides into the seat
  DONE: 'done',
};

export class CarjackSequence {
  constructor(scene) {
    this.scene = scene;
    this.stage = JACK_STAGES.IDLE;
    this.timer = 0;
    this.ride = null;
    this.driver = null;   // pedestrian mesh playing the victim
    this.onDone = null;
    this.onStage = null;  // HUD hook: (stage, text) => void
  }
  get active() { return this.stage !== JACK_STAGES.IDLE && this.stage !== JACK_STAGES.DONE; }

  begin(ride, driverMesh, walker, onDone) {
    this.ride = ride;
    this.driver = driverMesh;
    this.onDone = onDone;
    this.stage = JACK_STAGES.APPROACH;
    this.timer = 0;
    this.walker = walker;
    this.startX = walker.x;
    this.startZ = walker.z;
    // door target: driver's side of the car
    const dx = Math.cos(ride.heading);
    const dz = -Math.sin(ride.heading);
    this.doorX = ride.x - dx * 1.25;
    this.doorZ = ride.z - dz * 1.25;
    this.say(JACK_STAGES.APPROACH, 'Closing in…');
  }
  say(stage, text) {
    if (this.onStage) this.onStage(stage, text);
  }
  cancel() {
    this.stage = JACK_STAGES.IDLE;
    this.ride = null;
    this.driver = null;
  }
  update(dt) {
    if (!this.active) return;
    this.timer += dt;
    const w = this.walker;
    const r = this.ride;
    if (this.stage === JACK_STAGES.APPROACH) {
      // walk Kai to the door in a straight line
      const dx = this.doorX - w.x, dz = this.doorZ - w.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const step = Math.min(d, 5.5 * dt);
        w.x += (dx / d) * step;
        w.z += (dz / d) * step;
        w.heading = Math.atan2(dx, dz);
        w.mesh.position.set(w.x, 0, w.z);
        w.mesh.rotation.y = w.heading;
      } else if (this.timer > 0.35) {
        this.stage = JACK_STAGES.YANK;
        this.timer = 0;
        this.say(JACK_STAGES.YANK, 'YANK THE DOOR!');
      }
    } else if (this.stage === JACK_STAGES.YANK) {
      // Kai leans in; the car rocks on its suspension
      r.mesh.rotation.z = Math.sin(this.timer * 18) * 0.05;
      r.mesh.position.y = Math.abs(Math.sin(this.timer * 18)) * 0.08;
      w.mesh.rotation.y = r.heading + Math.PI / 2;
      if (this.timer > 0.55) {
        this.stage = JACK_STAGES.DRAG;
        this.timer = 0;
        this.say(JACK_STAGES.DRAG, 'OUT! OUT! OUT!');
      }
    } else if (this.stage === JACK_STAGES.DRAG) {
      // driver mesh slides out of the car and stumbles away
      if (this.driver) {
        const t = clamp(this.timer / 0.8, 0, 1);
        const sx = r.x - Math.cos(r.heading) * 1.25;
        const sz = r.z + Math.sin(r.heading) * 1.25;
        const ex = sx - Math.cos(r.heading) * 2.6;
        const ez = sz + Math.sin(r.heading) * 2.6;
        this.driver.position.set(lerp(sx, ex, t), 0, lerp(sz, ez, t));
        this.driver.rotation.y = r.heading;
        this.driver.rotation.z = Math.sin(t * Math.PI) * 0.5; // stumble
        this.driver.visible = true;
      }
      r.mesh.rotation.z = 0;
      r.mesh.position.y = 0;
      if (this.timer > 0.85) {
        this.stage = JACK_STAGES.SLIDE;
        this.timer = 0;
        this.say(JACK_STAGES.SLIDE, 'GO GO GO!');
      }
    } else if (this.stage === JACK_STAGES.SLIDE) {
      // Kai slides into the seat and the walker mesh hides inside the car
      const t = clamp(this.timer / 0.4, 0, 1);
      w.x = lerp(this.doorX, r.x, t);
      w.z = lerp(this.doorZ, r.z, t);
      w.mesh.position.set(w.x, 0, w.z);
      w.mesh.visible = t < 0.85;
      if (this.timer > 0.45) {
        this.stage = JACK_STAGES.DONE;
        const done = this.onDone;
        this.onDone = null;
        if (done) done(r);
      }
    }
  }
}

// A spare driver figure kept parked by the traffic car until someone yanks him.
export function makeDriverFigure(shirtColor) {
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
