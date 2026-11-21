// garage.js — property + garage system: 3 buyable safehouses at different
// prices, car storage slots at each one, and an upgrade shop (engine, tires,
// armor, nitro) with increasing prices and a purchase UI.
import * as THREE from 'three';
import { fmtCash } from './util.js';
import { PLACES } from './coralcity.js';

export const SAFEHOUSES = [
  { key: 'palm', name: 'PALM COURT APT', price: 8000, place: 'safehouse1', slots: 2, color: 0x22b573 },
  { key: 'harbour', name: 'HARBOUR LOFT', price: 22000, place: 'safehouse2', slots: 4, color: 0x1a6fd4 },
  { key: 'crown', name: 'CROWN PENTHOUSE', price: 55000, place: 'safehouse3', slots: 6, color: 0xffd23e },
];

export const UPGRADES = {
  engine: { name: 'ENGINE', desc: '+12% top speed / level', base: 1500, max: 4 },
  tires: { name: 'TIRES', desc: '+grip, sharper turns / level', base: 900, max: 4 },
  armor: { name: 'ARMOR', desc: '+25 max damage soak / level', base: 1200, max: 4 },
  nitro: { name: 'NITRO', desc: '+nitro capacity / level', base: 1100, max: 4 },
};

export function upgradePrice(key, level) {
  return UPGRADES[key].base * (level + 1);
}

export function initGarage(W) {
  W.garage = {
    owned: { palm: false, harbour: false, crown: false },
    stored: { palm: [], harbour: [], crown: [] },
    shopOpen: false,
  };
  W.garageUpgrades = { engine: 0, tires: 0, armor: 0, nitro: 0 };
  // Safehouse markers: glowing house icons on the map.
  for (const sh of SAFEHOUSES) {
    const pl = PLACES[sh.place];
    const marker = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 6),
      new THREE.MeshStandardMaterial({ color: sh.color, emissive: sh.color, emissiveIntensity: 0.35, roughness: 0.7 }));
    marker.position.set(pl.x, 4, pl.z);
    W.scene.add(marker);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 3, 4),
      new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.9 }));
    roof.position.set(pl.x, 9.5, pl.z);
    roof.rotation.y = Math.PI / 4;
    W.scene.add(roof);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.25, 8, 32),
      new THREE.MeshBasicMaterial({ color: sh.color }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pl.x, 0.25, pl.z);
    W.scene.add(ring);
    sh.marker = marker;
  }
  // The garage workshop at Sunset Garage.
  const gp = PLACES.garageBay;
  const shop = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a3340, roughness: 0.85 }));
  shop.position.set(gp.x, 3, gp.z);
  W.scene.add(shop);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  sign.position.set(gp.x, 6.4, gp.z + 5.2);
  W.scene.add(sign);
}

export function nearestSafehouse(W) {
  const p = W.player;
  let best = null;
  let bestD = 12;
  for (const sh of SAFEHOUSES) {
    const pl = PLACES[sh.place];
    const d = Math.hypot(p.x - pl.x, p.z - pl.z);
    if (d < bestD) { bestD = d; best = sh; }
  }
  return best;
}

export function buySafehouse(W, key) {
  const sh = SAFEHOUSES.find((s) => s.key === key);
  if (!sh) return false;
  if (W.garage.owned[key]) {
    W.hudFlash(sh.name + ' — ALREADY YOURS');
    return false;
  }
  if (W.player.cash < sh.price) {
    W.hudFlash('NEED ' + fmtCash(sh.price) + ' FOR ' + sh.name);
    return false;
  }
  W.player.cash -= sh.price;
  W.garage.owned[key] = true;
  W.hudFlash(sh.name + ' BOUGHT — ' + sh.slots + ' GARAGE SLOTS');
  W.events.push({ type: 'buyhouse', key, price: sh.price });
  W.saveGame?.();
  return true;
}

export function storeCar(W, key) {
  const v = W.player.vehicle;
  const sh = SAFEHOUSES.find((s) => s.key === key);
  if (!v || !sh || !W.garage.owned[key]) return false;
  if (W.garage.stored[key].length >= sh.slots) {
    W.hudFlash('GARAGE FULL AT ' + sh.name);
    return false;
  }
  W.garage.stored[key].push({ name: v.name, color: v.color });
  W.hudFlash(v.name.toUpperCase() + ' STORED AT ' + sh.name);
  W.events.push({ type: 'storecar', key, name: v.name });
  return true;
}

export function buyUpgrade(W, key) {
  const up = UPGRADES[key];
  const level = W.garageUpgrades[key];
  if (level >= up.max) {
    W.hudFlash(up.name + ' — MAX LEVEL');
    return false;
  }
  const price = upgradePrice(key, level);
  if (W.player.cash < price) {
    W.hudFlash('NEED ' + fmtCash(price) + ' FOR ' + up.name + ' LV' + (level + 1));
    return false;
  }
  W.player.cash -= price;
  W.garageUpgrades[key] = level + 1;
  W.hudFlash(up.name + ' LV' + (level + 1) + ' INSTALLED — ' + fmtCash(price));
  W.events.push({ type: 'upgrade', key, level: level + 1, price });
  W.saveGame?.();
  W.hud?.refreshGarage();
  return true;
}

// Distance check: is the player at the upgrade shop?
export function atGarageShop(W) {
  const gp = PLACES.garageBay;
  return Math.hypot(W.player.x - gp.x, W.player.z - gp.z) < 14;
}

export function toggleShop(W) {
  W.garage.shopOpen = !W.garage.shopOpen;
  W.hud?.showShop(W.garage.shopOpen);
  return W.garage.shopOpen;
}
