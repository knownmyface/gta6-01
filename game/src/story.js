// CORAL HEAT — the story, missions 1-11, and the mission engine.
// A mission is a title, a one-line objective, a target on the map and a
// completion rule (reach it, steal a car, win a race, hold a spot, escape
// with heat on you). Completing one banks cash, advances the story and
// autosaves; the beacon in the world always points at the current target.
CH.story = (function () {
  const U = CH.util;
  let beacon = null, beaconRing = null;

  const M1 = [
    { id: 1, title: 'New in Town', sub: 'Drive or walk to the marina boulevard', type: 'goto', target: { x: 0, z: 240 }, radius: 14, reward: 300 },
    { id: 2, title: 'Borrowed Wheels', sub: 'Jack a car — walk up to one and press E', type: 'steal', target: { x: 0, z: 240 }, radius: 30, reward: 400 },
    { id: 3, title: 'Neon Strip Cruise', sub: 'Cruise to the casino district', type: 'goto', target: { x: -180, z: -120 }, radius: 14, reward: 500 },
    { id: 4, title: 'The Fixer', sub: 'Meet the fixer at the Palm Court safehouse', type: 'goto', target: { x: -60, z: 120 }, radius: 10, reward: 600 },
    { id: 5, title: 'Heat Check', sub: 'Get the cops on you, then lose them at the park', type: 'escape', target: { x: 120, z: 120 }, radius: 14, reward: 700 },
    { id: 6, title: 'Midnight Circuit', sub: 'Win the Marina Loop street race', type: 'race', target: { x: 0, z: 240 }, radius: 16, reward: 1500, circuit: 0 },
    { id: 7, title: 'Two Wheels', sub: 'Ride a bike to the pier — grab one on the street', type: 'bike', target: { x: 0, z: 240 }, radius: 12, reward: 800 },
    { id: 8, title: 'Jackpot Run', sub: 'Jack another car and bring it to the casino strip', type: 'steal', target: { x: -180, z: -60 }, radius: 20, reward: 700 },
    { id: 9, title: 'Casing the Coral Palms', sub: 'Scout the casino from the boulevard', type: 'goto', target: { x: -150, z: -150 }, radius: 14, reward: 800 },
    { id: 10, title: 'Inside the Palms', sub: 'Walk through the casino doors', type: 'enter', target: { x: -150, z: -135 }, radius: 8, reward: 900 },
    { id: 11, title: 'Wheelman', sub: 'Escape a 3-star chase to the east docks', type: 'escape3', target: { x: 180, z: 180 }, radius: 16, reward: 1200 },
  ];

  function all() { return M1.concat(CH.story2.list); }

  function current() {
    const S = CH.S;
    const list = all();
    return list[Math.min(S.missions.idx, list.length - 1)];
  }

  function buildBeacon(scene) {
    beacon = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 4.5, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e })
    );
    beacon.rotation.x = Math.PI;
    scene.add(beacon);
    beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(3, 4.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    beaconRing.rotation.x = -Math.PI / 2;
    scene.add(beaconRing);
    moveBeacon();
  }

  function moveBeacon() {
    const m = current();
    if (!m || !beacon) return;
    beacon.position.set(m.target.x, 14 + Math.sin(CH.S.clock * 2) * 0.8, m.target.z);
    beaconRing.position.set(m.target.x, 0.12, m.target.z);
    beacon.visible = true; beaconRing.visible = true;
  }

  function startMission(m) {
    const S = CH.S;
    if (m.type === 'race' && !S.race.active && !S.race.finished) {
      CH.raceway.startRace(m.circuit || 0, S.scene);
    }
    if (m.id === 21 || m.id === 22) {
      // Police boats join the chase for the waterfront finale.
      if (S.boats.policeBoats.length === 0) {
        CH.boats.spawnPoliceBoat(S.scene, 60, 350);
        CH.boats.spawnPoliceBoat(S.scene, -60, 360);
      }
      CH.cops.setWanted(4);
    }
    if (m.type === 'escape3') CH.cops.setWanted(3);
    if (m.id === 17) CH.cops.setWanted(4);
    if (m.id === 18) CH.cops.setWanted(5);
    CH.hud.banner('MISSION ' + m.id + ' — ' + m.title.toUpperCase());
    CH.hud.toast(m.title.toUpperCase() + ': ' + m.sub);
    moveBeacon();
  }

  function complete() {
    const S = CH.S;
    const m = current();
    if (!m) return;
    S.player.cash += m.reward;
    S.stats.missionsDone++;
    CH.sound.missionDone();
    CH.hud.banner('MISSION COMPLETE — ' + m.title.toUpperCase() + '  +' + U.fmtCash(m.reward));
    if (S.missions.idx < all().length - 1) {
      S.missions.idx++;
      startMission(current());
    } else {
      CH.hud.banner('STORY COMPLETE — CORAL HEAT CLEARED');
      beacon.visible = false; beaconRing.visible = false;
    }
    // Save AFTER advancing, so a reload resumes on the next mission.
    CH.savegame.autosave();
  }

  function update(dt) {
    const S = CH.S, p = S.player;
    if (!p || S.mode !== 'play') return;
    const m = current();
    if (!m) return;
    // Beacon bobs above the target.
    if (beacon) {
      beacon.position.y = 14 + Math.sin(S.clock * 2) * 0.8;
      beacon.rotation.y += dt * 1.5;
    }
    const d = U.dist2(p.x, p.z, m.target.x, m.target.z);
    switch (m.type) {
      case 'goto':
      case 'enter':
        if (d < m.radius) complete();
        break;
      case 'steal':
        if (p.inCar && d < m.radius) complete();
        break;
      case 'bike':
        if (p.inBike && d < m.radius) complete();
        break;
      case 'escape':
        if (p.wanted >= 1 && d < m.radius) complete();
        break;
      case 'escape3':
        if (p.wanted >= 3 && d < m.radius) complete();
        break;
      case 'race':
        if (S.race.finished) complete();
        break;
      case 'boat':
        if (p.inBoat && d < m.radius) complete();
        break;
      case 'hold': {
        if (d < m.radius) {
          m._hold = (m._hold || 0) + dt;
          if (m._hold > 10) complete();
        } else m._hold = 0;
        break;
      }
      default:
        if (d < m.radius) complete();
    }
  }

  return { M1, all, current, buildBeacon, moveBeacon, startMission, complete, update };
})();
