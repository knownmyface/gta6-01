// raceway.js — five street-race circuits with gates, laps, positions and
// three AI rivals per race. Races run on the open road grid, so traffic and
// police can crash the party mid-lap.
import * as THREE from "../vendor/three/three.module.min.js";
import { clamp, lerp, lerpAngle, dist2d, formatTime } from "./util.js";
import { makeCarMesh } from "./drive.js";

export const CIRCUITS = [
  { id: "boulevard-sprint", name: "Boulevard Sprint", laps: 2, gates: [[-240, -168], [-60, -168], [120, -168], [300, -168], [300, -60], [300, 120], [120, 120], [-60, 120], [-240, 120], [-240, -60]] },
  { id: "casino-loop", name: "Casino Loop", laps: 3, gates: [[30, -60], [90, -60], [90, -120], [30, -180], [-30, -120], [-30, -60]] },
  { id: "marina-mile", name: "Marina Mile", laps: 2, gates: [[-300, -168], [-150, -168], [0, -168], [150, -168], [300, -168], [300, -108], [150, -108], [0, -108], [-150, -108], [-300, -108]] },
  { id: "palm-grand-prix", name: "Palm Grand Prix", laps: 3, gates: [[-180, 60], [0, 60], [180, 60], [240, 120], [180, 240], [0, 240], [-180, 240], [-240, 120]] },
  { id: "sunset-derby", name: "Sunset Derby", laps: 2, gates: [[-120, 300], [60, 300], [240, 300], [240, 180], [60, 180], [-120, 180]] },
];

const RIVAL_COLORS = [0xd8d8d8, 0x3a6fd8, 0xc23a3a];

export function buildRaceGates(G) {
  G.raceGateMeshes = [];
}

function gateMesh(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x222831 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 6, 8), postMat);
    post.position.set(s * 4.4, 3, 0);
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.9, 0.4), mat);
  bar.position.y = 5.6;
  g.add(bar);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  flag.position.set(0, 4.6, 0);
  g.add(flag);
  return g;
}

export function startRace(G, circuitId) {
  const circuit = CIRCUITS.find((c) => c.id === circuitId) || CIRCUITS[0];
  endRace(G, true);
  if (G.player.mode !== "car" && G.playerCar) {
    G.player.mode = "car";
    if (G.playerMesh) G.playerMesh.visible = false;
  }
  if (!G.playerCar) return null;
  // Line everyone up on the first gate.
  const start = circuit.gates[0];
  const next = circuit.gates[1];
  const heading = Math.atan2(next[0] - start[0], next[1] - start[1]);
  G.playerCar.x = start[0];
  G.playerCar.z = start[1];
  G.playerCar.heading = heading;
  G.playerCar.speed = 0;
  G.player.pos.set(start[0], 0, start[1]);
  G.player.heading = heading;
  const rivals = [];
  for (let i = 0; i < 3; i++) {
    const mesh = makeCarMesh(RIVAL_COLORS[i], {});
    const rx = start[0] - Math.sin(heading) * (6 + i * 5) + Math.cos(heading) * (i % 2 ? 3 : -3);
    const rz = start[1] - Math.cos(heading) * (6 + i * 5) - Math.sin(heading) * (i % 2 ? 3 : -3);
    mesh.position.set(rx, 0, rz);
    G.scene.add(mesh);
    rivals.push({ mesh, x: rx, z: rz, heading, speed: 0, gate: 1, lap: 1, top: 44 + i * 3 });
  }
  const gates = [];
  for (let i = 0; i < circuit.gates.length; i++) {
    const [gx, gz] = circuit.gates[i];
    const m = gateMesh(i === 0 ? 0xffd23c : 0x37e6ff);
    const [nx, nz] = circuit.gates[(i + 1) % circuit.gates.length];
    m.position.set(gx, 0, gz);
    m.rotation.y = Math.atan2(nx - gx, nz - gz);
    G.scene.add(m);
    gates.push(m);
  }
  G.race = {
    circuit, rivals, gates,
    gate: 1, lap: 1,
    startAt: performance.now() / 1000,
    finished: false,
    countdown: 3,
    countAt: performance.now() / 1000,
  };
  if (G.hud) G.hud.setRace(G.race);
  if (G.toast) G.toast(circuit.name + " — 3, 2, 1, GO!");
  return G.race;
}

function advanceRacer(G, racer, dt) {
  const gates = racer.raceGates || G.race.circuit.gates;
  const target = gates[racer.gate % gates.length];
  const dx = target[0] - racer.x;
  const dz = target[1] - racer.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 8) {
    racer.gate++;
    if (racer.gate >= gates.length) {
      racer.gate = 0;
      racer.lap++;
    }
    return;
  }
  const want = Math.atan2(dx, dz);
  racer.heading = lerpAngle(racer.heading, want, clamp(dt * 2.5, 0, 1));
  racer.speed = lerp(racer.speed, racer.top, clamp(dt * 0.8, 0, 1));
  racer.x += Math.sin(racer.heading) * racer.speed * dt;
  racer.z += Math.cos(racer.heading) * racer.speed * dt;
  racer.mesh.position.set(racer.x, 0, racer.z);
  racer.mesh.rotation.y = racer.heading;
}

export function updateRace(G, dt) {
  const race = G.race;
  if (!race || race.finished) return;
  const now = performance.now() / 1000;
  if (race.countdown > 0) {
    const elapsed = now - race.countAt;
    race.countdown = 3 - Math.floor(elapsed);
    if (elapsed >= 3) {
      race.countdown = 0;
      race.startAt = now;
      if (G.toast) G.toast("GO!");
    } else {
      return; // Hold the grid during the countdown.
    }
  }
  // Player gate progress.
  const gates = race.circuit.gates;
  const target = gates[race.gate % gates.length];
  const pd = dist2d(G.player.pos.x, G.player.pos.z, target[0], target[1]);
  if (pd < 10) {
    race.gate++;
    if (race.gate >= gates.length) {
      race.gate = 0;
      race.lap++;
      if (race.lap > race.circuit.laps) {
        finishRace(G, true);
        return;
      }
      if (G.sound) G.sound.missionSting();
    }
    if (G.hud) G.hud.setRace(race);
  }
  for (const r of race.rivals) advanceRacer(G, r, dt);
  // Position: count rivals ahead by (lap, gate) progress.
  const myScore = (race.lap - 1) * gates.length + race.gate;
  let pos = 1;
  for (const r of race.rivals) {
    const rs = (r.lap - 1) * gates.length + r.gate;
    if (rs > myScore) pos++;
  }
  race.position = pos;
  race.elapsed = now - race.startAt;
  if (G.hud) G.hud.setRace(race);
}

function finishRace(G, won) {
  const race = G.race;
  if (!race) return;
  race.finished = true;
  const time = race.elapsed || 0;
  const key = race.circuit.id;
  const prevBest = (G.save && G.save.bestLap && G.save.bestLap[key]) || Infinity;
  const isBest = time < prevBest;
  if (isBest && G.save) {
    G.save.bestLap[key] = time;
    if (G.saveGame) G.saveGame();
  }
  const prize = race.position === 1 ? 2500 : race.position === 2 ? 1200 : race.position === 3 ? 600 : 150;
  if (G.save) {
    G.save.cash += prize;
    G.save.totalEarned += prize;
    if (G.hud) G.hud.setCash(G.save.cash);
    if (G.saveGame) G.saveGame();
  }
  if (G.toast) {
    G.toast("Finished P" + race.position + " in " + formatTime(time) + " — +" + "$" + prize.toLocaleString("en-US") + (isBest ? " (new best!)" : ""));
  }
  if (G.sound) G.sound.missionSting();
  if (G.hud) G.hud.setRace(null);
  endRace(G, true);
}

export function endRace(G, keepMeshes) {
  const race = G.race;
  if (!race) return;
  for (const r of race.rivals || []) G.scene.remove(r.mesh);
  for (const gm of race.gates || []) G.scene.remove(gm);
  G.race = null;
  if (G.hud) G.hud.setRace(null);
}
