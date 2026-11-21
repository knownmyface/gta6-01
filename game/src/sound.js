// sound.js — fully synthesized WebAudio: engine hum, radio stations,
// sirens, gunshots, explosions. No audio assets, no network. Every call is
// guarded so the game plays silently (and without errors) before the first
// user gesture or in a headless playtest.
const RADIO_TRACKS = [
  { name: "CORAL FM 88.1 — Sunset Drive", root: 220.0, minor: true, bpm: 96 },
  { name: "PALM WAVE 101.4 — Neon Nights", root: 196.0, minor: false, bpm: 112 },
  { name: "TIDE TALK 540 AM — Harbor News", root: 164.81, minor: true, bpm: 80 },
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOscA = null;
    this.sirenOscB = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.radioTimer = null;
    this.radioIndex = 0;
    this.radioOn = false;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 420;
      this.engineOsc.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  setEngine(speed01, throttle) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 190 + throttle * 22, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.015 + speed01 * 0.05 + throttle * 0.02, t, 0.1);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + dur + 0.02);
    } catch (e) { /* silent */ }
  }

  gunshot() {
    if (!this.ctx) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.35;
      src.connect(g);
      g.connect(this.master);
      src.start();
    } catch (e) { /* silent */ }
    this.blip(160, 0.08, "square", 0.12);
  }

  explosion() {
    if (!this.ctx) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * 0.9);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(900, this.ctx.currentTime);
      f.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.8);
      const g = this.ctx.createGain();
      g.gain.value = 0.6;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    } catch (e) { /* silent */ }
    this.blip(48, 0.7, "sine", 0.4);
  }

  siren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    try {
      if (on) {
        this.sirenOscA = this.ctx.createOscillator();
        this.sirenOscA.type = "triangle";
        this.sirenOscA.frequency.value = 720;
        this.sirenOscB = this.ctx.createOscillator();
        this.sirenOscB.type = "triangle";
        this.sirenOscB.frequency.value = 540;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.0;
        this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.3);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.9;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.02;
        lfo.connect(lfoGain);
        lfoGain.connect(this.sirenGain.gain);
        this.sirenOscA.connect(this.sirenGain);
        this.sirenOscB.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOscA.start();
        this.sirenOscB.start();
        lfo.start();
        this._sirenLfo = lfo;
      } else if (this.sirenOscA) {
        const t = this.ctx.currentTime;
        this.sirenGain.gain.setTargetAtTime(0, t, 0.15);
        const a = this.sirenOscA;
        const b = this.sirenOscB;
        const l = this._sirenLfo;
        window.setTimeout(() => {
          try { a.stop(); b.stop(); if (l) l.stop(); } catch (e) { /* silent */ }
        }, 600);
        this.sirenOscA = null;
        this.sirenOscB = null;
      }
    } catch (e) { /* silent */ }
  }

  startRadio(index) {
    if (!this.ctx) return;
    this.radioIndex = ((index % RADIO_TRACKS.length) + RADIO_TRACKS.length) % RADIO_TRACKS.length;
    this.radioOn = true;
    this.stopRadioTimer();
    const track = RADIO_TRACKS[this.radioIndex];
    const beat = 60 / track.bpm / 2;
    const scale = track.minor ? [1, 1.189, 1.335, 1.498, 1.782, 2] : [1, 1.122, 1.26, 1.498, 1.682, 2];
    let step = 0;
    const playNote = () => {
      if (!this.radioOn || !this.ctx) return;
      const deg = scale[step % scale.length];
      const f = track.root * deg;
      this.blip(f, beat * 1.8, "triangle", 0.05);
      if (step % 4 === 0) this.blip(track.root / 2, beat * 3.4, "sine", 0.07);
      step++;
      this.radioTimer = window.setTimeout(playNote, beat * 1000);
    };
    playNote();
    return RADIO_TRACKS[this.radioIndex].name;
  }

  stopRadioTimer() {
    if (this.radioTimer) {
      window.clearTimeout(this.radioTimer);
      this.radioTimer = null;
    }
  }

  stopRadio() {
    this.radioOn = false;
    this.stopRadioTimer();
  }

  nextRadio() {
    if (!this.ctx) return RADIO_TRACKS[this.radioIndex].name;
    this.stopRadioTimer();
    this.radioIndex = (this.radioIndex + 1) % RADIO_TRACKS.length;
    return this.startRadio(this.radioIndex);
  }

  radioName() {
    return RADIO_TRACKS[this.radioIndex].name;
  }

  uiClick() {
    this.blip(880, 0.06, "sine", 0.06);
  }

  missionSting() {
    this.blip(523.25, 0.14, "triangle", 0.1);
    window.setTimeout(() => this.blip(659.25, 0.14, "triangle", 0.1), 130);
    window.setTimeout(() => this.blip(783.99, 0.28, "triangle", 0.12), 260);
  }
}
