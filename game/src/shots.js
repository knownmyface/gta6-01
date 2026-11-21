// CORAL HEAT — screenshot staging. ?shot=chase|foot|marina|race builds a
// dense, deterministic scene from the real game systems (real traffic,
// real police, real HUD), then raises window.__shotReady so the capture
// runner can take the frame. The chase scene restores the v2.10 cover
// frame: a dense neon casino chase at ~116 MPH with 5 stars.
CH.shots = (function () {
  const U = CH.util;

  function stage(name) {
    const S = CH.S, p = S.player;
    S.shot = name;
    S.shotReadyAt = S.frame + 45; // scene is staged synchronously; ~26 s at headless fps is plenty of settling
    CH.hud.hideStart();
    S.mode = 'play';
    CH.sound.start();
    if (name === 'chase') stageChase();
    else if (name === 'foot') stageFoot();
    else if (name === 'marina') stageMarina();
    else if (name === 'race') stageRace();
    // Keep the scene alive until the runner captures it.
    S.shotHoldUntil = S.frame + 900;
  }

  function putPlayerInCar(x, z, heading, specIdx) {
    const S = CH.S, p = S.player;
    const spec = CH.drive.CAR_TYPES[specIdx % CH.drive.CAR_TYPES.length];
    const car = CH.drive.newCar(x, z, heading, spec);
    S.scene.add(car.mesh);
    S.traffic.cars.push(car);
    p.x = x; p.z = z; p.heading = heading;
    CH.drive.enterCar(car);
    return car;
  }

  function stageChase() {
    const S = CH.S, p = S.player;
    // Mission 17, the heist escape, so the panel reads the heist.
    S.missions.idx = 16;
    CH.story.startMission(CH.story.current());
    const car = putPlayerInCar(-180, -100, Math.PI, 4); // Muscle car, heading north
    // The speedometer override: the car is staged still, the dial reads 116.
    S.shotSpeed = 52;
    p.cash = 48250;
    CH.cops.setWanted(5);
    // Four police cars: two flanking ahead of the player, two holding the
    // roadblock, all inside the camera frame.
    const pc1 = CH.cops.spawnPoliceCar(S.scene, p.x, p.z);
    pc1.x = -186; pc1.z = -112; pc1.heading = Math.PI; pc1.mesh.position.set(-186, 0, -112); pc1.mesh.rotation.y = Math.PI;
    const pc2 = CH.cops.spawnPoliceCar(S.scene, p.x, p.z);
    pc2.x = -174; pc2.z = -114; pc2.heading = Math.PI; pc2.mesh.position.set(-174, 0, -114); pc2.mesh.rotation.y = Math.PI;
    const pc3 = CH.cops.spawnPoliceCar(S.scene, p.x, p.z);
    pc3.x = -188; pc3.z = -160; pc3.heading = 0; pc3.mesh.position.set(-188, 0, -160); pc3.mesh.rotation.y = 0;
    const pc4 = CH.cops.spawnPoliceCar(S.scene, p.x, p.z);
    pc4.x = -172; pc4.z = -162; pc4.heading = 0; pc4.mesh.position.set(-172, 0, -162); pc4.mesh.rotation.y = 0;
    // Helicopter low and ahead, searchlight on the player.
    CH.cops.ensureHeli(S.scene);
    if (S.police.heli) {
      S.police.heli.mesh.position.set(-170, 24, -138);
      S.police.heli.angle = 0.6;
    }
    // Roadblock with spike strips on the boulevard ahead.
    CH.cops.makeRoadblock(S.scene, -180, -168, Math.PI);
    // Extra traffic for density on the boulevard ahead (staged: they hold
    // their pose for the frame instead of driving off).
    for (let i = 0; i < 3; i++) {
      const t = CH.drive.newCar(-180 + (i % 2 ? 4 : -4), -122 - i * 18, Math.PI, CH.drive.CAR_TYPES[i % CH.drive.CAR_TYPES.length]);
      t.speed = 10; t.staged = true;
      S.scene.add(t.mesh);
      S.traffic.cars.push(t);
    }
    // Clear pedestrians off the chase boulevard so the frame reads as a
    // pure car chase, not a crowd scene.
    for (const ped of S.traffic.peds) {
      if (Math.abs(ped.x + 180) < 30 && ped.z < -60 && ped.z > -200) {
        ped.x = U.rand(60, 240); ped.z = U.rand(-240, 240);
        ped.mesh.position.set(ped.x, 0, ped.z);
      }
    }
    // An explosion blooming beside the roadblock, re-lit by tick().
    CH.fight.explode(-158, 1, -142, 1.8);
    CH.fight.explode(-196, 1, -128, 1.1);
    S._lastBoom = S.clock;
    S.shotBanner = 'CASINO HEIST — ESCAPE';
    CH.hud.banner(S.shotBanner);
    // Sun-side camera: the boot camera already sits behind the car.
    S.camera.position.set(-180, 4.5, -82);
  }

  function stageFoot() {
    const S = CH.S, p = S.player;
    S.missions.idx = 1;
    CH.story.startMission(CH.story.current());
    // On the x=0 road, facing the taxi parked at the kerb.
    p.x = 0; p.z = 30; p.heading = 0.64;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.visible = true;
    const car = CH.drive.newCar(2, 33, Math.PI * 0.75, CH.drive.CAR_TYPES[3]);
    car.staged = true; // the jack target waits by the kerb for the frame
    S.scene.add(car.mesh);
    S.traffic.cars.push(car);
    CH.cops.setWanted(1);
    const pc = CH.cops.spawnPoliceCar(S.scene, p.x, p.z);
    pc.x = 60; pc.z = 60; pc.heading = Math.PI * 0.75;
    pc.mesh.position.set(60, 0, 60); pc.mesh.rotation.y = pc.heading;
    p.cash = 1250;
    S.shotBanner = 'MISSION 2 — BORROWED WHEELS';
    CH.hud.banner(S.shotBanner);
    S.camera.position.set(-4, 3.2, 24);
  }

  function stageMarina() {
    const S = CH.S, p = S.player;
    S.missions.idx = 20;
    CH.story.startMission(CH.story.current());
    // Board the first moored speedboat and run it north past the pier (x=30
    // keeps it clear of the pier deck), police boats in pursuit behind.
    const boat = S.boats.list[0];
    p.x = boat.x; p.z = boat.z; p.heading = Math.PI;
    CH.boats.board(boat);
    p.boat.x = 30; p.boat.z = 384; p.boat.heading = Math.PI;
    p.boat.mesh.position.set(30, 0.1, 384);
    p.x = 30; p.z = 384; p.heading = Math.PI;
    CH.boats.spawnPoliceBoat(S.scene, 16, 408);
    CH.boats.spawnPoliceBoat(S.scene, 44, 414);
    S.input.keys.KeyW = true; // throttle open, wake trailing
    S.shotSpeed = 28;
    p.cash = 51200;
    S.shotBanner = 'MISSION 21 — BOAT GETAWAY';
    CH.hud.banner(S.shotBanner);
    S.camera.position.set(30, 5, 402);
  }

  function stageRace() {
    const S = CH.S, p = S.player;
    S.missions.idx = 5;
    CH.story.startMission(CH.story.current());
    // Player car on the Marina Loop start line, already past gate 0 and
    // closing on gate 1 (the amber ring, 40 m ahead), one rival just ahead
    // so the HUD reads P2/4 on lap 1.
    const g0 = CH.raceway.CIRCUITS[0].gates[0];
    const g1 = CH.raceway.CIRCUITS[0].gates[1];
    const car = putPlayerInCar(110, 240, Math.atan2(g1[0] - g0[0], g1[1] - g0[1]), 1);
    S.race.gate = 1; // staged past the start gate, chasing gate 1
    S.input.keys.KeyW = true;
    S.shotSpeed = null; // live speed from the race
    const r0 = S.race.racers[0];
    if (r0) {
      r0.x = 168; r0.z = 237;
      r0.raceGate = 1;
      r0.mesh.position.set(r0.x, 0, r0.z);
    }
    p.cash = 8750;
    S.shotBanner = 'MISSION 6 — MIDNIGHT CIRCUIT';
    CH.hud.banner(S.shotBanner);
    S.camera.position.set(g0[0], 4.5, g0[1] - 24);
  }

  function tick() {
    const S = CH.S;
    if (!S.shot) return;
    // The staged banner must not fade before the capture.
    if (S.shotBanner) CH.hud.banner(S.shotBanner);
    if (S.shot === 'chase') {
      // Keep the fireball alive on GAME time, not frames: headless runs
      // ~1.7 fps, so a frame-based retrigger would leave long dark gaps.
      if (S.clock - (S._lastBoom || 0) > 0.9) {
        S._lastBoom = S.clock;
        CH.fight.explode(-158, 1, -142, 1.8);
        CH.fight.explode(-196, 1, -128, 1.1);
      }
      // Keep the police cars glued in their chase slots.
      const pcs = S.police.cars;
      if (pcs[0]) { pcs[0].x = -186; pcs[0].z = -112; pcs[0].mesh.position.set(-186, 0, -112); }
      if (pcs[1]) { pcs[1].x = -174; pcs[1].z = -114; pcs[1].mesh.position.set(-174, 0, -114); }
      // Keep the helicopter low and ahead in frame: its orbit would
      // otherwise drift it over the camera and out of the shot.
      if (S.police.heli) {
        S.police.heli.mesh.position.set(-168, 24, -140);
        S.police.heli.mesh.lookAt(S.player.x, 0, S.player.z);
      }
    }
    if (S.frame >= S.shotReadyAt && !window.__shotReady) {
      window.__shotReady = true;
    }
  }

  return { stage, tick };
})();
