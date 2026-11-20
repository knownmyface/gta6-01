// Coral Heat — all sound is synthesized live with WebAudio: three radio stations,
// an engine hum that follows the throttle, sirens, gunshots and splashes.
// Nothing is downloaded; the radio is a little sequencer.

export const STATIONS = [
  { name: 'SUNSET FM 101.9', track: 'Golden Hour Drive', bpm: 96, root: 220, mode: 'major' },
  { name: 'REEF RADIO 88.4', track: 'Tide and Timber', bpm: 78, root: 196, mode: 'minor' },
  { name: 'BAY TALK 1010', track: 'The Voss Hour', bpm: 60, root: 164, mode: 'talk' },
];

const CHORDS_MAJOR = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]];
const CHORDS_MINOR = [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]];

export class SoundBank {
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
  unlock() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.started = true;
      // engine: a low sawtooth whose pitch follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(lp).connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
      // siren: two-tone, silent until wanted
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch {
      this.ctx = null;
    }
  }
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }
  currentStation() { return STATIONS[this.station]; }
  setEngine(speedNorm, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.035 + speedNorm * 0.05 : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + speedNorm * 130, t, 0.08);
  }
  setSiren(wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.018 : 0.0, t, 0.3);
    if (wanted > 0) {
      const phase = (performance.now() / 700) % 2;
      this.sirenOsc.frequency.setTargetAtTime(phase < 1 ? 720 : 960, t, 0.05);
    }
  }
  // one sequencer tick: chord pad + bass + hat, called from the game loop
  musicTick(now) {
    if (!this.ctx || !this.musicOn) return;
    const st = STATIONS[this.station];
    const beat = 60 / st.bpm / 2;
    if (now < this.nextNoteAt) return;
    this.nextNoteAt = now + beat;
    if (st.mode === 'talk') {
      // talk station: soft filtered blips like a distant voice, no melody
      if (this.step % 4 === 0) this.blip(st.root * (1 + (this.step % 3) * 0.06), 0.05, 0.012);
      this.step += 1;
      return;
    }
    const chords = st.mode === 'major' ? CHORDS_MAJOR : CHORDS_MINOR;
    const chord = chords[Math.floor(this.step / 4) % chords.length];
    if (this.step % 4 === 0) {
      for (const iv of chord) this.pad(st.root * Math.pow(2, iv / 12), beat * 4, 0.02);
    }
    if (this.step % 2 === 0) this.pad(st.root / 2, beat * 1.8, 0.045);
    if (this.step % 2 === 1) this.hat();
    this.step += 1;
  }
  pad(freq, dur, vol) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  blip(freq, dur, vol) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  hat() {
    const t = this.ctx.currentTime;
    const len = 0.05;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = 0.02;
    src.connect(hp).connect(g).connect(this.ctx.destination);
    src.start(t);
  }
  gunshot(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = kind === 'boom' ? 0.28 : 0.09;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, kind === 'boom' ? 1.4 : 2.2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = kind === 'boom' ? 0.3 : 0.16;
    src.connect(g).connect(this.ctx.destination);
    src.start(t);
  }
  honk() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const f of [370, 466]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.setValueAtTime(0.05, t + 0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.3);
    }
  }
  splash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = 0.4;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.5;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0.2;
    src.connect(lp).connect(g).connect(this.ctx.destination);
    src.start(t);
  }
  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 880, 1320].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const at = t + i * 0.09;
      g.gain.setValueAtTime(0.06, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(g).connect(this.ctx.destination);
      o.start(at); o.stop(at + 0.55);
    });
  }
}
