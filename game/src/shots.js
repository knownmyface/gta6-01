// Coral Heat — screenshot staging: real renders of the game, staged per scene
// via ?scene=chase|foot|marina|race. The game runs live; staging only places
// the player, spawns police, sets wanted level and starts the mission text.
// Fresh write, round 7.
import { CIRCUITS } from './raceway.js';

export function stageScene(G, scene) {
  const q = new URLSearchParams(location.search);
  const name = scene || q.get('scene') || 'chase';
  // Keep the staged corridor clear of traffic + pedestrians so the chase/race
  // camera never sits inside a traffic car or behind a walker.
  function clearCorridor(cx, hw, z0, z1) {
    for (const c of [...G.traffic.cars]) {
      const cxp = c.axis === 'x' ? c.along : c.lane;
      const czp = c.axis === 'x' ? c.lane : c.along;
      if (Math.abs(cxp - cx) < hw && czp > z0 && czp < z1) G.traffic.remove(c);
    }
    for (const p of G.peds.list) {
      if (Math.abs(p.x - cx) < hw && p.z > z0 && p.z < z1) { p.x += 36; p.targetX = p.x + 20; p.targetZ = p.z; }
    }
  }
  G.started = true;
  G.hud.els.startScreen.style.display = 'none';
  G.sound.ensure();
  const P = G.player;
  const car = G.playerCar;
  // common: sunset time, healthy player
  G.timeOfDay = 18 * 3600 + 42 * 60;
  P.health = 100;

  if (name === 'chase') {
    // COVER: 5-star chase on Casino Row, neon district behind, roadblock ahead,
    // explosion glow, helicopter searchlight, speed ~132 MPH.
    P.cash = 42755;
    car.reset(104, -6, Math.PI);            // facing north (-z) up Casino Row (x=104 road)
    car.speed = 59;                          // ~132 MPH
    car.nitro = 82;
    car.damage = 18;
    G.setInCar(true);
    clearCorridor(104, 14, -220, 40);
    G.police.setWanted(5, G);
    G.police.heat = 100;
    // police cars: flank + tail + two head-on so they read in frame
    const c1 = G.police.spawnCar(110, -40); c1.heading = Math.PI; c1.speed = 55;
    const c2 = G.police.spawnCar(104, 30); c2.heading = Math.PI; c2.speed = 57;
    const c3 = G.police.spawnCar(104, -150); c3.heading = 0; c3.speed = 45;
    const c4 = G.police.spawnCar(98, -110); c4.heading = 0; c4.speed = 48;
    void c1; void c2; void c3; void c4;
    G.police.spawnHeli();
    // roadblock with spike strip ahead on the road
    G.police.deployRoadblock(104, -6, Math.PI);
    // explosion glow ahead-right and ahead-left, mid-frame
    G.particles.spawnExplosion(126, 1, -42, 1.8);
    G.particles.spawnExplosion(86, 1, -70, 1.2);
    // heist mission live on the HUD
    G.missions.index = 12;                  // part 1 done
    G.missions2.index = 7;                  // mission 20: escape by boat
    G.missions2.active = { def: G.missions2.defs[7], startedAt: G.time };
    G.missions2.makeBeacon(0, 265, 0xff2fd6);
    G.hud.banner('CASINO HEIST — ESCAPE', '5 STARS • GET TO THE MARINA BOAT • DO NOT GET CAUGHT');
    G.hud.toast('ROADBLOCK AHEAD — SPIKE STRIPS DEPLOYED', '#ff8844');
    G.stageHold = { forward: true };
    G.camMode = 'chase';
  } else if (name === 'foot') {
    // ON FOOT: Maya mid-carjack next to a stopped car, cop closing in.
    P.cash = 13420;
    G.setInCar(false);
    G.walker.place(52, 58, Math.PI * 0.75);
    G.police.setWanted(2, G);
    const c1 = G.police.spawnCar(46, 34); c1.heading = Math.PI; c1.speed = 20;
    void c1;
    // a traffic car stopped beside her (the carjack target)
    const near = G.traffic.nearest(52, 58, 30);
    if (near) { near.along = 58; near.lane = 52; near.speed = 0; near.axis = 'z'; near.dir = 1; }
    G.missions.index = 4;                   // mission 5: carjack
    G.missions.active = { def: G.missions.defs[4], startedAt: G.time, collected: 0 };
    G.missions.makeBeacon(52, 52);
    G.combat.select(1);                     // pistol in hand
    G.hud.banner('MISSION 5 — CARJACK 101', 'Drex: Take that car. Press F next to the driver.');
    G.camMode = 'foot';
  } else if (name === 'marina') {
    // MARINA: Maya in a speedboat at the docks, sunset, city skyline behind.
    P.cash = 25100;
    const boat = G.boats.list[2];
    G.setInCar(false);
    G.walker.place(-4, 208, 0);
    G.boats.board(boat);
    boat.x = -12; boat.z = 252; boat.heading = Math.PI; boat.speed = 12;
    G.police.setWanted(0, G);
    G.missions.index = 6;                   // mission 7: boat people
    G.missions.active = { def: G.missions.defs[6], startedAt: G.time, collected: 0 };
    G.missions.makeBeacon(104, 265);
    G.hud.banner('MISSION 7 — BOAT PEOPLE', 'Tomas: Take the boat out — reach the far buoy.');
    G.stageHold = { forward: true };
    G.camMode = 'boat';
  } else if (name === 'race') {
    // RACE: Casino Loop mid-race, rivals in frame, gate ahead, P2.
    P.cash = 18900;
    car.reset(104, -80, Math.PI);
    car.speed = 48;                          // ~107 MPH
    car.nitro = 64;
    G.setInCar(true);
    clearCorridor(104, 14, -220, -20);
    G.police.setWanted(0, G);
    const circuit = CIRCUITS.find((c) => c.name === 'Casino Loop');
    G.raceway.startRace(circuit, G);
    const r = G.raceway.active;
    r.state = 'racing';
    r.raceStart = G.time - 42;
    r.lapStart = G.time - 18;
    r.totalTime = 42;
    r.lap = 2;
    r.gateIndex = 2;
    r.position = 2;
    // move rivals near the player so they read in frame, ahead of the car
    G.raceway.rivals.forEach((rv, i) => {
      rv.x = 98 + i * 7; rv.z = -98 - i * 6; rv.heading = Math.PI; rv.speed = 46 - i * 2;
      rv.gateIndex = 2; rv.lap = 2;
    });
    G.missions.index = 12;
    G.missions2.index = 5;                  // mission 18: getaway driver
    G.missions2.active = { def: G.missions2.defs[5], startedAt: G.time };
    G.hud.banner('RACE — CASINO LOOP', 'LAP 2/2 • P2/4 • WIN IT FOR THE GETAWAY');
    G.stageHold = { forward: true };
    G.camMode = 'chase';
  }
  G.stagedScene = name;
  G.hud.update(G, 0);
}

// Summary for the screenshot driver / debugging.
export function stateSummary(G) {
  return {
    scene: G.stagedScene || null,
    state: G.started ? 'playing' : 'menu',
    wanted: G.police.wanted,
    cash: Math.floor(G.player.cash),
    mission: (G.missions.active || G.missions2.active)?.def?.title || null,
    speedMph: G.inCar ? Math.round(G.playerCar.mph) : (G.boats.active ? Math.round(Math.abs(G.boats.active.speed) * 2.237) : 0),
    cars: G.traffic.cars.length,
    cops: G.police.cars.length,
    heli: !!G.police.heli,
    roadblocks: G.police.roadblocks.length,
    race: G.raceway.active ? G.raceway.active.circuit.name : null,
  };
}
