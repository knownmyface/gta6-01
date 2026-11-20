// CORAL HEAT v2.8 — the loadout. Three original weapons, three HUD slots,
// honest trade-offs: the pistol never runs dry, the SMG sprays, the Boomstick
// ends arguments at close range. Each gun carries its own reload time now,
// so the slow Boomstick really feels slow.

export const GUN_DEFS = [
  {
    key: 'pistol', slot: 0, name: 'P9 PISTOL', short: 'P9',
    damage: 36, rate: 0.3, spread: 0.02, range: 72, pellets: 1,
    auto: false, ammo: Infinity, kick: 0.012, sound: 'pop', reloadTime: 0.9,
    blurb: 'Marta’s old service pistol. It has never jammed, and it never runs dry.',
  },
  {
    key: 'smg', slot: 1, name: 'STINGER SMG', short: 'STG',
    damage: 15, rate: 0.085, spread: 0.06, range: 58, pellets: 1,
    auto: true, ammo: 150, kick: 0.008, sound: 'crack', reloadTime: 1.1,
    blurb: 'Nine-millimetre confetti at 800 rounds a minute. Bring spare mags.',
  },
  {
    key: 'shotgun', slot: 2, name: 'BOOMSTICK 12', short: 'BST',
    damage: 14, rate: 0.9, spread: 0.11, range: 28, pellets: 7,
    auto: false, ammo: 28, kick: 0.05, sound: 'boom', reloadTime: 1.8,
    blurb: 'Seven pellets, one short conversation. Slow to reload, quick to end things.',
  },
];

export class Loadout {
  constructor() {
    this.slots = GUN_DEFS.map((d) => ({ def: d, ammo: d.ammo, owned: d.key === 'pistol' }));
    this.slots[1].owned = true; // Kai starts with the SMG too — Marta insists
    this.current = 0;
    this.cooldown = 0;
    this.reloading = 0;
  }
  currentGun() { return this.slots[this.current]; }
  pick(slot) {
    if (slot < 0 || slot > 2) return false;
    if (!this.slots[slot].owned) return false;
    this.current = slot;
    this.cooldown = Math.max(this.cooldown, 0.12);
    return true;
  }
  ready() {
    const s = this.currentGun();
    if (this.cooldown > 0) return false;
    if (this.reloading > 0) return false;
    if (!s.owned) return false;
    if (s.ammo !== Infinity && s.ammo <= 0) return false;
    return true;
  }
  // returns the weapon def if a shot left the barrel, else null
  shoot() {
    if (!this.ready()) return null;
    const s = this.currentGun();
    this.cooldown = s.def.rate;
    if (s.ammo !== Infinity) s.ammo -= 1;
    return s.def;
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading <= 0) return;
    this.reloading -= dt;
    if (this.reloading > 0) return;
    this.currentGun().ammo = this.currentGun().def.ammo;
  }
  reload() {
    const s = this.currentGun();
    if (s.ammo === Infinity) return false;
    if (s.ammo === s.def.ammo) return false;
    if (this.reloading > 0) return false;
    this.reloading = s.def.reloadTime;
    return true;
  }
  addAmmo(slot, n) {
    const s = this.slots[slot];
    if (!s.owned) return false;
    if (s.def.ammo === Infinity) return false;
    s.ammo = Math.min(s.def.ammo * 3, s.ammo + n);
    return true;
  }
  open(slot) {
    if (slot < 0 || slot > 2) return false;
    const s = this.slots[slot];
    s.owned = true;
    if (s.ammo === 0) s.ammo = s.def.ammo;
    return true;
  }
  ammoLabel(slot) {
    const s = this.slots[slot];
    if (!s.owned) return 'LOCKED';
    return s.ammo === Infinity ? '∞ ammo' : `${s.ammo} rounds`;
  }
}
