// CORAL HEAT — street-race system (NEW in v2.9).
// Five circuits, checkpoint gates, countdown start, 3 rival AI drivers,
// lap + best-lap timing, race HUD data, cash rewards.
import * as THREE from 'three';
import { clamp, rand, pick, dist2d, fmtTime } from './util.js';
import { createCar, removeCar, stepCar } from './drive.js';

export const CIRCUITS = [
  {
    id: 'marina-mile', name: 'Marina Mile', laps: 2, reward: 900,
    gates: [[0, -210], [140, -210], [210, -70], [210, 70], [140, 210], [0, 210], [-140, 210], [-210, 70], [-210, -70], [-140, -210]],
  },
  {
    id: 'palm-sprint', name: 'Palm Sprint', laps: 3, reward: 700,
    gates: [[-210, 0], [-70, 0], [70, 0], [210, 0], [210, 140], [70, 140], [-70, 140], [-210, 140]],
  },
  {
    id: 'boardwalk-loop', name: 'Boardwalk Loop', laps: 2, reward: 1100,
    gates: [[210, -140], [280, -70], [280, 70], [210, 140], [70, 140], [70, -140], [210, -140]],
  },
  {
    id: 'downtown-dash', name: 'Downtown Dash', laps: 3, reward: 850,
    gates: [[-70, 140], [-70, 0], [-70, -140], [70, -140], [70, 0], [70, 140], [-70, 140]],
  },
  {
    id: 'sunset-grand', name: 'Sunset Grand Tour', laps: 2, reward: 1600,
    gates: [[0, -210], [210, -210], [280, 0], [210, 210], [0, 210], [-210, 210], [-210, -210], [0, -210]],
  },
];

const RIVAL_NAMES = ['Vex', 'Marlo', 'Dita'];
const RIVAL_COLORS = [0x8a2be2, 0x22a06b, 0xe8b13c];

function makeGateMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffd76b, emissive: 0xaa7711, emissiveIntensity: 0.8 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), mat);
    post.position.set(s * 7, 3.5, 0);
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.8, 0.6), mat);
  bar.position.y = 7;
  g.add(bar);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(15, 5), new THREE.MeshBasicMaterial({ color: 0xffd76b, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  flag.position.y = 3.5;
  g.add(flag);
  return g;
}

export function setupRaces(G) {
  G.race = null;
  G.raceGateMeshes = [];
  G.bestLaps = G.bestLaps || {};
  G.raceStandings = [];
}

function clearGateMeshes(G) {
  for (const m of G.raceGateMeshes) G.scene.remove(m);
  G.raceGateMeshes = [];
}

function showGate(G, idx) {
  clearGateMeshes(G);
  const race = G.race;
  const gate = race.circuit.gates[idx];
  const mesh = makeGateMesh();
  const next = race.circuit.gates[(idx + 1) % race.circuit.gates.length];
  mesh.position.set(gate[0], 0, gate[1]);
  mesh.rotation.y = Math.atan2(-(next[0] - gate[0]), -(next[1] - gate[1]));
  G.scene.add(mesh);
  G.raceGateMeshes.push(mesh);
  // next-gate ghost marker (dimmer, further ahead)
  const ghost = makeGateMesh();
  ghost.scale.set(0.8, 0.8, 0.8);
  ghost.position.set(next[0], 0, next[1]);
  ghost.rotation.y = mesh.rotation.y;
  ghost.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; } });
  G.scene.add(ghost);
  G.raceGateMeshes.push(ghost);
}

export function startRace(G, circuitIdx) {
  const circuit = CIRCUITS[circuitIdx];
  // clear any old race
  if (G.race) endRace(G, false);
  // make sure the player is in a car
  if (G.player.mode !== 'car' || !G.player.car) {
    G.hud.toast('You need a car to race — get in one first!');
    return false;
  }
  const start = circuit.gates[0];
  const heading = Math.atan2(-(circuit.gates[1][0] - start[0]), -(circuit.gates[1][1] - start[1]));
  // grid: player + 3 rivals lined up
  const gridSpots = [
    { x: start[0] - 4, z: start[1] + 8 }, { x: start[0] + 4, z: start[1] + 8 },
    { x: start[0] - 4, z: start[1] + 16 }, { x: start[0] + 4, z: start[1] + 16 },
  ];
  const playerCar = G.player.car;
  playerCar.x = gridSpots[0].x; playerCar.z = gridSpots[0].z;
  playerCar.heading = heading; playerCar.speed = 0;
  playerCar.mesh.position.set(playerCar.x, 0, playerCar.z);
  playerCar.mesh.rotation.y = heading;
  const rivals = [];
  for (let i = 0; i < 3; i++) {
    const car = createCar(G, gridSpots[i + 1].x, gridSpots[i + 1].z, heading, RIVAL_COLORS[i], i === 0 ? 'sport' : 'sedan');
    car.isTraffic = false;
    car.top = 44 + i * 3;
    car.rival = { name: RIVAL_NAMES[i], gate: 0, lap: 1, finished: false, finishMs: 0, progress: 0 };
    rivals.push(car);
  }
  G.race = {
    circuit, lap: 1, gate: 0, rivals,
    phase: 'countdown', countdown: 3.6,
    startMs: 0, lapStartMs: 0, lastLapMs: 0, bestMs: G.bestLaps[circuit.id] || null,
    positions: ['YOU', ...RIVAL_NAMES], finished: false, finishMs: 0,
  };
  showGate(G, 0);
  G.hud.showRace(G.race);
  G.hud.toast(circuit.name + ' — ' + circuit.laps + ' laps, 3 rivals. Get ready!');
  G.audio?.countdown();
  return true;
}

function raceProgress(G, car, gateIdx, lap) {
  const gates = G.race.circuit.gates;
  const gate = gates[gateIdx];
  const d = dist2d(car.x, car.z, gate[0], gate[1]);
  return lap * 1000 + gateIdx * 100 - d;
}

export function updateRace(G, dt) {
  const race = G.race;
  if (!race) return;
  if (race.phase === 'countdown') {
    race.countdown -= dt;
    G.hud.setCountdown(Math.ceil(race.countdown));
    if (race.countdown <= 0) {
      race.phase = 'racing';
      race.startMs = G.time * 1000;
      race.lapStartMs = race.startMs;
      G.hud.setCountdown(0);
      G.hud.toast('GO!');
      G.audio?.go();
    }
    return;
  }
  if (race.phase !== 'racing') return;
  const playerCar = G.player.car;
  if (!playerCar) { endRace(G, false); return; }
  // player gate check
  const gate = race.circuit.gates[race.gate];
  if (dist2d(playerCar.x, playerCar.z, gate[0], gate[1]) < 12) {
    race.gate++;
    G.audio?.blip(990);
    if (race.gate >= race.circuit.gates.length) {
      race.gate = 0;
      const now = G.time * 1000;
      const lapMs = now - race.lapStartMs;
      race.lastLapMs = lapMs;
      race.lapStartMs = now;
      if (!race.bestMs || lapMs < race.bestMs) race.bestMs = lapMs;
      race.lap++;
      G.hud.toast(lapMs ? 'Lap ' + (race.lap - 1) + ' — ' + fmtTime(lapMs) : 'Lap done');
      if (race.lap > race.circuit.laps) {
        finishRace(G, playerCar);
        return;
      }
    }
    showGate(G, race.gate);
  }
  // rivals: simple waypoint AI toward their current gate
  for (const rival of race.rivals) {
    if (rival.rival.finished) continue;
    const rg = race.circuit.gates[rival.rival.gate];
    const d = dist2d(rival.x, rival.z, rg[0], rg[1]);
    if (d < 12) {
      rival.rival.gate++;
      if (rival.rival.gate >= race.circuit.gates.length) {
        rival.rival.gate = 0;
        rival.rival.lap++;
        if (rival.rival.lap > race.circuit.laps) {
          rival.rival.finished = true;
          rival.rival.finishMs = G.time * 1000 - race.startMs + rand(0, 4000);
        }
      }
    }
    const want = Math.atan2(-(rg[0] - rival.x), -(rg[1] - rival.z));
    const steer = clamp(((want - rival.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
    stepCar(G, rival, { throttle: 0.85, steer, brake: false, nitro: false }, dt);
    rival.rival.progress = raceProgress(G, rival, rival.rival.gate, rival.rival.lap);
  }
  // live positions
  const entries = [
    { name: 'YOU', progress: raceProgress(G, playerCar, race.gate, race.lap), finished: false },
    ...race.rivals.map((r) => ({ name: r.rival.name, progress: r.rival.progress, finished: r.rival.finished })),
  ];
  entries.sort((a, b) => (b.finished - a.finished) || (b.progress - a.progress));
  const pos = entries.findIndex((e) => e.name === 'YOU') + 1;
  race.position = pos;
  G.hud.updateRaceHud(race, pos, entries);
}

function finishRace(G, playerCar) {
  const race = G.race;
  race.phase = 'done';
  race.finishMs = G.time * 1000 - race.startMs;
  const entries = [
    { name: 'YOU', ms: race.finishMs },
    ...race.rivals.map((r) => ({ name: r.rival.name, ms: r.rival.finished ? r.rival.finishMs : race.finishMs + rand(3000, 20000) })),
  ];
  entries.sort((a, b) => a.ms - b.ms);
  const pos = entries.findIndex((e) => e.name === 'YOU') + 1;
  race.position = pos;
  if (race.bestMs) G.bestLaps[race.circuit.id] = race.bestMs;
  let reward = 0;
  if (pos === 1) reward = race.circuit.reward;
  else if (pos === 2) reward = Math.floor(race.circuit.reward * 0.4);
  else if (pos === 3) reward = Math.floor(race.circuit.reward * 0.2);
  G.player.cash += reward;
  G.hud.showRaceResult(race, pos, entries, reward);
  G.audio?.win();
  for (const r of race.rivals) removeCar(G, r);
  clearGateMeshes(G);
  G.saveGame();
  setTimeout(() => { if (G.race === race) G.race = null; }, 6000);
}

export function endRace(G, silent) {
  if (!G.race) return;
  for (const r of G.race.rivals || []) removeCar(G, r);
  clearGateMeshes(G);
  G.race = null;
  if (!silent) G.hud.toast('Race abandoned');
}
