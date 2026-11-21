// shots.js — screenshot staging: when the page loads with ?shot=<name>, the
// start screen is skipped and the world is staged into a dense, legible
// frame for that shot, then window.__shotReady is set after a few frames.
// 1-chase: 5-star chase in the neon casino district (the cover).
// 2-foot: on-foot carjacking next to a stolen car.
// 3-marina: boats at the marina at sunset.
// 4-race: race start on Marina Row with rivals + gates.
import * as THREE from 'three';
import { makeVehicle } from './drive.js';
import { setWanted, makeCopMesh, makeHelicopter } from './cops.js';
import { startRace } from './raceway.js';
import { giveWeapon } from './fight.js';
import { MISSIONS } from './story.js';
import { MISSIONS2 } from './story2.js';

export const SHOT_NAMES = ['chase', 'foot', 'marina', 'race'];

export function stageShot(W, name) {
  W.shot = name;
  W.started = true;
  const p = W.player;
  // Mute audio in shot mode (headless has no gesture anyway).
  if (W.sound) W.sound.muted = true;
  // Hide the start screen.
  const start = document.getElementById('start-screen');
  if (start) start.style.display = 'none';
  const hud = document.getElementById('hud');
  if (hud) hud.style.opacity = '1';

  if (name === 'chase') {
    // Player sports car heading EAST down the z=-52 road (a real road line),
    // neon casino district on the left (north), roadblock with spike strip
    // ahead, 4 patrol cars flanking, helicopter overhead, explosion glow left.
    const car = makeVehicle(W, 0xd92828, -130, -52, Math.PI / 2, { topSpeed: 38, name: 'Comet GT', player: true });
    W.player.mode = 'car';
    W.player.vehicle = car;
    car.isPlayer = true;
    p.x = car.x; p.z = car.z; p.heading = car.heading;
    p.mesh.visible = false;
    p.cash = 86420;
    p.wanted = 5;
    setWanted(W, 5);
    car.speed = 16;
    car.nitro = 82;
    car.damage = 18;
    // 4 police cars: two flanking beside the player, two closing ahead.
    const copSpots = [
      { x: -112, z: -46, h: Math.PI / 2 },
      { x: -112, z: -58, h: Math.PI / 2 },
      { x: -96, z: -45, h: Math.PI / 2 },
      { x: -96, z: -59, h: Math.PI / 2 },
    ];
    for (const s of copSpots) {
      const mesh = makeCopMesh();
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.h;
      W.scene.add(mesh);
      W.cops.push({ mesh, x: s.x, z: s.z, heading: s.h, speed: 24, topSpeed: 33, sirenPhase: Math.random() });
    }
    // Roadblock with spike strip ahead, between the player and the casino row.
    spawnStagedRoadblock(W, -95, -52, Math.PI / 2);
    // Helicopter overhead with the searchlight on the player — spawn it now
    // so the cops update does not re-flash the banner mid-shot.
    W.heli = makeHelicopter(W);
    // Explosion + fire + smoke glow to the left of the road.
    W.fx.explode(-98, 1, -64, true);
    W.fx.burst(-98, 1, -64, 'smoke', 16);
    W.fx.burst(-98, 1, -64, 'fire', 10);
    W.objective = 'M18 — GETAWAY DRIVER: lose the 5-star chase — CASINO HEIST ESCAPE';
    W.story2.active = { ...MISSIONS2[5], progress: 0, timer: 0, stars: 5 };
    W.hudFlash('CASINO HEIST — ESCAPE!');
    W.camMode = 'chase';
  } else if (name === 'foot') {
    // On foot on the x=-52 road next to a just-jacked Comet GT, cops arriving.
    p.x = -52;
    p.z = 20;
    p.heading = Math.PI;
    p.mode = 'foot';
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    p.cash = 12480;
    p.wanted = 2;
    setWanted(W, 2);
    giveWeapon(W, 'smg', 90);
    p.weapon = 'smg';
    const car = makeVehicle(W, 0xd92828, -48.5, 20, Math.PI, { topSpeed: 34, name: 'Comet GT' });
    car.speed = 0;
    W.objective = 'M3 — HOT WHEELS: jack the Comet GT and lose the heat';
    W.story.active = { ...MISSIONS[2], progress: 0, timer: 0 };
    W.hudFlash('CARJACKED — COMET GT');
    W.camMode = 'follow';
    W.camYaw = Math.PI;
  } else if (name === 'marina') {
    // At the marina: player boat sailing north in the open bay toward the
    // docks, city skyline + sunset behind it, no palms in the camera lane.
    const b = W.boats[0];
    b.x = 235;
    b.z = 90;
    b.heading = Math.PI;
    b.mesh.position.set(b.x, 0.3, b.z);
    b.mesh.rotation.y = b.heading;
    p.mode = 'boat';
    p.vehicle = b;
    b.isPlayer = true;
    b.moored = false;
    p.x = b.x; p.z = b.z; p.heading = b.heading;
    p.mesh.visible = false;
    p.cash = 31200;
    p.wanted = 1;
    setWanted(W, 1);
    b.speed = 12;
    W.objective = 'M20 — ESCAPE BY BOAT: sail south past the buoy';
    W.story2.active = { ...MISSIONS2[7], progress: 0, timer: 0 };
    W.hudFlash('MARINA — SET SAIL');
    W.camMode = 'chase';
  } else if (name === 'race') {
    // Race start: player on the grid, 3 rivals, gates down Marina Row.
    startRace(W, 'marina-mile');
    W.race.countdown = 0.4;
    p.cash = 45600;
    p.wanted = 0;
    setWanted(W, 0);
    W.objective = 'RACE: MARINA MILE — 2 LAPS — beat Vex, Marlow and Tide';
    W.story2.active = { ...MISSIONS2[0], progress: 0, timer: 0 };
    W.hudFlash('MARINA MILE — 3… 2… 1…');
    W.camMode = 'chase';
  }
  // Clear any flash banner so the still is clean (the objective banner
  // carries the message instead).
  W.flashTimer = 0;
  W.camSnap = true;
  const flashEl = document.getElementById('hud-flash');
  if (flashEl) flashEl.style.opacity = '0';
  // Let the scene settle, then signal the screenshot runner.
  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames >= 6) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function spawnStagedRoadblock(W, x, z, heading) {
  // Two patrol cars angled across the road + a spike strip between them.
  for (const side of [-1, 1]) {
    const mesh = makeCopMesh();
    const ox = Math.cos(heading) * side * 5;
    const oz = -Math.sin(heading) * side * 5;
    mesh.position.set(x + ox, 0, z + oz);
    mesh.rotation.y = heading + Math.PI + side * 0.5;
    W.scene.add(mesh);
    W.cops.push({
      mesh, x: x + ox, z: z + oz, heading: heading + Math.PI,
      speed: 0, topSpeed: 0, sirenPhase: 0, roadblock: true,
    });
  }
  // Spike strip: dark base + steel spikes across the lane.
  const strip = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.7 }));
  strip.add(base);
  const spikeGeo = new THREE.ConeGeometry(0.14, 0.55, 4);
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.9 });
  for (let i = -5; i <= 5; i++) {
    const sp = new THREE.Mesh(spikeGeo, spikeMat);
    sp.position.set(i * 0.95, 0.3, 0);
    sp.rotation.z = 0.5;
    strip.add(sp);
  }
  strip.position.set(x, 0.1, z);
  strip.rotation.y = heading; // long axis across the road
  W.scene.add(strip);
  W.stagedStrip = strip;
  // A real roadblock entry so the spike logic can trigger in play.
  W.roadblocks.push({ group: strip, x, z, heading, cars: [], strip, life: 999, hit: false });
}
