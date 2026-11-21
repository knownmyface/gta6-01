// story.js — the story: 16 missions (1-12 here, 13-16 in story2.js), the
// mission state machine, objective markers and the characters of Coral Bay.
// Story: MARA VOSS, a getaway driver back in Coral Bay, works her way up from
// courier runs to the crew that will hit the Coral Crown Casino.
import * as THREE from 'three';
import { fmtCash, dist2, rand } from './util.js';
import { PLACES } from './coralcity.js';
import { giveWeapon } from './fight.js';
import { makeVehicle } from './drive.js';

export const STORY_INTRO =
  'MARA VOSS is back in Coral Bay. Five years away, one burned crew, and a debt ' +
  'to the Crown. Drive, earn, build the crew — then take the casino.';

export const MISSIONS = [
  { id: 1, name: 'BACK IN THE BAY', giver: 'DEX', brief: 'Meet Dex at the pier. Drive to the marker.', target: 'pier', kind: 'drive', reward: 400 },
  { id: 2, name: 'COURIER RUN', giver: 'DEX', brief: 'Deliver the package to Palm Court. No cops, no dents.', target: 'safehouse1', kind: 'drive', reward: 600 },
  { id: 3, name: 'HOT WHEELS', giver: 'DEX', brief: 'That Comet GT is yours now. Jack it and lose the heat.', target: 'jack', kind: 'jack', reward: 800 },
  { id: 4, name: 'FIRST BLOOD', giver: 'ROOK', brief: 'Rook needs a message sent. Take out 3 Bay Patrol cars.', target: 'cops', kind: 'killcops', count: 3, reward: 1200 },
  { id: 5, name: 'SALT AIR', giver: 'MARINA', brief: 'Steal a boat at the marina and sail it to the south buoy.', target: 'boat', kind: 'boat', reward: 1000 },
  { id: 6, name: 'RADIO SILENCE', giver: 'DEX', brief: 'Drive to the garage and pick up the jammer. Cops cannot see you for 60s.', target: 'garageBay', kind: 'drive', reward: 700 },
  { id: 7, name: 'PAYBACK', giver: 'ROOK', brief: 'The Tide crew jumped Dex. Chase their car down and wreck it.', target: 'chase', kind: 'chase', reward: 1500 },
  { id: 8, name: 'NIGHT SHIFT', giver: 'MARINA', brief: 'Smuggle the cargo to the beach by boat. Avoid the patrol boats.', target: 'beach', kind: 'boatdrive', reward: 1800 },
  { id: 9, name: 'FIVE STAR', giver: 'ROOK', brief: 'Survive a 3-star wanted level for 45 seconds. Lose them after.', target: 'survive', kind: 'survive', count: 45, reward: 2000 },
  { id: 10, name: 'THE FIXER', giver: 'DEX', brief: 'Buy your first safehouse — Palm Court Apt. Property is power.', target: 'buyhouse', kind: 'buyhouse', house: 'palm', reward: 500 },
  { id: 11, name: 'SMOKE AND MIRRORS', giver: 'MARINA', brief: 'Blow up 2 Tide crew cars with the rifle. Make it loud.', target: 'explode', kind: 'explode', count: 2, reward: 2200 },
  { id: 12, name: 'CREW UP', giver: 'ROOK', brief: 'Meet the crew at the casino door. The heist is on.', target: 'casinoDoor', kind: 'drive', reward: 1000 },
];

export function initStory(W) {
  W.story = {
    index: 0, // next mission to play
    active: null,
    progress: 0,
    timer: 0,
    done: [],
    marker: null,
    chaseCar: null,
  };
  // The objective beacon: a glowing pillar + a floating arrow.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 30;
  beacon.add(pillar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.3, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  beacon.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 12;
  beacon.add(arrow);
  beacon.visible = false;
  W.scene.add(beacon);
  W.story.marker = beacon;
  W.story.arrow = arrow;
}

export function currentMission(W) {
  return MISSIONS[W.story.index] || null;
}

export function startMission(W, idx = W.story.index) {
  const m = MISSIONS[idx];
  if (!m) return null;
  W.story.active = { ...m, progress: 0, timer: 0 };
  W.story.progress = 0;
  W.story.timer = 0;
  W.objective = 'M' + m.id + ' — ' + m.name + ': ' + m.brief;
  W.hudFlash('MISSION ' + m.id + ' — ' + m.name);
  placeMarker(W, m);
  // Mission-specific setup.
  if (m.kind === 'chase') spawnChaseTarget(W);
  if (m.kind === 'killcops') W.player.wanted = Math.max(W.player.wanted, 2);
  if (m.kind === 'survive') W.player.wanted = Math.max(W.player.wanted, 3);
  if (m.id === 4) giveWeapon(W, 'smg', 120);
  if (m.id === 11) giveWeapon(W, 'rifle', 24);
  W.events.push({ type: 'missionstart', id: m.id, name: m.name });
  return m;
}

function placeMarker(W, m) {
  const beacon = W.story.marker;
  const pl = PLACES[m.target];
  if (pl && m.kind !== 'jack' && m.kind !== 'cops' && m.kind !== 'chase' && m.kind !== 'explode' && m.kind !== 'survive' && m.kind !== 'buyhouse') {
    beacon.position.set(pl.x, 0, pl.z);
    beacon.visible = true;
  } else {
    beacon.visible = false;
  }
}

function spawnChaseTarget(W) {
  // A Tide crew car that flees from the player; wreck it to finish M7.
  const p = W.player;
  const v = makeVehicle(W, 0x8a2be2, p.x + 24, p.z - 10, p.heading, { topSpeed: 30, name: 'Tide Runner' });
  v.fleeing = true;
  v.wrecked = false;
  v.health = 100;
  W.story.chaseCar = v;
  W.hudFlash('CHASE THE PURPLE TIDE RUNNER — WRECK IT');
}

export function completeMission(W) {
  const m = W.story.active;
  if (!m) return;
  W.player.cash += m.reward;
  W.story.done.push(m.id);
  W.story.index += 1;
  W.story.active = null;
  W.story.marker.visible = false;
  W.hudFlash('MISSION COMPLETE — +' + fmtCash(m.reward));
  W.events.push({ type: 'missiondone', id: m.id, reward: m.reward });
  W.saveGame?.();
  const next = currentMission(W);
  if (next) {
    W.objective = 'NEXT: M' + next.id + ' — ' + next.name + ' (press N to start)';
  } else {
    W.objective = 'STORY COMPLETE — the casino heist awaits (see story2)';
  }
}

export function failMission(W, why) {
  const m = W.story.active;
  if (!m) return;
  W.story.active = null;
  W.story.marker.visible = false;
  W.hudFlash('MISSION FAILED — ' + why + ' (press N to retry)');
  W.events.push({ type: 'missionfail', id: m.id, why });
}

export function updateStory(W, dt) {
  const s = W.story;
  const m = s.active;
  // The M7 chase target flees from the player and can be wrecked by ramming
  // or by shooting it (fight.js marks it wrecked through W.events).
  if (s.chaseCar && !s.chaseCar.wrecked) {
    const c = s.chaseCar;
    const p = W.player;
    const away = Math.atan2(c.x - p.x, c.z - p.z);
    c.heading += (away - c.heading) * 0.02;
    c.heading = c.heading; // keep the flee heading smooth
    c.speed = Math.min(c.topSpeed, (c.speed || 0) + 10 * dt);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.x = Math.max(-205, Math.min(205, c.x));
    c.z = Math.max(-205, Math.min(215, c.z));
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    const d = dist2(c.x, c.z, p.x, p.z);
    if (d < 3.5 && p.vehicle && Math.abs(p.vehicle.speed) > 8) {
      c.health -= 30 * dt;
      p.vehicle.speed *= 0.9;
      if (c.health <= 0) {
        c.wrecked = true;
        W.fx.explode(c.x, 1, c.z, true);
      }
    }
  }
  if (!m) return;
  const p = W.player;
  s.timer += dt;
  // Bob the beacon arrow.
  if (s.arrow) s.arrow.position.y = 12 + Math.sin(W.time * 2.5) * 1.2;

  switch (m.kind) {
    case 'drive': {
      const pl = PLACES[m.target];
      if (pl && dist2(p.x, p.z, pl.x, pl.z) < 8) completeMission(W);
      break;
    }
    case 'jack': {
      if (s.progress === 0 && p.mode === 'car' && p.vehicle) {
        // Player jacked a car after the mission started.
        s.progress = 1;
        W.objective = 'M3 — Lose the cops: get wanted to 0';
      }
      if (s.progress === 1 && p.wanted === 0) completeMission(W);
      break;
    }
    case 'killcops': {
      const kills = W.events.filter((e) => e.type === 'copdown').length;
      if (kills >= m.count) completeMission(W);
      break;
    }
    case 'boat': {
      if (p.mode === 'boat') {
        s.progress = 1;
        W.objective = 'M5 — Sail to the south buoy (z > 250)';
      }
      if (s.progress === 1 && p.mode === 'boat' && p.z > 250) completeMission(W);
      break;
    }
    case 'boatdrive': {
      if (p.mode === 'boat' && p.z > 240) completeMission(W);
      break;
    }
    case 'chase': {
      if (s.chaseCar && s.chaseCar.wrecked) completeMission(W);
      if (s.timer > 120) failMission(W, 'TARGET ESCAPED');
      break;
    }
    case 'survive': {
      if (p.wanted >= 3) s.progress += dt;
      else s.progress = Math.max(0, s.progress - dt * 2);
      W.objective = 'M9 — Stay at 3+ stars: ' + Math.floor(s.progress) + 's / ' + m.count + 's';
      if (s.progress >= m.count) {
        p.wanted = 0;
        completeMission(W);
      }
      break;
    }
    case 'buyhouse': {
      if (W.garage.owned[m.house]) completeMission(W);
      break;
    }
    case 'explode': {
      const booms = W.events.filter((e) => e.type === 'explosion' && e.big).length;
      if (booms >= m.count) completeMission(W);
      break;
    }
    default:
      break;
  }
}
