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

  return {
    id: 'textcutter',
    name: 'Taglierina Scritte',
    subtitle: 'Taglierina a forma di parola: parete di taglio + flangia di presa.',
    available: true,
    usesGrid: true,

    mount(body, onChange) {
      root = body;
      body.innerHTML = `
        <label class="field"><span>Testo</span><input id="tc-text" type="text" value="CIAO" /></label>
        <div class="field"><span>Font</span><div id="tc-font"></div></div>
        <div class="grid">
          <label class="field"><span>Dimensione</span><input id="tc-size" type="number" value="40" min="10" step="1" /></label>
          <label class="field"><span>Spaziatura</span><input id="tc-spacing" type="number" value="1" min="0.5" max="2" step="0.05" /></label>
          <label class="field"><span>Spessore parete</span><input id="tc-wall" type="number" value="1" min="0.4" step="0.1" /></label>
          <label class="field"><span>Altezza taglio</span><input id="tc-ch" type="number" value="15" min="2" step="0.5" /></label>
          <label class="field"><span>Flangia (larghezza)</span><input id="tc-fe" type="number" value="3" min="0" step="0.5" /></label>
          <label class="field"><span>Flangia (altezza)</span><input id="tc-fh" type="number" value="3" min="0" step="0.5" /></label>
        </div>
        <div class="colors">
          <label class="field"><span>Colore</span><input id="tc-col" type="color" value="#8fb4d8" /></label>
        </div>
        <p class="hint">La taglierina taglia il contorno della parola; la flangia alla base serve per la presa e la rigidità.</p>`;

      picker = createFontPicker({ preferName: 'Anton', onChange });
      q('tc-font').appendChild(picker.el);
      body.querySelectorAll('input, textarea').forEach((el) => {
        el.addEventListener('input', onChange);
        el.addEventListener('change', onChange);
      });
    },

    buildRequest(): BuildRequest | null {
      const font = fonts.find((f) => f.id === picker.getSelectedId()) ?? fonts[0];
      const glyphs = textToGlyphs(q<HTMLInputElement>('tc-text').value, font.font, num('tc-size'), num('tc-spacing'));
      if (!glyphs.length) return null;
      return {
        type: 'build',
        tool: 'textcutter',
        graphic: glyphs,
        params: {
          wall: num('tc-wall'),
          cutterHeight: num('tc-ch'),
          flangeExt: num('tc-fe'),
          flangeHeight: num('tc-fh'),
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
