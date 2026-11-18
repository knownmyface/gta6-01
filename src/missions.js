// The story of CORAL HEAT v2.6: 12 missions for Mara Voss, from her first
// fare for Dutch Calloway to the last run out of Coral Bay. v2.6 rewrites
// v2.5's missions.js from scratch: the same twelve missions, the same
// rewards, the same rules, the same seeded hostile deal, written as new
// code. The mission table is gameplay data — every target, checkpoint,
// pickup, timer and reward is unchanged — but it is laid out one field per
// line now, and the manager runs each mission type through a rule table
// instead of one long switch, so each mission type reads as its own rule.
import * as THREE from 'three';
import { createRng, pick, pickN, range } from './rng.js';
import { buildCarMesh, driveCar } from './vehicles.js';
import { buildGunMesh } from './weapons.js';

// Mission table. Types: drive / steal / checkpoints / collect / shoot /
// escape / chase / timed / roadblock / tail. Each row is one mission with
// its id, title, giver, type, brief, objective, target/checkpoints/
// pickups, and reward. The values are the v2.5 ones, unchanged.
export const MISSIONS = [
  {
    id: 1, title: 'First Fare', giver: 'Dutch Calloway', type: 'drive',
    brief: 'Dutch needs a package run to the Marina. Get in a car and follow the gold marker.',
    objective: 'Drive to the gold marker at the Marina',
    target: { x: -160, z: 160 }, reward: 400,
  },
  {
    id: 2, title: 'Hot Wheels', giver: 'Dutch Calloway', type: 'steal',
    brief: 'The client wants wheels, not words. Steal any car on the Strip and bring it to the garage on Palm Heights.',
    objective: 'Steal a car (E) then deliver it to the garage',
    target: { x: 120, z: -120 }, reward: 700,
  },
  {
    id: 3, title: 'The Long Way', giver: 'Sister Ana', type: 'checkpoints',
    brief: 'Ana is testing your nerve. Hit all three checkpoints across town, then finish at Downtown.',
    objective: 'Hit 3 checkpoints, then reach Downtown',
    target: { x: 0, z: 80 },
    checkpoints: [{ x: -120, z: -120 }, { x: 120, z: 40 }, { x: -40, z: 120 }],
    reward: 900,
  },
  {
    id: 4, title: 'Paper Trail', giver: 'Dutch Calloway', type: 'collect',
    brief: 'Three drops hidden around Old Town. On foot, quiet, no heat. Grab them all.',
    objective: 'Collect 3 packages on foot in Old Town',
    pickups: [{ x: -80, z: -120 }, { x: -40, z: -80 }, { x: -120, z: -40 }],
    reward: 1000,
  },
  {
    id: 5, title: 'Loud Night', giver: 'Reyes', type: 'shoot',
    brief: "Reyes' crew is leaning on the Docks. Four of them. Make it loud, make it count.",
    objective: 'Take down 4 rivals at the Docks',
    target: { x: 0, z: 160 }, count: 4, reward: 1400,
  },
  {
    id: 6, title: 'Heat Wave', giver: 'Dutch Calloway', type: 'escape',
    brief: 'The heat is on you — 3 stars and climbing. Lose them, then get to Sunset Point in one piece.',
    objective: 'Survive the heat, then reach Sunset Point',
    target: { x: -160, z: 120 }, wanted: 3, survive: 40, reward: 1600,
  },
  {
    id: 7, title: 'Marina Getaway', giver: 'Sister Ana', type: 'chase',
    brief: "Ana's boat money is in the trunk and the whole Coral Bay Police is awake. Helicopter and all. Run the Strip.",
    objective: 'Outrun the 4-star chase: hit 3 Strip checkpoints',
    checkpoints: [{ x: -160, z: 80 }, { x: -160, z: -40 }, { x: -160, z: -160 }],
    target: { x: -160, z: -160 }, wanted: 4, reward: 2000,
  },
  {
    id: 8, title: "The Broker's Debt", giver: 'The Broker', type: 'timed',
    brief: 'The Broker does not wait. Cross town to Palm Heights before the clock dies. Drive like it matters.',
    objective: 'Reach Palm Heights before the timer ends',
    target: { x: 160, z: -160 }, timeLimit: 75, reward: 2200,
  },
  {
    id: 9, title: 'Blockade Runner', giver: 'Reyes', type: 'roadblock',
    brief: 'Roadblocks on every artery and a 4-star tail. Punch through the blockade and reach Old Town.',
    objective: 'Break through the roadblocks to Old Town',
    target: { x: -80, z: -120 }, wanted: 4, reward: 2500,
  },
  {
    id: 10, title: 'Silent Docks', giver: 'Dutch Calloway', type: 'collect',
    brief: 'Four crates on the Docks, no questions. The night crew is paid to look away. Mostly.',
    objective: 'Collect 4 crates at the Docks',
    pickups: [{ x: -80, z: 160 }, { x: 40, z: 160 }, { x: 120, z: 120 }, { x: 0, z: 120 }],
    reward: 2800,
  },
  {
    id: 11, title: 'High Tide', giver: 'Sister Ana', type: 'tail',
    brief: "A rival runner is moving Ana's cargo down the Marina. Stay on his bumper — don't lose him, don't spook him.",
    objective: 'Tail the runner along the Marina for 6 seconds',
    target: { x: -120, z: 160 }, reward: 3200,
  },
  {
    id: 12, title: 'The Last Fare', giver: 'Mara Voss', type: 'escape',
    brief: 'One last run. Five stars, the helicopter, the whole city. Reach the Coral Wheel and disappear into the sunset.',
    objective: 'Escape at 5 stars — reach the Coral Wheel',
    target: { x: -196, z: 150 }, wanted: 5, survive: 30, reward: 5000,
  },
];


// Rival look: jacket colours dealt per hostile, shared skin and pants.
const JACKETS = [0x3a1a2a, 0x2a3a1a, 0x1a2a3a, 0x4a2a1a];
const FOE_SKIN = 0xc98a5a;
const FOE_PANTS = 0x222226;
const RING = 14;
const JITTER = 4;

// The tail car's loop around the Marina.
const LOOP = [
  { x: -120, z: 160 },
  { x: 40, z: 160 },
  { x: 40, z: 120 },
  { x: -120, z: 120 },
];

// How close the player must be to count as "there".
const REACH = 6;
const CP_RADIUS = 7;
const GRAB_RADIUS = 3.2;

// One armed rival: jacket body, head, a real rifle in hand, legs, and a
// red health bar overhead. No dice here — the deal happens in spawnHostiles.
function makeRival(jacket) {
  const grp = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.1, 0.4),
    new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.9 }),
  );
  torso.position.y = 1.0;
  grp.add(torso);
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color: FOE_SKIN, roughness: 0.8 }),
  );
  skull.position.y = 1.75;
  grp.add(skull);
  // A real rifle in their hands, not a box — you can see what you are up against.
  const rifle = buildGunMesh('rifle');
  rifle.group.position.set(0.28, 1.15, 0.3);
  grp.add(rifle.group);
  for (const s of [-1, 1]) {
    const shin = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.72, 0.26),
      new THREE.MeshStandardMaterial({ color: FOE_PANTS, roughness: 0.9 }),
    );
    shin.position.set(s * 0.16, 0.36, 0);
    grp.add(shin);
  }
  const hp = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.12, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff2020 }),
  );
  hp.position.y = 2.15;
  grp.add(hp);
  return { group: grp, hpMesh: hp };
}

export class MissionManager {
  constructor(scene, rng, beacon, hooks) {
    this.scene = scene;
    this.rng = rng;
    this.beacon = beacon;
    // Hooks: { onToast, onObjective, onComplete, onFail, onMissionStart, setWanted }
    this.hooks = hooks;
    this.index = 0; // 0-based into MISSIONS
    this.done = 0;
    this.earned = 0;
    this.active = null; // runtime state for the current mission
    this.pickupMeshes = [];
    this.hostiles = [];
    this.tailCar = null;
    this.allDone = false;
  }

  current() { return MISSIONS[this.index]; }

  startMission(i) {
    this.clearField();
    this.index = i;
    const spec = MISSIONS[i];
    // Runtime state, fresh per attempt. `progress` counts whatever the
    // mission type tracks (checkpoints hit, packages taken, rivals down).
    this.active = {
      def: spec,
      progress: 0,
      collected: 0,
      killed: 0,
      timer: spec.timeLimit ?? 0,
      surviveLeft: spec.survive ?? 0,
      tailTime: 0,
      escaped: false,
      stolen: false,
    };
    this.moveBeacon(this.missionTarget());
    this.beacon.visible = true;
    if (spec.type === 'collect') this.spawnPickups(spec.pickups);
    if (spec.type === 'shoot') this.spawnHostiles(spec.count, spec.target);
    if (spec.type === 'tail') this.spawnTailCar(spec.target);
    if (spec.wanted) this.hooks.setWanted(spec.wanted);
    this.hooks.onObjective(spec.objective);
    this.hooks.onMissionStart(spec);
    this.hooks.onToast(`MISSION ${spec.id} — ${spec.title}`, `${spec.giver}: ${spec.brief}`);
  }

  moveBeacon(point) {
    this.beacon.position.set(point.x, 0, point.z);
  }

  missionTarget() {
    const spec = this.active.def;
    if (spec.checkpoints) return spec.checkpoints[this.active.progress];
    return spec.target;
  }

  spawnPickups(points) {
    const geo = new THREE.BoxGeometry(1.4, 1.0, 1.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0x8a6a00, roughness: 0.5 });
    for (const spot of points) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spot.x, 0.7, spot.z);
      this.scene.add(mesh);
      this.pickupMeshes.push({ mesh, x: spot.x, z: spot.z, taken: false });
    }
  }

  spawnHostiles(n, center) {
    // Armed rivals: varied jackets, they stand their ground and shoot back.
    // The deal order is the contract: jackets first (one draw each via
    // pickN), then per hostile the x jitter, the z jitter and the shoot
    // timer — exactly as v2.5 dealt it.
    const jackets = pickN(this.rng, JACKETS, n);
    for (let i = 0; i < n; i++) {
      const { group, hpMesh } = makeRival(jackets[i]);
      const angle = (i / n) * Math.PI * 2;
      const x = center.x + Math.sin(angle) * RING + range(this.rng, -JITTER, JITTER);
      const z = center.z + Math.cos(angle) * RING + range(this.rng, -JITTER, JITTER);
      group.position.set(x, 0, z);
      this.scene.add(group);
      this.hostiles.push({
        mesh: group, hpMesh, x, z,
        health: 3, shootTimer: 1 + this.rng(), dead: false,
      });
    }
  }

  spawnTailCar(target) {
    // A fleeing runner car that loops the Marina roads.
    const mesh = buildCarMesh('sports', 0x8a2be2);
    mesh.position.set(target.x, 0, target.z);
    this.scene.add(mesh);
    this.tailCar = {
      mesh, x: target.x, z: target.z,
      heading: Math.PI, speed: 16, maxSpeed: 18, accel: 10,
      crashed: false, dead: false,
    };
  }

  clearField() {
    for (const entry of this.pickupMeshes) this.scene.remove(entry.mesh);
    this.pickupMeshes = [];
    for (const foe of this.hostiles) this.scene.remove(foe.mesh);
    this.hostiles = [];
    if (this.tailCar) {
      this.scene.remove(this.tailCar.mesh);
      this.tailCar = null;
    }
  }

  complete(player) {
    const spec = this.active.def;
    player.cash += spec.reward;
    this.done += 1;
    this.earned += spec.reward;
    this.hooks.onComplete(spec, player.cash);
    this.clearField();
    this.beacon.visible = false;
    this.active = null;
    if (this.index + 1 >= MISSIONS.length) {
      this.allDone = true;
      this.hooks.onToast('ALL 12 MISSIONS DONE', 'Coral Bay is yours, Mara. The sunset is the only thing left to chase.');
      this.hooks.onObjective('Story complete — free roam Coral Bay');
    } else {
      this.startMission(this.index + 1);
    }
  }

  fail(reason) {
    this.hooks.onFail(reason);
    // Restart the same mission.
    this.startMission(this.index);
  }

  // Distance check from the player's position to a point.
  closeTo(playerPos, point, radius = REACH) {
    return Math.hypot(playerPos.x - point.x, playerPos.z - point.z) < radius;
  }

  // --- per-type rules, one handler each. Returns true if the mission ended.
  ruleDrive(ctx) {
    if (this.closeTo(ctx, this.active.def.target)) {
      this.complete(ctx.player);
      return true;
    }
    return false;
  }

  ruleSteal(ctx) {
    const state = this.active;
    if (ctx.player.inCar && !state.stolen) {
      state.stolen = true;
      this.hooks.onObjective('Stolen! Now deliver it to the garage');
    }
    if (state.stolen && this.closeTo(ctx, state.def.target)) {
      this.complete(ctx.player);
      return true;
    }
    return false;
  }

  ruleCheckpoints(ctx, chase) {
    const state = this.active;
    const spec = state.def;
    const cp = spec.checkpoints[state.progress];
    if (!this.closeTo(ctx, cp, CP_RADIUS)) return false;
    state.progress += 1;
    const line = chase ? 'Keep running — they are right behind you!' : 'Checkpoint clear.';
    this.hooks.onToast(`CHECKPOINT ${state.progress}/${spec.checkpoints.length}`, line);
    if (state.progress >= spec.checkpoints.length) {
      if (this.closeTo(ctx, spec.target, 8)) {
        this.complete(ctx.player);
        return true;
      }
      this.moveBeacon(spec.target);
      this.hooks.onObjective('Final stretch — reach the marker');
    } else {
      this.moveBeacon(spec.checkpoints[state.progress]);
    }
    return false;
  }

  ruleCollect(ctx) {
    const state = this.active;
    const spec = state.def;
    for (const entry of this.pickupMeshes) {
      if (entry.taken || !this.closeTo(ctx, entry, GRAB_RADIUS)) continue;
      entry.taken = true;
      this.scene.remove(entry.mesh);
      state.collected += 1;
      this.hooks.onToast(`PACKAGE ${state.collected}/${spec.pickups.length}`, 'Picked up. Keep moving.');
      if (state.collected >= spec.pickups.length) {
        this.complete(ctx.player);
        return true;
      }
    }
    this.hooks.onObjective(`${spec.objective} — ${state.collected}/${spec.pickups.length}`);
    return false;
  }

  ruleShoot(player) {
    const state = this.active;
    const spec = state.def;
    this.hooks.onObjective(`${spec.objective} — ${state.killed}/${spec.count} down`);
    if (state.killed >= spec.count) {
      this.complete(player);
      return true;
    }
    return false;
  }

  ruleEscape(ctx, dt) {
    const state = this.active;
    const spec = state.def;
    if (state.surviveLeft > 0) {
      state.surviveLeft -= dt;
      this.hooks.onObjective(`${spec.objective} — hold on ${Math.ceil(state.surviveLeft)}s`);
      if (state.surviveLeft <= 0) {
        state.escaped = true;
        this.moveBeacon(spec.target);
        this.hooks.onObjective('Heat cooling — reach the marker now!');
      }
    } else if (this.closeTo(ctx, spec.target)) {
      this.complete(ctx.player);
      return true;
    }
    return false;
  }

  // Rule table: mission type → handler. drive/timed/roadblock all just
  // need the player to reach the target; chase reuses the checkpoint rule
  // with the chase line.
  rulesFor(type) {
    return {
      drive: (ctx) => this.ruleDrive(ctx),
      timed: (ctx) => this.ruleDrive(ctx),
      roadblock: (ctx) => this.ruleDrive(ctx),
      steal: (ctx) => this.ruleSteal(ctx),
      checkpoints: (ctx) => this.ruleCheckpoints(ctx, false),
      chase: (ctx) => this.ruleCheckpoints(ctx, true),
      collect: (ctx) => this.ruleCollect(ctx),
      shoot: (ctx, dt, player) => this.ruleShoot(player),
      escape: (ctx, dt) => this.ruleEscape(ctx, dt),
      tail: (ctx, dt, player, world) => this.updateTail(dt, player, world),
    }[type];
  }

  update(dt, player, world) {
    if (!this.active || this.allDone) return;
    const state = this.active;
    const spec = state.def;
    const pos = player.pos;

    // Timers tick before the type rule runs.
    if (spec.timeLimit) {
      state.timer -= dt;
      this.hooks.onObjective(`${spec.objective} — ${Math.max(0, Math.ceil(state.timer))}s left`);
      if (state.timer <= 0) {
        this.fail('Out of time — the Broker does not wait.');
        return;
      }
    }

    const ctx = { ...pos, player };
    const rule = this.rulesFor(spec.type);
    const ended = rule ? rule(ctx, dt, player, world) : false;
    if (ended) return;

    // Spin the beacon arrow + bob the pickups.
    if (this.beacon.visible) this.beacon.children[2].rotation.y += dt * 2;
    for (const entry of this.pickupMeshes) {
      if (!entry.taken) entry.mesh.rotation.y += dt * 1.5;
    }
  }

  // Drive the runner car around its Marina loop: steer toward the current
  // waypoint, advance to the next one when it arrives. The heading is
  // computed from the waypoint captured before the advance, so the car
  // steers at the waypoint it just reached for one frame — as v2.5 did.
  driveTailCar(dt, world) {
    const car = this.tailCar;
    const wp = LOOP[car.wp ?? 0];
    if (Math.hypot(car.x - wp.x, car.z - wp.z) < 8) {
      car.wp = ((car.wp ?? 0) + 1) % LOOP.length;
    }
    const targetHeading = Math.atan2(wp.x - car.x, wp.z - car.z);
    let steer = ((targetHeading - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    steer = Math.max(-1, Math.min(1, steer * 2));
    driveCar(car, dt, { throttle: 0.7, steer, brake: false }, world.colliders, world.traffic.cars);
    car.mesh.position.set(car.x, 0, car.z);
  }

  // The tail chase. Returns true when the mission ended (complete/fail).
  updateTail(dt, player, world) {
    const state = this.active;
    const spec = state.def;
    const pos = player.pos;
    const car = this.tailCar;
    const dist = Math.hypot(pos.x - car.x, pos.z - car.z);
    if (dist < 12) {
      state.tailTime += dt;
      this.hooks.onObjective(`Stay on his bumper — ${state.tailTime.toFixed(1)}s / 6s`);
      if (state.tailTime >= 6) {
        this.complete(player);
        return true;
      }
    } else {
      state.tailTime = Math.max(0, state.tailTime - dt * 0.5);
      this.hooks.onObjective(spec.objective);
      if (dist > 60) {
        this.fail('You lost the runner.');
        return true;
      }
    }
    // The tail car loops the Marina roads.
    this.driveTailCar(dt, world);
    return false;
  }

  serialize() {
    return { index: this.index, done: this.done, earned: this.earned };
  }

  restore(saved) {
    if (!saved) return;
    this.index = Math.min(saved.index ?? 0, MISSIONS.length - 1);
    this.done = saved.done ?? 0;
    this.earned = saved.earned ?? 0;
  }
}
