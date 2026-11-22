// CORAL HEAT — on foot: walking, running, jumping, camera.
// The camera sits directly behind the player (the fix learned from earlier
// rounds: never a side or front view), and the player is a simple stylised
// figure built from boxes so no external model is needed.
Coral.walk = (function () {
  'use strict';
  var U = Coral.util;

  function buildPlayerMesh() {
    var g = new THREE.Group();
    var skin = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.8 });
    var shirt = new THREE.MeshStandardMaterial({ color: 0x2fd8c8, roughness: 0.85 });
    var pants = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.9 });
    var hair = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), shirt);
    torso.position.y = 1.35;
    g.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.5), skin);
    head.position.y = 2.15;
    g.add(head);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.55), hair);
    cap.position.y = 2.45;
    g.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.36), pants);
    legL.position.set(-0.22, 0.45, 0);
    g.add(legL);
    var legR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.36), pants);
    legR.position.set(0.22, 0.45, 0);
    g.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), shirt);
    armL.position.set(-0.58, 1.35, 0);
    g.add(armL);
    var armR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), shirt);
    armR.position.set(0.58, 1.35, 0);
    g.add(armR);
    g.userData = { legL: legL, legR: legR, armL: armL, armR: armR, torso: torso };
    return g;
  }

  function makePlayer(state, x, z) {
    var mesh = buildPlayerMesh();
    mesh.position.set(x, 0, z);
    state.scene.add(mesh);
    var player = {
      mesh: mesh,
      x: x, z: z, y: 0,
      heading: 0,
      speed: 0,
      onFoot: true,
      car: null,
      health: 100,
      cash: 250,
      wanted: 0,
      vy: 0,
      grounded: true,
      walkPhase: 0,
      punchT: 0,
    };
    return player;
  }

  function updateOnFoot(state, dt) {
    var p = state.player;
    if (!p.onFoot) return;
    var k = state.keys;
    var fwd = 0, strafe = 0;
    if (k['KeyW'] || k['ArrowUp']) fwd += 1;
    if (k['KeyS'] || k['ArrowDown']) fwd -= 1;
    if (k['KeyA'] || k['ArrowLeft']) strafe -= 1;
    if (k['KeyD'] || k['ArrowRight']) strafe += 1;
    var sprint = (k['ShiftLeft'] || k['ShiftRight']) ? 1.8 : 1;
    var moveSpeed = 5.2 * sprint;
    var camYaw = state.camYaw || 0;
    var mx = Math.sin(camYaw) * fwd + Math.cos(camYaw) * strafe;
    var mz = Math.cos(camYaw) * fwd - Math.sin(camYaw) * strafe;
    var len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      p.heading = U.angleLerp(p.heading, Math.atan2(mx, mz), 1 - Math.exp(-12 * dt));
      var nx = p.x + mx * moveSpeed * dt;
      var nz = p.z + mz * moveSpeed * dt;
      var hit = Coral.city.hitsCollider(nx, nz, 0.7);
      if (!hit) { p.x = nx; p.z = nz; }
      p.speed = moveSpeed;
      p.walkPhase += dt * moveSpeed * 1.6;
    } else {
      p.speed = U.damp(p.speed, 0, 10, dt);
    }
    // Jump.
    if ((k['Space'] || k['KeyJ']) && p.grounded) {
      p.vy = 7.5;
      p.grounded = false;
      if (state.sound) state.sound.jump();
    }
    if (!p.grounded) {
      p.vy -= 22 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
    }
    // Punch.
    if (k['KeyF'] && p.punchT <= 0) {
      p.punchT = 0.45;
      if (state.fight) state.fight.punch(state);
    }
    if (p.punchT > 0) p.punchT -= dt;
    p.x = U.clamp(p.x, -305, 305);
    p.z = U.clamp(p.z, -305, 305);
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.y = p.heading;
    var u = p.mesh.userData;
    var swing = Math.sin(p.walkPhase) * 0.55 * U.clamp(p.speed / 5, 0, 1);
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    if (p.punchT > 0.2) u.armR.rotation.x = -1.6;
  }

  function updateCamera(state, dt) {
    var p = state.player;
    var cam = state.camera;
    var yaw = state.camYaw || 0;
    var pitch = state.camPitch === undefined ? 0.32 : state.camPitch;
    var dist = p.onFoot ? 8.5 : 11.5;
    var height = p.onFoot ? 3.4 : 4.2;
    if (p.car) {
      // Chase cam: directly behind the car, easing into place. The camera
      // sits at -forward * dist, so its yaw IS the car's heading.
      yaw = U.angleLerp(yaw, p.car.heading, 1 - Math.exp(-3.2 * dt));
      state.camYaw = yaw;
    }
    var tx = p.x - Math.sin(yaw) * dist;
    var tz = p.z - Math.cos(yaw) * dist;
    var ty = p.y + height + Math.sin(pitch) * dist * 0.4;
    cam.position.x = U.damp(cam.position.x, tx, 8, dt);
    cam.position.y = U.damp(cam.position.y, ty, 8, dt);
    cam.position.z = U.damp(cam.position.z, tz, 8, dt);
    cam.lookAt(p.x, p.y + 1.6, p.z);
  }

  function spawnPedestrians(state, count) {
    state.peds = state.peds || [];
    var shirtCols = [0xd83a6a, 0x3ad8a0, 0xf2d23d, 0xe8e8e8, 0x7a5ad8, 0x2f8ad8];
    for (var i = 0; i < count; i++) {
      var mesh = buildPlayerMesh();
      var mat = mesh.children[0].material;
      mesh.children[0].material = new THREE.MeshStandardMaterial({
        color: shirtCols[i % shirtCols.length], roughness: 0.85,
      });
      var gx = U.randi(-4, 4) * 62 + U.rand(-8, 8);
      var gz = U.randi(-4, 4) * 62 + U.rand(-8, 8);
      if (gz > 180) gz = U.rand(-180, 170);
      mesh.position.set(gx, 0, gz);
      mesh.scale.setScalar(U.rand(0.92, 1.08));
      state.scene.add(mesh);
      state.peds.push({
        mesh: mesh, x: gx, z: gz,
        heading: U.rand(0, Math.PI * 2),
        speed: U.rand(1.2, 2.4),
        walkPhase: U.rand(0, 6),
        pauseT: 0,
        fleeing: false,
      });
    }
    return state.peds;
  }

  function updatePedestrians(state, dt) {
    var list = state.peds || [];
    for (var i = 0; i < list.length; i++) {
      var pd = list[i];
      var dPlayer = U.dist2d(pd.x, pd.z, state.player.x, state.player.z);
      if (state.player.wanted >= 3 && dPlayer < 14) pd.fleeing = true;
      if (pd.fleeing && dPlayer > 30) pd.fleeing = false;
      if (pd.pauseT > 0) {
        pd.pauseT -= dt;
      } else {
        var sp = pd.fleeing ? 5.5 : pd.speed;
        var nx = pd.x + Math.sin(pd.heading) * sp * dt;
        var nz = pd.z + Math.cos(pd.heading) * sp * dt;
        if (Coral.city.hitsCollider(nx, nz, 0.7) || Math.abs(nx) > 300 || Math.abs(nz) > 300) {
          pd.heading += U.pick([-Math.PI / 2, Math.PI / 2, Math.PI]);
          pd.pauseT = U.rand(0.2, 1.2);
        } else {
          pd.x = nx; pd.z = nz;
          pd.walkPhase += dt * sp * 1.8;
        }
        if (U.chance(dt * 0.12)) {
          pd.heading += U.rand(-1.2, 1.2);
          if (U.chance(0.3)) pd.pauseT = U.rand(1, 4);
        }
      }
      pd.mesh.position.set(pd.x, 0, pd.z);
      pd.mesh.rotation.y = pd.heading;
      var u = pd.mesh.userData;
      var swing = Math.sin(pd.walkPhase) * 0.5;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.7;
      u.armR.rotation.x = swing * 0.7;
    }
  }

  return {
    makePlayer: makePlayer,
    buildPlayerMesh: buildPlayerMesh,
    updateOnFoot: updateOnFoot,
    updateCamera: updateCamera,
    spawnPedestrians: spawnPedestrians,
    updatePedestrians: updatePedestrians,
  };
})();
