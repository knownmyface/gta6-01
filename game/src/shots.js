// shots.js — screenshot staging: ?shot=chase|foot|marina|race sets up a dense,
// legible frame of the live game (no fake renders — the same code the player runs).
import { spawnPolice } from './cops.js';
import { spawnCar, CAR_MODELS } from './drive.js';
import { startRace, CIRCUITS } from './raceway.js';
import { spawnThugs } from './fight.js';

export function stageShot(G, name) {
  const p = G.player;
  if (name === 'chase') {
    // cover: sports car at speed on a clear road, 3-star heat, 2 cruisers + heli
    // cover: chase down the beachfront road — ocean + sunset on the left,
    // cruisers staged ahead in the road so the chase reads in frame
    const car = spawnCar(G, CAR_MODELS[0], 60, 304, -Math.PI / 2, {});
    car.speed = 24;
    G.player.vehicle = car; G.player.onFoot = false; p.mesh.group.visible = false;
    p.pos.set(car.x, 1.2, car.z); p.heading = car.heading;
    G.wanted.level = 3; G.wanted.heat = 100;
    const hold1 = spawnPolice(G, 35, 300); hold1.hold = true; hold1.heading = Math.PI / 2;
    const hold2 = spawnPolice(G, 22, 309); hold2.hold = true; hold2.heading = Math.PI / 2;
    hold1.group.rotation.y = hold1.heading; hold2.group.rotation.y = hold2.heading;
    p.cash = 18450; p.health = 82;
    G.hud.setObjective('MISSION 8 — The Big Score', 'Clear the plaza crew, then grab the cash.');
    G.camDist = 11; G.camPitch = 0.25; G.camYawOffset = 0.15;
  } else if (name === 'foot') {
    // on foot beside a car mid-carjack, thugs nearby, plaza in frame
    p.pos.set(10, 1.2, 10); p.heading = Math.PI * 0.75;
    p.mesh.group.visible = true; p.mesh.group.position.set(10, 0, 10);
    const car = spawnCar(G, CAR_MODELS[2], 14, 14, Math.PI * 0.8, { parked: true });
    spawnThugs(G, 3, 24, 24);
    p.cash = 9420; p.health = 100;
    G.wanted.level = 1; G.wanted.heat = 100;
    G.arsenal.give('shotgun');
    G.hud.setObjective('MISSION 4 — Payback at the Docks', 'Take the thugs down — click to shoot.');
    G.camDist = 11;
  } else if (name === 'marina') {
    // aboard a boat in the marina, moored boats + piers behind, 2-star heat
    const boat = G.boats[0];
    if (boat) {
      boat.x = 150; boat.z = 170; boat.heading = 0; boat.speed = 12;
      G.player.boat = boat; G.player.onFoot = false; p.mesh.group.visible = false;
      p.pos.set(boat.x, 1.2, boat.z); p.heading = boat.heading;
    }
    p.cash = 25000; p.health = 95;
    G.wanted.level = 2; G.wanted.heat = 100;
    G.hud.setObjective('MISSION 6 — Harbor Run', 'Hit all 5 buoys around the marina.');
    G.camDist = 16;
  } else if (name === 'race') {
    // race-start grid: player + 3 rivals, countdown, race HUD live
    const car = spawnCar(G, CAR_MODELS[0], -152, -12, Math.PI, {});
    G.player.vehicle = car; G.player.onFoot = false; p.mesh.group.visible = false;
    p.pos.set(car.x, 1.2, car.z); p.heading = car.heading;
    p.cash = 11200;
    startRace(G, CIRCUITS[0]);
    G.hud.setObjective('MISSION 9 — Rookie Racer', 'Sunset Loop — 3 laps, beat 3 rivals for $1,500.');
    G.camDist = 14;
  }
  G.started = true;
  G.hud.start.classList.add('hidden');
}
