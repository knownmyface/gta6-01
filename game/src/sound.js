// sound.js — WebAudio synth: 4 radio stations (chord-pad loops), engine hum,
// shots, blips, mission + win stingers. No audio files, no network.
export const STATIONS = [
  { id: 'coral-fm', name: 'CORAL FM 98.5 — sunset pop', bpm: 96, root: 220, scale: [0, 3, 5, 7, 10] },
  { id: 'bay-beats', name: 'BAY BEATS 101.1 — electro', bpm: 122, root: 196, scale: [0, 2, 3, 7, 8] },
  { id: 'palm-jazz', name: 'PALM JAZZ 88.4 — late-night keys', bpm: 76, root: 174, scale: [0, 3, 5, 6, 10] },
  { id: 'heat-rock', name: 'HEAT ROCK 104.7 — drive guitars', bpm: 132, root: 164, scale: [0, 2, 5, 7, 9] },
];

export function createSound() {
  const S = {
    ctx: null, station: 0, muted: false, nextNote: 0, step: 0, timer: null,
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    stationName() { return STATIONS[this.station].name; },
    nextStation() { this.station = (this.station + 1) % STATIONS.length; this.blip(520, 0.08); },
    startRadio() {
      if (!this.ensure() || this.timer) return;
      this.step = 0;
      this.nextNote = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 60);
    },
    schedule() {
      if (!this.ctx || this.muted) return;
      const st = STATIONS[this.station];
      const beat = 60 / st.bpm / 2;
      while (this.nextNote < this.ctx.currentTime + 0.25) {
        const deg = st.scale[this.step % st.scale.length];
        const oct = this.step % 8 < 4 ? 1 : 2;
        this.tone(st.root * oct * Math.pow(2, deg / 12), this.nextNote, beat * 0.9, 'triangle', 0.05);
        if (this.step % 4 === 0) this.tone(st.root / 2, this.nextNote, beat * 2, 'sine', 0.09);
        if (this.step % 8 === 6) this.noise(this.nextNote, 0.05, 0.03);
        this.step++;
        this.nextNote += beat;
      }
    },
    tone(freq, when, dur, type = 'sine', vol = 0.08) {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(when); o.stop(when + dur + 0.02);
    },
    noise(when, dur, vol) {
      if (!this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(g); g.connect(this.ctx.destination);
      src.start(when);
    },
    blip(freq, dur) {
      if (!this.ensure()) return;
      this.tone(freq, this.ctx.currentTime, dur, 'square', 0.06);
    },
    shot() {
      if (!this.ensure()) return;
      this.noise(this.ctx.currentTime, 0.12, 0.16);
      this.tone(90, this.ctx.currentTime, 0.1, 'sawtooth', 0.1);
    },
    horn() {
      if (!this.ensure()) return;
      const t = this.ctx.currentTime;
      this.tone(220, t, 0.35, 'sawtooth', 0.09);
      this.tone(277, t, 0.35, 'sawtooth', 0.09);
    },
    countdown() { if (this.ensure()) { this.tone(440, this.ctx.currentTime, 0.12, 'square', 0.07); } },
    mission() {
      if (!this.ensure()) return;
      const t = this.ctx.currentTime;
      [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.12, 0.22, 'triangle', 0.09));
    },
    win() {
      if (!this.ensure()) return;
      const t = this.ctx.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.11, 0.3, 'triangle', 0.1));
    },
  };
  return S;
}
