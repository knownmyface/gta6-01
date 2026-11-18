// Combat for CORAL HEAT v2: hitscan shooting on foot, tracers, muzzle flash,
// hostiles and police shooting back, health, and getting busted. Shots now
// go through the arsenal — damage, pellets, spread and fire rate come from
// the equipped weapon, and every shot lights the viewmodel + the gun in
// Mara's hand.
import * as THREE from 'three';
import { clamp } from './rng.js';
import { makeFlashSprite } from './weapons.js';

export class Combat {
  constructor(scene, audio, arsenal) {
    this.scene = scene;
    this.audio = audio;
    this.arsenal = arsenal;
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffe08a, 0, 12);
    this.scene.add(this.flash);
    this.shootCooldown = 0;
    this.policeShootTimer = 0;
    this.onShotFired = null; // wired by main.js: viewmodel flash + sound
  }

  // A persistent muzzle flash + tracer for staged screenshots: never fades.
  // scale lets a shot size the flash to the weapon (rifle > pistol).
  stageFlash(from, to, scale = 0.9) {
    const flash = makeFlashSprite(scale);
    flash.position.set(from.x, from.y, from.z);
    flash.visible = true;
    this.scene.add(flash);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    return { flash, line };
  }

  // Player shoots from their position along their heading (mouse aim adjusts it).
  playerShoot(player, aimHeading, targets) {
    if (player.inCar) return null;
    const w = this.arsenal.def();
    if (!this.arsenal.pullTrigger()) return null; // cooldown, dry mag or reloading
    this.audio.gunshot();
    // muzzle world position (the gun in Mara's hand), else chest height
    const m = new THREE.Vector3();
    if (player.muzzle) player.muzzle.getWorldPosition(m);
    else m.set(player.x, 1.4, player.z);
    const ox = player.x, oz = player.z;
    let anyHit = null;
    let farT = w.range;
    for (let p = 0; p < w.pellets; p++) {
      const h = aimHeading + (Math.random() - 0.5) * 2 * w.spread;
      const dx = Math.sin(h), dz = Math.cos(h);
      let best = null, bestT = w.range;
      for (const t of targets) {
        if (!t.alive()) continue;
        const rx = t.x - ox, rz = t.z - oz;
        const along = rx * dx + rz * dz;
        if (along < 0 || along > bestT) continue;
        const perp = Math.abs(rx * dz - rz * dx);
        if (perp < (t.radius ?? 1.2)) { best = t; bestT = along; }
      }
      if (best) { best.hit(w.damage); anyHit = best; farT = Math.min(farT, bestT); }
    }
    const dx = Math.sin(aimHeading), dz = Math.cos(aimHeading);
    const ex = ox + dx * farT, ez = oz + dz * farT;
    this.spawnTracer(m.x, m.y, m.z, ex, 1.3, ez);
    this.flash.position.set(m.x + dx * 0.6, m.y, m.z + dz * 0.6);
    this.flash.intensity = 14;
    setTimeout(() => { this.flash.intensity = 0; }, 60);
    player.showGunFlash();
    this.onShotFired?.();
    return anyHit;
  }

  spawnTracer(x1, y1, z1, x2, y2, z2) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  update(dt, player, missions, police, peds) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    // hostiles shoot back at the player
    for (const h of missions.hostiles) {
      if (h.dead) continue;
      const d = Math.hypot(player.pos.x - h.x, player.pos.z - h.z);
      h.shootTimer -= dt;
      if (d < 34 && h.shootTimer <= 0) {
        h.shootTimer = 1.4 + Math.random() * 0.8;
        h.mesh.lookAt(player.pos.x, 1.1, player.pos.z);
        this.spawnTracer(h.x, 1.3, h.z, player.pos.x, 1.2, player.pos.z);
        this.audio.gunshot();
        if (Math.random() < 0.45) this.damagePlayer(player, 7, 'A rival\'s bullet found you.');
      }
      // hostile health bar faces the camera-ish: keep it level
      h.hpMesh.scale.x = clamp(h.health / 3, 0, 1);
    }
    // police shoot when close and wanted, more accurate at higher stars
    this.policeShootTimer -= dt;
    if (player.wanted > 0 && this.policeShootTimer <= 0) {
      this.policeShootTimer = 1.1 - player.wanted * 0.1;
      let nearest = null, nd = 1e9;
      for (const c of police.cars) {
        const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
        if (d < nd) { nd = d; nearest = c; }
      }
      if (nearest && nd < 26) {
        this.spawnTracer(nearest.x, 1.2, nearest.z, player.pos.x, 1.2, player.pos.z);
        if (Math.random() < 0.25 + player.wanted * 0.05) this.damagePlayer(player, 5, 'The police shot you down.');
      }
    }
    // slow health regen out of danger
    if (player.wanted === 0 && player.health < 100 && player.health > 0) {
      player.health = Math.min(100, player.health + 2.5 * dt);
    }
  }

  damagePlayer(player, dmg, cause) {
    if (player.health <= 0) return;
    player.health -= dmg;
    if (player.health <= 0) {
      player.health = 0;
      this.onBusted?.(cause);
    }
  }

  // Build the target list the player's shots can hit this frame.
  buildTargets(player, missions, police, peds) {
    const targets = [];
    for (const h of missions.hostiles) {
      if (h.dead) continue;
      targets.push({
        x: h.x, z: h.z, radius: 1.4, alive: () => !h.dead,
        hit: (dmg) => {
          h.health -= dmg;
          if (h.health <= 0) {
            h.dead = true;
            h.mesh.rotation.x = Math.PI / 2;
            h.mesh.position.y = 0.3;
            missions.active.killed += 1;
            player.addWanted(1, 'shooting');
          }
        },
      });
    }
    for (const c of police.cars) {
      targets.push({
        x: c.x, z: c.z, radius: 2.2, alive: () => !c.dead,
        hit: (dmg) => {
          c.speed *= 0.4;
          c.health = (c.health ?? 4) - dmg;
          if (c.health <= 0) { c.dead = true; c.speed = 0; }
          player.addWanted(1, 'shooting at police');
        },
      });
    }
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
}
