import { fonts, textToGlyphs } from '../fonts';
import { createFontPicker, type FontPicker } from '../fontPicker';
import type { Tool } from '../tool';
import type { BuildRequest, RGB } from '../types';

const hexToRgb = (h: string): RGB => {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

export function createInterlockTool(): Tool {
  let root: HTMLElement;
  let p1: FontPicker, p2: FontPicker, p3: FontPicker;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const num = (id: string) => parseFloat(q<HTMLInputElement>(id).value);
  const glyphsFor = (textId: string, picker: FontPicker, size: number) => {
    const font = fonts.find((f) => f.id === picker.getSelectedId()) ?? fonts[0];
    return textToGlyphs(q<HTMLTextAreaElement>(textId).value, font.font, size);
  };

  return {
    id: 'interlock',
    name: 'Frasi a incastro',
    subtitle: 'Tre testi che si incastrano (Insult3D). Trascina i testi in anteprima.',
    available: true,

    mount(body, onChange) {
      root = body;
      body.innerHTML = `
        <p class="hint">💡 Puoi <b>trascinare</b> il testo in alto e quello in basso direttamente nell'anteprima 3D.</p>

        <label class="field"><span>Testo 1 (in alto)</span><input id="il-t1" type="text" value="Meno male che" /></label>
        <div class="field"><span>Font testo 1</span><div id="il-f1"></div></div>

        <label class="field"><span>Testo 2 (centrale)</span><input id="il-t2" type="text" value="NON PENSO" /></label>
        <div class="field"><span>Font testo 2</span><div id="il-f2"></div></div>

        <label class="field"><span>Testo 3 (in basso)</span><input id="il-t3" type="text" value="ad alta voce" /></label>
        <div class="field"><span>Font testo 3</span><div id="il-f3"></div></div>

        <div class="grid">
          <label class="field"><span>Dim. testo 1</span><input id="il-s1" type="number" value="17" min="6" step="0.5" /></label>
          <label class="field"><span>Dim. testo 2</span><input id="il-s2" type="number" value="60" min="20" step="0.5" /></label>
          <label class="field"><span>Dim. testo 3</span><input id="il-s3" type="number" value="17" min="6" step="0.5" /></label>
          <label class="field"><span>Spessore centrale</span><input id="il-sp2" type="number" value="22" min="2" step="0.5" /></label>
          <label class="field"><span>Spessore testo 1</span><input id="il-sp1" type="number" value="5" min="1" step="0.5" /></label>
          <label class="field"><span>Spessore testo 3</span><input id="il-sp3" type="number" value="5" min="1" step="0.5" /></label>
          <label class="field"><span>Profondità incastro</span><input id="il-prof" type="number" value="3" min="0.5" step="0.5" /></label>
          <label class="field"><span>Tolleranza</span><input id="il-toll" type="number" value="0.2" min="0" step="0.05" /></label>
        </div>

        <div class="grid">
          <label class="field"><span>Pos X testo 1</span><input id="il-x1" type="number" value="-80" step="0.5" /></label>
          <label class="field"><span>Pos Y testo 1</span><input id="il-y1" type="number" value="25" step="0.5" /></label>
          <label class="field"><span>Pos X testo 3</span><input id="il-x3" type="number" value="61" step="0.5" /></label>
          <label class="field"><span>Pos Y testo 3</span><input id="il-y3" type="number" value="-17" step="0.5" /></label>
        </div>

        <div class="colors">
          <label class="field"><span>Testo 1</span><input id="il-c1" type="color" value="#ff69b4" /></label>
          <label class="field"><span>Centrale</span><input id="il-c2" type="color" value="#ffd700" /></label>
          <label class="field"><span>Testo 3</span><input id="il-c3" type="color" value="#ff69b4" /></label>
        </div>`;

      p1 = createFontPicker({ preferName: 'Pacifico', onChange });
      p2 = createFontPicker({ preferName: 'Titan One', onChange });
      p3 = createFontPicker({ preferName: 'Pacifico', onChange });
      q('il-f1').appendChild(p1.el);
      q('il-f2').appendChild(p2.el);
      q('il-f3').appendChild(p3.el);

      body.querySelectorAll('input, textarea').forEach((el) => {
        el.addEventListener('input', onChange);
        el.addEventListener('change', onChange);
      });
    },

    buildRequest(): BuildRequest | null {
      const g2 = glyphsFor('il-t2', p2, num('il-s2'));
      if (!g2.length) return null; // central text is required
      return {
        type: 'build',
        tool: 'interlock',
        g1: glyphsFor('il-t1', p1, num('il-s1')),
        g2,
        g3: glyphsFor('il-t3', p3, num('il-s3')),
        params: {
          spessore2: num('il-sp2'),
          spessore1: num('il-sp1'),
          spessore3: num('il-sp3'),
          profondita: num('il-prof'),
          tolleranza: num('il-toll'),
          size1: num('il-s1'),
          size2: num('il-s2'),
          size3: num('il-s3'),
          posX1: num('il-x1'),
          posY1: num('il-y1'),
          posX3: num('il-x3'),
          posY3: num('il-y3'),
          color1: hexToRgb(q<HTMLInputElement>('il-c1').value),
          color2: hexToRgb(q<HTMLInputElement>('il-c2').value),
          color3: hexToRgb(q<HTMLInputElement>('il-c3').value),
        },
      };
    },

    onDrag(dragId, dx, dy) {
      const round = (v: number) => Math.round(v * 10) / 10;
      if (dragId === 'text1') {
        q<HTMLInputElement>('il-x1').value = String(round(num('il-x1') + dx));
        q<HTMLInputElement>('il-y1').value = String(round(num('il-y1') + dy));
      } else if (dragId === 'text3') {
        q<HTMLInputElement>('il-x3').value = String(round(num('il-x3') + dx));
        q<HTMLInputElement>('il-y3').value = String(round(num('il-y3') + dy));
      }
    },

    downloadName() {
      return (q<HTMLInputElement>('il-t2').value || 'incastro').replace(/[^a-z0-9._-]+/gi, '_') || 'incastro';
    },

    destroy() {
      p1?.destroy();
      p2?.destroy();
      p3?.destroy();
    },
  };
}
