// CORAL HEAT — story missions 13-16 (NEW in v2.9).
// Built on the new systems: street races, bikes, garage and safehouses.
// These four close the story arc and unlock the "Coral Crown" finale.
import { dist2d, fmtCash } from './util.js';

export const MISSIONS2 = [
  {
    id: 13, title: 'Rookie Racer', giver: 'Vex', reward: 1800,
    steps: [
      { type: 'goto', x: 0, z: -210, text: 'Reach the Marina Mile start pad' },
      { type: 'race', circuit: 0, text: 'Win the Marina Mile (2 laps)' },
      { type: 'goto', x: -35, z: -105, text: 'Meet Vex at the Coral Court Flat' },
    ],
  },
  {
    id: 14, title: 'Two Wheels, One Job', giver: 'Dita', reward: 2200,
    steps: [
      { type: 'bike', text: 'Get on a motorcycle' },
      { type: 'goto', x: 175, z: -105, text: 'Ride to the east bike meet' },
      { type: 'wheelie', seconds: 3, text: 'Hold a wheelie for 3 seconds (SPACE while riding)' },
      { type: 'goto', x: -105, z: 105, text: 'Ride back to the west meet' },
    ],
  },
  {
    id: 15, title: 'Keys to the City', giver: 'Marlo', reward: 2600,
    steps: [
      { type: 'garage', text: 'Buy your first safehouse (press G near a green sign)' },
      { type: 'upgrade', text: 'Buy any garage upgrade' },
      { type: 'goto', x: 210, z: 105, text: 'Show off the ride at the Marina Loft' },
    ],
  },
  {
    id: 16, title: 'Sunset Grand Tour', giver: 'Rosa', reward: 5000,
    steps: [
      { type: 'race', circuit: 4, text: 'Win the Sunset Grand Tour (2 laps, 5 circuits mastered)' },
      { type: 'goto', x: 268, z: -190, text: 'Meet Rosa under the ferris wheel' },
      { type: 'wanted', level: 5, text: 'One last 5-star stand — draw the full force' },
      { type: 'escape', text: 'Lose them all. You own Coral Bay now.' },
    ],
  },
];

export function setupStory2(G) {
  G.story2 = { defs: MISSIONS2 };
}

// Extra step types used only by missions 13-16. Called from boot's mission update.
export function updateStory2Steps(G, dt) {
  const m = G.mission;
  if (!m || m.def.id < 13) return false;
  const s = m.def.steps[m.step];
  if (!s) return false;
  const p = G.player;
  switch (s.type) {
    case 'bike': {
      if (p.mode === 'bike') return stepDone(G);
      return true;
    }
    case 'wheelie': {
      if (p.mode === 'bike' && p.bike && p.bike.wheelie > 0.5) {
        m.timer += dt;
        G.hud.setMissionProgress(m.timer / s.seconds);
        if (m.timer >= s.seconds) return stepDone(G);
      } else {
        m.timer = Math.max(0, m.timer - dt * 0.5);
        G.hud.setMissionProgress(m.timer / s.seconds);
      }
      return true;
    }
    case 'garage': {
      if (G.garage.owned.length > 0) return stepDone(G);
      return true;
    }
    case 'upgrade': {
      const ups = p.upgrades || {};
      const total = (ups.engine || 0) + (ups.tires || 0) + (ups.armor || 0) + (ups.nitro || 0);
      if (total > 0) return stepDone(G);
      return true;
    }
    default:
      return false;
  }
}

// Advance one step inside the shared mission object (mirrors story.js).
function stepDone(G) {
  const m = G.mission;
  m.step++;
  m.timer = 0;
  if (m.step >= m.def.steps.length) {
    G.player.cash += m.def.reward;
    G.missionDone.push(m.def.id);
    G.hud.toast('MISSION COMPLETE: ' + m.def.title + ' — +' + fmtCash(m.def.reward));
    G.audio?.win();
    G.hud.setMission(null, 0);
    G.mission = null;
    G.saveGame();
    return true;
  }
  const s = m.def.steps[m.step];
  G.hud.toast('Objective: ' + s.text);
  G.hud.setMission(m.def, m.step);
  G.audio?.blip(880);
  return true;
}

// Start a mission 13-16 by id. Returns false when the id is not in this file.
export function startMission2(G, id) {
  const def = MISSIONS2.find((mm) => mm.id === id);
  if (!def) return false;
  if (G.mission) { G.hud.toast('Finish the current mission first'); return false; }
  G.mission = { def, step: 0, timer: 0, kills: 0, done: false };
  G.hud.toast('MISSION: ' + def.title + ' — ' + def.steps[0].text);
  G.hud.setMission(def, 0);
  G.audio?.blip(740);
  return true;
}
