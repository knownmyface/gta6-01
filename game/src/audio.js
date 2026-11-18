// Procedural audio for CORAL HEAT: no audio files, every sound is synthesized
// with WebAudio. Engine hum, police siren, gunshots, UI blips and three radio
// stations of sequenced synth music. Safe to call before any user gesture: the
// context is created lazily and everything no-ops while it is suspended.
import { pick } from './rng.js';

const STATIONS = [
  { name: 'CORAL FM 92.1', track: 'Sunset Drive — The Palms', bpm: 96, root: 220.00, scale: [0, 3, 5, 7, 10], wave: 'triangle', bass: true },
  { name: 'HEATWAVE 88', track: 'Neon Pursuit — Vex Marlow', bpm: 128, root: 164.81, scale: [0, 2, 3, 7, 8, 10], wave: 'sawtooth', bass: true },
  { name: 'MARINA NIGHTS', track: 'Low Tide — Ana Solis', bpm: 76, root: 196.00, scale: [0, 4, 5, 7, 11], wave: 'sine', bass: false },
];

export class RadioAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.station = 0;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.musicTimer = null;
    this.started = false;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
      return true;
    } catch { return false; }
  }

  unlock() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (!this.started) { this.started = true; this.startEngine(); this.startSiren(); this.startMusicLoop(); }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  setStation(i) {
    this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }

  currentStation() { return STATIONS[this.station]; }

  // --- engine: two detuned saws whose pitch follows speed ---
  startEngine() {
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 27.5;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfxGain);
    o1.start(); o2.start();
    this.engineOsc = o1; this.engineOsc2 = o2; this.engineGain = g;
  }

  setEngine(speedMph, inCar) {
    if (!this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = inCar ? 0.05 + Math.min(0.09, speedMph / 1800) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    const freq = 48 + speedMph * 1.1;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(freq / 2, t, 0.1);
  }

  // --- police siren: slow two-tone wail, gain follows wanted level ---
  startSiren() {
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 720;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    const lfo = this.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.55;
    const lg = this.ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g); g.connect(this.sfxGain);
    o.start(); lfo.start();
    this.sirenGain = g;
  }

  setSiren(wanted) {
    if (!this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.028 + wanted * 0.008 : 0, this.ctx.currentTime, 0.3);
    // v2.1: duck the radio under a 3+ star chase so the siren cuts through
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(wanted >= 3 ? 0.09 : 0.16, this.ctx.currentTime, 0.5);
  }

  // --- radio: a tiny step sequencer, one 16-step loop per station ---
  startMusicLoop() {
    this.musicTimer = setInterval(() => this.musicTick(), 40);
  }

  musicTick() {
    if (!this.ctx || this.ctx.state !== 'suspended' && this.muted) return;
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const st = STATIONS[this.station];
    const stepDur = 60 / st.bpm / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      if (this.nextStepTime < this.ctx.currentTime - 0.05) this.nextStepTime = this.ctx.currentTime;
      this.scheduleStep(st, this.step, this.nextStepTime, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += stepDur;
    }
  }

  scheduleStep(st, step, time, stepDur) {
    const s16 = step % 16;
    const chord = [0, 3, 7, 10][Math.floor(step / 16) % 4];
    // bass on beats
    if (s16 % 4 === 0 && st.bass) this.note(st.root / 2, time, stepDur * 3.5, 'sine', 0.5);
    // pad chord tones
    if (s16 === 0 || s16 === 8) {
      for (const iv of [0, 3, 7]) this.note(st.root * Math.pow(2, (st.scale[iv % st.scale.length] + chord) / 12) / 2, time, stepDur * 8, 'triangle', 0.10);
    }
    // lead: pentatonic walk, deterministic per step
    const leadSteps = [0, -1, 2, -1, 5, -1, 3, -1, 7, -1, 5, -1, 3, 2, -1, 0];
    const lv = leadSteps[s16];
    if (lv >= 0) {
      const semi = st.scale[lv % st.scale.length] + 12 * Math.floor(lv / st.scale.length) + chord;
      this.note(st.root * Math.pow(2, semi / 12), time, stepDur * 1.8, st.wave, 0.16);
    }
    // hat tick
    if (s16 % 2 === 1) this.noise(time, 0.03, 0.05, 6000);
  }

  note(freq, time, dur, type, vol) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(time); o.stop(time + dur + 0.05);
  }

  noise(time, dur, vol, freq) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(time);
  }

  // --- one-shots ---
  blip(freq = 880) {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    this.note(freq, this.ctx.currentTime, 0.09, 'square', 0.12);
  }

  gunshot() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    this.noise(this.ctx.currentTime, 0.14, 0.5, 900);
    this.note(90, this.ctx.currentTime, 0.1, 'square', 0.25);
  }

  crash() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    this.noise(this.ctx.currentTime, 0.25, 0.4, 400);
  }

  missionJingle() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const t0 = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, t0 + i * 0.09, 0.35, 'triangle', 0.2));
  }

  stealJingle() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const t0 = this.ctx.currentTime;
    [392, 311, 466].forEach((f, i) => this.note(f, t0 + i * 0.07, 0.2, 'sawtooth', 0.12));
  }

  // --- v2 one-shots: reload clicks, weapon switch, shop cha-ching, coin ---
  reloadClick() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const t0 = this.ctx.currentTime;
    this.noise(t0, 0.05, 0.25, 2500);
    this.note(180, t0 + 0.12, 0.08, 'square', 0.12);
    this.noise(t0 + 0.28, 0.06, 0.3, 1800);
  }

  weaponSwitch() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const t0 = this.ctx.currentTime;
    this.noise(t0, 0.06, 0.3, 3000);
    this.note(320, t0 + 0.08, 0.06, 'square', 0.1);
  }

  shopBuy() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const t0 = this.ctx.currentTime;
    [1046.5, 1318.5].forEach((f, i) => this.note(f, t0 + i * 0.08, 0.22, 'triangle', 0.18));
  }

  coinPickup() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const t0 = this.ctx.currentTime;
    [987.77, 1318.5].forEach((f, i) => this.note(f, t0 + i * 0.06, 0.16, 'sine', 0.2));
  }

  dryFire() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    this.noise(this.ctx.currentTime, 0.04, 0.2, 3500);
  }
}
