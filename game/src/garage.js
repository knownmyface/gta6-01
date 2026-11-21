// Coral Heat — garage & property: three buyable safehouses with car
// storage slots, and an upgrade shop (engine / tires / armor / nitro)
// with increasing prices and a purchase UI.
import * as THREE from 'three';
import { fmtMoney } from './util.js';

export const SAFEHOUSES = [
  { id: 'marina', name: 'Marina Loft', price: 15000, x: -196, z: 90, slots: 2, color: 0x2e6fd9 },
  { id: 'casino', name: 'Casino Penthouse', price: 45000, x: 150, z: -120, slots: 4, color: 0x7a2a6b },
  { id: 'beach', name: 'Beach Bungalow', price: 8000, x: -196, z: -150, slots: 1, color: 0x2ed9a8 },
];

export const UPGRADES = [
  { id: 'engine', name: 'Engine Tuning', levels: 3, base: 4000, desc: '+8% top speed / level' },
  { id: 'tires', name: 'Grip Tires', levels: 3, base: 2500, desc: 'Sharper steering, less slide' },
  { id: 'armor', name: 'Armor Plating', levels: 3, base: 3500, desc: '+25 max health / level' },
  { id: 'nitro', name: 'Nitro Kit', levels: 2, base: 6000, desc: 'Hold Shift for a nitro burst' },
];

export function initGarage(G) {
  G.garage = {
    owned: [],
    stored: [], // { model, color, upgrades }
    shopOpen: false,
  };
  // mark the safehouse plots on the map
  for (const s of SAFEHOUSES) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.4, 10),
      new THREE.MeshLambertMaterial({ color: s.color })
    );
    marker.position.set(s.x, 0.35, s.z);
    G.scene.add(marker);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 7, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    post.position.set(s.x + 6, 3.5, s.z);
    G.scene.add(post);
  }
}

export function nearestSafehouse(G, maxDist = 14) {
  let best = null;
  let bestD = maxDist;
  for (const s of SAFEHOUSES) {
    const d = Math.hypot(s.x - G.player.pos.x, s.z - G.player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function buySafehouse(G, id) {
  const s = SAFEHOUSES.find((h) => h.id === id);
  if (!s) return false;
  if (G.garage.owned.includes(id)) {
    if (G.hud) G.hud.toast('You already own the ' + s.name);
    return false;
  }
  if (G.player.cash < s.price) {
    if (G.hud) G.hud.toast('Need ' + fmtMoney(s.price) + ' for the ' + s.name + ' — you have ' + fmtMoney(G.player.cash));
    return false;
  }
  G.player.cash -= s.price;
  G.garage.owned.push(id);
  if (G.hud) {
    G.hud.toast('SAFEHOUSE BOUGHT — ' + s.name + ' (' + s.slots + ' car slots)');
    G.hud.banner('NEW SAFEHOUSE', s.name + ' · save point + ' + s.slots + ' garage slots');
  }
  if (G.sfx) G.sfx('buy');
  if (G.missions) G.missions.onSafehouseBought?.(id);
  return true;
}

export function storeCurrentCar(G) {
  const s = nearestSafehouse(G, 16);
  if (!s || !G.garage.owned.includes(s.id)) {
    if (G.hud) G.hud.toast('Park at a safehouse you own to store this car (G near the marker)');
    return false;
  }
  const car = G.player.car;
  if (!car) return false;
  if (G.garage.stored.length >= totalSlots(G)) {
    if (G.hud) G.hud.toast('Garage full — buy a bigger safehouse');
    return false;
  }
  G.garage.stored.push({ model: car.model.name, color: car.model.color, upgrades: { ...car.upgrades } });
  G.scene.remove(car.mesh);
  G.player.car = null;
  G.player.mode = 'foot';
  G.player.footMesh.visible = true;
  G.player.footMesh.position.copy(G.player.pos);
  if (G.hud) G.hud.toast('Car stored at the ' + s.name + ' (' + G.garage.stored.length + '/' + totalSlots(G) + ')');
  return true;
}

export function totalSlots(G) {
  return G.garage.owned.reduce((n, id) => n + (SAFEHOUSES.find((s) => s.id === id)?.slots || 0), 0);
}

export function upgradePrice(G, partId) {
  const part = UPGRADES.find((u) => u.id === partId);
  const car = G.player.car;
  const level = car ? car.upgrades[partId] || 0 : 0;
  return part.base * (level + 1);
}

export function buyUpgrade(G, partId) {
  const car = G.player.car;
  if (!car) {
    if (G.hud) G.hud.toast('Bring a car to the shop to upgrade it');
    return false;
  }
  const part = UPGRADES.find((u) => u.id === partId);
  if (!part) return false;
  const level = car.upgrades[partId] || 0;
  if (level >= part.levels) {
    if (G.hud) G.hud.toast(part.name + ' is already maxed');
    return false;
  }
  const price = part.base * (level + 1);
  if (G.player.cash < price) {
    if (G.hud) G.hud.toast('Need ' + fmtMoney(price) + ' for ' + part.name + ' Lv' + (level + 1));
    return false;
  }
  G.player.cash -= price;
  car.upgrades[partId] = level + 1;
  if (partId === 'armor') car.health = Math.min(100 + level * 25, car.health + 25);
  if (partId === 'nitro') car.nitro = 100;
  if (G.hud) {
    G.hud.toast(part.name + ' Lv' + (level + 1) + ' installed — ' + fmtMoney(price));
    G.hud.refreshShop?.();
  }
  if (G.sfx) G.sfx('buy');
  if (G.missions) G.missions.onUpgradeBought?.(partId, level + 1);
  return true;
}

export function openShop(G) {
  G.garage.shopOpen = true;
  if (G.hud) G.hud.showShop(true);
}

export function closeShop(G) {
  G.garage.shopOpen = false;
  if (G.hud) G.hud.showShop(false);
}
