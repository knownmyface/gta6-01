// Coral Heat — save game: localStorage persistence for cash, missions,
// safehouses, upgrades, best laps. Fresh write, round 7.

const KEY = 'coral-heat-save-v210';

export class SaveGame {
  constructor(G) { this.G = G; }
  save() {
    try {
      const G = this.G;
      const data = {
        cash: Math.floor(G.player.cash),
        missionsDone: G.player.missionsDone || 0,
        missionIndex: G.missions.index,
        mission2Index: G.missions2.index,
        owned: G.garage.owned,
        stored: G.garage.stored,
        upgrades: G.playerCar.upgrades,
        bestLaps: G.raceway.bestLaps,
        kills: G.player.kills || 0,
        station: G.sound.station,
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const G = this.G;
      G.player.cash = data.cash ?? 2500;
      G.player.missionsDone = data.missionsDone ?? 0;
      G.missions.index = data.missionIndex ?? 0;
      G.missions2.index = data.mission2Index ?? 0;
      G.garage.owned = data.owned ?? {};
      G.garage.stored = data.stored ?? {};
      Object.assign(G.playerCar.upgrades, data.upgrades ?? {});
      G.raceway.bestLaps = data.bestLaps ?? {};
      G.player.kills = data.kills ?? 0;
      G.sound.station = data.station ?? 0;
      return data;
    } catch (e) { return null; }
  }
  clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
}
