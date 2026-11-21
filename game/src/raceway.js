// CORAL HEAT — street races. Five circuits drawn on the road grid, each a
// loop of gates the player and three AI racers run for three laps. The HUD
// shows lap and live position; winning pays out and counts toward the race
// missions. Races are started from the mission menu or by driving into a
// circuit's start gate.
CH.raceway = (function () {
  const U = CH.util;
  const CIRCUITS = [
    { name: 'Marina Loop', gates: [[0, 240], [180, 240], [180, 60], [0, 60]] },
    { name: 'Casino Sprint', gates: [[-180, -60], [-60, -60], [-60, -180], [-180, -180]] },
    { name: 'Bayfront Mile', gates: [[-240, 240], [240, 240], [240, 120], [-240, 120]] },
    { name: 'Downtown Grid', gates: [[-60, 0], [120, 0], [120, 180], [-60, 180]] },
    { name: 'Sunset Grand Tour', gates: [[-240, -240], [240, -240], [240, 240], [-240, 240]] },
  ];
  let gateMeshes = [];

  function build(scene) {
    // Gate markers are created per race; this only keeps the start pads.
    for (const c of CIRCUITS) {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(c.gates[0][0], 0.06, c.gates[0][1]);
      scene.add(pad);
    }
  }

  function startRace(idx, scene) {
    const S = CH.S;
    const c = CIRCUITS[idx % CIRCUITS.length];
    clearGates(scene);
    S.race.active = true;
    S.race.circuit = idx % CIRCUITS.length;
    S.race.lap = 1; S.race.laps = 3; S.race.gate = 0; S.race.pos = 4; S.race.finished = false;
    S.race.racers = [];
    // Three AI racers on the grid behind the player.
    for (let i = 0; i < 3; i++) {
      const spec = CH.drive.CAR_TYPES[(idx + i + 1) % CH.drive.CAR_TYPES.length];
      const g0 = c.gates[0], g1 = c.gates[1];
      const back = 8 + i * 7;
      const dirx = g1[0] - g0[0], dirz = g1[1] - g0[1];
      const len = Math.hypot(dirx, dirz) || 1;
      const rx = g0[0] - (dirx / len) * back + (i % 2 ? 3 : -3);
      const rz = g0[1] - (dirz / len) * back;
      const car = CH.drive.newCar(rx, rz, Math.atan2(dirx, dirz), spec);
      car.raceGate = 0; car.raceLap = 1;
      scene.add(car.mesh);
      S.race.racers.push(car);
      S.traffic.cars.push(car);
    }
    // Gate rings: floating amber chevrons the player drives through. Each
    // ring faces the driver: its plane is perpendicular to the leg that
    // arrives at it, so it reads as a circle from the racing line.
    for (let i = 0; i < c.gates.length; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.5, 0.35, 8, 20),
        new THREE.MeshBasicMaterial({ color: 0xffb020 })
      );
      const prev = c.gates[(i + c.gates.length - 1) % c.gates.length];
      const dx = c.gates[i][0] - prev[0], dz = c.gates[i][1] - prev[1];
      ring.rotation.y = Math.atan2(dx, dz);
      ring.position.set(c.gates[i][0], 2.4, c.gates[i][1]);
      scene.add(ring);
      gateMeshes.push(ring);
    }
    CH.hud.banner('RACE: ' + c.name.toUpperCase() + ' — 3 LAPS');
    CH.hud.toast('RACE START — ' + c.name.toUpperCase());
    CH.sound.radioJingle();
  }

  function clearGates(scene) {
    for (const m of gateMeshes) scene.remove(m);
    gateMeshes = [];
    for (const r of CH.S.race.racers) {
      const i = CH.S.traffic.cars.indexOf(r);
      if (i >= 0) CH.S.traffic.cars.splice(i, 1);
      scene.remove(r.mesh);
    }
    CH.S.race.racers = [];
  }

  function gatePos() {
    const c = CIRCUITS[CH.S.race.circuit];
    return c.gates[CH.S.race.gate % c.gates.length];
  }

  function update(dt) {
    const S = CH.S;
    if (!S.race.active || S.race.finished) return;
    const p = S.player;
    const gp = gatePos();
    // Player through the gate?
    if (p.inCar && U.dist2(p.x, p.z, gp[0], gp[1]) < 7) {
      S.race.gate++;
      CH.sound.pickup();
      if (S.race.gate % CIRCUITS[S.race.circuit].gates.length === 0) {
        S.race.lap++;
        if (S.race.lap > S.race.laps) { finishRace(true); return; }
        CH.hud.toast('LAP ' + S.race.lap + ' / ' + S.race.laps);
      }
    }
    // AI racers chase the same gates, a touch slower than a good player.
    for (const r of S.race.racers) {
      const g = CIRCUITS[S.race.circuit].gates[r.raceGate % CIRCUITS[S.race.circuit].gates.length];
      const d = U.dist2(r.x, r.z, g[0], g[1]);
      const want = Math.atan2(g[0] - r.x, g[1] - r.z);
      const steer = U.clamp(U.angDiff(r.heading, want), -1, 1);
      CH.drive.stepCar(r, dt, d > 6, steer, false);
      if (d < 7) {
        r.raceGate++;
        if (r.raceGate % CIRCUITS[S.race.circuit].gates.length === 0) r.raceLap++;
      }
    }
    // Live position: laps, then gates, then distance to the next gate.
    const score = (who) => {
      const lap = who === p ? S.race.lap : who.raceLap;
      const gate = who === p ? S.race.gate : who.raceGate;
      const g = CIRCUITS[S.race.circuit].gates[gate % CIRCUITS[S.race.circuit].gates.length];
      const d = U.dist2(who.x, who.z, g[0], g[1]);
      return lap * 10000 + gate * 100 - d;
    };
    const all = [p, ...S.race.racers].slice().sort((a, b) => score(b) - score(a));
    S.race.pos = all.indexOf(p) + 1;
  }

  function finishRace(won) {
    const S = CH.S;
    S.race.finished = true;
    S.race.active = false;
    const pos = S.race.pos;
    if (pos === 1) {
      S.stats.racesWon++;
      const prize = 2500;
      S.player.cash += prize;
      CH.hud.banner('RACE WON — ' + U.fmtCash(prize));
      CH.sound.missionDone();
    } else {
      CH.hud.banner('RACE OVER — P' + pos + ' OF 4');
    }
    CH.savegame.autosave();
    setTimeout(() => clearGates(S.scene), 1500);
  }

  return { CIRCUITS, build, startRace, clearGates, gatePos, update, finishRace };
})();
