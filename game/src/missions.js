// CORAL HEAT v2.8 — the story: twelve jobs for Marta Reyes, from a broke
// return to Coral Bay to the final heat wave. Two of them run on the water.
// Each job is a short chain of tasks; the runner only cares about where Kai
// is, what he is driving, and what he just did.

export const SAGA = {
  hero: 'Kai Solano',
  fixer: 'Marta Reyes',
  debt: 20000,
  city: 'Coral Bay',
};

export const JOBS = [
  {
    id: 1, name: 'First Light', reward: 850,
    brief: 'Kai rolls back into Coral Bay on a dead scooter, owing Marta Reyes $20,000. She is waiting by the plaza fountain.',
    tasks: [
      { kind: 'goto', x: 0, z: 0, r: 12, text: 'Walk to Coral Plaza — Marta is waiting by the fountain.' },
      { kind: 'goto', x: 60, z: 40, r: 10, text: 'Climb to the Downtown rooftop door.' },
    ],
  },
  {
    id: 2, name: 'Hot Wheels', reward: 1250,
    brief: 'Marta needs wheels tonight. Any wheels. Lift one off the street — and make it look easy.',
    tasks: [
      { kind: 'jack', text: 'Carjack a car on the street (walk up and press E).' },
      { kind: 'drive', x: 152, z: -148, r: 12, text: 'Drive it to Tiko’s garage on Sunset Strip.' },
    ],
  },
  {
    id: 3, name: 'Harbor Run', reward: 1850, boat: true,
    brief: 'Duke Maro’s runner sits in the marina with the keys in it and the crew on break. Borrow it. Keep it.',
    tasks: [
      { kind: 'goto', x: -160, z: 124, r: 14, text: 'Get to the Marina District docks.' },
      { kind: 'board', text: 'Board a moored boat (walk to the water’s edge, press E).' },
      { kind: 'sail', x: -330, z: -80, r: 18, text: 'Sail out to the red buoy off the point.' },
    ],
  },
  {
    id: 4, name: 'The Long Way Home', reward: 1050,
    brief: 'A fare pays the rent. Pick up the passenger on Palm Row, drop them at Harbor Heights — no shortcuts through the plaza.',
    tasks: [
      { kind: 'drive', x: -60, z: 0, r: 10, text: 'Pick up the fare on Palm Row.' },
      { kind: 'drive', x: 180, z: 180, r: 12, text: 'Drop the fare at Harbor Heights.' },
    ],
  },
  {
    id: 5, name: 'Smoke on the Water', reward: 2450, boat: true,
    brief: 'A crate that must not be opened, a buyer waiting past the breakwater, harbor patrol on the radio. Sail quiet, sail fast.',
    tasks: [
      { kind: 'board', text: 'Take a boat from the marina.' },
      { kind: 'sail', x: -300, z: 200, r: 16, text: 'Run the cargo to the south buoy — patrol boats are out.' },
      { kind: 'sail', x: -360, z: -160, r: 16, text: 'Loop north and lose the patrol in open water.' },
    ],
  },
  {
    id: 6, name: 'Five-Star Problem', reward: 2050,
    brief: 'Officer Voss has Kai’s face on every interceptor dash. Stay free for forty-five seconds with two stars on your tail.',
    tasks: [
      { kind: 'heat', stars: 2, text: 'Raise some heat — get the PD’s attention (2 stars).' },
      { kind: 'survive', seconds: 45, stars: 2, text: 'Survive 45 seconds with the heat on.' },
    ],
  },
  {
    id: 7, name: 'Midnight Marina', reward: 2250,
    brief: 'The Coral Queen is the prettiest hull in the bay, and it belongs to the man who holds Marta’s debt. Take it.',
    tasks: [
      { kind: 'goto', x: -146, z: 150, r: 12, text: 'Reach the marina office on foot.' },
      { kind: 'board', boat: 'queen', text: 'Board the Coral Queen yacht.' },
      { kind: 'sail', x: -340, z: 40, r: 20, text: 'Sail the yacht out past the docks.' },
    ],
  },
  {
    id: 8, name: 'Payday at Palm Row', reward: 2650,
    brief: 'A rival crew is collecting on Palm Row and they brought friends. Disable four interceptors and the street is yours.',
    tasks: [
      { kind: 'goto', x: -40, z: 10, r: 14, text: 'Get to the ambush on Palm Row.' },
      { kind: 'disable', need: 4, text: 'Disable 4 PD interceptors (shoot them until they smoke).' },
    ],
  },
  {
    id: 9, name: 'Air Support', reward: 2850,
    brief: 'Air One is up and Voss is not bluffing. Four stars, one helicopter, sixty seconds. Don’t stop moving.',
    tasks: [
      { kind: 'heat', stars: 4, text: 'Push the heat to 4 stars — Air One is coming.' },
      { kind: 'survive', seconds: 60, stars: 3, text: 'Survive 60 seconds under the helicopter.' },
    ],
  },
  {
    id: 10, name: 'The Fixer', reward: 2050,
    brief: 'Marta needs a ride across town and she does not wait. Drive her from the plaza to the marina — smooth, no cops.',
    tasks: [
      { kind: 'drive', x: 0, z: 0, r: 10, text: 'Pick up Marta at Coral Plaza.' },
      { kind: 'drive', x: -150, z: 124, r: 12, text: 'Drive Marta to the Marina District.' },
    ],
  },
  {
    id: 11, name: 'Coral Crown', reward: 3250,
    brief: 'A Flare GT sits in Harbor Heights, owner asleep, alarm already paid off. Bring it to the marina and the debt is nearly gone.',
    tasks: [
      { kind: 'goto', x: 180, z: 180, r: 12, text: 'Reach the Flare GT in Harbor Heights.' },
      { kind: 'jack', text: 'Take the Flare GT.' },
      { kind: 'drive', x: -150, z: 164, r: 12, text: 'Deliver it to the marina yard.' },
    ],
  },
  {
    id: 12, name: 'Heat Wave', reward: 5200,
    brief: 'The finale. Five stars, the whole bay watching, one boat waiting at the marina. Get to the water and disappear.',
    tasks: [
      { kind: 'heat', stars: 5, text: 'Light it up — 5 stars. The whole city is coming.' },
      { kind: 'goto', x: -160, z: 164, r: 14, text: 'Fight through to the marina docks.' },
      { kind: 'board', text: 'Board any boat — now.' },
      { kind: 'sail', x: -390, z: 0, r: 22, text: 'Vanish into open water. The heat wave breaks.' },
    ],
  },
];

function freshFlags() {
  return { jacked: false, boarded: false, boardedKind: null };
}

export class JobRunner {
  constructor(onEvent) {
    this.onEvent = onEvent || (() => {});
    this.index = 0; // 0-based job index
    this.taskIndex = 0;
    this.taskTimer = 0;
    this.disabledCount = 0;
    this.flags = freshFlags();
    this.done = false;
  }
  job() { return JOBS[this.index]; }
  task() {
    const m = this.job();
    return m ? m.tasks[this.taskIndex] : null;
  }
  fraction() {
    const m = this.job();
    if (!m) return 1;
    return this.taskIndex / m.tasks.length;
  }
  beginJob(i) {
    this.index = i;
    this.taskIndex = 0;
    this.taskTimer = 0;
    this.disabledCount = 0;
    this.flags = freshFlags();
    const m = this.job();
    if (m) this.onEvent({ type: 'job-start', job: m });
  }
  markJack() { this.flags.jacked = true; }
  markBoard(kind) { this.flags.boarded = true; this.flags.boardedKind = kind; }
  markDisabled() { this.disabledCount += 1; }
  // one task cleared: move on, reset the per-task state, announce the next
  advance() {
    this.taskIndex += 1;
    this.taskTimer = 0;
    this.flags = freshFlags();
    this.onEvent({ type: 'task-done', job: this.job(), next: this.task() });
  }
  finishJob() {
    const m = this.job();
    this.onEvent({ type: 'job-complete', job: m });
    if (this.index + 1 < JOBS.length) this.beginJob(this.index + 1);
    else { this.done = true; this.onEvent({ type: 'story-complete' }); }
  }
  // ctx: {x, z, mode, wanted, dt}
  tick(ctx) {
    if (this.done) return;
    const m = this.job();
    if (!m) { this.done = true; return; }
    const obj = this.task();
    if (!obj) { this.finishJob(); return; }
    const d = obj.x !== undefined ? Math.hypot(ctx.x - obj.x, ctx.z - obj.z) : 0;
    const cleared = this.checkTask(obj, ctx, d);
    if (cleared) this.advance();
  }
  checkTask(obj, ctx, d) {
    switch (obj.kind) {
      case 'goto': return d < obj.r;
      case 'drive': return ctx.mode === 'car' && d < obj.r;
      case 'sail': return ctx.mode === 'boat' && d < obj.r;
      case 'jack': return this.flags.jacked;
      case 'board':
        return this.flags.boarded && (!obj.boat || this.flags.boardedKind === obj.boat);
      case 'heat': return ctx.wanted >= obj.stars;
      case 'survive': {
        if (ctx.wanted >= obj.stars) this.taskTimer += ctx.dt;
        else this.taskTimer = Math.max(0, this.taskTimer - ctx.dt * 2);
        return this.taskTimer >= obj.seconds;
      }
      case 'disable': return this.disabledCount >= obj.need;
      default: return false;
    }
  }
  taskFraction(ctx) {
    const obj = this.task();
    if (!obj) return 1;
    if (obj.kind === 'survive') return Math.min(1, this.taskTimer / obj.seconds);
    if (obj.kind === 'disable') return Math.min(1, this.disabledCount / obj.need);
    if (obj.x !== undefined) {
      const d = Math.hypot(ctx.x - obj.x, ctx.z - obj.z);
      return Math.max(0, Math.min(1, 1 - d / 320));
    }
    return this.flags.jacked || this.flags.boarded ? 1 : 0;
  }
}
