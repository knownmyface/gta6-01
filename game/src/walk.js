// Coral Heat — on-foot movement, carjacking, player character.
// Fresh write, round 7.
import * as THREE from 'three';
import { clamp, rand, pick } from './util.js';
import { collideCircle } from './coralcity.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff5a3c });
  const pants = new THREE.MeshLambertMaterial({ color: 0x223344 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.15, 10), shirt);
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), skin);
  head.position.y = 1.95; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 12), new THREE.MeshLambertMaterial({ color: 0xffd166 }));
  cap.position.y = 2.2; g.add(cap);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.95, 8), pants);
  legL.position.set(-0.2, 0.48, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.2; g.add(legR);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.85, 8), shirt);
  armL.position.set(-0.58, 1.25, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.58; g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Walker {
  constructor(scene) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = 0; this.z = 44; this.heading = 0;
    this.speed = 0;
    this.walkPhase = 0;
    this.active = false;
  }
  place(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading ?? this.heading;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = true;
  }
  update(dt, input, city, camYaw) {
    const run = input.sprint ? 9.5 : 5.2;
    let mx = 0, mz = 0;
    if (input.forward) mz -= 1;
    if (input.back) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = mx * cos - mz * sin;
      const wz = mx * sin + mz * cos;
      const nx = this.x + wx * run * dt;
      const nz = this.z + wz * run * dt;
      const hit = collideCircle(city, nx, nz, 0.7);
      this.x = hit.x; this.z = hit.z;
      this.heading = Math.atan2(wx, wz);
      this.speed = run;
      this.walkPhase += dt * run * 1.6;
    } else {
      this.speed *= Math.max(0, 1 - 8 * dt);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const sw = Math.sin(this.walkPhase) * (this.speed > 0.5 ? 0.55 : 0);
    this.mesh.userData.legL.rotation.x = sw;
    this.mesh.userData.legR.rotation.x = -sw;
    this.mesh.userData.armL.rotation.x = -sw * 0.7;
    this.mesh.userData.armR.rotation.x = sw * 0.7;
  }
}

// Pedestrians wandering the sidewalks.
export class Pedestrians {
  constructor(scene, count = 46) {
    this.list = [];
    const shirts = [0xff6b6b, 0x4ecdc4, 0xffd166, 0x9b5de5, 0x86efac, 0xf8f8f8, 0x2fa8ff];
    for (let i = 0; i < count; i++) {
      const m = makePlayerMesh();
      m.scale.setScalar(rand(0.92, 1.06));
      m.children[1].material = new THREE.MeshLambertMaterial({ color: pick(shirts) });
      // recolor shirt body: children[0] is body
      m.children[0].material = new THREE.MeshLambertMaterial({ color: pick(shirts) });
      scene.add(m);
      const gx = Math.floor(rand(-4, 4)) * 52;
      const gz = Math.floor(rand(-4, 4)) * 52;
      this.list.push({
        mesh: m, x: gx + rand(-14, 14), z: gz + rand(-14, 14),
        heading: rand(0, Math.PI * 2), speed: rand(1.1, 2.2),
        targetX: 0, targetZ: 0, panic: 0,
      });
      const p = this.list[i];
      p.targetX = p.x + rand(-30, 30); p.targetZ = p.z + rand(-30, 30);
    }
  }
  update(dt, dangerPos) {
    for (const p of this.list) {
      if (dangerPos && Math.hypot(p.x - dangerPos.x, p.z - dangerPos.z) < 18) p.panic = 2.5;
      if (p.panic > 0) {
        p.panic -= dt;
        const away = Math.atan2(p.x - dangerPos.x, p.z - dangerPos.z);
        p.x += Math.sin(away) * 5.5 * dt;
        p.z += Math.cos(away) * 5.5 * dt;
        p.heading = away;
      } else {
        const dx = p.targetX - p.x, dz = p.targetZ - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) { p.targetX = p.x + rand(-36, 36); p.targetZ = p.z + rand(-36, 36); }
        else {
          p.heading = Math.atan2(dx, dz);
          p.x += Math.sin(p.heading) * p.speed * dt;
          p.z += Math.cos(p.heading) * p.speed * dt;
        }
      }
      p.x = clamp(p.x, -256, 256); p.z = clamp(p.z, -256, 256);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
  nearest(x, z, maxD = 3) {
    let best = null, bd = maxD * maxD;
    for (const p of this.list) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
