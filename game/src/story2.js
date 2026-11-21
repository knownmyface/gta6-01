// story2.js — missions 13-20: four missions built on the races, bikes and
// garage, then the casino-heist finale chain (recon, getaway driver, vault,
// escape by boat). The heist is the climax of CORAL HEAT.
import { fmtCash, dist2 } from './util.js';
import { PLACES } from './coralcity.js';
import { RACES, startRace } from './raceway.js';
import { giveWeapon } from './fight.js';

export const MISSIONS2 = [
  { id: 13, name: 'MARINA MILE', giver: 'VEX', brief: 'Win the Marina Mile street race. P3 or better pays.', target: 'race', race: 'marina-mile', reward: 1500 },
  { id: 14, name: 'REEF RIDER', giver: 'VEX', brief: 'Take a bike from Reef Riders and ride it to the pier.', target: 'bikeShop', kind: 'bike', reward: 900 },
  { id: 15, name: 'TUNED UP', giver: 'DEX', brief: 'Buy any upgrade at Sunset Garage. Speed costs money.', target: 'garageBay', kind: 'upgrade', reward: 600 },
  { id: 16, name: 'GRAND PRIX', giver: 'VEX', brief: 'Win the Coral Grand Prix. The whole city is watching.', target: 'race', race: 'coral-grand-prix', reward: 4000 },
  { id: 17, name: 'CASINO RECON', giver: 'ROOK', brief: 'Scope the Coral Crown Casino. Park at the door and photograph the vault route.', target: 'casinoDoor', kind: 'recon', reward: 1500 },
  { id: 18, name: 'GETAWAY DRIVER', giver: 'ROOK', brief: 'Outrun a 4-star chase for 30 seconds. The crew is counting on you.', target: 'survive4', kind: 'survive', count: 30, stars: 4, reward: 3000 },
  { id: 19, name: 'THE VAULT', giver: 'ROOK', brief: 'Inside the casino! Hold the vault room for 40 seconds while Dex cracks it.', target: 'casinoDoor', kind: 'hold', count: 40, reward: 8000 },
  { id: 20, name: 'ESCAPE BY BOAT', giver: 'MARINA', brief: 'The heat is on. Get to the marina, steal a boat, sail south past the buoy.', target: 'marinaDock', kind: 'escape', reward: 12000 },
];

export function initStory2(W) {
  W.story2 = { index: 0, active: null, progress: 0, timer: 0, done: [] };
}

export function currentMission2(W) {
  return MISSIONS2[W.story2.index] || null;
}

export function startMission2(W, idx = W.story2.index) {
  const m = MISSIONS2[idx];
  if (!m) return null;
  W.story2.active = { ...m, progress: 0, timer: 0 };
  W.story2.progress = 0;
  W.story2.timer = 0;
  W.objective = 'M' + m.id + ' — ' + m.name + ': ' + m.brief;
  W.hudFlash('MISSION ' + m.id + ' — ' + m.name);
  if (m.target === 'race') {
    startRace(W, m.race);
  } else if (m.kind === 'upgrade') {
    const up = W.garageUpgrades || {};
    W.story2.baseUpgrades = up.engine + up.tires + up.armor + up.nitro;
  } else if (m.kind === 'survive') {
    W.player.wanted = Math.max(W.player.wanted, m.stars || 3);
  } else if (m.id === 19) {
    giveWeapon(W, 'shotgun', 30);
    W.player.wanted = Math.max(W.player.wanted, 4);
    W.hudFlash('VAULT CREW INSIDE — HOLD THE ROOM');
  } else if (m.kind === 'recon') {
    // Park a getaway car by the casino door for the photo op.
    W.objective = 'M17 — CASINO RECON: stand at the casino door for 5s';
  }
  const pl = PLACES[m.target];
  if (pl && m.target !== 'race') {
    W.story.marker.position.set(pl.x, 0, pl.z);
    W.story.marker.visible = true;
  }
  W.events.push({ type: 'missionstart', id: m.id, name: m.name });
  return m;
}

export function completeMission2(W) {
  const m = W.story2.active;
  if (!m) return;
  W.player.cash += m.reward;
  W.story2.done.push(m.id);
  W.story2.index += 1;
  W.story2.active = null;
  W.story.marker.visible = false;
  W.hudFlash('MISSION COMPLETE — +' + fmtCash(m.reward));
  W.events.push({ type: 'missiondone', id: m.id, reward: m.reward });
  W.saveGame?.();
  if (m.id === 20) {
    W.objective = 'HEIST COMPLETE — CORAL HEAT LEGEND. Free roam!';
    W.hudFlash('CORAL CROWN HEIST — CLEAN GETAWAY!');
    W.fx.explode(W.player.x + 10, 1, W.player.z - 10, true);
  } else {
    const next = currentMission2(W);
    W.objective = next
      ? 'NEXT: M' + next.id + ' — ' + next.name + ' (press N to start)'
      : 'ALL 20 MISSIONS DONE — free roam!';
  }
}

export function failMission2(W, why) {
  const m = W.story2.active;
  if (!m) return;
  W.story2.active = null;
  W.story.marker.visible = false;
  W.hudFlash('MISSION FAILED — ' + why + ' (press N to retry)');
  W.events.push({ type: 'missionfail', id: m.id, why });
}

export function updateStory2(W, dt) {
  const s2 = W.story2;
  const m = s2.active;
  if (!m) return;
  const p = W.player;
  s2.timer += dt;
  switch (m.kind) {
    case 'bike': {
      // Ride any bike to the pier.
      if (p.mode === 'bike') {
        const pier = PLACES.pier;
        if (dist2(p.x, p.z, pier.x, pier.z) < 12) completeMission2(W);
        else W.objective = 'M14 — Ride the bike to the pier (marker)';
      }
      break;
    }
    case 'upgrade': {
      const up = W.garageUpgrades || {};
      const total = up.engine + up.tires + up.armor + up.nitro;
      if (total > (s2.baseUpgrades ?? 0)) completeMission2(W);
      break;
    }
    case 'recon': {
      const door = PLACES.casinoDoor;
      const d = dist2(p.x, p.z, door.x, door.z);
      if (d < 10) {
        s2.progress += dt;
        W.objective = 'M17 — CASINO RECON: photographing… ' + Math.ceil(5 - s2.progress) + 's';
        if (s2.progress >= 5) completeMission2(W);
      } else {
        s2.progress = 0;
      }
      break;
    }
    case 'survive': {
      const need = m.stars || 3;
      if (p.wanted >= need) s2.progress += dt;
      else s2.progress = Math.max(0, s2.progress - dt * 2);
      W.objective = 'M18 — GETAWAY: hold ' + need + ' stars ' + Math.floor(s2.progress) + 's / ' + m.count + 's';
      if (s2.progress >= m.count) {
        p.wanted = 0;
        completeMission2(W);
      }
      if (s2.timer > 150) failMission2(W, 'TOOK TOO LONG');
      break;
    }
    case 'hold': {
      // Hold the vault room: stay inside the casino door zone while wanted.
      const door = PLACES.casinoDoor;
      const d = dist2(p.x, p.z, door.x, door.z);
      if (d < 16) {
        s2.progress += dt;
        W.objective = 'M19 — THE VAULT: cracking… ' + Math.floor(s2.progress) + 's / ' + m.count + 's';
        if (chance(dt * 0.35)) W.fx.burst(p.x + 4, 1.5, p.z, 'spark', 4);
        if (s2.progress >= m.count) completeMission2(W);
      } else {
        W.objective = 'M19 — THE VAULT: get back inside the casino door!';
      }
      break;
    }
    case 'escape': {
      const dock = PLACES.marinaDock;
      if (p.mode !== 'boat') {
        if (dist2(p.x, p.z, dock.x, dock.z) < 14) {
          W.objective = 'M20 — ESCAPE: steal a boat at the dock (press E)';
        } else {
          W.objective = 'M20 — ESCAPE BY BOAT: get to the marina dock';
        }
      } else {
        W.objective = 'M20 — ESCAPE: sail south past the buoy (z > 250)';
        if (p.z > 250) completeMission2(W);
      }
      break;
    }
    default:
      break;
  }
  // Race missions complete through the race system.
  if (m.target === 'race' && !W.race.active && W.race.finished) {
    if (W.race.position <= 3) completeMission2(W);
    else failMission2(W, 'FINISHED P' + W.race.position + ' — NEED P3');
    W.race.finished = false;
  }
}

function chance(p) {
  return Math.random() < p;
}
