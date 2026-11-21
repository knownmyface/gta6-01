// coralcity.js — builds Coral Bay: sunset coastal marina city.
// Grid roads, neon casino district, marina + pier + ocean, beach, palms,
// streetlights, safehouses, sky gradient + clouds + low sun glare.
// All names original; no Rockstar names, art, map or music.
import * as THREE from "../vendor/three/three.module.min.js";
import { rand, randInt, pick, clamp, mulberry32 } from "./util.js";

export const CITY = {
  half: 330,
  roadGap: 60,
  waterZ: -205,
  beachZ: -185,
  casino: { x: 30, z: -120 },
  marina: { x: -120, z: -185 },
  pier: { x: -60, z: -205 },
};

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowsTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 18) {
      for (let x = 8; x < w - 8; x += 16) {
        const on = Math.random() < 0.55;
        g.fillStyle = on ? lit : "#1a2233";
        g.fillRect(x, y, 10, 12);
      }
    }
  });
}

function neonSignTexture(text, sub, fg, bg) {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg;
    g.font = "bold 64px Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = fg;
    g.shadowBlur = 22;
    g.fillText(text, w / 2, h / 2 - 18);
    g.shadowBlur = 8;
    g.font = "bold 30px Arial, sans-serif";
    g.fillText(sub, w / 2, h / 2 + 48);
  });
}

function makePalm(rng) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  const lean = (rng() - 0.5) * 0.35;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 5.2, 6), trunkMat);
  trunk.position.y = 2.6;
  trunk.rotation.z = lean;
  g.add(trunk);
  const topX = Math.sin(lean) * 0 + lean * 4.5;
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(topX + Math.cos(a) * 1.1, 5.3, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.15;
    leaf.rotation.x = -Math.sin(a) * 1.15;
    g.add(leaf);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0x8a5a2b }));
  nut.position.set(topX, 5.0, 0);
  g.add(nut);
  return g;
}

function makeBuilding(rng, w, d, h, palette) {
  const g = new THREE.Group();
  const tex = windowsTexture(palette.wall, palette.lit);
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x222222 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
    new THREE.MeshLambertMaterial({ color: palette.roof }));
  roof.position.y = h + 0.25;
  g.add(roof);
  if (rng() < 0.5) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.8, 9), 2.2),
      new THREE.MeshBasicMaterial({
        map: neonSignTexture(pick(palette.signs), pick(["OPEN", "24H", "BAR", "HOTEL", "SHOP"]), palette.neon, "#0c0a18"),
      })
    );
    sign.position.set(0, h * 0.62, d / 2 + 0.08);
    g.add(sign);
  }
  return g;
}

export function buildCity(G) {
  const scene = G.scene;
  const rng = mulberry32(20261121);
  const city = { palms: [], buildings: [], roads: [], lamps: [] };

  // Sky dome: vertical sunset gradient with a low sun disc + drifting clouds.
  const skyTex = canvasTexture(16, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, "#1c2a5e");
    grad.addColorStop(0.35, "#7a4a8a");
    grad.addColorStop(0.62, "#e86a4a");
    grad.addColorStop(0.8, "#ff9e57");
    grad.addColorStop(1.0, "#ffc46b");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xe8825a, 180, 780);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false })
  );
  sun.position.set(-40, 66, -820);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(95, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9e57, transparent: true, opacity: 0.28, fog: false })
  );
  sunGlow.position.set(-40, 66, -821);
  sunGlow.lookAt(0, 40, 0);
  scene.add(sunGlow);

  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffd9c2, transparent: true, opacity: 0.55, fog: false });
  city.clouds = [];
  for (let i = 0; i < 14; i++) {
    const cl = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(9 + rng() * 9, 8, 6), cloudMat);
      puff.position.set(j * 13 - n * 6, (rng() - 0.5) * 3, (rng() - 0.5) * 6);
      puff.scale.y = 0.45;
      cl.add(puff);
    }
    cl.position.set(rand(-520, 520), 120 + rng() * 70, rand(-700, 260));
    scene.add(cl);
    city.clouds.push(cl);
  }

  // Lighting: warm low sun + cool ambient fill.
  const hemi = new THREE.HemisphereLight(0xffc490, 0x2a3550, 1.0);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 1.7);
  sunLight.position.set(-90, 120, -320);
  scene.add(sunLight);
  const fill = new THREE.DirectionalLight(0x8aa0ff, 0.35);
  fill.position.set(160, 90, 240);
  scene.add(fill);

  // Ground base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshLambertMaterial({ color: 0x3d4a3a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // Ocean (animated in tick) + beach strip.
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1d6f8f, roughness: 0.25, metalness: 0.35 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1100, 320), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.35, CITY.waterZ - 130);
  scene.add(water);
  city.water = water;
  city.waterMat = waterMat;
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 42),
    new THREE.MeshLambertMaterial({ color: 0xd9b380 })
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, CITY.beachZ);
  scene.add(beach);

  // Roads: grid every 60 units + the marina-front boulevard along the beach.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2f3038 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x8f8a80 });
  function roadStrip(x, z, w, d, alongX) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.06, z);
    scene.add(r);
    city.roads.push({ x, z, w, d, alongX });
    // Centre dashes.
    const dashes = Math.floor((alongX ? w : d) / 9);
    for (let i = 0; i < dashes; i++) {
      const t = -((alongX ? w : d) / 2) + 4.5 + i * 9;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? 4 : 0.5, alongX ? 0.5 : 4), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(alongX ? x + t : x, 0.09, alongX ? z : z + t);
      scene.add(dash);
    }
    return r;
  }
  const half = CITY.half;
  for (let x = -300; x <= 300; x += CITY.roadGap) roadStrip(x, 40, 10, 680, false);
  for (let z = -180; z <= 300; z += CITY.roadGap) roadStrip(0, z, 680, 10, true);
  // Marina-front boulevard, wide, hugging the beach.
  roadStrip(0, -168, 680, 16, true);
  // Sidewalk ribbons flanking the boulevard.
  for (const sz of [-178.5, -157.5]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(680, 3), walkMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, 0.08, sz);
    scene.add(sw);
  }

  // Buildings: blocks between roads, kept off the road strips.
  const palettes = [
    { wall: "#5a4a6e", roof: "#2c2440", lit: "#ffd27a", neon: "#ff5ad1", signs: ["NEON", "PALMS", "LUNA", "VICE"] },
    { wall: "#44506a", roof: "#232c40", lit: "#ffe9a8", neon: "#37e6ff", signs: ["AZURE", "MARINA", "CORAL", "TIDE"] },
    { wall: "#6e4a3a", roof: "#40241c", lit: "#ffb36b", neon: "#ffb02e", signs: ["EMBER", "SUNSET", "DUSK", "GOLD"] },
    { wall: "#3a5a4a", roof: "#1e3328", lit: "#c9ffd2", neon: "#7dff9a", signs: ["VERDE", "PALM", "LAGOON", "REEF"] },
  ];
  const occupied = new Set();
  function blockKey(bx, bz) { return bx + "," + bz; }
  for (let bx = -300; bx <= 300; bx += CITY.roadGap) {
    for (let bz = -180; bz <= 300; bz += CITY.roadGap) {
      if (bz <= -150) continue; // beach / boulevard zone stays open
      if (Math.abs(bx - CITY.casino.x) < 70 && Math.abs(bz - CITY.casino.z) < 70) continue;
      if (rng() < 0.18) continue; // plazas / parking lots
      const key = blockKey(bx, bz);
      if (occupied.has(key)) continue;
      occupied.add(key);
      const pal = pick(palettes);
      const w = 26 + rng() * 14;
      const d = 26 + rng() * 14;
      const h = 14 + rng() * 46;
      const b = makeBuilding(rng, w, d, h, pal);
      b.position.set(bx + 30 + rand(-4, 4), 0, bz + 30 + rand(-4, 4));
      scene.add(b);
      city.buildings.push(b);
    }
  }

  // Neon casino district: the Coral Crown casino + lit neighbours.
  const casinoGroup = new THREE.Group();
  const casinoTex = windowsTexture("#7a2a4a", "#ffd27a");
  const casinoBody = new THREE.Mesh(
    new THREE.BoxGeometry(58, 34, 40),
    new THREE.MeshLambertMaterial({ map: casinoTex, emissive: 0x331122 })
  );
  casinoBody.position.y = 17;
  casinoGroup.add(casinoBody);
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 12, 7, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: 0.7, roughness: 0.3, emissive: 0x664400 })
  );
  crown.position.y = 37.5;
  casinoGroup.add(crown);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 13),
    new THREE.MeshBasicMaterial({ map: neonSignTexture("CORAL CROWN", "CASINO • HOTEL • SLOTS", "#ff5ad1", "#160a24") })
  );
  sign.position.set(0, 26, 20.4);
  casinoGroup.add(sign);
  const signBack = sign.clone();
  signBack.rotation.y = Math.PI;
  signBack.position.z = -20.4;
  casinoGroup.add(signBack);
  const marquee = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 6),
    new THREE.MeshBasicMaterial({ map: neonSignTexture("JACKPOT", "$2,400,000", "#37e6ff", "#06121f") })
  );
  marquee.position.set(0, 7, 20.4);
  casinoGroup.add(marquee);
  // Entrance canopy + doors (the heist way in).
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(20, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x1c1030, emissive: 0x441144, roughness: 0.4 })
  );
  canopy.position.set(0, 5.4, 23);
  casinoGroup.add(canopy);
  for (let i = -1; i <= 1; i++) {
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 4.6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    door.position.set(i * 4, 2.3, 20.45);
    casinoGroup.add(door);
  }
  // Neon strip along the casino block front.
  for (let i = 0; i < 10; i++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 6, 5),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff5ad1 : 0x37e6ff })
    );
    bulb.position.set(-22 + i * 4.9, 11.5, 20.6);
    casinoGroup.add(bulb);
  }
  casinoGroup.position.set(CITY.casino.x, 0, CITY.casino.z);
  scene.add(casinoGroup);
  city.casino = casinoGroup;
  city.casinoPos = new THREE.Vector3(CITY.casino.x, 0, CITY.casino.z + 24);

  // Casino district neighbours: two lit towers flanking the boulevard.
  for (const dx of [-62, 66]) {
    const tower = makeBuilding(rng, 30, 30, 52 + rng() * 18, palettes[1]);
    tower.position.set(CITY.casino.x + dx, 0, CITY.casino.z + 30);
    scene.add(tower);
    city.buildings.push(tower);
  }

  // Marina district: pier, moored boats, marina-front lamps.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 70), pierMat);
  pier.position.set(CITY.pier.x, 0.8, CITY.pier.z - 20);
  scene.add(pier);
  city.pier = pier;
  for (const px of [-170, -120, -70, -20]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a4630 }));
    post.position.set(px, 1.2, CITY.pier.z - 52);
    scene.add(post);
  }
  // Moored boats (simple hulls) bobbing beside the pier.
  city.mooredBoats = [];
  const hullCols = [0xf2f2f2, 0xff6b4a, 0x37b6ff, 0xffd23c];
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 9),
      new THREE.MeshLambertMaterial({ color: hullCols[i % hullCols.length] }));
    hull.position.y = 0.7;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 3.4),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    cabin.position.set(0, 1.8, -1);
    boat.add(cabin);
    boat.position.set(-150 + i * 22, 0.4, CITY.waterZ - 24 - (i % 2) * 14);
    boat.rotation.y = (i % 2 ? 0.06 : -0.05);
    scene.add(boat);
    city.mooredBoats.push(boat);
  }

  // Palms: boulevard rows + scattered through blocks.
  for (let x = -320; x <= 320; x += 24) {
    for (const pz of [-176, -160]) {
      const p = makePalm(rng);
      p.position.set(x + rand(-2, 2), 0, pz + rand(-1, 1));
      scene.add(p);
      city.palms.push(p);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = rand(-310, 310);
    const z = rand(-140, 300);
    if (Math.abs(x % 60) < 9 || Math.abs(z % 60) < 9) continue;
    const p = makePalm(rng);
    p.position.set(x, 0, z);
    scene.add(p);
    city.palms.push(p);
  }

  // Streetlights along every road + the boulevard.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x30343c });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let x = -300; x <= 300; x += 60) {
    for (let z = -180; z <= 300; z += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), lampMat);
      pole.position.set(x + 6.5, 3.25, z + 6.5);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), bulbMat);
      bulb.position.set(x + 6.5, 6.6, z + 6.5);
      scene.add(bulb);
      city.lamps.push(bulb);
    }
  }

  // Safehouse markers: marina loft, casino penthouse, beach bungalow.
  city.safehouses = [
    { id: "marina-loft", name: "Marina Loft", pos: new THREE.Vector3(-150, 0, -150) },
    { id: "crown-penthouse", name: "Crown Penthouse", pos: new THREE.Vector3(86, 0, -120) },
    { id: "beach-bungalow", name: "Beach Bungalow", pos: new THREE.Vector3(210, 0, -150) },
  ];
  for (const sh of city.safehouses) {
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 20),
      new THREE.MeshBasicMaterial({ color: 0x37e6ff, transparent: true, opacity: 0.5 }));
    marker.position.set(sh.pos.x, 0.25, sh.pos.z);
    scene.add(marker);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 5),
      new THREE.MeshBasicMaterial({ color: 0x37e6ff }));
    pole.position.set(sh.pos.x, 4.5, sh.pos.z);
    scene.add(pole);
  }

  // Objective beacon (moves with the active mission).
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  beacon.position.set(0, 13, -120);
  scene.add(beacon);
  city.beacon = beacon;

  G.city = city;
  return city;
}

export function tickCity(G, dt, t) {
  const city = G.city;
  if (!city) return;
  // Gentle water shimmer + bobbing moored boats + drifting clouds.
  if (city.water) city.water.position.y = 0.35 + Math.sin(t * 0.7) * 0.08;
  for (let i = 0; i < city.mooredBoats.length; i++) {
    const b = city.mooredBoats[i];
    b.position.y = 0.4 + Math.sin(t * 0.9 + i * 1.7) * 0.12;
    b.rotation.z = Math.sin(t * 0.6 + i) * 0.02;
  }
  for (let i = 0; i < city.clouds.length; i++) {
    city.clouds[i].position.x += dt * (1.2 + (i % 3) * 0.5);
    if (city.clouds[i].position.x > 560) city.clouds[i].position.x = -560;
  }
  if (city.beacon) {
    city.beacon.rotation.y += dt * 1.5;
    city.beacon.material.opacity = 0.28 + Math.sin(t * 3) * 0.1;
  }
}
