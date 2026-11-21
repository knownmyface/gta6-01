// Coral Heat — sound: WebAudio-synthesised everything (no audio files).
// Three procedural radio stations, an engine hum tied to speed, sirens,
// gunshots, explosions and UI jingles.
import { rand } from './util.js';

export const RADIO_STATIONS = [
  { name: 'CORAL FM', base: 220, mode: 'major', tempo: 112 },
  { name: 'SUNSET 88', base: 196, mode: 'minor', tempo: 92 },
  { name: 'NEON NIGHTS', base: 247, mode: 'minor', tempo: 128 },
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12];

export function initAudio(G) {
  G.radioStations = RADIO_STATIONS;
  G.radioIndex = 0;
  G.audio = { ctx: null, engineOsc: null, engineGain: null, musicGain: null, nextNote: 0, step: 0 };
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    G.audio.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
    G.audio.master = master;
    // engine hum
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const eg = ctx.createGain();
    eg.gain.value = 0.0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    osc.connect(filt);
    filt.connect(eg);
    eg.connect(master);
    osc.start();
    G.audio.engineOsc = osc;
    G.audio.engineGain = eg;
    // music bus
    const mg = ctx.createGain();
    mg.gain.value = 0.16;
    mg.connect(master);
    G.audio.musicGain = mg;
  } catch (e) {
    G.audio.ctx = null;
  }
}

export function resumeAudio(G) {
  const a = G.audio;
  if (a && a.ctx && a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
}

export function setRadio(G, index) {
  G.radioIndex = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
  G.audio.step = 0;
  if (G.hud) G.hud.toast('Radio: ' + RADIO_STATIONS[G.radioIndex].name);
}

export function cycleRadio(G) {
  setRadio(G, G.radioIndex + 1);
}

function noteFreq(base, semis) {
  return base * Math.pow(2, semis / 12);
}

export function updateAudio(G, dt) {
  const a = G.audio;
  if (!a || !a.ctx) return;
  // engine pitch follows speed
  if (a.engineOsc) {
    const sp = Math.abs(G.player.speed);
    a.engineOsc.frequency.value = 55 + sp * 3.2;
    const target = G.player.mode === 'car' || G.player.mode === 'bike' || G.player.mode === 'boat' ? 0.05 + sp * 0.0012 : 0.0;
    a.engineGain.gain.value += (target - a.engineGain.gain.value) * Math.min(1, dt * 6);
  }
  // procedural radio: a bass note + a plucked lead note per step
  if (a.ctx.state !== 'running') return;
  const st = RADIO_STATIONS[G.radioIndex];
  const scale = st.mode === 'major' ? MAJOR : MINOR;
  const stepDur = 60 / st.tempo / 2;
  a.nextNote -= dt;
  if (a.nextNote <= 0) {
    a.nextNote = stepDur;
    const step = a.step++;
    const deg = scale[step % scale.length] + (Math.floor(step / scale.length) % 2 === 0 ? 0 : 12);
    const now = a.ctx.currentTime;
    // bass
    const bass = a.ctx.createOscillator();
    bass.type = 'triangle';
    bass.frequency.value = noteFreq(st.base / 2, scale[step % 4]);
    const bg = a.ctx.createGain();
    bg.gain.setValueAtTime(0.5, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + stepDur * 1.8);
    bass.connect(bg);
    bg.connect(a.musicGain);
    bass.start(now);
    bass.stop(now + stepDur * 2);
    // lead pluck every other step
    if (step % 2 === 0) {
      const lead = a.ctx.createOscillator();
      lead.type = 'square';
      lead.frequency.value = noteFreq(st.base, deg);
      const lg = a.ctx.createGain();
      lg.gain.setValueAtTime(0.16, now);
      lg.gain.exponentialRampToValueAtTime(0.001, now + stepDur * 0.9);
      lead.connect(lg);
      lg.connect(a.musicGain);
      lead.start(now);
      lead.stop(now + stepDur);
    }
  }
}

export function sfx(G, name) {
  const a = G.audio;
  if (!a || !a.ctx || a.ctx.state !== 'running') return;
  const ctx = a.ctx;
  const now = ctx.currentTime;
  function noise(dur, freq, gainVal, type = 'lowpass') {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(f);
    f.connect(g);
    g.connect(a.master);
    src.start(now);
  }
  function tone(freq, dur, gainVal, type = 'sine', slideTo) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g);
    g.connect(a.master);
    o.start(now);
    o.stop(now + dur);
  }
  switch (name) {
    case 'shot': noise(0.12, 1800, 0.5, 'highpass'); break;
    case 'empty': tone(1200, 0.06, 0.2, 'square'); break;
    case 'explosion': noise(0.9, 300, 0.9); tone(70, 0.8, 0.7, 'sine', 30); break;
    case 'checkpoint': tone(880, 0.12, 0.3); setTimeout(() => sfx(G, 'blip2'), 90); break;
    case 'blip2': tone(1320, 0.14, 0.3); break;
    case 'mission': tone(523, 0.15, 0.3); setTimeout(() => tone(784, 0.2, 0.3), 120); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.3), i * 110)); break;
    case 'lose': [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 0.3), i * 140)); break;
    case 'buy': tone(988, 0.1, 0.3); setTimeout(() => tone(1318, 0.16, 0.3), 90); break;
    case 'raceStart': [440, 440, 440, 880].forEach((f, i) => setTimeout(() => tone(f, 0.18, 0.35, 'square'), i * 160)); break;
    case 'carjack': noise(0.25, 900, 0.4); tone(180, 0.25, 0.3, 'sawtooth', 90); break;
    case 'spike': noise(0.4, 2400, 0.5, 'bandpass'); break;
    case 'swap': tone(660, 0.07, 0.2, 'square'); break;
    default: tone(440, 0.08, 0.2); break;
  }
}
