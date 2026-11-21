// Coral Heat — boot: renderer, input, the main loop and the camera.
// The camera sits directly behind the player every frame (snapped, no
// laggy lerp) so the car never leaves the frame at low headless fps.
import * as THREE from 'three';
import { clamp } from './util.js';
import { buildCoralCity } from './coralcity.js';
import { createPlayerCar, spawnTraffic, updateTraffic, updateDriving, carTopSpeed } from './drive.js';
import { createWalker, updateOnFoot, enterNearestCar, exitCar, carjack, spawnPedestrians, updatePedestrians } from './walk.js';
import { setWanted, updateCops, updateHelicopter, updateRoadblocks } from './cops.js';
import { initWeapons, shoot, updateCombat, cycleWeapon, selectWeapon, buildWeaponWheel, refreshWeaponWheel } from './fight.js';
import { buildMarinaBoats, updateBoats, boardBoat, leaveBoat, updatePoliceBoats, createPlayerBoat } from './boats.js';
import { spawnBike, mountBike, dismountBike, updateBike, nearestBike } from './bikes.js';
import { defineCircuits, startRace, updateRace, raceStartPoints } from './raceway.js';
import { initGarage, buySafehouse, buyUpgrade, storeCurrentCar, openShop, closeShop, nearestSafehouse, UPGRADES, SAFEHOUSES } from './garage.js';
import { createMissionEngine, defineMissions, updateMissions, startNextMission } from './story.js';
import { defineMissions2 } from './story2.js';
import { buildHud, updateHud } from './hudkit.js';
import { initAudio, resumeAudio, cycleRadio, updateAudio, sfx } from './sound.js';
import { saveGame, loadGame, hasSave } from './savegame.js';
import { applyScenePreset, updateScenePreset, exposeState } from './shots.js';

const G = {
  scene: null,
  camera: null,
  renderer: null,
  keys: {},
  time: 0,
  started: false,
  paused: false,
  player: {
    mode: 'foot',
    pos: new THREE.Vector3(-200, 0, 20),
    heading: 0,
    speed: 0,
    health: 100,
    armor: 0,
    cash: 1500,
    wanted: 0,
    car: null,
    boat: null,
    bike: null,
    footMesh: null,
    weapon: null,
    firing: false,
  },
  world: null,
  traffic: [],
  peds: [],
  cops: [],
  heli: null,
  roadblocks: [],
  boats: [],
  policeBoats: [],
  bikes: [],
  tracers: [],
  explosions: [],
  wanted: 0,
  wantedTimer: 0,
  roadblockTimer: 10,
  bestLaps: {},
  stats: {},
  race: { active: false },
  preservePoliceBoats: false,
};
window.__G = G;
window.__CH_ERRORS = [];
window.addEventListener('error', (e) => window.__CH_ERRORS.push(String(e.message || e.error)));

function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  document.getElementById('game-canvas').appendChild(renderer.domElement);
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  G.camera.position.set(-200, 6, 8);
  G.scene.add(G.camera);

  buildCoralCity(G);
  createWalker(G);
  // the player's own Coral GT parked near the marina start
  const home = createPlayerCar(G, 0);
  home.pos.set(-196, 0, 30);
  home.heading = Math.PI / 2;
  home.mesh.position.copy(home.pos);
  home.mesh.rotation.y = home.heading;
  G.player.car = null; // on foot until the player gets in
  G.parkedCar = home;

  spawnTraffic(G, 16);
  spawnPedestrians(G, 26);
  buildMarinaBoats(G);
  defineCircuits(G);
  initGarage(G);
  initWeapons(G);
  createMissionEngine(G);
  defineMissions(G);
  defineMissions2(G);
  buildHud(G);
  buildWeaponWheel(G);
  initAudio(G);
  G.boatApi = { createPlayerBoat: (g, i) => createPlayerBoat(g, i) };
  G.buyUpgrade = (part) => buyUpgrade(G, part);
  G.buySafehouse = (id) => buySafehouse(G, id);
  G.shopRows = UPGRADES;
  G.houseRows = SAFEHOUSES;
  G.save = () => saveGame(G);
  G.sfx = (name) => sfx(G, name);
  G.started = false;

  if (hasSave()) {
    if (loadGame(G)) {
      G.hud.toast('Save loaded — welcome back to Coral Bay');
    }
  }
  exposeState(G);

  // staged screenshot scene? (?scene=chase|foot|marina|race)
  const sceneName = new URLSearchParams(window.location.search).get('scene');
  if (sceneName) {
    applyScenePreset(G, sceneName);
  } else {
    G.missions.start(1);
  }

  bindInput();
  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
  G.clock = new THREE.Clock();
  G.renderer.setAnimationLoop(tick);
}

function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    G.keys[e.code] = true;
    resumeAudio(G);
    if (!G.started) {
      if (e.code === 'Enter' || e.code === 'Space') startGame();
      return;
    }
    if (G.paused) {
      if (e.code === 'Escape') togglePause();
      return;
    }
    switch (e.code) {
      case 'Escape': togglePause(); break;
      case 'KeyE': onEnterExit(); break;
      case 'KeyF': {
        if (G.player.mode === 'foot' && carjack(G)) G.stats.carsStolen += 1;
        break;
      }
      case 'KeyQ': {
        const w = document.getElementById('weapon-wheel');
        if (w) w.style.display = w.style.display === 'block' ? 'none' : 'block';
        refreshWeaponWheel(G);
        break;
      }
      case 'KeyR': cycleRadio(G); break;
      case 'KeyN': startNextMission(G); break;
      case 'KeyT': {
        const starts = raceStartPoints(G);
        let best = null;
        let bestD = 40;
        for (const s of starts) {
          const d = Math.hypot(s.x - G.player.pos.x, s.z - G.player.pos.z);
          if (d < bestD) { bestD = d; best = s; }
        }
        if (best) {
          if (startRace(G, best.id)) G.stats.racesEntered = (G.stats.racesEntered || 0) + 1;
        } else if (G.hud) G.hud.toast('No race start line nearby — look for the yellow gates');
        break;
      }
      case 'KeyU': {
        if (G.garage.shopOpen) closeShop(G);
        else openShop(G);
        break;
      }
      case 'KeyG': storeCurrentCar(G); break;
      case 'KeyB': {
        if (G.player.mode === 'foot') {
          const bike = spawnBike(G, Math.floor(Math.random() * 3));
          mountBike(G, bike);
        }
        break;
      }
      case 'KeyM': {
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = mm.style.display === 'none' ? 'block' : 'none';
        break;
      }
      case 'Digit1': selectWeapon(G, 0); break;
      case 'Digit2': selectWeapon(G, 1); break;
      case 'Digit3': selectWeapon(G, 2); break;
      case 'Digit4': selectWeapon(G, 3); break;
      case 'Digit5': cycleWeapon(G, 1); break;
    }
  });
  window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    G.keys['Mouse0'] = true;
    resumeAudio(G);
    if (G.started && !G.paused) {
      shoot(G);
      G.stats.shotsFired = (G.stats.shotsFired || 0) + 1;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) G.keys['Mouse0'] = false;
  });
  document.getElementById('start-screen').addEventListener('click', () => startGame());
  document.getElementById('resume-btn')?.addEventListener('click', () => togglePause());
}

function startGame() {
  G.started = true;
  const s = document.getElementById('start-screen');
  if (s) s.style.display = 'none';
  resumeAudio(G);
  if (G.hud) G.hud.banner('CORAL HEAT', 'Welcome to Coral Bay — press N for your first job');
}

function togglePause() {
  G.paused = !G.paused;
  const p = document.getElementById('pause-screen');
  if (p) p.style.display = G.paused ? 'flex' : 'none';
}

function onEnterExit() {
  if (G.player.mode === 'foot') {
    // try the parked/player car, a traffic car, a bike, then a boat
    const parked = G.parkedCar;
    if (parked && Math.hypot(parked.pos.x - G.player.pos.x, parked.pos.z - G.player.pos.z) < 8) {
      G.player.car = parked;
      G.parkedCar = null;
      G.player.mode = 'car';
      G.player.footMesh.visible = false;
      G.stats.carsStolen += 1;
      return;
    }
    const bike = nearestBike(G, 6);
    if (bike) {
      mountBike(G, bike);
      return;
    }
    if (enterNearestCar(G)) {
      G.stats.carsStolen += 1;
      return;
    }
    if (boardBoat(G)) {
      G.stats.boatsBoarded = (G.stats.boatsBoarded || 0) + 1;
      return;
    }
    if (G.hud) G.hud.toast('Nothing to get into nearby — walk to a car, bike or boat');
  } else if (G.player.mode === 'car') {
    exitCar(G);
  } else if (G.player.mode === 'boat') {
    leaveBoat(G);
  } else if (G.player.mode === 'bike') {
    dismountBike(G);
  }
}

function snapCamera() {
  const p = G.player.pos;
  const h = G.player.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  let dist = 8;
  let height = 3.4;
  let lookAhead = 7;
  if (G.player.mode === 'car') { dist = 11.5; height = 4.4; lookAhead = 10; }
  if (G.scenePreset === 'chase') { dist = 13; }
  if (G.player.mode === 'boat') { dist = 14; height = 5.2; lookAhead = 12; }
  if (G.player.mode === 'bike') { dist = 9.5; height = 3.8; lookAhead = 9; }
  if (G.player.mode === 'foot') { dist = 6.5; height = 2.8; lookAhead = 6; }
  // directly behind the player: no lerp, the car never leaves the frame.
  // On the waterfront chase, pan the view toward the water so the boats
  // share the frame with the car instead of sitting at the far edge.
  G.camera.position.set(p.x - fx * dist, height, p.z - fz * dist);
  let lookX = p.x + fx * lookAhead;
  let lookZ = p.z + fz * lookAhead;
  if (G.scenePreset === 'chase') {
    lookX -= 8;
    lookZ += 5;
  }
  G.camera.lookAt(lookX, 3.0, lookZ);
}

function tick() {
  const dt = Math.min(G.clock.getDelta(), 0.05);
  G.time += dt;
  if (!G.started || G.paused) {
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (G.keys['Mouse0']) {
    shoot(G);
  }
  updateOnFoot(G, dt);
  updateDriving(G, dt);
  updateBike(G, dt);
  updateBoats(G, dt);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updateCops(G, dt);
  updateHelicopter(G, dt);
  updateRoadblocks(G, dt);
  updatePoliceBoats(G, dt);
  updateRace(G, dt);
  updateMissions(G, dt);
  updateCombat(G, dt);
  updateScenePreset(G, dt);
  updateAudio(G, dt);
  // stats tracking
  const mph = Math.abs(G.player.speed) * 2.23694;
  if (mph > G.stats.topSpeed) G.stats.topSpeed = mph;
  if (G.player.wanted >= 2) G.stats.hadWanted = true;
  if (G.player.mode === 'bike') {
    G.stats.distanceBiked = (G.stats.distanceBiked || 0) + Math.abs(G.player.speed) * dt;
  }
  // wanted decays handled in cops; keep the mirror in sync
  G.wanted = G.player.wanted;
  updateHud(G, dt);
  snapCamera();
  G.renderer.render(G.scene, G.camera);
}

init();
