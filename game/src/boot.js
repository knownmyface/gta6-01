// CORAL HEAT — boot: renderer, input, camera, main loop (v2.9, fresh).
// Entry module: builds the world, wires every system, exposes window.__CH.
import * as THREE from 'three';
import { clamp, angDiff, rand, pick } from './util.js';
import { buildCoralCity } from './coralcity.js';
import { createCar, stepCar, spawnTraffic, updateTraffic } from './drive.js';
import { setupWalker, updateWalker, enterVehicle, exitVehicle, nearestRideable } from './walk.js';
import { setupCops, updateCops } from './cops.js';
import { setupFight, spawnPedestrians, updatePedestrians, shoot, WEAPONS } from './fight.js';
import { setupBoats, stepBoat } from './boats.js';
import { setupBikes, stepBike } from './bikes.js';
import { setupRaces, updateRace } from './raceway.js';
import { setupGarage, nearSafehouse } from './garage.js';
import { setupStory, updateStory } from './story.js';
import { setupStory2, updateStory2Steps } from './story2.js';
import { setupHud } from './hudkit.js';
import { setupAudio } from './sound.js';
import { setupSave } from './savegame.js';
import { applyScene } from './shots.js';

const G = {
  scene: null, camera: null, renderer: null,
  keys: {}, state: 'menu', paused: false, time: 0,
  camYaw: Math.PI, camMode: 'chase',
  cars: [], peds: [], copsList: [],
  player: {
    mode: 'foot', x: 0, z: 30, heading: Math.PI, speed: 0,
    health: 100, cash: 1250, wanted: 0, weapon: 0,
    weapons: WEAPONS.map((w) => ({ id: w.id, name: w.name, ammo: w.ammo })),
    upgrades: { engine: 0, tires: 0, armor: 0, nitro: 0 },
    car: null, bike: null, boat: null, mesh: null,
  },
  mission: null, missionDone: [], race: null, bestLaps: {},
  lastRaceWin: false, lastRaceLose: false, wanted: 0,
};
window.__CH = G;

function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('game-root').appendChild(renderer.domElement);
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  G.camera.position.set(0, 8, 50);
  G.lastTick = performance.now();

  G.city = buildCoralCity(G);
  setupWalker(G);
  setupCops(G);
  setupFight(G);
  setupBoats(G);
  setupBikes(G);
  setupRaces(G);
  setupGarage(G);
  setupStory(G);
  setupStory2(G);
  setupHud(G);
  setupAudio(G);
  setupSave(G);

  // starter sports car parked by the spawn, plus stealable parked cars
  const starter = createCar(G, 0, 22, Math.PI, 0xd9302a, 'sport');
  starter.isPlayer = false;
  spawnTraffic(G, 10);
  spawnPedestrians(G, 14);
  for (let i = 0; i < 6; i++) {
    const node = pick(G.city.intersections);
    createCar(G, node.x + rand(-6, 6), node.z + rand(-6, 6), rand(0, Math.PI * 2), pick([0x2a6bd9, 0xf2b705, 0x22a06b, 0xe8e8e8, 0xff7a1a]), pick(['sedan', 'sport', 'taxi']));
  }

  G.loadGame();
  G.hud.setCash(G.player.cash);
  G.hud.setWanted(0);
  G.hud.setHealth(G.player.health);
  G.hud.setMission(null, 0);
  G.hud.setWeapons(G.player.weapons, G.player.weapon);
  G.hud.setRadio('Sunset FM 98.5 — chill synthwave');

  bindInput();
  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // screenshot staging (?scene=chase|foot|marina|race)
  const sceneName = new URLSearchParams(location.search).get('scene');
  if (sceneName) {
    setTimeout(() => applyScene(G, sceneName), 300);
  }
  G.renderer.setAnimationLoop(tick);
}

function bindInput() {
  const k = G.keys;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    k[e.code] = true;
    if (G.state !== 'play') return;
    if (e.code === 'KeyE') {
      if (G.player.mode === 'foot') {
        const near = nearestRideable(G, 4.5);
        if (near && !(near.kind === 'car' && near.obj.isTraffic)) enterVehicle(G, near);
      } else {
        exitVehicle(G);
      }
    }
    if (e.code === 'KeyG') G.hud.toggleGarage();
    if (e.code === 'KeyM') G.hud.toggleMissions();
    if (e.code === 'KeyT') G.hud.toggleRaceMenu();
    if (e.code === 'KeyR') { G.audio.ensure(); G.audio.cycleStation(); }
    if (e.code === 'Digit1') G.player.weapon = 0;
    if (e.code === 'Digit2') G.player.weapon = 1;
    if (e.code === 'Digit3') G.player.weapon = 2;
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { k[e.code] = false; });
  G.renderer.domElement.addEventListener('mousedown', (e) => {
    if (G.state !== 'play' || G.paused) return;
    if (e.button === 0) shoot(G);
  });
  document.getElementById('start-btn').addEventListener('click', () => {
    G.audio.ensure();
    G.audio.resume();
    G.state = 'play';
    document.getElementById('start-screen').style.display = 'none';
    G.hud.banner('CORAL HEAT', '16 story missions • street races • garage & bikes • 5-star police');
    G.hud.toast('WASD move/drive • E enter car • F carjack • G garage • M missions • T races • R radio');
  });
  document.getElementById('resume-btn').addEventListener('click', () => togglePause());
  document.getElementById('restart-btn').addEventListener('click', () => {
    G.clearSave();
    location.reload();
  });
}

function togglePause() {
  if (G.state !== 'play') return;
  G.paused = !G.paused;
  document.getElementById('pause-screen').style.display = G.paused ? 'flex' : 'none';
}

function playerInput(dt) {
  const p = G.player;
  const k = G.keys;
  let throttle = (k['KeyW'] ? 1 : 0) + (k['KeyS'] ? -1 : 0);
  const steer = (k['KeyA'] ? 1 : 0) + (k['KeyD'] ? -1 : 0);
  // hold the grid during the race countdown
  if (G.race && G.race.phase === 'countdown') throttle = 0;
  const brake = !!k['Space'];
  const nitro = !!k['ShiftLeft'] && (p.upgrades.nitro || 0) > 0;
  if (p.mode === 'car' && p.car) {
    stepCar(G, p.car, { throttle, steer, brake, nitro }, dt);
    p.x = p.car.x; p.z = p.car.z; p.heading = p.car.heading; p.speed = p.car.speed;
    if (nitro && Math.abs(p.car.speed) > 5) G.audio.setEngine(p.car.speed, p.car.top);
  } else if (p.mode === 'bike' && p.bike) {
    stepBike(G, p.bike, { throttle, steer, brake, wheelie: !!k['Space'] }, dt);
    p.x = p.bike.x; p.z = p.bike.z; p.heading = p.bike.heading; p.speed = p.bike.speed;
  } else if (p.mode === 'boat' && p.boat) {
    stepBoat(G, p.boat, { throttle, steer, brake: false }, dt);
    p.x = p.boat.x; p.z = p.boat.z; p.heading = p.boat.heading; p.speed = p.boat.speed;
  } else {
    updateWalker(G, dt);
    p.speed = 0;
  }
}

function updateCamera(dt) {
  const p = G.player;
  const targetHeading = p.heading;
  G.camYaw += angDiff(G.camYaw, targetHeading) * Math.min(1, dt * 2.6);
  const dist = p.mode === 'foot' ? 8.5 : p.mode === 'boat' ? 17 : 13.5;
  const height = p.mode === 'foot' ? 3.6 : p.mode === 'boat' ? 7 : 5.2;
  const bx = p.x + Math.sin(G.camYaw) * dist;
  const bz = p.z + Math.cos(G.camYaw) * dist;
  const want = new THREE.Vector3(bx, height, bz);
  G.camera.position.lerp(want, Math.min(1, dt * 5));
  const look = new THREE.Vector3(
    p.x - Math.sin(G.camYaw) * 7,
    p.mode === 'foot' ? 1.4 : 1.8,
    p.z - Math.cos(G.camYaw) * 7
  );
  G.camera.lookAt(look);
}

function tick() {
  const now = performance.now();
  const dt = Math.min((now - G.lastTick) / 1000, 0.05);
  G.lastTick = now;
  G.time += dt;
  if (G.state === 'play' && !G.paused) {
    playerInput(dt);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updateCops(G, dt);
    if (G.mission) {
      if (!updateStory2Steps(G, dt)) updateStory(G, dt);
    }
    updateRace(G, dt);
    // ferris wheel slowly turns
    if (G.city.ferris) G.city.ferris.userData.spin.rotation.z += dt * 0.25;
    // wanted + health regen on foot
    G.wanted = G.cops.wanted;
    if (G.player.mode === 'foot' && G.player.health < 100) G.player.health = Math.min(100, G.player.health + dt * 2);
    if (G.shootCooldown > 0) G.shootCooldown -= dt;
    // audio engine note
    const spd = G.player.mode === 'car' && G.player.car ? G.player.car.speed : G.player.mode === 'bike' && G.player.bike ? G.player.bike.speed : 0;
    G.audio.setEngine(spd, 60);
    updateCamera(dt);
  }
  // HUD (also in menu, so the start screen shows a live city behind it)
  const p = G.player;
  const mph = Math.abs(p.speed || 0) * 2.2;
  G.hud.setSpeed(mph, p.mode === 'foot' ? 'ON FOOT' : p.mode === 'bike' ? 'BIKE' : p.mode === 'boat' ? 'BOAT' : '');
  G.hud.setCash(p.cash);
  G.hud.setHealth(p.health);
  G.hud.setDamage(p.mode === 'car' && p.car ? 100 - p.car.health : 0);
  G.hud.setWeapons(p.weapons, p.weapon);
  G.drawMinimap();
  G.renderer.render(G.scene, G.camera);
}

init();
