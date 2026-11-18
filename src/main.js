// CORAL HEAT v2.6 — bootstrap and game loop.
// v2.6 rewrites v2.5's main.js from scratch: the same scene, the same
// wiring, the same loop, written as new code. The setup is grouped into
// named phases (renderer, camera, world, actors, input, screens, loop)
// and the per-frame work is a short pipeline of named steps the loop calls
// in the same order. One contract binds every file: the seeded streams
// deal in the same order as v2.5 (city SEED_NUM, traffic +11, peds +23,
// police +37, missions +71, side +91, player +51), so a screenshot with
// the same seed reproduces the same city, the same cars and the same peds.
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

// --- renderer + camera ------------------------------------------------------
function buildRenderer() {
  const canvas = el('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12; // a touch brighter — v2's shadowed streets read muddy in the mission shot
  return { canvas, renderer };
}

function buildCamera() {
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(-150, 6, 40);
  return camera;
}

// --- world + actors ---------------------------------------------------------
// Every subsystem gets its own seeded stream off the same seed, so a
// screenshot seed reproduces the same city, traffic and pedestrians.
function buildWorld(scene3d) {
  const world = buildCity(scene3d, SEED_NUM);
  world.scene = scene3d;
  world.traffic = new Traffic(scene3d, createRng(SEED_NUM + 11), world.colliders);
  world.peds = new Pedestrians(scene3d, createRng(SEED_NUM + 23), world.colliders);
  world.police = new Police(scene3d, createRng(SEED_NUM + 37), world.colliders);
  world.roadblocks = new Roadblocks(scene3d);
  world.playerCars = [];
  return world;
}

function buildActors(scene3d) {
  const hero = new Player(scene3d, createRng(SEED_NUM + 51));
  const sfx = new RadioAudio();
  const panel = new Hud();
  const kit = new Arsenal();
  return { player: hero, audio: sfx, hud: panel, arsenal: kit };
}

const { canvas: view, renderer: gl } = buildRenderer();
const scene3d = new THREE.Scene();
const camera3d = buildCamera();
scene3d.add(camera3d); // the viewmodel gun is a child of the camera — it only renders if the camera is in the scene

const world = buildWorld(scene3d);
const traffic = world.traffic;
const crowd = world.peds;
const patrol = world.police;
const barriers = world.roadblocks;
const { player: hero, audio: sfx, hud: panel, arsenal: kit } = buildActors(scene3d);
const fpv = new Viewmodel(camera3d);
const battle = new Combat(scene3d, sfx, kit);

const score = { faresDone: 0, shotsFired: 0, kills: 0, coinsEarned: 0 };

const run = {
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

function notify(title, body) { panel.toast(title, body); }

function persist() {
  writeSave({
    cash: hero.cash,
    missionIndex: quests.index,
    missionsDone: quests.done,
    earned: quests.earned,
    station: sfx.station,
    muted: sfx.muted,
    bestWanted: run.bestWanted,
    weapons: kit.serialize(),
    coins: [...side.coinsFound],
    stats: score,
  });
}

// Side activities: taxi fares, Coral Coins, the GUNSMITH shop marker.
const side = new SideActivities(scene3d, createRng(SEED_NUM + 91), {
  onToast: notify,
  onObjective: (t) => panel.setObjective(t),
  onCash: (n) => {
    hero.cash += n;
    if (n === 150) {
      score.coinsEarned += 1;
      sfx.coinPickup();
    }
  },
  onFareDone: () => { score.faresDone += 1; },
});

const quests = new MissionManager(scene3d, createRng(SEED_NUM + 71), world.beacon, {
  onToast: notify,
  onObjective: (t) => panel.setObjective(t),
  onMissionStart: (m) => {
    panel.setMission(m, quests.done, quests.earned);
    panel.showMissionCard(m);
    sfx.missionJingle();
  },
  onComplete: (m, cash) => {
    panel.showComplete(m, cash);
    notify(`MISSION COMPLETE — ${m.title}`, `+$${m.reward.toLocaleString()}  •  cash $${cash.toLocaleString()}`);
    sfx.missionJingle();
    persist();
  },
  onFail: (reason) => {
    notify('MISSION FAILED', reason);
    sfx.blip(220);
  },
  setWanted: (n) => {
    hero.wanted = n;
    hero.wantedTimer = 0;
  },
});
quests.world = world;

battle.onBusted = (cause) => {
  const fine = Math.min(500, Math.floor(hero.cash * 0.15));
  hero.cash -= fine;
  hero.health = 100;
  hero.wanted = 0;
  patrol.clear();
  barriers.clear();
  if (hero.inCar) hero.exitCar();
  hero.x = OPENING_POS.x;
  hero.z = OPENING_POS.z;
  hero.heading = OPENING_POS.heading;
  hero.mesh.position.set(hero.x, 0, hero.z);
  el('bustedText').textContent = `${cause} Bail posted ($${fine}) — back on the Strip.`;
  run.mode = 'busted';
  el('bustedScreen').classList.remove('hidden');
  persist();
};

// Every shot lights the viewmodel flash and counts for the stats screen.
battle.onShotFired = () => {
  fpv.fire();
  score.shotsFired += 1;
};

// --- input ------------------------------------------------------------------
const keysDown = {};

function flipMute() {
  sfx.setMuted(!sfx.muted);
  panel.setRadio(sfx.currentStation());
  notify(sfx.muted ? 'RADIO MUTED' : 'RADIO ON', sfx.currentStation().name);
}

function nextStation() { tuneStation(sfx.station + 1); }

function tuneStation(i) {
  const station = sfx.setStation(i);
  panel.setRadio(station);
  notify(station.name, station.track);
}

function equipWeapon(type) {
  if (run.mode !== 'playing' || hero.inCar) return;
  if (!kit.owned.has(type)) {
    notify('NOT OWNED', `${kit.defs[type].name} — buy it at the GUNSMITH on the Strip (green marker).`);
    return;
  }
  kit.select(type);
  hero.setWeapon(type);
  fpv.setWeapon(type);
  sfx.weaponSwitch();
  panel.setArsenal(kit);
}

function reloadGun() {
  if (kit.reload()) sfx.reloadClick();
  else if (kit.ammo[kit.current].mag === 0) sfx.dryFire();
}

// The nearest of Mara's own parked cars, within 4 units — entering a
// stolen car again beats stealing a fresh one.
function closestOwnedCar() {
  let best = null;
  let bestDist = 16;
  for (const car of world.playerCars) {
    const dist = (car.x - hero.x) ** 2 + (car.z - hero.z) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}

function enterOrExit() {
  if (run.mode !== 'playing') return;
  if (run.shopOpen) {
    hideShop();
    return;
  }
  if (hero.inCar) {
    hero.exitCar();
    sfx.blip(440);
    return;
  }
  // Own parked car first.
  const parked = closestOwnedCar();
  if (parked) {
    hero.enterCar(parked);
    sfx.blip(660);
  }
}

function stealOrShop() {
  if (run.mode !== 'playing' || hero.inCar) return;
  if (run.shopOpen) {
    hideShop();
    return;
  }
  if (side.nearShop(hero)) {
    showShop();
    return;
  }
  stealCar();
}

function showShop() {
  run.shopOpen = true;
  const buyHandler = (type) => {
    const def = kit.defs[type];
    if (kit.owned.has(type)) return;
    if (!kit.buy(type, hero.cash)) return; // checks price + ownership
    hero.cash -= def.price;
    hero.setWeapon(type);
    fpv.setWeapon(type);
    sfx.shopBuy();
    panel.setArsenal(kit);
    panel.renderShop(kit, hero.cash, buyHandler);
    notify('PURCHASED', `${def.icon} ${def.name} — press ${def.key} to equip.`);
    persist();
  };
  panel.renderShop(kit, hero.cash, buyHandler);
  panel.showShop(true);
  sfx.blip(990);
}

function hideShop() {
  run.shopOpen = false;
  panel.showShop(false);
}

function stealCar() {
  if (run.mode !== 'playing' || hero.inCar) return;
  const car = traffic.nearest(hero.x, hero.z, 5);
  if (!car) {
    notify('NO CAR NEARBY', 'Walk up to a traffic car and press E.');
    return;
  }
  traffic.remove(car);
  crowd.spawnDriver(car.x + 2, car.z + 2, car.heading + Math.PI / 2);
  world.playerCars.push(car);
  hero.enterCar(car);
  hero.addWanted(1, 'carjacking');
  sfx.stealJingle();
  notify('CAR STOLEN', `${CAR_LABELS[car.type] || 'CAR'} is yours — the cops noticed. +1 wanted star.`);
  if (quests.active?.def.type === 'steal') {
    panel.setObjective('Stolen! Now deliver it to the garage');
  }
}

function fireWeapon() {
  const targets = battle.buildTargets(hero, quests, patrol, crowd);
  const hit = battle.playerShoot(hero, hero.heading + run.cameraYaw * 0.15, targets);
  if (hit) crowd.scare(hero.x, hero.z, 20);
}

// One-shot keys, looked up by code — held keys live in `keysDown`. Built as
// a list of [code, action] pairs so adding a binding is one row, not a branch.
const KEY_ACTIONS = new Map([
  ['KeyM', () => flipMute()],
  ['KeyT', () => nextStation()],
  ['Digit1', () => equipWeapon('pistol')],
  ['Digit2', () => equipWeapon('smg')],
  ['Digit3', () => equipWeapon('rifle')],
  ['Digit4', () => equipWeapon('shotgun')],
  ['KeyF', () => enterOrExit()],
  ['KeyE', () => stealOrShop()],
]);

function onKeyDown(e) {
  keysDown[e.code] = true;
  if (e.code === 'Escape' && run.mode === 'playing') pauseRun();
  else if (e.code === 'Escape' && run.mode === 'paused') resumeRun();
  if (e.code === 'KeyR' && run.mode === 'playing' && !hero.inCar) reloadGun();
  if (e.code === 'Enter' && run.mode === 'menu') beginRun(false);
  const action = KEY_ACTIONS.get(e.code);
  if (action) action();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
}

function wireInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e) => { keysDown[e.code] = false; });
  view.addEventListener('mousedown', (e) => {
    run.dragging = true;
    if (run.mode === 'playing' && !hero.inCar && e.button === 0) {
      run.firing = true;
      fireWeapon();
    }
  });
  window.addEventListener('mouseup', () => {
    run.dragging = false;
    run.firing = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!run.dragging) return;
    run.cameraYaw -= e.movementX * 0.004;
    run.cameraPitch = clamp(run.cameraPitch + e.movementY * 0.003, 0.08, 1.1);
    if (!hero.inCar) hero.heading -= e.movementX * 0.004;
  });
  window.addEventListener('resize', () => {
    camera3d.aspect = window.innerWidth / window.innerHeight;
    camera3d.updateProjectionMatrix();
    gl.setSize(window.innerWidth, window.innerHeight);
  });
}

// --- screens ----------------------------------------------------------------
function renderMissionList() {
  const save = loadSave();
  const idx = save?.missionIndex ?? 0;
  el('missionList').innerHTML = MISSIONS.map((m, i) => {
    const cls = i < idx ? 'done' : i === idx ? 'next' : '';
    const mark = i < idx ? '✓' : i === idx ? '▶' : '·';
    return `<div class="${cls}">${mark} ${m.id}. ${m.title} — $${m.reward.toLocaleString()}</div>`;
  }).join('');
}

function beginRun(fromContinue) {
  sfx.unlock();
  const save = loadSave();
  el('startScreen').classList.add('hidden');
  run.mode = 'playing';
  if (fromContinue && save) {
    hero.cash = save.cash ?? OPENING_CASH;
    quests.restore({ index: save.missionIndex ?? 0, done: save.missionIndex ?? 0, earned: save.earned ?? 0 });
    run.bestWanted = save.bestWanted ?? 0;
    if (save.weapons) kit.restore(save.weapons);
    if (save.coins) side.restoreCoins(save.coins);
    if (save.stats) Object.assign(score, save.stats);
    hero.setWeapon(kit.current);
    fpv.setWeapon(kit.current);
  } else {
    hero.cash = OPENING_CASH;
  }
  traffic.spawn(22, hero.pos);
  crowd.spawn(40, hero.pos);
  quests.startMission(quests.index);
  panel.setCash(hero.cash);
  panel.setHealth(hero.health);
  panel.setRadio(sfx.currentStation());
  panel.setArsenal(kit);
  panel.setCoins(side.coinsFound.size);
  persist();
}

function pauseRun() {
  run.mode = 'paused';
  panel.setStats(score, side.coinsFound.size, quests.done);
  el('pauseScreen').classList.remove('hidden');
  persist();
}

function resumeRun() {
  run.mode = 'playing';
  el('pauseScreen').classList.add('hidden');
  sfx.unlock();
}

function wireScreens() {
  el('startBtn').addEventListener('click', () => beginRun(false));
  el('continueBtn').addEventListener('click', () => beginRun(true));
  el('resumeBtn').addEventListener('click', resumeRun);
  el('restartBtn').addEventListener('click', () => {
    clearSave();
    location.reload();
  });
  el('bustedBtn').addEventListener('click', () => {
    el('bustedScreen').classList.add('hidden');
    run.mode = 'playing';
    quests.startMission(quests.index);
  });
}

// --- camera -----------------------------------------------------------------
function placeCamera(dt) {
  if (run.cinematic) {
    run.cinematic();
    return;
  }
  const pos = hero.pos;
  const heading = hero.inCar ? hero.car.heading : hero.heading;
  const yaw = heading + run.cameraYaw;
  const dist = hero.inCar ? 11 : 8;
  const height = hero.inCar ? 4.4 : 3.6;
  const targetX = pos.x - Math.sin(yaw) * dist;
  const targetZ = pos.z - Math.cos(yaw) * dist;
  const k = 1 - Math.pow(0.0001, dt);
  camera3d.position.x += (targetX - camera3d.position.x) * k;
  camera3d.position.y += (height - camera3d.position.y) * k;
  camera3d.position.z += (targetZ - camera3d.position.z) * k;
  camera3d.lookAt(pos.x + Math.sin(heading) * 6, hero.inCar ? 1.6 : 1.4, pos.z + Math.cos(heading) * 6);
}

// The equipped weapon stays on the HUD even while driving — it is part of
// the cover composition, not just the on-foot view.
function drivingWeaponText() {
  const weapon = kit.def();
  const ammo = kit.ammo[kit.current];
  if (hero.inCar) {
    return `🚗 Driving • ${weapon.icon} ${weapon.name} ${ammo.mag}/${ammo.reserve} • F exit • Space brake`;
  }
  return null;
}

// --- HUD refresh ------------------------------------------------------------
function refreshHud() {
  const pos = hero.pos;
  panel.setCash(hero.cash);
  panel.setWanted(hero.wanted);
  panel.setHealth(hero.health);
  panel.setDistrict(districtAt(pos.x, pos.z));
  const mph = (hero.inCar ? hero.car.speed : hero.speed) * 2.24;
  panel.setSpeed(mph, hero.inCar ? (CAR_LABELS[hero.car.type] || 'CAR') : 'ON FOOT');
  const driving = drivingWeaponText();
  if (driving) panel.setWeapon(driving);
  else panel.setArsenal(kit);
  panel.setCoins(side.coinsFound.size);
  panel.drawMinimap(world, hero, quests);
  run.bestWanted = Math.max(run.bestWanted, hero.wanted);
}

// --- per-frame world life: ocean, wheel, clouds, traffic lights ------------
function animateCity(dt) {
  world.animated.ocean.offset.x += dt * 0.008;
  world.animated.ocean.offset.y += dt * 0.003;
  if (world.animated.wheel) world.animated.wheel.rotation.z += dt * 0.12;
  for (const cloud of world.animated.clouds) {
    cloud.position.x += dt * 2.2;
    if (cloud.position.x > 520) cloud.position.x = -520;
  }
  const now = performance.now() / 1000;
  for (const signal of world.animated.lights) {
    const phase = (now + signal.phase) % 28;
    const idx = phase < 12 ? 2 : phase < 14 ? 1 : phase < 26 ? 0 : 1;
    signal.bulbs.forEach((bulb, i) => {
      bulb.material = i === idx ? [signal.redMat, signal.amberMat, signal.greenMat][i] : signal.darkMat;
    });
  }
}

// The driving input for this frame: keyboard plus the staged shot input
// (screenshots drive the car with a fixed throttle), clamped to [-1, 1].
function drivingInput() {
  const throttle = (keysDown.KeyW || keysDown.ArrowUp ? 1 : 0)
    + (keysDown.KeyS || keysDown.ArrowDown ? -0.7 : 0)
    + (run.shotInput?.throttle ?? 0);
  const steer = (keysDown.KeyA || keysDown.ArrowLeft ? 1 : 0)
    - (keysDown.KeyD || keysDown.ArrowRight ? 1 : 0)
    + (run.shotInput?.steer ?? 0);
  return {
    throttle: clamp(throttle, -1, 1),
    steer: clamp(steer, -1, 1),
    brake: !!keysDown.Space,
  };
}

function driveHeroCar(dt) {
  const car = hero.car;
  const boost = keysDown.ShiftLeft || keysDown.ShiftRight ? 1.35 : 1;
  const prevMax = car.maxSpeed;
  car.maxSpeed = prevMax * boost;
  driveCar(car, dt, drivingInput(), world.colliders, [...traffic.cars, ...patrol.cars, ...world.playerCars]);
  car.maxSpeed = prevMax;
  if (car.crashed && run.crashCooldown <= 0) {
    sfx.crash();
    run.crashCooldown = 0.5;
  }
  run.crashCooldown = Math.max(0, (run.crashCooldown ?? 0) - dt);
  const block = barriers.hitTest(car.x, car.z);
  if (block) {
    car.speed *= 0.3;
    hero.addWanted(0);
    sfx.crash();
  }
}

function walkHero(dt) {
  hero.onFootMove(dt, {
    forward: !!(keysDown.KeyW || keysDown.ArrowUp),
    back: !!(keysDown.KeyS || keysDown.ArrowDown),
    left: !!(keysDown.KeyA || keysDown.ArrowLeft),
    right: !!(keysDown.KeyD || keysDown.ArrowRight),
    run: !!(keysDown.ShiftLeft || keysDown.ShiftRight),
  }, world.colliders);
  // Hold the mouse to fire the equipped weapon (auto-fire for SMG/rifle).
  if (run.firing) fireWeapon();
}

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();
let framesRendered = 0;

function tickWorld(dt) {
  if (hero.inCar) driveHeroCar(dt);
  else walkHero(dt);

  traffic.update(dt, hero);
  crowd.update(dt);
  patrol.update(dt, hero, hero.wanted, [...traffic.cars, ...world.playerCars]);
  barriers.placeAhead(hero, hero.wanted);
  quests.update(dt, hero, world);
  battle.update(dt, hero, quests, patrol, crowd);
  side.update(dt, hero, crowd);
  kit.update(dt);
  hero.decayWanted(dt);
  sfx.setEngine(hero.inCar ? hero.car.speed * 2.24 : 0, hero.inCar);
  sfx.setSiren(hero.wanted);

  animateCity(dt);
  fpv.update(dt, !hero.inCar && (keysDown.KeyW || keysDown.KeyA || keysDown.KeyS || keysDown.KeyD), run.firing);

  run.saveTimer += dt;
  if (run.saveTimer > 10) {
    run.saveTimer = 0;
    persist();
  }
  refreshHud();
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const playing = run.mode === 'playing';

  if (playing) tickWorld(dt);

  placeCamera(dt);
  gl.render(scene3d, camera3d);
  framesRendered += 1;

  // Screenshot mode: signal readiness after the scene has settled.
  if (SHOT_NAME && run.mode === 'playing' && !window.__shotReady) {
    if (framesRendered >= 12 && performance.now() - run.shotStart > 2500) {
      window.__shotReady = true;
    }
  }
}

// --- boot -------------------------------------------------------------------
wireInput();
wireScreens();
renderMissionList();
{
  const save = loadSave();
  if (save && (save.missionIndex ?? 0) > 0) {
    el('continueBtn').classList.remove('hidden');
    el('continueNum').textContent = (save.missionIndex ?? 0) + 1;
  }
  panel.setRadio(sfx.currentStation());
  panel.setMission(MISSIONS[0], 0, 0);
  panel.setCash(OPENING_CASH);
}

if (SHOT_NAME) {
  // Screenshot mode: straight into a staged, playing scene — no menus, no audio.
  // (No random traffic/peds here: each shot stages its own, so a random bus
  // can never land on the cinematic camera.)
  el('startScreen').classList.add('hidden');
  run.mode = 'playing';
  const ctx = {
    player: hero, missions: quests, hud: panel, audio: sfx, camera: camera3d, arsenal: kit, side, combat: battle, viewmodel: fpv,
    world, input: null, cameraMode: 'follow', cinematic: null,
  };
  if (applyShot(SHOT_NAME, ctx)) {
    run.cinematic = ctx.cinematic || null;
    run.shotInput = ctx.input || null;
    const current = quests.current();
    if (current) panel.setMission(current, quests.done, quests.earned);
    panel.setCash(hero.cash);
    panel.setHealth(hero.health);
    panel.setWanted(hero.wanted);
    panel.setArsenal(kit);
    panel.setCoins(side.coinsFound.size);
  } else {
    window.__shotError = `unknown shot: ${SHOT_NAME}`;
  }
}

window.__game = { player: hero, missions: quests, traffic, police: patrol, peds: crowd, state: run, hud: panel, arsenal: kit, side, combat: battle, viewmodel: fpv };
loop();
