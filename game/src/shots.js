// Coral Heat — screenshot scene presets (?scene=chase|foot|marina|race).
// Each preset stages a verified game state for the entry's screenshots,
// and a per-frame hook keeps the staged action alive (auto-drive at the
// target speed, explosion glow refreshed, showcase boats in frame).
// Also exposes window.__CH.state() for the screenshot tooling.
import { MARINA_X } from './coralcity.js';
import { createPlayerCar, makeVehicleMesh } from './drive.js';
import { createPlayerBoat, spawnPoliceBoat } from './boats.js';
import { spawnCop, spawnHelicopter, deployRoadblock, setWanted } from './cops.js';
import { spawnExplosion } from './fight.js';
import { startRace } from './raceway.js';
import { fmtMph } from './util.js';

export function activateMission(G, id) {
  const m = G.missions.list.find((x) => x.id === id);
  if (!m) return null;
  if (G.missions.active) G.missions.active.state = 'available';
  m.state = 'active';
  m.startedAt = G.time;
  G.missions.active = m;
  if (G.hud) {
    G.hud.banner('MISSION ' + m.id, m.name.toUpperCase());
    G.hud.setObjective('Mission ' + m.id + ': ' + m.name + ' — ' + m.desc);
  }
  return m;
}

export function applyScenePreset(G, name) {
  G.scenePreset = name;
  G.started = true; // skip the start screen for staged scenes
  const hideStart = document.getElementById('start-screen');
  if (hideStart) hideStart.style.display = 'none';

  if (name === 'chase') {
    // WATERFRONT CHASE — the cover: sports car on Marina Row at ~125 MPH,
    // 5 stars, police + helicopter + searchlight, explosion glow, boats.
    G.player.cash = 48250;
    const car = createPlayerCar(G, 0);
    car.pos.set(MARINA_X, 0, -60);
    car.heading = 0;
    car.speed = 56;
    G.player.mode = 'car';
    G.player.pos.copy(car.pos);
    G.player.heading = 0;
    G.player.speed = 56;
    setWanted(G, 5, 'casino heist escape');
    spawnHelicopter(G);
    // pin the orbit so the heli sits ahead over the water at shot time
    if (G.heli) G.heli.angle = -1.3;
    // four cruisers in a box around the player
    const spots = [[-214, -34], [-230, -80], [-206, -20], [-218, -100]];
    for (const [x, z] of spots) {
      const c = spawnCop(G, false);
      c.pos.set(x, 0, z);
      c.heading = 0;
      c.speed = 48;
    }
    deployRoadblock(G);
    // showcase boats: pin the underway speedboats close inshore, in frame
    const runner = G.boats.find((b) => !b.moored);
    if (runner) {
      runner.pos.set(-284, 0.35, 10);
      runner.heading = 0;
      runner.speed = 16;
      runner.patrol = null;
      runner.showcase = true;
    }
    const runner2 = G.boats.find((b) => !b.moored && b !== runner);
    if (runner2) {
      runner2.pos.set(-296, 0.35, 48);
      runner2.heading = 0;
      runner2.speed = 14;
      runner2.patrol = null;
      runner2.showcase = true;
    }
    // two police boats in the water so the pursuit reads from the road
    const pb1 = spawnPoliceBoat(G);
    pb1.pos.set(-286, 0.35, -6);
    pb1.heading = 0;
    const pb2 = spawnPoliceBoat(G);
    pb2.pos.set(-292, 0.35, 52);
    pb2.heading = 0;
    G.preservePoliceBoats = true;
    // traffic ahead on Marina Row so the road reads busy, not empty
    for (const [tz, color] of [[60, 0xff8a1e], [100, 0x2e6fd9], [150, 0xe8c832]]) {
      const mesh = makeVehicleMesh(color, 'car');
      mesh.position.set(MARINA_X + 3.5, 0, tz);
      mesh.rotation.y = 0;
      G.scene.add(mesh);
      G.traffic.push({
        mesh, pos: mesh.position, heading: 0, speed: 12,
        lane: MARINA_X + 3.5, vertical: true, pause: 0,
      });
    }
    activateMission(G, 22);
    G.chaseFxTimer = 0;
    spawnExplosion(G, { x: MARINA_X + 14, z: -38 }, 1.8);
  } else if (name === 'foot') {
    // ON FOOT — carjacking moment, mission 2, 2 stars.
    G.player.cash = 1240;
    G.player.pos.set(-60, 0, 14);
    G.player.heading = Math.PI / 2;
    G.player.footMesh.position.copy(G.player.pos);
    G.player.mode = 'foot';
    setWanted(G, 2, 'stolen car reported');
    const near = G.traffic[0];
    if (near) {
      near.pos.set(-56, 0, 22);
      near.heading = Math.PI / 2;
      near.speed = 0;
      near.pause = 999;
    }
    activateMission(G, 2);
  } else if (name === 'marina') {
    // BOAT GETAWAY — speedboat at ~64 MPH, 4 stars, police boats, mission 21.
    G.player.cash = 31200;
    const boat = createPlayerBoat(G, 0);
    boat.pos.set(-312, 0.35, -20);
    boat.heading = 0;
    boat.speed = 28.6;
    G.player.pos.copy(boat.pos);
    G.player.heading = 0;
    G.player.speed = 28.6;
    setWanted(G, 4, 'harbor escape');
    spawnHelicopter(G);
    activateMission(G, 21);
    G.missionTimer = 0;
  } else if (name === 'race') {
    // STREET RACE — Coral Grand Tour, car at ~74 MPH, race live, mission 16.
    G.player.cash = 18600;
    const car = createPlayerCar(G, 0);
    car.pos.set(-222, 0, -240);
    car.heading = Math.PI / 2;
    car.speed = 10;
    G.player.mode = 'car';
    G.player.pos.copy(car.pos);
    G.player.heading = Math.PI / 2;
    activateMission(G, 16);
    const m16 = G.missions.active;
    if (m16 && m16.onStart) m16.onStart(G);
    else startRace(G, 'grand');
    if (G.race) G.race.countdown = 0; // go immediately for the shot
    // stage it mid-race: player 40 units from the next gate, rivals
    // clustered just behind, so the gate + the pack are both in frame
    if (G.race.active && G.player.car) {
      const car = G.player.car;
      car.pos.set(180, 0, -240);
      car.heading = Math.PI / 2;
      car.speed = 33;
      G.player.pos.copy(car.pos);
      G.player.heading = Math.PI / 2;
      G.race.gate = 1;
      G.race.time = 25;
      G.race.lapStart = 0;
      G.race.bestLap = 32.4;
      const spots = [[170, -244], [155, -236], [140, -244]];
      G.race.rivals.forEach((rv, i) => {
        rv.pos.set(spots[i][0], 0, spots[i][1]);
        rv.heading = Math.PI / 2;
        rv.gate = 1;
        rv.lap = 1;
        rv.speed = 30;
      });
      if (G.hud) G.hud.setObjective('Race: Coral Grand Tour — Lap 1/2 · Gate 2/5');
    }
    setWanted(G, 0);
  }
  if (G.hud) {
    G.hud.setStars(G.player.wanted);
    // staged scenes: kill the big centre banner + toast so they never
    // cover the frame at screenshot time (the mission panel still shows it)
    G.hud.bannerTimer = 0;
    G.hud.el.classList.remove('show-banner');
    G.hud.toastTimer = 0;
    G.hud.toastEl.style.opacity = '0';
  }
}

export function updateScenePreset(G, dt) {
  const name = G.scenePreset;
  if (!name) return;
  if (name === 'chase') {
    const car = G.player.car;
    if (car) {
      car.speed = 56; // hold ~125 MPH through the frame
      car.heading = 0; // straight up Marina Row
      G.player.speed = 56;
    }
    // refresh the explosion glow so it is lit at screenshot time:
    // close ahead on the water side, refreshed often (game time runs
    // slower than real time under swiftshader)
    G.chaseFxTimer = (G.chaseFxTimer || 0) - dt;
    if (G.chaseFxTimer <= 0) {
      G.chaseFxTimer = 0.8;
      const fx = Math.sin(G.player.heading);
      const fz = Math.cos(G.player.heading);
      spawnExplosion(G, {
        x: G.player.pos.x + fx * 18 + 14,
        z: G.player.pos.z + fz * 18,
      }, 2.0);
    }
    // keep the showcase speedboats cruising beside the road, pinned
    // relative to the player so they are always in the cover frame
    for (const b of G.boats) {
      if (b.showcase) {
        const ahead = b === G.boats.find((x) => x.showcase) ? 55 : 85;
        b.pos.x = G.player.pos.x - 48;
        b.pos.z = G.player.pos.z + ahead;
        b.mesh.position.set(b.pos.x, 0.35 + Math.sin(G.time * 1.6) * 0.12, b.pos.z);
        b.mesh.rotation.y = 0;
        b.mesh.userData.wake.visible = true;
      }
    }
  } else if (name === 'race') {
    const car = G.player.car;
    if (car && G.race.active) {
      car.speed = 33; // hold ~74 MPH
      car.heading = Math.PI / 2; // straight east along the tour's first leg
      G.player.speed = 33;
    }
  } else if (name === 'marina') {
    const boat = G.player.boat;
    if (boat) {
      boat.speed = 28.6; // hold ~64 MPH
      boat.heading = 0;
      G.player.speed = 28.6;
    }
  }
}

export function exposeState(G) {
  window.__CH = {
    state() {
      return {
        scene: G.scenePreset || 'free',
        mode: G.player.mode,
        wanted: G.player.wanted,
        speedMph: fmtMph(Math.abs(G.player.speed)),
        mission: G.missions.active ? G.missions.active.id + ' ' + G.missions.active.name : 'none',
        cops: G.cops.length,
        heli: !!G.heli,
        boats: G.boats.length,
        policeBoats: G.policeBoats.length,
        race: G.race.active ? G.race.circuit.name + ' lap ' + G.race.lap + ' P' + G.race.position : 'none',
        cash: Math.round(G.player.cash),
        errors: (window.__CH_ERRORS || []).length,
      };
    },
  };
}
