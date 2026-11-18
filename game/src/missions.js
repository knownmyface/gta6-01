// The story of CORAL HEAT v2.4: 12 missions for Mara Voss, from her first
// fare for Dutch Calloway to the last run out of Coral Bay. v2.4 rewrites
// v2.3's missions.js from scratch: the same twelve missions, the same
// rewards, the same rules, the same seeded hostile deal, different code.
// The mission table is gameplay data — every target, checkpoint, pickup,
// timer and reward is unchanged. The manager below is reorganised around a
// per-type handler table instead of one long if-chain, so each mission type
// reads as its own rule.
import * as THREE from 'three';
import { createRng, pick, pickN, range } from './rng.js';
import { buildCarMesh, driveCar } from './vehicles.js';
import { buildGunMesh } from './weapons.js';

// Mission table. Types: drive / steal / checkpoints / collect / shoot /
// escape / chase / timed / roadblock / tail.
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
const RIVAL_JACKETS = [0x3a1a2a, 0x2a3a1a, 0x1a2a3a, 0x4a2a1a];
const RIVAL_SKIN = 0xc98a5a;
const RIVAL_PANTS = 0x222226;
const HOSTILE_RING = 14;
const HOSTILE_JITTER = 4;

// The tail car's loop around the Marina.
const TAIL_LOOP = [
  { x: -120, z: 160 },
  { x: 40, z: 160 },
  { x: 40, z: 120 },
  { x: -120, z: 120 },
];

// How close the player must be to count as "there".
const REACH_RADIUS = 6;
const CHECKPOINT_RADIUS = 7;
const PICKUP_RADIUS = 3.2;

// One armed rival: jacket body, head, a real rifle in hand, legs, and a
// red health bar overhead. No rng here — the deal happens in spawnHostiles.
function buildRival(jacket) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.1, 0.4),
    new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.9 }),
  );
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color: RIVAL_SKIN, roughness: 0.8 }),
  );
  head.position.y = 1.75;
  g.add(head);
  // A real rifle in their hands, not a box — you can see what you are up against.
  const gun = buildGunMesh('rifle');
  gun.group.position.set(0.28, 1.15, 0.3);
  g.add(gun.group);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.72, 0.26),
      new THREE.MeshStandardMaterial({ color: RIVAL_PANTS, roughness: 0.9 }),
    );
    leg.position.set(s * 0.16, 0.36, 0);
    g.add(leg);
  }
  const hp = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.12, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff2020 }),
  );
  hp.position.y = 2.15;
  g.add(hp);
  return { group: g, hpMesh: hp };
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
    const m = MISSIONS[i];
    // Runtime state, fresh per attempt. `progress` counts whatever the
    // mission type tracks (checkpoints hit, packages taken, rivals down).
    this.active = {
      def: m,
      progress: 0,
      collected: 0,
      killed: 0,
      timer: m.timeLimit ?? 0,
      surviveLeft: m.survive ?? 0,
      tailTime: 0,
      escaped: false,
      stolen: false,
    };
    const first = this.missionTarget();
    this.moveBeacon(first);
    this.beacon.visible = true;
    if (m.type === 'collect') this.spawnPickups(m.pickups);
    if (m.type === 'shoot') this.spawnHostiles(m.count, m.target);
    if (m.type === 'tail') this.spawnTailCar(m.target);
    if (m.wanted) this.hooks.setWanted(m.wanted);
    this.hooks.onObjective(m.objective);
    this.hooks.onMissionStart(m);
    this.hooks.onToast(`MISSION ${m.id} — ${m.title}`, `${m.giver}: ${m.brief}`);
  }

  moveBeacon(point) {
    this.beacon.position.set(point.x, 0, point.z);
  }

  missionTarget() {
    const m = this.active.def;
    if (m.checkpoints) return m.checkpoints[this.active.progress];
    return m.target;
  }

  spawnPickups(points) {
    const geo = new THREE.BoxGeometry(1.4, 1.0, 1.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0x8a6a00, roughness: 0.5 });
    for (const p of points) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, 0.7, p.z);
      this.scene.add(mesh);
      this.pickupMeshes.push({ mesh, x: p.x, z: p.z, taken: false });
    }
  }

  spawnHostiles(n, center) {
    // Armed rivals: varied jackets, they stand their ground and shoot back.
    // The deal order is the contract: jackets first (one draw each via
    // pickN), then per hostile the x jitter, the z jitter and the shoot
    // timer — exactly as v2.3 dealt it.
    const jackets = pickN(this.rng, RIVAL_JACKETS, n);
    for (let i = 0; i < n; i++) {
      const { group, hpMesh } = buildRival(jackets[i]);
      const angle = (i / n) * Math.PI * 2;
      const x = center.x + Math.sin(angle) * HOSTILE_RING + range(this.rng, -HOSTILE_JITTER, HOSTILE_JITTER);
      const z = center.z + Math.cos(angle) * HOSTILE_RING + range(this.rng, -HOSTILE_JITTER, HOSTILE_JITTER);
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
    for (const p of this.pickupMeshes) this.scene.remove(p.mesh);
    this.pickupMeshes = [];
    for (const h of this.hostiles) this.scene.remove(h.mesh);
    this.hostiles = [];
    if (this.tailCar) {
      this.scene.remove(this.tailCar.mesh);
      this.tailCar = null;
    }
  }

  complete(player) {
    const m = this.active.def;
    player.cash += m.reward;
    this.done += 1;
    this.earned += m.reward;
    this.hooks.onComplete(m, player.cash);
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
  closeTo(playerPos, point, radius = REACH_RADIUS) {
    return Math.hypot(playerPos.x - point.x, playerPos.z - point.z) < radius;
  }

  // --- per-type rules, one handler each. Returns true if the mission ended.
  handleDrive(p) {
    if (this.closeTo(p, this.active.def.target)) {
      this.complete(p.player);
      return true;
    }
    return false;
  }

  handleSteal(p) {
    const a = this.active;
    if (p.player.inCar && !a.stolen) {
      a.stolen = true;
      this.hooks.onObjective('Stolen! Now deliver it to the garage');
    }
    if (a.stolen && this.closeTo(p, a.def.target)) {
      this.complete(p.player);
      return true;
    }
    return false;
  }

  handleCheckpoints(p, chase) {
    const a = this.active;
    const m = a.def;
    const cp = m.checkpoints[a.progress];
    if (!this.closeTo(p, cp, CHECKPOINT_RADIUS)) return false;
    a.progress += 1;
    const line = chase ? 'Keep running — they are right behind you!' : 'Checkpoint clear.';
    this.hooks.onToast(`CHECKPOINT ${a.progress}/${m.checkpoints.length}`, line);
    if (a.progress >= m.checkpoints.length) {
      if (this.closeTo(p, m.target, 8)) {
        this.complete(p.player);
        return true;
      }
      this.moveBeacon(m.target);
      this.hooks.onObjective('Final stretch — reach the marker');
    } else {
      this.moveBeacon(m.checkpoints[a.progress]);
    }
    return false;
  }

  handleCollect(p) {
    const a = this.active;
    const m = a.def;
    for (const pk of this.pickupMeshes) {
      if (pk.taken || !this.closeTo(p, pk, PICKUP_RADIUS)) continue;
      pk.taken = true;
      this.scene.remove(pk.mesh);
      a.collected += 1;
      this.hooks.onToast(`PACKAGE ${a.collected}/${m.pickups.length}`, 'Picked up. Keep moving.');
      if (a.collected >= m.pickups.length) {
        this.complete(p.player);
        return true;
      }
    }
    this.hooks.onObjective(`${m.objective} — ${a.collected}/${m.pickups.length}`);
    return false;
  }

  handleShoot(player) {
    const a = this.active;
    const m = a.def;
    this.hooks.onObjective(`${m.objective} — ${a.killed}/${m.count} down`);
    if (a.killed >= m.count) {
      this.complete(player);
      return true;
    }
    return false;
  }

  handleEscape(p, dt) {
    const a = this.active;
    const m = a.def;
    if (a.surviveLeft > 0) {
      a.surviveLeft -= dt;
      this.hooks.onObjective(`${m.objective} — hold on ${Math.ceil(a.surviveLeft)}s`);
      if (a.surviveLeft <= 0) {
        a.escaped = true;
        this.moveBeacon(m.target);
        this.hooks.onObjective('Heat cooling — reach the marker now!');
      }
    } else if (this.closeTo(p, m.target)) {
      this.complete(p.player);
      return true;
    }
    return false;
  }

  update(dt, player, world) {
    if (!this.active || this.allDone) return;
    const a = this.active;
    const m = a.def;
    const p = player.pos;

    // Timers tick before the type rule runs.
    if (m.timeLimit) {
      a.timer -= dt;
      this.hooks.onObjective(`${m.objective} — ${Math.max(0, Math.ceil(a.timer))}s left`);
      if (a.timer <= 0) {
        this.fail('Out of time — the Broker does not wait.');
        return;
      }
    }

    const ctx = { ...p, player };
    let ended = false;
    switch (m.type) {
      case 'drive':
      case 'timed':
      case 'roadblock':
        ended = this.handleDrive(ctx);
        break;
      case 'steal':
        ended = this.handleSteal(ctx);
        break;
      case 'checkpoints':
        ended = this.handleCheckpoints(ctx, false);
        break;
      case 'chase':
        ended = this.handleCheckpoints(ctx, true);
        break;
      case 'collect':
        ended = this.handleCollect(ctx);
        break;
      case 'shoot':
        ended = this.handleShoot(player);
        break;
      case 'escape':
        ended = this.handleEscape(ctx, dt);
        break;
      case 'tail':
        if (this.tailCar) ended = this.updateTail(dt, player, world);
        break;
      default:
        break;
    }
    if (ended) return;

    // Spin the beacon arrow + bob the pickups.
    if (this.beacon.visible) this.beacon.children[2].rotation.y += dt * 2;
    for (const pk of this.pickupMeshes) {
      if (!pk.taken) pk.mesh.rotation.y += dt * 1.5;
    }
  }

  // Drive the runner car around its Marina loop: steer toward the current
  // waypoint, advance to the next one when it arrives. The heading is
  // computed from the waypoint captured before the advance, so the car
  // steers at the waypoint it just reached for one frame — as v2.3 did.
  driveTailCar(dt, world) {
    const t = this.tailCar;
    const wp = TAIL_LOOP[t.wp ?? 0];
    if (Math.hypot(t.x - wp.x, t.z - wp.z) < 8) {
      t.wp = ((t.wp ?? 0) + 1) % TAIL_LOOP.length;
    }
    const targetHeading = Math.atan2(wp.x - t.x, wp.z - t.z);
    let steer = ((targetHeading - t.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    steer = Math.max(-1, Math.min(1, steer * 2));
    driveCar(t, dt, { throttle: 0.7, steer, brake: false }, world.colliders, world.traffic.cars);
    t.mesh.position.set(t.x, 0, t.z);
  }

  // The tail chase. Returns true when the mission ended (complete/fail).
  updateTail(dt, player, world) {
    const a = this.active;
    const m = a.def;
    const p = player.pos;
    const t = this.tailCar;
    const d = Math.hypot(p.x - t.x, p.z - t.z);
    if (d < 12) {
      a.tailTime += dt;
      this.hooks.onObjective(`Stay on his bumper — ${a.tailTime.toFixed(1)}s / 6s`);
      if (a.tailTime >= 6) {
        this.complete(player);
        return true;
      }
    } else {
      a.tailTime = Math.max(0, a.tailTime - dt * 0.5);
      this.hooks.onObjective(m.objective);
      if (d > 60) {
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

  restore(s) {
    if (!s) return;
    this.index = Math.min(s.index ?? 0, MISSIONS.length - 1);
    this.done = s.done ?? 0;
    this.earned = s.earned ?? 0;
  }
}
