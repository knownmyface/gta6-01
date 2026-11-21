// story.js — story missions 1-8: Coral Bay's rise. Each mission: intro text,
// objective marker, completion check, cash reward, next mission unlock.
import { fmtCash } from './util.js';
import { spawnThugs } from './fight.js';

export const MISSIONS_1_8 = [
  { id: 1, name: 'Welcome to Coral Bay', brief: 'Meet Riko at the plaza. Drive there — the city is yours now.', target: { x: 0, z: 0 }, reward: 500, kind: 'goto' },
  { id: 2, name: 'First Wheels', brief: 'Steal any parked car (walk up, press E) and bring it to the marina.', target: { x: 150, z: 210 }, reward: 800, kind: 'goto-car' },
  { id: 3, name: 'Hot Wheels', brief: 'The cops noticed. Lose the heat — stay unseen until your wanted stars drop to 0.', target: null, reward: 1200, kind: 'lose-heat' },
  { id: 4, name: 'Payback at the Docks', brief: 'Thugs took Riko\'s cash. Drive to the docks and take them down (click to shoot).', target: { x: 228, z: 228 }, reward: 2000, kind: 'combat', thugs: 4 },
  { id: 5, name: 'Getaway Driver', brief: 'Grab a fast car and reach the beach checkpoint before the timer ends. 90 seconds.', target: { x: -228, z: 304 }, reward: 2500, kind: 'timed', time: 90 },
  { id: 6, name: 'Harbor Run', brief: 'Take a boat from the marina and hit all 5 buoys. Board a boat with E at the pier.', target: { x: 150, z: 250 }, reward: 3000, kind: 'boat-buoys', buoys: 5 },
  { id: 7, name: 'Smoke on the Water', brief: 'A rival crew is waiting at sea. Reach the far buoy, then lose the 2-star heat.', target: { x: -140, z: 520 }, reward: 3500, kind: 'boat-goto' },
  { id: 8, name: 'The Big Score', brief: 'Hit the Coral Bank vault crew: 5 thugs guard the plaza. Clear them, then grab the cash.', target: { x: 0, z: 0 }, reward: 5000, kind: 'combat', thugs: 5 },
];

export function createMissionState() {
  return {
    index: 0, // 0-based into the combined 16
    active: null, // running mission object + runtime fields
    completed: [],
    raceWins: 0,
    startedAt: 0,
  };
}

export function allMissions() {
  // story2 registers its 8 missions here at boot so the list is one arc
  return MISSIONS_1_8.concat(window.__CORAL_MISSIONS_9_16 || []);
}

export function startMission(G, idx) {
  const list = allMissions();
  const m = list[idx];
  if (!m) return false;
  const run = { ...m, t: 0, done: false, buoysHit: 0, thugsDown: 0,
    raceWinsBefore: G.missions.raceWins || 0,
    ownedBefore: G.garage.owned.length,
    upBefore: G.garage.upgrades.engine + G.garage.upgrades.tires + G.garage.upgrades.armor + G.garage.upgrades.nitro };
  if (m.kind === 'combat') {
    spawnThugs(G, m.thugs, m.target.x, m.target.z);
    run.thugsTotal = m.thugs;
  }
  if (m.kind === 'lose-heat') G.wanted.add(2);
  if (m.kind === 'boat-buoys' || m.kind === 'boat-goto') {
    const { spawnBuoys, boatRaceCheckpoints } = G.boatApi;
    run.buoyMeshes = spawnBuoys(G, boatRaceCheckpoints(G));
    run.buoyPoints = boatRaceCheckpoints(G);
  }
  G.missions.active = run;
  G.missions.startedAt = G.time;
  G.hud.setObjective('MISSION ' + m.id + ' — ' + m.name, m.brief);
  G.hud.say('MISSION ' + m.id + ': ' + m.name, 3);
  G.sound.mission();
  return true;
}

export function updateMission(G, dt) {
  const run = G.missions.active;
  if (!run) return;
  run.t += dt;
  const px = G.player.pos.x, pz = G.player.pos.z;
  const d = run.target ? Math.hypot(run.target.x - px, run.target.z - pz) : 9999;
  switch (run.kind) {
    case 'goto':
      if (d < 10) completeMission(G, run);
      break;
    case 'goto-car':
      if (d < 12 && G.player.vehicle) completeMission(G, run);
      break;
    case 'lose-heat':
      if (G.wanted.level === 0) completeMission(G, run);
      break;
    case 'combat': {
      const alive = G.thugs.filter((t) => t.alive).length;
      if (alive === 0) completeMission(G, run);
      break;
    }
    case 'timed':
      if (d < 12) completeMission(G, run);
      else if (run.t > run.time) failMission(G, run, 'Out of time — the drop closed.');
      break;
    case 'boat-buoys': {
      if (G.player.boat && run.buoyPoints) {
        for (let i = 0; i < run.buoyPoints.length; i++) {
          if (run['buoy' + i]) continue;
          const bp = run.buoyPoints[i];
          if (Math.hypot(bp.x - px, bp.z - pz) < 14) {
            run['buoy' + i] = true; run.buoysHit++;
            G.hud.say('Buoy ' + run.buoysHit + '/' + run.buoys + ' — keep going!', 1.8);
            G.sound.blip(700, 0.1);
          }
        }
        if (run.buoysHit >= run.buoys) completeMission(G, run);
      }
      break;
    }
    case 'boat-goto':
      if (d < 16 && G.player.boat) completeMission(G, run);
      break;
    case 'race-win':
      if ((G.missions.raceWins || 0) > (run.raceWinsBefore || 0)) completeMission(G, run);
      break;
    case 'bike-goto':
      if (d < 12 && G.player.bike) completeMission(G, run);
      break;
    case 'buy-safehouse':
      if (G.garage.owned.length > (run.ownedBefore || 0)) completeMission(G, run);
      break;
    case 'upgrade-car':
      if (G.garage.upgrades.engine + G.garage.upgrades.tires + G.garage.upgrades.armor + G.garage.upgrades.nitro > (run.upBefore || 0)) completeMission(G, run);
      break;
    case 'finale':
      if (d < 12 && G.thugs.filter((t) => t.alive).length === 0) completeMission(G, run);
      break;
  }
  // mission marker beacon: pulse the target ring
  if (run.target && G.marker) {
    G.marker.position.set(run.target.x, 0.3, run.target.z);
    G.marker.visible = true;
    const s = 1 + Math.sin(G.time * 4) * 0.12;
    G.marker.scale.set(s, 1, s);
  }
}

export function completeMission(G, run) {
  G.player.cash += run.reward;
  G.missions.completed.push(run.id);
  G.missions.active = null;
  if (G.marker) G.marker.visible = false;
  if (run.buoyMeshes) for (const b of run.buoyMeshes) G.scene.remove(b);
  G.hud.setObjective('MISSION COMPLETE', run.name + ' — +' + fmtCash(run.reward));
  G.hud.say('MISSION COMPLETE — +' + fmtCash(run.reward), 3.5);
  G.sound.win();
  G.missions.index++;
  G.save.save();
  // auto-start the next mission after a beat
  setTimeout(() => { if (!G.missions.active) startMission(G, G.missions.index); }, 2500);
}

export function failMission(G, run, why) {
  G.missions.active = null;
  if (G.marker) G.marker.visible = false;
  if (run.buoyMeshes) for (const b of run.buoyMeshes) G.scene.remove(b);
  G.hud.setObjective('MISSION FAILED', why + ' — press M to retry');
  G.hud.say('MISSION FAILED — ' + why, 3);
  G.sound.blip(120, 0.4);
}
