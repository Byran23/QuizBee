import { Contestant } from "./types";

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function entry(hex: string, name: string) {
  return { color: hex, glow: hexToRgba(hex, 0.4), name };
}

export const TEAM_PALETTE: { color: string; glow: string; name: string }[] = [
  entry("#B8FF3C", "Lime"),
  entry("#5CD2FF", "Sky"),
  entry("#FFB84D", "Amber"),
  entry("#FF5C8A", "Rose"),
  entry("#8B7CFF", "Violet"),
  entry("#3CFFC8", "Mint"),
  entry("#FF7A45", "Ember"),
  entry("#F4F4F0", "Ivory"),
  entry("#6EE7B7", "Jade"),
  entry("#FDE047", "Sun"),
  entry("#4D9FFF", "Blue"),
  entry("#E879F9", "Fuchsia"),
  entry("#A3E635", "Sprout"),
  entry("#FB7185", "Coral"),
  entry("#2DD4BF", "Teal"),
  entry("#FBBF24", "Gold"),
  entry("#67E8F9", "Glacier"),
  entry("#C4B5FD", "Lavender"),
  entry("#FDA4AF", "Blush"),
  entry("#86EFAC", "Meadow"),
];

export const MAX_TEAMS = TEAM_PALETTE.length; // 20
export const HOTKEY_TEAMS = 9; // keys 1–9 toggle awards for the first 9 teams
const TEAMS_KEY = "quizbee.teams";

export function makeContestant(name: string, colorIdx: number, seat: number): Contestant {
  const p = TEAM_PALETTE[colorIdx % TEAM_PALETTE.length];
  return {
    id: `t-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    color: p.color,
    glow: p.glow,
    seat,
  };
}

export function loadTeams(): { name: string; colorIdx: number }[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEAMS_KEY) || "[]");
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t) => t && typeof t.name === "string")
        .slice(0, MAX_TEAMS);
    }
  } catch { /* noop */ }
  return [];
}

export function saveTeams(teams: { name: string; colorIdx: number }[]) {
  try {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams.slice(0, MAX_TEAMS)));
  } catch { /* noop */ }
}
