// Coral Heat — combat: weapons, weapon wheel, shooting, explosions + fire/smoke.
// Fresh write, round 7.
import * as THREE from 'three';
import { clamp, rand, pick } from './util.js';

export const WEAPONS = [
  { id: 'fist', name: 'FISTS', slot: 1, damage: 12, range: 3, rate: 0.35, ammo: Infinity, color: 0xffffff },
  { id: 'pistol', name: 'P9 PISTOL', slot: 2, damage: 26, range: 46, rate: 0.28, ammo: 120, color: 0xffd166 },
  { id: 'smg', name: 'REEF SMG', slot: 3, damage: 15, range: 40, rate: 0.09, ammo: 240, color: 0x7dd3fc },
  { id: 'shotgun', name: 'TIDE SHOTGUN', slot: 4, damage: 70, range: 20, rate: 0.85, ammo: 48, color: 0xff8c5a },
  { id: 'rifle', name: 'CORAL RIFLE', slot: 5, damage: 55, range: 90, rate: 0.16, ammo: 150, color: 0xf472b6 },
  { id: 'launcher', name: 'BOOM TUBE', slot: 6, damage: 120, range: 70, rate: 1.4, ammo: 12, color: 0xff4444 },
];

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
  }
  spawnExplosion(x, y, z, scale = 1) {
    const group = new THREE.Group();
    const n = 26;
    const geo = new THREE.SphereGeometry(0.5, 6, 5);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const isSmoke = i % 3 === 0;
      const mat = new THREE.MeshBasicMaterial({
        color: isSmoke ? 0x444444 : pick([0xff6b00, 0xffa500, 0xffdd33, 0xff3300]),
        transparent: true, opacity: 0.95,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.setScalar(rand(0.6, 1.6) * scale);
      group.add(m);
      parts.push({
        mesh: m,
        vx: rand(-1, 1) * 9 * scale, vy: rand(2, 11) * scale, vz: rand(-1, 1) * 9 * scale,
        life: rand(0.5, 1.3), maxLife: 1.3, smoke: isSmoke,
      });
    }
    // fire glow light
    const light = new THREE.PointLight(0xff7722, 60, 42 * scale);
    light.position.set(x, y + 2, z);
    group.add(light);
    // ground scorch ring
    const ring = new THREE.Mesh(new THREE.CircleGeometry(4.5 * scale, 20), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.7 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.06, z);
    group.add(ring);
    this.scene.add(group);
    this.bursts.push({ group, parts, light, life: 1.4, maxLife: 1.4 });
    return group;
  }
  spawnMuzzle(x, y, z, heading) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    m.position.set(x + Math.sin(heading) * 1.6, y, z + Math.cos(heading) * 1.6);
    this.scene.add(m);
    this.bursts.push({ group: m, parts: [], light: null, life: 0.07, maxLife: 0.07, single: true });
  }
  update(dt) {
    for (const b of [...this.bursts]) {
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.group);
        this.bursts = this.bursts.filter((x) => x !== b);
        continue;
      }
      const k = b.life / b.maxLife;
      if (b.light) b.light.intensity = 60 * k;
      for (const p of b.parts) {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= (p.smoke ? -2 : 14) * dt;   // smoke rises, fire falls
        p.mesh.material.opacity = Math.max(0, k);
        p.mesh.scale.multiplyScalar(1 + dt * (p.smoke ? 1.6 : 0.4));
      }
      if (b.single) b.group.material.opacity = k;
    }
  }
}

export class Combat {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.weaponIndex = 1;   // pistol
    this.ammo = {};
    for (const w of WEAPONS) this.ammo[w.id] = w.ammo === Infinity ? Infinity : w.ammo;
    this.cooldown = 0;
    this.wheelOpen = false;
  }
  get weapon() { return WEAPONS[this.weaponIndex]; }
  select(i) {
    this.weaponIndex = clamp(i, 0, WEAPONS.length - 1);
  }
  // Hitscan shot from the player toward aim point; damages peds, cops, cars.
  shoot(G, origin, heading) {
    if (this.cooldown > 0) return false;
    const w = this.weapon;
    if (this.ammo[w.id] !== Infinity && this.ammo[w.id] <= 0) {
      G.hud?.toast('OUT OF AMMO — ' + w.name, '#ff8844');
      this.cooldown = 0.4;
      return false;
    }
    this.cooldown = w.rate;
    if (this.ammo[w.id] !== Infinity) this.ammo[w.id] -= 1;
    const ox = origin.x + Math.sin(heading) * 1.2;
    const oz = origin.z + Math.cos(heading) * 1.2;
    this.particles.spawnMuzzle(ox, 1.5, oz, heading);
    G.sound?.shot(w.id);
    // tracer line
    const endX = ox + Math.sin(heading) * w.range;
    const endZ = oz + Math.cos(heading) * w.range;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ox, 1.5, oz), new THREE.Vector3(endX, 1.4, endZ),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    setTimeout(() => this.scene.remove(line), 70);
    let hitAnything = false;
    // peds
    for (const p of G.peds.list) {
      const d = Math.hypot(p.x - ox, p.z - oz);
      if (d < w.range) {
        const ang = Math.atan2(p.x - ox, p.z - oz);
        let diff = Math.abs(((ang - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff < 0.16) {
          p.panic = 3;
          G.player.cash += 12;
          G.police.addHeat(4);
          hitAnything = true;
        }
      }
    }
    // police cars
    for (const c of G.police.cars) {
      const d = Math.hypot(c.x - ox, c.z - oz);
      if (d < w.range) {
        const ang = Math.atan2(c.x - ox, c.z - oz);
        let diff = Math.abs(((ang - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff < 0.2) {
          G.police.addHeat(10);
          if (w.id === 'launcher' || Math.random() < 0.25) {
            this.particles.spawnExplosion(c.x, 1, c.z, 1.3);
            G.sound?.explosion();
            this.scene.remove(c.mesh);
            G.police.cars = G.police.cars.filter((x) => x !== c);
            G.player.cash += 250;
            G.hud?.toast('POLICE CAR DESTROYED +$250', '#ffd166');
          }
          hitAnything = true;
        }
      }
    }
    // traffic cars explode with launcher
    if (w.id === 'launcher') {
      this.particles.spawnExplosion(endX, 1, endZ, 1.6);
      G.sound?.explosion();
      G.police.addHeat(12);
      hitAnything = true;
    }
    if (hitAnything) G.player.kills = (G.player.kills || 0) + 1;
    return true;
  }
  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
  }
}
