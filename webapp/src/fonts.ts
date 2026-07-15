// Font handling: a built-in default font (bundled with three.js — no file to
// commit) plus runtime upload of any .ttf (this is how you load Waltograph).
// A font is turned into 2D outline rings (outer contour + holes) in millimetres.
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import helvetiker from 'three/examples/fonts/helvetiker_regular.typeface.json';
import type { Ring } from './types';

const fontLoader = new FontLoader();
const ttfLoader = new TTFLoader();

export interface FontOption {
  id: string;
  name: string;
  font: Font;
}

export const fonts: FontOption[] = [
  { id: 'helvetiker', name: 'Standard (Helvetiker)', font: fontLoader.parse(helvetiker as any) },
];

let uploadCounter = 0;

/** Parse a user-provided .ttf (e.g. Waltograph) and add it to the list. */
export async function importFont(file: File): Promise<FontOption> {
  const buf = await file.arrayBuffer();
  const json: any = ttfLoader.parse(buf);
  const font = fontLoader.parse(json);
  const name = json.familyName || file.name.replace(/\.[^.]+$/, '') || 'Font caricato';
  const option: FontOption = { id: `upload-${++uploadCounter}`, name, font };
  fonts.push(option);
  return option;
}

/**
 * Convert (possibly multi-line) text into a flat list of 2D rings, centred on
 * the origin and expressed in millimetres. Y is up.
 */
export function textToRings(text: string, font: Font, sizeMm: number, lineSpacing = 1.35): Ring[] {
  const lines = text.split('\n');
  const all: Ring[] = [];
  const lineHeight = sizeMm * lineSpacing;
  let y = 0;

  for (const rawLine of lines) {
    const value = rawLine.trim();
    y -= 0; // keep readable; advance happens at the end of the loop
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

      // Centre this line horizontally and place it at the current Y.
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

  // Centre the whole block vertically around the origin.
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
