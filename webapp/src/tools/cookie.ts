import { textToGlyphs, getEmojiFont } from '../fonts';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import type { Tool } from '../tool';
import type { BuildRequest, Ring, RGB } from '../types';

const hexToRgb = (h: string): RGB => {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

// --- Built-in unit shapes (centred, ~1 unit), rescaled to width×height later ---
function circleRings(): Ring[][] {
  const r: Ring = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    r.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]);
  }
  return [[r]];
}
function squareRings(): Ring[][] {
  return [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]];
}
function starRings(points = 5, inner = 0.22): Ring[][] {
  const r: Ring = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? 0.5 : inner;
    r.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  return [[r]];
}
function heartRings(): Ring[][] {
  const r: Ring = [];
  for (let i = 0; i < 100; i++) {
    const t = (i / 100) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    r.push([x / 32, y / 32]);
  }
  return [[r]];
}

/** Deep-copy glyph rings and rescale them to fit w×h, centred on the origin. */
function resizeGlyphs(glyphs: Ring[][], w: number, h: number): Ring[][] {
  const out = glyphs.map((g) => g.map((r) => r.map((pt) => [pt[0], pt[1]] as [number, number])));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const g of out) for (const r of g) for (const pt of r) {
    if (pt[0] < minX) minX = pt[0];
    if (pt[0] > maxX) maxX = pt[0];
    if (pt[1] < minY) minY = pt[1];
    if (pt[1] > maxY) maxY = pt[1];
  }
  if (!isFinite(minX)) return out;
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const sx = w / bw;
  const sy = h / bh;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (const g of out) for (const r of g) for (const pt of r) {
    pt[0] = (pt[0] - cx) * sx;
    pt[1] = (pt[1] - cy) * sy;
  }
  return out;
}

function svgToGlyphs(svgText: string): Ring[][] {
  const data = new SVGLoader().parse(svgText);
  const glyphs: Ring[][] = [];
  for (const path of data.paths) {
    const shapes = SVGLoader.createShapes(path);
    for (const shape of shapes) {
      const pts = shape.extractPoints(24);
      const g: Ring[] = [];
      // SVG Y axis points down → flip so it matches our Y-up world.
      if (pts.shape.length >= 3) g.push(pts.shape.map((p) => [p.x, -p.y] as [number, number]));
      for (const hole of pts.holes) {
        if (hole.length >= 3) g.push(hole.map((p) => [p.x, -p.y] as [number, number]));
      }
      if (g.length) glyphs.push(g);
    }
  }
  return glyphs;
}

export function createCookieTool(): Tool {
  let root: HTMLElement;
  let onChangeCb: () => void = () => {};
  let emojiFont: Font | null = null;
  let emojiReady = false;
  let svgGlyphs: Ring[][] | null = null;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const num = (id: string) => parseFloat(q<HTMLInputElement>(id).value);
  const checked = (id: string) => q<HTMLInputElement>(id).checked;
  const val = (id: string) => q<HTMLInputElement | HTMLSelectElement>(id).value;

  function baseGlyphs(): Ring[][] | null {
    const src = val('ck-src');
    if (src === 'stella') return starRings();
    if (src === 'cuore') return heartRings();
    if (src === 'cerchio') return circleRings();
    if (src === 'quadrato') return squareRings();
    if (src === 'svg') return svgGlyphs;
    // icona (emoji). Fall back to a star so the default ⭐ always shows.
    const icon = q<HTMLInputElement>('ck-icon').value.trim() || '⭐';
    if (emojiFont) {
      const g = textToGlyphs(icon, emojiFont, 100, 1);
      if (g.length) return g;
      return starRings();
    }
    if (emojiReady) return starRings(); // font unavailable
    return null; // still loading
  }

  return {
    id: 'cookie',
    name: 'Cookie Cutter',
    subtitle: 'Stampo per biscotti: stampo esterno + pattern, da icona o SVG.',
    available: true,
    usesGrid: true,

    mount(body, onChange) {
      root = body;
      onChangeCb = onChange;
      body.innerHTML = `
        <label class="field"><span>Definito da</span>
          <select id="ck-src">
            <option value="icona">Definito da SVG o Icona → Icona</option>
            <option value="svg">Definito da SVG o Icona → SVG</option>
            <option value="stella">Forma: Stella</option>
            <option value="cuore">Forma: Cuore</option>
            <option value="cerchio">Forma: Cerchio/Ellisse</option>
            <option value="quadrato">Forma: Quadrato</option>
          </select></label>
        <label class="field"><span>Icona (emoji)</span><input id="ck-icon" type="text" value="⭐" /></label>
        <label class="field"><span>File SVG (contorno chiuso)</span><input id="ck-svg" type="file" accept=".svg" /></label>

        <div class="grid">
          <label class="field"><span>Larghezza (mm)</span><input id="ck-w" type="number" value="60" min="10" step="1" /></label>
          <label class="field"><span>Altezza (mm)</span><input id="ck-h" type="number" value="60" min="10" step="1" /></label>
          <label class="field"><span>Spessore pareti</span><input id="ck-wall" type="number" value="2" min="0.5" step="0.5" /></label>
          <label class="field"><span>Altezza stampo esterno</span><input id="ck-hh" type="number" value="15" min="2" step="0.5" /></label>
          <label class="field"><span>Altezza pattern</span><input id="ck-ph" type="number" value="5" min="1" step="0.5" /></label>
          <label class="field"><span>Prof. incisione</span><input id="ck-it" type="number" value="1.4" min="0.2" step="0.1" /></label>
          <label class="field"><span>Tolleranza incastro</span><input id="ck-cl" type="number" value="0.3" min="0" step="0.05" /></label>
        </div>

        <div class="toggles">
          <label><input id="ck-uni" type="checkbox" /> Stampo unico</label>
          <label><input id="ck-eng" type="checkbox" checked /> Incisione</label>
        </div>

        <div class="toggles">
          <label><input id="ck-pin" type="checkbox" /> Aggiungi perno</label>
        </div>
        <div class="grid">
          <label class="field"><span>Ø perno</span><input id="ck-pd" type="number" value="8" min="1" step="0.5" /></label>
          <label class="field"><span>Altezza perno</span><input id="ck-pinh" type="number" value="15" min="1" step="0.5" /></label>
          <label class="field"><span>Ø foro</span><input id="ck-hd" type="number" value="8.5" min="1" step="0.5" /></label>
          <label class="field"><span>Altezza foro</span><input id="ck-hoh" type="number" value="2" min="0.5" step="0.5" /></label>
          <label class="field"><span>Perno X</span><input id="ck-px" type="number" value="0" step="1" /></label>
          <label class="field"><span>Perno Y</span><input id="ck-py" type="number" value="0" step="1" /></label>
        </div>

        <div class="colors">
          <label class="field"><span>Stampo esterno</span><input id="ck-col1" type="color" value="#9aa0a8" /></label>
          <label class="field"><span>Pattern</span><input id="ck-col2" type="color" value="#d8a24a" /></label>
        </div>`;

      q<HTMLInputElement>('ck-svg').addEventListener('change', async (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          svgGlyphs = svgToGlyphs(await file.text());
          q<HTMLSelectElement>('ck-src').value = 'svg';
          onChangeCb();
        } catch {
          svgGlyphs = null;
        }
      });

      body.querySelectorAll('input, textarea, select').forEach((el) => {
        el.addEventListener('input', onChange);
        el.addEventListener('change', onChange);
      });

      // Load the emoji font in the background, then rebuild.
      getEmojiFont().then((f) => {
        emojiFont = f;
        emojiReady = true;
        onChangeCb();
      });
    },

    buildRequest(): BuildRequest | null {
      const src = val('ck-src');
      const g = baseGlyphs();
      if (!g) {
        if (src === 'icona' && !emojiReady) return null; // still loading the font
        return null;
      }
      const graphic = resizeGlyphs(g, num('ck-w'), num('ck-h'));
      if (!graphic.length) return null;
      return {
        type: 'build',
        tool: 'cookie',
        graphic,
        params: {
          wall: num('ck-wall'),
          housingHeight: num('ck-hh'),
          patternHeight: num('ck-ph'),
          iconThickness: num('ck-it'),
          clearance: num('ck-cl'),
          unified: checked('ck-uni'),
          engraved: checked('ck-eng'),
          pin: checked('ck-pin'),
          pinD: num('ck-pd'),
          pinH: num('ck-pinh'),
          holeD: num('ck-hd'),
          holeH: num('ck-hoh'),
          pinX: num('ck-px'),
          pinY: num('ck-py'),
          housingColor: hexToRgb(val('ck-col1')),
          patternColor: hexToRgb(val('ck-col2')),
        },
      };
    },

    downloadName() {
      return 'cookie-cutter';
    },
  };
}
