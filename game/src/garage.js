// garage.js — property + garage system: 3 buyable safehouses, car storage slots,
// upgrade shop (engine / tires / armor / nitro) with purchase UI.
import { box, fmtCash, clamp } from './util.js';
import * as THREE from 'three';

export const SAFEHOUSES = [
  { id: 'palm-apartment', name: 'Palm Court Apartment', price: 8000, x: -228, z: -76, slots: 2, color: 0x7ae0a0 },
  { id: 'marina-loft', name: 'Marina Loft', price: 22000, x: 228, z: 152, slots: 4, color: 0x3ca8ff },
  { id: 'coral-villa', name: 'Coral Villa', price: 60000, x: 228, z: -228, slots: 6, color: 0xffd23c },
];

export const UPGRADES = [
  { id: 'engine', name: 'Engine Tuning', desc: '+9% top speed per level', base: 1500, max: 4 },
  { id: 'tires', name: 'Grip Tires', desc: '+12% cornering per level', base: 900, max: 3 },
  { id: 'armor', name: 'Body Armor', desc: '+25 car HP per level', base: 1200, max: 4 },
  { id: 'nitro', name: 'Nitro Kit', desc: 'Shift = boost, refills at garage', base: 2000, max: 2 },
];

export function createGarageState() {
  return {
    owned: [], // safehouse ids
    stored: {}, // safehouse id -> [car names]
    upgrades: { engine: 0, tires: 0, armor: 0, nitro: 0 },
    shopOpen: false,
  };
}

export function upgradePrice(up, level) {
  return Math.round(up.base * Math.pow(1.8, level));
}

export function buySafehouse(G, house) {
  const g = G.garage;
  if (g.owned.includes(house.id)) return 'owned';
  if (G.player.cash < house.price) return 'poor';
  G.player.cash -= house.price;
  g.owned.push(house.id);
  g.stored[house.id] = [];
  // mark it owned in the world: gold roof trim
  const trim = box(16, 1, 16, 0xffd23c, house.x, 12.5, house.z);
  G.scene.add(trim);
  G.hud.say('SAFEHOUSE BOUGHT — ' + house.name + ' (' + house.slots + ' car slots)', 3.5);
  G.sound.win();
  G.save.save();
  return 'bought';
}

export function buyUpgrade(G, up) {
  const g = G.garage;
  const lvl = g.upgrades[up.id];
  if (lvl >= up.max) return 'maxed';
  const price = upgradePrice(up, lvl);
  if (G.player.cash < price) return 'poor';
  G.player.cash -= price;
  g.upgrades[up.id] = lvl + 1;
  // apply to the current vehicle right away
  const v = G.player.vehicle;
  if (v) {
    if (up.id === 'engine') v.engine = g.upgrades.engine;
    if (up.id === 'tires') v.tires = g.upgrades.tires;
    if (up.id === 'armor') { v.armor = g.upgrades.armor; v.hp = Math.min(100 + v.armor * 25, v.hp + 25); }
    if (up.id === 'nitro') { v.nitro = 100; }
  }
  G.hud.say(up.name + ' LV' + (lvl + 1) + ' installed — ' + fmtCash(price), 2.5);
  G.sound.blip(760, 0.12);
  G.save.save();
  return 'bought';
}

export function storeCar(G, houseId) {
  const g = G.garage;
  const v = G.player.vehicle;
  if (!v) return 'nocar';
  const slots = SAFEHOUSES.find((h) => h.id === houseId).slots;
  const stored = g.stored[houseId] || [];
  if (stored.length >= slots) return 'full';
  stored.push(v.name + ' (' + v.model.name + ')');
  g.stored[houseId] = stored;
  // car disappears into the garage
  G.scene.remove(v.group);
  const i = G.cars.indexOf(v); if (i >= 0) G.cars.splice(i, 1);
  G.player.vehicle = null;
  G.player.onFoot = true;
  G.player.pos.set(v.x - 3, 1.2, v.z - 3);
  G.player.mesh.group.visible = true;
  G.hud.say('Car stored at ' + houseId + ' — ' + stored.length + '/' + slots + ' slots used', 2.5);
  G.save.save();
  return 'stored';
}

export function nearestSafehouse(G, maxD = 14) {
  let best = null, bd = maxD;
  for (const h of SAFEHOUSES) {
    const d = Math.hypot(h.x - G.player.pos.x, h.z - G.player.pos.z);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

export function buildShopUI(G) {
  // DOM panel listing safehouses + upgrades, toggled with G key near a safehouse
  const panel = document.createElement('div');
  panel.id = 'garage-panel';
  panel.className = 'panel hidden';
  panel.innerHTML = '<h2>GARAGE &amp; PROPERTIES</h2><div class="sub">Coral Bay Motors — safehouses &amp; upgrades</div><div id="garage-houses"></div><h3>UPGRADE SHOP</h3><div id="garage-ups"></div><div class="hint">Cash: <b id="garage-cash"></b> — click to buy. G closes.</div>';
  document.body.appendChild(panel);
  return panel;
}

export function refreshShopUI(G) {
  const panel = G.garage.panel;
  if (!panel) return;
  const houses = panel.querySelector('#garage-houses');
  houses.innerHTML = '';
  for (const h of SAFEHOUSES) {
    const owned = G.garage.owned.includes(h.id);
    const b = document.createElement('button');
    b.className = 'shop-row' + (owned ? ' owned' : '');
    b.textContent = (owned ? 'OWNED ✓ ' : '') + h.name + ' — ' + h.slots + ' slots — ' + fmtCash(h.price);
    b.onclick = () => { const r = buySafehouse(G, h); if (r === 'poor') G.hud.say('Not enough cash for ' + h.name, 2); refreshShopUI(G); };
    houses.appendChild(b);
  }
  const ups = panel.querySelector('#garage-ups');
  ups.innerHTML = '';
  for (const up of UPGRADES) {
    const lvl = G.garage.upgrades[up.id];
    const b = document.createElement('button');
    b.className = 'shop-row' + (lvl >= up.max ? ' owned' : '');
    b.textContent = up.name + ' LV' + lvl + '/' + up.max + ' — ' + up.desc + ' — ' + (lvl >= up.max ? 'MAXED' : fmtCash(upgradePrice(up, lvl)));
    b.onclick = () => { const r = buyUpgrade(G, up); if (r === 'poor') G.hud.say('Not enough cash for ' + up.name, 2); refreshShopUI(G); };
    ups.appendChild(b);
  }
  panel.querySelector('#garage-cash').textContent = fmtCash(G.player.cash);
}
