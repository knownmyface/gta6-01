// Coral Heat — combat: hitscan shooting from the hip, muzzle flash, tracers,
// and the consequences (peds scatter, cruisers take damage, wanted heat rises).
// No hitscan magic through walls: the ray is tested against building boxes first.

import * as THREE from 'three';
import { clamp, dist2d } from './rng.js';

export class Combat {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    // one reusable raycaster + a small pool of tracer lines
    this.ray = new THREE.Raycaster();
    this.tracers = [];
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), tracerMat.clone());
      m.visible = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.flash = new THREE.PointLight(0xffc36b, 0, 9);
    scene.add(this.flash);
    this.flashTimer = 0;
  }
  // origin/direction in world space; targets: [{mesh-ish x,z,radius,hit(dmg)}]
  // returns the closest hit {dist, label} or null
  shoot(origin, dir, def, targets, onHit) {
    // wall check: march the ray through building AABBs in 1m steps
    let wallDist = def.range;
    for (let d = 2; d < def.range; d += 1) {
      const x = origin.x + dir.x * d;
      const z = origin.z + dir.z * d;
      if (this.world.blocked(x, z, 0.2)) { wallDist = d; break; }
    }
    let best = null, bestD = wallDist;
    for (const t of targets) {
      // 2D circle test in the shot's path plane
      const dx = t.x - origin.x, dz = t.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 0 || along > bestD) continue;
      const perp = Math.abs(dx * dir.z - dz * dir.x);
      if (perp < t.radius + 0.4) {
        best = t; bestD = along;
      }
    }
    const end = {
      x: origin.x + dir.x * bestD,
      y: origin.y,
      z: origin.z + dir.z * bestD,
    };
    this.spawnTracer(origin, end);
    this.flash.position.set(origin.x + dir.x * 1.2, origin.y + 0.1, origin.z + dir.z * 1.2);
    this.flash.intensity = 26;
    this.flashTimer = 0.06;
    if (best) {
      let total = 0;
      for (let p = 0; p < def.pellets; p++) total += def.damage;
      if (onHit) onHit(best, total, bestD);
      return { dist: bestD, label: best.label || 'target' };
    }
    return { dist: bestD, label: null };
  }
  spawnTracer(a, b) {
    const slot = this.tracers.find((t) => t.life <= 0) || this.tracers[0];
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    slot.mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    slot.mesh.scale.set(1, 1, Math.max(0.1, len));
    slot.mesh.lookAt(b.x, b.y, b.z);
    slot.mesh.visible = true;
    slot.mesh.material.opacity = 0.9;
    slot.life = 0.09;
  }
  update(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.mesh.material.opacity = clamp(t.life / 0.09, 0, 1) * 0.9;
        if (t.life <= 0) t.mesh.visible = false;
      }
    }
  }
  // a quick red puff where a bullet lands on a person
  impactBurst(x, y, z) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff5040, transparent: true, opacity: 0.85 }),
    );
    puff.position.set(x, y, z);
    this.scene.add(puff);
    setTimeout(() => this.scene.remove(puff), 180);
  }
}
