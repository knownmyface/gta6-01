// Coral Heat — the sunset coastal marina city of Coral Bay.
// Builds the whole static world: ocean + beach, marina-front boulevard,
// road grid, buildings (never on a road), casino district with neon signs,
// pier, palms, streetlights and the sunset sky.
import * as THREE from 'three';
import { rand, randi, pick, mulberry32 } from './util.js';

export const CITY_EDGE = 300;
export const WATER_X = -262;
export const BEACH_X = -246;
export const MARINA_X = -222;
export const ROAD_HALF = 7;
export const ROAD_STEP = 60;

const V_ROADS = [-180, -120, -60, 0, 60, 120, 180, 240];
const H_ROADS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

export function isOnRoad(x, z) {
  if (Math.abs(x - MARINA_X) < ROAD_HALF + 2 && Math.abs(z) <= CITY_EDGE) return true;
  for (const rx of V_ROADS) if (Math.abs(x - rx) < ROAD_HALF + 2) return true;
  for (const rz of H_ROADS) if (Math.abs(z - rz) < ROAD_HALF + 2) return true;
  return false;
}

export function nearestRoadZ(z) {
  let best = H_ROADS[0];
  for (const rz of H_ROADS) if (Math.abs(rz - z) < Math.abs(best - z)) best = rz;
  return best;
}

function neonTexture(text, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fg;
  g.shadowBlur = 26;
  g.fillStyle = fg;
  g.fillText(text, 256, 66);
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(height = 9) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a5a33 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, height, 6), trunkMat);
  trunk.position.y = height / 2;
  trunk.rotation.z = rand(-0.06, 0.06);
  g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.3, height + 0.35, Math.sin(a) * 1.3);
    leaf.rotation.z = Math.cos(a) * 1.15;
    leaf.rotation.x = -Math.sin(a) * 1.15;
    leaf.scale.set(1, 1, 0.35);
    g.add(leaf);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a1f }));
  nuts.position.y = height - 0.2;
  g.add(nuts);
  return g;
}

function makeBuilding(w, h, d, color, litWindows) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.y = h / 2;
  g.add(body);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.92, 0.8, d * 0.92),
    new THREE.MeshLambertMaterial({ color: 0x3a3340 })
  );
  roof.position.y = h + 0.4;
  g.add(roof);
  // Lit windows: small emissive planes on the faces, sunset-gold.
  const winMat = new THREE.MeshBasicMaterial({ color: litWindows ? 0xffd27a : 0x2c3550 });
  const cols = Math.max(2, Math.floor(w / 6));
  const rows = Math.max(2, Math.floor(h / 7));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.35) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), winMat);
      win.position.set(-w / 2 + 3 + c * ((w - 6) / Math.max(1, cols - 1)), 4 + r * 6.5, d / 2 + 0.06);
      g.add(win);
      const win2 = win.clone();
      win2.position.z = -d / 2 - 0.06;
      win2.rotation.y = Math.PI;
      g.add(win2);
    }
  }
  return g;
}

function makeNeonSign(text, fg, bg, w = 26, h = 6.5) {
  const tex = neonTexture(text, fg, bg);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false })
  );
  return mesh;
}

export function buildCoralCity(G) {
  const scene = G.scene;
  const rng = mulberry32(20261121);
  const world = {
    marinaX: MARINA_X,
    waterX: WATER_X,
    casino: new THREE.Vector3(186, 0, -186),
    pier: new THREE.Vector3(-290, 0, 40),
    marinaRow: MARINA_X,
    buildings: [],
    palms: [],
    signs: [],
  };
  G.world = world;

  // --- sky: sunset gradient dome + sun disc + clouds + fog ---
  scene.background = new THREE.Color(0xff9a5c);
  scene.fog = new THREE.Fog(0xff9a5c, 180, 620);
  const skyGeo = new THREE.SphereGeometry(900, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0xffb36b, side: THREE.BackSide, fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false })
  );
  sun.position.set(-420, 95, -260);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.35, fog: false })
  );
  sunGlow.position.set(-425, 95, -265);
  sunGlow.lookAt(0, 40, 0);
  scene.add(sunGlow);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffd9c2, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(9, 18), 8, 6), cloudMat);
      puff.position.set(j * 12 - 18 + rand(-4, 4), rand(-2, 3), rand(-6, 6));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(rand(-420, 420), rand(90, 170), rand(-420, 220));
    scene.add(cloud);
  }

  // --- lights ---
  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x3a2f4a, 0.95);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 1.6);
  sunLight.position.set(-300, 160, -180);
  scene.add(sunLight);

  // --- ground, ocean, beach ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 700),
    new THREE.MeshLambertMaterial({ color: 0x5c5148 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, 0, 0);
  scene.add(ground);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 760),
    new THREE.MeshLambertMaterial({ color: 0x1f6f8b })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-420, 0.25, 0);
  scene.add(ocean);
  const ocean2 = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 760),
    new THREE.MeshLambertMaterial({ color: 0x2f8fae, transparent: true, opacity: 0.35 })
  );
  ocean2.rotation.x = -Math.PI / 2;
  ocean2.position.set(-420, 0.45, 30);
  scene.add(ocean2);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 640),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9a })
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-254, 0.15, 0);
  scene.add(beach);

  // --- roads (dark strips + centre dashes) ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2c33 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd76b });
  function roadStrip(x, z, w, l) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.3, z);
    scene.add(r);
    const n = Math.floor(l / 14);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
      d.rotation.x = -Math.PI / 2;
      if (w > l) d.rotation.z = Math.PI / 2;
      d.position.set(x, 0.35, z - l / 2 + 7 + i * 14);
      if (w > l) d.position.set(x - l / 2 + 7 + i * 14, 0.35, z);
      scene.add(d);
    }
  }
  for (const rx of V_ROADS) roadStrip(rx, 0, 14, 620);
  for (const rz of H_ROADS) roadStrip(0, rz, 620, 14);
  roadStrip(MARINA_X, 0, 16, 620); // marina-front boulevard beside the water

  // --- sidewalks along the marina boulevard ---
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x8a7f72 });
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(5, 620), walkMat);
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(MARINA_X + 11, 0.32, 0);
  scene.add(walk);

  // --- buildings: one per block cell, never on a road ---
  const palette = [0xc96f4a, 0xd9a05b, 0x7a8ba8, 0xb0a08a, 0x9a6b8a, 0x6b9a8a, 0xc2b49a, 0x8a7a9a];
  const blockXs = [-150, -90, -30, 30, 90, 150, 210, 270];
  const blockZs = [-210, -150, -90, -30, 30, 90, 150, 210, 270];
  for (const bx of blockXs) {
    for (const bz of blockZs) {
      if (Math.abs(bx - 180) < 45 && Math.abs(bz + 180) < 45) continue; // casino district handled below
      if (rng() < 0.18) continue;
      const w = rand(16, 30);
      const d = rand(16, 30);
      const h = rand(10, 42);
      const b = makeBuilding(w, h, d, pick(palette), true);
      b.position.set(bx + rand(-6, 6), 0, bz + rand(-6, 6));
      b.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
      scene.add(b);
      world.buildings.push(b);
      if (rng() < 0.5) {
        const annex = makeBuilding(w * 0.55, h * 0.45, d * 0.55, pick(palette), true);
        annex.position.set(bx + rand(14, 20), 0, bz + rand(-14, 14));
        scene.add(annex);
        world.buildings.push(annex);
      }
    }
  }

  // --- casino district (NE): big casino + hotel + neon signs ---
  const casino = makeBuilding(52, 30, 38, 0x7a2a6b, true);
  casino.position.set(186, 0, -186);
  scene.add(casino);
  world.buildings.push(casino);
  const hotel = makeBuilding(30, 58, 26, 0x3a5a8a, true);
  hotel.position.set(150, 0, -150);
  scene.add(hotel);
  world.buildings.push(hotel);
  const casinoSign = makeNeonSign('CORAL CASINO', '#ff5ad0', '#1a0a2e', 34, 8);
  casinoSign.position.set(186, 34, -165);
  scene.add(casinoSign);
  world.signs.push(casinoSign);
  const hotelSign = makeNeonSign('MARINA HOTEL', '#5ad0ff', '#0a1a2e', 26, 6);
  hotelSign.position.set(150, 62, -135);
  scene.add(hotelSign);
  world.signs.push(hotelSign);
  const barSign = makeNeonSign('SUNSET BAR', '#ffd75a', '#2e1a0a', 20, 5);
  barSign.position.set(-196, 12, 120);
  barSign.rotation.y = Math.PI / 2;
  scene.add(barSign);
  world.signs.push(barSign);
  const pierSign = makeNeonSign('CORAL PIER', '#7affc9', '#0a2e1a', 22, 5.5);
  pierSign.position.set(-252, 10, 40);
  pierSign.rotation.y = Math.PI / 2;
  scene.add(pierSign);
  world.signs.push(pierSign);
  const palmsSign = makeNeonSign('NEON PALMS', '#ff8a5a', '#2e0a1a', 22, 5.5);
  palmsSign.position.set(60, 14, -246);
  scene.add(palmsSign);
  world.signs.push(palmsSign);

  // --- pier: wooden planks out into the water ---
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (let i = 0; i < 12; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 9), plankMat);
    plank.position.set(-268 - i * 5, 1.2, 40);
    scene.add(plank);
  }
  const pierPost = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), pierPost);
    post.position.set(-272 - i * 10, 0.4, 36);
    scene.add(post);
    const post2 = post.clone();
    post2.position.z = 44;
    scene.add(post2);
  }

  // --- palms: marina boulevard, beach, casino front ---
  for (let z = -280; z <= 280; z += 28) {
    const p1 = makePalm(rand(8, 11));
    p1.position.set(MARINA_X - 12, 0, z + rand(-4, 4));
    scene.add(p1);
    world.palms.push(p1);
    const p2 = makePalm(rand(7, 10));
    p2.position.set(MARINA_X + 15, 0, z + 14 + rand(-4, 4));
    scene.add(p2);
    world.palms.push(p2);
  }
  for (let z = -260; z <= 260; z += 44) {
    const p = makePalm(rand(7, 10));
    p.position.set(-250, 0, z);
    scene.add(p);
    world.palms.push(p);
  }
  for (let i = 0; i < 8; i++) {
    const p = makePalm(rand(8, 11));
    p.position.set(150 + rand(-24, 24), 0, -140 + rand(-8, 8));
    scene.add(p);
    world.palms.push(p);
  }

  // --- streetlights along every road ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const rx of V_ROADS) {
    for (let z = -270; z <= 270; z += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(rx + 8.5, 3.5, z);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(rx + 8.5, 7.2, z);
      scene.add(lamp);
    }
  }
  for (let z = -270; z <= 270; z += 60) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
    pole.position.set(MARINA_X - 10, 3.5, z);
    scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
    lamp.position.set(MARINA_X - 10, 7.2, z);
    scene.add(lamp);
  }

  // --- distant skyline silhouettes (depth at the horizon) ---
  const silMat = new THREE.MeshLambertMaterial({ color: 0x8a5a7a });
  for (let i = 0; i < 16; i++) {
    const h = rand(30, 80);
    const sil = new THREE.Mesh(new THREE.BoxGeometry(rand(18, 34), h, rand(18, 34)), silMat);
    sil.position.set(rand(-380, 380), h / 2, -380 - rand(0, 40));
    scene.add(sil);
  }
  return world;
}
