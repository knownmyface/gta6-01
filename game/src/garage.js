// CORAL HEAT — safehouses, garages and shops. Three safehouses around the
// city, each with a garage pad: drive a car onto the pad and press E to
// bank it as owned. Shops sell armour and health; both are small overlays,
// not separate scenes, so the game never leaves the open world.
CH.garage = (function () {
  const U = CH.util;
  const SAFEHOUSES = [
    { name: 'Palm Court Safehouse', x: -60, z: 120, color: 0x3a7bd5 },
    { name: 'Marina Safehouse', x: 180, z: 240, color: 0x2ec2a0 },
    { name: 'Casino Safehouse', x: -240, z: -240, color: 0xff2d95 },
  ];
  const SHOPS = [
    { name: 'Ammu Reef — Weapons', x: 120, z: -60, kind: 'weapons' },
    { name: 'Coral Clinic — Health', x: -120, z: 180, kind: 'health' },
    { name: 'Neon Auto — Armour', x: 60, z: -180, kind: 'armour' },
  ];

  function build(scene) {
    const S = CH.S;
    for (const sh of SAFEHOUSES) {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 12),
        new THREE.MeshBasicMaterial({ color: sh.color, transparent: true, opacity: 0.35 })
      );
      pad.rotation.x = -Math.PI / 2; pad.position.set(sh.x, 0.08, sh.z);
      scene.add(pad);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), new THREE.MeshLambertMaterial({ color: sh.color }));
      post.position.set(sh.x + 5, 2.5, sh.z + 5); scene.add(post);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: sh.color }));
      beacon.position.set(sh.x + 5, 5.4, sh.z + 5); scene.add(beacon);
      S.garage.safehouses.push({ ...sh });
    }
    for (const shop of SHOPS) {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.4, 0.2, 20),
        new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.5 })
      );
      marker.position.set(shop.x, 0.1, shop.z);
      scene.add(marker);
      S.garage.shops.push({ ...shop, marker });
    }
  }

  function nearestSafehouse(x, z) {
    let best = null, bd = 14;
    for (const sh of CH.S.garage.safehouses) {
      const d = U.dist2(x, z, sh.x, sh.z);
      if (d < bd) { bd = d; best = sh; }
    }
    return best;
  }
  function nearestShop(x, z) {
    let best = null, bd = 6;
    for (const sh of CH.S.garage.shops) {
      const d = U.dist2(x, z, sh.x, sh.z);
      if (d < bd) { bd = d; best = sh; }
    }
    return best;
  }

  function bankCar() {
    const S = CH.S, p = S.player;
    if (!p.inCar || !p.car) return false;
    const sh = nearestSafehouse(p.x, p.z);
    if (!sh) return false;
    if (!S.garage.owned.includes(p.car.type)) S.garage.owned.push(p.car.type);
    CH.savegame.autosave();
    CH.hud.toast('BANKED: ' + p.car.type.toUpperCase() + ' @ ' + sh.name.toUpperCase());
    CH.sound.missionDone();
    return true;
  }

  function buy(kind) {
    const S = CH.S, p = S.player;
    if (kind === 'health') {
      if (p.cash < 150) { CH.hud.toast('NOT ENOUGH CASH'); return false; }
      p.cash -= 150; p.health = 100;
      CH.hud.toast('HEALTH RESTORED — $150');
    } else if (kind === 'armour') {
      if (p.cash < 400) { CH.hud.toast('NOT ENOUGH CASH'); return false; }
      p.cash -= 400; p.armour = 100;
      CH.hud.toast('ARMOUR FITTED — $400');
    } else {
      if (p.cash < 250) { CH.hud.toast('NOT ENOUGH CASH'); return false; }
      p.cash -= 250; p.ammo = (p.ammo || 0) + 60;
      CH.hud.toast('AMMO +60 — $250');
    }
    CH.sound.pickup();
    CH.savegame.autosave();
    return true;
  }

  return { SAFEHOUSES, SHOPS, build, nearestSafehouse, nearestShop, bankCar, buy };
})();
