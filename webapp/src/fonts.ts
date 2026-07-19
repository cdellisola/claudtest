// Font handling:
//  - a built-in default font (bundled with three.js, always available)
//  - a set of Google Fonts (OFL) fetched from public/fonts/ (downloaded at build)
//  - user-uploaded .ttf/.otf, persisted in IndexedDB so they survive reloads
// Each font also gets a CSS @font-face family so the dropdown can preview it.
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import helvetiker from 'three/examples/fonts/helvetiker_regular.typeface.json';
import defaultFonts from './default-fonts.json';
import { loadStoredFonts, storeFont, deleteStoredFont } from './fontstore';
import type { Ring } from './types';

const fontLoader = new FontLoader();
const ttfLoader = new TTFLoader();

export interface FontOption {
  id: string;
  name: string;
  font: Font;
  cssFamily: string; // family used for the dropdown preview
  user?: boolean; // uploaded by the user (removable)
  storeId?: string; // key in IndexedDB (user fonts only)
}

export const fonts: FontOption[] = [];

let faceSeq = 0;

function injectFace(family: string, url: string) {
  const style = document.createElement('style');
  style.textContent = `@font-face{font-family:'${family}';src:url('${url}') format('truetype');font-display:swap;}`;
  document.head.appendChild(style);
}

// The three.js typeface JSON has no .ttf to preview with, so it renders in the
// UI's own font. It stays as a guaranteed fallback.
fonts.push({
  id: 'helvetiker',
  name: 'Standard',
  font: fontLoader.parse(helvetiker as any),
  cssFamily: 'inherit',
});

function addTtf(
  id: string,
  name: string,
  buf: ArrayBuffer,
  opts: { user?: boolean; storeId?: string } = {},
): FontOption | null {
  try {
    const json = ttfLoader.parse(buf);
    const font = fontLoader.parse(json);
    const family = `ntf_${++faceSeq}`;
    const url = URL.createObjectURL(new Blob([buf], { type: 'font/ttf' }));
    injectFace(family, url);
    const option: FontOption = { id, name, font, cssFamily: family, ...opts };
    fonts.push(option);
    return option;
  } catch (e) {
    console.warn(`Font non caricato: ${name}`, e);
    return null;
  }
}

/** Fetch the bundled Google Fonts. Calls onLoaded after each one appears. */
export async function loadDefaultFonts(onLoaded?: () => void): Promise<void> {
  const base = import.meta.env.BASE_URL || '/';
  const list = defaultFonts as { slug: string; name: string }[];
  for (const f of list) {
    try {
      const res = await fetch(`${base}fonts/${f.slug}.ttf`);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (addTtf(`def-${f.slug}`, f.name, buf)) onLoaded?.();
    } catch {
      /* skip missing font */
    }
  }
}

/** Restore user fonts from IndexedDB. */
export async function loadUserFonts(onLoaded?: () => void): Promise<void> {
  const stored = await loadStoredFonts();
  for (const s of stored) {
    if (addTtf(`user-${s.id}`, s.name, s.buffer, { user: true, storeId: s.id })) {
      onLoaded?.();
    }
  }
}

/** Import a user-selected font file and persist it. */
export async function importFontFile(file: File): Promise<FontOption | null> {
  const buf = await file.arrayBuffer();
  const name = file.name.replace(/\.[^.]+$/, '') || 'Font caricato';
  const storeId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const option = addTtf(`user-${storeId}`, name, buf, { user: true, storeId });
  if (option) {
    try {
      await storeFont({ id: storeId, name, buffer: buf });
    } catch (e) {
      console.warn('Impossibile salvare il font nel browser', e);
    }
  }
  return option;
}

/** Remove a user font (from the list and from IndexedDB). */
export async function removeUserFont(option: FontOption): Promise<void> {
  const i = fonts.indexOf(option);
  if (i >= 0) fonts.splice(i, 1);
  if (option.storeId) {
    try {
      await deleteStoredFont(option.storeId);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Convert (possibly multi-line) text into a flat list of 2D rings, centred on
 * the origin, in millimetres. Y is up.
 */
export function textToRings(text: string, font: Font, sizeMm: number, lineSpacing = 1.35): Ring[] {
  const lines = text.split('\n');
  const all: Ring[] = [];
  const lineHeight = sizeMm * lineSpacing;
  let y = 0;

  for (const rawLine of lines) {
    const value = rawLine.trim();
    if (value) {
      const shapes = font.generateShapes(value, sizeMm);
      const lineRings: Ring[] = [];
      let lminX = Infinity;
      let lmaxX = -Infinity;

      for (const shape of shapes) {
        const pts = shape.extractPoints(12);
        if (pts.shape.length >= 3) {
          const ring: Ring = [];
          for (const p of pts.shape) {
            ring.push([p.x, p.y]);
            if (p.x < lminX) lminX = p.x;
            if (p.x > lmaxX) lmaxX = p.x;
          }
          lineRings.push(ring);
        }
        for (const hole of pts.holes) {
          if (hole.length >= 3) {
            const ring: Ring = [];
            for (const p of hole) {
              ring.push([p.x, p.y]);
              if (p.x < lminX) lminX = p.x;
              if (p.x > lmaxX) lmaxX = p.x;
            }
            lineRings.push(ring);
          }
        }
      }

      const offX = isFinite(lminX) ? -((lminX + lmaxX) / 2) : 0;
      for (const ring of lineRings) {
        for (const pt of ring) {
          pt[0] += offX;
          pt[1] += y;
        }
      }
      all.push(...lineRings);
    }
    y -= lineHeight;
  }

  if (!all.length) return [];

  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of all) {
    for (const pt of ring) {
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    }
  }
  const cy = (minY + maxY) / 2;
  for (const ring of all) {
    for (const pt of ring) pt[1] -= cy;
  }

  return all;
}
