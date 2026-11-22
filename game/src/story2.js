// CORAL HEAT — story missions 12–22: the casino-heist finale chain and the
// boat missions. Recon, getaway driver, vault, escape by boat, then a
// waterfront pursuit with police boats. Shares the mission manager shape
// from story.js; the two files together are the full 22-mission story.
Coral.story2 = (function () {
  'use strict';
  var U = Coral.util;

  function at(x, z) { return { x: x, z: z }; }

  var MISSIONS = [
    {
      id: 12, title: 'Casing the Coral', giver: 'Ilsa Kane',
      brief: 'The heist starts with eyes, not guns. Photograph the vault door, the guard rotation and the boat dock behind the casino — all in one night.',
      objectives: [
        { type: 'goto', label: 'Photograph the casino vault door', pos: at(205, 100) },
        { type: 'goto', label: 'Photograph the guard post', pos: at(180, 130) },
        { type: 'goto', label: 'Photograph the boat dock', pos: at(120, 210) },
      ],
      pay: 4500, xp: 520,
    },
    {
      id: 13, title: 'Getaway Driver', giver: 'Deke Rallo',
      brief: 'Deke is lending you his best car for the job — but it is impounded. Break it out of the lot and bring it to the garage without a scratch.',
      objectives: [
        { type: 'steal', label: 'Steal the getaway car from the impound', pos: at(-124, -186) },
        { type: 'goto', label: 'Deliver it to the garage', pos: at(-186, 62) },
      ],
      pay: 5000, xp: 560,
    },
    {
      id: 14, title: 'The Inside Man', giver: 'Mara Voss',
      brief: 'A dealer named Sol owes Mara money and works the vault floor. Meet him at the casino bar, pay his debt, and he will leave the service door open.',
      objectives: [
        { type: 'goto', label: 'Meet Sol at the casino bar', pos: at(205, 115) },
        { type: 'goto', label: 'Check the service door', pos: at(225, 135) },
      ],
      pay: 5500, xp: 600,
    },
    {
      id: 15, title: 'Cut the Lights', giver: 'Ilsa Kane',
      brief: 'The casino runs on a substation two blocks over. Cut the power at midnight and the cameras go blind for exactly four minutes.',
      objectives: [
        { type: 'goto', label: 'Reach the substation', pos: at(248, 0) },
        { type: 'fight', label: 'Deal with the substation guards (2)', pos: at(248, 0), count: 2 },
        { type: 'survive', label: 'Hold the substation while Ilsa cuts in (20s)', pos: at(248, 0), secs: 20 },
      ],
      pay: 6500, xp: 680,
    },
    {
      id: 16, title: 'The Vault', giver: 'Ilsa Kane',
      brief: 'This is it. Walk into the Golden Coral through the service door, crack the vault, and take what the house owes this city.',
      objectives: [
        { type: 'goto', label: 'Enter the casino service door', pos: at(225, 135) },
        { type: 'goto', label: 'Reach the vault', pos: at(205, 100) },
        { type: 'survive', label: 'Crack the vault (30s)', pos: at(205, 100), secs: 30 },
      ],
      pay: 20000, xp: 900,
    },
    {
      id: 17, title: 'Silent Alarm', giver: 'Mara Voss',
      brief: 'The vault job tripped a silent alarm. The whole district is waking up — get to the getaway car before the roadblocks close the strip.',
      objectives: [
        { type: 'goto', label: 'Reach the getaway car', pos: at(180, 90) },
        { type: 'loseheat', label: 'Lose the 3-star wanted level', pos: at(0, 0) },
      ],
      pay: 8000, xp: 750,
    },
    {
      id: 18, title: 'The Chase', giver: 'Deke Rallo',
      brief: 'Five stars. Helicopter overhead, roadblocks ahead, spike strips on the road. Drive the strip and survive — the boat is waiting at the marina.',
      objectives: [
        { type: 'survive', label: 'Survive the 5-star chase (45s)', pos: at(0, 0), secs: 45 },
        { type: 'goto', label: 'Reach the marina dock', pos: at(-40, 235) },
      ],
      pay: 12000, xp: 1000,
    },
    {
      id: 19, title: 'Clean Hands', giver: 'Mara Voss',
      brief: 'The money is dirty and the heat is on. Lay low at the safehouse, swap the plates, and let the wanted level cool to nothing.',
      objectives: [
        { type: 'goto', label: 'Reach the safehouse', pos: at(-248, -62) },
        { type: 'loseheat', label: 'Wait out the wanted level', pos: at(0, 0) },
      ],
      pay: 6000, xp: 650,
    },
    {
      id: 20, title: 'The Split', giver: 'Ilsa Kane',
      brief: 'The crew meets at the pier to split the take. Someone talked — the meet is a setup. Get Ilsa out alive.',
      objectives: [
        { type: 'goto', label: 'Reach the pier meet', pos: at(-40, 235) },
        { type: 'fight', label: 'Fight off the ambush (5)', pos: at(-40, 235), count: 5 },
      ],
      pay: 15000, xp: 1100,
    },
    {
      id: 21, title: 'Boat Getaway', giver: 'Mara Voss',
      brief: 'The heist money is on a speedboat at the marina. Take the wheel, open the throttle and run the coast — the road is closed to you now.',
      objectives: [
        { type: 'boat', label: 'Board the speedboat at the pier', pos: at(-40, 235) },
        { type: 'boatgoto', label: 'Run the coast to the south buoy', pos: at(-260, 330) },
      ],
      pay: 18000, xp: 1200,
    },
    {
      id: 22, title: 'Waterfront Pursuit', giver: 'Deke Rallo',
      brief: 'Police boats are on the water and the helicopter is back. Outrun them down the coast, weave the buoys, and disappear into the fog.',
      objectives: [
        { type: 'boat', label: 'Take the speedboat out', pos: at(-40, 235) },
        { type: 'boatgoto', label: 'Outrun the police boats to the fog line', pos: at(260, 330) },
        { type: 'loseheat', label: 'Lose the wanted level on the water', pos: at(0, 0) },
      ],
      pay: 25000, xp: 1500,
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
    // Boat missions stage the boat at the pier before they begin.
    if (m.id === 21 || m.id === 22) {
      if (state.boats) state.boats.stageGetawayBoat(state);
      Coral.cops.setWanted(state, m.id === 22 ? 4 : 2, 'boat job');
    }
    if (m.id === 18) Coral.cops.setWanted(state, 5, 'the chase');
    if (m.id === 16) Coral.cops.setWanted(state, 3, 'silent alarm');
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

  function update(state, dt) {
    var ms = state.mission;
    if (!ms || ms.done) return;
    if (ms.def.id < 12) return; // story.js owns missions 1-11
    var obj = ms.def.objectives[ms.objIdx];
    if (!obj) return;
    var p = state.player;
    var d = U.dist2d(p.x, p.z, obj.pos.x, obj.pos.z);
    if (obj.type === 'goto' || obj.type === 'steal') {
      if (d < 9) Coral.story.advance(state);
    } else if (obj.type === 'fight') {
      if (ms.fightLeft <= 0) Coral.story.advance(state);
    } else if (obj.type === 'loseheat') {
      if (p.wanted === 0) Coral.story.advance(state);
    } else if (obj.type === 'survive') {
      // The chase mission counts survival anywhere; others need proximity.
      var anywhere = ms.def.id === 18 && ms.objIdx === 0;
      if (anywhere || d < 16) {
        ms.surviveT += dt;
        if (ms.surviveT >= (obj.secs || 20)) Coral.story.advance(state);
      } else {
        ms.surviveT = Math.max(0, ms.surviveT - dt * 2);
      }
    } else if (obj.type === 'boat') {
      if (state.boats && state.boats.playerInBoat(state)) Coral.story.advance(state);
      else if (state.hud) state.hud.setObjectiveMarker(obj.pos.x, obj.pos.z, d);
    } else if (obj.type === 'boatgoto') {
      if (state.boats && state.boats.playerInBoat(state) && d < 18) Coral.story.advance(state);
    }
    if (state.hud) state.hud.setObjectiveMarker(obj.pos.x, obj.pos.z, d);
  }

  function nextMissionId(state) {
    var done = state.completedMissions || [];
    for (var i = 0; i < MISSIONS.length; i++) {
      if (done.indexOf(MISSIONS[i].id) === -1) return MISSIONS[i].id;
    }
    return null;
  }

  function finaleComplete(state) {
    var done = state.completedMissions || [];
    return done.indexOf(22) !== -1;
  }

  return {
    MISSIONS: MISSIONS,
    missionById: missionById,
    startMission: startMission,
    update: update,
    nextMissionId: nextMissionId,
    finaleComplete: finaleComplete,
  };
})();
