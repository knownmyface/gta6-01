// CORAL HEAT — garage + property + upgrade shop (NEW in v2.9).
// Three buyable safehouses, car storage slots, upgrade shop selling
// engine / tires / armor / nitro levels at increasing prices, purchase UI.
import { fmtCash } from './util.js';

export const UPGRADES = [
  { id: 'engine', name: 'Engine Tuning', desc: '+12% top speed per level', prices: [1200, 2600, 5200], max: 3 },
  { id: 'tires', name: 'Grip Tires', desc: '+15% cornering grip per level', prices: [900, 2000, 4200], max: 3 },
  { id: 'armor', name: 'Armor Plating', desc: '+40 car health per level', prices: [1000, 2200, 4600], max: 3 },
  { id: 'nitro', name: 'Nitro Boost', desc: 'Hold SHIFT for a speed boost', prices: [1500, 3200, 6400], max: 3 },
];

export function setupGarage(G) {
  G.garage = {
    owned: [],
    stored: [], // {color, kind, top}
    open: false,
    buySafehouse(id) {
      const spot = G.city.safehouseSpots.find((s) => s.id === id);
      if (!spot) return false;
      if (this.owned.includes(id)) { G.hud.toast('You already own the ' + spot.name); return false; }
      if (G.player.cash < spot.price) {
        G.hud.toast('Not enough cash — the ' + spot.name + ' costs ' + fmtCash(spot.price));
        G.audio?.click();
        return false;
      }
      G.player.cash -= spot.price;
      this.owned.push(id);
      G.hud.toast('BOUGHT: ' + spot.name + ' — ' + spot.desc);
      G.audio?.win();
      G.saveGame();
      return true;
    },
    buyUpgrade(id) {
      const up = UPGRADES.find((u) => u.id === id);
      const level = G.player.upgrades[id] || 0;
      if (level >= up.max) { G.hud.toast(up.name + ' is already maxed out'); return false; }
      const price = up.prices[level];
      if (G.player.cash < price) {
        G.hud.toast('Not enough cash — ' + up.name + ' Lv' + (level + 1) + ' costs ' + fmtCash(price));
        G.audio?.click();
        return false;
      }
      G.player.cash -= price;
      G.player.upgrades[id] = level + 1;
      G.hud.toast(up.name + ' upgraded to Lv' + (level + 1) + '!');
      G.audio?.win();
      G.saveGame();
      return true;
    },
    storeCar() {
      const car = G.player.car;
      if (!car) { G.hud.toast('Get in a car first, then store it'); return false; }
      const slots = this.totalSlots();
      if (this.stored.length >= slots) {
        G.hud.toast('Garage full (' + slots + ' slots) — buy a bigger safehouse');
        return false;
      }
      this.stored.push({ color: car.color, kind: car.kind, top: car.top });
      G.hud.toast('Car stored in your garage (' + this.stored.length + '/' + slots + ')');
      G.saveGame();
      return true;
    },
    totalSlots() {
      let slots = 1; // street parking always holds one
      for (const id of this.owned) {
        if (id === 'flat') slots += 1;
        if (id === 'loft') slots += 2;
        if (id === 'villa') slots += 4;
      }
      return slots;
    },
  };
  G.player.upgrades = { engine: 0, tires: 0, armor: 0, nitro: 0 };
  G.player.ownedSafehouses = G.garage.owned;
}

// Is the player standing near a safehouse marker? Returns the spot or null.
export function nearSafehouse(G) {
  const p = G.player;
  for (const s of G.city.safehouseSpots) {
    const dx = p.x - s.x, dz = p.z - s.z;
    if (dx * dx + dz * dz < 100) return s;
  }
  return null;
}

// Render the garage / property / upgrade shop panel into #garage-panel.
export function renderGaragePanel(G) {
  const el = document.getElementById('garage-panel');
  if (!el) return;
  const p = G.player;
  let html = '<h2>GARAGE &amp; PROPERTIES</h2>';
  html += '<div class="g-cash">Cash: <b>' + fmtCash(p.cash) + '</b> &nbsp; Slots: <b>' + G.garage.stored.length + '/' + G.garage.totalSlots() + '</b></div>';
  html += '<h3>Safehouses</h3>';
  for (const s of G.city.safehouseSpots) {
    const owned = G.garage.owned.includes(s.id);
    html += '<div class="g-row"><div><b>' + s.name + '</b><br><span class="g-sub">' + s.desc + '</span></div>' +
      (owned ? '<span class="g-owned">OWNED</span>' :
        '<button data-buy-house="' + s.id + '">' + fmtCash(s.price) + '</button>') + '</div>';
  }
  html += '<h3>Upgrades</h3>';
  for (const u of UPGRADES) {
    const level = p.upgrades[u.id] || 0;
    const maxed = level >= u.max;
    const price = maxed ? null : u.prices[level];
    html += '<div class="g-row"><div><b>' + u.name + ' — Lv' + level + '/' + u.max + '</b><br><span class="g-sub">' + u.desc + '</span></div>' +
      (maxed ? '<span class="g-owned">MAX</span>' :
        '<button data-buy-up="' + u.id + '">' + fmtCash(price) + '</button>') + '</div>';
  }
  html += '<h3>Stored cars</h3>';
  if (G.garage.stored.length === 0) html += '<div class="g-sub">No cars stored yet. Get in a car and press Store.</div>';
  for (let i = 0; i < G.garage.stored.length; i++) {
    const c = G.garage.stored[i];
    html += '<div class="g-row"><div><b>' + c.kind + '</b> — top ' + Math.round(c.top) + ' mph</div>' +
      '<button data-take-car="' + i + '">Take out</button></div>';
  }
  html += '<div class="g-row"><button data-store-car="1">Store current car</button>' +
    '<button data-close-garage="1">Close [G]</button></div>';
  el.innerHTML = html;
  el.querySelectorAll('[data-buy-house]').forEach((b) => b.onclick = () => { G.garage.buySafehouse(b.dataset.buyHouse); renderGaragePanel(G); });
  el.querySelectorAll('[data-buy-up]').forEach((b) => b.onclick = () => { G.garage.buyUpgrade(b.dataset.buyUp); renderGaragePanel(G); });
  el.querySelectorAll('[data-store-car]').forEach((b) => b.onclick = () => { G.garage.storeCar(); renderGaragePanel(G); });
  el.querySelectorAll('[data-take-car]').forEach((b) => b.onclick = () => { takeStoredCar(G, parseInt(b.dataset.takeCar, 10)); renderGaragePanel(G); });
  el.querySelectorAll('[data-close-garage]').forEach((b) => b.onclick = () => G.hud.toggleGarage(false));
}

export function takeStoredCar(G, idx) {
  const c = G.garage.stored[idx];
  if (!c) return;
  G.garage.stored.splice(idx, 1);
  // spawn it next to the player via the drive module (imported lazily to avoid a cycle)
  import('./drive.js').then((drive) => {
    const car = drive.createCar(G, G.player.x + 6, G.player.z + 4, G.player.heading, c.color, c.kind);
    car.top = c.top;
    G.hud.toast('Your ' + c.kind + ' is out of the garage');
  });
}
