// Coral Heat — side activities: Tiko's garage, Amara's gun shop, and the coral
// tokens hidden around the city. The story pays the bills; the side stuff pays
// for the fun.

import * as THREE from 'three';
import { dist2d } from './rng.js';

export const SHOPS = [
  {
    id: 'garage', name: "TIKO'S GARAGE", x: 150, z: -150,
    blurb: 'Tune-ups, armor and a faster engine. Cash only, no questions.',
    offers: [
      { id: 'tune1', name: 'Tuned engine (+15% top speed)', price: 1500, once: true },
      { id: 'armor1', name: 'Reinforced frame (half crash damage)', price: 1200, once: true },
      { id: 'repair', name: 'Full repair', price: 300, once: false },
    ],
  },
  {
    id: 'gunshop', name: "AMARA'S GUN SHOP", x: 90, z: 90,
    blurb: 'Licensed, mostly. Amara sells to anyone with cash and a steady hand.',
    offers: [
      { id: 'boomstick', name: 'BOOMSTICK 12 (unlock slot 3)', price: 1800, once: true },
      { id: 'smg-ammo', name: 'SMG ammo +120', price: 400, once: false },
      { id: 'shells', name: 'Shotgun shells +24', price: 350, once: false },
    ],
  },
];

export class SideActivities {
  constructor(scene) {
    this.scene = scene;
    this.bought = new Set();
    this.tokenMeshes = [];
    // coral tokens: glowing rings tucked around the map
    const spots = [
      [-40, -200], [200, 40], [-120, -180], [40, 200], [220, -80],
      [-160, 40], [120, -220], [-80, 160], [240, 200], [-200, -20],
      [0, -240], [160, 120],
    ];
    const geo = new THREE.TorusGeometry(0.9, 0.18, 8, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7ad9 });
    for (const [x, z] of spots) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 1.4, z);
      scene.add(m);
      this.tokenMeshes.push({ mesh: m, x, z, taken: false });
    }
    // shop markers: floating signs above the two shops
    this.signs = [];
    for (const shop of SHOPS) {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(6, 1.2, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x2fd4c4 }),
      );
      sign.position.set(shop.x, 7.5, shop.z);
      scene.add(sign);
      this.signs.push(sign);
    }
  }
  nearestShop(x, z, maxD) {
    let best = null, bestD = maxD;
    for (const s of SHOPS) {
      const d = dist2d(x, z, s.x, s.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }
  // returns the token if the player just walked through one
  collectToken(x, z) {
    for (const t of this.tokenMeshes) {
      if (!t.taken && dist2d(x, z, t.x, t.z) < 1.6) {
        t.taken = true;
        t.mesh.visible = false;
        return t;
      }
    }
    return null;
  }
  // apply a purchase; returns {ok, reason}
  buy(offer, state) {
    if (offer.once && this.bought.has(offer.id)) return { ok: false, reason: 'Already owned.' };
    if (state.cash < offer.price) return { ok: false, reason: 'Not enough cash.' };
    state.cash -= offer.price;
    this.bought.add(offer.id);
    if (offer.id === 'repair' && state.ride) state.ride.health = 100;
    if (offer.id === 'smg-ammo') state.arsenal.buyAmmo(1, 120);
    if (offer.id === 'shells') state.arsenal.buyAmmo(2, 24);
    if (offer.id === 'boomstick') state.arsenal.unlock(2);
    if (offer.id === 'tune1') state.garage = Math.max(state.garage, 1);
    if (offer.id === 'armor1') state.garage = Math.max(state.garage, 2);
    return { ok: true, reason: offer.name };
  }
  update(dt, t) {
    for (const tok of this.tokenMeshes) {
      if (tok.taken) continue;
      tok.mesh.rotation.y += dt * 1.5;
      tok.mesh.position.y = 1.4 + Math.sin(t * 2 + tok.x) * 0.25;
    }
    for (const s of this.signs) {
      s.rotation.y = Math.sin(t * 0.8 + s.position.x) * 0.25;
    }
  }
}
