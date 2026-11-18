// Screenshot staging for CORAL HEAT v2.5: ?shot=<name>&seed=<n> teleports
// the game into a composed, fully-playing scene and drives a cinematic
// camera, so every screenshot is a real render of the game's own code —
// never edited or faked. v2.5 is a from-scratch rewrite of v2.4's shots.js:
// same four staged scenes, same cameras, same counts, different code.
// v2 staging is denser than v1: closer/lower cameras, buildings on both
// sides, more traffic and peds, more police, and a VISIBLE WEAPON in every
// shot (HUD weapon widget while driving, viewmodel + muzzle flash on foot,
// staged flash in the foot shot).
//   chase   — cover: 5-star chase down a downtown avenue into the sunset,
//             3 police cars, helicopter close, roadblock ahead, sports car
//             big in frame, full HUD, mission 7
//   foot    — carjacking: Mara on foot beside a red sports car, pistol in
//             her hand, muzzle flash staged, driver fleeing
//   marina  — beachfront drive past the Coral Wheel and the boats at sunset
//   mission — on foot at the Docks, rifle viewmodel + muzzle flash, rivals
//             down, police closing in
import * as THREE from 'three';
import { buildCarMesh } from './vehicles.js';

// --- staging primitives -----------------------------------------------------
// Put the player in a fresh car and hand it to the world.
function stagePlayerCar(ctx, type, color, x, z, heading) {
  const body = buildCarMesh(type, color);
  ctx.world.scene.add(body);
  const auto = {
    mesh: body, type, x, z, heading,
    speed: 0, maxSpeed: type === 'sports' ? 55 : 42,
    accel: 26, crashed: false, dead: false,
  };
  body.position.set(x, 0, z);
  body.rotation.y = heading;
  ctx.player.enterCar(auto);
  ctx.world.playerCars.push(auto);
  return auto;
}

// Park a car in the world without anyone driving it (a staged prop car
// for a shot, or a car Mara is about to steal).
function stageParkedCar(ctx, type, color, x, z, heading) {
  const body = buildCarMesh(type, color);
  ctx.world.scene.add(body);
  const auto = {
    mesh: body, type, x, z, heading,
    speed: 0, maxSpeed: type === 'sports' ? 55 : 42,
    accel: 26, crashed: false, dead: false,
  };
  body.position.set(x, 0, z);
  body.rotation.y = heading;
  ctx.world.playerCars.push(auto);
  return auto;
}

// Stand Mara at a spot, facing a heading — mesh and state together.
function stagePlayer(ctx, x, z, heading) {
  ctx.player.x = x;
  ctx.player.z = z;
  ctx.player.heading = heading;
  ctx.player.mesh.position.set(x, 0, z);
  ctx.player.mesh.rotation.y = heading;
}

// Place police cars at exact spots. They are spawned near the player first
// (so the police system owns them) and then moved to their marks.
function stagePolice(ctx, marks) {
  for (const [x, z, heading] of marks) {
    const auto = ctx.world.police.spawnCarNear(ctx.player.pos.x, ctx.player.pos.z);
    auto.x = x;
    auto.z = z;
    auto.heading = heading;
    auto.speed = 30;
    auto.mesh.position.set(x, 0, z);
    auto.mesh.rotation.y = heading;
  }
}

// Place traffic cars by hand for a shot: Traffic.spawn scatters cars across
// the whole city, so a bus can land right behind the player car and fill the
// cinematic camera. Staged cars sit only AHEAD of the player, in the lanes
// the camera actually sees. Each spec is an object: { type, color, x, z,
// heading, speed }.
function stageTraffic(ctx, specs) {
  for (const spec of specs) {
    const body = buildCarMesh(spec.type, spec.color);
    ctx.world.scene.add(body);
    const auto = {
      mesh: body, type: spec.type, x: spec.x, z: spec.z, heading: spec.heading,
      speed: spec.speed ?? 10, maxSpeed: 14, accel: 8, crashed: false, dead: false,
    };
    body.position.set(spec.x, 0, spec.z);
    body.rotation.y = spec.heading;
    ctx.world.traffic.cars.push(auto);
  }
}

// Chase camera behind the player car, low and slightly to the right so the
// car, the road ahead and the police behind all read in one frame.
function chaseCam(ctx, side, height, dist, lookY = 2.2) {
  const auto = ctx.player.car;
  const forwardX = Math.sin(auto.heading);
  const forwardZ = Math.cos(auto.heading);
  const rightX = Math.cos(auto.heading);
  const rightZ = -Math.sin(auto.heading);
  ctx.camera.position.set(
    auto.x - forwardX * dist + rightX * side,
    height,
    auto.z - forwardZ * dist + rightZ * side,
  );
  ctx.camera.lookAt(auto.x + forwardX * 14, lookY, auto.z + forwardZ * 14);
}

// Pin the police helicopter into the frame: over the road ahead of the
// player, high enough to read against the sky gap between the building rows.
// The v2 placement (28 ahead, 22 to the side) put it behind the Downtown
// towers — occluded, and dark navy on a red sky besides. Now it sits nearly
// centred over the road, white against the sunset.
function frameHeli(ctx, ahead, side, alt) {
  const heli = ctx.world.police.heli;
  if (!heli) return;
  const auto = ctx.player.car;
  const forwardX = Math.sin(auto.heading);
  const forwardZ = Math.cos(auto.heading);
  const rightX = Math.cos(auto.heading);
  const rightZ = -Math.sin(auto.heading);
  const hx = auto.x + forwardX * ahead + rightX * side;
  const hz = auto.z + forwardZ * ahead + rightZ * side;
  heli.mesh.position.set(hx, alt, hz);
  heli.mesh.rotation.y = Math.atan2(auto.x - hx, auto.z - hz);
  // Fit the searchlight beam to the staged altitude — narrow at the heli,
  // wide at the ground, exactly reaching the road (the v2 cone was upside
  // down and 42 long at 18 altitude, a lampshade over the whole frame).
  const cone = heli.mesh.userData.cone;
  if (cone) {
    cone.scale.set(0.55, alt / 42, 0.55);
    cone.position.y = -alt / 2;
  }
  const spot = heli.mesh.userData.spot;
  if (spot) {
    spot.scale.setScalar(0.6);
    spot.position.set(0, -(alt - 0.5), 0);
  }
}

// Mara's muzzle world position, for staged flashes.
function muzzlePos(ctx) {
  const out = new THREE.Vector3();
  if (ctx.player.muzzle) ctx.player.muzzle.getWorldPosition(out);
  else out.set(ctx.player.x, 1.4, ctx.player.z);
  return out;
}

// --- staged traffic tables --------------------------------------------------
// The chase traffic: westbound lane moving away, eastbound lane head-on, a
// bus far ahead — nothing behind the camera.
const CHASE_CARS = [
  { type: 'sedan', color: 0x3a6a9a, x: 10, z: -2.2, heading: -Math.PI / 2, speed: 11 },
  { type: 'taxi', color: 0xffd23e, x: -15, z: -2.2, heading: -Math.PI / 2, speed: 10 },
  { type: 'van', color: 0x8a8a8a, x: -40, z: -2.2, heading: -Math.PI / 2, speed: 9 },
  { type: 'bus', color: 0xf0ead8, x: -58, z: -2.2, heading: -Math.PI / 2, speed: 9 },
  { type: 'sedan', color: 0xd83a2e, x: 20, z: 2.2, heading: Math.PI / 2, speed: 12 },
  { type: 'sports', color: 0x37b6ff, x: -8, z: 2.2, heading: Math.PI / 2, speed: 13 },
  { type: 'sedan', color: 0x7a9a3a, x: -32, z: 2.2, heading: Math.PI / 2, speed: 11 },
  { type: 'truck', color: 0x9a7a3a, x: 55, z: 40, heading: Math.PI, speed: 10 },
];

// The marina traffic: northbound lane head-on, southbound lane moving away,
// a bus far ahead — the road behind the camera stays clear so the shot is
// never a bus roof.
const MARINA_CARS = [
  { type: 'sedan', color: 0xd83a2e, x: -162.2, z: 100, heading: Math.PI, speed: 11 },
  { type: 'taxi', color: 0xffd23e, x: -162.2, z: 130, heading: Math.PI, speed: 12 },
  { type: 'sports', color: 0xe8232e, x: -162.2, z: 160, heading: Math.PI, speed: 13 },
  { type: 'bus', color: 0x37b6ff, x: -162.2, z: 185, heading: Math.PI, speed: 9 },
  { type: 'sedan', color: 0x7a9a3a, x: -157.8, z: 125, heading: 0, speed: 10 },
  { type: 'van', color: 0x8a8a8a, x: -157.8, z: 155, heading: 0, speed: 9 },
  { type: 'truck', color: 0x9a7a3a, x: -120, z: 120, heading: Math.PI / 2, speed: 10 },
  { type: 'sedan', color: 0x3a6a9a, x: -120, z: 160, heading: -Math.PI / 2, speed: 11 },
];

const CHASE_COPS = [
  [10, -5, -Math.PI / 2],
  [-2, 5, -Math.PI / 2],
  [38, 0, -Math.PI / 2],
];

// --- the four shots ---------------------------------------------------------
const SHOTS = {
  chase(ctx) {
    ctx.missions.startMission(6); // Marina Getaway (mission 7), wanted 4
    ctx.player.addWanted(1); // -> 5 stars
    // West down the z=0 avenue through Downtown into the sunset: buildings
    // on BOTH sides, neon, traffic and police ahead where the car will be
    // when the shutter fires (~95 units west of the start).
    const auto = stagePlayerCar(ctx, 'sports', 0xe8232e, 120, 0, -Math.PI / 2);
    auto.speed = 38;
    stageTraffic(ctx, CHASE_CARS);
    stagePolice(ctx, CHASE_COPS);
    ctx.world.peds.spawn(16, { x: 40, z: 0 });
    ctx.input = { throttle: 1, steer: 0, brake: false };
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => {
      // Dead-centre behind the car, higher and further back than v2's first
      // pass: a side offset put a glass building face right against the lens.
      chaseCam(ctx, 0, 4.6, 11, 4);
      // Helicopter over the road, in the sky gap — unmistakable.
      frameHeli(ctx, 26, -3, 16);
    };
    ctx.hud.setObjective('MISSION 7 — MARINA GETAWAY: outrun the 5-star chase');
  },

  foot(ctx) {
    ctx.missions.startMission(1); // Hot Wheels (mission 2): steal a car
    ctx.player.addWanted(1);
    stagePlayer(ctx, -157, 34, Math.PI * 0.75);
    stageParkedCar(ctx, 'sports', 0xe8232e, -160, 30, Math.PI);
    ctx.world.peds.spawnDriver(-164, 26, Math.PI * 0.5);
    ctx.world.traffic.spawn(10, { x: -160, z: 30 });
    ctx.world.peds.spawn(14, { x: -160, z: 30 });
    // Mara's pistol is already in her right hand; stage a persistent muzzle
    // flash toward the fleeing driver so the weapon reads in the still.
    const tip = muzzlePos(ctx);
    ctx.combat.stageFlash(tip, { x: -164, y: 1.2, z: 26 });
    ctx.input = null;
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => {
      // Close 3/4 view: Mara beside the red Comet, driver fleeing, sunset behind.
      ctx.camera.position.set(-150, 2.4, 41);
      ctx.camera.lookAt(-159, 1.2, 31);
    };
    ctx.hud.setObjective('MISSION 2 — HOT WHEELS: steal the red Comet (E)');
  },

  marina(ctx) {
    ctx.missions.startMission(0); // First Fare (mission 1)
    ctx.player.addWanted(1);
    // South down the Strip so the Coral Wheel and the boats are big in frame
    // ahead of the car when the shutter fires.
    const auto = stagePlayerCar(ctx, 'sports', 0x37b6ff, -160, 60, 0);
    auto.speed = 30;
    stageTraffic(ctx, MARINA_CARS);
    ctx.world.peds.spawn(16, { x: -160, z: 100 });
    ctx.input = { throttle: 1, steer: 0, brake: false };
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => chaseCam(ctx, 3, 4.2, 10, 4);
    ctx.hud.setObjective('MISSION 1 — FIRST FARE: drive to the Marina');
  },

  mission(ctx) {
    ctx.missions.startMission(4); // Loud Night (mission 5): shootout at the Docks
    ctx.player.addWanted(1);
    // Mara faces south toward the rivals at (0, 160); rifle equipped so the
    // viewmodel fills the bottom-right of the frame.
    ctx.arsenal.owned.add('rifle');
    ctx.arsenal.select('rifle');
    ctx.player.setWeapon('rifle');
    ctx.viewmodel.setWeapon('rifle');
    ctx.viewmodel.fire();
    stagePlayer(ctx, 2, 138, 0);
    // One rival already down, the rest up — the fight is mid-way.
    const first = ctx.missions.hostiles[0];
    if (first) {
      first.dead = true;
      first.mesh.rotation.x = Math.PI / 2;
      first.mesh.position.y = 0.3;
      ctx.missions.active.killed = 1;
    }
    // Stage a persistent muzzle flash + tracer from Mara toward a rival.
    const tip = muzzlePos(ctx);
    const rival = ctx.missions.hostiles.find((h) => !h.dead);
    if (rival) ctx.combat.stageFlash(tip, { x: rival.x, y: 1.3, z: rival.z }, 1.4);
    // The beacon would block the fight — hide it for this still.
    ctx.missions.beacon.visible = false;
    // Police car closing in from behind the fight, on the same road.
    stagePolice(ctx, [[0, 172, Math.PI]]);
    ctx.world.traffic.spawn(8, { x: 0, z: 140 });
    ctx.world.peds.spawn(12, { x: 0, z: 140 });
    ctx.input = null;
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => {
      // Over Mara's shoulder: her, the rivals ahead, the police car closing in.
      ctx.camera.position.set(2, 3.0, 128);
      ctx.camera.lookAt(2, 1.3, 165);
      // Re-fire the viewmodel flash every frame — a one-off flash fired at
      // staging is long gone by the shutter, which is why v2's rifle had no
      // flash and read as a dark blob.
      ctx.viewmodel.fire();
    };
    ctx.hud.setObjective('MISSION 5 — LOUD NIGHT: 1/4 rivals down');
  },
};

export function applyShot(name, ctx) {
  const shot = SHOTS[name];
  if (!shot) return false;
  shot(ctx);
  return true;
}

export const SHOT_NAMES = Object.keys(SHOTS);
