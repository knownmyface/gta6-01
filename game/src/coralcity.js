// CORAL HEAT — the city: sunset coastal marina city "Port Coral".
// Builds the ground, road grid, towers, neon casino district, marina + pier,
// palms, sky dome, sun glare and clouds. Everything is procedural boxes and
// cylinders with emissive windows/signs, so the whole city is local geometry.
Coral.city = (function () {
  'use strict';
  var U = Coral.util;

  var WORLD = 620;          // city spans -310 .. +310 on x and z
  var ROAD_STEP = 62;       // block size
  var ROAD_HALF = 7;        // half road width

  var colliders = [];       // {x, z, r} circles the player/cars cannot pass
  var roadLines = [];       // road centre lines, for traffic + minimap
  var built = null;

  function mat(color, emissive, emissiveIntensity, rough) {
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: emissive || 0x000000,
      emissiveIntensity: emissiveIntensity || 0,
      roughness: rough === undefined ? 0.9 : rough,
      metalness: 0.08,
    });
  }

  function box(scene, w, h, d, x, y, z, material) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = false;
    m.receiveShadow = false;
    scene.add(m);
    return m;
  }

  // One shared window texture (3 variants): a dark facade with random lit
  // panes, drawn once and reused as a single plane per tower face. This
  // keeps the lit-window look with 2 meshes per tower instead of ~90.
  var windowTextures = null;

  function windowTexture(variant) {
    if (!windowTextures) {
      windowTextures = [];
      for (var v = 0; v < 3; v++) {
        var cv = document.createElement('canvas');
        cv.width = 96;
        cv.height = 160;
        var cx = cv.getContext('2d');
        cx.fillStyle = '#101826';
        cx.fillRect(0, 0, 96, 160);
        var rng = U.makeRng(777 + v * 131);
        for (var r = 0; r < 10; r++) {
          for (var c = 0; c < 6; c++) {
            var lit = rng() < 0.5;
            cx.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9ad8ff') : '#05080f';
            cx.fillRect(4 + c * 15, 5 + r * 15, 11, 10);
          }
        }
        windowTextures.push(new THREE.CanvasTexture(cv));
      }
    }
    return windowTextures[variant % 3];
  }

  function litWindows(scene, bx, bz, w, h, d, floors) {
    var tex = windowTexture(Math.floor(Math.abs(bx + bz)) % 3);
    var m = new THREE.MeshBasicMaterial({ map: tex });
    for (var f = 0; f < 2; f++) {
      var face = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, h - 2), m);
      face.position.set(bx, h / 2, bz + (f === 0 ? d / 2 + 0.06 : -d / 2 - 0.06));
      face.rotation.y = f === 0 ? 0 : Math.PI;
      scene.add(face);
    }
  }

  function neonSign(scene, text, x, y, z, color, w) {
    // A glowing sign bar + a canvas-free glow plate. Text is drawn by the
    // HUD-less trick of stacked emissive bars spelling the word in blocks is
    // overkill; instead a bright plate with a contrasting rim reads as signage
    // at play distance, and the casino name is also shown on the HUD.
    var plate = box(scene, w, 3.2, 0.8, x, y, z,
      new THREE.MeshBasicMaterial({ color: color }));
    var rim = box(scene, w + 0.6, 3.8, 0.3, x, y, z - 0.3,
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    rim.position.z = z - 0.45;
    var glow = new THREE.PointLight(color, 60, 55, 1.6);
    glow.position.set(x, y, z + 6);
    scene.add(glow);
    var label = document.createElement('canvas');
    return { plate: plate, text: text };
  }

  function makeSky(scene) {
    // Gradient dome: deep orange horizon fading to violet overhead.
    var geo = new THREE.SphereGeometry(900, 24, 16);
    var top = new THREE.Color(0x2a1a5e);
    var mid = new THREE.Color(0xe85d3d);
    var bot = new THREE.Color(0xff9a3d);
    var colors = [];
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 900;
      var c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75)
        : mid.clone().lerp(bot, 1 - (y + 0.1) / 0.35);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    var sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false,
    }));
    scene.add(sky);

    // Low sun disc + glare sprite.
    var sun = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })
    );
    sun.position.set(-420, 95, -620);
    sun.lookAt(0, 60, 0);
    scene.add(sun);
    var halo = new THREE.Mesh(
      new THREE.CircleGeometry(70, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff8a3d, transparent: true, opacity: 0.28, fog: false,
      })
    );
    halo.position.set(-420, 95, -621);
    halo.lookAt(0, 60, 0);
    scene.add(halo);

    // Drifting clouds: flattened white blobs.
    var cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffd9c2, transparent: true, opacity: 0.55, fog: false,
    });
    for (var k = 0; k < 14; k++) {
      var cl = new THREE.Group();
      for (var j = 0; j < 4; j++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(U.rand(14, 30), 10, 8), cloudMat);
        puff.scale.y = 0.32;
        puff.position.set(j * 22 - 30 + U.rand(-6, 6), U.rand(-2, 3), U.rand(-8, 8));
        cl.add(puff);
      }
      cl.position.set(U.rand(-500, 500), U.rand(150, 260), U.rand(-500, 200));
      cl.userData.drift = U.rand(0.6, 1.8);
      scene.add(cl);
      (builtClouds).push(cl);
    }

    scene.fog = new THREE.Fog(0xdd6a4a, 180, 760);
    var hemi = new THREE.HemisphereLight(0xffb37a, 0x3a2a55, 0.85);
    scene.add(hemi);
    var sunLight = new THREE.DirectionalLight(0xffc07a, 1.5);
    sunLight.position.set(-260, 180, -320);
    scene.add(sunLight);
  }

  var builtClouds = [];

  function makeGround(scene) {
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD * 2.4, WORLD * 2.4),
      mat(0x4a4a52, 0x000000, 0, 1)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    // Roads: dark asphalt strips on the grid, with centre dashes.
    var asphalt = mat(0x23232c, 0x000000, 0, 1);
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
    for (var gx = -WORLD; gx <= WORLD; gx += ROAD_STEP) {
      box(scene, ROAD_HALF * 2, 0.12, WORLD * 2, gx, 0.02, 0, asphalt);
      box(scene, WORLD * 2, 0.12, ROAD_HALF * 2, 0, 0.02, gx, asphalt);
      roadLines.push({ x: gx, z: 0, along: 'z' });
      roadLines.push({ x: 0, z: gx, along: 'x' });
      // One solid centre line per road (a dashed look costs thousands of
      // meshes; a single thin strip reads the same at play distance).
      box(scene, 0.7, 0.14, WORLD * 2, gx, 0.04, 0, dashMat);
      box(scene, WORLD * 2, 0.14, 0.7, 0, 0.04, gx, dashMat);
    }
  }

  function makeTowers(scene) {
    var palette = [0x8a7f8a, 0x6f7f96, 0x9a8a6a, 0x7a6a8a, 0x5f6a7a, 0xaa7a5a];
    var rng = U.makeRng(20261122);
    // Blocks sit BETWEEN the roads (offset by half a step): towers centred
    // on road lines would block every road. Block centres are 31 units
    // from the nearest road, so roads stay clear for driving.
    for (var bx = -WORLD + ROAD_STEP / 2; bx < WORLD; bx += ROAD_STEP) {
      for (var bz = -WORLD + ROAD_STEP / 2; bz < WORLD; bz += ROAD_STEP) {
        // Keep the casino block, the marina strip and the central plaza open.
        if (bz > 170) continue;                    // marina waterfront
        if (bx > 150 && bz > 60 && bz < 170) continue; // casino district
        if (Math.abs(bx) < 40 && Math.abs(bz) < 40) continue; // plaza
        if (rng() < 0.18) continue;                // empty lots / parks
        var w = 20 + rng() * 14;
        var d = 20 + rng() * 14;
        var h = 14 + rng() * rng() * 70;
        var cx = bx + (rng() - 0.5) * 12;
        var cz = bz + (rng() - 0.5) * 12;
        var tower = box(scene, w, h, d, cx, h / 2, cz,
          mat(palette[Math.floor(rng() * palette.length)], 0x000000, 0, 0.95));
        box(scene, w + 2, 1.2, d + 2, cx, h + 0.6, cz, mat(0x3a3a44, 0x000000, 0, 1));
        litWindows(scene, cx, cz, w, h, d, Math.floor(h / 9));
        colliders.push({ x: cx, z: cz, r: Math.max(w, d) * 0.72 });
      }
    }
  }

  function makeCasinoDistrict(scene) {
    // North-east block: the Golden Coral Casino + neon strip.
    var casino = box(scene, 64, 30, 40, 205, 15, 115,
      mat(0x2a1a3a, 0x1a0a2a, 0.7, 0.6));
    box(scene, 66, 2, 42, 205, 31, 115, mat(0x111122, 0x000000, 0, 0.8));
    litWindows(scene, 205, 115, 64, 30, 40, 4);
    colliders.push({ x: 205, z: 115, r: 42 });

    neonSign(scene, 'GOLDEN CORAL', 205, 34, 96, 0xff2fd6, 58);
    neonSign(scene, 'CASINO', 205, 27, 96, 0x2fe8ff, 30);
    var signColors = [0xff2fd6, 0x2fe8ff, 0xffd23d, 0x39ff88, 0xff5a3d];
    for (var i = 0; i < 8; i++) {
      var sx = 150 + i * 16;
      var sc = signColors[i % signColors.length];
      box(scene, 9, 5, 1, sx, 12 + (i % 3) * 4, 92,
        new THREE.MeshBasicMaterial({ color: sc }));
      var pl = new THREE.PointLight(sc, 22, 30, 1.8);
      pl.position.set(sx, 14, 100);
      scene.add(pl);
    }
    // Neon strip buildings with lit fronts.
    for (var k = 0; k < 5; k++) {
      var nx = 150 + k * 26;
      box(scene, 20, 12 + k * 2, 18, nx, 6 + k, 140,
        mat(0x3a2a4a, signColors[k % signColors.length], 0.35, 0.7));
      colliders.push({ x: nx, z: 140, r: 15 });
    }
    return { x: 205, z: 115 };
  }

  function makeMarina(scene) {
    // South strip (z > 190): water, pier, moored boats, boulevard.
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 260),
      new THREE.MeshStandardMaterial({
        color: 0x1a5a8a, emissive: 0x0a2a4a, emissiveIntensity: 0.5,
        roughness: 0.25, metalness: 0.55,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.15, 330);
    scene.add(water);

    var pier = box(scene, 130, 1.4, 10, -40, 0.8, 235, mat(0x8a6a4a, 0x000000, 0, 1));
    box(scene, 130, 0.6, 1, -40, 1.7, 230, mat(0xd8c25a, 0x000000, 0, 1));
    // Moored boats: hull + cabin silhouettes bobbing at the pier.
    var hullCols = [0xf2f2f2, 0xffd23d, 0x2fe8ff, 0xff5a3d];
    for (var i = 0; i < 6; i++) {
      var hx = -95 + i * 22;
      var hull = box(scene, 9, 2.4, 4, hx, 1.2, 252, mat(hullCols[i % 4], 0x000000, 0, 0.4));
      hull.userData.bobPhase = i * 1.3;
      box(scene, 4, 2, 3, hx, 3.2, 252, mat(0x223344, 0x000000, 0, 0.5));
      (builtBoats).push(hull);
    }
    // Marina-front boulevard palms.
    for (var p = -280; p <= 280; p += 28) {
      makePalm(scene, p, 198);
    }
    return { x: -40, z: 235 };
  }

  var builtBoats = [];

  function makePalm(scene, x, z) {
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 11, 7),
      mat(0x7a5a3a, 0x000000, 0, 1)
    );
    trunk.position.set(x, 5.5, z);
    trunk.rotation.z = U.rand(-0.08, 0.08);
    scene.add(trunk);
    var frondMat = mat(0x2a8a4a, 0x000000, 0, 1);
    for (var i = 0; i < 6; i++) {
      var frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 5), frondMat);
      var a = (i / 6) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 2.6, 11.4, z + Math.sin(a) * 2.6);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      scene.add(frond);
    }
    colliders.push({ x: x, z: z, r: 1.4 });
  }

  function makePlaza(scene) {
    // Central plaza: fountain + palms + benches, no buildings on the roads.
    var basin = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 11, 1.6, 20),
      mat(0x9a9aa8, 0x000000, 0, 0.8)
    );
    basin.position.set(0, 0.8, 0);
    scene.add(basin);
    var jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 2.2, 7, 10),
      new THREE.MeshBasicMaterial({ color: 0x7ad8ff, transparent: true, opacity: 0.7 })
    );
    jet.position.set(0, 4.5, 0);
    scene.add(jet);
    colliders.push({ x: 0, z: 0, r: 12 });
    var spots = [[-24, -24], [24, -24], [-24, 24], [24, 24], [-40, 0], [40, 0]];
    for (var i = 0; i < spots.length; i++) makePalm(scene, spots[i][0], spots[i][1]);
  }

  function makeStreetlights(scene) {
    var poleMat = mat(0x2a2a32, 0x000000, 0, 0.7);
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    for (var gx = -WORLD; gx <= WORLD; gx += ROAD_STEP * 2) {
      for (var gz = -WORLD; gz <= WORLD; gz += ROAD_STEP * 2) {
        if (gz > 170) continue;
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 9, 6), poleMat);
        pole.position.set(gx + ROAD_HALF + 1.5, 4.5, gz + ROAD_HALF + 1.5);
        scene.add(pole);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bulbMat);
        bulb.position.set(gx + ROAD_HALF + 1.5, 9.2, gz + ROAD_HALF + 1.5);
        scene.add(bulb);
      }
    }
  }

  function build(scene) {
    built = scene;
    builtClouds = [];
    builtBoats = [];
    colliders = [];
    roadLines = [];
    makeSky(scene);
    makeGround(scene);
    makeTowers(scene);
    var casino = makeCasinoDistrict(scene);
    var marina = makeMarina(scene);
    makePlaza(scene);
    makeStreetlights(scene);
    // Extra palms along the sunset boulevard.
    for (var p = -280; p <= 280; p += 56) {
      makePalm(scene, p, -186);
      makePalm(scene, -186, p);
    }
    return {
      colliders: colliders,
      roadLines: roadLines,
      casino: casino,
      marina: marina,
      world: WORLD,
      roadStep: ROAD_STEP,
      roadHalf: ROAD_HALF,
      clouds: builtClouds,
      boats: builtBoats,
    };
  }

  function update(dt, t) {
    for (var i = 0; i < builtClouds.length; i++) {
      var c = builtClouds[i];
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 560) c.position.x = -560;
    }
    for (var j = 0; j < builtBoats.length; j++) {
      var b = builtBoats[j];
      b.position.y = 1.2 + Math.sin(t * 0.9 + b.userData.bobPhase) * 0.25;
      b.rotation.z = Math.sin(t * 0.7 + b.userData.bobPhase) * 0.02;
    }
  }

  function hitsCollider(x, z, radius) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (U.dist2d(x, z, c.x, c.z) < c.r + radius) return c;
    }
    return null;
  }

  function nearestRoadPoint(x, z) {
    var best = null;
    var bestD = 1e9;
    for (var i = 0; i < roadLines.length; i++) {
      var r = roadLines[i];
      var d = r.along === 'z' ? Math.abs(x - r.x) : Math.abs(z - r.z);
      if (d < bestD) { bestD = d; best = r; }
    }
    return { road: best, dist: bestD };
  }

  return {
    build: build,
    update: update,
    hitsCollider: hitsCollider,
    nearestRoadPoint: nearestRoadPoint,
    WORLD: WORLD,
  };
})();
