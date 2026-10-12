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

export interface ThemeState {
  paletteKey: string;
  custom: { accent: string; secondary: string } | null;
  bgImage: string | null;   // data URL
  bgDim: number;            // 0..90 overlay darkness
  bgBlur: number;           // 0..20 px
}

export const DEFAULT_THEME: ThemeState = {
  paletteKey: "arena",
  custom: null,
  bgImage: null,
  bgDim: 55,
  bgBlur: 4,
};

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
    return { ...DEFAULT_THEME, ...parsed, bgImage: bg || null };
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
