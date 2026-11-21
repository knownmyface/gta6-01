// story.js — story missions 1-16: the rise of Marina "Reef" Solano in Coral
// Bay. Each mission: title, briefing, objective, a target point, a reward,
// and a simple completion rule (reach the beacon, survive, or deliver).
// All characters and crews are original inventions.
import { dist2d, formatCash } from "./util.js";

export const MISSIONS_1_16 = [
  { id: 1, title: "Welcome to Coral Bay", brief: "Reef lands in Coral Bay with $2,500 and a borrowed Sunset GT. Meet Dale at the marina loft.", objective: "Drive to the Marina Loft", target: { x: -150, z: -150 }, reward: 500, wanted: 0 },
  { id: 2, title: "First Wheels", brief: "Dale's coupe is parked by the boulevard. Take it for a spin — it is not stealing if he said so.", objective: "Get in the Coral Coupe at Sunset Motors", target: { x: 120, z: 60 }, reward: 400, wanted: 0 },
  { id: 3, title: "Hot Wheels", brief: "The crew needs a fast car and the owner is arguing with a meter maid. Take it.", objective: "Carjack a car on the boulevard (F near a car)", target: { x: 0, z: -168 }, reward: 800, wanted: 1, needsJack: true },
  { id: 4, title: "Outrun the Blues", brief: "Bay PD noticed the jack. Lose them or outrun them — 5 stars is not an option yet.", objective: "Drop your wanted level to 0", target: { x: 0, z: 120 }, reward: 1000, wanted: 2, needsCool: true },
  { id: 5, title: "Marina Pickup", brief: "Pick up a package from the pier. The harbour master asks no questions if you tip him.", objective: "Reach the pier", target: { x: -60, z: -205 }, reward: 900, wanted: 0 },
  { id: 6, title: "Boulevard Sprint", brief: "Tessa bets you cannot win the Boulevard Sprint. Two laps. No excuses.", objective: "Win the Boulevard Sprint (race menu, M)", target: { x: -240, z: -168 }, reward: 2500, wanted: 0, race: "boulevard-sprint" },
  { id: 7, title: "The Mechanic", brief: "Grease runs Sunset Motors. He will tune your ride if you bring him a Tide Sedan.", objective: "Deliver a Tide Sedan to Sunset Motors", target: { x: 120, z: 60 }, reward: 1500, wanted: 0 },
  { id: 8, title: "Night Shift", brief: "Drive a nervous courier across town while the PD runs a checkpoint. Keep it under the limit — or do not.", objective: "Drive to the Beach Bungalow", target: { x: 210, z: -150 }, reward: 1400, wanted: 1 },
  { id: 9, title: "Arms Dealer", brief: "Harbor Arms has a P9 with your name on it. Buy it, then show the range what it does.", objective: "Buy a weapon at Harbor Arms", target: { x: -60, z: -60 }, reward: 600, wanted: 0, needsBuy: true },
  { id: 10, title: "Payback at the Docks", brief: "Rival crew took Dale's bike. Take it back — and make sure they remember the name Reef.", objective: "Reach the docks and clear the ambush", target: { x: -240, z: -168 }, reward: 2200, wanted: 3 },
  { id: 11, title: "Casino Loop", brief: "The Coral Crown runs a street circuit at dusk. Three laps, high rollers watching.", objective: "Win the Casino Loop", target: { x: 30, z: -60 }, reward: 3000, wanted: 0, race: "casino-loop" },
  { id: 12, title: "The Informant", brief: "A pit boss at the Crown owes Dale a favour. Walk in on foot and hear him out.", objective: "Enter the Coral Crown casino on foot", target: { x: 30, z: -96 }, reward: 1200, wanted: 0, needsFoot: true },
  { id: 13, title: "Marina Mile", brief: "Two laps along the waterfront. The cops love this one — it gives them somewhere to set up.", objective: "Win the Marina Mile", target: { x: -300, z: -168 }, reward: 3200, wanted: 1, race: "marina-mile" },
  { id: 14, title: "Bike Life", brief: "Tessa's Neon 600 is waiting at Neon Cycles. Ride it across town before the crew meeting.", objective: "Ride a bike to the Crown Penthouse", target: { x: 86, z: -120 }, reward: 1800, wanted: 0, needsBike: true },
  { id: 15, title: "Heat Wave", brief: "Five stars. The whole Bay PD is awake. Survive the chase to the beach bungalow.", objective: "Reach the Beach Bungalow at 4+ stars", target: { x: 210, z: -150 }, reward: 4000, wanted: 4 },
  { id: 16, title: "The Big Score — Part 1", brief: "Dale lays it out: the Coral Crown vault. First you need the layout, the driver, and a boat. Start with the layout.", objective: "Scout the Coral Crown casino", target: { x: 30, z: -96 }, reward: 2500, wanted: 0 },
];

export function missionById(id) {
  return MISSIONS_1_16.find((m) => m.id === id);
}

export function initStory(G) {
  G.missions = MISSIONS_1_16;
  G.missionIndex = 0;
  const saved = (G.save && G.save.mission) || 1;
  G.missionIndex = Math.max(0, Math.min(MISSIONS_1_16.length - 1, saved - 1));
  G.missionState = { stage: "go", timer: 0 };
  setMission(G, G.missionIndex);
  return G.missions;
}

export function currentMission(G) {
  return G.missions[G.missionIndex] || null;
}

export function setMission(G, index) {
  G.missionIndex = index;
  const m = currentMission(G);
  if (!m) {
    if (G.hud) G.hud.setMission(null);
    return null;
  }
  G.missionState = { stage: "go", timer: 0 };
  resetMissionFlags(G);
  if (G.city && G.city.beacon) {
    G.city.beacon.position.set(m.target.x, 13, m.target.z);
  }
  if (G.hud) G.hud.setMission(m);
  if (G.toast) G.toast("Mission " + m.id + ": " + m.title);
  return m;
}

export function completeMission(G) {
  const m = currentMission(G);
  if (!m) return;
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
  if (G.setWanted) G.setWanted(Math.max(0, (G.wanted || 0) - 1));
  // Advance into story2 (missions 17-22) when the first chain ends.
  if (G.missionIndex + 1 < G.missions.length) {
    setMission(G, G.missionIndex + 1);
  } else if (G.advanceToStory2) {
    G.advanceToStory2();
  } else {
    if (G.hud) G.hud.setMission(null);
    if (G.toast) G.toast("All story missions complete — free roam, Reef!");
  }
}

export function updateStory(G, dt) {
  const m = currentMission(G);
  if (!m) return;
  const p = G.player.pos;
  const d = dist2d(p.x, p.z, m.target.x, m.target.z);
  if (m.needsJack && !G._jackedThisMission) return; // wait for a jack (drive.js flags it)
  if (m.needsCool && (G.wanted || 0) > 0) return; // must cool off first
  if (m.needsBuy && !G._boughtThisMission) return;
  if (m.needsFoot && G.player.mode !== "foot") return;
  if (m.needsBike && G.player.mode !== "bike") return;
  if (m.race && !G._raceWon) return; // race completion flags via raceway
  if (m.id === 15 && (G.wanted || 0) < 4) return; // need real heat
  if (d < 12) {
    completeMission(G);
  }
}

// Flags set by other systems when a mission condition is met.
export function flagJacked(G) { G._jackedThisMission = true; }
export function flagBought(G) { G._boughtThisMission = true; }
export function flagRaceWon(G) { G._raceWon = true; }
export function resetMissionFlags(G) {
  G._jackedThisMission = false;
  G._boughtThisMission = false;
  G._raceWon = false;
}
