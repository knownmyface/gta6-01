// CORAL HEAT — save/load via localStorage.
// Saves cash, health, XP, completed missions, owned safehouses, best laps and
// the player's position. Autosaves after every mission; the start screen
// offers Continue when a save exists.
Coral.savegame = (function () {
  'use strict';
  var U = Coral.util;
  var KEY = 'coral-heat-save-v1';

  function snapshot(state) {
    return {
      version: 1,
      savedAt: Date.now(),
      cash: state.player.cash,
      health: state.player.health,
      xp: state.player.xp || 0,
      wanted: 0,
      x: state.player.x,
      z: state.player.z,
      heading: state.player.heading,
      completedMissions: state.completedMissions || [],
      ownedHouses: state.ownedHouses || ['plaza'],
      bestLaps: state.bestLaps || {},
      ammo: state.ammo || {},
      weaponIdx: state.weaponIdx || 0,
      radioStation: state.radioStation || 0,
    };
  }

  function save(state, quiet) {
    try {
      var data = snapshot(state);
      localStorage.setItem(KEY, JSON.stringify(data));
      if (!quiet && state.hud) state.hud.showToast('Game saved');
      return true;
    } catch (e) {
      if (state.hud) state.hud.showToast('Save failed — storage unavailable');
      return false;
    }
  }

  function autosave(state) {
    return save(state, true);
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function hasSave() {
    return !!load();
  }

  function apply(state, data) {
    if (!data) return false;
    state.player.cash = data.cash;
    state.player.health = data.health;
    state.player.xp = data.xp || 0;
    state.player.x = data.x;
    state.player.z = data.z;
    state.player.heading = data.heading || 0;
    state.completedMissions = data.completedMissions || [];
    state.ownedHouses = data.ownedHouses || ['plaza'];
    state.bestLaps = data.bestLaps || {};
    state.ammo = data.ammo || {};
    state.weaponIdx = data.weaponIdx || 0;
    state.radioStation = data.radioStation || 0;
    state.player.mesh.position.set(data.x, 0, data.z);
    state.player.mesh.rotation.y = data.heading || 0;
    return true;
  }

  function clearSave() {
    try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
  }

  function saveSummary() {
    var data = load();
    if (!data) return null;
    var d = new Date(data.savedAt);
    return {
      cash: data.cash,
      missions: (data.completedMissions || []).length,
      when: U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes()) + ' ' +
        U.pad2(d.getDate()) + '/' + U.pad2(d.getMonth() + 1),
    };
  }

  return {
    save: save,
    autosave: autosave,
    load: load,
    hasSave: hasSave,
    apply: apply,
    clearSave: clearSave,
    saveSummary: saveSummary,
    KEY: KEY,
  };
})();
