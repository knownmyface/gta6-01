// CORAL HEAT — cars. Arcade driving: throttle, brake/reverse, steering
// that bites harder at speed, handbrake slides, and a collision push-out
// against the city so cars never drive through a tower. Traffic cars follow
// the road grid and turn at intersections; the player's car is the same
// object with a different driver.
CH.drive = (function () {
  const U = CH.util;
  const CAR_TYPES = [
    { type: 'Sedan', color: 0xc23b2e, len: 4.4, top: 44 },
    { type: 'Coupe', color: 0x2e6fc2, len: 4.2, top: 48 },
    { type: 'SUV', color: 0x3a3f46, len: 4.8, top: 40 },
    { type: 'Taxi', color: 0xf2c230, len: 4.4, top: 42 },
    { type: 'Muscle', color: 0x7a1fa2, len: 4.6, top: 50 },
    { type: 'Pickup', color: 0x4a7a3a, len: 5.0, top: 41 },
  ];

  function makeCarMesh(color, len) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, len), bodyMat);
    body.position.y = 0.55; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, len * 0.45), glassMat);
    cabin.position.set(0, 1.1, -len * 0.06); g.add(cabin);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 0.5), bodyMat);
    nose.position.set(0, 0.5, len / 2 - 0.1); g.add(nose);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const wheels = [];
    for (const [wx, wz] of [[-0.95, len / 2 - 0.8], [0.95, len / 2 - 0.8], [-0.95, -len / 2 + 0.8], [0.95, -len / 2 + 0.8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz);
      g.add(w); wheels.push(w);
    }
    // Headlights: two small warm discs so night chases read.
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (const wx of [-0.6, 0.6]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lightMat);
      h.position.set(wx, 0.62, len / 2 + 0.12); g.add(h);
    }
    g.userData.wheels = wheels;
    return g;
  }

  function newCar(x, z, heading, spec) {
    const mesh = makeCarMesh(spec.color, spec.len);
    mesh.position.set(x, 0, z); mesh.rotation.y = heading;
    return {
      x, z, heading, speed: 0, type: spec.type, color: spec.color, len: spec.len,
      top: spec.top, mesh, dead: false, isPlayer: false, isPolice: false,
      axis: Math.abs(Math.sin(heading)) > 0.5 ? 'x' : 'z',
      dir: Math.abs(Math.sin(heading)) > 0.5
        ? (Math.sin(heading) >= 0 ? 1 : -1)
        : (Math.cos(heading) >= 0 ? 1 : -1),
      lane: 0, turnAt: 0, staged: false,
    };
  }

  function spawnTraffic(scene, count) {
    const S = CH.S;
    for (let i = 0; i < count; i++) {
      const spec = U.pick(CAR_TYPES);
      const gx = U.randi(-4, 4) * CH.CFG.roadStep, gz = U.randi(-4, 4) * CH.CFG.roadStep;
      const alongX = S.rng() < 0.5;
      const x = alongX ? U.rand(-280, 280) : gx + (S.rng() < 0.5 ? -3 : 3);
      const z = alongX ? gz + (S.rng() < 0.5 ? -3 : 3) : U.rand(-280, 280);
      const heading = alongX ? (S.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (S.rng() < 0.5 ? 0 : Math.PI);
      const car = newCar(x, z, heading, spec);
      car.speed = U.rand(7, 13);
      car.lane = S.rng() < 0.5 ? -3 : 3;
      scene.add(car.mesh);
      S.traffic.cars.push(car);
    }
  }

  function stepCar(car, dt, throttle, steer, brake) {
    // Arcade model shared by the player and the police.
    const accel = throttle ? 15 : 0;
    const top = car.top * (CH.S.clock < CH.S.police.spikeSlowUntil ? 0.35 : 1);
    if (throttle) car.speed = Math.min(car.speed + accel * dt, top);
    else car.speed = Math.max(car.speed - 6 * dt, 0);
    if (brake) car.speed = Math.max(car.speed - 26 * dt, car.speed > 1 ? 0 : -8);
    if (!throttle && !brake && car.speed < 0) car.speed = Math.min(car.speed + 10 * dt, 0);
    const steerAmount = steer * U.clamp(Math.abs(car.speed) / 12, 0, 1) * (car.speed < 0 ? -1 : 1);
    car.heading += steerAmount * 1.9 * dt * (CH.S.player && CH.S.player.handbrake ? 1.6 : 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const hit = CH.city.collide(nx, nz, 1.4);
    if (hit.x !== nx || hit.z !== nz) car.speed *= 0.55; // scrape, don't stop dead
    car.x = U.clamp(hit.x, CH.CFG.cityMin - 4, CH.CFG.cityMax + 4);
    car.z = U.clamp(hit.z, CH.CFG.cityMin - 4, CH.CFG.waterZ - 2);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    if (CH.S.player && CH.S.player.handbrake && Math.abs(car.speed) > 6) {
      car.mesh.rotation.z = steer * 0.08;
    } else {
      car.mesh.rotation.z *= 0.8;
    }
    const spin = car.speed * dt * 2.8;
    const wheels = car.mesh.userData.wheels || [];
    for (const w of wheels) w.rotation.x += spin;
  }

  function updatePlayerCar(dt) {
    const S = CH.S, p = S.player;
    if (!p.inCar || !p.car) return;
    p.mesh.visible = false; // never draw the on-foot figure inside a car
    const k = S.input.keys;
    const throttle = k.KeyW || k.ArrowUp;
    const brake = k.KeyS || k.ArrowDown || k.Space;
    let steer = 0;
    if (k.KeyA || k.ArrowLeft) steer -= 1;
    if (k.KeyD || k.ArrowRight) steer += 1;
    p.handbrake = !!k.Space;
    p.heading += (S.input.mouseDX || 0) * 0.0016;
    S.input.mouseDX = 0;
    stepCar(p.car, dt, throttle, steer, brake);
    p.x = p.car.x; p.z = p.car.z; p.heading = p.car.heading; p.speed = p.car.speed;
    CH.sound.setEngine(Math.abs(p.car.speed) / CH.CFG.maxSpeed, true);
  }

  function updateTraffic(dt) {
    const S = CH.S;
    for (const car of S.traffic.cars) {
      if (car.dead || car.isPlayer || car.staged) continue; // staged cars hold their pose
      // Follow the road grid: cruise along the current axis, and at an
      // intersection sometimes turn onto the crossing road.
      const onX = car.axis === 'x';
      const line = onX ? U.roadLine(car.z) : U.roadLine(car.x);
      const other = onX ? car.x : car.z;
      const nearCross = Math.abs(other - U.roadLine(other)) < 4;
      if (nearCross && S.clock > car.turnAt && S.rng() < 0.25) {
        car.axis = onX ? 'z' : 'x';
        car.dir = S.rng() < 0.5 ? 1 : -1;
        car.turnAt = S.clock + U.rand(3, 8);
      }
      const targetHeading = onX ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.heading += U.angDiff(car.heading, targetHeading) * Math.min(1, dt * 3);
      // Slow for the car ahead.
      let ahead = false;
      for (const o of S.traffic.cars) {
        if (o === car || o.dead) continue;
        const d = U.dist2(car.x, car.z, o.x, o.z);
        if (d < 9 && Math.abs(U.angDiff(car.heading, Math.atan2(o.x - car.x, o.z - car.z))) < 0.5) { ahead = true; break; }
      }
      const want = ahead ? 0 : U.rand(8, 13);
      car.speed += U.clamp(want - car.speed, -14 * dt, 8 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const hit = CH.city.collide(nx, nz, 1.4);
      car.x = hit.x; car.z = hit.z;
      // Keep the car glued to its road line.
      if (onX) car.z = U.lerp(car.z, line + car.lane, dt * 2);
      else car.x = U.lerp(car.x, line + car.lane, dt * 2);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }

  function nearestCar(x, z, maxD) {
    let best = null, bd = maxD;
    for (const car of CH.S.traffic.cars) {
      if (car.dead || car.isPlayer) continue;
      const d = U.dist2(x, z, car.x, car.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    const S = CH.S, p = S.player;
    p.inCar = true; p.car = car; car.isPlayer = true;
    p.mesh.visible = false;
    S.stats.carsStolen++;
    CH.sound.pickup();
  }
  function exitCar() {
    const S = CH.S, p = S.player;
    if (!p.car) return;
    p.car.isPlayer = false;
    const bx = p.car.x - Math.sin(p.car.heading) * 3;
    const bz = p.car.z - Math.cos(p.car.heading) * 3;
    const hit = CH.city.collide(bx, bz, 0.7);
    p.x = hit.x; p.z = hit.z;
    p.inCar = false; p.car = null; p.speed = 0;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    CH.sound.setEngine(0, false);
  }

  return { CAR_TYPES, makeCarMesh, newCar, spawnTraffic, stepCar, updatePlayerCar, updateTraffic, nearestCar, enterCar, exitCar };
})();
