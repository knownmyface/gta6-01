// Side activities for CORAL HEAT v2.5 — the stuff that makes Coral Bay a
// game you keep playing after the story missions: taxi fares, 12 hidden
// Coral Coins, and the GUNSMITH weapon shop. All three run alongside the
// mission manager, pay cash, and feed the stats on the start screen. v2.5
// is a from-scratch rewrite of v2.4's side.js: same coins, same fares, same
// shop, different code. The fare state machine is one method per stage now
// (offer, pickup, ride), and the coin + marker builders are table-driven.
// One rule governs this file: the seeded rng calls happen in exactly the
// same order as v2.4, so the same seed deals the same passengers.
import * as THREE from 'three';
import { pick } from './rng.js';

export const COIN_POSITIONS = [
  { x: -215, z: 190, label: 'Pier end' },
  { x: -196, z: 150, label: 'Coral Wheel' },
  { x: -160, z: 160, label: 'Marina' },
  { x: -160, z: -160, label: 'Sunset Point' },
  { x: -120, z: 120, label: 'The Docks' },
  { x: 0, z: 160, label: 'Docks east' },
  { x: 120, z: 120, label: 'Downtown' },
  { x: 160, z: -160, label: 'Palm Heights' },
  { x: 40, z: -120, label: 'Old Town' },
  { x: -40, z: -120, label: 'Old Town west' },
  { x: 120, z: 40, label: 'Downtown north' },
  { x: -120, z: -40, label: 'Parkside' },
];

export const GUNSHOP = { x: 88, z: 8, name: 'GUNSMITH' };

// Taxi destinations — fares cross the whole map, from the Coral Wheel to
// Palm Heights.
const TAXI_DESTINATIONS = [
  { x: -160, z: -160 }, { x: 160, z: 160 }, { x: 0, z: -160 }, { x: -120, z: 120 },
  { x: 120, z: -120 }, { x: -160, z: 160 }, { x: 40, z: 40 },
  { x: -196, z: 150 }, { x: 160, z: -160 },
];

const COIN_REWARD = 150;
const FARE_BASE = 150;
const FARE_PER_UNIT = 1.2;
const FARE_TIME = 60;
const FARE_OFFER_AFTER = 90; // frames in a taxi before the next offer
const FARE_COOLDOWN = -240; // frames of quiet after a fare ends

// A small coloured light-column marker (gold for missions is elsewhere;
// cyan = taxi, green = shop, gold coin = collectible handled separately).
function makeMarker(color) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.4, 40, 10, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  shaft.position.y = 20;
  group.add(shaft);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.28, 8, 28),
    new THREE.MeshBasicMaterial({ color }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.25;
  group.add(halo);
  return group;
}

// One Coral Coin: a gold disc with a pale centre, standing on edge.
function makeCoinMesh(materials) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(materials.discGeo, materials.disc);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);
  const hub = new THREE.Mesh(materials.dotGeo, materials.inner);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  return group;
}

export class SideActivities {
  constructor(scene, rng, hooks) {
    this.scene = scene;
    this.rng = rng;
    // Hooks: { onToast, onObjective, onCash, onFareDone }
    this.hooks = hooks;
    this.coinMeshes = [];
    this.coinsFound = new Set();
    this.fare = null; // { stage: 'pickup'|'ride', x, z, dest, timer, payout }
    this.fareTimer = 0;
    this.shopMarker = makeMarker(0x37e08a);
    this.shopMarker.position.set(GUNSHOP.x, 0, GUNSHOP.z);
    this.scene.add(this.shopMarker);
    this.taxiMarker = makeMarker(0x37b6ff);
    this.taxiMarker.visible = false;
    this.scene.add(this.taxiMarker);
    this.destMarker = makeMarker(0xffd23e);
    this.destMarker.visible = false;
    this.scene.add(this.destMarker);
    this.spawnCoins();
  }

  spawnCoins() {
    const materials = {
      discGeo: new THREE.CylinderGeometry(0.9, 0.9, 0.22, 20),
      dotGeo: new THREE.CylinderGeometry(0.45, 0.45, 0.26, 12),
      disc: new THREE.MeshStandardMaterial({
        color: 0xffd23e, metalness: 0.9, roughness: 0.2, emissive: 0x6a4a00,
      }),
      inner: new THREE.MeshStandardMaterial({ color: 0xfff2b0, metalness: 0.7, roughness: 0.3 }),
    };
    COIN_POSITIONS.forEach((spot, i) => {
      const group = makeCoinMesh(materials);
      group.position.set(spot.x, 1.4, spot.z);
      this.scene.add(group);
      this.coinMeshes.push({ mesh: group, x: spot.x, z: spot.z, id: i, taken: false, label: spot.label });
    });
  }

  restoreCoins(foundIds) {
    for (const id of foundIds || []) {
      const coin = this.coinMeshes[id];
      if (!coin || coin.taken) continue;
      coin.taken = true;
      this.scene.remove(coin.mesh);
      this.coinsFound.add(id);
    }
  }

  // --- taxi fares: get in a taxi, pick up a passenger, get paid ---
  // Offer stage: while the player sits in a taxi with no active fare, count
  // frames; after the wait, a passenger appears on the nearest sidewalk.
  offerFare(player) {
    if (this.fare) return;
    if (!player.inCar || !player.car || player.car.type !== 'taxi') return;
    this.fareTimer += 1;
    if (this.fareTimer < FARE_OFFER_AFTER) return;
    this.fareTimer = 0;
    // Passenger waits on the nearest sidewalk — one rng draw for x, one
    // for z, in that order.
    const x = player.car.x + pick(this.rng, [-8, 8]);
    const z = player.car.z + pick(this.rng, [-8, 8]);
    this.fare = { stage: 'pickup', x, z, dest: null, timer: 0, payout: 0 };
    this.taxiMarker.position.set(x, 0, z);
    this.taxiMarker.visible = true;
    this.hooks.onObjective('TAXI FARE: pick up the passenger at the blue marker');
    this.hooks.onToast('TAXI FARE', 'A passenger is waving you down — pick them up.');
  }

  // Pickup stage: drive to the blue marker; the passenger hops in and the
  // destination + payout are dealt.
  pickupFare(dt, player, p) {
    const fare = this.fare;
    if (!player.inCar || !player.car || player.car.type !== 'taxi') {
      this.cancelFare('Fare cancelled — you left the taxi.');
      return;
    }
    if (Math.hypot(p.x - fare.x, p.z - fare.z) >= 5) return;
    fare.stage = 'ride';
    fare.timer = FARE_TIME;
    fare.dest = pick(this.rng, TAXI_DESTINATIONS);
    fare.payout = FARE_BASE + Math.floor(Math.hypot(fare.dest.x - fare.x, fare.dest.z - fare.z) * FARE_PER_UNIT);
    this.taxiMarker.visible = false;
    this.destMarker.position.set(fare.dest.x, 0, fare.dest.z);
    this.destMarker.visible = true;
    this.hooks.onObjective(`TAXI: drop them off at the gold marker — ${Math.ceil(fare.timer)}s`);
    this.hooks.onToast('PASSENGER ABOARD', 'Drive smooth — the meter is running.');
    void dt;
  }

  // Ride stage: the meter runs down; reach the gold marker in time to get paid.
  rideFare(dt, player, p) {
    const fare = this.fare;
    fare.timer -= dt;
    this.hooks.onObjective(`TAXI: drop them off at the gold marker — ${Math.max(0, Math.ceil(fare.timer))}s`);
    if (!player.inCar) {
      this.cancelFare('Fare cancelled — the passenger walked out.');
      return;
    }
    if (fare.timer <= 0) {
      this.cancelFare('Too slow — the passenger hailed another cab.');
      return;
    }
    if (Math.hypot(p.x - fare.dest.x, p.z - fare.dest.z) >= 6) return;
    this.destMarker.visible = false;
    this.hooks.onCash(fare.payout);
    this.hooks.onToast('FARE COMPLETE', `+$${fare.payout.toLocaleString()} — the passenger tipped well.`);
    this.hooks.onObjective('Fare done — keep driving for the next one');
    this.fare = null;
    this.fareTimer = FARE_COOLDOWN; // cooldown before the next offer
    if (this.hooks.onFareDone) this.hooks.onFareDone();
  }

  collectCoins(player, p) {
    for (const coin of this.coinMeshes) {
      if (coin.taken) continue;
      if (Math.hypot(p.x - coin.x, p.z - coin.z) >= 3.5) continue;
      coin.taken = true;
      this.scene.remove(coin.mesh);
      this.coinsFound.add(coin.id);
      this.hooks.onCash(COIN_REWARD);
      this.hooks.onToast(`CORAL COIN ${this.coinsFound.size}/12 — ${coin.label}`, '+$150 — keep hunting, 12 are hidden around Coral Bay.');
      this.hooks.onObjective(`Coral Coins ${this.coinsFound.size}/12 found`);
    }
  }

  // Spin + bob the coins, and pulse the shop marker ring.
  animateMarkers(dt) {
    for (const coin of this.coinMeshes) {
      if (coin.taken) continue;
      coin.mesh.rotation.y += dt * 2.2;
      coin.mesh.position.y = 1.4 + Math.sin(performance.now() / 500 + coin.id) * 0.25;
    }
    this.shopMarker.children[1].scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.08);
  }

  update(dt, player, peds) {
    this.animateMarkers(dt);

    const p = player.pos;
    this.collectCoins(player, p);

    // Taxi fare state machine.
    if (!this.fare) {
      this.offerFare(player);
      return;
    }
    if (this.fare.stage === 'pickup') this.pickupFare(dt, player, p);
    else this.rideFare(dt, player, p);
    void peds;
  }

  cancelFare(reason) {
    this.fare = null;
    this.taxiMarker.visible = false;
    this.destMarker.visible = false;
    this.fareTimer = FARE_COOLDOWN;
    this.hooks.onObjective('Taxi fare available — get in a taxi');
    if (reason) this.hooks.onToast('FARE CANCELLED', reason);
  }

  nearShop(player) {
    const p = player.pos;
    return !player.inCar && Math.hypot(p.x - GUNSHOP.x, p.z - GUNSHOP.z) < 5;
  }
}
