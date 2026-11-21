// savegame.js — localStorage save: cash, mission index, safehouses, upgrades,
// race best laps, settings.
const KEY = 'coral-heat-save-v29c';

export function createSave(G) {
  return {
    save() {
      try {
        const data = {
          cash: G.player.cash,
          missionIndex: G.missions.index,
          completed: G.missions.completed,
          owned: G.garage.owned,
          upgrades: G.garage.upgrades,
          raceWins: G.missions.raceWins || 0,
          health: G.player.health,
          armor: G.player.armor,
          station: G.sound.station,
          savedAt: Date.now(),
        };
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        G.player.cash = d.cash ?? 2500;
        G.missions.index = d.missionIndex ?? 0;
        G.missions.completed = d.completed || [];
        G.garage.owned = d.owned || [];
        G.garage.upgrades = d.upgrades || { engine: 0, tires: 0, armor: 0, nitro: 0 };
        G.missions.raceWins = d.raceWins || 0;
        G.player.health = d.health ?? 100;
        G.player.armor = d.armor ?? 0;
        G.sound.station = d.station || 0;
        return d;
      } catch (e) { return null; }
    },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
}
