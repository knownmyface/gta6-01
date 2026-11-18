// CORAL HEAT v2.5 — main bootstrap and game loop. Wires the city, traffic,
// pedestrians, police, missions, combat, arsenal + viewmodel, side
// activities (taxi fares, Coral Coins, gun shop), HUD, radio and saves
// together and runs the game in desktop Chrome from static files, no
// network requests. v2.5 rewrites v2.4's main.js from scratch: same game,
// same loop, same wiring, written as new code. The wiring is split into small
// setup functions (renderer, world, systems, input, screens) instead of one
// long top-level script, and the per-frame work is organised as named
// steps the loop calls in the same order.
import * as THREE from 'three';
import { createRng, clamp } from './rng.js';
import { buildCity, districtAt } from './city.js';
import { Traffic, Police, Roadblocks, driveCar } from './vehicles.js';
import { Player, Pedestrians } from './player.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { RadioAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { applyShot } from './shots.js';
import { Arsenal, Viewmodel } from './weapons.js';
import { SideActivities } from './side.js';

const el = (id) => document.getElementById(id);
const query = new URLSearchParams(location.search);
const SHOT_NAME = query.get('shot');
const SEED_NUM = parseInt(query.get('seed') || '7', 10) || 7;
// Capture boot errors early: a module that throws mid-evaluation never
// reaches the listener registered at the end of this file.
window.addEventListener('error', (e) => { window.__shotError = String(e.message || e.error); });

const CAR_LABELS = {
  sports: 'COMET GT', sedan: 'BAYSIDE SEDAN', taxi: 'CORAL CAB',
  van: 'HARBOR VAN', truck: 'DOCK HAULER', police: 'CBPD INTERCEPTOR', bus: 'CORAL CITY BUS',
};

const OPENING_CASH = 1250;
const OPENING_POS = { x: -160, z: 20, heading: Math.PI / 2 };

// --- renderer + scene -------------------------------------------------------
function makeRenderer() {
  const canvas = el('game');
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true });
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  gl.setSize(window.innerWidth, window.innerHeight);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.12; // a touch brighter — v2's shadowed streets read muddy in the mission shot
  return { canvas, renderer: gl };
}

function makeCamera() {
  const cam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  cam.position.set(-150, 6, 40);
  return cam;
}

// --- world + systems --------------------------------------------------------
// Every subsystem gets its own seeded stream off the same seed, so a
// screenshot seed reproduces the same city, traffic and pedestrians.
function makeWorld(stage) {
  const realm = buildCity(stage, SEED_NUM);
  realm.scene = stage;
  realm.traffic = new Traffic(stage, createRng(SEED_NUM + 11), realm.colliders);
  realm.peds = new Pedestrians(stage, createRng(SEED_NUM + 23), realm.colliders);
  realm.police = new Police(stage, createRng(SEED_NUM + 37), realm.colliders);
  realm.roadblocks = new Roadblocks(stage);
  realm.playerCars = [];
  return realm;
}

function makeActors(stage) {
  const mara = new Player(stage, createRng(SEED_NUM + 51));
  const sound = new RadioAudio();
  const overlay = new Hud();
  const guns = new Arsenal();
  return { player: mara, audio: sound, hud: overlay, arsenal: guns };
}

const { canvas: view, renderer: gl } = makeRenderer();
const stage = new THREE.Scene();
const cam = makeCamera();
stage.add(cam); // the viewmodel gun is a child of the camera — it only renders if the camera is in the scene

const realm = makeWorld(stage);
const cars = realm.traffic;
const walkers = realm.peds;
const cops = realm.police;
const blocks = realm.roadblocks;
const { player: mara, audio: sound, hud: overlay, arsenal: guns } = makeActors(stage);
const firstPerson = new Viewmodel(cam);
const fight = new Combat(stage, sound, guns);

const tally = { faresDone: 0, shotsFired: 0, kills: 0, coinsEarned: 0 };

const game = {
  mode: 'menu', // menu | playing | paused | busted
  cameraYaw: 0,
  cameraPitch: 0.32,
  cameraDist: 10,
  dragging: false,
  firing: false,
  shopOpen: false,
  aimHeading: 0,
  shotFrames: 0,
  shotStart: performance.now(),
  saveTimer: 0,
  bestWanted: 0,
};

function toast(title, body) { overlay.toast(title, body); }

function saveGame() {
  writeSave({
    cash: mara.cash,
    missionIndex: story.index,
    missionsDone: story.done,
    earned: story.earned,
    station: sound.station,
    muted: sound.muted,
    bestWanted: game.bestWanted,
    weapons: guns.serialize(),
    coins: [...extras.coinsFound],
    stats: tally,
  });
}

// Side activities: taxi fares, Coral Coins, the GUNSMITH shop marker.
const extras = new SideActivities(stage, createRng(SEED_NUM + 91), {
  onToast: toast,
  onObjective: (t) => overlay.setObjective(t),
  onCash: (n) => {
    mara.cash += n;
    if (n === 150) {
      tally.coinsEarned += 1;
      sound.coinPickup();
    }
  },
  onFareDone: () => { tally.faresDone += 1; },
});

const story = new MissionManager(stage, createRng(SEED_NUM + 71), realm.beacon, {
  onToast: toast,
  onObjective: (t) => overlay.setObjective(t),
  onMissionStart: (m) => {
    overlay.setMission(m, story.done, story.earned);
    overlay.showMissionCard(m);
    sound.missionJingle();
  },
  onComplete: (m, cash) => {
    overlay.showComplete(m, cash);
    toast(`MISSION COMPLETE — ${m.title}`, `+$${m.reward.toLocaleString()}  •  cash $${cash.toLocaleString()}`);
    sound.missionJingle();
    saveGame();
  },
  onFail: (reason) => {
    toast('MISSION FAILED', reason);
    sound.blip(220);
  },
  setWanted: (n) => {
    mara.wanted = n;
    mara.wantedTimer = 0;
  },
});
story.world = realm;

fight.onBusted = (cause) => {
  const fine = Math.min(500, Math.floor(mara.cash * 0.15));
  mara.cash -= fine;
  mara.health = 100;
  mara.wanted = 0;
  cops.clear();
  blocks.clear();
  if (mara.inCar) mara.exitCar();
  mara.x = OPENING_POS.x;
  mara.z = OPENING_POS.z;
  mara.heading = OPENING_POS.heading;
  mara.mesh.position.set(mara.x, 0, mara.z);
  el('bustedText').textContent = `${cause} Bail posted ($${fine}) — back on the Strip.`;
  game.mode = 'busted';
  el('bustedScreen').classList.remove('hidden');
  saveGame();
};

// Every shot lights the viewmodel flash and counts for the stats screen.
fight.onShotFired = () => {
  firstPerson.fire();
  tally.shotsFired += 1;
};

// --- input ------------------------------------------------------------------
const held = {};

function toggleMute() {
  sound.setMuted(!sound.muted);
  overlay.setRadio(sound.currentStation());
  toast(sound.muted ? 'RADIO MUTED' : 'RADIO ON', sound.currentStation().name);
}

function cycleRadio() { setStation(sound.station + 1); }

function setStation(i) {
  const st = sound.setStation(i);
  overlay.setRadio(st);
  toast(st.name, st.track);
}

function selectWeapon(type) {
  if (game.mode !== 'playing' || mara.inCar) return;
  if (!guns.owned.has(type)) {
    toast('NOT OWNED', `${guns.defs[type].name} — buy it at the GUNSMITH on the Strip (green marker).`);
    return;
  }
  guns.select(type);
  mara.setWeapon(type);
  firstPerson.setWeapon(type);
  sound.weaponSwitch();
  overlay.setArsenal(guns);
}

function reloadWeapon() {
  if (guns.reload()) sound.reloadClick();
  else if (guns.ammo[guns.current].mag === 0) sound.dryFire();
}

// The nearest of Mara's own parked cars, within 4 units — entering a
// stolen car again beats stealing a fresh one.
function nearestParkedCar() {
  let best = null;
  let bd = 16;
  for (const c of realm.playerCars) {
    const dist = (c.x - mara.x) ** 2 + (c.z - mara.z) ** 2;
    if (dist < bd) {
      bd = dist;
      best = c;
    }
  }
  return best;
}

function tryEnterExit() {
  if (game.mode !== 'playing') return;
  if (game.shopOpen) {
    closeShop();
    return;
  }
  if (mara.inCar) {
    mara.exitCar();
    sound.blip(440);
    return;
  }
  // Own parked car first.
  const best = nearestParkedCar();
  if (best) {
    mara.enterCar(best);
    sound.blip(660);
  }
}

function tryStealOrShop() {
  if (game.mode !== 'playing' || mara.inCar) return;
  if (game.shopOpen) {
    closeShop();
    return;
  }
  if (extras.nearShop(mara)) {
    openShop();
    return;
  }
  trySteal();
}

function openShop() {
  game.shopOpen = true;
  const buyHandler = (type) => {
    const def = guns.defs[type];
    if (guns.owned.has(type)) return;
    if (!guns.buy(type, mara.cash)) return; // checks price + ownership
    mara.cash -= def.price;
    mara.setWeapon(type);
    firstPerson.setWeapon(type);
    sound.shopBuy();
    overlay.setArsenal(guns);
    overlay.renderShop(guns, mara.cash, buyHandler);
    toast('PURCHASED', `${def.icon} ${def.name} — press ${def.key} to equip.`);
    saveGame();
  };
  overlay.renderShop(guns, mara.cash, buyHandler);
  overlay.showShop(true);
  sound.blip(990);
}

function closeShop() {
  game.shopOpen = false;
  overlay.showShop(false);
}

function trySteal() {
  if (game.mode !== 'playing' || mara.inCar) return;
  const car = cars.nearest(mara.x, mara.z, 5);
  if (!car) {
    toast('NO CAR NEARBY', 'Walk up to a traffic car and press E.');
    return;
  }
  cars.remove(car);
  walkers.spawnDriver(car.x + 2, car.z + 2, car.heading + Math.PI / 2);
  realm.playerCars.push(car);
  mara.enterCar(car);
  mara.addWanted(1, 'carjacking');
  sound.stealJingle();
  toast('CAR STOLEN', `${CAR_LABELS[car.type] || 'CAR'} is yours — the cops noticed. +1 wanted star.`);
  if (story.active?.def.type === 'steal') {
    overlay.setObjective('Stolen! Now deliver it to the garage');
  }
}

function shoot() {
  const targets = fight.buildTargets(mara, story, cops, walkers);
  const hit = fight.playerShoot(mara, mara.heading + game.cameraYaw * 0.15, targets);
  if (hit) walkers.scare(mara.x, mara.z, 20);
}

// One-shot keys, looked up by code — held keys live in `held`. Built as a
// list of [code, action] pairs so adding a binding is one row, not a branch.
const KEY_ACTIONS = new Map([
  ['KeyM', () => toggleMute()],
  ['KeyT', () => cycleRadio()],
  ['Digit1', () => selectWeapon('pistol')],
  ['Digit2', () => selectWeapon('smg')],
  ['Digit3', () => selectWeapon('rifle')],
  ['Digit4', () => selectWeapon('shotgun')],
  ['KeyF', () => tryEnterExit()],
  ['KeyE', () => tryStealOrShop()],
]);

function handleKeyDown(e) {
  held[e.code] = true;
  if (e.code === 'Escape' && game.mode === 'playing') pauseGame();
  else if (e.code === 'Escape' && game.mode === 'paused') resumeGame();
  if (e.code === 'KeyR' && game.mode === 'playing' && !mara.inCar) reloadWeapon();
  if (e.code === 'Enter' && game.mode === 'menu') startGame(false);
  const action = KEY_ACTIONS.get(e.code);
  if (action) action();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
}

function bindInput() {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', (e) => { held[e.code] = false; });
  view.addEventListener('mousedown', (e) => {
    game.dragging = true;
    if (game.mode === 'playing' && !mara.inCar && e.button === 0) {
      game.firing = true;
      shoot();
    }
  });
  window.addEventListener('mouseup', () => {
    game.dragging = false;
    game.firing = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!game.dragging) return;
    game.cameraYaw -= e.movementX * 0.004;
    game.cameraPitch = clamp(game.cameraPitch + e.movementY * 0.003, 0.08, 1.1);
    if (!mara.inCar) mara.heading -= e.movementX * 0.004;
  });
  window.addEventListener('resize', () => {
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    gl.setSize(window.innerWidth, window.innerHeight);
  });
}

// --- screens ----------------------------------------------------------------
function fillMissionList() {
  const save = loadSave();
  const idx = save?.missionIndex ?? 0;
  el('missionList').innerHTML = MISSIONS.map((m, i) => {
    const cls = i < idx ? 'done' : i === idx ? 'next' : '';
    const mark = i < idx ? '✓' : i === idx ? '▶' : '·';
    return `<div class="${cls}">${mark} ${m.id}. ${m.title} — $${m.reward.toLocaleString()}</div>`;
  }).join('');
}

function startGame(fromContinue) {
  sound.unlock();
  const save = loadSave();
  el('startScreen').classList.add('hidden');
  game.mode = 'playing';
  if (fromContinue && save) {
    mara.cash = save.cash ?? OPENING_CASH;
    story.restore({ index: save.missionIndex ?? 0, done: save.missionIndex ?? 0, earned: save.earned ?? 0 });
    game.bestWanted = save.bestWanted ?? 0;
    if (save.weapons) guns.restore(save.weapons);
    if (save.coins) extras.restoreCoins(save.coins);
    if (save.stats) Object.assign(tally, save.stats);
    mara.setWeapon(guns.current);
    firstPerson.setWeapon(guns.current);
  } else {
    mara.cash = OPENING_CASH;
  }
  cars.spawn(22, mara.pos);
  walkers.spawn(40, mara.pos);
  story.startMission(story.index);
  overlay.setCash(mara.cash);
  overlay.setHealth(mara.health);
  overlay.setRadio(sound.currentStation());
  overlay.setArsenal(guns);
  overlay.setCoins(extras.coinsFound.size);
  saveGame();
}

function pauseGame() {
  game.mode = 'paused';
  overlay.setStats(tally, extras.coinsFound.size, story.done);
  el('pauseScreen').classList.remove('hidden');
  saveGame();
}

function resumeGame() {
  game.mode = 'playing';
  el('pauseScreen').classList.add('hidden');
  sound.unlock();
}

function bindScreens() {
  el('startBtn').addEventListener('click', () => startGame(false));
  el('continueBtn').addEventListener('click', () => startGame(true));
  el('resumeBtn').addEventListener('click', resumeGame);
  el('restartBtn').addEventListener('click', () => {
    clearSave();
    location.reload();
  });
  el('bustedBtn').addEventListener('click', () => {
    el('bustedScreen').classList.add('hidden');
    game.mode = 'playing';
    story.startMission(story.index);
  });
}

// --- camera -----------------------------------------------------------------
function updateCamera(dt) {
  if (game.cinematic) {
    game.cinematic();
    return;
  }
  const p = mara.pos;
  const heading = mara.inCar ? mara.car.heading : mara.heading;
  const yaw = heading + game.cameraYaw;
  const dist = mara.inCar ? 11 : 8;
  const height = mara.inCar ? 4.4 : 3.6;
  const tx = p.x - Math.sin(yaw) * dist;
  const tz = p.z - Math.cos(yaw) * dist;
  const k = 1 - Math.pow(0.0001, dt);
  cam.position.x += (tx - cam.position.x) * k;
  cam.position.y += (height - cam.position.y) * k;
  cam.position.z += (tz - cam.position.z) * k;
  cam.lookAt(p.x + Math.sin(heading) * 6, mara.inCar ? 1.6 : 1.4, p.z + Math.cos(heading) * 6);
}

// The equipped weapon stays on the HUD even while driving — it is part of
// the cover composition, not just the on-foot view.
function weaponLine() {
  const w = guns.def();
  const a = guns.ammo[guns.current];
  if (mara.inCar) {
    return `🚗 Driving • ${w.icon} ${w.name} ${a.mag}/${a.reserve} • F exit • Space brake`;
  }
  return null;
}

// --- HUD refresh ------------------------------------------------------------
function updateHud() {
  const p = mara.pos;
  overlay.setCash(mara.cash);
  overlay.setWanted(mara.wanted);
  overlay.setHealth(mara.health);
  overlay.setDistrict(districtAt(p.x, p.z));
  const mph = (mara.inCar ? mara.car.speed : mara.speed) * 2.24;
  overlay.setSpeed(mph, mara.inCar ? (CAR_LABELS[mara.car.type] || 'CAR') : 'ON FOOT');
  const driving = weaponLine();
  if (driving) overlay.setWeapon(driving);
  else overlay.setArsenal(guns);
  overlay.setCoins(extras.coinsFound.size);
  overlay.drawMinimap(realm, mara, story);
  game.bestWanted = Math.max(game.bestWanted, mara.wanted);
}

// --- per-frame world life: ocean, wheel, clouds, traffic lights ------------
function animateWorld(dt) {
  realm.animated.ocean.offset.x += dt * 0.008;
  realm.animated.ocean.offset.y += dt * 0.003;
  if (realm.animated.wheel) realm.animated.wheel.rotation.z += dt * 0.12;
  for (const cloud of realm.animated.clouds) {
    cloud.position.x += dt * 2.2;
    if (cloud.position.x > 520) cloud.position.x = -520;
  }
  const t = performance.now() / 1000;
  for (const light of realm.animated.lights) {
    const phase = (t + light.phase) % 28;
    const idx = phase < 12 ? 2 : phase < 14 ? 1 : phase < 26 ? 0 : 1;
    light.bulbs.forEach((bulb, i) => {
      bulb.material = i === idx ? [light.redMat, light.amberMat, light.greenMat][i] : light.darkMat;
    });
  }
}

// The driving input for this frame: keyboard plus the staged shot input
// (screenshots drive the car with a fixed throttle), clamped to [-1, 1].
function driveInput() {
  const throttle = (held.KeyW || held.ArrowUp ? 1 : 0)
    + (held.KeyS || held.ArrowDown ? -0.7 : 0)
    + (game.shotInput?.throttle ?? 0);
  const steer = (held.KeyA || held.ArrowLeft ? 1 : 0)
    - (held.KeyD || held.ArrowRight ? 1 : 0)
    + (game.shotInput?.steer ?? 0);
  return {
    throttle: clamp(throttle, -1, 1),
    steer: clamp(steer, -1, 1),
    brake: !!held.Space,
  };
}

function drivePlayerCar(dt) {
  const car = mara.car;
  const boost = held.ShiftLeft || held.ShiftRight ? 1.35 : 1;
  const prevMax = car.maxSpeed;
  car.maxSpeed = prevMax * boost;
  driveCar(car, dt, driveInput(), realm.colliders, [...cars.cars, ...cops.cars, ...realm.playerCars]);
  car.maxSpeed = prevMax;
  if (car.crashed && game.crashCooldown <= 0) {
    sound.crash();
    game.crashCooldown = 0.5;
  }
  game.crashCooldown = Math.max(0, (game.crashCooldown ?? 0) - dt);
  const block = blocks.hitTest(car.x, car.z);
  if (block) {
    car.speed *= 0.3;
    mara.addWanted(0);
    sound.crash();
  }
}

function walkPlayer(dt) {
  mara.onFootMove(dt, {
    forward: !!(held.KeyW || held.ArrowUp),
    back: !!(held.KeyS || held.ArrowDown),
    left: !!(held.KeyA || held.ArrowLeft),
    right: !!(held.KeyD || held.ArrowRight),
    run: !!(held.ShiftLeft || held.ShiftRight),
  }, realm.colliders);
  // Hold the mouse to fire the equipped weapon (auto-fire for SMG/rifle).
  if (game.firing) shoot();
}

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();
let framesRendered = 0;

function stepWorld(dt) {
  if (mara.inCar) drivePlayerCar(dt);
  else walkPlayer(dt);

  cars.update(dt, mara);
  walkers.update(dt);
  cops.update(dt, mara, mara.wanted, [...cars.cars, ...realm.playerCars]);
  blocks.placeAhead(mara, mara.wanted);
  story.update(dt, mara, realm);
  fight.update(dt, mara, story, cops, walkers);
  extras.update(dt, mara, walkers);
  guns.update(dt);
  mara.decayWanted(dt);
  sound.setEngine(mara.inCar ? mara.car.speed * 2.24 : 0, mara.inCar);
  sound.setSiren(mara.wanted);

  animateWorld(dt);
  firstPerson.update(dt, !mara.inCar && (held.KeyW || held.KeyA || held.KeyS || held.KeyD), game.firing);

  game.saveTimer += dt;
  if (game.saveTimer > 10) {
    game.saveTimer = 0;
    saveGame();
  }
  updateHud();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const playing = game.mode === 'playing';

  if (playing) stepWorld(dt);

  updateCamera(dt);
  gl.render(stage, cam);
  framesRendered += 1;

  // Screenshot mode: signal readiness after the scene has settled.
  if (SHOT_NAME && game.mode === 'playing' && !window.__shotReady) {
    if (framesRendered >= 12 && performance.now() - game.shotStart > 2500) {
      window.__shotReady = true;
    }
  }
}

// --- boot -------------------------------------------------------------------
bindInput();
bindScreens();
fillMissionList();
{
  const save = loadSave();
  if (save && (save.missionIndex ?? 0) > 0) {
    el('continueBtn').classList.remove('hidden');
    el('continueNum').textContent = (save.missionIndex ?? 0) + 1;
  }
  overlay.setRadio(sound.currentStation());
  overlay.setMission(MISSIONS[0], 0, 0);
  overlay.setCash(OPENING_CASH);
}

if (SHOT_NAME) {
  // Screenshot mode: straight into a staged, playing scene — no menus, no audio.
  // (No random traffic/peds here: each shot stages its own, so a random bus
  // can never land on the cinematic camera.)
  el('startScreen').classList.add('hidden');
  game.mode = 'playing';
  const ctx = {
    player: mara, missions: story, hud: overlay, audio: sound, camera: cam, arsenal: guns, side: extras, combat: fight, viewmodel: firstPerson,
    world: realm, input: null, cameraMode: 'follow', cinematic: null,
  };
  if (applyShot(SHOT_NAME, ctx)) {
    game.cinematic = ctx.cinematic || null;
    game.shotInput = ctx.input || null;
    const m = story.current();
    if (m) overlay.setMission(m, story.done, story.earned);
    overlay.setCash(mara.cash);
    overlay.setHealth(mara.health);
    overlay.setWanted(mara.wanted);
    overlay.setArsenal(guns);
    overlay.setCoins(extras.coinsFound.size);
  } else {
    window.__shotError = `unknown shot: ${SHOT_NAME}`;
  }
}

window.__game = { player: mara, missions: story, traffic: cars, police: cops, peds: walkers, state: game, hud: overlay, arsenal: guns, side: extras, combat: fight, viewmodel: firstPerson };
animate();
