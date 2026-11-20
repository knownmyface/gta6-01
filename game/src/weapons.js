// Coral Heat — the arsenal. Three original weapons, three HUD slots, honest
// trade-offs: the pistol never runs dry, the SMG sprays, the Boomstick ends
// arguments at close range.

export const WEAPON_DEFS = [
  {
    key: 'pistol', slot: 0, name: 'P9 PISTOL', short: 'P9',
    damage: 34, rate: 0.28, spread: 0.02, range: 70, pellets: 1,
    auto: false, ammo: Infinity, kick: 0.012, sound: 'pop',
    blurb: 'Marta’s old service pistol. Never jams, never runs dry.',
  },
  {
    key: 'smg', slot: 1, name: 'STINGER SMG', short: 'STG',
    damage: 16, rate: 0.09, spread: 0.06, range: 55, pellets: 1,
    auto: true, ammo: 120, kick: 0.008, sound: 'crack',
    blurb: 'Sprays nine-millimetre confetti. Eats bullets like candy.',
  },
  {
    key: 'shotgun', slot: 2, name: 'BOOMSTICK 12', short: 'BST',
    damage: 13, rate: 0.85, spread: 0.11, range: 26, pellets: 7,
    auto: false, ammo: 24, kick: 0.05, sound: 'boom',
    blurb: 'Seven pellets, one conversation. Reloads slow, forgives nothing.',
  },
];

export class Arsenal {
  constructor() {
    this.slots = WEAPON_DEFS.map((d) => ({ def: d, ammo: d.ammo, owned: d.key === 'pistol' }));
    this.slots[1].owned = true; // Kai starts with the SMG too — Marta insists
    this.current = 0;
    this.cooldown = 0;
    this.reloading = 0;
  }
  active() { return this.slots[this.current]; }
  select(slot) {
    if (slot < 0 || slot > 2) return false;
    if (!this.slots[slot].owned) return false;
    this.current = slot;
    this.cooldown = Math.max(this.cooldown, 0.12);
    return true;
  }
  canFire() {
    const s = this.active();
    if (this.cooldown > 0 || this.reloading > 0) return false;
    if (!s.owned) return false;
    if (s.ammo !== Infinity && s.ammo <= 0) return false;
    return true;
  }
  // returns the weapon def if a shot left the barrel, else null
  fire() {
    if (!this.canFire()) return null;
    const s = this.active();
    this.cooldown = s.def.rate;
    if (s.ammo !== Infinity) s.ammo -= 1;
    return s.def;
  }
  tick(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const s = this.active();
        s.ammo = s.def.ammo;
      }
    }
  }
  reload() {
    const s = this.active();
    if (s.ammo === Infinity || s.ammo === s.def.ammo || this.reloading > 0) return false;
    this.reloading = s.def.key === 'shotgun' ? 1.6 : 1.0;
    return true;
  }
  buyAmmo(slot, n) {
    const s = this.slots[slot];
    if (!s.owned || s.def.ammo === Infinity) return false;
    s.ammo = Math.min(s.def.ammo * 3, s.ammo + n);
    return true;
  }
  unlock(slot) {
    if (slot < 0 || slot > 2) return false;
    this.slots[slot].owned = true;
    if (this.slots[slot].ammo === 0) this.slots[slot].ammo = this.slots[slot].def.ammo;
    return true;
  }
  ammoText(slot) {
    const s = this.slots[slot];
    if (!s.owned) return 'LOCKED';
    return s.ammo === Infinity ? '∞ ammo' : `${s.ammo} rounds`;
  }
}
