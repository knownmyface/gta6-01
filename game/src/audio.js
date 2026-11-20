// CORAL HEAT v2.8 — all sound is synthesized live with WebAudio: four radio
// stations, an engine hum that follows the throttle, sirens, gunshots and
// splashes. Nothing is downloaded; the radio is a little sequencer built on
// two tiny primitives — tone() and noise() — instead of a dozen near-copies.

export const CHANNELS = [
  { name: 'SUNSET FM 101.9', track: 'Golden Hour Drive', bpm: 96, root: 220, mode: 'major' },
  { name: 'REEF RADIO 88.4', track: 'Tide and Timber', bpm: 78, root: 196, mode: 'minor' },
  { name: 'PALM WAVE 76.1', track: 'Slow Palm Sway', bpm: 84, root: 208, mode: 'major' },
  { name: 'BAY TALK 1010', track: 'The Voss Hour', bpm: 60, root: 164, mode: 'talk' },
];

// Four-chord loops per mode, semitone offsets from the station root.
const LOOPS = {
  major: [[0, 4, 7, 12], [5, 9, 12, 16], [7, 11, 14, 19], [5, 9, 12, 17]],
  minor: [[0, 3, 7, 12], [5, 8, 12, 15], [3, 7, 10, 15], [7, 10, 14, 17]],
};

export class Radio {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteAt = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.started = false;
  }
  start() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.started = true;
      // engine: a low sawtooth whose pitch follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp);
      lp.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      // siren: two-tone triangle, silent until wanted
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch {
      this.ctx = null;
    }
  }
  nextChannel() {
    this.station = (this.station + 1) % CHANNELS.length;
    this.step = 0;
    return CHANNELS[this.station];
  }
  currentChannel() { return CHANNELS[this.station]; }
  engineHum(speedNorm, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const vol = driving ? 0.035 + speedNorm * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + speedNorm * 130, t, 0.08);
  }
  sirenWail(wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.018 : 0, t, 0.3);
    if (wanted > 0) {
      const hi = (performance.now() / 700) % 2 < 1;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 720 : 960, t, 0.05);
    }
  }
  // --- the two primitives every sound is built from ---
  tone(freq, dur, vol, type = 'sine', at = 0, slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noise(dur, vol, filterType = 'lowpass', filterFreq = 1200, at = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(flt);
    flt.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
  }
  // one sequencer tick: chord pad + bass + hat, called from the game loop
  beat(now) {
    if (!this.ctx || !this.musicOn) return;
    const st = CHANNELS[this.station];
    const eighth = 60 / st.bpm / 2;
    if (now < this.nextNoteAt) return;
    this.nextNoteAt = now + eighth;
    const s = this.step;
    if (st.mode === 'talk') {
      // talk station: soft blips like a distant voice, no melody
      if (s % 4 === 0) this.tone(st.root * (1 + (s % 3) * 0.06), 0.05, 0.012);
      this.step += 1;
      return;
    }
    const loop = LOOPS[st.mode];
    const chord = loop[Math.floor(s / 4) % loop.length];
    const bar = s % 4;
    if (bar === 0) {
      for (const iv of chord) {
        this.tone(st.root * Math.pow(2, iv / 12), eighth * 4, 0.02, 'triangle');
      }
    }
    if (bar === 2) this.tone(st.root / 2, eighth * 1.8, 0.045, 'triangle');
    if (bar === 1 || bar === 3) this.noise(0.05, 0.02, 'highpass', 6000);
    this.step += 1;
  }
  bang(kind) {
    if (kind === 'boom') this.noise(0.28, 0.3, 'lowpass', 900);
    else if (kind === 'crack') this.noise(0.09, 0.16, 'bandpass', 2400);
    else this.noise(0.09, 0.16, 'bandpass', 1800);
  }
  horn() {
    this.tone(370, 0.26, 0.05, 'square');
    this.tone(466, 0.26, 0.05, 'square');
  }
  splash() {
    this.noise(0.4, 0.2, 'lowpass', 900);
  }
  ding() {
    this.tone(660, 0.5, 0.06, 'sine', 0);
    this.tone(880, 0.5, 0.06, 'sine', 0.09);
    this.tone(1320, 0.5, 0.06, 'sine', 0.18);
  }
}
