// Coral Heat — Coral Bay itself: sunset streets, downtown towers, the beachfront,
// and the marina district with its docks and moored boats. Built once from a seed,
// then left alone; the game only asks it for colliders, roads and district names.

import * as THREE from 'three';
import { makeDice, clamp } from './rng.js';

export const CITY_HALF = 260;
export const WATER_EDGE = -180;   // west of this line is the bay
export const BEACH_EDGE = -156;   // sand strip between water and Beachfront Ave

const ROAD_STEP = 40;
const ROAD_LINES = [];
for (let v = -240; v <= 240; v += ROAD_STEP) ROAD_LINES.push(v);

function windowsTexture(dice) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a89a86'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      const lit = dice.chance(0.55);
      g.fillStyle = lit ? (dice.chance(0.7) ? '#ffd98a' : '#9fe8ff') : '#241f33';
      g.fillRect(x, y, 10, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function palmTree(dice) {
  const tree = new THREE.Group();
  const h = dice.span(5.5, 8.5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, h, 6), trunkMat);
  trunk.position.y = h / 2;
  trunk.rotation.z = dice.span(-0.06, 0.06);
  tree.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), frondMat);
    const a = (i / 7) * Math.PI * 2 + dice.span(-0.2, 0.2);
    frond.position.set(Math.cos(a) * 1.1, h + 0.15, Math.sin(a) * 1.1);
    frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    frond.scale.set(1, 1, 0.28);
    tree.add(frond);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
  );
  nuts.position.y = h - 0.1;
  tree.add(nuts);
  return tree;
}

function lampPost() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x2c2c38 }),
  );
  pole.position.y = 2.6;
  g.add(pole);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8 }),
  );
  bulb.position.y = 5.3;
  g.add(bulb);
  return g;
}

export function buildWorld(scene, seedText) {
  const dice = makeDice(918273 + seedText.length * 131);
  const colliders = [];
  const palms = [];
  const slips = [];
  const group = new THREE.Group();
  group.name = 'coral-bay';
  scene.add(group);

  // --- sky dome: a cheap gradient shell, sunset orange low, violet high ---
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      low: { value: new THREE.Color(0xff8a3d) },
      mid: { value: new THREE.Color(0xe85d75) },
      high: { value: new THREE.Color(0x2c1a5e) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 low; uniform vec3 mid; uniform vec3 high;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.28 ? mix(mid, high, smoothstep(0.28, 0.85, h))
        : mix(low, mid, smoothstep(-0.05, 0.28, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // --- lights: low sun + warm bounce + violet ambient ---
  const sun = new THREE.DirectionalLight(0xffb36b, 3.0);
  sun.position.set(-320, 90, -140);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffc9a0, 0x2a1e4a, 1.25));
  const fill = new THREE.DirectionalLight(0x7fb4ff, 0.35);
  fill.position.set(200, 120, 200);
  scene.add(fill);
  scene.fog = new THREE.Fog(0xe0705a, 260, 780);

  // --- sun disc + a few flat clouds ---
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  disc.position.set(-640, 66, -260);
  disc.lookAt(0, 40, 0);
  scene.add(disc);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffc2b0, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(dice.span(14, 30), 8, 6), cloudMat);
    cl.scale.y = 0.32;
    cl.position.set(dice.span(-420, 320), dice.span(120, 210), dice.span(-420, 120));
    scene.add(cl);
  }

  // --- ground: warm concrete from the water's edge east; the bay is water ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(490, CITY_HALF * 2 + 60),
    new THREE.MeshLambertMaterial({ color: 0xa89880 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = 65;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(30, CITY_HALF * 2 + 60),
    new THREE.MeshLambertMaterial({ color: 0xecc98d }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-168, 0.05, 0);
  group.add(sand);

  const oceanGeo = new THREE.PlaneGeometry(320, 620, 40, 48);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshPhongMaterial({ color: 0x1e6f92, shininess: 120, specular: 0xff9a5c, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-340, -0.5, 0);
  group.add(ocean);
  const oceanBase = oceanGeo.attributes.position.array.slice();

  // --- roads: asphalt ribbons + dashes, on the grid lines ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x4a4758 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2a8 });
  for (const v of ROAD_LINES) {
    if (v < BEACH_EDGE) continue;
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(9, CITY_HALF * 2), roadMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(v, 0.08, 0);
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 160, 9), roadMat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(30, 0.08, v);
    group.add(ew);
    for (let d = -240; d <= 240; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(v, 0.12, d);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), dashMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.12, v);
      group.add(dash2);
    }
  }
  // Beachfront Ave, the coast road
  const coast = new THREE.Mesh(new THREE.PlaneGeometry(10, CITY_HALF * 2), roadMat);
  coast.rotation.x = -Math.PI / 2; coast.position.set(-150, 0.08, 0);
  group.add(coast);

  // --- buildings: one or two per block, taller downtown, coral/cream/teal ---
  const winTex = windowsTexture(dice);
  const palette = [0xe8a06a, 0xd97b5f, 0xf2d8b0, 0x7fc4bd, 0xc96f6f, 0x8a7fb8, 0xe0b184, 0x5f8fa8];
  const geoCache = new Map();
  const boxFor = (w, h, d) => {
    const key = `${w}|${h}|${d}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(key);
  };
  const downtown = (x, z) => Math.abs(x) < 90 && Math.abs(z) < 90;
  for (let gx = -240; gx < 240; gx += ROAD_STEP) {
    for (let gz = -240; gz < 240; gz += ROAD_STEP) {
      const cx = gx + ROAD_STEP / 2, cz = gz + ROAD_STEP / 2;
      if (cx < BEACH_EDGE + 8) continue;                    // beach + water, no towers
      if (cx > -170 && cx < -130 && cz > 40 && cz < 240) continue; // marina yard
      if (Math.abs(cx) < 26 && Math.abs(cz) < 26) continue; // Coral Plaza (open)
      if (dice.chance(0.14)) continue;                      // pocket parks
      const tall = downtown(cx, cz);
      const count = dice.chance(0.6) ? 1 : 2;
      for (let b = 0; b < count; b++) {
        const w = dice.span(12, 22), d = dice.span(12, 22);
        const h = tall ? dice.span(26, 68) : dice.span(8, 26);
        const ox = count === 1 ? 0 : (b === 0 ? -7 : 7);
        const oz = count === 1 ? 0 : (b === 0 ? 6 : -6);
        const col = dice.pick(palette);
        const mat = new THREE.MeshLambertMaterial({ color: col, map: winTex, emissive: col, emissiveIntensity: 0.22 });
        const bld = new THREE.Mesh(boxFor(w, h, d), mat);
        bld.position.set(cx + ox, h / 2, cz + oz);
        group.add(bld);
        // rooftop box / AC unit so roofs read at sunset
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(dice.span(3, 6), 1.6, dice.span(3, 6)),
          new THREE.MeshLambertMaterial({ color: 0x4a4458 }),
        );
        roof.position.set(cx + ox + dice.span(-3, 3), h + 0.8, cz + oz + dice.span(-3, 3));
        group.add(roof);
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      }
    }
  }

  // --- Coral Plaza: fountain + benches in the open centre ---
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

  // --- palms along every road + the beach, lamps on the avenues ---
  for (const v of ROAD_LINES) {
    if (v < BEACH_EDGE) continue;
    for (let d = -230; d <= 230; d += 46) {
      if (dice.chance(0.35)) continue;
      const p1 = palmTree(dice);
      p1.position.set(v + 7, 0, d);
      group.add(p1); palms.push(p1);
      const p2 = palmTree(dice);
      p2.position.set(d, 0, v + 7);
      group.add(p2); palms.push(p2);
      if (dice.chance(0.6)) {
        const lamp = lampPost();
        lamp.position.set(v - 7, 0, d + 12);
        group.add(lamp);
      }
    }
  }
  for (let z = -240; z <= 240; z += 30) {
    const bp = palmTree(dice);
    bp.position.set(-164, 0, z + dice.span(-6, 6));
    group.add(bp); palms.push(bp);
  }

  // --- marina district: wooden docks reaching into the bay, slips for boats ---
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const dockDefs = [
    { z: 80, len: 74 }, { z: 120, len: 88 }, { z: 160, len: 96 }, { z: 200, len: 80 },
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
    // two slips per dock, boats moored bow-out
    for (const side of [-1, 1]) {
      slips.push({
        x: -196 - dice.span(4, 18), z: dock.z + side * 8,
        heading: Math.PI / 2 + dice.span(-0.15, 0.15),
        kind: dice.pick(['speedboat', 'speedboat', 'yacht', 'skiff']),
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

  // --- ferris wheel on the beachfront, the postcard silhouette ---
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
      new THREE.MeshLambertMaterial({ color: dice.pick([0x2fd4c4, 0xffb347, 0xff6b4a, 0x9fe8ff]) }),
    );
    cab.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
    wheel.add(cab);
  }
  const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 30, 6), new THREE.MeshLambertMaterial({ color: 0x5a4a6a }));
  legA.position.set(-158, 13, -132); legA.rotation.x = 0.35;
  group.add(legA);
  const legB = legA.clone(); legB.position.z = -108; legB.rotation.x = -0.35;
  group.add(legB);
  group.add(wheel);
  colliders.push({ minX: -166, maxX: -150, minZ: -128, maxZ: -112 });

  return {
    group, colliders, slips, ocean, oceanBase, wheel,
    roads: ROAD_LINES,
    districtAt(x, z) {
      if (x < WATER_EDGE) return 'THE BAY';
      if (x < BEACH_EDGE) return 'BEACHFRONT';
      if (x > -172 && x < -128 && z > 40 && z < 240) return 'MARINA DISTRICT';
      if (Math.abs(x) < 26 && Math.abs(z) < 26) return 'CORAL PLAZA';
      if (Math.abs(x) < 90 && Math.abs(z) < 90) return 'DOWNTOWN';
      if (Math.abs(z) < 30) return 'PALM ROW';
      if (z < -120) return 'SUNSET STRIP';
      if (x > 120) return 'OLD CORAL';
      if (z > 120) return 'HARBOR HEIGHTS';
      return 'CORAL BAY';
    },
    // simple circle-vs-building test used by feet, cars and boats on land
    blocked(x, z, r) {
      if (x < -CITY_HALF - 30 || x > CITY_HALF || z < -CITY_HALF || z > CITY_HALF) return true;
      for (const c of colliders) {
        if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
      }
      return false;
    },
    update(dt, t) {
      const pos = oceanGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = oceanBase[i * 3], by = oceanBase[i * 3 + 1];
        pos.setZ(i, Math.sin(bx * 0.08 + t * 1.1) * 0.35 + Math.cos(by * 0.06 + t * 0.8) * 0.3);
      }
      pos.needsUpdate = true;
      oceanGeo.computeVertexNormals();
      wheel.rotation.z += dt * 0.12;
    },
  };
}
