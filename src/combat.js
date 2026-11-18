// Shooting in CORAL HEAT v2.6 — hitscan fire on foot, tracers, muzzle
// flash, hostiles and police shooting back, health, and getting busted.
// Every shot goes through the arsenal: damage, pellets, spread and fire
// rate come from the equipped weapon, and each shot lights the viewmodel
// plus the gun in Mara's hand. v2.6 is a from-scratch rewrite of v2.5's
// combat.js: same shooting, same return fire, same busted rules, different
// code. Pellets are resolved one at a time against a target list built by
// three small factories (one per kind of thing a bullet can hit).
// Spread and return fire use Math.random, not the seeded stream — the draws
// happen in the same order as v2.5, so the odds stay identical.
import * as THREE from 'three';
import { clamp } from './rng.js';
import { makeFlashSprite } from './weapons.js';

// One place for the numbers the whole file shares.
const TUNING = {
  traceColor: 0xffe08a,
  flashColor: 0xffe08a,
  traceLife: 0.09,
  foeRange: 34,
  copRange: 26,
  regenRate: 2.5,
  flashPower: 14,
  flashMs: 60,
};

// A glowing line between two points, for tracers and staged beams.
function makeBeam(from, to, opacity) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: TUNING.traceColor,
    transparent: true,
    opacity,
  });
  return new THREE.Line(geo, mat);
}

// One ray against one target: the distance along the ray when the target
// is hit, or null when the ray misses or passes behind it.
function testRay(ox, oz, dirX, dirZ, target, maxDist) {
  if (!target.isAlive()) return null;
  const relX = target.px - ox;
  const relZ = target.pz - oz;
  const along = relX * dirX + relZ * dirZ;
  if (along < 0 || along > maxDist) return null;
  const perp = Math.abs(relX * dirZ - relZ * dirX);
  if (perp >= (target.size ?? 1.2)) return null;
  return along;
}

// --- target factories: one per kind of thing a bullet can hit ---
// A hostile: 3 health, falls flat when killed, counts toward the mission.
function makeFoeTarget(foe, player, missions) {
  return {
    px: foe.x,
    pz: foe.z,
    size: 1.4,
    isAlive: () => !foe.dead,
    applyHit: (dmg) => {
      foe.health -= dmg;
      if (foe.health > 0) return;
      foe.dead = true;
      foe.mesh.rotation.x = Math.PI / 2;
      foe.mesh.position.y = 0.3;
      missions.active.killed += 1;
      player.addWanted(1, 'shooting');
    },
  };
}

// A police car: slows when shot, dies at 0 health, costs a wanted star.
function makeCopTarget(car, player) {
  return {
    px: car.x,
    pz: car.z,
    size: 2.2,
    isAlive: () => !car.dead,
    applyHit: (dmg) => {
      car.speed *= 0.4;
      car.health = (car.health ?? 4) - dmg;
      if (car.health > 0) return;
      car.dead = true;
      car.speed = 0;
      player.addWanted(1, 'shooting at police');
    },
  };
}

// A pedestrian: dies on any hit, scares the crowd, costs a wanted star.
function makeWalkerTarget(walker, player, peds) {
  return {
    px: walker.x,
    pz: walker.z,
    size: 1.0,
    isAlive: () => !walker.dead,
    applyHit: () => {
      peds.kill(walker);
      player.addWanted(1, 'hitting a pedestrian');
      peds.scare(walker.x, walker.z, 25);
    },
  };
}

export class Combat {
  constructor(scene, audio, arsenal) {
    this.scene = scene;
    this.audio = audio;
    this.arsenal = arsenal;
    this.tracers = [];
    this.flash = new THREE.PointLight(TUNING.flashColor, 0, 12);
    this.scene.add(this.flash);
    this.shootCooldown = 0;
    this.policeShootTimer = 0;
    this.onShotFired = null; // wired by main.js: viewmodel flash + sound
    this.onBusted = null; // wired by main.js: bail, respawn, save
  }

  // A persistent muzzle flash + tracer for staged screenshots: never fades.
  // Scale lets a shot size the flash to the weapon (rifle > pistol).
  stageFlash(from, to, scale = 0.9) {
    const burst = makeFlashSprite(scale);
    burst.position.set(from.x, from.y, from.z);
    burst.visible = true;
    this.scene.add(burst);
    const beam = makeBeam(from, to, 0.95);
    this.scene.add(beam);
    return { flash: burst, line: beam };
  }

  // Where Mara's muzzle is in the world, for the tracer start + flash.
  muzzlePoint(player) {
    const pos = new THREE.Vector3();
    if (player.muzzle) player.muzzle.getWorldPosition(pos);
    else pos.set(player.x, 1.4, player.z);
    return pos;
  }

  // Fire one pellet along a spread heading; returns the target it hit and
  // the distance it flew, or null when it hit nothing.
  shootPellet(ox, oz, heading, gun, targets) {
    const aim = heading + (Math.random() - 0.5) * 2 * gun.spread;
    const dirX = Math.sin(aim);
    const dirZ = Math.cos(aim);
    let hit = null;
    let bestDist = gun.range;
    for (const target of targets) {
      const dist = testRay(ox, oz, dirX, dirZ, target, bestDist);
      if (dist === null) continue;
      hit = target;
      bestDist = dist;
    }
    if (!hit) return null;
    hit.applyHit(gun.damage);
    return { target: hit, dist: bestDist };
  }

  // Player shoots from their position along their heading (mouse aim
  // adjusts it). Returns the target hit, or null.
  playerShoot(player, aimHeading, targets) {
    if (player.inCar) return null;
    const gun = this.arsenal.def();
    if (!this.arsenal.pullTrigger()) return null; // cooldown, dry mag or reloading
    this.audio.gunshot();
    const tip = this.muzzlePoint(player);
    const px = player.x;
    const pz = player.z;
    let hitTarget = null;
    let stopDist = gun.range;
    for (let p = 0; p < gun.pellets; p++) {
      const pellet = this.shootPellet(px, pz, aimHeading, gun, targets);
      if (pellet === null) continue;
      // The tracer stops at the closest hit across all pellets.
      stopDist = Math.min(stopDist, pellet.dist);
      hitTarget = pellet.target;
    }
    const dirX = Math.sin(aimHeading);
    const dirZ = Math.cos(aimHeading);
    const endX = px + dirX * stopDist;
    const endZ = pz + dirZ * stopDist;
    this.addTracer(tip.x, tip.y, tip.z, endX, 1.3, endZ);
    this.flash.position.set(tip.x + dirX * 0.6, tip.y, tip.z + dirZ * 0.6);
    this.flash.intensity = TUNING.flashPower;
    setTimeout(() => { this.flash.intensity = 0; }, TUNING.flashMs);
    player.showGunFlash();
    this.onShotFired?.();
    return hitTarget;
  }

  addTracer(ax, ay, az, bx, by, bz) {
    const line = makeBeam({ x: ax, y: ay, z: az }, { x: bx, y: by, z: bz }, 0.9);
    this.scene.add(line);
    this.tracers.push({ line, life: TUNING.traceLife });
  }

  // Age the tracers out: a tracer lives 0.09s, then its line is removed
  // from the scene and its geometry disposed.
  ageTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const trace = this.tracers[i];
      trace.life -= dt;
      if (trace.life > 0) continue;
      this.scene.remove(trace.line);
      trace.line.geometry.dispose();
      this.tracers.splice(i, 1);
    }
  }

  update(dt, player, missions, police, peds) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.ageTracers(dt);
    this.returnFireHostiles(dt, player, missions);
    this.returnFirePolice(dt, player, police);
    // Slow health regen out of danger.
    if (player.wanted === 0 && player.health < 100 && player.health > 0) {
      player.health = Math.min(100, player.health + TUNING.regenRate * dt);
    }
    void peds;
  }

  // Hostiles shoot back at the player.
  returnFireHostiles(dt, player, missions) {
    for (const foe of missions.hostiles) {
      if (foe.dead) continue;
      const dist = Math.hypot(player.pos.x - foe.x, player.pos.z - foe.z);
      foe.shootTimer -= dt;
      // Health bar faces the camera-ish: keep it level.
      foe.hpMesh.scale.x = clamp(foe.health / 3, 0, 1);
      if (dist >= TUNING.foeRange || foe.shootTimer > 0) continue;
      foe.shootTimer = 1.4 + Math.random() * 0.8;
      foe.mesh.lookAt(player.pos.x, 1.1, player.pos.z);
      this.addTracer(foe.x, 1.3, foe.z, player.pos.x, 1.2, player.pos.z);
      this.audio.gunshot();
      if (Math.random() < 0.45) {
        this.hurtPlayer(player, 7, "A rival's bullet found you.");
      }
    }
  }

  // Police shoot when close and wanted, more accurate at higher stars.
  returnFirePolice(dt, player, police) {
    this.policeShootTimer -= dt;
    if (player.wanted <= 0 || this.policeShootTimer > 0) return;
    this.policeShootTimer = 1.1 - player.wanted * 0.1;
    let closest = null;
    let best = 1e9;
    for (const car of police.cars) {
      const d = Math.hypot(player.pos.x - car.x, player.pos.z - car.z);
      if (d < best) {
        best = d;
        closest = car;
      }
    }
    if (!closest || best >= TUNING.copRange) return;
    this.addTracer(closest.x, 1.2, closest.z, player.pos.x, 1.2, player.pos.z);
    if (Math.random() < 0.25 + player.wanted * 0.05) {
      this.hurtPlayer(player, 5, 'The police shot you down.');
    }
  }

  hurtPlayer(player, amount, reason) {
    if (player.health <= 0) return;
    player.health -= amount;
    if (player.health > 0) return;
    player.health = 0;
    this.onBusted?.(reason);
  }

  // --- target list: everything the player's shots can hit this frame ---
  foeTargets(player, missions) {
    const list = [];
    for (const foe of missions.hostiles) {
      if (foe.dead) continue;
      list.push(makeFoeTarget(foe, player, missions));
    }
    return list;
  }

  copTargets(player, police) {
    const list = [];
    for (const car of police.cars) {
      list.push(makeCopTarget(car, player));
    }
    return list;
  }

  walkerTargets(player, peds) {
    const list = [];
    for (const walker of peds.peds) {
      if (walker.dead) continue;
      list.push(makeWalkerTarget(walker, player, peds));
    }
    return list;
  }

  // Build the target list the player's shots can hit this frame.
  buildTargets(player, missions, police, peds) {
    return [
      ...this.foeTargets(player, missions),
      ...this.copTargets(player, police),
      ...this.walkerTargets(player, peds),
    ];
  }
}
