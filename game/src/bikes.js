// CORAL HEAT — motorcycles. Three original models (a city scooter, a
// street cruiser and a sport bike) parked around the city; riding one is
// the same arcade model as a car, but quicker to turn and easier to knock
// over at speed. Mission 7 is built on the sport bike.
CH.bikes = (function () {
  const U = CH.util;
  const MODELS = [
    { type: 'Scooter', color: 0x2ec2a0, top: 34, accel: 12 },
    { type: 'Cruiser', color: 0xb03a2e, top: 46, accel: 15 },
    { type: 'Sport Bike', color: 0x1a1a22, top: 54, accel: 19 },
  ];

  function makeBikeMesh(color) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 1.1), bodyMat);
    tank.position.y = 0.72; tank.position.z = 0.1; g.add(tank);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.8), dark);
    seat.position.set(0, 0.82, -0.5); g.add(seat);
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), dark);
    fork.position.set(0, 0.62, 0.95); fork.rotation.x = 0.35; g.add(fork);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x101010 });
    const wheels = [];
    for (const wz of [0.95, -0.85]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 8, 16), wheelMat);
      w.position.set(0, 0.34, wz); g.add(w); wheels.push(w);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lamp.position.set(0, 0.78, 1.02); g.add(lamp);
    g.userData.wheels = wheels;
    return g;
  }

  function spawnBikes(scene) {
    const S = CH.S;
    const spots = [
      { x: 24, z: -120, m: 2 }, { x: -96, z: 60, m: 1 }, { x: 132, z: 228, m: 0 },
      { x: -204, z: -36, m: 1 }, { x: 60, z: -240, m: 2 }, { x: -12, z: 240, m: 0 },
    ];
    for (const s of spots) {
      const spec = MODELS[s.m];
      const mesh = makeBikeMesh(spec.color);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = U.rand(0, Math.PI * 2);
      scene.add(mesh);
      S.bikes.list.push({ x: s.x, z: s.z, heading: mesh.rotation.y, speed: 0, type: spec.type, top: spec.top, accel: spec.accel, mesh, taken: false });
    }
  }

  function nearestBike(x, z, maxD) {
    let best = null, bd = maxD;
    for (const b of CH.S.bikes.list) {
      if (b.taken) continue;
      const d = U.dist2(x, z, b.x, b.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function ride(dt) {
    const S = CH.S, p = S.player;
    if (!p.inBike || !p.bike) return;
    const k = S.input.keys;
    const b = p.bike;
    if (k.KeyW) b.speed = Math.min(b.speed + b.accel * dt, b.top);
    else b.speed = Math.max(b.speed - 8 * dt, 0);
    if (k.KeyS) b.speed = Math.max(b.speed - 22 * dt, -6);
    let steer = 0;
    if (k.KeyA) steer -= 1;
    if (k.KeyD) steer += 1;
    b.heading += steer * U.clamp(Math.abs(b.speed) / 10, 0, 1) * 2.4 * dt;
    const nx = b.x + Math.sin(b.heading) * b.speed * dt;
    const nz = b.z + Math.cos(b.heading) * b.speed * dt;
    const hit = CH.city.collide(nx, nz, 1.0);
    if (hit.x !== nx || hit.z !== nz) b.speed *= 0.5;
    b.x = U.clamp(hit.x, CH.CFG.cityMin, CH.CFG.cityMax);
    b.z = U.clamp(hit.z, CH.CFG.cityMin, CH.CFG.waterZ - 2);
    b.mesh.position.set(b.x, 0, b.z);
    b.mesh.rotation.y = b.heading;
    b.mesh.rotation.z = -steer * U.clamp(Math.abs(b.speed) / 20, 0, 1) * 0.35; // lean
    p.x = b.x; p.z = b.z; p.heading = b.heading; p.speed = b.speed;
    CH.sound.setEngine(Math.abs(b.speed) / CH.CFG.maxSpeed, true);
  }

  function mount(bike) {
    const S = CH.S, p = S.player;
    p.inBike = true; p.bike = bike; bike.taken = true;
    p.mesh.visible = false;
    p.mesh.position.set(bike.x, 0, bike.z);
    CH.sound.pickup();
  }
  function dismount() {
    const S = CH.S, p = S.player;
    if (!p.bike) return;
    p.bike.taken = false;
    p.x = p.bike.x - Math.sin(p.bike.heading) * 2;
    p.z = p.bike.z - Math.cos(p.bike.heading) * 2;
    p.inBike = false; p.bike = null; p.speed = 0;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    CH.sound.setEngine(0, false);
  }

  return { MODELS, makeBikeMesh, spawnBikes, nearestBike, ride, mount, dismount };
})();
