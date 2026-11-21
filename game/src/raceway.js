// raceway.js — the street-race system: 5 circuits around Coral Bay, checkpoint
// gates, a countdown start, 3 rival AI drivers, lap + best-lap timing, a race
// HUD (position / lap / time) and cash rewards.
import * as THREE from 'three';
import { rand, pick, clamp, damp, angleLerp, dist2, fmtLap, fmtCash } from './util.js';
import { makeCarMesh } from './drive.js';
import { GRID } from './coralcity.js';

export const RACES = [
  { id: 'marina-mile', name: 'MARINA MILE', laps: 2, reward: 1200, color: 0xffd23e },
  { id: 'casino-loop', name: 'CASINO LOOP', laps: 2, reward: 1800, color: 0xff2e88 },
  { id: 'beach-sprint', name: 'BEACH SPRINT', laps: 3, reward: 1500, color: 0x22e6ff },
  { id: 'downtown-dash', name: 'DOWNTOWN DASH', laps: 3, reward: 2400, color: 0xff7a1a },
  { id: 'coral-grand-prix', name: 'CORAL GRAND PRIX', laps: 3, reward: 3500, color: 0xc86bff },
];

// Waypoint loops (x, z) for each circuit, laid out on the road grid.
function circuitPoints(raceId) {
  switch (raceId) {
    case 'marina-mile':
      return [[0, 0], [104, 0], [156, 0], [156, 104], [104, 104], [0, 104], [-52, 104], [-52, 0]];
    case 'casino-loop':
      return [[-78, -52], [0, -52], [52, -52], [52, -104], [0, -104], [-78, -104], [-104, -104], [-104, -52]];
    case 'beach-sprint':
      return [[-104, 156], [0, 156], [104, 156], [156, 156], [156, 208], [0, 208], [-104, 208], [-156, 156]];
    case 'downtown-dash':
      return [[0, 0], [52, 0], [52, 52], [0, 52], [-52, 52], [-52, 0], [-52, -52], [0, -52]];
    case 'coral-grand-prix':
      return [[0, 0], [104, 0], [156, 0], [156, 104], [156, 156], [104, 156], [0, 156], [-104, 156], [-104, 52], [-104, -52], [-52, -52], [-52, 0]];
    default:
      return [[0, 0], [52, 0], [52, 52], [0, 52]];
  }
}

export function initRace(W) {
  W.race = {
    active: false,
    def: null,
    points: [],
    gates: [],
    rivals: [],
    checkpoint: 0,
    lap: 1,
    lapStart: 0,
    bestLap: Infinity,
    raceTime: 0,
    countdown: 0,
    position: 4,
    finished: false,
  };
}

function makeGate(color) {
  const g = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 6, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  for (const sx of [-6, 6]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(sx, 3, 0);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(12.4, 1.1, 0.5),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  beam.position.y = 5.6;
  g.add(beam);
  const glow = new THREE.PointLight(color, 40, 26, 1.8);
  glow.position.y = 5;
  g.add(glow);
  return g;
}

export function startRace(W, raceId) {
  const def = RACES.find((r) => r.id === raceId) || RACES[0];
  const race = W.race;
  // Clear any previous gates / rivals.
  for (const g of race.gates) W.scene.remove(g);
  for (const r of race.rivals) W.scene.remove(r.mesh);
  race.gates = [];
  race.rivals = [];
  race.def = def;
  race.points = circuitPoints(raceId);
  race.checkpoint = 0;
  race.lap = 1;
  race.bestLap = Infinity;
  race.raceTime = 0;
  race.countdown = 3.2;
  race.finished = false;
  race.active = true;
  // Gates at every waypoint.
  for (let i = 0; i < race.points.length; i++) {
    const [x, z] = race.points[i];
    const gate = makeGate(def.color);
    gate.position.set(x, 0, z);
    const next = race.points[(i + 1) % race.points.length];
    gate.rotation.y = Math.atan2(next[0] - x, next[1] - z);
    W.scene.add(gate);
    race.gates.push(gate);
  }
  // 3 rival drivers lined up behind the player.
  const rivalColors = [0x1a6fd4, 0x22b573, 0xff7a1a];
  const [sx, sz] = race.points[0];
  const [nx, nz] = race.points[1];
  const startHeading = Math.atan2(nx - sx, nz - sz);
  for (let i = 0; i < 3; i++) {
    const mesh = makeCarMesh(rivalColors[i]);
    const bx = sx - Math.sin(startHeading) * (15 + i * 6);
    const bz = sz - Math.cos(startHeading) * (15 + i * 6);
    mesh.position.set(bx, 0, bz);
    mesh.rotation.y = startHeading;
    W.scene.add(mesh);
    race.rivals.push({
      mesh, x: bx, z: bz, heading: startHeading,
      speed: 0, topSpeed: rand(24, 30), target: 1,
      progress: -15 - i * 6, // distance along the circuit
      name: ['VEX', 'MARLOW', 'TIDE'][i],
    });
  }
  // Put the player on the start line in their current vehicle (or a loaner),
  // 10 units behind the line so the start gate reads ahead, not on the camera.
  const px = sx - Math.sin(startHeading) * 10;
  const pz = sz - Math.cos(startHeading) * 10;
  if (!W.player.vehicle) {
    const loaner = W.parked?.[0];
    if (loaner) {
      W.player.x = px;
      W.player.z = pz;
      loaner.x = px;
      loaner.z = pz;
      loaner.heading = startHeading;
      loaner.mesh.position.set(px, 0, pz);
      loaner.mesh.rotation.y = startHeading;
      // Enter the loaner directly.
      W.player.mode = 'car';
      W.player.vehicle = loaner;
      loaner.isPlayer = true;
      W.player.mesh.visible = false;
    }
  } else {
    const v = W.player.vehicle;
    v.x = px;
    v.z = pz;
    v.heading = startHeading;
    v.speed = 0;
    v.mesh.position.set(px, 0, pz);
    v.mesh.rotation.y = startHeading;
    W.player.x = px;
    W.player.z = pz;
    W.player.heading = startHeading;
  }
  W.hudFlash(def.name + ' — GET READY…');
  W.objective = 'RACE: ' + def.name + ' — ' + def.laps + ' LAPS';
  return def;
}

export function updateRace(W, dt) {
  const race = W.race;
  if (!race.active) return;
  if (race.countdown > 0) {
    race.countdown -= dt;
    const n = Math.ceil(race.countdown);
    W.raceBanner = race.countdown > 0.2 ? (n > 0 ? String(n) : 'GO!') : '';
    if (race.countdown <= 0) {
      race.lapStart = W.time;
      W.hudFlash('GO! — ' + race.def.name);
      W.raceBanner = 'GO!';
    }
    return;
  }
  race.raceTime += dt;
  const p = W.player;
  // Player progress: distance to the current checkpoint gate.
  const cp = race.points[race.checkpoint];
  const d = dist2(p.x, p.z, cp[0], cp[1]);
  if (d < 9) {
    race.checkpoint = (race.checkpoint + 1) % race.points.length;
    W.sound?.checkpoint();
    if (race.checkpoint === 0) {
      const lapTime = W.time - race.lapStart;
      race.bestLap = Math.min(race.bestLap, lapTime);
      race.lap += 1;
      race.lapStart = W.time;
      W.hudFlash('LAP ' + Math.min(race.lap, race.def.laps) + ' — ' + fmtLap(lapTime));
      if (race.lap > race.def.laps) {
        finishRace(W, true);
        return;
      }
    }
  }
  // Rivals follow the waypoints with a little rubber-banding.
  for (const r of race.rivals) {
    const tp = race.points[r.target];
    const th = Math.atan2(tp[0] - r.x, tp[1] - r.z);
    r.heading = angleLerp(r.heading, th, 1 - Math.exp(-2.4 * dt));
    const playerAhead = raceProgress(W) > r.progress;
    const targetSpeed = r.topSpeed * (playerAhead ? 1.06 : 0.97) * rand(0.98, 1.02);
    r.speed = damp(r.speed, targetSpeed, 1.2, dt);
    r.x += Math.sin(r.heading) * r.speed * dt;
    r.z += Math.cos(r.heading) * r.speed * dt;
    if (dist2(r.x, r.z, tp[0], tp[1]) < 8) {
      r.target = (r.target + 1) % race.points.length;
      r.progress += 1;
    }
    r.mesh.position.set(r.x, 0, r.z);
    r.mesh.rotation.y = r.heading;
    const spin = r.speed * dt / 0.38;
    for (const w of r.mesh.userData.wheels) w.rotation.x += spin;
  }
  // Position: count rivals ahead of the player by checkpoint progress.
  const myProg = raceProgress(W);
  let ahead = 0;
  for (const r of race.rivals) if (r.progress > myProg) ahead += 1;
  race.position = ahead + 1;
  W.raceBanner = '';
}

function raceProgress(W) {
  const race = W.race;
  const p = W.player;
  const cp = race.points[race.checkpoint];
  const done = (race.lap - 1) * race.points.length + race.checkpoint;
  const d = dist2(p.x, p.z, cp[0], cp[1]);
  return done * 100 - d;
}

export function finishRace(W, won) {
  const race = W.race;
  race.active = false;
  race.finished = true;
  for (const g of race.gates) W.scene.remove(g);
  race.gates = [];
  for (const r of race.rivals) W.scene.remove(r.mesh);
  race.rivals = [];
  if (won && race.position <= 3) {
    const prize = race.def.reward * (race.position === 1 ? 1 : race.position === 2 ? 0.6 : 0.35);
    W.player.cash += Math.round(prize);
    W.hudFlash('RACE WON — P' + race.position + ' — +' + fmtCash(prize));
    W.events.push({ type: 'racewin', race: race.def.id, pos: race.position, prize: Math.round(prize) });
    W.objective = 'RACE COMPLETE — ' + race.def.name;
  } else {
    W.hudFlash('RACE OVER — P' + race.position + ' — NO PRIZE');
    W.events.push({ type: 'racelose', race: race.def.id, pos: race.position });
  }
  W.raceBanner = '';
}

export function quitRace(W) {
  const race = W.race;
  if (!race.active) return;
  race.active = false;
  for (const g of race.gates) W.scene.remove(g);
  race.gates = [];
  for (const r of race.rivals) W.scene.remove(r.mesh);
  race.rivals = [];
  W.hudFlash('RACE QUIT');
  W.raceBanner = '';
}
