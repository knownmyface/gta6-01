// Weapons for CORAL HEAT v2.2: four buyable guns with REAL silhouettes — a
// pistol, an SMG, a rifle and a pump shotgun, each built from boxes and
// cylinders so its shape reads at a glance. The same meshes serve three
// places: the first-person viewmodel on the camera, the gun in Mara's hand
// in third person, and the guns hostiles and police officers carry.
// No model files, no network — pure procedural geometry.
import * as THREE from 'three';

export const WEAPONS = {
  pistol: {
    id: 'pistol', key: '1', icon: '🔫', name: 'PISTOL', price: 0, damage: 1, mag: 12, reserve: -1,
    rof: 0.26, spread: 0.012, auto: false, pellets: 1, range: 42, kick: 0.05,
    desc: 'Standard sidearm. Infinite reserve, quick draw.',
  },
  smg: {
    id: 'smg', key: '2', icon: '🔫', name: 'SMG', price: 800, damage: 1, mag: 32, reserve: 160,
    rof: 0.085, spread: 0.03, auto: true, pellets: 1, range: 38, kick: 0.03,
    desc: 'Full-auto spray. Burns ammo, wins close fights.',
  },
  rifle: {
    id: 'rifle', key: '3', icon: '🎯', name: 'RIFLE', price: 1800, damage: 2, mag: 24, reserve: 96,
    rof: 0.13, spread: 0.008, auto: true, pellets: 1, range: 55, kick: 0.07,
    desc: 'Scoped, hard-hitting, accurate at range.',
  },
  shotgun: {
    id: 'shotgun', key: '4', icon: '💥', name: 'PUMP SHOTGUN', price: 2600, damage: 1, mag: 6, reserve: 30,
    rof: 0.75, spread: 0.06, auto: false, pellets: 6, range: 26, kick: 0.16,
    desc: 'Six pellets a shell. Devastating up close.',
  },
};

export const WEAPON_ORDER = ['pistol', 'smg', 'rifle', 'shotgun'];

const GUNMETAL = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.35, metalness: 0.85 });
const GUNMETAL_LIGHT = new THREE.MeshStandardMaterial({ color: 0x3a3e48, roughness: 0.3, metalness: 0.85 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x6a4a26, roughness: 0.7 });
const GRIP = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.9 });
const BRASS = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.9 });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function tube(r, len, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

// Build a gun mesh pointing along +Z. Returns { group, muzzle } where muzzle
// is an Object3D at the barrel tip (world position = where shots + flash start).
export function buildGunMesh(type) {
  const g = new THREE.Group();
  let muzzleZ = 0.3;
  if (type === 'pistol') {
    // slide, barrel, raked grip, trigger guard, sights — a pistol silhouette
    g.add(box(0.09, 0.07, 0.34, GUNMETAL, 0, 0.03, 0.06));
    g.add(box(0.07, 0.03, 0.3, GUNMETAL_LIGHT, 0, 0.075, 0.06));
    g.add(tube(0.026, 0.1, GUNMETAL, 0, 0.03, 0.27));
    const grip = box(0.075, 0.22, 0.1, GRIP, 0, -0.09, -0.07);
    grip.rotation.x = 0.28;
    g.add(grip);
    g.add(box(0.07, 0.02, 0.12, GUNMETAL, 0, -0.045, 0.08)); // trigger guard
    g.add(box(0.02, 0.05, 0.02, GUNMETAL, 0, -0.07, 0.05)); // trigger
    g.add(box(0.03, 0.025, 0.02, BRASS, 0, 0.075, -0.09)); // rear sight
    g.add(box(0.02, 0.02, 0.015, BRASS, 0, 0.075, 0.2)); // front sight
    muzzleZ = 0.32;
  } else if (type === 'smg') {
    // long body, barrel shroud, curved mag, stock, foregrip
    g.add(box(0.1, 0.11, 0.5, GUNMETAL, 0, 0, 0));
    g.add(box(0.12, 0.12, 0.22, GUNMETAL_LIGHT, 0, 0, 0.3)); // shroud
    g.add(tube(0.032, 0.16, GUNMETAL, 0, 0, 0.48));
    const mag = box(0.07, 0.3, 0.1, GUNMETAL_LIGHT, 0, -0.2, 0.05);
    mag.rotation.x = 0.16;
    g.add(mag);
    g.add(box(0.08, 0.1, 0.28, GRIP, 0, -0.01, -0.36)); // stock
    g.add(box(0.07, 0.16, 0.09, GRIP, 0, -0.12, 0.22)); // foregrip
    g.add(box(0.03, 0.05, 0.12, GUNMETAL, 0, 0.08, -0.08)); // rear sight
    g.add(box(0.05, 0.03, 0.08, GUNMETAL, 0, 0.07, 0.38)); // front post
    muzzleZ = 0.56;
  } else if (type === 'rifle') {
    // long barrel, handguard, scope, curved mag, stock — unmistakably a rifle
    g.add(box(0.09, 0.12, 0.55, GUNMETAL, 0, 0, 0));
    g.add(tube(0.03, 0.5, GUNMETAL, 0, 0.01, 0.5));
    g.add(box(0.1, 0.1, 0.4, WOOD, 0, -0.01, 0.32)); // handguard
    const mag = box(0.07, 0.28, 0.12, GUNMETAL_LIGHT, 0, -0.19, 0.02);
    mag.rotation.x = -0.28;
    g.add(mag);
    g.add(box(0.08, 0.12, 0.35, WOOD, 0, -0.01, -0.42)); // stock
    g.add(tube(0.035, 0.22, GUNMETAL_LIGHT, 0, 0.11, -0.05)); // scope
    g.add(box(0.04, 0.04, 0.04, GUNMETAL, 0, 0.08, -0.05)); // scope mount
    g.add(box(0.02, 0.04, 0.02, BRASS, 0, 0.09, 0.72)); // front sight
    muzzleZ = 0.78;
  } else {
    // shotgun: thick barrel, wooden pump + stock, bead sight
    g.add(tube(0.045, 0.55, GUNMETAL, 0, 0.01, 0.42));
    g.add(box(0.11, 0.09, 0.3, WOOD, 0, -0.06, 0.35)); // pump
    g.add(box(0.1, 0.13, 0.4, GUNMETAL, 0, 0, 0));
    g.add(box(0.09, 0.13, 0.32, WOOD, 0, -0.01, -0.35)); // stock
    g.add(box(0.02, 0.03, 0.02, BRASS, 0, 0.07, 0.66)); // bead
    muzzleZ = 0.72;
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, type === 'pistol' ? 0.03 : 0.01, muzzleZ);
  g.add(muzzle);
  return { group: g, muzzle };
}

// --- star-shaped muzzle flash texture, drawn once, shared ---
let flashTexture = null;
function getFlashTexture() {
  if (flashTexture) return flashTexture;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  const grad = g.createRadialGradient(0, 0, 2, 0, 0, 60);
  grad.addColorStop(0, 'rgba(255,250,220,1)');
  grad.addColorStop(0.35, 'rgba(255,200,90,0.9)');
  grad.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grad;
  // 4-point star
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 62 : 14;
    g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, 0, 20, 0, Math.PI * 2);
  g.fill();
  flashTexture = new THREE.CanvasTexture(c);
  flashTexture.colorSpace = THREE.SRGBColorSpace;
  return flashTexture;
}

export function makeFlashSprite(scale = 0.55) {
  const mat = new THREE.SpriteMaterial({
    map: getFlashTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  s.visible = false;
  return s;
}

// --- the arsenal: owned weapons, current weapon, ammo ---
export class Arsenal {
  constructor() {
    this.owned = new Set(['pistol']);
    this.current = 'pistol';
    this.ammo = {};
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id];
      this.ammo[id] = { mag: w.mag, reserve: w.reserve };
    }
    this.reloading = 0;
    this.cooldown = 0;
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
    const w = WEAPONS[id];
    if (!w || this.owned.has(id) || cash < w.price) return false;
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
    const w = this.def();
    const a = this.ammo[this.current];
    if (this.reloading > 0 || a.mag >= w.mag) return false;
    if (w.reserve !== -1 && a.reserve <= 0) return false;
    this.reloading = 1.15;
    return true;
  }

  finishReload() {
    const w = this.def();
    const a = this.ammo[this.current];
    if (w.reserve === -1) { a.mag = w.mag; return; }
    const need = w.mag - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
  }

  // consume one trigger pull; returns false when the mag is dry
  pullTrigger() {
    if (this.cooldown > 0 || this.reloading > 0) return false;
    const w = this.def();
    const a = this.ammo[this.current];
    if (a.mag <= 0) return false;
    a.mag -= 1;
    this.cooldown = w.rof;
    return true;
  }

  tick(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(); }
    }
  }

  ammoText() {
    const w = this.def();
    const a = this.ammo[this.current];
    if (this.reloading > 0) return 'RELOADING…';
    return `${a.mag} / ${w.reserve === -1 ? '∞' : a.reserve}`;
  }

  serialize() {
    return {
      owned: [...this.owned], current: this.current,
      ammo: this.ammo,
    };
  }

  restore(s) {
    if (!s) return;
    if (Array.isArray(s.owned)) this.owned = new Set(s.owned.filter((id) => WEAPONS[id]));
    if (WEAPONS[s.current] && this.owned.has(s.current)) this.current = s.current;
    if (s.ammo) {
      for (const id of Object.keys(this.ammo)) {
        if (s.ammo[id]) this.ammo[id] = { mag: s.ammo[id].mag ?? WEAPONS[id].mag, reserve: s.ammo[id].reserve ?? WEAPONS[id].reserve };
      }
    }
  }
}

// --- first-person viewmodel: the gun on the camera, bottom-right ---
export class Viewmodel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.set(0.42, -0.36, -0.95);
    this.group.rotation.set(0.06, -0.12, 0);
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
    // v2.1: a warm fill light rides with the camera so the viewmodel gun is
    // never a black blob — the dusk scene leaves it unlit otherwise
    this.fill = new THREE.PointLight(0xffe0b0, 3, 4, 1.5);
    this.fill.position.set(0.25, 0.15, -0.4);
    this.camera.add(this.fill);
  }

  setWeapon(type) {
    if (type === this.current) return;
    if (this.gun) { this.group.remove(this.gun.group); this.gun = null; }
    this.gun = buildGunMesh(type);
    // viewmodel scale: big enough to read, small enough to not block the road
    const s = type === 'pistol' ? 1.5 : type === 'smg' ? 1.25 : 1.1;
    this.gun.group.scale.setScalar(s);
    // v2.1: the gun is built pointing +Z (toward the camera) — v2 showed the
    // stock as a dark blob. Turn it around so the muzzle points down-range
    // and the rifle reads as a rifle: barrel, handguard, magazine, stock.
    this.gun.group.rotation.set(0.04, Math.PI - 0.18, 0.02);
    // the flash sits at the barrel tip — flipped with the gun, so -Z now
    this.flash.position.set(0, this.gun.muzzle.position.y * s, -this.gun.muzzle.position.z * s);
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
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flash.visible = false;
        this.flashLight.intensity = 0;
      }
    }
  }
}
