// raceway.js — street races: 5 circuits, checkpoint gates, countdown start,
// 3 rival AI drivers, lap + best-lap timing, race HUD, cash rewards.
import * as THREE from 'three';
import { box, cyl, clamp, lerp, rand, pick, fmtClock, fmtCash } from './util.js';
import { spawnCar, CAR_MODELS } from './drive.js';

export const CIRCUITS = [
  { id: 'sunset-loop', name: 'Sunset Loop', laps: 3, reward: 1500, gates: [[-152, 0], [-152, -152], [0, -152], [152, -152], [152, 0], [152, 152], [0, 152], [-152, 152]] },
  { id: 'marina-sprint', name: 'Marina Sprint', laps: 2, reward: 2200, gates: [[76, 228], [228, 228], [228, 76], [76, 76], [76, 228]] },
  { id: 'palm-mile', name: 'Palm Mile', laps: 3, reward: 1800, gates: [[-228, -228], [228, -228], [228, 228], [-228, 228]] },
  { id: 'beach-dash', name: 'Beach Dash', laps: 2, reward: 2600, gates: [[-228, 304], [228, 304], [228, 152], [-228, 152]] },
  { id: 'grand-coral', name: 'Grand Coral GP', laps: 3, reward: 4000, gates: [[-304, -304], [304, -304], [304, 304], [-304, 304], [-304, 0], [304, 0]] },
];

export function createRaceState() {
  return {
    active: false, circuit: null, gateIndex: 0, lap: 1, countdown: 0,
    raceTime: 0, lapStart: 0, bestLap: null, lastLap: null,
    rivals: [], gates: [], position: 1, finished: false, rewardPaid: false,
  };
}

function makeGateMesh(G, x, z, n) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23c });
  const mat2 = new THREE.MeshBasicMaterial({ color: 0x1a1a22 });
  for (let i = 0; i < 8; i++) {
    const seg = box(1.1, 5.4, 0.3, i % 2 === 0 ? 0xffd23c : 0x1a1a22, -4 + i * 1.15, 2.7, 0);
    g.add(seg);
  }
  g.add(box(10.5, 0.5, 0.4, 0xffd23c, 0, 5.6, 0));
  const label = document.createElement('canvas');
  g.position.set(x, 0, z);
  G.scene.add(g);
  return g;
}

export function startRace(G, circuit) {
  const R = G.race;
  // clear old gates
  for (const g of R.gates) G.scene.remove(g);
  R.gates = [];
  R.active = true; R.circuit = circuit; R.gateIndex = 0; R.lap = 1;
  R.countdown = 3.2; R.raceTime = 0; R.lapStart = 0; R.bestLap = null;
  R.finished = false; R.rewardPaid = false; R.position = 4;
  // build gate meshes for this circuit
  for (const [gx, gz] of circuit.gates) {
    const mesh = makeGateMesh(G, gx, gz);
    R.gates.push(mesh);
  }
  // teleport player car to the start gate with rivals on the grid
  const [sx, sz] = circuit.gates[0];
  const pv = G.player.vehicle;
  if (pv) { pv.x = sx; pv.z = sz - 12; pv.heading = Math.PI; pv.speed = 0; }
  else { G.player.pos.set(sx, 1.2, sz - 12); }
  // 3 rival AI drivers on the grid
  for (const r of R.rivals) { G.scene.remove(r.group); const i = G.cars.indexOf(r); if (i >= 0) G.cars.splice(i, 1); }
  R.rivals = [];
  const rivalColors = [0x2a6aff, 0x9a4aff, 0x2ae06a];
  for (let i = 0; i < 3; i++) {
    const model = CAR_MODELS[(i + 1) % CAR_MODELS.length];
    const rival = spawnCar(G, model, sx + (i - 1) * 5, sz - 12 + (i % 2) * 6, Math.PI, {});
    rival.group.children[0].material = new THREE.MeshLambertMaterial({ color: rivalColors[i] });
    rival.cruise = 30 + i * 2;
    rival.raceGate = 0; rival.raceLap = 1; rival.raceProg = 0;
    R.rivals.push(rival);
  }
  G.hud.say(circuit.name + ' — ' + circuit.laps + ' laps, win for ' + fmtCash(circuit.reward), 3.5);
  G.hud.showRace(circuit);
  G.sound.countdown();
}

export function updateRace(G, dt) {
  const R = G.race;
  if (!R.active) return;
  if (R.countdown > 0) {
    R.countdown -= dt;
    G.hud.setCountdown(Math.ceil(Math.max(0, R.countdown)));
    if (R.countdown <= 0) { G.hud.setCountdown(0); G.sound.blip(880, 0.2); }
    return;
  }
  R.raceTime += dt;
  const pv = G.player.vehicle || G.player.bike;
  const px = pv ? pv.x : G.player.pos.x, pz = pv ? pv.z : G.player.pos.z;
  const gates = R.circuit.gates;
  const [gx, gz] = gates[R.gateIndex];
  if (Math.hypot(gx - px, gz - pz) < 12) {
    R.gateIndex++;
    G.sound.blip(660, 0.08);
    if (R.gateIndex >= gates.length) {
      R.gateIndex = 0;
      const lapTime = R.raceTime - R.lapStart;
      R.lastLap = lapTime;
      if (!R.bestLap || lapTime < R.bestLap) R.bestLap = lapTime;
      R.lapStart = R.raceTime;
      R.lap++;
      G.hud.say('LAP ' + Math.min(R.lap, R.circuit.laps) + ' — ' + fmtClock(lapTime * 1000), 2);
      if (R.lap > R.circuit.laps) finishRace(G, true);
    }
  }
  // rivals drive gate to gate
  for (const r of R.rivals) {
    const [rx, rz] = gates[r.raceGate % gates.length];
    const dx = rx - r.x, dz = rz - r.z;
    const d = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(dx / d, dz / d);
    let dh = want - r.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    r.heading += clamp(dh, -1.4 * dt, 1.4 * dt);
    r.speed = lerp(r.speed, r.cruise, dt * 0.5);
    r.x += Math.sin(r.heading) * r.speed * dt;
    r.z += Math.cos(r.heading) * r.speed * dt;
    r.group.position.set(r.x, 0, r.z);
    r.group.rotation.y = r.heading;
    for (const w of r.wheels) w.rotation.x += r.speed * dt * 2.2;
    if (d < 12) {
      r.raceGate++;
      if (r.raceGate >= gates.length) { r.raceGate = 0; r.raceLap++; }
    }
    r.raceProg = (r.raceLap - 1) * gates.length + r.raceGate - d / 100;
  }
  // live position: player progress vs rivals
  const myProg = (R.lap - 1) * gates.length + R.gateIndex;
  let pos = 1;
  for (const r of R.rivals) if (r.raceProg > myProg) pos++;
  R.position = pos;
  G.hud.updateRace(R);
  // quitting: drive too far from the circuit ends the race
  if (Math.hypot(px, pz) > 420) { finishRace(G, false); }
}

export function finishRace(G, won) {
  const R = G.race;
  R.active = false; R.finished = true;
  for (const g of R.gates) G.scene.remove(g);
  R.gates = [];
  for (const r of R.rivals) { G.scene.remove(r.group); const i = G.cars.indexOf(r); if (i >= 0) G.cars.splice(i, 1); }
  R.rivals = [];
  G.hud.hideRace();
  if (won) {
    const prize = R.circuit.reward + (R.position === 1 ? 1000 : 0);
    G.player.cash += prize;
    R.rewardPaid = true;
    G.hud.say('RACE WON — P' + R.position + ' — +' + fmtCash(prize) + ' — best lap ' + (R.bestLap ? fmtClock(R.bestLap * 1000) : '—'), 4);
    G.missions.raceWins = (G.missions.raceWins || 0) + 1;
    G.sound.win();
  } else {
    G.hud.say('Race over — drive back to the start line to try again', 3);
  }
  G.save.save();
}

export function raceStartPoints() {
  return CIRCUITS.map((c) => ({ name: c.name, x: c.gates[0][0], z: c.gates[0][1], circuit: c }));
}
