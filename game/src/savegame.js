// CORAL HEAT — save / load (localStorage) (v2.9, fresh).
const KEY = 'coralheat-save-v29';

export function setupSave(G) {
  G.saveGame = function () {
    try {
      const data = {
        cash: G.player.cash,
        missionsDone: G.missionDone,
        owned: G.garage.owned,
        stored: G.garage.stored,
        upgrades: G.player.upgrades,
        bestLaps: G.bestLaps,
        weapons: G.player.weapons,
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable — play on without saving */ }
  };
  G.loadGame = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.cash === 'number') G.player.cash = data.cash;
      if (Array.isArray(data.missionsDone)) G.missionDone = data.missionsDone;
      if (Array.isArray(data.owned)) { G.garage.owned = data.owned; G.player.ownedSafehouses = data.owned; }
      if (Array.isArray(data.stored)) G.garage.stored = data.stored;
      if (data.upgrades) G.player.upgrades = { ...G.player.upgrades, ...data.upgrades };
      if (data.bestLaps) G.bestLaps = data.bestLaps;
      if (Array.isArray(data.weapons)) {
        for (let i = 0; i < data.weapons.length && i < G.player.weapons.length; i++) {
          if (typeof data.weapons[i].ammo === 'number') G.player.weapons[i].ammo = data.weapons[i].ammo;
        }
      }
      return true;
    } catch (e) { return false; }
  };
  G.clearSave = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  };
}
