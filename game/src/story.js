// CORAL HEAT — story missions 1–11: the rise of "Rin Marlowe", a courier
// who gets pulled into Port Coral's underworld. Each mission has a title, a
// briefing, a chain of objectives (go-to, deliver, steal, chase, survive),
// a payout and a completion line. The manager tracks the active objective
// and paints it on the HUD.
Coral.story = (function () {
  'use strict';
  var U = Coral.util;

  function at(x, z) { return { x: x, z: z }; }

  var MISSIONS = [
    {
      id: 1, title: 'First Delivery', giver: 'Mara Voss',
      brief: 'Mara runs the marina courier desk. Take her sealed package across town to the Sunset Motel. Drive careful — the package is worth more than your car.',
      objectives: [
        { type: 'goto', label: 'Pick up the package at the marina desk', pos: at(-40, 235) },
        { type: 'goto', label: 'Deliver it to the Sunset Motel', pos: at(-186, -124) },
      ],
      pay: 400, xp: 100,
    },
    {
      id: 2, title: 'Hot Wheels', giver: 'Mara Voss',
      brief: 'A client wants a Marina GT, any colour, no questions. Steal one from the boulevard and bring it to the lockup.',
      objectives: [
        { type: 'steal', label: 'Steal a Marina GT from the boulevard', pos: at(62, 62) },
        { type: 'goto', label: 'Deliver the car to the lockup', pos: at(186, -62) },
      ],
      pay: 800, xp: 120,
    },
    {
      id: 3, title: 'Shakedown', giver: 'Deke Rallo',
      brief: 'Deke owns the arcade on Coral Row. A rival crew is leaning on his tenants. Go and convince them to leave — fists or otherwise.',
      objectives: [
        { type: 'goto', label: 'Reach the arcade on Coral Row', pos: at(124, 0) },
        { type: 'fight', label: 'Clear out the rival crew (3)', pos: at(124, 0), count: 3 },
      ],
      pay: 900, xp: 150,
    },
    {
      id: 4, title: 'The Getaway', giver: 'Mara Voss',
      brief: 'A courier job went loud. Lose a 2-star wanted level, then meet Mara at the pier. The cops have your plate — do not stop for them.',
      objectives: [
        { type: 'loseheat', label: 'Lose the 2-star wanted level', pos: at(0, 0) },
        { type: 'goto', label: 'Meet Mara at the pier', pos: at(-40, 235) },
      ],
      pay: 1100, xp: 180,
    },
    {
      id: 5, title: 'Midnight Run', giver: 'Deke Rallo',
      brief: 'Race the midnight circuit before the sun comes up: three gates, one rival, no brakes. Win and the crew respects you.',
      objectives: [
        { type: 'race', label: 'Win the midnight circuit (race 1)', pos: at(0, -186), race: 0 },
      ],
      pay: 1500, xp: 220,
    },
    {
      id: 6, title: 'Guns for Hire', giver: 'Ilsa Kane',
      brief: 'Ilsa needs a package moved through a roadblock district. Buy a P9 at Marina Arms first — you will not get through unarmed.',
      objectives: [
        { type: 'goto', label: 'Buy a weapon at Marina Arms', pos: at(-124, 124) },
        { type: 'goto', label: 'Move the package through the checkpoint', pos: at(248, 62) },
      ],
      pay: 1600, xp: 240,
    },
    {
      id: 7, title: 'Repo Man', giver: 'Deke Rallo',
      brief: 'Three cars, three debtors, one night. Tow them back to the garage. The third debtor keeps a shotgun by the door.',
      objectives: [
        { type: 'steal', label: 'Recover car 1 of 3', pos: at(-62, 186) },
        { type: 'steal', label: 'Recover car 2 of 3', pos: at(124, -124) },
        { type: 'goto', label: 'Return the cars to the garage', pos: at(-186, 62) },
      ],
      pay: 2200, xp: 300,
    },
    {
      id: 8, title: 'Harbor Lights', giver: 'Ilsa Kane',
      brief: 'A smuggler is landing at the marina at dusk. Photograph the meet — get close enough to see faces, far enough to stay alive.',
      objectives: [
        { type: 'goto', label: 'Reach the marina overlook', pos: at(-102, 210) },
        { type: 'survive', label: 'Hold the overlook for 30 seconds', pos: at(-102, 210), secs: 30 },
      ],
      pay: 2400, xp: 320,
    },
    {
      id: 9, title: 'The Informant', giver: 'Mara Voss',
      brief: 'A cop named Ferran is selling case files. Meet him in the plaza, pay him, and get out before his own unit spots you.',
      objectives: [
        { type: 'goto', label: 'Meet Ferran in the plaza', pos: at(0, 0) },
        { type: 'goto', label: 'Escape to the safehouse', pos: at(-248, -62) },
      ],
      pay: 3000, xp: 380,
    },
    {
      id: 10, title: 'Burn Notice', giver: 'Deke Rallo',
      brief: 'The arcade is wired to blow and the crew that did it is still inside. Get in, get Deke\u2019s ledger, get out before the fire catches you.',
      objectives: [
        { type: 'goto', label: 'Enter the arcade', pos: at(124, 0) },
        { type: 'fight', label: 'Take the ledger from the crew (4)', pos: at(124, 0), count: 4 },
        { type: 'goto', label: 'Escape the burning arcade', pos: at(186, 62) },
      ],
      pay: 3800, xp: 450,
    },
    {
      id: 11, title: 'The Long Con', giver: 'Ilsa Kane',
      brief: 'Ilsa has been playing the Golden Coral Casino for months. Tonight you drive the scout car past the casino and map every camera on the strip.',
      objectives: [
        { type: 'goto', label: 'Scout the casino front', pos: at(205, 115) },
        { type: 'goto', label: 'Scout the casino rear', pos: at(205, 150) },
        { type: 'goto', label: 'Report back to Ilsa', pos: at(-124, 124) },
      ],
      pay: 4200, xp: 500,
    },
  ];

  function missionById(id) {
    for (var i = 0; i < MISSIONS.length; i++) {
      if (MISSIONS[i].id === id) return MISSIONS[i];
    }
    return null;
  }

  function startMission(state, id) {
    var m = missionById(id);
    if (!m) return false;
    state.mission = {
      def: m, objIdx: 0, startedAt: state.time || 0,
      surviveT: 0, fightLeft: 0, done: false,
    };
    var obj = m.objectives[0];
    if (obj.type === 'fight') state.mission.fightLeft = obj.count;
    if (state.hud) {
      state.hud.showToast('MISSION — ' + m.title + ' · ' + m.giver);
      state.hud.setMission(m, obj);
    }
    if (state.sound) state.sound.mission();
    return true;
  }

  function currentObjective(state) {
    if (!state.mission) return null;
    return state.mission.def.objectives[state.mission.objIdx] || null;
  }

  function advance(state) {
    var ms = state.mission;
    if (!ms) return;
    ms.objIdx++;
    if (ms.objIdx >= ms.def.objectives.length) {
      completeMission(state);
      return;
    }
    var obj = ms.def.objectives[ms.objIdx];
    if (obj.type === 'fight') ms.fightLeft = obj.count;
    if (obj.type === 'survive') ms.surviveT = 0;
    if (state.hud) state.hud.setMission(ms.def, obj);
    if (state.hud) state.hud.showToast('Objective: ' + obj.label);
  }

  function completeMission(state) {
    var ms = state.mission;
    if (!ms) return;
    ms.done = true;
    var m = ms.def;
    state.player.cash += m.pay;
    state.player.xp = (state.player.xp || 0) + m.xp;
    state.completedMissions = state.completedMissions || [];
    state.completedMissions.push(m.id);
    if (state.hud) {
      state.hud.showToast('MISSION COMPLETE — ' + m.title + ' · +' + U.fmtMoney(m.pay));
      state.hud.clearMission();
      state.hud.updateCash();
    }
    if (state.sound) state.sound.win();
    state.mission = null;
    if (state.savegame) state.savegame.autosave(state);
  }

  function failMission(state, reason) {
    var ms = state.mission;
    if (!ms) return;
    if (state.hud) state.hud.showToast('MISSION FAILED — ' + reason);
    if (state.hud) state.hud.clearMission();
    state.mission = null;
  }

  function update(state, dt) {
    var ms = state.mission;
    if (!ms || ms.done) return;
    var obj = currentObjective(state);
    if (!obj) return;
    var p = state.player;
    var d = U.dist2d(p.x, p.z, obj.pos.x, obj.pos.z);
    if (obj.type === 'goto' || obj.type === 'steal') {
      if (d < 9) {
        if (obj.type === 'steal' && p.onFoot) {
          if (state.hud) state.hud.showToast('Get in a car first — press E near one');
          return;
        }
        if (obj.type === 'steal' && !p.car) return;
        advance(state);
      }
    } else if (obj.type === 'fight') {
      if (ms.fightLeft <= 0) advance(state);
    } else if (obj.type === 'loseheat') {
      if (p.wanted === 0) advance(state);
    } else if (obj.type === 'survive') {
      if (d < 16) {
        ms.surviveT += dt;
        if (ms.surviveT >= (obj.secs || 20)) advance(state);
      } else {
        ms.surviveT = Math.max(0, ms.surviveT - dt * 2);
      }
    } else if (obj.type === 'race') {
      if (state.raceway && state.raceway.lastResult === 'win' && state.raceway.lastRace === obj.race) {
        advance(state);
      }
    }
    // Marker beacon update for the HUD minimap.
    if (state.hud) state.hud.setObjectiveMarker(obj.pos.x, obj.pos.z, d);
  }

  function nextMissionId(state) {
    var done = state.completedMissions || [];
    for (var i = 0; i < MISSIONS.length; i++) {
      if (done.indexOf(MISSIONS[i].id) === -1) return MISSIONS[i].id;
    }
    return null;
  }

  return {
    MISSIONS: MISSIONS,
    missionById: missionById,
    startMission: startMission,
    currentObjective: currentObjective,
    advance: advance,
    completeMission: completeMission,
    failMission: failMission,
    update: update,
    nextMissionId: nextMissionId,
  };
})();
