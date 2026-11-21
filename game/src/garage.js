// garage.js — safehouses, garage collection, shops. The garage menu is a
// DOM panel: pick a car / bike / boat you own, buy new ones with cash, and
// buy weapons. Shops are small storefronts with a marker on the map.
import * as THREE from "../vendor/three/three.module.min.js";
import { $, formatCash } from "./util.js";
import { CAR_MODELS } from "./drive.js";
import { BIKE_MODELS } from "./bikes.js";
import { BOAT_MODELS } from "./boats.js";
import { WEAPONS } from "./fight.js";

export const SHOPS = [
  { id: "ammo-nation", name: "Harbor Arms", kind: "weapons", pos: { x: -60, z: -60 }, stock: ["pistol", "smg", "shotgun", "rifle"] },
  { id: "sunset-motors", name: "Sunset Motors", kind: "cars", pos: { x: 120, z: 60 }, stock: ["tide-sedan", "coral-coupe", "beach-buggy", "midnight-runner"] },
  { id: "neon-cycles", name: "Neon Cycles", kind: "bikes", pos: { x: -180, z: 120 }, stock: ["neon-600", "ember-1000"] },
  { id: "marina-sales", name: "Marina Boat Sales", kind: "boats", pos: { x: -180, z: -150 }, stock: ["harbor-skiff", "coral-speedster", "neon-yacht"] },
  { id: "coral-mart", name: "Coral Mart", kind: "snacks", pos: { x: 60, z: 180 }, stock: ["snack", "drink", "medkit"] },
];

const SNACKS = [
  { id: "snack", name: "Coral Chips", price: 15 },
  { id: "drink", name: "Tide Cola", price: 10 },
  { id: "medkit", name: "First-Aid Kit", price: 250 },
];

export function buildShops(G) {
  G.shops = SHOPS;
  for (const shop of SHOPS) {
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.3, 18),
      new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.5 }));
    marker.position.set(shop.pos.x, 0.25, shop.pos.z);
    G.scene.add(marker);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8, 5),
      new THREE.MeshBasicMaterial({ color: 0x7dff9a }));
    pole.position.set(shop.pos.x, 4, shop.pos.z);
    G.scene.add(pole);
  }
}

export function nearestShop(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const s of G.shops || []) {
    const dx = s.pos.x - G.player.pos.x;
    const dz = s.pos.z - G.player.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function catalogFor(shop) {
  if (shop.kind === "cars") return CAR_MODELS.filter((m) => shop.stock.includes(m.id));
  if (shop.kind === "bikes") return BIKE_MODELS.filter((m) => shop.stock.includes(m.id));
  if (shop.kind === "boats") return BOAT_MODELS.filter((m) => shop.stock.includes(m.id));
  if (shop.kind === "weapons") return WEAPONS.filter((w) => shop.stock.includes(w.id));
  return SNACKS;
}

function ownedList(G, kind) {
  if (!G.save) return [];
  if (kind === "cars") return G.save.ownedCars;
  if (kind === "bikes") return G.save.ownedBikes;
  if (kind === "boats") return G.save.ownedBoats;
  if (kind === "weapons") return G.save.weapons;
  return [];
}

export function openShop(G, shop) {
  const panel = $("shop-panel");
  const title = $("shop-title");
  const list = $("shop-list");
  if (!panel || !title || !list) return;
  title.textContent = shop.name + " — " + formatCash(G.save ? G.save.cash : 0);
  list.innerHTML = "";
  const owned = ownedList(G, shop.kind);
  for (const item of catalogFor(shop)) {
    const row = document.createElement("div");
    row.className = "shop-row";
    const has = owned.includes(item.id);
    const name = document.createElement("span");
    name.textContent = item.name;
    const price = document.createElement("span");
    price.textContent = has ? "OWNED" : formatCash(item.price);
    const btn = document.createElement("button");
    btn.textContent = has ? "Select" : "Buy";
    btn.onclick = () => {
      if (G.sound) { G.sound.ensure(); G.sound.uiClick(); }
      if (has) {
        selectOwned(G, shop.kind, item.id);
        closeShop(G);
        return;
      }
      if (!G.save || G.save.cash < item.price) {
        if (G.toast) G.toast("Not enough cash for " + item.name);
        return;
      }
      G.save.cash -= item.price;
      owned.push(item.id);
      if (G.hud) G.hud.setCash(G.save.cash);
      if (G.saveGame) G.saveGame();
      if (G.toast) G.toast("Bought " + item.name + " for " + formatCash(item.price));
      if (G.sound) G.sound.missionSting();
      openShop(G, shop);
    };
    row.appendChild(name);
    row.appendChild(price);
    row.appendChild(btn);
    list.appendChild(row);
  }
  const close = document.createElement("button");
  close.textContent = "Close (E)";
  close.className = "shop-close";
  close.onclick = () => closeShop(G);
  list.appendChild(close);
  panel.style.display = "block";
  G.shopOpen = shop;
}

export function closeShop(G) {
  const panel = $("shop-panel");
  if (panel) panel.style.display = "none";
  G.shopOpen = null;
}

export function selectOwned(G, kind, id) {
  if (!G.save) return;
  if (kind === "cars") {
    if (G.playerCar) G.scene.remove(G.playerCar.mesh);
    const { spawnPlayerCar } = G.driveApi || {};
    if (spawnPlayerCar) spawnPlayerCar(G, id, G.player.pos.x, G.player.pos.z, G.player.heading);
    G.player.mode = "car";
    if (G.playerMesh) G.playerMesh.visible = false;
  } else if (kind === "bikes") {
    if (G.playerBike) G.scene.remove(G.playerBike.mesh);
    if (G.spawnBike) G.spawnBike(G, id, G.player.pos.x, G.player.pos.z, G.player.heading);
    G.player.mode = "bike";
    if (G.playerMesh) G.playerMesh.visible = false;
  } else if (kind === "boats") {
    if (G.playerBoat) G.scene.remove(G.playerBoat.mesh);
    if (G.spawnBoat) G.spawnBoat(G, id, G.player.pos.x, -210, G.player.heading);
    G.player.pos.set(G.player.pos.x, 0, -215);
    G.player.mode = "boat";
    if (G.playerMesh) G.playerMesh.visible = false;
  } else if (kind === "weapons") {
    const idx = WEAPONS.findIndex((w) => w.id === id);
    if (idx >= 0) G.weaponIndex = idx;
    if (G.hud) G.hud.setWeapon(WEAPONS[idx]);
  }
  if (G.toast) G.toast("Selected " + id);
}

// Garage panel: lists everything owned, lets the player switch rides.
export function openGarage(G) {
  const panel = $("shop-panel");
  const title = $("shop-title");
  const list = $("shop-list");
  if (!panel || !title || !list) return;
  title.textContent = "Garage — " + (G.save ? formatCash(G.save.cash) : "");
  list.innerHTML = "";
  const groups = [
    { kind: "cars", items: CAR_MODELS, owned: (G.save || {}).ownedCars || [] },
    { kind: "bikes", items: BIKE_MODELS, owned: (G.save || {}).ownedBikes || [] },
    { kind: "boats", items: BOAT_MODELS, owned: (G.save || {}).ownedBoats || [] },
  ];
  for (const grp of groups) {
    for (const item of grp.items) {
      if (!grp.owned.includes(item.id)) continue;
      const row = document.createElement("div");
      row.className = "shop-row";
      const name = document.createElement("span");
      name.textContent = item.name + " (" + grp.kind + ")";
      const btn = document.createElement("button");
      btn.textContent = "Use";
      btn.onclick = () => {
        selectOwned(G, grp.kind, item.id);
        closeShop(G);
      };
      row.appendChild(name);
      row.appendChild(document.createElement("span"));
      row.appendChild(btn);
      list.appendChild(row);
    }
  }
  const close = document.createElement("button");
  close.textContent = "Close (E)";
  close.className = "shop-close";
  close.onclick = () => closeShop(G);
  list.appendChild(close);
  panel.style.display = "block";
  G.shopOpen = { id: "garage", name: "Garage", kind: "garage" };
}
