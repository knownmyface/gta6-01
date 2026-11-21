// Coral Heat — street races: five circuits around Coral Bay, checkpoint
// gates, a countdown start, three rival AI drivers, lap + best-lap timing,
// a live race HUD (position / lap / time) and cash rewards.
import * as THREE from 'three';
import { clamp, rand, pick, fmtClock, fmtMoney } from './util.js';
import { makeVehicleMesh } from './drive.js';

export const CIRCUITS = [
  { id: 'marina', name: 'Marina Sprint', laps: 2, prize: 2500, gates: [[-222, -240], [-222, 0], [-222, 240], [-60, 240], [-60, -240]] },
  { id: 'casino', name: 'Casino Loop', laps: 2, prize: 3200, gates: [[180, -180], [180, 60], [0, 60], [0, -180]] },
  { id: 'beach', name: 'Beachfront Dash', laps: 3, prize: 4000, gates: [[-222, 240], [60, 240], [60, 0], [-60, 0], [-60, 240]] },
  { id: 'downtown', name: 'Downtown GP', laps: 3, prize: 5500, gates: [[0, 0], [120, 0], [120, 120], [-120, 120], [-120, 0]] },
  { id: 'grand', name: 'Coral Grand Tour', laps: 2, prize: 8000, gates: [[-222, -240], [240, -240], [240, 240], [-222, 240], [0, 0]] },
];

const RIVAL_COLORS = [0xff8a1e, 0x7a4ad9, 0x2ed9a8];

export function defineCircuits(G) {
  G.circuits = CIRCUITS;
  G.race = {
    active: false, circuit: null, lap: 1, gate: 0,
    time: 0, bestLap: null, lapStart: 0, countdown: 0,
    rivals: [], position: 4, gateMeshes: [], finished: false,
  };
}

function makeGateMesh(x, z, index) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd75a, transparent: true, opacity: 0.9 });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const sx of [-7, 7]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 8), postMat);
    post.position.set(sx, 3, 0);
    g.add(post);
  }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshBasicMaterial({ color: 0xffd75a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  banner.position.set(0, 5.6, 0);
  g.add(banner);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
  );
  panel.position.set(0, 5.6, 0.06);
  g.add(panel);
  g.position.set(x, 0, z);
  g.userData.index = index;
  return g;
}

export function startRace(G, circuitId) {
  const circuit = G.circuits.find((c) => c.id === circuitId) || G.circuits[0];
  if (G.player.mode !== 'car' || !G.player.car) {
    if (G.hud) G.hud.toast('You need a car to race — steal one first (E near traffic)');
    return false;
  }
  // clear old gates
  for (const gm of G.race.gateMeshes) G.scene.remove(gm);
  G.race.gateMeshes = [];
  circuit.gates.forEach(([gx, gz], i) => {
    const gm = makeGateMesh(gx, gz, i);
    // face the banner toward the driver approaching this gate: the
    // banner's normal must point back along the direction of travel
    const prev = circuit.gates[(i - 1 + circuit.gates.length) % circuit.gates.length];
    const tx = gx - prev[0];
    const tz = gz - prev[1];
    gm.rotation.y = Math.atan2(-tx, -tz);
    G.scene.add(gm);
    G.race.gateMeshes.push(gm);
  });
  // line the player + 3 rivals up at the first gate
  const [sx, sz] = circuit.gates[0];
  const heading = Math.atan2(circuit.gates[1][0] - sx, circuit.gates[1][1] - sz);
  G.player.car.pos.set(sx, 0, sz);
  G.player.car.heading = heading;
  G.player.car.speed = 0;
  G.player.pos.copy(G.player.car.pos);
  G.player.heading = heading;
  G.race.rivals = [];
  for (let i = 0; i < 3; i++) {
    const mesh = makeVehicleMesh(RIVAL_COLORS[i], 'sport');
    const rival = {
      mesh, pos: mesh.position, heading,
      speed: 0, top: rand(46, 54), gate: 0, lap: 1, progress: 0, finished: false,
      skill: rand(0.85, 1.0),
    };
    rival.pos.set(sx + (i - 1) * 4.5, 0, sz - 8 - i * 2);
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    G.race.rivals.push(rival);
  }
  G.race.active = true;
  G.race.circuit = circuit;
  G.race.lap = 1;
  G.race.gate = 0;
  G.race.time = 0;
  G.race.lapStart = 0;
  G.race.countdown = 3.2;
  G.race.finished = false;
  G.race.bestLap = G.bestLaps?.[circuit.id] ?? null;
  if (G.hud) {
    G.hud.banner(circuit.name.toUpperCase(), 'Beat 3 rivals · ' + circuit.laps + ' laps · Prize ' + fmtMoney(circuit.prize));
    G.hud.setObjective('Race: ' + circuit.name + ' — Lap 1/' + circuit.laps + ' · Gate 1/' + circuit.gates.length);
  }
  if (G.sfx) G.sfx('raceStart');
  return true;
}

function gateReached(G, pos, gate) {
  const [gx, gz] = gate;
  return Math.hypot(pos.x - gx, pos.z - gz) < 12;
}

export function updateRace(G, dt) {
  const r = G.race;
  if (!r.active) return;
  if (r.countdown > 0) {
    r.countdown -= dt;
    if (G.hud) {
      const n = Math.ceil(r.countdown);
      G.hud.setRaceCountdown(r.countdown <= 0 ? 'GO!' : String(n));
    }
    // hold everyone at the line during the countdown
    if (G.player.car) G.player.car.speed = 0;
    return;
  }
  if (G.hud) G.hud.setRaceCountdown('');
  r.time += dt;
  const circuit = r.circuit;
  // player gates
  if (gateReached(G, G.player.pos, circuit.gates[r.gate])) {
    r.gate += 1;
    if (G.sfx) G.sfx('checkpoint');
    if (r.gate >= circuit.gates.length) {
      r.gate = 0;
      const lapTime = r.time - r.lapStart;
      if (!r.bestLap || lapTime < r.bestLap) {
        r.bestLap = lapTime;
        G.bestLaps = G.bestLaps || {};
        G.bestLaps[circuit.id] = lapTime;
      }
      r.lap += 1;
      r.lapStart = r.time;
      if (r.lap > circuit.laps) {
        finishRace(G, true);
        return;
      }
      if (G.hud) G.hud.toast('Lap ' + r.lap + '/' + circuit.laps + ' — best ' + fmtClock(r.bestLap));
    }
    if (G.hud) {
      G.hud.setObjective('Race: ' + circuit.name + ' — Lap ' + r.lap + '/' + circuit.laps + ' · Gate ' + (r.gate + 1) + '/' + circuit.gates.length);
    }
  }
  // rivals drive gate to gate
  for (const rv of r.rivals) {
    if (rv.finished) continue;
    const target = circuit.gates[rv.gate];
    const dx = target[0] - rv.pos.x;
    const dz = target[1] - rv.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - rv.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    rv.heading += clamp(dh, -2.0 * dt, 2.0 * dt);
    const desired = rv.top * rv.skill * (Math.abs(dh) > 0.6 ? 0.55 : 1);
    rv.speed += clamp(desired - rv.speed, -26 * dt, 18 * dt);
    rv.pos.x += Math.sin(rv.heading) * rv.speed * dt;
    rv.pos.z += Math.cos(rv.heading) * rv.speed * dt;
    rv.mesh.position.copy(rv.pos);
    rv.mesh.rotation.y = rv.heading;
    rv.progress = (rv.lap - 1) * circuit.gates.length + rv.gate + (1 - clamp(dist / 120, 0, 1));
    if (dist < 11) {
      rv.gate += 1;
      if (rv.gate >= circuit.gates.length) {
        rv.gate = 0;
        rv.lap += 1;
        if (rv.lap > circuit.laps) rv.finished = true;
      }
    }
  }
  // live position: player progress vs rivals, counting distance to the
  // next gate so a driver closing on it counts ahead of one parked at it
  const nextGate = circuit.gates[r.gate];
  const pDist = Math.hypot(G.player.pos.x - nextGate[0], G.player.pos.z - nextGate[1]);
  const playerProgress = (r.lap - 1) * circuit.gates.length + r.gate + (1 - clamp(pDist / 120, 0, 1));
  let pos = 1;
  for (const rv of r.rivals) if (rv.progress > playerProgress) pos += 1;
  r.position = pos;
  if (G.hud) {
    G.hud.setRace({
      name: circuit.name, lap: Math.min(r.lap, circuit.laps), laps: circuit.laps,
      position: pos, time: r.time, best: r.bestLap, gate: r.gate + 1, gates: circuit.gates.length,
    });
  }
  // leaving the race area / wrecking the car ends the race
  if (G.player.mode !== 'car') {
    abandonRace(G, 'You left your car — race abandoned');
  }
}

export function finishRace(G, playerWon) {
  const r = G.race;
  const circuit = r.circuit;
  const won = playerWon && r.position === 1;
  r.active = false;
  r.finished = true;
  for (const rv of r.rivals) G.scene.remove(rv.mesh);
  r.rivals = [];
  for (const gm of r.gateMeshes) G.scene.remove(gm);
  r.gateMeshes = [];
  if (G.hud) G.hud.setRace(null);
  if (won) {
    G.player.cash += circuit.prize;
    if (G.hud) {
      G.hud.banner('RACE WON', circuit.name + ' · +' + fmtMoney(circuit.prize) + ' · ' + fmtClock(r.time));
      G.hud.toast('Prize banked: ' + fmtMoney(circuit.prize));
    }
    if (G.sfx) G.sfx('win');
    if (G.missions) G.missions.onRaceWon?.(circuit.id);
  } else {
    if (G.hud) G.hud.banner('RACE LOST', 'P' + r.position + ' — ' + circuit.name + ' · try again at the start line');
    if (G.sfx) G.sfx('lose');
  }
}

export function abandonRace(G, reason) {
  const r = G.race;
  if (!r.active) return;
  r.active = false;
  for (const rv of r.rivals) G.scene.remove(rv.mesh);
  r.rivals = [];
  for (const gm of r.gateMeshes) G.scene.remove(gm);
  r.gateMeshes = [];
  if (G.hud) {
    G.hud.setRace(null);
    G.hud.toast(reason);
  }
}

export function raceStartPoints(G) {
  return G.circuits.map((c) => ({ id: c.id, name: c.name, x: c.gates[0][0], z: c.gates[0][1], prize: c.prize }));
}
