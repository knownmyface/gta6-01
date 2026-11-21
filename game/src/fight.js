// fight.js — combat: pistol / shotgun / rifle, shooting, enemy thugs,
// muzzle flash, damage numbers, health + armor pickups.
import * as THREE from 'three';
import { box, clamp, rand, pick } from './util.js';

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', dmg: 12, rate: 0.45, range: 3, auto: false, ammo: Infinity },
  { id: 'pistol', name: 'PISTOL', dmg: 22, rate: 0.32, range: 60, auto: false, ammo: 120 },
  { id: 'shotgun', name: 'SHOTGUN', dmg: 15, rate: 0.85, range: 26, auto: false, ammo: 40, pellets: 6 },
  { id: 'rifle', name: 'RIFLE', dmg: 30, rate: 0.12, range: 90, auto: true, ammo: 240 },
];

export function createArsenal() {
  return {
    slots: [WEAPONS[0], WEAPONS[1]],
    current: 0,
    ammo: { pistol: 120, shotgun: 40, rifle: 240 },
    cooldown: 0,
    currentWeapon() { return this.slots[this.current]; },
    switchSlot(i) { if (this.slots[i]) { this.current = i; return true; } return false; },
    give(id) {
      const w = WEAPONS.find((x) => x.id === id);
      if (!w) return false;
      if (!this.slots.includes(w)) this.slots.push(w);
      if (w.ammo !== Infinity) this.ammo[id] = (this.ammo[id] || 0) + w.ammo;
      return true;
    },
  };
}

export function spawnThugs(G, n, cx, cz) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    g.add(box(0.9, 1.1, 0.5, 0x4a2a5a, 0, 1.35, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd8a070 }));
    head.position.set(0, 2.2, 0); head.castShadow = true; g.add(head);
    g.add(box(0.3, 0.9, 0.34, 0x1a1a22, -0.22, 0.45, 0));
    g.add(box(0.3, 0.9, 0.34, 0x1a1a22, 0.22, 0.45, 0));
    g.position.set(cx + rand(-8, 8), 0, cz + rand(-8, 8));
    G.scene.add(g);
    G.thugs.push({ group: g, x: g.position.x, z: g.position.z, heading: 0, hp: 60, shootT: rand(1, 2), phase: rand(0, 6), alive: true });
  }
}

export function fireWeapon(G) {
  const a = G.arsenal;
  const w = a.currentWeapon();
  if (a.cooldown > 0) return;
  if (w.id === 'fists') {
    G.player.punchT = 0.3;
    a.cooldown = w.rate;
    // melee hit on nearest thug
    for (const t of G.thugs) {
      if (!t.alive) continue;
      if (Math.hypot(t.x - G.player.pos.x, t.z - G.player.pos.z) < w.range) { hurtThug(G, t, w.dmg); break; }
    }
    G.sound.blip(140, 0.06);
    return;
  }
  if ((a.ammo[w.id] || 0) <= 0) { G.hud.say('OUT OF AMMO — ' + w.name, 1.5); G.sound.blip(90, 0.15); a.cooldown = 0.3; return; }
  a.ammo[w.id]--;
  a.cooldown = w.rate;
  // muzzle flash: quick light sphere at the player
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
  flash.position.copy(G.player.pos).add(new THREE.Vector3(Math.sin(G.player.heading) * 1.2, 1.4, Math.cos(G.player.heading) * 1.2));
  G.scene.add(flash);
  G.fx.flashes.push({ mesh: flash, t: 0.07 });
  G.sound.shot();
  // tracer line
  const dir = new THREE.Vector3(Math.sin(G.player.heading), 0, Math.cos(G.player.heading));
  const end = G.player.pos.clone().add(dir.clone().multiplyScalar(w.range));
  const geo = new THREE.BufferGeometry().setFromPoints([G.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.8 }));
  G.scene.add(line);
  G.fx.flashes.push({ mesh: line, t: 0.09 });
  // hit the nearest thug roughly in front
  const pellets = w.pellets || 1;
  for (let p = 0; p < pellets; p++) {
    let best = null, bd = w.range;
    for (const t of G.thugs) {
      if (!t.alive) continue;
      const dx = t.x - G.player.pos.x, dz = t.z - G.player.pos.z;
      const d = Math.hypot(dx, dz);
      const ang = Math.abs(Math.atan2(dx, dz) - G.player.heading);
      if (d < bd && ang < 0.35) { bd = d; best = t; }
    }
    if (best) hurtThug(G, best, w.dmg);
  }
}

export function hurtThug(G, t, dmg) {
  t.hp -= dmg;
  G.fx.hitmarks.push({ x: t.x, z: t.z, t: 0.6, txt: '-' + dmg });
  if (t.hp <= 0 && t.alive) {
    t.alive = false;
    t.group.visible = false;
    G.player.cash += 85;
    G.hud.say('Thug down — +$85', 1.6);
    if (Math.random() < 0.4) G.wanted.add(1);
  }
}

export function updateThugs(G, dt) {
  const px = G.player.pos.x, pz = G.player.pos.z;
  for (const t of G.thugs) {
    if (!t.alive) continue;
    const dx = px - t.x, dz = pz - t.z;
    const d = Math.hypot(dx, dz) || 1;
    t.heading = Math.atan2(dx / d, dz / d);
    t.group.rotation.y = t.heading;
    if (d > 10) {
      t.x += (dx / d) * 3.4 * dt; t.z += (dz / d) * 3.4 * dt;
    } else {
      t.shootT -= dt;
      if (t.shootT <= 0) {
        t.shootT = rand(1.2, 2.2);
        G.player.health -= 6;
        G.player.damageFlash = 0.35;
        G.sound.blip(110, 0.1);
        if (G.player.health <= 0) G.player.health = 0;
      }
    }
    t.phase += dt * 7;
    t.group.position.set(t.x, Math.abs(Math.sin(t.phase)) * 0.06, t.z);
  }
  G.arsenal.cooldown = Math.max(0, G.arsenal.cooldown - dt);
}

export function spawnPickups(G) {
  // health + armor crates around the plaza and marina
  const spots = [[12, 12], [-12, -12], [160, 180], [-160, -160], [80, -80], [-80, 80]];
  for (const [x, z] of spots) {
    const kind = Math.random() < 0.5 ? 'health' : 'armor';
    const mesh = box(1.6, 1.6, 1.6, kind === 'health' ? 0x2ae06a : 0x2a6aff, x, 1.2, z);
    mesh.rotation.y = Math.PI / 4;
    G.scene.add(mesh);
    G.pickups.push({ mesh, x, z, kind, taken: false });
  }
}

export function updatePickups(G, dt) {
  for (const p of G.pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt;
    p.mesh.position.y = 1.2 + Math.sin(G.time * 2 + p.x) * 0.15;
    if (Math.hypot(p.x - G.player.pos.x, p.z - G.player.pos.z) < 2.4) {
      p.taken = true; p.mesh.visible = false;
      if (p.kind === 'health') { G.player.health = Math.min(100, G.player.health + 50); G.hud.say('HEALTH +50', 1.6); }
      else { G.player.armor = Math.min(100, G.player.armor + 50); G.hud.say('ARMOR +50', 1.6); }
      G.sound.blip(660, 0.12);
    }
  }
}
