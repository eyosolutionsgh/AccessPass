/**
 * Runtime theming — recolour the whole platform from a single brand seed colour.
 *
 * The design system's brand palette lives in `index.css` as `--color-brand-50…950` (oklch). Every
 * `bg-brand-*` / `text-brand-*` utility compiles to `var(--color-brand-N)`, so overriding those
 * variables on `<html>` recolours the entire app at runtime — no rebuild. We keep the carefully
 * tuned per-stop LIGHTNESS curve (so e.g. white text on `brand-600` stays legible) and only swap in
 * the seed's HUE, scaling chroma by how saturated the seed is. The seed hex is the only thing
 * stored; the ramp is regenerated on the client.
 */

const CACHE_KEY = 'vms.brandColor';

/** Per-stop lightness + chroma template, copied from the default ramp in index.css. */
const RAMP: { k: number; l: number; c: number }[] = [
  { k: 50, l: 0.97, c: 0.014 },
  { k: 100, l: 0.938, c: 0.03 },
  { k: 200, l: 0.894, c: 0.056 },
  { k: 300, l: 0.825, c: 0.094 },
  { k: 400, l: 0.73, c: 0.143 },
  { k: 500, l: 0.645, c: 0.183 },
  { k: 600, l: 0.575, c: 0.214 },
  { k: 700, l: 0.505, c: 0.196 },
  { k: 800, l: 0.44, c: 0.16 },
  { k: 900, l: 0.388, c: 0.122 },
  { k: 950, l: 0.272, c: 0.09 },
];
/** Peak chroma of the template (at stop 600) — the reference a vivid seed maps to. */
const PEAK_C = 0.214;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number, p = 4) => Number(n.toFixed(p));

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** sRGB hex (#rrggbb) → OKLCH {L, C, H°}. */
export function hexToOklch(hex: string): { L: number; C: number; H: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1]!, 16);
  const r = srgbToLinear((int >> 16) & 255);
  const g = srgbToLinear((int >> 8) & 255);
  const b = srgbToLinear(int & 255);
  // Linear sRGB → OKLab (Björn Ottosson's matrices).
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mq = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * mq - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * mq + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * mq - 0.808675766 * s;
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

/** Build the full brand-50…950 ramp (as oklch() strings) from a seed hex, keyed by stop. */
export function brandRamp(hex: string): Record<number, string> | null {
  const seed = hexToOklch(hex);
  if (!seed) return null;
  // Scale the template chroma by how saturated the seed is, so a muted logo gives a muted theme and
  // a vivid one gives a vivid theme — without ever going fully grey (floor) or wildly out of gamut.
  const scale = clamp(seed.C / PEAK_C, 0.45, 1.12);
  const H = round(seed.H, 2);
  const out: Record<number, string> = {};
  for (const s of RAMP) out[s.k] = `oklch(${s.l} ${round(s.c * scale)} ${H})`;
  return out;
}

/**
 * Apply a brand colour app-wide by overriding the `--color-brand-*` variables on <html> (and the
 * derived brand shadow). Pass null/'' to remove the overrides and fall back to the built-in palette.
 * Caches the seed in localStorage so a returning user is themed before the config query resolves.
 */
export function applyBrandTheme(hex: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const ramp = hex ? brandRamp(hex) : null;
  if (!hex || !ramp) {
    for (const s of RAMP) root.style.removeProperty(`--color-brand-${s.k}`);
    root.style.removeProperty('--shadow-brand');
    root.style.removeProperty('--color-sidebar');
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* private mode */
    }
    return;
  }
  for (const s of RAMP) root.style.setProperty(`--color-brand-${s.k}`, ramp[s.k]!);
  const seed = hexToOklch(hex)!;
  const scale = clamp(seed.C / PEAK_C, 0.45, 1.12);
  const H = round(seed.H, 2);
  root.style.setProperty(
    '--shadow-brand',
    `0 8px 24px -6px oklch(0.575 ${round(0.214 * scale)} ${H} / 0.45)`,
  );
  // Dark, brand-tinted sidebar surface — stays dark enough for white text + the brand active pills,
  // but carries the institution hue instead of neutral slate.
  root.style.setProperty(
    '--color-sidebar',
    `oklch(0.18 ${round(clamp(0.05 * scale, 0.04, 0.06))} ${H})`,
  );
  try {
    localStorage.setItem(CACHE_KEY, hex);
  } catch {
    /* private mode */
  }
}

/** Apply the cached brand colour synchronously on boot to avoid a flash of the default palette. */
export function applyCachedBrandTheme(): void {
  try {
    const hex = localStorage.getItem(CACHE_KEY);
    if (hex) applyBrandTheme(hex);
  } catch {
    /* ignore */
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('');

/**
 * Extract the dominant *vibrant* colour from an image (the logo) entirely on the client via canvas —
 * no server-side image library (air-gap safe). Buckets pixels by hue, ignores near-white/black and
 * greys (backgrounds, outlines), and returns the saturation-weighted average of the strongest hue
 * bucket as a hex string. Resolves null if the image can't be read or has no vibrant colour.
 */
export function extractLogoColor(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(null);
    img.onload = () => {
      const SIZE = 72;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      let data: Uint8ClampedArray;
      try {
        data = ctx.getImageData(0, 0, SIZE, SIZE).data;
      } catch {
        return resolve(null); // tainted canvas (cross-origin without CORS)
      }
      // 24 hue buckets (15° each), accumulating a saturation-weighted colour sum.
      const BINS = 24;
      const bins = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]!;
        if (a < 200) continue;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const [h, s, l] = rgbToHsl(r, g, b);
        if (s < 0.22 || l < 0.12 || l > 0.92) continue; // skip greys / near-white / near-black
        const w = s * s; // bias toward the most saturated pixels
        const bin = bins[Math.floor(h / (360 / BINS)) % BINS]!;
        bin.w += w;
        bin.r += r * w;
        bin.g += g * w;
        bin.b += b * w;
      }
      const best = bins.reduce((a, c) => (c.w > a.w ? c : a), bins[0]!);
      if (best.w === 0) return resolve(null);
      resolve(toHex(best.r / best.w, best.g / best.w, best.b / best.w));
    };
    img.src = src;
  });
}
