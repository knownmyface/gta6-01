// Combat for CORAL HEAT v2.4: hitscan shooting on foot, tracers, muzzle
// flash, hostiles and police shooting back, health, and getting busted.
// Shots go through the arsenal — damage, pellets, spread and fire rate come
// from the equipped weapon, and every shot lights the viewmodel + the gun in
// Mara's hand. v2.4 is a from-scratch rewrite of v2.3's combat.js: same
// shooting, same return fire, same busted rules, different code. The pellet
// loop is split into a per-pellet resolver now, and the target list is built
// by one builder per target kind.
// Spread and return fire use Math.random, not the seeded stream — the draws
// happen in the same order as v2.3, so the odds stay identical.
import * as THREE from 'three';
import { clamp } from './rng.js';
import { makeFlashSprite } from './weapons.js';

const TRACER_COLOR = 0xffe08a;
const FLASH_COLOR = 0xffe08a;
const TRACER_LIFE = 0.09;
const HOSTILE_RANGE = 34;
const POLICE_RANGE = 26;
const HEALTH_REGEN = 2.5;

function makeLine(from, to, opacity) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: TRACER_COLOR, transparent: true, opacity,
  }));
}

// One ray against one target: returns the distance along the ray when the
// target is hit, or null when the ray misses or passes behind.
function rayHitTarget(ox, oz, dx, dz, t, maxT) {
  if (!t.alive()) return null;
  const rx = t.x - ox;
  const rz = t.z - oz;
  const along = rx * dx + rz * dz;
  if (along < 0 || along > maxT) return null;
  const perp = Math.abs(rx * dz - rz * dx);
  if (perp >= (t.radius ?? 1.2)) return null;
  return along;
}

export class Combat {
  constructor(scene, audio, arsenal) {
    this.scene = scene;
    this.audio = audio;
    this.arsenal = arsenal;
    this.tracers = [];
    this.flash = new THREE.PointLight(FLASH_COLOR, 0, 12);
    this.scene.add(this.flash);
    this.shootCooldown = 0;
    this.policeShootTimer = 0;
    this.onShotFired = null; // wired by main.js: viewmodel flash + sound
    this.onBusted = null; // wired by main.js: bail, respawn, save
  }

  // A persistent muzzle flash + tracer for staged screenshots: never fades.
  // Scale lets a shot size the flash to the weapon (rifle > pistol).
  stageFlash(from, to, scale = 0.9) {
    const flash = makeFlashSprite(scale);
    flash.position.set(from.x, from.y, from.z);
    flash.visible = true;
    this.scene.add(flash);
    const line = makeLine(from, to, 0.95);
    this.scene.add(line);
    return { flash, line };
  }

  // Where Mara's muzzle is in the world, for the tracer start + flash.
  muzzleWorld(player) {
    const out = new THREE.Vector3();
    if (player.muzzle) player.muzzle.getWorldPosition(out);
    else out.set(player.x, 1.4, player.z);
    return out;
  }

  // Fire one pellet along a spread heading; returns the target it hit and
  // the distance it flew, or null when it hit nothing.
  firePellet(ox, oz, heading, w, targets) {
    const spreadHeading = heading + (Math.random() - 0.5) * 2 * w.spread;
    const dx = Math.sin(spreadHeading);
    const dz = Math.cos(spreadHeading);
    let best = null;
    let bestT = w.range;
    for (const t of targets) {
      const along = rayHitTarget(ox, oz, dx, dz, t, bestT);
      if (along === null) continue;
      best = t;
      bestT = along;
    }
    if (!best) return null;
    best.hit(w.damage);
    return { target: best, dist: bestT };
  }

  // Player shoots from their position along their heading (mouse aim
  // adjusts it). Returns the target hit, or null.
  playerShoot(player, aimHeading, targets) {
    if (player.inCar) return null;
    const w = this.arsenal.def();
    if (!this.arsenal.pullTrigger()) return null; // cooldown, dry mag or reloading
    this.audio.gunshot();
    const muzzle = this.muzzleWorld(player);
    const ox = player.x;
    const oz = player.z;
    let anyHit = null;
    let farT = w.range;
    for (let p = 0; p < w.pellets; p++) {
      const shot = this.firePellet(ox, oz, aimHeading, w, targets);
      if (shot === null) continue;
      // The tracer stops at the closest hit across all pellets.
      farT = Math.min(farT, shot.dist);
      anyHit = shot.target;
    }
    const dx = Math.sin(aimHeading);
    const dz = Math.cos(aimHeading);
    const ex = ox + dx * farT;
    const ez = oz + dz * farT;
    this.spawnTracer(muzzle.x, muzzle.y, muzzle.z, ex, 1.3, ez);
    this.flash.position.set(muzzle.x + dx * 0.6, muzzle.y, muzzle.z + dz * 0.6);
    this.flash.intensity = 14;
    setTimeout(() => { this.flash.intensity = 0; }, 60);
    player.showGunFlash();
    this.onShotFired?.();
    return anyHit;
  }

  spawnTracer(x1, y1, z1, x2, y2, z2) {
    const line = makeLine({ x: x1, y: y1, z: z1 }, { x: x2, y: y2, z: z2 }, 0.9);
    this.scene.add(line);
    this.tracers.push({ line, life: TRACER_LIFE });
  }

  // Age the tracers out: a tracer lives 0.09s, then its line is removed
  // from the scene and its geometry disposed.
  cleanTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life > 0) continue;
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      this.tracers.splice(i, 1);
    }
  }

  update(dt, player, missions, police, peds) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.cleanTracers(dt);
    this.hostileFire(dt, player, missions);
    this.policeFire(dt, player, police);
    // Slow health regen out of danger.
    if (player.wanted === 0 && player.health < 100 && player.health > 0) {
      player.health = Math.min(100, player.health + HEALTH_REGEN * dt);
    }
    void peds;
  }

  // Hostiles shoot back at the player.
  hostileFire(dt, player, missions) {
    for (const h of missions.hostiles) {
      if (h.dead) continue;
      const d = Math.hypot(player.pos.x - h.x, player.pos.z - h.z);
      h.shootTimer -= dt;
      if (d >= HOSTILE_RANGE || h.shootTimer > 0) {
        // Health bar faces the camera-ish: keep it level.
        h.hpMesh.scale.x = clamp(h.health / 3, 0, 1);
        continue;
      }
      h.shootTimer = 1.4 + Math.random() * 0.8;
      h.mesh.lookAt(player.pos.x, 1.1, player.pos.z);
      this.spawnTracer(h.x, 1.3, h.z, player.pos.x, 1.2, player.pos.z);
      this.audio.gunshot();
      if (Math.random() < 0.45) {
        this.damagePlayer(player, 7, "A rival's bullet found you.");
      }
      h.hpMesh.scale.x = clamp(h.health / 3, 0, 1);
    }
  }

  // Police shoot when close and wanted, more accurate at higher stars.
  policeFire(dt, player, police) {
    this.policeShootTimer -= dt;
    if (player.wanted <= 0 || this.policeShootTimer > 0) return;
    this.policeShootTimer = 1.1 - player.wanted * 0.1;
    let nearest = null;
    let nd = 1e9;
    for (const c of police.cars) {
      const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
      if (d < nd) {
        nd = d;
        nearest = c;
      }
    }
    if (!nearest || nd >= POLICE_RANGE) return;
    this.spawnTracer(nearest.x, 1.2, nearest.z, player.pos.x, 1.2, player.pos.z);
    if (Math.random() < 0.25 + player.wanted * 0.05) {
      this.damagePlayer(player, 5, 'The police shot you down.');
    }
  }

  damagePlayer(player, dmg, cause) {
    if (player.health <= 0) return;
    player.health -= dmg;
    if (player.health > 0) return;
    player.health = 0;
    this.onBusted?.(cause);
  }

  // --- target builders: one per kind the player's shots can hit ---
  hostileTargets(player, missions) {
    const targets = [];
    for (const h of missions.hostiles) {
      if (h.dead) continue;
      targets.push({
        x: h.x, z: h.z, radius: 1.4, alive: () => !h.dead,
        hit: (dmg) => {
          h.health -= dmg;
          if (h.health > 0) return;
          h.dead = true;
          h.mesh.rotation.x = Math.PI / 2;
          h.mesh.position.y = 0.3;
          missions.active.killed += 1;
          player.addWanted(1, 'shooting');
        },
      });
    }
    return targets;
  }

  policeTargets(player, police) {
    const targets = [];
    for (const c of police.cars) {
      targets.push({
        x: c.x, z: c.z, radius: 2.2, alive: () => !c.dead,
        hit: (dmg) => {
          c.speed *= 0.4;
          c.health = (c.health ?? 4) - dmg;
          if (c.health > 0) return;
          c.dead = true;
          c.speed = 0;
          player.addWanted(1, 'shooting at police');
        },
      });
    }
    return targets;
  }

  pedTargets(player, peds) {
    const targets = [];
    for (const p of peds.peds) {
      if (p.dead) continue;
      targets.push({
        x: p.x, z: p.z, radius: 1.0, alive: () => !p.dead,
        hit: () => {
          peds.kill(p);
          player.addWanted(1, 'hitting a pedestrian');
          peds.scare(p.x, p.z, 25);
        },
      });
    }
    return targets;
  }

  // Build the target list the player's shots can hit this frame.
  buildTargets(player, missions, police, peds) {
    return [
      ...this.hostileTargets(player, missions),
      ...this.policeTargets(player, police),
      ...this.pedTargets(player, peds),
    ];
  }
}
