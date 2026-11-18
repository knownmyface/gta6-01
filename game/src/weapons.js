// Weapons for CORAL HEAT v2.3: four buyable guns with REAL silhouettes —
// a pistol, an SMG, a rifle and a pump shotgun, each assembled from boxes
// and cylinders so its shape reads at a glance. One mesh builder serves
// three places: the first-person viewmodel on the camera, the gun in Mara's
// hand in third person, and the guns hostiles and police officers carry.
// No model files, no network — pure procedural geometry.
// v2.3 is a from-scratch rewrite of v2.2's weapons.js: same guns, same
// stats, same meshes, different code.
import * as THREE from 'three';

// The catalogue. Every number here is gameplay: price, damage, magazine,
// reserve, rate of fire, spread, auto, pellets, range and kick all feed the
// combat code and the HUD, so they must match v2.2 exactly.
export const WEAPONS = {
  pistol: {
    id: 'pistol', key: '1', icon: '🔫', name: 'PISTOL', price: 0,
    damage: 1, mag: 12, reserve: -1, rof: 0.26, spread: 0.012,
    auto: false, pellets: 1, range: 42, kick: 0.05,
    desc: 'Standard sidearm. Infinite reserve, quick draw.',
  },
  smg: {
    id: 'smg', key: '2', icon: '🔫', name: 'SMG', price: 800,
    damage: 1, mag: 32, reserve: 160, rof: 0.085, spread: 0.03,
    auto: true, pellets: 1, range: 38, kick: 0.03,
    desc: 'Full-auto spray. Burns ammo, wins close fights.',
  },
  rifle: {
    id: 'rifle', key: '3', icon: '🎯', name: 'RIFLE', price: 1800,
    damage: 2, mag: 24, reserve: 96, rof: 0.13, spread: 0.008,
    auto: true, pellets: 1, range: 55, kick: 0.07,
    desc: 'Scoped, hard-hitting, accurate at range.',
  },
  shotgun: {
    id: 'shotgun', key: '4', icon: '💥', name: 'PUMP SHOTGUN', price: 2600,
    damage: 1, mag: 6, reserve: 30, rof: 0.75, spread: 0.06,
    auto: false, pellets: 6, range: 26, kick: 0.16,
    desc: 'Six pellets a shell. Devastating up close.',
  },
};

export const WEAPON_ORDER = ['pistol', 'smg', 'rifle', 'shotgun'];

// Shared materials — one instance per finish, reused by every gun.
const FINISH = {
  dark: new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.35, metalness: 0.85 }),
  light: new THREE.MeshStandardMaterial({ color: 0x3a3e48, roughness: 0.3, metalness: 0.85 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6a4a26, roughness: 0.7 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.9 }),
};

// Attach a box part to a gun group. `tilt` rotates around X (raked grips,
// curved magazines); pass 0 for a straight part.
function addBox(group, w, h, d, mat, px, py, pz, tilt = 0) {
  const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  part.position.set(px, py, pz);
  if (tilt !== 0) part.rotation.x = tilt;
  group.add(part);
  return part;
}

// Attach a cylinder part, laid along Z like a barrel.
function addBarrel(group, radius, len, mat, px, py, pz) {
  const part = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat);
  part.rotation.x = Math.PI / 2;
  part.position.set(px, py, pz);
  group.add(part);
  return part;
}

// One builder per gun. Each builds pointing along +Z and returns the z of
// the barrel tip, where the muzzle marker (and the flash) will sit.
const GUN_BUILDERS = {
  pistol(g) {
    // Slide, barrel, raked grip, trigger guard, sights — a pistol silhouette.
    addBox(g, 0.09, 0.07, 0.34, FINISH.dark, 0, 0.03, 0.06);
    addBox(g, 0.07, 0.03, 0.3, FINISH.light, 0, 0.075, 0.06);
    addBarrel(g, 0.026, 0.1, FINISH.dark, 0, 0.03, 0.27);
    addBox(g, 0.075, 0.22, 0.1, FINISH.grip, 0, -0.09, -0.07, 0.28);
    addBox(g, 0.07, 0.02, 0.12, FINISH.dark, 0, -0.045, 0.08); // trigger guard
    addBox(g, 0.02, 0.05, 0.02, FINISH.dark, 0, -0.07, 0.05); // trigger
    addBox(g, 0.03, 0.025, 0.02, FINISH.brass, 0, 0.075, -0.09); // rear sight
    addBox(g, 0.02, 0.02, 0.015, FINISH.brass, 0, 0.075, 0.2); // front sight
    return 0.32;
  },
  smg(g) {
    // Long body, barrel shroud, curved mag, stock, foregrip.
    addBox(g, 0.1, 0.11, 0.5, FINISH.dark, 0, 0, 0);
    addBox(g, 0.12, 0.12, 0.22, FINISH.light, 0, 0, 0.3); // shroud
    addBarrel(g, 0.032, 0.16, FINISH.dark, 0, 0, 0.48);
    addBox(g, 0.07, 0.3, 0.1, FINISH.light, 0, -0.2, 0.05, 0.16); // curved mag
    addBox(g, 0.08, 0.1, 0.28, FINISH.grip, 0, -0.01, -0.36); // stock
    addBox(g, 0.07, 0.16, 0.09, FINISH.grip, 0, -0.12, 0.22); // foregrip
    addBox(g, 0.03, 0.05, 0.12, FINISH.dark, 0, 0.08, -0.08); // rear sight
    addBox(g, 0.05, 0.03, 0.08, FINISH.dark, 0, 0.07, 0.38); // front post
    return 0.56;
  },
  rifle(g) {
    // Long barrel, handguard, scope, curved mag, stock — unmistakably a rifle.
    addBox(g, 0.09, 0.12, 0.55, FINISH.dark, 0, 0, 0);
    addBarrel(g, 0.03, 0.5, FINISH.dark, 0, 0.01, 0.5);
    addBox(g, 0.1, 0.1, 0.4, FINISH.wood, 0, -0.01, 0.32); // handguard
    addBox(g, 0.07, 0.28, 0.12, FINISH.light, 0, -0.19, 0.02, -0.28); // mag
    addBox(g, 0.08, 0.12, 0.35, FINISH.wood, 0, -0.01, -0.42); // stock
    addBarrel(g, 0.035, 0.22, FINISH.light, 0, 0.11, -0.05); // scope
    addBox(g, 0.04, 0.04, 0.04, FINISH.dark, 0, 0.08, -0.05); // scope mount
    addBox(g, 0.02, 0.04, 0.02, FINISH.brass, 0, 0.09, 0.72); // front sight
    return 0.78;
  },
  shotgun(g) {
    // Thick barrel, wooden pump + stock, bead sight.
    addBarrel(g, 0.045, 0.55, FINISH.dark, 0, 0.01, 0.42);
    addBox(g, 0.11, 0.09, 0.3, FINISH.wood, 0, -0.06, 0.35); // pump
    addBox(g, 0.1, 0.13, 0.4, FINISH.dark, 0, 0, 0);
    addBox(g, 0.09, 0.13, 0.32, FINISH.wood, 0, -0.01, -0.35); // stock
    addBox(g, 0.02, 0.03, 0.02, FINISH.brass, 0, 0.07, 0.66); // bead
    return 0.72;
  },
};

// Build a gun mesh pointing along +Z. Returns { group, muzzle } where muzzle
// is an Object3D at the barrel tip (world position = where shots + flash start).
export function buildGunMesh(type) {
  const group = new THREE.Group();
  const builder = GUN_BUILDERS[type] ?? GUN_BUILDERS.shotgun;
  const tipZ = builder(group);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, type === 'pistol' ? 0.03 : 0.01, tipZ);
  group.add(muzzle);
  return { group, muzzle };
}

// --- star-shaped muzzle flash texture, drawn once, shared by all guns ---
let cachedFlashTexture = null;

function makeFlashTexture() {
  if (cachedFlashTexture) return cachedFlashTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.translate(64, 64);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 60);
  glow.addColorStop(0, 'rgba(255,250,220,1)');
  glow.addColorStop(0.35, 'rgba(255,200,90,0.9)');
  glow.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = glow;
  // Four-point star: eight vertices, long/short radii alternating.
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = i % 2 === 0 ? 62 : 14;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // Hot core.
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  cachedFlashTexture = new THREE.CanvasTexture(canvas);
  cachedFlashTexture.colorSpace = THREE.SRGBColorSpace;
  return cachedFlashTexture;
}

export function makeFlashSprite(scale = 0.55) {
  const material = new THREE.SpriteMaterial({
    map: makeFlashTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.visible = false;
  return sprite;
}

// --- the arsenal: owned weapons, current weapon, ammo ---
const RELOAD_SECONDS = 1.15;

export class Arsenal {
  constructor() {
    this.owned = new Set(['pistol']);
    this.current = 'pistol';
    this.ammo = this.freshAmmo();
    this.reloading = 0;
    this.cooldown = 0;
  }

  freshAmmo() {
    const table = {};
    for (const id of WEAPON_ORDER) {
      table[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
    }
    return table;
  }

  def() { return WEAPONS[this.current]; }

  // HUD + main.js read the catalogue through the arsenal, not the raw table.
  get order() { return WEAPON_ORDER; }
  get defs() { return WEAPONS; }

  // Short aliases used by main.js / shots.js.
  select(id) { return this.switchTo(id); }
  reload() { return this.startReload(); }
  update(dt) { this.tick(dt); }

  canBuy(id) {
    return !this.owned.has(id);
  }

  buy(id, cash) {
    const spec = WEAPONS[id];
    if (!spec) return false;
    if (this.owned.has(id)) return false;
    if (cash < spec.price) return false;
    this.owned.add(id);
    this.current = id;
    return true;
  }

  switchTo(id) {
    if (!this.owned.has(id)) return false;
    this.current = id;
    this.reloading = 0;
    return true;
  }

  startReload() {
    const spec = this.def();
    const state = this.ammo[this.current];
    const magFull = state.mag >= spec.mag;
    const noReserve = spec.reserve !== -1 && state.reserve <= 0;
    if (this.reloading > 0 || magFull || noReserve) return false;
    this.reloading = RELOAD_SECONDS;
    return true;
  }

  finishReload() {
    const spec = this.def();
    const state = this.ammo[this.current];
    if (spec.reserve === -1) {
      state.mag = spec.mag;
      return;
    }
    const needed = spec.mag - state.mag;
    const moved = Math.min(needed, state.reserve);
    state.mag += moved;
    state.reserve -= moved;
  }

  // Consume one trigger pull; returns false when the mag is dry.
  pullTrigger() {
    if (this.cooldown > 0) return false;
    if (this.reloading > 0) return false;
    const spec = this.def();
    const state = this.ammo[this.current];
    if (state.mag <= 0) return false;
    state.mag -= 1;
    this.cooldown = spec.rof;
    return true;
  }

  tick(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading <= 0) return;
    this.reloading -= dt;
    if (this.reloading <= 0) {
      this.reloading = 0;
      this.finishReload();
    }
  }

  ammoText() {
    const spec = this.def();
    const state = this.ammo[this.current];
    if (this.reloading > 0) return 'RELOADING…';
    const reserveText = spec.reserve === -1 ? '∞' : String(state.reserve);
    return `${state.mag} / ${reserveText}`;
  }

  serialize() {
    return {
      owned: [...this.owned],
      current: this.current,
      ammo: this.ammo,
    };
  }

  restore(saved) {
    if (!saved) return;
    if (Array.isArray(saved.owned)) {
      this.owned = new Set(saved.owned.filter((id) => WEAPONS[id]));
    }
    if (WEAPONS[saved.current] && this.owned.has(saved.current)) {
      this.current = saved.current;
    }
    if (!saved.ammo) return;
    for (const id of Object.keys(this.ammo)) {
      const entry = saved.ammo[id];
      if (!entry) continue;
      this.ammo[id] = {
        mag: entry.mag ?? WEAPONS[id].mag,
        reserve: entry.reserve ?? WEAPONS[id].reserve,
      };
    }
  }
}

// --- first-person viewmodel: the gun on the camera, bottom-right ---
const VIEWMODEL_POS = { x: 0.42, y: -0.36, z: -0.95 };
const VIEWMODEL_TILT = { x: 0.06, y: -0.12, z: 0 };
const VIEWMODEL_SCALE = { pistol: 1.5, smg: 1.25, rifle: 1.1, shotgun: 1.1 };

export class Viewmodel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.set(VIEWMODEL_POS.x, VIEWMODEL_POS.y, VIEWMODEL_POS.z);
    this.group.rotation.set(VIEWMODEL_TILT.x, VIEWMODEL_TILT.y, VIEWMODEL_TILT.z);
    this.camera.add(this.group);
    this.current = null;
    this.gun = null;
    this.flash = makeFlashSprite(0.6);
    this.flashLight = new THREE.PointLight(0xffe08a, 0, 9);
    this.group.add(this.flash);
    this.group.add(this.flashLight);
    this.flashTimer = 0;
    this.recoil = 0;
    this.bobPhase = 0;
    this.basePos = this.group.position.clone();
    // A warm fill light rides with the camera so the viewmodel gun is never
    // a black blob — the dusk scene leaves it unlit otherwise.
    this.fill = new THREE.PointLight(0xffe0b0, 3, 4, 1.5);
    this.fill.position.set(0.25, 0.15, -0.4);
    this.camera.add(this.fill);
  }

  setWeapon(type) {
    if (type === this.current) return;
    if (this.gun) {
      this.group.remove(this.gun.group);
      this.gun = null;
    }
    this.gun = buildGunMesh(type);
    // Viewmodel scale: big enough to read, small enough to not block the road.
    const scale = VIEWMODEL_SCALE[type] ?? 1.1;
    this.gun.group.scale.setScalar(scale);
    // The gun is built pointing +Z (toward the camera) — v2 showed the stock
    // as a dark blob. Turn it around so the muzzle points down-range and the
    // rifle reads as a rifle: barrel, handguard, magazine, stock.
    this.gun.group.rotation.set(0.04, Math.PI - 0.18, 0.02);
    // The flash sits at the barrel tip — flipped with the gun, so -Z now.
    const muzzle = this.gun.muzzle.position;
    this.flash.position.set(0, muzzle.y * scale, -muzzle.z * scale);
    this.group.add(this.gun.group);
    this.current = type;
  }

  fire() {
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flashTimer = 0.06;
    this.flashLight.intensity = 10;
    this.recoil = 1;
  }

  update(dt, moving, firing) {
    if (moving) this.bobPhase += dt * 9;
    const bobY = Math.sin(this.bobPhase) * 0.012;
    const bobX = Math.cos(this.bobPhase * 0.5) * 0.008;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    const kick = this.recoil * 0.09;
    this.group.position.set(
      this.basePos.x + bobX,
      this.basePos.y + bobY,
      this.basePos.z + kick,
    );
    this.group.rotation.x = 0.06 + this.recoil * 0.22;
    if (this.flashTimer <= 0) return;
    this.flashTimer -= dt;
    if (this.flashTimer > 0) return;
    this.flash.visible = false;
    this.flashLight.intensity = 0;
  }
}
