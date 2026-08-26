import { PNG } from 'pngjs';
import { toDataUri } from '../../shared/lib/fs.ts';

export type RGB = [number, number, number];

export function hexToRgb(hex: string | undefined, fallback: RGB): RGB {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Renderable {
  viewport?: { width: number; height: number };
  elements?: Array<{
    id: string;
    bounds?: { x: number; y: number; w: number; h: number };
    styles?: { bg?: string; color?: string };
    masked?: boolean;
    role?: string;
  }>;
}

/**
 * Renders a spec's element bounds onto a PNG at scale 1 using pure pngjs
 * (no canvas dependency). Elements are drawn as filled rounded-less rects
 * with a subtle border so pixel diffs are meaningful.
 */
export function renderSpecPng(spec: unknown, opts: { bg?: RGB } = {}): Buffer {
  const s = spec as Renderable;
  const w = Math.max(1, s.viewport?.width ?? 1280);
  const h = Math.max(1, s.viewport?.height ?? 800);
  const bg = opts.bg ?? [245, 245, 245];

  const png = new PNG({ width: w, height: h });

  // background fill
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = bg[0];
    png.data[i + 1] = bg[1];
    png.data[i + 2] = bg[2];
    png.data[i + 3] = 255;
  }

  const setPx = (x: number, y: number, rgb: RGB, border: boolean): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = (y * w + x) * 4;
    const c = border ? [0, 0, 0] as RGB : rgb;
    const alpha = border ? 0.15 : 1;
    png.data[idx] = Math.round(png.data[idx] * (1 - alpha) + c[0] * alpha);
    png.data[idx + 1] = Math.round(png.data[idx + 1] * (1 - alpha) + c[1] * alpha);
    png.data[idx + 2] = Math.round(png.data[idx + 2] * (1 - alpha) + c[2] * alpha);
    png.data[idx + 3] = 255;
  };

  for (const el of s.elements ?? []) {
    if (el.masked) continue;
    const b = el.bounds;
    if (!b) continue;
    const x0 = Math.max(0, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(w, Math.ceil(b.x + b.w));
    const y1 = Math.min(h, Math.ceil(b.y + b.h));
    const rgb: RGB = el.styles?.bg ? hexToRgb(el.styles.bg, [220, 220, 220]) : [230, 230, 230];

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const isBorder = x === x0 || y === y0 || x === x1 - 1 || y === y1 - 1;
        setPx(x, y, rgb, isBorder);
      }
    }
  }

  return PNG.sync.write(png);
}

/** Returns a data URI for a rendered spec screenshot (used by the vision agent). */
export function renderSpecDataUri(spec: unknown): string {
  return toDataUri(renderSpecPng(spec));
}

/**
 * Deterministic pixel perturbation used in sample mode to simulate
 * "the UI drifted from the design". In real mode the Implementation
 * Inspector screenshots the live app instead.
 */
export function perturbPng(png: Buffer, severity: 'none' | 'light' | 'moderate' = 'light'): Buffer {
  if (severity === 'none') return png;
  const img = PNG.sync.read(png);

  let acc = 42;
  const stride = severity === 'light' ? 40 : 11;
  for (let i = 0; i < img.data.length; i += 4) {
    acc = (acc * 1103515245 + 12345) % 2147483648;
    if (i % stride !== 0) continue;
    const jitter = (acc % 40) - 20;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + jitter));
    if (severity === 'moderate') {
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + Math.round(jitter / 2)));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + Math.round(jitter / 3)));
    }
  }
  return PNG.sync.write(img);
}
