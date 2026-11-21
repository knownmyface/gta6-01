// CORAL HEAT — the law. Wanted level 0-5 drives how many police cars
// hunt the player; at 3 stars a helicopter joins, orbiting low and ahead
// of the player with a visible searchlight beam; at 4 stars roadblocks
// with spike strips deploy on the road ahead. Wanted falls when the player
// stays clean and out of sight, and is synced to the player object the HUD
// and the missions read.
CH.cops = (function () {
  const U = CH.util;
  let spawnAt = 0, roadblockAt = 0;

  function makePoliceMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), new THREE.MeshLambertMaterial({ color: 0x11151c }));
    body.position.y = 0.55; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.0), new THREE.MeshLambertMaterial({ color: 0x18222e }));
    cabin.position.set(0, 1.1, -0.2); g.add(cabin);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.72; g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar.position.set(0, 1.5, -0.2); g.add(bar);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const wheels = [];
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
    }
    g.userData.wheels = wheels;
    return g;
  }

  function makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), new THREE.MeshLambertMaterial({ color: 0x1a2432 }));
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.4), new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
    glass.position.set(0, 0.1, 1.8); g.add(glass);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.0; g.add(rotor);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x1a2432 }));
    tail.position.set(0, 0.3, -4); g.add(tail);
    // Searchlight beam: a translucent cone from the belly to the ground.
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 42, 16, 1, true), beamMat);
    beam.rotation.x = Math.PI; beam.position.y = -21; g.add(beam);
    const spot = new THREE.SpotLight(0xfff2b0, 2.2, 90, 0.35, 0.5, 1.2);
    spot.position.set(0, -1, 0);
    g.add(spot); g.add(spot.target);
    g.userData = { rotor, beam, spot };
    return g;
  }

  function setWanted(n) {
    const S = CH.S;
    const v = U.clamp(Math.round(n), 0, 5);
    if (v !== S.player.wanted) {
      // A fresh chase gets 20 seconds before any decay can start, so the
      // first police car always has time to arrive.
      if (v > 0 && S.player.wanted === 0) S.police._decayAt = S.clock + 20;
      S.player.wanted = v;
      if (v >= 1) CH.sound.siren(true);
      else CH.sound.siren(false);
    }
  }
  function addWanted(n) { setWanted(CH.S.player.wanted + n); }

  function spawnPoliceCar(scene, nearX, nearZ) {
    const S = CH.S;
    const ang = U.rand(0, Math.PI * 2);
    const x = U.clamp(nearX + Math.sin(ang) * U.rand(45, 80), -290, 290);
    const z = U.clamp(nearZ + Math.cos(ang) * U.rand(45, 80), -290, 290);
    const mesh = makePoliceMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const car = { x, z, heading: 0, speed: 0, type: 'Police', color: 0x11151c, len: 4.4, top: 50, mesh, dead: false, isPlayer: false, isPolice: true };
    S.police.cars.push(car);
    return car;
  }

  function ensureHeli(scene) {
    const S = CH.S;
    if (S.police.heli || S.player.wanted < 3) return;
    const mesh = makeHeli();
    mesh.position.set(S.player.x + 30, 42, S.player.z - 20);
    scene.add(mesh);
    S.police.heli = { mesh, angle: 0, x: mesh.position.x, z: mesh.position.z };
  }
  function removeHeli(scene) {
    const S = CH.S;
    if (!S.police.heli) return;
    scene.remove(S.police.heli.mesh);
    S.police.heli = null;
  }

  function makeRoadblock(scene, x, z, heading) {
    const S = CH.S;
    const g = new THREE.Group();
    // Two angled police cars + a spike strip across the road.
    for (const off of [-4, 4]) {
      const car = makePoliceMesh();
      car.position.set(off, 0, 0);
      car.rotation.y = off > 0 ? 0.7 : -0.7;
      g.add(car);
    }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(13, 0.16, 1.4), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    strip.position.set(0, 0.1, 6); g.add(strip);
    for (let i = -6; i <= 6; i += 1.5) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
      spike.position.set(i, 0.45, 6); g.add(spike);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    const rb = { x, z, heading, mesh: g, until: S.clock + 26 };
    S.police.roadblocks.push(rb);
    return rb;
  }

  function update(dt, scene) {
    const S = CH.S, p = S.player;
    if (!p || S.mode !== 'play') return;
    const wanted = p.wanted;
    // ---- spawn / despawn police cars ------------------------------------
    if (wanted > 0 && S.clock > spawnAt) {
      spawnAt = S.clock + 4;
      const want = Math.min(wanted, 4);
      if (S.police.cars.length < want) spawnPoliceCar(scene, p.x, p.z);
    }
    if (wanted === 0) {
      for (const c of S.police.cars) scene.remove(c.mesh);
      S.police.cars.length = 0;
      removeHeli(scene);
      for (const rb of S.police.roadblocks) scene.remove(rb.mesh);
      S.police.roadblocks.length = 0;
    }
    // ---- chase -----------------------------------------------------------
    for (const c of S.police.cars) {
      if (c.dead) continue;
      const d = U.dist2(c.x, c.z, p.x, p.z);
      if (d > 420) { // too far: teleport back into the hunt
        const ang = U.rand(0, Math.PI * 2);
        c.x = U.clamp(p.x + Math.sin(ang) * 90, -290, 290);
        c.z = U.clamp(p.z + Math.cos(ang) * 90, -290, 290);
      }
      const want = Math.atan2(p.x - c.x, p.z - c.z);
      const steer = U.clamp(U.angDiff(c.heading, want), -1, 1);
      const throttle = d > 8;
      CH.drive.stepCar(c, dt, throttle, steer, false);
      if (d < 6.5) {
        // Ram: shove the player's car and chip its speed.
        if (p.car) { p.car.speed *= 0.97; p.car.x += Math.sin(c.heading) * 0.35; p.car.z += Math.cos(c.heading) * 0.35; }
        if (p.inCar && Math.abs(p.speed) < 4) p.health = Math.max(0, p.health - 0.5);
      }
    }
    // ---- helicopter: low orbit, ahead of the player -----------------------
    if (wanted >= 3) ensureHeli(scene);
    else removeHeli(scene);
    const heli = S.police.heli;
    if (heli) {
      heli.angle += dt * 0.55;
      const lead = 14; // stay ahead of the player's direction of travel
      const tx = p.x + Math.sin(p.heading) * lead + Math.sin(heli.angle) * 22;
      const tz = p.z + Math.cos(p.heading) * lead + Math.cos(heli.angle) * 22;
      heli.mesh.position.x = U.lerp(heli.mesh.position.x, tx, dt * 1.4);
      heli.mesh.position.z = U.lerp(heli.mesh.position.z, tz, dt * 1.4);
      heli.mesh.position.y = 24 + Math.sin(S.clock * 0.9) * 2;
      heli.x = heli.mesh.position.x; heli.z = heli.mesh.position.z;
      heli.mesh.userData.rotor.rotation.y += dt * 22;
      heli.mesh.userData.spot.target.position.set(p.x - heli.mesh.position.x, -heli.mesh.position.y, p.z - heli.mesh.position.z);
      heli.mesh.lookAt(p.x, 0, p.z);
      // The beam cone points down at the player.
      const beam = heli.mesh.userData.beam;
      beam.lookAt(0, 0, 0);
    }
    // ---- roadblocks at 4+ stars (never on the water) ----------------------
    if (wanted >= 4 && !p.inBoat && S.clock > roadblockAt) {
      roadblockAt = S.clock + 22;
      const ahead = 70;
      const bx = p.x + Math.sin(p.heading) * ahead;
      const bz = p.z + Math.cos(p.heading) * ahead;
      const rp = U.nearestRoadPoint(bx, bz);
      makeRoadblock(scene, rp.x, rp.z, p.heading);
      CH.hud.toast('ROADBLOCK AHEAD — SPIKE STRIPS DEPLOYED');
    }
    for (let i = S.police.roadblocks.length - 1; i >= 0; i--) {
      const rb = S.police.roadblocks[i];
      if (S.clock > rb.until) { scene.remove(rb.mesh); S.police.roadblocks.splice(i, 1); continue; }
      // Driving over the strip pops the tyres: hard speed cut for 6 seconds.
      if (p.inCar && Math.abs(p.x - rb.x) < 8 && Math.abs(p.z - rb.z) < 8) {
        S.police.spikeSlowUntil = S.clock + 6;
        CH.sound.noiseBurst(0.3, 0.5, 1800);
        CH.hud.toast('TYRES SPIKED — SLOW DOWN');
        scene.remove(rb.mesh); S.police.roadblocks.splice(i, 1);
      }
    }
    // ---- wanted decays when the player has genuinely escaped --------------
    // Only once police exist and all of them are far away; a fresh chase
    // must not decay on its first tick.
    if (wanted > 0 && S.clock > (S.police._decayAt || 0)) {
      S.police._decayAt = S.clock + 20;
      if (S.police.cars.length > 0) {
        const nearest = S.police.cars.reduce((m, c) => Math.min(m, U.dist2(c.x, c.z, p.x, p.z)), 9999);
        if (nearest > 60 && !S.race.active) setWanted(wanted - 1);
      }
    }
  }

  return { setWanted, addWanted, spawnPoliceCar, ensureHeli, removeHeli, makeRoadblock, update, makePoliceMesh };
})();
