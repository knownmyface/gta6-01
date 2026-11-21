// CORAL HEAT — story missions 1-12 + mission engine (v2.9, fresh).
// Each mission is a list of steps: goto / drive / pickup / boat / race / survive.
// A beacon marks the current objective; completing all steps pays cash.
import * as THREE from 'three';
import { dist2d, fmtCash } from './util.js';

export const MISSIONS = [
  { id: 1, title: 'Welcome to Coral Bay', giver: 'Rosa', reward: 400, steps: [{ type: 'goto', x: 70, z: 0, text: 'Meet Rosa at the plaza cafe' }, { type: 'goto', x: 0, z: 70, text: 'Drive Rosa to the marina overlook' }] },
  { id: 2, title: 'Hot Wheels', giver: 'Rosa', reward: 600, steps: [{ type: 'carjack', text: 'Carjack a sports car (hold F near a traffic car)' }, { type: 'goto', x: -140, z: -70, text: 'Bring the car to the chop shop' }] },
  { id: 3, title: 'First Blood', giver: 'Vex', reward: 800, steps: [{ type: 'goto', x: 140, z: 140, text: 'Reach the alley behind the market' }, { type: 'fight', count: 3, text: 'Deal with the 3 street thugs' }] },
  { id: 4, title: 'Getaway Driver', giver: 'Vex', reward: 1000, steps: [{ type: 'goto', x: -210, z: 210, text: 'Pick up the crew at the villa district' }, { type: 'escape', text: 'Lose the cops — get wanted to 0' }] },
  { id: 5, title: 'Radio Silence', giver: 'Dita', reward: 900, steps: [{ type: 'goto', x: 210, z: -140, text: 'Reach the radio tower on Marina Row' }, { type: 'wait', seconds: 12, text: 'Hold the tower while Dita uploads the signal' }] },
  { id: 6, title: 'Harbor Lights', giver: 'Dita', reward: 1200, steps: [{ type: 'boat', text: 'Take a boat from the marina' }, { type: 'goto', x: 380, z: -120, text: 'Sail to the north buoy' }, { type: 'goto', x: 380, z: 120, text: 'Sail to the south buoy' }] },
  { id: 7, title: 'The Pickup', giver: 'Marlo', reward: 1400, steps: [{ type: 'goto', x: -70, z: -210, text: 'Collect the package at the north gate' }, { type: 'goto', x: 70, z: 210, text: 'Deliver it to Marlo at the south docks' }] },
  { id: 8, title: 'Heat Wave', giver: 'Marlo', reward: 1600, steps: [{ type: 'goto', x: 0, z: -70, text: 'Stir up trouble downtown' }, { type: 'wanted', level: 3, text: 'Reach 3-star wanted — then lose it' }, { type: 'escape', text: 'Lose the cops completely' }] },
  { id: 9, title: 'Ferry Tales', giver: 'Rosa', reward: 1500, steps: [{ type: 'boat', text: 'Board a boat at the marina' }, { type: 'goto', x: 420, z: 0, text: 'Cross to the far buoy' }, { type: 'goto', x: 330, z: 40, text: 'Return to the main pier' }] },
  { id: 10, title: 'Wheelman', giver: 'Vex', reward: 2000, steps: [{ type: 'goto', x: 140, z: -210, text: 'Reach the race pad on Marina Row' }, { type: 'race', circuit: 0, text: 'Win the Marina Mile street race' }] },
  { id: 11, title: 'King of the Bay', giver: 'Dita', reward: 2400, steps: [{ type: 'wanted', level: 4, text: 'Draw out a 4-star response' }, { type: 'survive', seconds: 45, text: 'Survive the heat for 45 seconds' }, { type: 'escape', text: 'Lose the cops' }] },
  { id: 12, title: 'Coral Crown', giver: 'Rosa', reward: 3000, steps: [{ type: 'goto', x: -210, z: -210, text: 'Meet Rosa at the north-west corner' }, { type: 'goto', x: 210, z: 210, text: 'Race across town to the villa' }, { type: 'fight', count: 4, text: 'Clear the villa guards' }] },
];

export function setupStory(G) {
  G.mission = null;
  G.missionDone = [];
  G.beacon = null;
  G.story = {
    start(id) {
      const def = MISSIONS.find((m) => m.id === id);
      if (!def) return false;
      if (G.mission) { G.hud.toast('Finish the current mission first'); return false; }
      G.mission = { def, step: 0, timer: 0, kills: 0, done: false };
      G.hud.toast('MISSION: ' + def.title + ' — ' + def.steps[0].text);
      G.hud.setMission(def, 0);
      G.audio?.blip(740);
      return true;
    },
    abort() {
      if (!G.mission) return;
      G.hud.toast('Mission failed: ' + G.mission.def.title);
      G.mission = null;
      G.hud.setMission(null, 0);
      hideBeacon(G);
    },
  };
}

function showBeacon(G, x, z) {
  hideBeacon(G);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd76b, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  beacon.position.set(x, 30, z);
  G.scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd76b, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.3, z);
  G.scene.add(ring);
  G.beacon = { beam: beacon, ring, x, z };
}

function hideBeacon(G) {
  if (!G.beacon) return;
  G.scene.remove(G.beacon.beam);
  G.scene.remove(G.beacon.ring);
  G.beacon = null;
}

function nextStep(G) {
  const m = G.mission;
  m.step++;
  m.timer = 0;
  if (m.step >= m.def.steps.length) {
    completeMission(G);
    return;
  }
  const s = m.def.steps[m.step];
  G.hud.toast('Objective: ' + s.text);
  G.hud.setMission(m.def, m.step);
  G.audio?.blip(880);
}

function completeMission(G) {
  const m = G.mission;
  G.player.cash += m.def.reward;
  G.missionDone.push(m.def.id);
  G.hud.toast('MISSION COMPLETE: ' + m.def.title + ' — +' + fmtCash(m.def.reward));
  G.audio?.win();
  G.hud.setMission(null, 0);
  hideBeacon(G);
  G.mission = null;
  G.saveGame();
}

export function updateStory(G, dt) {
  const m = G.mission;
  if (!m) return;
  const s = m.def.steps[m.step];
  if (!s) return;
  const p = G.player;
  switch (s.type) {
    case 'goto': {
      if (!G.beacon) showBeacon(G, s.x, s.z);
      if (dist2d(p.x, p.z, s.x, s.z) < 10) nextStep(G);
      break;
    }
    case 'carjack': {
      if (p.mode === 'car') nextStep(G);
      break;
    }
    case 'boat': {
      if (p.mode === 'boat') nextStep(G);
      break;
    }
    case 'fight': {
      if (!G.beacon) showBeacon(G, p.x + 20, p.z + 20);
      if (m.kills >= s.count) nextStep(G);
      break;
    }
    case 'wait': {
      m.timer += dt;
      G.hud.setMissionProgress(m.timer / s.seconds);
      if (m.timer >= s.seconds) nextStep(G);
      break;
    }
    case 'survive': {
      m.timer += dt;
      G.hud.setMissionProgress(m.timer / s.seconds);
      if (p.health <= 0) { G.story.abort(); break; }
      if (m.timer >= s.seconds) nextStep(G);
      break;
    }
    case 'wanted': {
      if (G.cops.wanted >= s.level) nextStep(G);
      break;
    }
    case 'escape': {
      if (G.cops.wanted === 0) nextStep(G);
      break;
    }
    case 'race': {
      if (!m.raceStarted) {
        m.raceStarted = true;
        import('./raceway.js').then((rw) => {
          if (G.mission !== m) return;
          if (!rw.startRace(G, s.circuit)) { G.story.abort(); }
        });
      }
      if (m.raceStarted && !G.race) {
        // race finished or was abandoned — check result via lastRaceWin flag
        if (G.lastRaceWin) { G.lastRaceWin = false; nextStep(G); }
        else if (G.lastRaceLose) { G.lastRaceLose = false; G.story.abort(); }
      }
      break;
    }
  }
  // beacon pulse
  if (G.beacon) {
    G.beacon.beam.material.opacity = 0.2 + Math.sin(G.time * 3) * 0.08;
    G.beacon.ring.scale.setScalar(1 + Math.sin(G.time * 3) * 0.08);
  }
}
