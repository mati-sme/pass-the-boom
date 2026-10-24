/** Soft WebAudio SFX — no external assets. */
'use strict';

let ac = null;
let muted = false;
const last = Object.create(null);

function ensure() {
  if (ac) return ac;
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return null;
  ac = new A();
  return ac;
}

export function unlockAudio() {
  const a = ensure();
  if (a && a.state === 'suspended') a.resume();
}

export function setMuted(m) { muted = !!m; }

function rate(key, ms) {
  const now = performance.now();
  if (last[key] && now - last[key] < ms) return false;
  last[key] = now;
  return true;
}

function tone(freq, dur, type, vol, delay) {
  const a = ensure();
  if (!a || muted) return;
  const t0 = a.currentTime + (delay || 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

export const SFX = {
  tick(urgency) {
    if (!rate('tick', urgency > 0.7 ? 120 : 280)) return;
    const f = 900 + urgency * 500;
    tone(f, 0.04, 'triangle', 0.06 + urgency * 0.04);
  },
  pass() {
    tone(520, 0.08, 'square', 0.08);
    tone(780, 0.1, 'square', 0.07, 0.06);
  },
  boom() {
    // soft funny "poof" — low thud + airy whoosh, no harsh noise
    const a = ensure();
    if (!a || muted) return;
    const t0 = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t0);
    o.frequency.exponentialRampToValueAtTime(40, t0 + 0.35);
    g.gain.setValueAtTime(0.22, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + 0.45);
    tone(320, 0.12, 'triangle', 0.08, 0.02);
    tone(140, 0.25, 'sine', 0.1, 0.05);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, i * 0.12));
  },
  join() { tone(440, 0.08, 'sine', 0.06); tone(660, 0.1, 'sine', 0.05, 0.07); },
  click() { tone(600, 0.04, 'square', 0.04); },
};
