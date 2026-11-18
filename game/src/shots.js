// Screenshot staging for CORAL HEAT v2.6.
// A screenshot URL (?shot=<name>&seed=<n>) drops the game into a composed,
// fully-playing scene and drives a cinematic camera, so every screenshot is
// a real render of the game's own code — never edited or faked. v2.6 is a
// from-scratch rewrite of v2.5's shots.js: same four staged scenes, same
// cameras, same counts, different code. The four scenes are registered in
// SCENE_BUILDERS below; each one is a plain function that arranges the
// world, then installs a per-frame cinematic camera callback.
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

// --- placement helpers ------------------------------------------------------
// One car record, shared by every placement helper: mesh + sim state.
function dealCar(ctx, type, color, x, z, heading) {
  const mesh = buildCarMesh(type, color);
  ctx.world.scene.add(mesh);
  const car = {
    mesh,
    type,
    x,
    z,
    heading,
    speed: 0,
    maxSpeed: type === 'sports' ? 55 : 42,
    accel: 26,
    crashed: false,
    dead: false,
  };
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return car;
}

// Hand Mara a fresh car and put her in it.
function dealPlayerCar(ctx, type, color, x, z, heading) {
  const car = dealCar(ctx, type, color, x, z, heading);
  ctx.player.enterCar(car);
  ctx.world.playerCars.push(car);
  return car;
}

// Park a car in the world with nobody driving it — a staged prop, or a car
// Mara is about to steal.
function dealParkedCar(ctx, type, color, x, z, heading) {
  const car = dealCar(ctx, type, color, x, z, heading);
  ctx.world.playerCars.push(car);
  return car;
}

// Stand Mara at a spot, facing a heading — mesh and state together.
function dealPlayer(ctx, x, z, heading) {
  ctx.player.x = x;
  ctx.player.z = z;
  ctx.player.heading = heading;
  ctx.player.mesh.position.set(x, 0, z);
  ctx.player.mesh.rotation.y = heading;
}

// Place police cars at exact spots. They are spawned near the player first
// (so the police system owns them) and then moved to their marks.
function dealPolice(ctx, marks) {
  for (const mark of marks) {
    const [x, z, heading] = mark;
    const car = ctx.world.police.spawnCarNear(ctx.player.pos.x, ctx.player.pos.z);
    car.x = x;
    car.z = z;
    car.heading = heading;
    car.speed = 30;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
  }
}

// Place traffic cars by hand for a shot: Traffic.spawn scatters cars across
// the whole city, so a bus can land right behind the player car and fill the
// cinematic camera. Staged cars sit only AHEAD of the player, in the lanes
// the camera actually sees. Each spec is an object: { type, color, x, z,
// heading, speed }.
function dealTraffic(ctx, specs) {
  for (const spec of specs) {
    const mesh = buildCarMesh(spec.type, spec.color);
    ctx.world.scene.add(mesh);
    const car = {
      mesh,
      type: spec.type,
      x: spec.x,
      z: spec.z,
      heading: spec.heading,
      speed: spec.speed ?? 10,
      maxSpeed: 14,
      accel: 8,
      crashed: false,
      dead: false,
    };
    mesh.position.set(spec.x, 0, spec.z);
    mesh.rotation.y = spec.heading;
    ctx.world.traffic.cars.push(car);
  }
}

// Chase camera behind the player car, low and slightly to the right so the
// car, the road ahead and the police behind all read in one frame.
function followCam(ctx, side, height, dist, lookY = 2.2) {
  const car = ctx.player.car;
  const fwdX = Math.sin(car.heading);
  const fwdZ = Math.cos(car.heading);
  const rgtX = Math.cos(car.heading);
  const rgtZ = -Math.sin(car.heading);
  ctx.camera.position.set(
    car.x - fwdX * dist + rgtX * side,
    height,
    car.z - fwdZ * dist + rgtZ * side,
  );
  ctx.camera.lookAt(car.x + fwdX * 14, lookY, car.z + fwdZ * 14);
}

// Pin the police helicopter into the frame: over the road ahead of the
// player, high enough to read against the sky gap between the building rows.
// The v2 placement (28 ahead, 22 to the side) put it behind the Downtown
// towers — occluded, and dark navy on a red sky besides. Now it sits nearly
// centred over the road, white against the sunset.
function heliFrame(ctx, ahead, side, alt) {
  const heli = ctx.world.police.heli;
  if (!heli) return;
  const car = ctx.player.car;
  const fwdX = Math.sin(car.heading);
  const fwdZ = Math.cos(car.heading);
  const rgtX = Math.cos(car.heading);
  const rgtZ = -Math.sin(car.heading);
  const hx = car.x + fwdX * ahead + rgtX * side;
  const hz = car.z + fwdZ * ahead + rgtZ * side;
  heli.mesh.position.set(hx, alt, hz);
  heli.mesh.rotation.y = Math.atan2(car.x - hx, car.z - hz);
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
function muzzleSpot(ctx) {
  const out = new THREE.Vector3();
  if (ctx.player.muzzle) ctx.player.muzzle.getWorldPosition(out);
  else out.set(ctx.player.x, 1.4, ctx.player.z);
  return out;
}

// --- staged traffic tables --------------------------------------------------
// The chase traffic: westbound lane moving away, eastbound lane head-on, a
// bus far ahead — nothing behind the camera.
const CHASE_CARS = [
  {
    type: 'sedan',
    color: 0x3a6a9a,
    x: 10,
    z: -2.2,
    heading: -Math.PI / 2,
    speed: 11,
  },
  {
    type: 'taxi',
    color: 0xffd23e,
    x: -15,
    z: -2.2,
    heading: -Math.PI / 2,
    speed: 10,
  },
  {
    type: 'van',
    color: 0x8a8a8a,
    x: -40,
    z: -2.2,
    heading: -Math.PI / 2,
    speed: 9,
  },
  {
    type: 'bus',
    color: 0xf0ead8,
    x: -58,
    z: -2.2,
    heading: -Math.PI / 2,
    speed: 9,
  },
  {
    type: 'sedan',
    color: 0xd83a2e,
    x: 20,
    z: 2.2,
    heading: Math.PI / 2,
    speed: 12,
  },
  {
    type: 'sports',
    color: 0x37b6ff,
    x: -8,
    z: 2.2,
    heading: Math.PI / 2,
    speed: 13,
  },
  {
    type: 'sedan',
    color: 0x7a9a3a,
    x: -32,
    z: 2.2,
    heading: Math.PI / 2,
    speed: 11,
  },
  {
    type: 'truck',
    color: 0x9a7a3a,
    x: 55,
    z: 40,
    heading: Math.PI,
    speed: 10,
  },
];

// The marina traffic: northbound lane head-on, southbound lane moving away,
// a bus far ahead — the road behind the camera stays clear so the shot is
// never a bus roof.
const MARINA_CARS = [
  {
    type: 'sedan',
    color: 0xd83a2e,
    x: -162.2,
    z: 100,
    heading: Math.PI,
    speed: 11,
  },
  {
    type: 'taxi',
    color: 0xffd23e,
    x: -162.2,
    z: 130,
    heading: Math.PI,
    speed: 12,
  },
  {
    type: 'sports',
    color: 0xe8232e,
    x: -162.2,
    z: 160,
    heading: Math.PI,
    speed: 13,
  },
  {
    type: 'bus',
    color: 0x37b6ff,
    x: -162.2,
    z: 185,
    heading: Math.PI,
    speed: 9,
  },
  {
    type: 'sedan',
    color: 0x7a9a3a,
    x: -157.8,
    z: 125,
    heading: 0,
    speed: 10,
  },
  {
    type: 'van',
    color: 0x8a8a8a,
    x: -157.8,
    z: 155,
    heading: 0,
    speed: 9,
  },
  {
    type: 'truck',
    color: 0x9a7a3a,
    x: -120,
    z: 120,
    heading: Math.PI / 2,
    speed: 10,
  },
  {
    type: 'sedan',
    color: 0x3a6a9a,
    x: -120,
    z: 160,
    heading: -Math.PI / 2,
    speed: 11,
  },
];

const CHASE_COPS = [
  [10, -5, -Math.PI / 2],
  [-2, 5, -Math.PI / 2],
  [38, 0, -Math.PI / 2],
];

// --- the four scenes --------------------------------------------------------
function buildChase(ctx) {
  ctx.missions.startMission(6); // Marina Getaway (mission 7), wanted 4
  ctx.player.addWanted(1); // -> 5 stars
  // West down the z=0 avenue through Downtown into the sunset: buildings
  // on BOTH sides, neon, traffic and police ahead where the car will be
  // when the shutter fires (~95 units west of the start).
  const car = dealPlayerCar(ctx, 'sports', 0xe8232e, 120, 0, -Math.PI / 2);
  car.speed = 38;
  dealTraffic(ctx, CHASE_CARS);
  dealPolice(ctx, CHASE_COPS);
  ctx.world.peds.spawn(16, { x: 40, z: 0 });
  ctx.input = { throttle: 1, steer: 0, brake: false };
  ctx.cameraMode = 'cinematic';
  ctx.cinematic = () => {
    // Dead-centre behind the car, higher and further back than v2's first
    // pass: a side offset put a glass building face right against the lens.
    followCam(ctx, 0, 4.6, 11, 4);
    // Helicopter over the road, in the sky gap — unmistakable.
    heliFrame(ctx, 26, -3, 16);
  };
  ctx.hud.setObjective('MISSION 7 — MARINA GETAWAY: outrun the 5-star chase');
}

function buildFoot(ctx) {
  ctx.missions.startMission(1); // Hot Wheels (mission 2): steal a car
  ctx.player.addWanted(1);
  dealPlayer(ctx, -157, 34, Math.PI * 0.75);
  dealParkedCar(ctx, 'sports', 0xe8232e, -160, 30, Math.PI);
  ctx.world.peds.spawnDriver(-164, 26, Math.PI * 0.5);
  ctx.world.traffic.spawn(10, { x: -160, z: 30 });
  ctx.world.peds.spawn(14, { x: -160, z: 30 });
  // Mara's pistol is already in her right hand; stage a persistent muzzle
  // flash toward the fleeing driver so the weapon reads in the still.
  const muzzle = muzzleSpot(ctx);
  ctx.combat.stageFlash(muzzle, { x: -164, y: 1.2, z: 26 });
  ctx.input = null;
  ctx.cameraMode = 'cinematic';
  ctx.cinematic = () => {
    // Close 3/4 view: Mara beside the red Comet, driver fleeing, sunset behind.
    ctx.camera.position.set(-150, 2.4, 41);
    ctx.camera.lookAt(-159, 1.2, 31);
  };
  ctx.hud.setObjective('MISSION 2 — HOT WHEELS: steal the red Comet (E)');
}

function buildMarina(ctx) {
  ctx.missions.startMission(0); // First Fare (mission 1)
  ctx.player.addWanted(1);
  // South down the Strip so the Coral Wheel and the boats are big in frame
  // ahead of the car when the shutter fires.
  const car = dealPlayerCar(ctx, 'sports', 0x37b6ff, -160, 60, 0);
  car.speed = 30;
  dealTraffic(ctx, MARINA_CARS);
  ctx.world.peds.spawn(16, { x: -160, z: 100 });
  ctx.input = { throttle: 1, steer: 0, brake: false };
  ctx.cameraMode = 'cinematic';
  ctx.cinematic = () => followCam(ctx, 3, 4.2, 10, 4);
  ctx.hud.setObjective('MISSION 1 — FIRST FARE: drive to the Marina');
}

function buildMission(ctx) {
  ctx.missions.startMission(4); // Loud Night (mission 5): shootout at the Docks
  ctx.player.addWanted(1);
  // Mara faces south toward the rivals at (0, 160); rifle equipped so the
  // viewmodel fills the bottom-right of the frame.
  ctx.arsenal.owned.add('rifle');
  ctx.arsenal.select('rifle');
  ctx.player.setWeapon('rifle');
  ctx.viewmodel.setWeapon('rifle');
  ctx.viewmodel.fire();
  dealPlayer(ctx, 2, 138, 0);
  // One rival already down, the rest up — the fight is mid-way.
  const first = ctx.missions.hostiles[0];
  if (first) {
    first.dead = true;
    first.mesh.rotation.x = Math.PI / 2;
    first.mesh.position.y = 0.3;
    ctx.missions.active.killed = 1;
  }
  // Stage a persistent muzzle flash + tracer from Mara toward a rival.
  const muzzle = muzzleSpot(ctx);
  const rival = ctx.missions.hostiles.find((h) => !h.dead);
  if (rival) ctx.combat.stageFlash(muzzle, { x: rival.x, y: 1.3, z: rival.z }, 1.4);
  // The beacon would block the fight — hide it for this still.
  ctx.missions.beacon.visible = false;
  // Police car closing in from behind the fight, on the same road.
  dealPolice(ctx, [[0, 172, Math.PI]]);
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
}

const SCENE_BUILDERS = {
  chase: buildChase,
  foot: buildFoot,
  marina: buildMarina,
  mission: buildMission,
};

export function applyShot(name, ctx) {
  const builder = SCENE_BUILDERS[name];
  if (!builder) return false;
  builder(ctx);
  return true;
}

export const SHOT_NAMES = Object.keys(SCENE_BUILDERS);
