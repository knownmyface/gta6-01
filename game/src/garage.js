// CORAL HEAT — shops, garage and safehouses.
// Marina Arms sells weapons, the garage stores and repairs cars, and three
// safehouses across the city save the game and clear a little heat.
Coral.garage = (function () {
  'use strict';
  var U = Coral.util;

  var SHOPS = [
    {
      id: 'arms', name: 'Marina Arms', kind: 'weapons',
      pos: { x: -124, z: 124 }, blurb: 'Pistols, SMGs, shotguns — cash only, no questions.',
      stock: [
        { id: 'pistol', name: 'P9 Pistol', price: 600 },
        { id: 'smg', name: 'Coral SMG', price: 1800 },
        { id: 'shotgun', name: 'Harbor 12', price: 2400 },
        { id: 'rifle', name: 'Sunset Rifle', price: 3600 },
        { id: 'molotov', name: 'Molotov (x4)', price: 400 },
      ],
    },
    {
      id: 'garage', name: 'Deke\u2019s Garage', kind: 'garage',
      pos: { x: -186, z: 62 }, blurb: 'Repairs, resprays and storage for your rides.',
      stock: [
        { id: 'repair', name: 'Full repair', price: 350 },
        { id: 'respray', name: 'Respray (random colour)', price: 500 },
        { id: 'armor', name: 'Armour plating', price: 1500 },
      ],
    },
    {
      id: 'clothes', name: 'Coral Row Threads', kind: 'clothes',
      pos: { x: 62, z: -62 }, blurb: 'Fresh shirts for a fresh start.',
      stock: [
        { id: 'shirt-neon', name: 'Neon shirt', price: 120 },
        { id: 'shirt-gold', name: 'Gold shirt', price: 200 },
        { id: 'shirt-coral', name: 'Coral shirt', price: 150 },
      ],
    },
    {
      id: 'food', name: 'Pier Diner', kind: 'food',
      pos: { x: -102, z: 210 }, blurb: 'Eat to heal. The coral chowder is worth the wait.',
      stock: [
        { id: 'meal', name: 'Coral chowder (heal +40)', price: 60 },
        { id: 'snack', name: 'Pier fries (heal +15)', price: 25 },
      ],
    },
  ];

  var SAFEHOUSES = [
    { id: 'plaza', name: 'Plaza Flat', pos: { x: -248, z: -62 }, price: 0 },
    { id: 'marina', name: 'Marina Loft', pos: { x: 248, z: 186 }, price: 5000 },
    { id: 'casino', name: 'Casino Suite', pos: { x: 248, z: 124 }, price: 20000 },
  ];

  var shopMeshes = [];

  function buildShops(state) {
    if (shopMeshes.length) return;
    var signCols = { weapons: 0xff5a3d, garage: 0xffd23d, clothes: 0x2fd8c8, food: 0xff8a3d };
    for (var i = 0; i < SHOPS.length; i++) {
      var s = SHOPS[i];
      var g = new THREE.Group();
      var hut = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 12),
        new THREE.MeshStandardMaterial({ color: 0x5a4a6a, roughness: 0.85 }));
      hut.position.y = 3.5;
      g.add(hut);
      var sign = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 0.6),
        new THREE.MeshBasicMaterial({ color: signCols[s.kind] || 0xffffff }));
      sign.position.set(0, 7.6, 5.8);
      g.add(sign);
      var awning = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 4),
        new THREE.MeshStandardMaterial({ color: signCols[s.kind] || 0xffffff, roughness: 0.8 }));
      awning.position.set(0, 5.2, 7);
      g.add(awning);
      var door = new THREE.Mesh(new THREE.BoxGeometry(3, 4.6, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.6 }));
      door.position.set(0, 2.3, 6.1);
      g.add(door);
      g.position.set(s.pos.x, 0, s.pos.z);
      state.scene.add(g);
      shopMeshes.push(g);
      Coral.city.hitsCollider && null;
    }
    // Safehouse markers: small houses with a green door light.
    for (var j = 0; j < SAFEHOUSES.length; j++) {
      var sh = SAFEHOUSES[j];
      var house = new THREE.Group();
      var walls = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 9),
        new THREE.MeshStandardMaterial({ color: 0x7a6a8a, roughness: 0.9 }));
      walls.position.y = 3;
      house.add(walls);
      var roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3.5, 4),
        new THREE.MeshStandardMaterial({ color: 0xd83a3a, roughness: 0.8 }));
      roof.position.y = 7.7;
      roof.rotation.y = Math.PI / 4;
      house.add(roof);
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x39ff88 }));
      lamp.position.set(0, 5.2, 4.6);
      house.add(lamp);
      house.position.set(sh.pos.x, 0, sh.pos.z);
      state.scene.add(house);
    }
  }

  function nearestShop(state, maxDist) {
    var best = null, bestD = maxDist;
    for (var i = 0; i < SHOPS.length; i++) {
      var d = U.dist2d(state.player.x, state.player.z, SHOPS[i].pos.x, SHOPS[i].pos.z);
      if (d < bestD) { bestD = d; best = SHOPS[i]; }
    }
    return best;
  }

  function nearestSafehouse(state, maxDist) {
    var best = null, bestD = maxDist;
    for (var i = 0; i < SAFEHOUSES.length; i++) {
      var d = U.dist2d(state.player.x, state.player.z, SAFEHOUSES[i].pos.x, SAFEHOUSES[i].pos.z);
      if (d < bestD) { bestD = d; best = SAFEHOUSES[i]; }
    }
    return best;
  }

  function buy(state, shop, itemId) {
    var item = null;
    for (var i = 0; i < shop.stock.length; i++) {
      if (shop.stock[i].id === itemId) item = shop.stock[i];
    }
    if (!item) return false;
    if (state.player.cash < item.price) {
      if (state.hud) state.hud.showToast('Not enough cash — ' + U.fmtMoney(item.price) + ' needed');
      return false;
    }
    state.player.cash -= item.price;
    if (shop.kind === 'weapons') {
      state.ammo = state.ammo || {};
      var w = null;
      var list = Coral.fight.WEAPONS;
      for (var k = 0; k < list.length; k++) if (list[k].id === item.id) w = list[k];
      if (w) {
        var add = item.id === 'molotov' ? 4 : w.ammo;
        state.ammo[item.id] = (state.ammo[item.id] || 0) + add;
      }
    } else if (shop.kind === 'garage') {
      var car = state.player.car;
      if (item.id === 'repair' && car) car.health = 100;
      if (item.id === 'respray' && car) {
        car.mesh.children[0].material.color.setHex(U.pick([0xd83a3a, 0x3a7ad8, 0xf2d23d, 0x2fd88a]));
      }
      if (item.id === 'armor' && car) car.armored = true;
    } else if (shop.kind === 'food') {
      state.player.health = U.clamp(state.player.health + (item.id === 'meal' ? 40 : 15), 0, 100);
    } else if (shop.kind === 'clothes') {
      state.player.shirt = item.id;
      var col = item.id === 'shirt-neon' ? 0x39ff88 : item.id === 'shirt-gold' ? 0xffd23d : 0xff7a5a;
      state.player.mesh.children[0].material.color.setHex(col);
    }
    if (state.hud) {
      state.hud.showToast('Bought — ' + item.name + ' · ' + U.fmtMoney(item.price));
      state.hud.updateCash();
    }
    if (state.sound) state.sound.buy();
    return true;
  }

  function enterSafehouse(state, house) {
    state.ownedHouses = state.ownedHouses || ['plaza'];
    if (state.ownedHouses.indexOf(house.id) === -1) {
      if (state.player.cash < house.price) {
        if (state.hud) state.hud.showToast(house.name + ' costs ' + U.fmtMoney(house.price));
        return false;
      }
      state.player.cash -= house.price;
      state.ownedHouses.push(house.id);
      if (state.hud) state.hud.showToast('You bought ' + house.name + '!');
    }
    state.player.health = 100;
    Coral.cops.setWanted(state, Math.max(0, state.player.wanted - 2), '');
    if (state.savegame) state.savegame.save(state);
    if (state.hud) {
      state.hud.showToast('Safehouse — health restored, game saved');
      state.hud.updateCash();
    }
    return true;
  }

  function ownedCars(state) {
    return state.ownedCars || [];
  }

  function storeCar(state, car) {
    state.ownedCars = state.ownedCars || [];
    if (state.ownedCars.indexOf(car) === -1) {
      state.ownedCars.push({ name: car.name, colorIdx: car.colorIdx, health: car.health });
    }
    if (state.hud) state.hud.showToast(car.name + ' stored in the garage');
  }

  return {
    SHOPS: SHOPS,
    SAFEHOUSES: SAFEHOUSES,
    buildShops: buildShops,
    nearestShop: nearestShop,
    nearestSafehouse: nearestSafehouse,
    buy: buy,
    enterSafehouse: enterSafehouse,
    ownedCars: ownedCars,
    storeCar: storeCar,
  };
})();
