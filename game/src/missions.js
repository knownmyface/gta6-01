// Coral Heat — the story: twelve jobs for Marta Reyes, from a broke return to
// Coral Bay to the final heat wave. Two of them run on the water. Each job is a
// short chain of objectives; the runner only cares about where Kai is, what he
// is driving, and what he just did.

export const STORY = {
  hero: 'Kai Solano',
  fixer: 'Marta Reyes',
  debt: 20000,
  city: 'Coral Bay',
};

export const MISSIONS = [
  {
    id: 1, name: 'First Light', reward: 800,
    brief: 'Kai is back in Coral Bay with a dead scooter and a $20,000 debt to Marta Reyes. She is waiting on the plaza roof.',
    objectives: [
      { kind: 'goto', x: 0, z: 0, r: 12, text: 'Walk to Coral Plaza — Marta is waiting.' },
      { kind: 'goto', x: 60, z: 40, r: 10, text: 'Meet Marta at the Downtown rooftop door.' },
    ],
  },
  {
    id: 2, name: 'Hot Wheels', reward: 1200,
    brief: 'Marta needs wheels. Any wheels. Take one off the street — and make it look easy.',
    objectives: [
      { kind: 'jack', text: 'Carjack a car on the street (walk up and press E).' },
      { kind: 'drive', x: 150, z: -150, r: 12, text: 'Drive it to Tiko’s garage on Sunset Strip.' },
    ],
  },
  {
    id: 3, name: 'Harbor Run', reward: 1800, boat: true,
    brief: 'Duke Maro’s speedboat is sitting in the marina, keys in it, crew on break. Borrow it. Permanently.',
    objectives: [
      { kind: 'goto', x: -160, z: 120, r: 14, text: 'Get to the Marina District docks.' },
      { kind: 'board', text: 'Board a moored boat (walk to the water’s edge, press E).' },
      { kind: 'sail', x: -330, z: -80, r: 18, text: 'Sail out to the red buoy off the point.' },
    ],
  },
  {
    id: 4, name: 'The Long Way Home', reward: 1000,
    brief: 'A fare pays the rent. Pick up the passenger on Palm Row, drop them at Harbor Heights — no shortcuts through the plaza.',
    objectives: [
      { kind: 'drive', x: -60, z: 0, r: 10, text: 'Pick up the fare on Palm Row.' },
      { kind: 'drive', x: 180, z: 180, r: 12, text: 'Drop the fare at Harbor Heights.' },
    ],
  },
  {
    id: 5, name: 'Smoke on the Water', reward: 2400, boat: true,
    brief: 'A crate that must not be opened, a buyer waiting past the breakwater, and harbor patrol on the radio. Sail quiet, sail fast.',
    objectives: [
      { kind: 'board', text: 'Take a boat from the marina.' },
      { kind: 'sail', x: -300, z: 200, r: 16, text: 'Run the cargo to the south buoy — patrol boats are out.' },
      { kind: 'sail', x: -360, z: -160, r: 16, text: 'Loop north and lose the patrol in open water.' },
    ],
  },
  {
    id: 6, name: 'Five-Star Problem', reward: 2000,
    brief: 'Officer Voss has Kai’s face on every cruiser dash. Stay free for forty-five seconds with three stars on your tail.',
    objectives: [
      { kind: 'heat', stars: 2, text: 'Raise some heat — get the PD’s attention (2 stars).' },
      { kind: 'survive', seconds: 45, stars: 2, text: 'Survive 45 seconds with the heat on.' },
    ],
  },
  {
    id: 7, name: 'Midnight Marina', reward: 2200,
    brief: 'The Coral Queen yacht is the prettiest thing in the bay and it belongs to the man who owns Marta’s debt. Take it.',
    objectives: [
      { kind: 'goto', x: -146, z: 150, r: 12, text: 'Reach the marina office on foot.' },
      { kind: 'board', boat: 'yacht', text: 'Board the Coral Queen yacht.' },
      { kind: 'sail', x: -340, z: 40, r: 20, text: 'Sail the yacht out past the docks.' },
    ],
  },
  {
    id: 8, name: 'Payday at Palm Row', reward: 2600,
    brief: 'A rival crew is collecting on Palm Row and they brought friends. Disable four cruisers and the street is yours.',
    objectives: [
      { kind: 'goto', x: -40, z: 10, r: 14, text: 'Get to the ambush on Palm Row.' },
      { kind: 'disable', need: 4, text: 'Disable 4 PD cruisers (shoot them until they smoke).' },
    ],
  },
  {
    id: 9, name: 'Air Support', reward: 2800,
    brief: 'Air One is up and Voss is not bluffing. Four stars, one helicopter, sixty seconds. Don’t stop moving.',
    objectives: [
      { kind: 'heat', stars: 4, text: 'Push the heat to 4 stars — Air One is coming.' },
      { kind: 'survive', seconds: 60, stars: 3, text: 'Survive 60 seconds under the helicopter.' },
    ],
  },
  {
    id: 10, name: 'The Fixer', reward: 2000,
    brief: 'Marta needs a ride across town and she does not wait. Drive her from the plaza to the marina — smooth, no cops.',
    objectives: [
      { kind: 'drive', x: 0, z: 0, r: 10, text: 'Pick up Marta at Coral Plaza.' },
      { kind: 'drive', x: -150, z: 120, r: 12, text: 'Drive Marta to the Marina District.' },
    ],
  },
  {
    id: 11, name: 'Coral Crown', reward: 3200,
    brief: 'A Comet GT in Harbor Heights, owner asleep, alarm already paid off. Bring it to the marina and the debt is nearly gone.',
    objectives: [
      { kind: 'goto', x: 180, z: 180, r: 12, text: 'Reach the Comet GT in Harbor Heights.' },
      { kind: 'jack', text: 'Take the Comet GT.' },
      { kind: 'drive', x: -150, z: 160, r: 12, text: 'Deliver it to the marina yard.' },
    ],
  },
  {
    id: 12, name: 'Heat Wave', reward: 5000,
    brief: 'The finale. Five stars, the whole bay watching, one boat waiting at the marina. Get to the water and disappear.',
    objectives: [
      { kind: 'heat', stars: 5, text: 'Light it up — 5 stars. The whole city is coming.' },
      { kind: 'goto', x: -160, z: 160, r: 14, text: 'Fight through to the marina docks.' },
      { kind: 'board', text: 'Board any boat — now.' },
      { kind: 'sail', x: -390, z: 0, r: 22, text: 'Vanish into open water. The heat wave breaks.' },
    ],
  },
];

export class MissionRunner {
  constructor(onEvent) {
    this.onEvent = onEvent || (() => {});
    this.index = 0;           // 0-based mission index
    this.objIndex = 0;
    this.objTimer = 0;
    this.disabledCount = 0;
    this.flags = { jacked: false, boarded: false, boardedKind: null };
    this.done = false;
  }
  current() { return MISSIONS[this.index]; }
  objective() {
    const m = this.current();
    return m ? m.objectives[this.objIndex] : null;
  }
  progress() {
    const m = this.current();
    if (!m) return 1;
    return this.objIndex / m.objectives.length;
  }
  startMission(i) {
    this.index = i;
    this.objIndex = 0;
    this.objTimer = 0;
    this.disabledCount = 0;
    this.flags = { jacked: false, boarded: false, boardedKind: null };
    const m = this.current();
    if (m) this.onEvent({ type: 'mission-start', mission: m });
  }
  noteJack() { this.flags.jacked = true; }
  noteBoard(kind) { this.flags.boarded = true; this.flags.boardedKind = kind; }
  noteDisabled() { this.disabledCount += 1; }
  // ctx: {x, z, mode, wanted, dt}
  tick(ctx) {
    if (this.done) return;
    const m = this.current();
    if (!m) { this.done = true; return; }
    const obj = this.objective();
    if (!obj) {
      // mission complete
      this.onEvent({ type: 'mission-complete', mission: m });
      if (this.index + 1 < MISSIONS.length) this.startMission(this.index + 1);
      else { this.done = true; this.onEvent({ type: 'story-complete' }); }
      return;
    }
    const d = obj.x !== undefined ? Math.hypot(ctx.x - obj.x, ctx.z - obj.z) : 0;
    let done = false;
    switch (obj.kind) {
      case 'goto': done = d < obj.r; break;
      case 'drive': done = ctx.mode === 'car' && d < obj.r; break;
      case 'sail': done = ctx.mode === 'boat' && d < obj.r; break;
      case 'jack': done = this.flags.jacked; break;
      case 'board':
        done = this.flags.boarded && (!obj.boat || this.flags.boardedKind === obj.boat);
        break;
      case 'heat': done = ctx.wanted >= obj.stars; break;
      case 'survive':
        if (ctx.wanted >= obj.stars) this.objTimer += ctx.dt;
        else this.objTimer = Math.max(0, this.objTimer - ctx.dt * 2);
        done = this.objTimer >= obj.seconds;
        break;
      case 'disable': done = this.disabledCount >= obj.need; break;
      default: done = false;
    }
    if (done) {
      this.objIndex += 1;
      this.objTimer = 0;
      this.flags.jacked = false;
      this.flags.boarded = false;
      this.flags.boardedKind = null;
      const next = this.objective();
      this.onEvent({ type: 'objective-done', mission: m, next });
    }
  }
  objectiveProgress(ctx) {
    const obj = this.objective();
    if (!obj) return 1;
    if (obj.kind === 'survive') return Math.min(1, this.objTimer / obj.seconds);
    if (obj.kind === 'disable') return Math.min(1, this.disabledCount / obj.need);
    if (obj.x !== undefined) {
      const d = Math.hypot(ctx.x - obj.x, ctx.z - obj.z);
      return Math.max(0, Math.min(1, 1 - d / 320));
    }
    return this.flags.jacked || this.flags.boarded ? 1 : 0;
  }
}
