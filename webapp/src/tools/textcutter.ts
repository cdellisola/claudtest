import { fonts, textToGlyphs } from '../fonts';
import { createFontPicker, type FontPicker } from '../fontPicker';
import type { Tool } from '../tool';
import type { BuildRequest, RGB } from '../types';

const hexToRgb = (h: string): RGB => {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

export function createTextCutterTool(): Tool {
  let root: HTMLElement;
  let picker: FontPicker;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const num = (id: string) => parseFloat(q<HTMLInputElement>(id).value);
  const checked = (id: string) => q<HTMLInputElement>(id).checked;

  return {
    id: 'textcutter',
    name: 'Taglierina Scritte',
    subtitle: 'Taglierina a forma di parola, con supporti che tengono insieme le lettere.',
    available: true,
    usesGrid: true,

    mount(body, onChange) {
      root = body;
      body.innerHTML = `
        <label class="field"><span>Testo</span><input id="tc-text" type="text" value="GlowLab3D" /></label>
        <div class="field"><span>Font</span><div id="tc-font"></div></div>
        <div class="grid">
          <label class="field"><span>Dimensione</span><input id="tc-size" type="number" value="40" min="10" step="1" /></label>
          <label class="field"><span>Spaziatura</span><input id="tc-spacing" type="number" value="1" min="0.5" max="2" step="0.05" /></label>
          <label class="field"><span>Spessore parete</span><input id="tc-wall" type="number" value="1" min="0.4" step="0.1" /></label>
          <label class="field"><span>Altezza taglio</span><input id="tc-ch" type="number" value="15" min="2" step="0.5" /></label>
          <label class="field"><span>Bordo (larghezza)</span><input id="tc-be" type="number" value="3" min="0" step="0.5" /></label>
          <label class="field"><span>Bordo (altezza)</span><input id="tc-bh" type="number" value="3" min="0" step="0.5" /></label>
        </div>

        <div class="toggles">
          <label><input id="tc-sg" type="checkbox" checked /> Supporti interni (isole)</label>
        </div>
        <div class="grid">
          <label class="field"><span>Larghezza linee</span><input id="tc-gw" type="number" value="2" min="0.6" step="0.2" /></label>
          <label class="field"><span>Profondità linee</span><input id="tc-gh" type="number" value="1.5" min="0.4" step="0.2" /></label>
          <label class="field"><span>Passo</span><input id="tc-gs" type="number" value="7" min="3" step="1" /></label>
        </div>

        <div class="colors">
          <label class="field"><span>Colore</span><input id="tc-col" type="color" value="#8fb4d8" /></label>
        </div>
        <p class="hint">I supporti stanno solo dentro le "isole" (cerchio della O, ecc.), bassi e larghi, senza entrare nelle pareti di taglio. Riduci il passo se un'isola resta staccata.</p>`;

      picker = createFontPicker({ preferName: 'Anton', onChange });
      q('tc-font').appendChild(picker.el);
      body.querySelectorAll('input, textarea').forEach((el) => {
        el.addEventListener('input', onChange);
        el.addEventListener('change', onChange);
      });
    },

    buildRequest(): BuildRequest | null {
      const font = fonts.find((f) => f.id === picker.getSelectedId()) ?? fonts[0];
      const raw = textToGlyphs(q<HTMLInputElement>('tc-text').value, font.font, num('tc-size'), num('tc-spacing'));
      if (!raw.length) return null;
      // Mirror horizontally so the cut reads correctly.
      const glyphs = raw.map((gl) => gl.map((r) => r.map((pt) => [-pt[0], pt[1]] as [number, number])));
      return {
        type: 'build',
        tool: 'textcutter',
        graphic: glyphs,
        params: {
          wall: num('tc-wall'),
          cutterHeight: num('tc-ch'),
          borderExt: num('tc-be'),
          borderHeight: num('tc-bh'),
          supportGrid: checked('tc-sg'),
          gridWidth: num('tc-gw'),
          gridHeight: num('tc-gh'),
          gridSpacing: num('tc-gs'),
          color: hexToRgb(q<HTMLInputElement>('tc-col').value),
        },
      };
    },

    downloadName() {
      return (q<HTMLInputElement>('tc-text').value || 'taglierina').replace(/[^a-z0-9._-]+/gi, '_') || 'taglierina';
    },

    destroy() {
      picker?.destroy();
    },
  };
}
