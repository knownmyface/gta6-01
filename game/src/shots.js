// CORAL HEAT — screenshot scene staging (v2.9, fresh).
// ?scene=chase|foot|marina|race — deterministic staged shots for the dossier.
// Each scene drops the player into a live moment with the full HUD on.
import { createCar } from './drive.js';
import { startRace } from './raceway.js';

export function applyScene(G, name) {
  const p = G.player;
  G.state = 'play';
  document.getElementById('start-screen').style.display = 'none';
  if (name === 'chase') {
    // player in a red sports car driving NORTH through the city, 2 police + helicopter, wanted 3, mission live
    // start well north of the plaza so the slow headless frame rate still leaves the car in the city
    const car = createCar(G, 0, -140, 0, 0xd9302a, 'sport');
    car.isPlayer = true;
    p.mode = 'car'; p.car = car;
    p.mesh.visible = false;
    p.x = car.x; p.z = car.z;
    car.speed = 34;
    G.keys['KeyW'] = true; // auto-drive so the cover shows a real chase at speed
    G.cops.addWanted(3); // 3 stars: helicopter + police, but no roadblock in the shot
    G.story.start(4);
    // two police cars ahead, flanking the road — visible in the chase frame
    const cop1 = createCar(G, -9, -180, 0, 0x111111, 'police');
    cop1.isPolice = true; G.copsList.push(cop1);
    const cop2 = createCar(G, 9, -190, 0, 0x111111, 'police');
    cop2.isPolice = true; G.copsList.push(cop2);
    G.camMode = 'chase';
  } else if (name === 'foot') {
    // on foot beside a sports car, mid-carjack: traffic car stopped, driver bailing
    p.mode = 'foot';
    p.x = 6; p.z = 34; p.heading = Math.PI * 0.75;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    const car = createCar(G, 0, 30, Math.PI, 0xff7a1a, 'sport');
    car.isTraffic = true;
    car.speed = 0;
    G.cops.addWanted(1);
    G.story.start(2);
    G.hud.setPrompt('Hold F — carjack this car');
    G.camMode = 'foot';
  } else if (name === 'marina') {
    // on a boat in the marina, moored boats + ferris wheel behind
    const boat = G.boats[0];
    p.mode = 'boat'; p.boat = boat;
    boat.ridden = true;
    boat.speed = 14;
    boat.x = 318; boat.z = -150; // start north of the piers, sail south past them
    boat.heading = Math.PI; // sail south along the marina, piers ahead in frame
    G.keys['KeyW'] = true;
    p.x = boat.x; p.z = boat.z;
    p.mesh.visible = false;
    G.story.start(6);
    G.camMode = 'boat';
  } else if (name === 'race') {
    // race grid: player + 3 rivals, countdown running, race HUD visible
    const car = createCar(G, 0, 30, Math.PI, 0xd9302a, 'sport');
    car.isPlayer = true;
    p.mode = 'car'; p.car = car;
    p.mesh.visible = false;
    p.x = car.x; p.z = car.z;
    startRace(G, 0);
    G.keys['KeyW'] = true; // auto-drive once the countdown hits GO
    G.camMode = 'race';
  }
  G.hud.setCash(p.cash);
  G.hud.setWanted(G.cops.wanted);
  G.hud.setHealth(p.health);
}
