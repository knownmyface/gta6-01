// story2.js — story missions 17-22: the casino-heist finale chain and the
// boat missions. Recon, getaway driver, vault, escape by boat, then a
// waterfront pursuit with police boats. Same crew, same city, higher heat.
import { dist2d, formatCash } from "./util.js";

export const MISSIONS_17_22 = [
  { id: 17, title: "The Big Score — Recon", brief: "Case the Coral Crown. Count the cameras, the guards, the vault door. Walk the floor like a tourist.", objective: "Recon the casino floor on foot", target: { x: 30, z: -96 }, reward: 3000, wanted: 0, needsFoot: true },
  { id: 18, title: "The Big Score — Getaway Driver", brief: "Tessa needs a getaway car that can outrun Air One. Win the Palm Grand Prix to prove the Sunset GT is ready.", objective: "Win the Palm Grand Prix", target: { x: -180, z: 60 }, reward: 5000, wanted: 0, race: "palm-grand-prix" },
  { id: 19, title: "The Big Score — The Vault", brief: "Inside the Crown. Crack the vault, grab the take, and do not stop for the slots.", objective: "Reach the casino vault", target: { x: 30, z: -120 }, reward: 8000, wanted: 3, needsFoot: true },
  { id: 20, title: "The Big Score — Escape", brief: "Five stars. Roadblocks on every boulevard. Get to the marina — the boat is the only way out.", objective: "Escape to the marina at 5 stars", target: { x: -120, z: -185 }, reward: 12000, wanted: 5 },
  { id: 21, title: "Boat Getaway", brief: "The Coral Speedster is fuelled and waiting at the pier. Outrun the harbour patrol to open water.", objective: "Take the boat to open water (z < -300)", target: { x: -60, z: -320 }, reward: 6000, wanted: 3, needsBoat: true },
  { id: 22, title: "Waterfront Pursuit", brief: "Police boats are in your wake and the helicopter is overhead. Lose them along the coast.", objective: "Outrun the police boats to the east buoy", target: { x: 280, z: -320 }, reward: 10000, wanted: 4, needsBoat: true },
];

export function initStory2(G) {
  G.missions2 = MISSIONS_17_22;
  return MISSIONS_17_22;
}

// Switch the active mission list from 1-16 to 17-22.
export function advanceToStory2(G) {
  G.missions = MISSIONS_17_22;
  G.missionIndex = 0;
  G.story2Active = true;
  const m = G.missions[0];
  if (G.city && G.city.beacon) G.city.beacon.position.set(m.target.x, 13, m.target.z);
  if (G.hud) G.hud.setMission(m);
  if (G.toast) G.toast("Heist finale: " + m.title);
  return m;
}

export function updateStory2(G, dt) {
  if (!G.story2Active) return;
  const m = G.missions[G.missionIndex];
  if (!m) return;
  const p = G.player.pos;
  if (m.needsFoot && G.player.mode !== "foot") return;
  if (m.needsBoat && G.player.mode !== "boat") return;
  if (m.race && !G._raceWon) return;
  if (m.id === 20) {
    if ((G.wanted || 0) < 5) {
      if (G.setWanted) G.setWanted(5);
    }
    if (!G.roadblock && Math.random() < dt * 0.25) {
      if (G.deployRoadblock) G.deployRoadblock(G, 55);
    }
  }
  if (m.id === 21 && G.player.mode === "boat" && (G.policeBoats || []).length === 0) {
    if (G.spawnPoliceBoat) {
      G.spawnPoliceBoat(G, p.x - 30, p.z + 20);
      G.spawnPoliceBoat(G, p.x + 30, p.z + 25);
    }
  }
  if (m.id === 22 && G.player.mode === "boat" && (G.policeBoats || []).length === 0) {
    if (G.spawnPoliceBoat) {
      G.spawnPoliceBoat(G, p.x - 40, p.z + 15);
      G.spawnPoliceBoat(G, p.x + 40, p.z + 30);
      G.spawnPoliceBoat(G, p.x, p.z + 45);
    }
  }
  const d = dist2d(p.x, p.z, m.target.x, m.target.z);
  if (d < 14) {
    completeStory2Mission(G, m);
  }
}

function completeStory2Mission(G, m) {
  if (G.save) {
    G.save.cash += m.reward;
    G.save.totalEarned += m.reward;
    if (!G.save.missionsDone.includes(m.id)) G.save.missionsDone.push(m.id);
    G.save.mission = Math.min(22, m.id + 1);
    if (G.hud) G.hud.setCash(G.save.cash);
    if (G.saveGame) G.saveGame();
  }
  if (G.sound) G.sound.missionSting();
  if (G.toast) G.toast("Mission complete: " + m.title + " — +" + formatCash(m.reward));
  if (G.setWanted) G.setWanted(Math.max(0, (G.wanted || 0) - 2));
  if (m.id === 21 || m.id === 22) {
    if (G.clearPoliceBoats) G.clearPoliceBoats(G);
  }
  if (G.missionIndex + 1 < G.missions.length) {
    G.missionIndex++;
    const next = G.missions[G.missionIndex];
    if (G.city && G.city.beacon) G.city.beacon.position.set(next.target.x, 13, next.target.z);
    if (G.hud) G.hud.setMission(next);
    if (G.toast) G.toast("Mission " + next.id + ": " + next.title);
  } else {
    if (G.hud) G.hud.setMission(null);
    if (G.toast) G.toast("CORAL HEAT complete — Reef owns Coral Bay. Free roam!");
    if (G.fx) G.fx.explosion(G.player.pos.x + 10, 1, G.player.pos.z - 10);
  }
}
