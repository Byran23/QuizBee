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

/** Synthesized bell via additive partials + a brief strike transient. */
function bell(freq: number, start: number, dur = 1.6, gain = 0.13) {
  // inharmonic partials (ratio, amplitude) — the classic bell recipe
  const partials: [number, number][] = [
    [0.5, 0.35],  // hum
    [1.0, 1.0],   // prime
    [1.19, 0.35], // tierce-ish
    [2.0, 0.32],  // octave
    [2.74, 0.18], // minor fifth of octave
    [3.76, 0.09],
    [5.4, 0.045],
  ];
  for (const [ratio, amp] of partials) {
    const d = Math.max(0.3, dur * (1.12 - ratio * 0.09));
    tone(freq * ratio, start, d, "sine", gain * amp);
  }
  // strike transient — a tiny metallic click at the start
  tone(freq * 4.1, start, 0.055, "square", gain * 0.18);
}

/* ------------------------------------------------------------------ */
/*  Time-up sounds — selectable in Customize                           */
/* ------------------------------------------------------------------ */

export type TimeUpSound = "bell" | "buzzer" | "chime" | "alarm" | "gong" | "airhorn" | "none";

export const TIME_UP_SOUNDS: { key: TimeUpSound; name: string; blurb: string }[] = [
  { key: "bell", name: "Bell", blurb: "Single clear ring" },
  { key: "buzzer", name: "Buzzer", blurb: "Harsh game-show blat" },
  { key: "chime", name: "Chime", blurb: "Gentle 3-note fall" },
  { key: "alarm", name: "Alarm", blurb: "Urgent beeping" },
  { key: "gong", name: "Gong", blurb: "Deep resonant strike" },
  { key: "airhorn", name: "Air Horn", blurb: "Stadium blast" },
  { key: "none", name: "Silent", blurb: "No sound" },
];

const timeUpVariants: Record<TimeUpSound, () => void> = {
  bell() {
    bell(1318.5, 0, 2.6, 0.16); // E6, long tail
  },
  buzzer() {
    tone(165, 0, 0.42, "sawtooth", 0.13);
    tone(110, 0, 0.42, "square", 0.1);
    tone(164, 0.012, 0.42, "sawtooth", 0.1); // detune = grind
    tone(165, 0.52, 0.6, "sawtooth", 0.13);
    tone(110, 0.52, 0.6, "square", 0.1);
    tone(330, 1.18, 0.75, "sawtooth", 0.07, 98);
  },
  chime() {
    bell(1046.5, 0, 1.4, 0.12);
    bell(830.6, 0.22, 1.5, 0.11);
    bell(659.25, 0.44, 2.2, 0.12);
  },
  alarm() {
    for (let i = 0; i < 5; i++) {
      tone(1046.5, i * 0.22, 0.1, "square", 0.1);
      tone(1318.5, i * 0.22 + 0.1, 0.1, "square", 0.1);
    }
  },
  gong() {
    bell(146.8, 0, 3.4, 0.2);
    bell(220, 0.03, 3, 0.1);
    tone(98, 0, 3.2, "sine", 0.1);
  },
  airhorn() {
    [0, 0.26].forEach((t) => {
      tone(233, t, 0.22, "sawtooth", 0.1, 247);
      tone(311, t, 0.22, "sawtooth", 0.09, 330);
      tone(466, t, 0.22, "square", 0.05);
    });
    tone(233, 0.54, 0.75, "sawtooth", 0.11, 220);
    tone(311, 0.54, 0.75, "sawtooth", 0.1, 294);
  },
  none() {
    /* silent */
  },
};

let timeUpChoice: TimeUpSound = "bell";
export function setTimeUpSound(k: TimeUpSound) {
  timeUpChoice = k;
}
/** Preview a specific time-up sound (used by the picker). */
export function playTimeUp(k: TimeUpSound) {
  timeUpVariants[k]?.();
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
  timeUp() {
    timeUpVariants[timeUpChoice]?.();
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
