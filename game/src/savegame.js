// savegame.js — save / load through localStorage: cash, missions done,
// owned safehouses, upgrades and the best lap per race.
const KEY = 'coral-heat-save-v210';

export function saveGame(W) {
  try {
    const data = {
      cash: W.player.cash,
      missions: W.story.done.concat(W.story2.done.map((id) => 100 + id)),
      storyIndex: W.story.index,
      story2Index: W.story2.index,
      owned: W.garage.owned,
      upgrades: W.garageUpgrades,
      bestLaps: W.bestLaps || {},
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(W) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash === 'number') W.player.cash = data.cash;
    if (Array.isArray(data.missions)) {
      W.story.done = data.missions.filter((id) => id < 100);
      W.story2.done = data.missions.filter((id) => id >= 100).map((id) => id - 100);
    }
    if (typeof data.storyIndex === 'number') W.story.index = Math.max(W.story.index, data.storyIndex);
    if (typeof data.story2Index === 'number') W.story2.index = Math.max(W.story2.index, data.story2Index);
    if (data.owned) Object.assign(W.garage.owned, data.owned);
    if (data.upgrades) Object.assign(W.garageUpgrades, data.upgrades);
    if (data.bestLaps) W.bestLaps = data.bestLaps;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // Storage unavailable — nothing to clear.
  }
}
