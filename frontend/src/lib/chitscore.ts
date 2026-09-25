// Shareable "ChitScore" reputation card rendered as a standalone SVG string,
// so it can be shown inline, rasterised to PNG, or dropped into a share sheet.
import { getReputationLabel } from "./utils";

export interface ChitScoreInput {
  address: string;
  score: number; // 0..1000 composite
  onTimePct: number; // 0..100
  cyclesCompleted: number;
  bidsWon: number;
}

export interface Tier {
  name: string;
  accent: string; // hex, used across the card
}

// Tier thresholds mirror ReputationBadge's visual bands.
export function tierForScore(score: number): Tier {
  if (score >= 900) return { name: "Gold", accent: "#fbbf24" };
  if (score >= 700) return { name: "Silver", accent: "#818cf8" };
  if (score >= 500) return { name: "Bronze", accent: "#fb923c" };
  return { name: "Rising", accent: "#34d399" };
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

// 800x420 landscape card. Self-contained (inline styles, system font stack) so
// it renders identically when serialised into an <img> for PNG export.
export function buildChitScoreSvg(input: ChitScoreInput): string {
  const tier = tierForScore(input.score);
  const label = getReputationLabel(input.score);
  const clamped = Math.max(0, Math.min(1000, input.score));
  const barW = Math.round((clamped / 1000) * 460);
  const addr = esc(input.address);
  const onTime = `${input.onTimePct.toFixed(1)}%`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420" font-family="'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1020"/>
      <stop offset="1" stop-color="#141a33"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tier.accent}"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="800" height="420" rx="28" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="799" height="419" rx="28" fill="none" stroke="${tier.accent}" stroke-opacity="0.25"/>

  <text x="48" y="64" fill="#e2e8f0" font-size="24" font-weight="800" letter-spacing="0.5">ChainChit · ChitScore</text>
  <text x="48" y="92" fill="#64748b" font-size="14" font-weight="600" letter-spacing="2">${tier.name.toUpperCase()} TIER · ${label.toUpperCase()}</text>

  <circle cx="150" cy="250" r="92" fill="none" stroke="#1e293b" stroke-width="16"/>
  <circle cx="150" cy="250" r="92" fill="none" stroke="url(#ring)" stroke-width="16" stroke-linecap="round"
    stroke-dasharray="${Math.round((clamped / 1000) * 578)} 578" transform="rotate(-90 150 250)"/>
  <text x="150" y="258" text-anchor="middle" fill="#f1f5f9" font-size="60" font-weight="900">${clamped}</text>
  <text x="150" y="292" text-anchor="middle" fill="#64748b" font-size="16" font-weight="700">/ 1000</text>

  <text x="300" y="170" fill="#94a3b8" font-size="15" font-weight="700" letter-spacing="1">TRUST SCORE</text>
  <rect x="300" y="182" width="460" height="14" rx="7" fill="#1e293b"/>
  <rect x="300" y="182" width="${barW}" height="14" rx="7" fill="url(#ring)"/>

  <text x="300" y="240" fill="#64748b" font-size="14" font-weight="600">On-time payments</text>
  <text x="760" y="240" text-anchor="end" fill="#f1f5f9" font-size="18" font-weight="800">${onTime}</text>
  <text x="300" y="278" fill="#64748b" font-size="14" font-weight="600">Cycles completed</text>
  <text x="760" y="278" text-anchor="end" fill="#f1f5f9" font-size="18" font-weight="800">${input.cyclesCompleted}</text>
  <text x="300" y="316" fill="#64748b" font-size="14" font-weight="600">Pools won</text>
  <text x="760" y="316" text-anchor="end" fill="#f1f5f9" font-size="18" font-weight="800">${input.bidsWon}</text>

  <text x="48" y="384" fill="#475569" font-size="15" font-family="monospace">${addr}</text>
  <text x="760" y="384" text-anchor="end" fill="${tier.accent}" font-size="15" font-weight="800">★ verified on Stellar</text>
</svg>`;
}
