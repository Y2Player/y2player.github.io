// Feedback mecânico: clique sintetizado (Web Audio) + vibração quando existir.
let ctx: AudioContext | null = null;
let muted = false;

export function setClickMuted(m: boolean) {
  muted = m;
}

function audio() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

type Kind = 'key' | 'heavy' | 'tick' | 'switch' | 'detent';

const SPEC: Record<Kind, { f0: number; f1: number; dur: number; gain: number; type: OscillatorType; noise: number; vib: number }> = {
  key: { f0: 520, f1: 90, dur: 0.028, gain: 0.16, type: 'sine', noise: 0.05, vib: 8 },
  heavy: { f0: 170, f1: 38, dur: 0.05, gain: 0.3, type: 'triangle', noise: 0.08, vib: 14 },
  tick: { f0: 2400, f1: 1200, dur: 0.008, gain: 0.05, type: 'square', noise: 0.03, vib: 3 },
  detent: { f0: 1500, f1: 600, dur: 0.012, gain: 0.07, type: 'square', noise: 0.04, vib: 4 },
  switch: { f0: 900, f1: 200, dur: 0.03, gain: 0.14, type: 'sine', noise: 0.1, vib: 10 },
};

export function haptic(kind: Kind = 'key') {
  const s = SPEC[kind];
  try {
    navigator.vibrate?.(s.vib);
  } catch {
    /* sem vibração */
  }
  if (muted) return;
  const a = audio();
  if (!a) return;
  const now = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = s.type;
  osc.frequency.setValueAtTime(s.f0, now);
  osc.frequency.exponentialRampToValueAtTime(s.f1, now + s.dur);
  g.gain.setValueAtTime(s.gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + s.dur);
  osc.connect(g).connect(a.destination);
  osc.start(now);
  osc.stop(now + s.dur + 0.01);

  // pitada de ruído = textura de plástico
  const len = Math.floor(a.sampleRate * 0.012);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = a.createBufferSource();
  const ng = a.createGain();
  ng.gain.value = s.noise;
  n.buffer = buf;
  n.connect(ng).connect(a.destination);
  n.start(now);
}
