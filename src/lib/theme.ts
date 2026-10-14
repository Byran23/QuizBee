export interface Palette {
  key: string;
  name: string;
  accent: string;   // primary (buttons, correct answers)
  secondary: string;// competition / info
  warn: string;     // time-up, standings
  danger: string;   // wrong
  extra: string;    // misc accent
}

export const PALETTES: Palette[] = [
  { key: "arena",   name: "Arena",    accent: "#B8FF3C", secondary: "#5CD2FF", warn: "#FFB84D", danger: "#FF5C8A", extra: "#8B7CFF" },
  { key: "sunset",  name: "Sunset",   accent: "#FF9F45", secondary: "#FF5C8A", warn: "#FFD166", danger: "#EF476F", extra: "#C77DFF" },
  { key: "ocean",   name: "Ocean",    accent: "#38E8D0", secondary: "#4D9FFF", warn: "#FFD166", danger: "#FF6B8B", extra: "#9D8DFF" },
  { key: "royal",   name: "Royal",    accent: "#C9A227", secondary: "#9D7BFF", warn: "#FFCB47", danger: "#FF6B8B", extra: "#6EE7B7" },
  { key: "neon",    name: "Neon",     accent: "#FF2E97", secondary: "#00E5FF", warn: "#FFE600", danger: "#FF3B3B", extra: "#9D4EFF" },
  { key: "forest",  name: "Forest",   accent: "#8BD450", secondary: "#4EA8DE", warn: "#F2B705", danger: "#E5544B", extra: "#B08BBB" },
  { key: "mono",    name: "Mono",     accent: "#F4F4F0", secondary: "#A8B0BD", warn: "#D9C77E", danger: "#E8808A", extra: "#8E9BB3" },
  { key: "candy",   name: "Candy",    accent: "#FF7AC8", secondary: "#7AE7FF", warn: "#FFE066", danger: "#FF5C5C", extra: "#B18CFF" },
];

export type SkinKey = "basic" | "futuristic" | "mechanical" | "cyber" | "child";

export const SKINS: { key: SkinKey; name: string; blurb: string }[] = [
  { key: "basic", name: "Basic", blurb: "Flat, clean panels — maximum legibility" },
  { key: "futuristic", name: "Futuristic", blurb: "Frosted glass, neon edges, soft glow" },
  { key: "mechanical", name: "Mechanical", blurb: "Brushed metal, rivets, hard bevels" },
  { key: "cyber", name: "Cyber", blurb: "Neon grid, scanlines, clipped corners" },
  { key: "child", name: "Child", blurb: "Big rounded cards, playful and bright" },
];

export type TimerMode = "auto" | "manual";
export type Mode = "dark" | "light";

export interface ThemeState {
  paletteKey: string;
  custom: { accent: string; secondary: string } | null;
  bgImage: string | null;   // data URL
  bgDim: number;            // 0..90 overlay darkness
  bgBlur: number;           // 0..20 px
  skin: SkinKey;
  /** auto = timer starts on reveal · manual = host reads first, then starts it */
  timerMode: TimerMode;
  mode: Mode;
  /** hero title — "QUIZ" + accent dot + "BEE" by default */
  titleA: string;
  titleB: string;
  /** marquee ticker items (shown on the landing screen) */
  marquee: string[];
  /** question text colour — null = follow the theme */
  qColor: string | null;
  /** panel tint colour — null = follow the skin */
  boxColor: string | null;
  /** panel fill 0–100 — null = follow the skin */
  boxFill: number | null;
}

export const DEFAULT_THEME: ThemeState = {
  paletteKey: "arena",
  custom: null,
  bgImage: null,
  bgDim: 55,
  bgBlur: 4,
  skin: "futuristic",
  timerMode: "auto",
  mode: "dark",
  titleA: "QUIZ",
  titleB: "BEE",
  marquee: [
    "EASY · 1 PT",
    "AVERAGE · 2 PTS",
    "DIFFICULT · 3 PTS",
    "CLINCHER · 5 PTS",
    "LIVE TIMER",
    "INSTANT SCORING",
    "ANSWER REVIEW",
  ],
  qColor: null,
  boxColor: null,
  boxFill: null,
};

export const DEFAULT_MARQUEE = DEFAULT_THEME.marquee;

/** Set the skin attribute that CSS hooks into. */
export function applySkin(skin: SkinKey) {
  document.documentElement.setAttribute("data-skin", skin);
}

function hexToTriplet(hex: string): string | null {
  const m = hex.trim().replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * Apply the user's surface overrides (question colour, box tint, box fill).
 * Set as inline custom properties on <html> so they beat every skin/mode rule.
 */
export function applySurface(t: ThemeState) {
  const s = document.documentElement.style;

  if (t.qColor) s.setProperty("--qa-color", t.qColor);
  else s.removeProperty("--qa-color");

  const triplet = t.boxColor ? hexToTriplet(t.boxColor) : null;
  if (triplet) {
    s.setProperty("--box-rgb", triplet);
    s.setProperty("--box-strong-rgb", triplet);
  } else {
    s.removeProperty("--box-rgb");
    s.removeProperty("--box-strong-rgb");
  }

  if (t.boxFill != null) {
    const a = Math.max(0, Math.min(100, t.boxFill)) / 100;
    s.setProperty("--box-a", a.toFixed(3));
    s.setProperty("--box-a-strong", Math.min(1, a + 0.18).toFixed(3));
  } else {
    s.removeProperty("--box-a");
    s.removeProperty("--box-a-strong");
  }
}

/** Set dark / light mode. */
export function applyMode(mode: Mode) {
  document.documentElement.setAttribute("data-mode", mode);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", mode === "light" ? "#eef0f4" : "#07070a");
}

const KEY = "quizbee.theme";
const BG_KEY = "quizbee.theme.bg";

export function resolvePalette(t: ThemeState): Palette {
  const base = PALETTES.find((p) => p.key === t.paletteKey) ?? PALETTES[0];
  if (!t.custom) return base;
  return { ...base, key: "custom", name: "Custom", accent: t.custom.accent, secondary: t.custom.secondary };
}

export function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(KEY);
    const bg = localStorage.getItem(BG_KEY); // stored separately (can be large)
    const parsed = raw ? JSON.parse(raw) : {};
    const merged = { ...DEFAULT_THEME, ...parsed, bgImage: bg || null };
    // guard against legacy / corrupt saves
    if (!Array.isArray(merged.marquee) || merged.marquee.length === 0) {
      merged.marquee = [...DEFAULT_THEME.marquee];
    }
    if (typeof merged.titleA !== "string") merged.titleA = DEFAULT_THEME.titleA;
    if (typeof merged.titleB !== "string") merged.titleB = DEFAULT_THEME.titleB;
    return merged;
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function saveTheme(t: ThemeState) {
  try {
    const { bgImage, ...rest } = t;
    localStorage.setItem(KEY, JSON.stringify(rest));
    if (bgImage) localStorage.setItem(BG_KEY, bgImage);
    else localStorage.removeItem(BG_KEY);
  } catch { /* quota — ignore, theme still applies this session */ }
}

/** Push palette colors into CSS custom properties. */
export function applyPalette(p: Palette) {
  const r = document.documentElement.style;
  r.setProperty("--color-lime", p.accent);
  r.setProperty("--color-sky", p.secondary);
  r.setProperty("--color-amber", p.warn);
  r.setProperty("--color-rose", p.danger);
  r.setProperty("--color-violet", p.extra);
}

/** Downscale an uploaded image so it fits comfortably in localStorage. */
export function fileToDataUrl(file: File, maxW = 2000, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn’t a valid image"));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
