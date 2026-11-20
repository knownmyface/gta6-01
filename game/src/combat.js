// CORAL HEAT v2.8 — gunplay: hitscan shooting from the hip, muzzle flash,
// tracers, and the consequences (peds scatter, interceptors take damage,
// wanted heat rises). No hitscan magic through walls: the ray is sampled
// against building boxes in 24 steps before any target is tested.

import * as THREE from 'three';
import { clampVal } from './rng.js';

const TRACER_POOL = 6;
const TRACER_LIFE = 0.09;

export class Gunplay {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.ray = new THREE.Raycaster();
    this.tracers = [];
    this.nextTracer = 0;
    for (let i = 0; i < TRACER_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), mat);
      m.visible = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.flash = new THREE.PointLight(0xffc36b, 0, 9);
    scene.add(this.flash);
    this.flashTimer = 0;
    this.puffGeo = new THREE.SphereGeometry(0.28, 6, 5);
    this.puffMat = new THREE.MeshBasicMaterial({ color: 0xff5040, transparent: true, opacity: 0.85 });
  }
  // origin/direction in world space; targets: [{x, z, radius, label}]
  // returns the closest hit {dist, label} or {dist, label: null}
  fire(origin, dir, def, targets, onHit) {
    // wall check: sample the ray in 24 steps; a building caps the range
    let wallDist = def.range;
    const step = def.range / 24;
    for (let d = step * 2; d < def.range; d += step) {
      if (this.world.solid(origin.x + dir.x * d, origin.z + dir.z * d, 0.2)) {
        wallDist = d;
        break;
      }
    }
    let best = null;
    let bestD = wallDist;
    for (const t of targets) {
      const dx = t.x - origin.x;
      const dz = t.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 0 || along > bestD) continue;
      // perpendicular distance from the ray, in the shot's plane
      const perp = Math.abs(dx * dir.z - dz * dir.x);
      if (perp < t.radius + 0.4) {
        best = t;
        bestD = along;
      }
    }
    const end = {
      x: origin.x + dir.x * bestD,
      y: origin.y,
      z: origin.z + dir.z * bestD,
    };
    this.showTracer(origin, end);
    this.flash.position.set(origin.x + dir.x * 1.2, origin.y + 0.1, origin.z + dir.z * 1.2);
    this.flash.intensity = 26;
    this.flashTimer = 0.06;
    if (!best) return { dist: bestD, label: null };
    let total = 0;
    for (let p = 0; p < def.pellets; p++) total += def.damage;
    if (onHit) onHit(best, total, bestD);
    return { dist: bestD, label: best.label || 'target' };
  }
  showTracer(a, b) {
    // ring buffer: the oldest tracer is always reused
    const slot = this.tracers[this.nextTracer];
    this.nextTracer = (this.nextTracer + 1) % TRACER_POOL;
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    slot.mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    slot.mesh.scale.set(1, 1, Math.max(0.1, len));
    slot.mesh.lookAt(b.x, b.y, b.z);
    slot.mesh.visible = true;
    slot.mesh.material.opacity = 0.9;
    slot.life = TRACER_LIFE;
  }
  update(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = clampVal(t.life / TRACER_LIFE, 0, 1) * 0.9;
      if (t.life <= 0) t.mesh.visible = false;
    }
  }
  // a quick red puff where a bullet lands on a person
  hitPuff(x, y, z) {
    const puff = new THREE.Mesh(this.puffGeo, this.puffMat);
    puff.position.set(x, y, z);
    this.scene.add(puff);
    setTimeout(() => this.scene.remove(puff), 180);
  }
}
