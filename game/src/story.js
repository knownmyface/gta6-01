// Coral Heat — story missions 1-12 + the mission engine.
// Each mission has a start setup and a per-frame check; completing one
// banks cash, unlocks the next, and updates the HUD objective banner.
import * as THREE from 'three';
import { fmtMoney, clamp } from './util.js';
import { MARINA_X } from './coralcity.js';
import { startRace } from './raceway.js';

export function createMissionEngine(G) {
  G.missions = {
    list: [],
    active: null,
    onRaceWon: null,
    onSafehouseBought: null,
    onUpgradeBought: null,
    start(id) {
      const m = this.list.find((x) => x.id === id);
      if (!m || m.state === 'done') return false;
      if (this.active) this.active.state = 'available';
      this.active = m;
      m.state = 'active';
      m.startedAt = G.time;
      if (m.onStart) m.onStart(G);
      if (G.hud) {
        G.hud.banner('MISSION ' + m.id, m.name.toUpperCase());
        G.hud.setObjective('Mission ' + m.id + ': ' + m.name + ' — ' + m.desc);
      }
      if (G.sfx) G.sfx('mission');
      return true;
    },
    complete(m) {
      m.state = 'done';
      if (this.active === m) this.active = null;
      G.player.cash += m.reward;
      G.stats.cashEarned += m.reward;
      if (G.hud) {
        G.hud.banner('MISSION COMPLETE', m.name + ' · +' + fmtMoney(m.reward));
        G.hud.setObjective('Mission ' + m.id + ' done — press N for the next job');
        G.hud.toast('+' + fmtMoney(m.reward) + ' banked');
      }
      if (G.sfx) G.sfx('win');
      const next = this.list.find((x) => x.id === m.id + 1 && x.state === 'locked');
      if (next) next.state = 'available';
      if (G.save) G.save();
    },
    nextAvailable() {
      return this.list.find((x) => x.state === 'available');
    },
  };
  G.stats = {
    shotsFired: 0, topSpeed: 0, distanceBiked: 0, cashEarned: 0,
    racesWon: 0, boatsBoarded: 0, carsStolen: 0, missionsDone: 0,
  };
  // mission target beacon
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 26, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd75a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  beacon.visible = false;
  G.scene.add(beacon);
  G.missionBeacon = beacon;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd75a, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  G.scene.add(ring);
  G.missionRing = ring;
}

function at(G, x, z, r = 12) {
  return Math.hypot(G.player.pos.x - x, G.player.pos.z - z) < r;
}

export function defineMissions(G) {
  const M = G.missions.list;
  M.push(
    {
      id: 1, name: 'Welcome to Coral Bay', desc: 'Drive to Marina Row, the waterfront boulevard', reward: 500, state: 'available',
      target: [MARINA_X, 0],
      onStart() {},
      check(G) { return at(G, MARINA_X, 0, 16); },
    },
    {
      id: 2, name: 'First Wheels', desc: 'Steal a car — walk up to traffic and press E, or carjack with F', reward: 800, state: 'locked',
      target: [-60, 0],
      check(G) { return G.stats.carsStolen > 0; },
    },
    {
      id: 3, name: 'Hot Wheels', desc: 'Hit 100 MPH in any car', reward: 1000, state: 'locked',
      check(G) { return G.stats.topSpeed >= 100; },
    },
    {
      id: 4, name: 'Heat Check', desc: 'Get the law on you — reach 2 wanted stars', reward: 1200, state: 'locked',
      check(G) { return G.player.wanted >= 2; },
    },
    {
      id: 5, name: 'Lose the Tail', desc: 'Shake the cops — drop back to 0 stars', reward: 1500, state: 'locked',
      check(G) { return G.player.wanted === 0 && G.stats.hadWanted; },
    },
    {
      id: 6, name: 'Courier Run', desc: 'Deliver the package to the casino district', reward: 1800, state: 'locked',
      target: [186, -186],
      check(G) { return at(G, 186, -186, 20); },
    },
    {
      id: 7, name: 'Street Cred', desc: 'Hold $5,000 in cash', reward: 2000, state: 'locked',
      check(G) { return G.player.cash >= 5000; },
    },
    {
      id: 8, name: 'Armed & Ready', desc: 'Fire 10 shots — the range is the whole city', reward: 1500, state: 'locked',
      check(G) { return G.stats.shotsFired >= 10; },
    },
    {
      id: 9, name: 'Pedal to the Metal', desc: 'Hit 120 MPH — nitro helps (Shift, with the kit)', reward: 2500, state: 'locked',
      check(G) { return G.stats.topSpeed >= 120; },
    },
    {
      id: 10, name: 'Marina Nights', desc: 'Board a boat at the marina (E near a moored boat)', reward: 2000, state: 'locked',
      check(G) { return G.stats.boatsBoarded > 0; },
    },
    {
      id: 11, name: 'Harbor Lights', desc: 'Push a boat past 50 MPH on open water', reward: 2500, state: 'locked',
      check(G) { return G.player.mode === 'boat' && Math.abs(G.player.speed) * 2.23694 >= 50; },
    },
    {
      id: 12, name: 'King of the Bay', desc: 'Reach 4 wanted stars and survive', reward: 4000, state: 'locked',
      check(G) { return G.player.wanted >= 4; },
    },
  );
}

export function updateMissions(G, dt) {
  const m = G.missions.active;
  // move the beacon to the active mission target
  if (m && m.target) {
    G.missionBeacon.visible = true;
    G.missionBeacon.position.set(m.target[0], 13, m.target[1]);
    G.missionBeacon.rotation.y += dt;
    G.missionRing.visible = true;
    G.missionRing.position.set(m.target[0], 0.4, m.target[1]);
    const pulse = 1 + Math.sin(G.time * 3) * 0.12;
    G.missionRing.scale.set(pulse, pulse, 1);
  } else {
    G.missionBeacon.visible = false;
    G.missionRing.visible = false;
  }
  if (!m) return;
  // staged screenshot scenes freeze mission completion so the staged
  // mission stays on the HUD for the shot
  if (G.scenePreset) return;
  if (m.check && m.check(G)) {
    G.stats.missionsDone += 1;
    G.missions.complete(m);
  }
}

// N key: start the next available mission.
export function startNextMission(G) {
  const next = G.missions.nextAvailable();
  if (next) G.missions.start(next.id);
  else if (G.hud) G.hud.toast('No jobs available right now — explore Coral Bay');
}
