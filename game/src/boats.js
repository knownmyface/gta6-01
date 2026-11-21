// CORAL HEAT — boats and the bay. Speedboats moor along the pier and run
// the open water south of the boulevard; police boats join the chase in
// the waterfront finale. Boats float on the animated water plane, leave a
// foam wake, and steer like a car with a long slide.
CH.boats = (function () {
  const U = CH.util;

  function makeBoatMesh(color) {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshLambertMaterial({ color });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 6.4), hullMat);
    hull.position.y = 0.55; g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 4), hullMat);
    bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.55, 4.1); g.add(bow);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 3.4), new THREE.MeshLambertMaterial({ color: 0xf0ead8 }));
    deck.position.set(0, 0.95, -0.6); g.add(deck);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.3), new THREE.MeshLambertMaterial({ color: 0x18222e, transparent: true, opacity: 0.8 }));
    windshield.position.set(0, 1.3, 1.0); g.add(windshield);
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    engine.position.set(0, 0.7, -3.3); g.add(engine);
    return g;
  }

  function spawnBoats(scene) {
    const S = CH.S;
    const spots = [
      { x: -14, z: 330, color: 0xe8e0c8 }, { x: 14, z: 344, color: 0x2e6fc2 },
      { x: -20, z: 358, color: 0xc23b2e }, { x: 20, z: 372, color: 0x3a7a3a },
    ];
    for (const s of spots) {
      const mesh = makeBoatMesh(s.color);
      mesh.position.set(s.x, 0.1, s.z);
      mesh.rotation.y = U.rand(-0.3, 0.3);
      scene.add(mesh);
      S.boats.list.push({ x: s.x, z: s.z, heading: mesh.rotation.y, speed: 0, mesh, taken: false, wake: 0 });
    }
  }

  function nearestBoat(x, z, maxD) {
    let best = null, bd = maxD;
    for (const b of CH.S.boats.list) {
      if (b.taken) continue;
      const d = U.dist2(x, z, b.x, b.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function stepBoat(b, dt, throttle, steer, brake) {
    if (throttle) b.speed = Math.min(b.speed + 11 * dt, 34);
    else b.speed = Math.max(b.speed - 4 * dt, 0);
    if (brake) b.speed = Math.max(b.speed - 16 * dt, 0);
    b.heading += steer * U.clamp(Math.abs(b.speed) / 12, 0, 1) * 1.5 * dt;
    const nx = b.x + Math.sin(b.heading) * b.speed * dt;
    const nz = b.z + Math.cos(b.heading) * b.speed * dt;
    b.x = U.clamp(nx, -360, 360);
    b.z = U.clamp(nz, CH.CFG.waterZ + 4, CH.CFG.bayFar - 6);
    b.mesh.position.set(b.x, 0.1 + Math.sin(CH.S.clock * 1.8 + b.x * 0.05) * 0.12, b.z);
    b.mesh.rotation.y = b.heading;
    b.mesh.rotation.z = -steer * U.clamp(Math.abs(b.speed) / 20, 0, 1) * 0.12;
    // Foam wake behind a fast boat.
    b.wake -= dt;
    if (Math.abs(b.speed) > 12 && b.wake <= 0) {
      b.wake = 0.12;
      CH.fx.wake(b.x - Math.sin(b.heading) * 3.4, b.z - Math.cos(b.heading) * 3.4);
    }
  }

  function sail(dt) {
    const S = CH.S, p = S.player;
    if (!p.inBoat || !p.boat) return;
    const k = S.input.keys;
    let steer = 0;
    if (k.KeyA) steer -= 1;
    if (k.KeyD) steer += 1;
    stepBoat(p.boat, dt, k.KeyW, steer, k.KeyS);
    p.x = p.boat.x; p.z = p.boat.z; p.heading = p.boat.heading; p.speed = p.boat.speed;
    CH.sound.setEngine(Math.abs(p.boat.speed) / 34, true);
  }

  function board(boat) {
    const S = CH.S, p = S.player;
    p.inBoat = true; p.boat = boat; boat.taken = true;
    p.mesh.visible = false;
    CH.sound.pickup();
  }
  function disembark() {
    const S = CH.S, p = S.player;
    if (!p.boat) return;
    p.boat.taken = false;
    // Step back onto the pier or the beach.
    p.x = U.clamp(p.boat.x, -300, 300);
    p.z = CH.CFG.waterZ - 2;
    p.inBoat = false; p.boat = null; p.speed = 0;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    CH.sound.setEngine(0, false);
  }

  function spawnPoliceBoat(scene, x, z) {
    const mesh = makeBoatMesh(0x1a2a4a);
    // Police livery: white stripe + light bar.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, 6.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.9; mesh.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.5, 0.4); mesh.add(bar);
    mesh.position.set(x, 0.1, z);
    scene.add(mesh);
    const b = { x, z, heading: 0, speed: 0, mesh, police: true, wake: 0 };
    CH.S.boats.policeBoats.push(b);
    return b;
  }

  function updatePoliceBoats(dt) {
    const S = CH.S, p = S.player;
    for (const b of S.boats.policeBoats) {
      const d = U.dist2(b.x, b.z, p.x, p.z);
      const want = Math.atan2(p.x - b.x, p.z - b.z);
      const steer = U.clamp(U.angDiff(b.heading, want), -1, 1);
      stepBoat(b, dt, d > 10, steer, false);
      // Ram the player's boat when close.
      if (d < 7 && p.inBoat) {
        p.boat.speed *= 0.94;
        CH.fx.sparks(p.x, p.z);
      }
    }
  }

  return { makeBoatMesh, spawnBoats, nearestBoat, stepBoat, sail, board, disembark, spawnPoliceBoat, updatePoliceBoats };
})();
