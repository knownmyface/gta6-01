// CORAL HEAT v2.8 — Coral Bay, the city itself: sunset streets, downtown
// towers, a beachfront with umbrellas and a lifeguard tower, and the marina
// district with docks and moored boats. Built once from a seed, then the game
// only asks it for colliders, roads and district names. Each district is its
// own builder so the city reads top to bottom like a map.

import * as THREE from 'three';
import { makeRandom } from './rng.js';

export const HALF_CITY = 260;
export const SHORE_X = -180; // west of this line is the bay
export const SAND_X = -156; // sand strip between water and Beachfront Ave

const BLOCK = 40;
const GRID = [];
for (let v = -240; v <= 240; v += BLOCK) GRID.push(v);

const PALETTE = [0xe8a06a, 0xd97b5f, 0xf2d8b0, 0x7fc4bd, 0xc96f6f, 0x8a7fb8, 0xe0b184, 0x5f8fa8];
const UMBRELLA_COLS = [0xff6b4a, 0x2fd4c4, 0xffd23f, 0xff8ab0];

function litWindows(dice) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b09a7e';
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 15) {
    for (let x = 9; x < 119; x += 15) {
      const on = dice.odds(0.58);
      g.fillStyle = on ? (dice.odds(0.68) ? '#ffe08a' : '#8fe4ff') : '#231d33';
      g.fillRect(x, y, 10, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(dice) {
  const tree = new THREE.Group();
  const h = dice.range(6, 9);
  const bark = new THREE.MeshLambertMaterial({ color: 0x8f6c48 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.28, h, 6), bark);
  trunk.position.y = h / 2;
  trunk.rotation.z = dice.range(-0.07, 0.07);
  tree.add(trunk);
  const leaf = new THREE.MeshLambertMaterial({ color: 0x43a854, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.6, 4), leaf);
    const a = (i / 7) * Math.PI * 2 + dice.range(-0.25, 0.25);
    frond.position.set(Math.cos(a) * 1.15, h + 0.1, Math.sin(a) * 1.15);
    frond.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    frond.scale.set(1, 1, 0.26);
    tree.add(frond);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0x6e4a2c }),
  );
  nuts.position.y = h - 0.15;
  tree.add(nuts);
  return tree;
}

function makeLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 5.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x2e2e3a }),
  );
  pole.position.y = 2.7;
  g.add(pole);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  glow.position.y = 5.5;
  g.add(glow);
  return g;
}

function makeUmbrella(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d2c0 }),
  );
  pole.position.y = 1.3;
  g.add(pole);
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 0.9, 8),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
  );
  top.position.y = 2.9;
  g.add(top);
  return g;
}

function paintSky(scene, dice) {
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      low: { value: new THREE.Color(0xff8f3d) },
      mid: { value: new THREE.Color(0xe85d75) },
      high: { value: new THREE.Color(0x2c1a5e) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 low; uniform vec3 mid; uniform vec3 high;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.3 ? mix(mid, high, smoothstep(0.3, 0.9, h))
        : mix(low, mid, smoothstep(-0.04, 0.3, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  // low sun, warm bounce, violet ambient
  const sun = new THREE.DirectionalLight(0xffb36b, 3.1);
  sun.position.set(-330, 95, -150);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffc9a0, 0x2a1e4a, 1.3));
  const fill = new THREE.DirectionalLight(0x7fb4ff, 0.35);
  fill.position.set(210, 130, 210);
  scene.add(fill);
  scene.fog = new THREE.Fog(0xe0705a, 250, 760);
  // sun disc and flat evening clouds
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(36, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  disc.position.set(-650, 70, -270);
  disc.lookAt(0, 40, 0);
  scene.add(disc);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffc2b0, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(dice.range(14, 30), 8, 6), cloudMat);
    cl.scale.y = 0.3;
    cl.position.set(dice.range(-430, 330), dice.range(120, 210), dice.range(-430, 130));
    scene.add(cl);
  }
}

function paintGround(group) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(490, HALF_CITY * 2 + 60),
    new THREE.MeshLambertMaterial({ color: 0xa89880 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = 65;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(30, HALF_CITY * 2 + 60),
    new THREE.MeshLambertMaterial({ color: 0xecc98d }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-168, 0.05, 0);
  group.add(sand);
}

function paintRoads(group) {
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x4a4758 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2a8 });
  const dashAt = (x, z, w, d) => {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.12, z);
    group.add(dash);
  };
  for (const v of GRID) {
    if (v < SAND_X) continue;
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(9, HALF_CITY * 2), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(v, 0.08, 0);
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(HALF_CITY * 2 + 160, 9), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(30, 0.08, v);
    group.add(ew);
    for (let d = -240; d <= 240; d += 14) {
      dashAt(v, d, 0.5, 3);
      dashAt(d, v, 3, 0.5);
    }
  }
  // Beachfront Ave, the coast road
  const coast = new THREE.Mesh(new THREE.PlaneGeometry(10, HALF_CITY * 2), roadMat);
  coast.rotation.x = -Math.PI / 2;
  coast.position.set(-150, 0.08, 0);
  group.add(coast);
}

function placeBuildings(group, dice, winTex, colliders) {
  const geoCache = new Map();
  const boxFor = (w, h, d) => {
    const key = `${w}|${h}|${d}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(key);
  };
  const downtown = (x, z) => Math.abs(x) < 90 && Math.abs(z) < 90;
  const skipped = (cx, cz) => {
    if (cx < SAND_X + 8) return true; // beach + water, no towers
    if (cx > -170 && cx < -130 && cz > 40 && cz < 240) return true; // marina yard
    if (Math.abs(cx) < 26 && Math.abs(cz) < 26) return true; // Coral Plaza (open)
    return false;
  };
  for (let gx = -240; gx < 240; gx += BLOCK) {
    for (let gz = -240; gz < 240; gz += BLOCK) {
      const cx = gx + BLOCK / 2;
      const cz = gz + BLOCK / 2;
      if (skipped(cx, cz)) continue;
      if (dice.odds(0.14)) continue; // pocket parks
      const tall = downtown(cx, cz);
      const count = dice.odds(0.6) ? 1 : 2;
      for (let b = 0; b < count; b++) {
        const w = dice.range(12, 22);
        const d = dice.range(12, 22);
        const h = tall ? dice.range(26, 68) : dice.range(8, 26);
        const ox = count === 1 ? 0 : (b === 0 ? -7 : 7);
        const oz = count === 1 ? 0 : (b === 0 ? 6 : -6);
        const col = dice.choose(PALETTE);
        const mat = new THREE.MeshLambertMaterial({ color: col, map: winTex, emissive: col, emissiveIntensity: 0.22 });
        const bld = new THREE.Mesh(boxFor(w, h, d), mat);
        bld.position.set(cx + ox, h / 2, cz + oz);
        group.add(bld);
        // rooftop box / AC unit so roofs read at sunset
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(dice.range(3, 6), 1.6, dice.range(3, 6)),
          new THREE.MeshLambertMaterial({ color: 0x4a4458 }),
        );
        roof.position.set(cx + ox + dice.range(-3, 3), h + 0.8, cz + oz + dice.range(-3, 3));
        group.add(roof);
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      }
    }
  }
}

function placePlaza(group, colliders) {
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }),
  );
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);
  const jet = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 5, 8),
    new THREE.MeshPhongMaterial({ color: 0xcfefff, transparent: true, opacity: 0.7 }),
  );
  jet.position.set(0, 4, 0);
  group.add(jet);
  colliders.push({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 });
}

function placeGreenery(group, dice) {
  for (const v of GRID) {
    if (v < SAND_X) continue;
    for (let d = -230; d <= 230; d += 46) {
      if (dice.odds(0.35)) continue;
      const p1 = makePalm(dice);
      p1.position.set(v + 7, 0, d);
      group.add(p1);
      const p2 = makePalm(dice);
      p2.position.set(d, 0, v + 7);
      group.add(p2);
      if (dice.odds(0.6)) {
        const lamp = makeLamp();
        lamp.position.set(v - 7, 0, d + 12);
        group.add(lamp);
      }
    }
  }
  for (let z = -240; z <= 240; z += 30) {
    const bp = makePalm(dice);
    bp.position.set(-164, 0, z + dice.range(-6, 6));
    group.add(bp);
  }
  // beach life: striped umbrellas and a lifeguard tower
  for (let i = 0; i < 8; i++) {
    const um = makeUmbrella(UMBRELLA_COLS[i % UMBRELLA_COLS.length]);
    um.position.set(-166, 0, -200 + i * 52 + dice.range(-6, 6));
    group.add(um);
  }
}

function placeLifeguard(group, colliders) {
  const tower = new THREE.Group();
  const legs = new THREE.MeshLambertMaterial({ color: 0xd8d2c0 });
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 6), legs);
    leg.position.set(lx, 1.8, lz);
    tower.add(leg);
  }
  const hut = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.8, 2.4),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  hut.position.y = 4.4;
  tower.add(hut);
  const towerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 1.1, 4),
    new THREE.MeshLambertMaterial({ color: 0xff6b4a }),
  );
  towerRoof.position.y = 5.9;
  towerRoof.rotation.y = Math.PI / 4;
  tower.add(towerRoof);
  tower.position.set(-164, 0, -40);
  group.add(tower);
  colliders.push({ minX: -165.4, maxX: -162.6, minZ: -41.4, maxZ: -38.6 });
}

function placeMarina(group, dice, winTex, colliders, slips) {
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const dockDefs = [
    { z: 84, len: 74 }, { z: 124, len: 88 }, { z: 164, len: 96 }, { z: 204, len: 80 },
  ];
  for (const dock of dockDefs) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(dock.len, 0.7, 5), dockMat);
    deck.position.set(-180 - dock.len / 2 + 4, 0.4, dock.z);
    group.add(deck);
    for (let s = 0; s < 3; s++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.6, 6), dockMat);
      post.position.set(-196 - s * 22, 0.9, dock.z + 2.2);
      group.add(post);
    }
    for (const side of [-1, 1]) {
      slips.push({
        x: -196 - dice.range(4, 18),
        z: dock.z + side * 8,
        heading: Math.PI / 2 + dice.range(-0.15, 0.15),
        kind: dice.choose(['runner', 'runner', 'queen', 'dinghy']),
      });
    }
  }
  // marina office + fuel shack on the yard
  const office = new THREE.Mesh(
    new THREE.BoxGeometry(18, 7, 12),
    new THREE.MeshLambertMaterial({ color: 0x2f7f8f, map: winTex }),
  );
  office.position.set(-146, 3.5, 150);
  group.add(office);
  colliders.push({ minX: -155, maxX: -137, minZ: 144, maxZ: 156 });
  const shack = new THREE.Mesh(
    new THREE.BoxGeometry(8, 4.5, 6),
    new THREE.MeshLambertMaterial({ color: 0xd97b5f }),
  );
  shack.position.set(-140, 2.25, 96);
  group.add(shack);
  colliders.push({ minX: -144, maxX: -136, minZ: 93, maxZ: 99 });
}

function placeWheel(group, dice, colliders) {
  const wheel = new THREE.Group();
  wheel.position.set(-158, 26, -120);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(15, 0.7, 8, 28),
    new THREE.MeshLambertMaterial({ color: 0xff8a5c }),
  );
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: dice.choose([0x2fd4c4, 0xffb347, 0xff6b4a, 0x9fe8ff]) }),
    );
    cab.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
    wheel.add(cab);
  }
  const legMat = new THREE.MeshLambertMaterial({ color: 0x5a4a6a });
  const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 30, 6), legMat);
  legA.position.set(-158, 13, -132);
  legA.rotation.x = 0.35;
  group.add(legA);
  const legB = legA.clone();
  legB.position.z = -108;
  legB.rotation.x = -0.35;
  group.add(legB);
  group.add(wheel);
  colliders.push({ minX: -166, maxX: -150, minZ: -128, maxZ: -112 });
  return wheel;
}

// District lookup: first matching rule wins, top to bottom.
const DISTRICT_RULES = [
  [(x) => x < SHORE_X, 'THE BAY'],
  [(x) => x < SAND_X, 'BEACHFRONT'],
  [(x, z) => x > -172 && x < -128 && z > 40 && z < 240, 'MARINA DISTRICT'],
  [(x, z) => Math.abs(x) < 26 && Math.abs(z) < 26, 'CORAL PLAZA'],
  [(x, z) => Math.abs(x) < 90 && Math.abs(z) < 90, 'DOWNTOWN'],
  [(x, z) => Math.abs(z) < 30, 'PALM ROW'],
  [(x, z) => z < -120, 'SUNSET STRIP'],
  [(x) => x > 120, 'OLD CORAL'],
  [(x, z) => z > 120, 'HARBOR HEIGHTS'],
];

function seedFor(tag) {
  let h = 918273;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return h + tag.length * 131;
}

export function buildBayCity(scene, tag) {
  const dice = makeRandom(seedFor(tag));
  const colliders = [];
  const slips = [];
  const group = new THREE.Group();
  group.name = 'coral-bay';
  scene.add(group);

  paintSky(scene, dice);
  paintGround(group);

  const oceanGeo = new THREE.PlaneGeometry(320, 620, 40, 48);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshPhongMaterial({ color: 0x1e6f92, shininess: 45, specular: 0x7a4a22, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-340, -0.5, 0);
  group.add(ocean);
  const oceanBase = oceanGeo.attributes.position.array.slice();

  paintRoads(group);
  const winTex = litWindows(dice);
  placeBuildings(group, dice, winTex, colliders);
  placePlaza(group, colliders);
  placeGreenery(group, dice);
  placeLifeguard(group, colliders);
  placeMarina(group, dice, winTex, colliders, slips);
  const wheel = placeWheel(group, dice, colliders);

  return {
    group,
    colliders,
    slips,
    ocean,
    oceanBase,
    wheel,
    roads: GRID,
    districtName(x, z) {
      for (const [test, name] of DISTRICT_RULES) {
        if (test(x, z)) return name;
      }
      return 'CORAL BAY';
    },
    // circle-vs-building test used by feet, cars and boats on land
    solid(x, z, r) {
      if (x < -HALF_CITY - 30 || x > HALF_CITY || z < -HALF_CITY || z > HALF_CITY) return true;
      for (const c of colliders) {
        if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
      }
      return false;
    },
    animate(dt, t) {
      const pos = oceanGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = oceanBase[i * 3];
        const by = oceanBase[i * 3 + 1];
        pos.setZ(i, Math.sin(bx * 0.08 + t * 1.1) * 0.35 + Math.cos(by * 0.06 + t * 0.8) * 0.3);
      }
      pos.needsUpdate = true;
      oceanGeo.computeVertexNormals();
      wheel.rotation.z += dt * 0.12;
    },
  };
}
