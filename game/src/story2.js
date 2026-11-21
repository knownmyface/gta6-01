// story2.js — story missions 9-16: the race / bike / garage arc that ends the game.
import { spawnThugs } from './fight.js';

export const MISSIONS_9_16 = [
  { id: 9, name: 'Rookie Racer', brief: 'The street-race scene runs at the Sunset Loop. Drive to the start line (gold gate) and press R to race.', target: { x: -152, z: 0 }, reward: 1500, kind: 'race-win' },
  { id: 10, name: 'Two Wheels', brief: 'Steal a bike — there is one parked near the plaza. Ride it to the marina (Q = wheelie).', target: { x: 150, z: 210 }, reward: 1800, kind: 'bike-goto' },
  { id: 11, name: 'Grand Coral GP', brief: 'Win the Grand Coral GP — 3 laps, 6 gates, 3 rivals. Press R at the start line.', target: { x: -304, z: -304 }, reward: 4000, kind: 'race-win' },
  { id: 12, name: 'A Place to Sleep', brief: 'You need a safehouse. Buy the Palm Court Apartment ($8,000) from the garage menu (G near the house).', target: { x: -228, z: -76 }, reward: 2000, kind: 'buy-safehouse' },
  { id: 13, name: 'Tuned Up', brief: 'Buy any upgrade at the garage shop — engine, tires, armor or nitro. Press G near a safehouse.', target: { x: -228, z: -76 }, reward: 1500, kind: 'upgrade-car' },
  { id: 14, name: 'Bike Courier', brief: 'A package run on two wheels: ride a bike to the beach checkpoint, then to the marina.', target: { x: -228, z: 304 }, reward: 3000, kind: 'bike-goto' },
  { id: 15, name: 'Marina Sprint Champ', brief: 'Win the Marina Sprint — 2 laps around the docks. The crew is watching.', target: { x: 76, z: 228 }, reward: 4500, kind: 'race-win' },
  { id: 16, name: 'King of Coral Bay', brief: 'FINALE: clear the last crew at the plaza (5 thugs), then stand on the fountain. The city is yours.', target: { x: 0, z: 0 }, reward: 10000, kind: 'finale', thugs: 5 },
];

export function registerMissions9_16() {
  window.__CORAL_MISSIONS_9_16 = MISSIONS_9_16;
}

export function startMissionWithSetup(G, idx) {
  // extra setup for the second arc's kinds, run by boot before startMission
  const list = MISSIONS_9_16;
  const m = list[idx - 8];
  if (!m) return;
  if (m.kind === 'race-win') G.missions.raceWinsBefore = G.missions.raceWins || 0;
  if (m.kind === 'buy-safehouse') G.missions.ownedBefore = G.garage.owned.length;
  if (m.kind === 'upgrade-car') {
    const u = G.garage.upgrades;
    G.missions.upBefore = u.engine + u.tires + u.armor + u.nitro;
  }
  if (m.kind === 'finale') spawnThugs(G, m.thugs, m.target.x, m.target.z);
}
