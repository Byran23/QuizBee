/* Tiny synth — no audio assets needed */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.12,
  slideTo?: number
) {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.05);
}

export const sfx = {
  tick() {
    tone(880, 0, 0.07, "square", 0.05);
  },
  select() {
    tone(520, 0, 0.08, "triangle", 0.09, 660);
  },
  correct() {
    tone(523.25, 0, 0.14, "triangle", 0.12);
    tone(659.25, 0.09, 0.14, "triangle", 0.12);
    tone(783.99, 0.18, 0.22, "triangle", 0.12);
  },
  wrong() {
    tone(196, 0, 0.22, "sawtooth", 0.07, 120);
    tone(147, 0.12, 0.3, "sawtooth", 0.07, 98);
  },
  advance() {
    tone(392, 0, 0.06, "sine", 0.07, 523);
  },
  roundStart() {
    tone(261.63, 0, 0.12, "triangle", 0.1);
    tone(392, 0.1, 0.12, "triangle", 0.1);
    tone(523.25, 0.2, 0.2, "triangle", 0.12);
    tone(659.25, 0.3, 0.3, "triangle", 0.1);
  },
  fanfare() {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      tone(f, i * 0.12, 0.18, "triangle", 0.11);
      tone(f / 2, i * 0.12, 0.18, "sine", 0.06);
    });
    tone(1318.5, 0.55, 0.5, "triangle", 0.1);
  },
};
