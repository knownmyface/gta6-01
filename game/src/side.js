// CORAL HEAT v2.8 — side hustles: Tiko's garage, Amara's gun shop, and the
// coral tokens hidden around the city. The story pays the bills; the side
// stuff pays for the fun. Buying is a switch on the offer id now, so each
// purchase reads as one line of intent.

import * as THREE from 'three';
import { gap2d } from './rng.js';

export const STORES = [
  {
    id: 'garage', name: "TIKO'S GARAGE", x: 150, z: -150,
    blurb: 'Tune-ups, armor and a faster engine. Cash only, no questions.',
    offers: [
      { id: 'tune1', name: 'Tuned engine (+15% top speed)', price: 1600, once: true },
      { id: 'nitro1', name: 'Nitro tank (bigger boost meter)', price: 950, once: true },
      { id: 'armor1', name: 'Reinforced frame (half crash damage)', price: 1300, once: true },
      { id: 'repair', name: 'Full repair', price: 350, once: false },
    ],
  },
  {
    id: 'gunshop', name: "AMARA'S GUN SHOP", x: 88, z: 92,
    blurb: 'Licensed, mostly. Amara sells to anyone with cash and a steady hand.',
    offers: [
      { id: 'boomstick', name: 'BOOMSTICK 12 (unlock slot 3)', price: 1900, once: true },
      { id: 'smg-ammo', name: 'SMG ammo +150', price: 450, once: false },
      { id: 'shells', name: 'Shotgun shells +28', price: 380, once: false },
    ],
  },
];

const TOKEN_SPOTS = [
  [-36, -196], [204, 44], [-116, -176], [44, 204], [224, -76],
  [-156, 44], [124, -216], [-76, 164], [236, 204], [-196, -16],
  [4, -236], [164, 124],
];

export class SideHustle {
  constructor(scene) {
    this.scene = scene;
    this.bought = new Set();
    this.tokenMeshes = [];
    // coral tokens: glowing rings tucked around the map
    const geo = new THREE.TorusGeometry(0.9, 0.18, 8, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7ad9 });
    for (const [x, z] of TOKEN_SPOTS) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 1.4, z);
      scene.add(m);
      this.tokenMeshes.push({ mesh: m, x, z, taken: false });
    }
    // shop markers: floating signs above the two shops
    this.signs = [];
    for (const shop of STORES) {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 1.3, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffb347 }),
      );
      sign.position.set(shop.x, 7.8, shop.z);
      scene.add(sign);
      this.signs.push(sign);
    }
  }
  closestStore(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const s of STORES) {
      const d = gap2d(x, z, s.x, s.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }
  // returns the token if the player just walked through one
  grabToken(x, z) {
    for (const t of this.tokenMeshes) {
      if (t.taken) continue;
      if (gap2d(x, z, t.x, t.z) < 1.6) {
        t.taken = true;
        t.mesh.visible = false;
        return t;
      }
    }
    return null;
  }
  // apply a purchase; returns {ok, reason}
  purchase(offer, state) {
    if (offer.once && this.bought.has(offer.id)) return { ok: false, reason: 'Already owned.' };
    if (state.cash < offer.price) return { ok: false, reason: 'Not enough cash.' };
    state.cash -= offer.price;
    this.bought.add(offer.id);
    switch (offer.id) {
      case 'repair':
        if (state.car) state.car.health = 100;
        break;
      case 'smg-ammo': state.loadout.addAmmo(1, 150); break;
      case 'shells': state.loadout.addAmmo(2, 28); break;
      case 'boomstick': state.loadout.open(2); break;
      case 'tune1': state.garage = Math.max(state.garage, 1); break;
      case 'armor1': state.garage = Math.max(state.garage, 2); break;
      case 'nitro1': state.garage = Math.max(state.garage, 1); break;
      default: break;
    }
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
