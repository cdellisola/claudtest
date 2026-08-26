import { fonts, textToGlyphs } from '../fonts';
import { createFontPicker, type FontPicker } from '../fontPicker';
import type { Tool } from '../tool';
import type { BuildRequest, RGB } from '../types';

const hexToRgb = (h: string): RGB => {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

export function createNametagTool(): Tool {
  let root: HTMLElement;
  let picker: FontPicker;
  let kcAuto = true; // keychain auto-placed until the user drags/edits it
  const q = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const num = (id: string) => parseFloat(q<HTMLInputElement>(id).value);
  const checked = (id: string) => q<HTMLInputElement>(id).checked;

  return {
    id: 'nametag',
    name: 'Name TAG',
    subtitle: 'Targhetta con nome: base, contorno, testo (multicolore).',
    available: true,
    usesGrid: true,

    mount(body, onChange) {
      root = body;
      body.innerHTML = `
        <label class="field"><span>Testo (una riga per rigo)</span>
          <textarea id="nt-text" rows="3">GlowLab3D</textarea></label>
        <div class="field"><span>Font</span><div id="nt-font"></div></div>
        <div class="grid">
          <label class="field"><span>Dim. testo (mm)</span><input id="nt-fontSize" type="number" value="20" min="4" step="1" /></label>
          <label class="field"><span>Spaziatura lettere</span><input id="nt-spacing" type="number" value="1" min="0.5" max="2" step="0.05" /></label>
          <label class="field"><span>Alt. testo (mm)</span><input id="nt-textHeight" type="number" value="2" min="0.2" step="0.1" /></label>
          <label class="field"><span>Alt. base (mm)</span><input id="nt-plateHeight" type="number" value="12" min="0.4" step="0.1" /></label>
          <label class="field"><span>Bordo base (mm)</span><input id="nt-borderSize" type="number" value="4" min="0.5" step="0.1" /></label>
          <label class="field"><span>Spessore contorno</span><input id="nt-outlineSize" type="number" value="1" min="0.2" step="0.1" /></label>
          <label class="field"><span>Altezza contorno</span><input id="nt-outlineHeight" type="number" value="0.8" min="0.2" step="0.1" /></label>
        </div>
        <div class="toggles">
          <label><input id="nt-useBase" type="checkbox" checked /> Base</label>
          <label><input id="nt-useOutline" type="checkbox" checked /> Contorno</label>
          <label><input id="nt-keychain" type="checkbox" /> Gancio</label>
        </div>
        <div class="grid">
          <label class="field"><span>Ø gancio (mm)</span><input id="nt-keychainRing" type="number" value="10" min="4" step="0.5" /></label>
          <label class="field"><span>Ø foro (mm)</span><input id="nt-keychainHole" type="number" value="4" min="1" step="0.5" /></label>
          <label class="field"><span>Gancio X</span><input id="nt-kcX" type="number" value="0" step="1" /></label>
          <label class="field"><span>Gancio Y</span><input id="nt-kcY" type="number" value="0" step="1" /></label>
        </div>
        <label class="field"><span>Angolo gancio: <b id="nt-kcAngVal">0</b>°</span>
          <input id="nt-kcAngle" type="range" min="-180" max="180" value="0" step="1" /></label>
        <p class="hint">🔗 Clicca il gancio nell'anteprima per spostarlo con gli assi X/Y.</p>

        <div class="colors">
          <label class="field"><span>Base</span><input id="nt-baseColor" type="color" value="#f7f7f5" /></label>
          <label class="field"><span>Contorno</span><input id="nt-outlineColor" type="color" value="#add8e6" /></label>
          <label class="field"><span>Testo</span><input id="nt-textColor" type="color" value="#d8b7ff" /></label>
        </div>`;

      picker = createFontPicker({ preferName: 'Coiny', onChange });
      q('nt-font').appendChild(picker.el);
      q<HTMLInputElement>('nt-kcAngle').addEventListener('input', () => {
        q('nt-kcAngVal').textContent = q<HTMLInputElement>('nt-kcAngle').value;
      });
      // Editing X/Y by hand switches off auto-placement.
      for (const id of ['nt-kcX', 'nt-kcY']) q(id).addEventListener('input', () => (kcAuto = false));
      body.querySelectorAll('input, textarea').forEach((el) => {
        el.addEventListener('input', onChange);
        el.addEventListener('change', onChange);
      });
    },

    buildRequest(): BuildRequest | null {
      const font = fonts.find((f) => f.id === picker.getSelectedId()) ?? fonts[0];
      const size = num('nt-fontSize');
      const glyphs = textToGlyphs(q<HTMLTextAreaElement>('nt-text').value, font.font, size, num('nt-spacing'));
      if (!glyphs.length) return null;
      return {
        type: 'build',
        tool: 'nametag',
        glyphs,
        params: {
          fontSizeMm: size,
          textHeight: num('nt-textHeight'),
          plateHeight: num('nt-plateHeight'),
          borderSize: num('nt-borderSize'),
          outlineSize: num('nt-outlineSize'),
          outlineHeight: num('nt-outlineHeight'),
          useBase: checked('nt-useBase'),
          useOutline: checked('nt-useOutline'),
          keychain: checked('nt-keychain'),
          keychainRing: num('nt-keychainRing'),
          keychainHole: num('nt-keychainHole'),
          keychainAuto: kcAuto,
          keychainX: num('nt-kcX'),
          keychainY: num('nt-kcY'),
          keychainAngle: num('nt-kcAngle'),
          baseColor: hexToRgb(q<HTMLInputElement>('nt-baseColor').value),
          outlineColor: hexToRgb(q<HTMLInputElement>('nt-outlineColor').value),
          textColor: hexToRgb(q<HTMLInputElement>('nt-textColor').value),
        },
      };
    },

    onGizmoMove(id, x, y) {
      if (id !== 'keychain') return;
      const r = (v: number) => Math.round(v * 10) / 10;
      q<HTMLInputElement>('nt-kcX').value = String(r(x));
      q<HTMLInputElement>('nt-kcY').value = String(r(y));
      kcAuto = false;
    },

    downloadName() {
      const first = q<HTMLTextAreaElement>('nt-text').value.split('\n')[0] || 'name-tag';
      return first.replace(/[^a-z0-9._-]+/gi, '_') || 'name-tag';
    },

    destroy() {
      picker?.destroy();
    },
  };
}
