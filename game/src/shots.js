// CORAL HEAT — screenshot staging: deterministic scene setups for the four
// screenshots. Each stage function puts the player, traffic, cops, heli and
// HUD into a fixed frame, then the boot loop renders it. The headless
// capture runs the page with ?shot=1..4 and grabs the canvas after the
// scene has settled. Nothing here edits pixels — every shot is a real render.
Coral.shots = (function () {
  'use strict';
  var U = Coral.util;

  function clearHeat(state) {
    Coral.cops.clearForce(state);
    state.heatTimer = 0;
  }

  function placePlayerCar(state, x, z, heading, speed, colorIdx) {
    if (state.player.car) {
      state.scene.remove(state.player.car.mesh);
      state.player.car = null;
    }
    if (state.player.bike) Coral.bikes.dismountBike(state);
    if (state.player.boat) Coral.boats.leaveBoat(state);
    var car = Coral.drive.makeCar(state, x, z, heading, colorIdx, 'civil');
    car.driver = 'player';
    car.speed = speed;
    state.player.car = car;
    state.player.onFoot = false;
    state.player.mesh.visible = false;
    state.player.x = x;
    state.player.z = z;
    state.player.heading = heading;
    state.player.speed = speed;
    return car;
  }

  function addCopChase(state, count, spread) {
    // Cops ahead of the player, fanned across the road, so they are in
    // frame for the cover instead of scattered behind the camera.
    state.cops = state.cops || [];
    var heading = state.player.heading || 0;
    var rightX = Math.cos(heading), rightZ = -Math.sin(heading);
    var fwdX = Math.sin(heading), fwdZ = Math.cos(heading);
    var slots = [[16, -11], [22, 9], [28, -4], [19, 14], [32, 0]];
    for (var i = 0; i < count; i++) {
      var s = slots[i % slots.length];
      var cx = state.player.x + fwdX * s[0] + rightX * s[1];
      var cz = state.player.z + fwdZ * s[0] + rightZ * s[1];
      var cop = Coral.drive.makeCar(state, cx, cz,
        Math.atan2(state.player.x - cx, state.player.z - cz), 5, 'cop');
      cop.driver = 'cop';
      cop.speed = 26 + i * 2;
      state.cops.push(cop);
    }
  }

  function snapCamera(state) {
    // Put the camera exactly behind the player NOW (no damping wait): the
    // headless capture has few frames, so the frame must be right at once.
    var p = state.player;
    var yaw = state.camYaw || 0;
    var dist = p.onFoot ? 8.5 : 11.5;
    var height = p.onFoot ? 3.4 : 4.2;
    var pitch = state.camPitch === undefined ? 0.32 : state.camPitch;
    state.camera.position.set(
      p.x - Math.sin(yaw) * dist,
      p.y + height + Math.sin(pitch) * dist * 0.4,
      p.z - Math.cos(yaw) * dist);
    state.camera.lookAt(p.x, p.y + 1.6, p.z);
  }

  function stageCover(state) {
    // Shot 1 — the v2.10 frame: dense neon casino chase.
    // Player car on the casino road (x=186) heading due north (+z) at
    // ~116 MPH (52 m/s), 5 stars, 4 cop cars ahead in frame, heli + searchlight
    // ahead overhead, roadblock with spikes ahead, explosion glow ahead,
    // the Golden Coral casino dead ahead so its neon fills the background.
    clearHeat(state);
    var car = placePlayerCar(state, 186, 10, 0, 52, 0);
    car.health = 100;
    Coral.cops.setWanted(state, 5, '');
    addCopChase(state, 4, 22);
    // Helicopter low and AHEAD, beam on the player.
    ensureHeli(state);
    if (state.heli) state.heli.orbitA = Math.PI / 2;
    Coral.cops.deployRoadblock(state);
    // One explosion ahead-left of the player car, off the road line.
    Coral.fight.explode(state, 168, 42, 1.1);
    Coral.fight.smoke(state, 168, 3, 42, 8);
    // Extra traffic for density.
    Coral.drive.spawnTraffic(state, 6);
    if (state.hud) {
      state.hud.setMission(
        { id: 18, title: 'The Chase' },
        { label: 'CASINO HEIST — ESCAPE' });
      state.hud.showToast('CASINO HEIST — ESCAPE · 5 stars · 116 MPH');
    }
    state.camYaw = car.heading;
    state.camPitch = 0.26;
    state.shotMode = 1;
  }

  function ensureHeli(state) {
    // buildHeli lives in cops.js; call it through the module if present.
    if (state.heli) return state.heli;
    if (Coral.cops && Coral.cops.buildHeli) return Coral.cops.buildHeli(state);
    return null;
  }

  function stageMarina(state) {
    // Shot 2 — marina / boat chase: speedboat underway + police boats,
    // mission 21/22 on the HUD.
    clearHeat(state);
    var boat = Coral.boats.stageGetawayBoat(state);
    Coral.boats.boardBoat(state, boat);
    boat.speed = 34;
    boat.heading = Math.PI * 0.85;
    boat.x = -60;
    boat.z = 300;
    Coral.cops.setWanted(state, 3, '');
    Coral.boats.spawnPoliceBoats(state, 2);
    // Police boats flanking AHEAD of the player boat, in frame, closing in.
    var pbs = state.policeBoats || [];
    if (pbs[0]) {
      pbs[0].x = boat.x - 12; pbs[0].z = boat.z - 18; pbs[0].heading = boat.heading;
      pbs[0].mesh.position.set(pbs[0].x, 0.3, pbs[0].z);
    }
    if (pbs[1]) {
      pbs[1].x = boat.x + 12; pbs[1].z = boat.z - 21; pbs[1].heading = boat.heading;
      pbs[1].mesh.position.set(pbs[1].x, 0.3, pbs[1].z);
    }
    if (state.hud) {
      state.hud.setMission(
        { id: 21, title: 'Boat Getaway' },
        { label: 'Run the coast to the south buoy' });
      state.hud.showToast('BOAT GETAWAY — police boats closing');
    }
    state.camYaw = boat.heading;
    state.camPitch = 0.34;
    state.shotMode = 2;
  }

  function stageCarjack(state) {
    // Shot 3 — on-foot carjacking: player beside a traffic car, door open,
    // driver fleeing, HUD prompt visible.
    clearHeat(state);
    if (state.player.car) {
      state.scene.remove(state.player.car.mesh);
      state.player.car = null;
    }
    state.player.onFoot = true;
    state.player.mesh.visible = true;
    state.player.x = 62;
    state.player.z = 58;
    state.player.heading = Math.PI / 2;
    state.player.mesh.position.set(62, 0, 58);
    var target = Coral.drive.makeCar(state, 70, 63, Math.PI / 2, 2, 'civil');
    target.driver = 'traffic';
    target.speed = 0;
    state.traffic = state.traffic || [];
    state.traffic.push(target);
    // A fleeing driver ped.
    if (state.peds && state.peds.length) {
      var pd = state.peds[0];
      pd.x = 70; pd.z = 66;
      pd.fleeing = true;
      pd.heading = Math.PI / 4;
    }
    Coral.cops.setWanted(state, 1, 'carjacking');
    if (state.hud) {
      state.hud.setMission(
        { id: 2, title: 'Hot Wheels' },
        { label: 'Steal a Marina GT from the boulevard' });
      state.hud.showToast('Press E to jack the car');
    }
    state.camYaw = Math.PI / 2;
    state.camPitch = 0.32;
    state.shotMode = 3;
  }

  function stageRace(state) {
    // Shot 4 — street race: player car mid-circuit, rival alongside, gates
    // and position/lap on the HUD. The car is staged just before gate 0
    // (0,0) so the gate is visible ahead; the countdown is skipped so the
    // car is already rolling at speed.
    clearHeat(state);
    var car = placePlayerCar(state, 0, -186, Math.PI / 2, 40, 1);
    Coral.raceway.startRace(state, 0);
    var act = Coral.raceway.active;
    if (act) act.countdown = 0;
    car.x = 0; car.z = -42;
    car.heading = 0;
    car.speed = 38;
    car.mesh.position.set(0, 0, -42);
    car.mesh.rotation.y = 0;
    state.player.x = 0; state.player.z = -42; state.player.heading = 0;
    if (state.hud) {
      state.hud.setMission(
        { id: 5, title: 'Midnight Run' },
        { label: 'Win the midnight circuit (race 1)' });
    }
    state.camYaw = car.heading;
    state.camPitch = 0.3;
    state.shotMode = 4;
  }

  function stage(state, n) {
    if (n === 1) stageCover(state);
    else if (n === 2) stageMarina(state);
    else if (n === 3) stageCarjack(state);
    else if (n === 4) stageRace(state);
    else return false;
    snapCamera(state);
    // Freeze the staged moment: stop the mission clock from advancing the
    // objective away while the capture settles.
    state.shotSettled = false;
    setTimeout(function () { state.shotSettled = true; }, 1200);
    return true;
  }

  function shotFromUrl() {
    var m = /[?&]shot=(\d)/.exec(window.location.search || '');
    return m ? Number(m[1]) : 0;
  }

  return {
    stage: stage,
    stageCover: stageCover,
    stageMarina: stageMarina,
    stageCarjack: stageCarjack,
    stageRace: stageRace,
    shotFromUrl: shotFromUrl,
  };
})();
