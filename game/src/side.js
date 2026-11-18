// Side activities for CORAL HEAT v2 — the stuff that makes Coral Bay a game
// you keep playing after the story missions: taxi fares, 12 hidden Coral
// Coins, and the GUNSMITH weapon shop. All three run alongside the mission
// manager, pay cash, and feed the stats on the start screen.
import * as THREE from 'three';
import { createRng, pick, range } from './rng.js';

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

// A small coloured light-column marker (gold for missions is elsewhere;
// cyan = taxi, green = shop, gold coin = collectible handled separately).
function makeMarker(color) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.4, 40, 10, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 20;
  g.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.28, 8, 28),
    new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  return g;
}

export class SideActivities {
  constructor(scene, rng, hooks) {
    this.scene = scene;
    this.rng = rng;
    this.hooks = hooks; // { onToast, onObjective, onCash }
    this.coinMeshes = [];
    this.coinsFound = new Set();
    this.fare = null; // { stage: 'pickup'|'ride', ped, dest, timer, payout }
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
    const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.22, 20);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd23e, metalness: 0.9, roughness: 0.2, emissive: 0x6a4a00,
    });
    const inner = new THREE.MeshStandardMaterial({ color: 0xfff2b0, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < COIN_POSITIONS.length; i++) {
      const p = COIN_POSITIONS[i];
      const g = new THREE.Group();
      const coin = new THREE.Mesh(geo, mat);
      coin.rotation.x = Math.PI / 2;
      g.add(coin);
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.26, 12), inner);
      dot.rotation.x = Math.PI / 2;
      g.add(dot);
      g.position.set(p.x, 1.4, p.z);
      this.scene.add(g);
      this.coinMeshes.push({ mesh: g, x: p.x, z: p.z, id: i, taken: false, label: p.label });
    }
  }

  restoreCoins(foundIds) {
    for (const id of foundIds || []) {
      const c = this.coinMeshes[id];
      if (c && !c.taken) {
        c.taken = true;
        this.scene.remove(c.mesh);
        this.coinsFound.add(id);
      }
    }
  }

  // --- taxi fares: get in a taxi, pick up a passenger, get paid ---
  maybeOfferFare(player) {
    if (this.fare) return;
    if (!player.inCar || !player.car || player.car.type !== 'taxi') return;
    this.fareTimer += 1;
    if (this.fareTimer < 90) return;
    this.fareTimer = 0;
    // passenger waits on the nearest sidewalk
    const px = player.car.x + pick(this.rng, [-8, 8]);
    const pz = player.car.z + pick(this.rng, [-8, 8]);
    this.fare = { stage: 'pickup', x: px, z: pz, dest: null, timer: 0, payout: 0 };
    this.taxiMarker.position.set(px, 0, pz);
    this.taxiMarker.visible = true;
    this.hooks.onObjective('TAXI FARE: pick up the passenger at the blue marker');
    this.hooks.onToast('TAXI FARE', 'A passenger is waving you down — pick them up.');
  }

  update(dt, player, peds) {
    // spin + bob the coins
    for (const c of this.coinMeshes) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2.2;
      c.mesh.position.y = 1.4 + Math.sin(performance.now() / 500 + c.id) * 0.25;
    }
    // shop marker pulse
    this.shopMarker.children[1].scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.08);

    const p = player.pos;
    // coins: collect on foot or by car
    for (const c of this.coinMeshes) {
      if (c.taken) continue;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 3.5) {
        c.taken = true;
        this.scene.remove(c.mesh);
        this.coinsFound.add(c.id);
        this.hooks.onCash(150);
        this.hooks.onToast(`CORAL COIN ${this.coinsFound.size}/12 — ${c.label}`, '+$150 — keep hunting, 12 are hidden around Coral Bay.');
        this.hooks.onObjective(`Coral Coins ${this.coinsFound.size}/12 found`);
      }
    }

    // taxi fare state machine
    if (!this.fare) { this.maybeOfferFare(player); return; }
    const f = this.fare;
    if (f.stage === 'pickup') {
      if (!player.inCar || !player.car || player.car.type !== 'taxi') {
        this.cancelFare('Fare cancelled — you left the taxi.');
        return;
      }
      if (Math.hypot(p.x - f.x, p.z - f.z) < 5) {
        // passenger hops in
        f.stage = 'ride';
        f.timer = 60;
        const spots = [
          { x: -160, z: -160 }, { x: 160, z: 160 }, { x: 0, z: -160 }, { x: -120, z: 120 },
          { x: 120, z: -120 }, { x: -160, z: 160 }, { x: 40, z: 40 },
        ];
        f.dest = pick(this.rng, spots);
        f.payout = 150 + Math.floor(Math.hypot(f.dest.x - f.x, f.dest.z - f.z) * 1.2);
        this.taxiMarker.visible = false;
        this.destMarker.position.set(f.dest.x, 0, f.dest.z);
        this.destMarker.visible = true;
        this.hooks.onObjective(`TAXI: drop them off at the gold marker — ${Math.ceil(f.timer)}s`);
        this.hooks.onToast('PASSENGER ABOARD', 'Drive smooth — the meter is running.');
      }
    } else if (f.stage === 'ride') {
      f.timer -= dt;
      this.hooks.onObjective(`TAXI: drop them off at the gold marker — ${Math.max(0, Math.ceil(f.timer))}s`);
      if (!player.inCar) { this.cancelFare('Fare cancelled — the passenger walked out.'); return; }
      if (f.timer <= 0) { this.cancelFare('Too slow — the passenger hailed another cab.'); return; }
      if (Math.hypot(p.x - f.dest.x, p.z - f.dest.z) < 6) {
        this.destMarker.visible = false;
        this.hooks.onCash(f.payout);
        this.hooks.onToast('FARE COMPLETE', `+$${f.payout.toLocaleString()} — the passenger tipped well.`);
        this.hooks.onObjective('Fare done — keep driving for the next one');
        this.fare = null;
        this.fareTimer = -240; // cooldown before the next offer
        if (this.hooks.onFareDone) this.hooks.onFareDone();
      }
    }
  }

  cancelFare(reason) {
    this.fare = null;
    this.taxiMarker.visible = false;
    this.destMarker.visible = false;
    this.fareTimer = -240;
    this.hooks.onObjective('Taxi fare available — get in a taxi');
    if (reason) this.hooks.onToast('FARE CANCELLED', reason);
  }

  nearShop(player) {
    const p = player.pos;
    return !player.inCar && Math.hypot(p.x - GUNSHOP.x, p.z - GUNSHOP.z) < 5;
  }
}
