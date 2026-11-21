// CORAL HEAT — synth sound: radio stations + SFX (v2.9, fresh).
// All audio is synthesized with WebAudio — no audio files, no network.
import { clamp } from './util.js';

export const STATIONS = [
  { id: 'sunset', name: 'Sunset FM 98.5 — chill synthwave', bpm: 96, root: 220, scale: [0, 3, 5, 7, 10], wave: 'sawtooth' },
  { id: 'bay', name: 'Bay Beats 101.2 — latin groove', bpm: 124, root: 196, scale: [0, 2, 4, 7, 9], wave: 'square' },
  { id: 'heat', name: 'Heat Wave 107.7 — driving electro', bpm: 132, root: 165, scale: [0, 3, 5, 6, 10], wave: 'sawtooth' },
];

export function setupAudio(G) {
  const A = {
    ctx: null, station: 0, engineOsc: null, engineGain: null, radioTimer: null, step: 0, sirenOn: false,
    ensure() {
      if (this.ctx) return true;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        // engine hum
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 50;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        this.startRadio();
        return true;
      } catch (e) { return false; }
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setEngine(speed, maxSpeed) {
      if (!this.ctx || !this.engineOsc) return;
      const f = 45 + clamp(Math.abs(speed) / maxSpeed, 0, 1) * 130;
      this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(G.player.mode === 'foot' ? 0 : 0.05, this.ctx.currentTime, 0.1);
    },
    startRadio() {
      if (!this.ctx || this.radioTimer) return;
      const beat = () => {
        if (!this.ctx) return;
        const st = STATIONS[this.station];
        const stepDur = 60 / st.bpm / 2;
        const idx = this.step % 16;
        const note = st.scale[Math.floor(Math.random() * st.scale.length)];
        const freq = st.root * Math.pow(2, note / 12) * (idx % 8 === 0 ? 0.5 : 1);
        if (idx % 2 === 0) this.note(freq, stepDur * 0.9, st.wave, 0.05);
        if (idx === 0 || idx === 8) this.note(st.root / 2, stepDur * 1.8, 'sine', 0.09);
        if (idx % 4 === 2) this.noiseHit(0.03);
        this.step++;
      };
      this.radioTimer = setInterval(beat, (60 / STATIONS[this.station].bpm / 2) * 1000);
      G.hud.setRadio(STATIONS[this.station].name);
    },
    cycleStation() {
      this.station = (this.station + 1) % STATIONS.length;
      clearInterval(this.radioTimer);
      this.radioTimer = null;
      this.step = 0;
      this.startRadio();
      G.hud.toast('Radio: ' + STATIONS[this.station].name);
    },
    note(freq, dur, wave, vol) {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = wave;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    },
    noiseHit(vol) {
      if (!this.ctx) return;
      const len = this.ctx.sampleRate * 0.05;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g); g.connect(this.master);
      src.start();
    },
    shot(id) {
      if (!this.ctx) return;
      this.noiseHit(id === 'shotgun' ? 0.5 : 0.28);
      this.note(id === 'smg' ? 180 : 90, 0.08, 'square', 0.12);
    },
    thud() { if (this.ctx) { this.note(60, 0.18, 'sine', 0.25); this.noiseHit(0.2); } },
    blip(f) { if (this.ctx) this.note(f || 660, 0.12, 'sine', 0.12); },
    click() { if (this.ctx) this.note(320, 0.06, 'square', 0.08); },
    alarm() { if (this.ctx) { this.note(880, 0.15, 'square', 0.1); setTimeout(() => this.note(660, 0.15, 'square', 0.1), 160); } },
    siren(level) {
      if (!this.ctx || level < 1) return;
      this.note(700, 0.4, 'sine', 0.05);
      setTimeout(() => this.note(950, 0.4, 'sine', 0.05), 420);
    },
    countdown() { if (this.ctx) { this.note(440, 0.15, 'square', 0.12); setTimeout(() => this.note(440, 0.15, 'square', 0.12), 500); setTimeout(() => this.note(440, 0.15, 'square', 0.12), 1000); } },
    go() { if (this.ctx) this.note(880, 0.4, 'square', 0.16); },
    win() {
      if (!this.ctx) return;
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.note(f, 0.25, 'sine', 0.14), i * 130));
    },
  };
  G.audio = A;
  return A;
}
