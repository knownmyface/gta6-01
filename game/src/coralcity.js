// CORAL HEAT — Coral Bay city builder (v2.9, fresh).
// Sunset coastal marina city: road grid, tower blocks, palms, beach,
// marina piers with moored boats, a ferris wheel, lamps and plazas.
// Exports buildCoralCity(G) -> city layout + colliders + key spots.
import * as THREE from 'three';
import { mulberry32, randi } from './util.js';

const PALETTE = [
  0xf2c89b, 0xe8a87c, 0xd9a05b, 0xc97b63, 0x9fb4c7, 0x7fa3a1,
  0xe6d3a3, 0xb98a6b, 0x8fa3bf, 0xd97b6c, 0xf0e0c0, 0xa8b8a0,
];
const ROOFS = [0x6b4a3a, 0x4a5a6b, 0x7a6a55, 0x54423a];

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.ei || 0 })
  );
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  return m;
}

function makePalm(s, rng) {
  const g = new THREE.Group();
  const trunkH = 7 + rng() * 3;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, trunkH, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6b4a })
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, trunkH + 0.4, Math.sin(a) * 1.1);
    leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    leaf.scale.set(1, 1, 0.35);
    g.add(leaf);
  }
  const nut = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
  );
  nut.position.y = trunkH + 0.2;
  g.add(nut);
  g.position.copy(s);
  return g;
}

function makeFerrisWheel(G, x, z) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(16, 0.7, 8, 28),
    new THREE.MeshLambertMaterial({ color: 0xffd27a, emissive: 0x442200, emissiveIntensity: 0.6 })
  );
  rim.position.y = 20;
  g.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 31, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })
    );
    spoke.position.set(Math.cos(a) * 0, 20, 0);
    spoke.rotation.z = a;
    spoke.position.x = 0;
    g.add(spoke);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 2, 10),
    new THREE.MeshLambertMaterial({ color: 0xff8a5c })
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.y = 20;
  g.add(hub);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x5a4a42 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), legMat);
    leg.position.set(s * 7, 10, 0);
    leg.rotation.z = -s * 0.35;
    g.add(leg);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: [0xff6b6b, 0x6bb8ff, 0xffd76b, 0x7be495][i % 4], emissive: 0x221100, emissiveIntensity: 0.4 })
    );
    cab.position.set(Math.cos(a) * 16, 20 + Math.sin(a) * 16, 0);
    g.add(cab);
  }
  g.position.set(x, 0, z);
  g.userData.spin = rim;
  G.scene.add(g);
  return g;
}

export function buildCoralCity(G) {
  const rng = mulberry32(20261121);
  const scene = G.scene;
  const city = {
    half: 340, colliders: [], intersections: [],
    marina: { x0: 296, x1: 400, z0: -170, z1: 170 },
    spawn: { x: 0, z: 30, heading: Math.PI },
    docks: [], safehouseSpots: [], racePads: [], bikeSpawns: [],
    ferris: null, palms: [],
  };

  // --- sky, sun, lights -------------------------------------------------
  scene.background = new THREE.Color(0xff8f4d);
  scene.fog = new THREE.Fog(0xe88a52, 180, 620);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x4a3a52, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.9);
  sun.position.set(-180, 120, 60);
  scene.add(sun);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false })
  );
  sunDisc.position.set(-420, 95, -40);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  // a few flat sunset clouds
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(40 + rng() * 50, 3, 12 + rng() * 10),
      new THREE.MeshLambertMaterial({ color: 0xffc9a8, emissive: 0x662211, emissiveIntensity: 0.35 })
    );
    c.position.set(-260 + rng() * 520, 120 + rng() * 60, -260 + rng() * 520);
    scene.add(c);
  }

  // --- ground, ocean, beach ---------------------------------------------
  // ground stops at the beach edge (x = 296) so the marina water shows
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(676, 760),
    new THREE.MeshLambertMaterial({ color: 0x9c8a6c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = -42;
  scene.add(ground);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 760),
    new THREE.MeshLambertMaterial({ color: 0x2a7a8c, emissive: 0x0a2a3a, emissiveIntensity: 0.5 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(300 + 160, -0.6, 0);
  scene.add(ocean);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 760),
    new THREE.MeshLambertMaterial({ color: 0xe8d3a0 })
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(293, 0.05, 0);
  scene.add(beach);

  // --- road grid ----------------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8d27a });
  const coords = [-280, -210, -140, -70, 0, 70, 140, 210, 280];
  for (const c of coords) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(760, 15), roadMat);
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.1, c);
    scene.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(15, 760), roadMat);
    rz.rotation.x = -Math.PI / 2; rz.position.set(c, 0.1, 0);
    scene.add(rz);
    // centre dashes
    for (let d = -350; d < 350; d += 24) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.8), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.15, c);
      scene.add(dash);
    }
    city.intersections.push(...coords.map((z) => ({ x: c, z })));
  }

  // --- buildings ----------------------------------------------------------
  const blockCentres = [];
  for (let i = 0; i < coords.length - 1; i++) {
    for (let j = 0; j < coords.length - 1; j++) {
      blockCentres.push({ x: (coords[i] + coords[i + 1]) / 2, z: (coords[j] + coords[j + 1]) / 2 });
    }
  }
  for (const b of blockCentres) {
    // skip marina-side blocks and the central plaza
    if (b.x > 240) continue;
    if (Math.abs(b.x) < 40 && Math.abs(b.z) < 40) continue;
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const w = 12 + rng() * 18, d = 12 + rng() * 18;
      const h = 10 + rng() * rng() * 52;
      // keep 8 units clear of the road edge so the chase camera never clips a tower
      const ox = (rng() - 0.5) * (56 - w - 16);
      const oz = (rng() - 0.5) * (56 - d - 16);
      const x = b.x + ox, z = b.z + oz;
      const col = PALETTE[Math.floor(rng() * PALETTE.length)];
      const tower = box(w, h, d, col, x, h / 2, z);
      scene.add(tower);
      const roof = box(w * 0.7, 1.6, d * 0.7, ROOFS[Math.floor(rng() * ROOFS.length)], x, h + 0.8, z);
      scene.add(roof);
      // lit window strips so towers read at dusk
      if (h > 22) {
        const strip = box(w * 0.9, 0.9, 0.3, 0xffd27a, x, h * 0.62, z + d / 2 + 0.2, { emissive: 0xffb347, ei: 0.9 });
        scene.add(strip);
        const strip2 = box(0.3, 0.9, d * 0.9, 0xffd27a, x + w / 2 + 0.2, h * 0.35, z, { emissive: 0xffb347, ei: 0.9 });
        scene.add(strip2);
      }
      city.colliders.push({ x, z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
    }
  }
  // central plaza: low fountain + benches
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 11, 1.2, 12),
    new THREE.MeshLambertMaterial({ color: 0x7fb8c9 })
  );
  plaza.position.set(0, 0.6, 0);
  scene.add(plaza);

  // --- palms + lamps along roads -----------------------------------------
  for (const c of coords) {
    for (let d = -280; d <= 280; d += 70) {
      if (Math.abs(c) < 1 && Math.abs(d) < 40) continue;
      const palm = makePalm(new THREE.Vector3(c + 10, 0, d + 12), rng);
      scene.add(palm);
      city.palms.push(palm);
      if ((d / 70) % 2 === 0) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 7, 6),
          new THREE.MeshLambertMaterial({ color: 0x2a2a30 })
        );
        pole.position.set(c - 10, 3.5, d - 12);
        scene.add(pole);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc25e, emissiveIntensity: 1.2 })
        );
        lamp.position.set(c - 10, 7.2, d - 12);
        scene.add(lamp);
      }
    }
  }

  // --- marina: piers + moored boats ---------------------------------------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const pierZs = [-120, -40, 40, 120];
  for (const pz of pierZs) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(64, 1.2, 7), pierMat);
    pier.position.set(330, 0.4, pz);
    scene.add(pier);
    for (let i = 0; i < 3; i++) {
      const bx = 312 + i * 20 + rng() * 4;
      const bz = pz + (rng() > 0.5 ? 6 : -6);
      const boat = makeMooredBoat(bx, bz, rng);
      scene.add(boat);
    }
    city.docks.push({ x: 330, z: pz, heading: 0 });
  }
  // boardwalk along the beach
  const walk = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 560), new THREE.MeshLambertMaterial({ color: 0xc9a06b }));
  walk.position.set(282, 0.5, 0);
  scene.add(walk);

  // --- ferris wheel on the beachfront --------------------------------------
  city.ferris = makeFerrisWheel(G, 268, -190);

  // --- key spots -----------------------------------------------------------
  city.safehouseSpots = [
    { id: 'flat', name: 'Coral Court Flat', price: 2500, x: -35, z: -105, desc: 'Cozy flat above the market street. 1 car slot.' },
    { id: 'loft', name: 'Marina Loft', price: 9000, x: 210, z: 105, desc: 'Bright loft by the marina. 2 car slots.' },
    { id: 'villa', name: 'Palm Villa', price: 22000, x: -210, z: 210, desc: 'Big villa with pool view. 4 car slots.' },
  ];
  for (const s of city.safehouseSpots) {
    const sign = box(4, 5, 0.6, 0x2a6b4a, s.x, 2.5, s.z, { emissive: 0x1a4a2a, ei: 0.5 });
    scene.add(sign);
  }
  city.racePads = [
    { x: 0, z: -210 }, { x: -210, z: 0 }, { x: 140, z: 210 }, { x: 210, z: -140 }, { x: -70, z: 140 },
  ];
  for (const p of city.racePads) {
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11),
      new THREE.MeshLambertMaterial({ color: 0xc22e26, emissive: 0x661111, emissiveIntensity: 0.5 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(p.x, 0.2, p.z);
    scene.add(pad);
  }
  city.bikeSpawns = [
    { x: 35, z: -35, model: 'scoot' }, { x: -105, z: 105, model: 'street' }, { x: 175, z: -105, model: 'racer' },
  ];
  return city;
}

function makeMooredBoat(x, z, rng) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(9, 2.2, 3.4),
    new THREE.MeshLambertMaterial({ color: [0xf0f0e8, 0xffd76b, 0x6bb8ff, 0xff8a5c][Math.floor(rng() * 4)] })
  );
  hull.position.y = 0.4;
  g.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 2, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  cabin.position.set(-0.6, 2.2, 0);
  g.add(cabin);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd })
  );
  mast.position.set(1.5, 4.5, 0);
  g.add(mast);
  g.position.set(x, 0, z);
  g.rotation.y = (rng() - 0.5) * 0.4;
  return g;
}
