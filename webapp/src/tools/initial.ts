import { fonts, textToGlyphs, attachFloatingMarks, firstLetterUpper } from '../fonts';
import { createFontPicker, type FontPicker } from '../fontPicker';
import type { Tool, ToolApi } from '../tool';
import type { BuildRequest, Magnet, RGB } from '../types';

const hexToRgb = (h: string): RGB => {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

// Letters whose bottom is curved — a flat cut helps them stand.
const CURVED = new Set(['C', 'G', 'O', 'Q', 'S', 'T', 'U', 'J']);

export function createInitialTool(): Tool {
  let root: HTMLElement;
  let namePicker: FontPicker;
  let initialPicker: FontPicker;
  let onChangeCb: () => void = () => {};
  let apiRef: ToolApi | null = null;
  let magnets: Magnet[] = [];
  const q = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const num = (id: string) => parseFloat(q<HTMLInputElement>(id).value);
  const checked = (id: string) => q<HTMLInputElement>(id).checked;

  function defaultMagnet(i: number): Magnet {
    const size = q<HTMLInputElement>('in-isize') ? num('in-isize') : 180;
    const qx = size * 0.22;
    const xs = [-qx, qx, -qx, qx];
    const ys = [qx, qx, -qx, -qx];
    // z is relative to the initial's top surface (0 = surface, -2 = 2 mm inside).
    return { x: xs[i % 4], y: ys[i % 4], z: -2, d: 8, h: 2 };
  }

  function syncMagnetCount() {
    const on = checked('in-mag');
    const count = Math.max(1, Math.min(12, Math.round(num('in-magn') || 4)));
    if (!on) {
      magnets = [];
    } else {
      while (magnets.length < count) magnets.push(defaultMagnet(magnets.length));
      magnets.length = count;
    }
    renderMagnetList();
  }

  function renderMagnetList() {
    const box = q('in-maglist');
    box.innerHTML = '';
    if (!checked('in-mag')) return;
    magnets.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = 'mag-row';
      row.innerHTML = `<button type="button" class="mag-tag" data-sel="${i}" title="Seleziona in anteprima">#${i + 1}</button>
        <label>X<input type="number" step="1" value="${m.x}" data-i="${i}" data-k="x" /></label>
        <label>Y<input type="number" step="1" value="${m.y}" data-i="${i}" data-k="y" /></label>
        <label>Z<input type="number" step="0.5" value="${m.z}" data-i="${i}" data-k="z" /></label>`;
      box.appendChild(row);
    });
    box.querySelectorAll('button.mag-tag').forEach((el) =>
      el.addEventListener('click', (ev) => {
        const i = Number((ev.currentTarget as HTMLElement).dataset.sel);
        apiRef?.selectGizmo(`magnet:${i}`);
      }),
    );
    box.querySelectorAll('input').forEach((el) =>
      el.addEventListener('input', (ev) => {
        const t = ev.target as HTMLInputElement;
        const i = Number(t.dataset.i);
        const k = t.dataset.k as 'x' | 'y' | 'z';
        magnets[i][k] = parseFloat(t.value);
        onChangeCb();
      }),
    );
  }

  return {
    id: 'initial',
    name: 'Iniziale + Nome',
    subtitle: "Iniziale con nome incastrato, base su griglia, magneti opzionali.",
    available: true,
    usesGrid: true,

    mount(body, onChange, api) {
      root = body;
      onChangeCb = onChange;
      apiRef = api;
      body.innerHTML = `
        <label class="field"><span>Nome</span><input id="in-name" type="text" value="Sofia" /></label>
        <div class="field"><span>Font nome (corsivo)</span><div id="in-namefont"></div></div>
        <div class="field"><span>Font iniziale (serif)</span><div id="in-initfont"></div></div>

        <div class="grid">
          <label class="field"><span>Dim. iniziale</span><input id="in-isize" type="number" value="180" min="40" step="1" /></label>
          <label class="field"><span>Dim. nome</span><input id="in-nsize" type="number" value="50" min="10" step="1" /></label>
          <label class="field"><span>Spessore iniziale</span><input id="in-ithick" type="number" value="30" min="2" step="0.5" /></label>
          <label class="field"><span>Spessore nome</span><input id="in-nthick" type="number" value="10" min="1" step="0.5" /></label>
          <label class="field"><span>Profondità incastro</span><input id="in-pocket" type="number" value="5" min="0.5" step="0.5" /></label>
          <label class="field"><span>Tolleranza</span><input id="in-clear" type="number" value="0.1" min="0" step="0.05" /></label>
          <label class="field"><span>Offset X nome</span><input id="in-ox" type="number" value="0" step="1" /></label>
          <label class="field"><span>Offset Y nome</span><input id="in-oy" type="number" value="0" step="1" /></label>
        </div>

        <label class="field"><span>Rotazione nome: <b id="in-rotval">0</b>°</span>
          <input id="in-rot" type="range" min="-180" max="180" value="0" step="1" /></label>

        <div class="toggles">
          <label><input id="in-flat" type="checkbox" /> Taglia base curva</label>
        </div>
        <label class="field"><span>Altezza taglio base (mm)</span><input id="in-flatcut" type="number" value="4" min="0" step="0.5" /></label>

        <div class="toggles">
          <label><input id="in-mag" type="checkbox" /> Magneti (cilindrici)</label>
        </div>
        <div class="grid">
          <label class="field"><span>Quantità</span><input id="in-magn" type="number" value="4" min="1" max="12" step="1" /></label>
          <label class="field"><span>Ø magnete</span><input id="in-magd" type="number" value="8" min="1" step="0.5" /></label>
          <label class="field"><span>Altezza magnete</span><input id="in-magh" type="number" value="2" min="0.5" step="0.5" /></label>
        </div>
        <div id="in-maglist" class="mag-list"></div>
        <p class="hint">🧲 Seleziona un magnete nell'anteprima per spostarlo sui 3 assi (X/Y/Z).</p>

        <div class="colors">
          <label class="field"><span>Iniziale</span><input id="in-icol" type="color" value="#0a78bf" /></label>
          <label class="field"><span>Nome</span><input id="in-ncol" type="color" value="#ffffff" /></label>
        </div>`;

      namePicker = createFontPicker({ preferName: 'Pacifico', onChange });
      initialPicker = createFontPicker({ preferName: 'Abril Fatface', onChange });
      q('in-namefont').appendChild(namePicker.el);
      q('in-initfont').appendChild(initialPicker.el);

      q<HTMLInputElement>('in-rot').addEventListener('input', () => {
        q('in-rotval').textContent = q<HTMLInputElement>('in-rot').value;
      });
      // Auto-enable the flat cut for curved initials.
      const first = firstLetterUpper(q<HTMLInputElement>('in-name').value);
      q<HTMLInputElement>('in-flat').checked = CURVED.has(first);
      q<HTMLInputElement>('in-name').addEventListener('input', () => {
        const f = firstLetterUpper(q<HTMLInputElement>('in-name').value);
        q<HTMLInputElement>('in-flat').checked = CURVED.has(f);
      });

      for (const id of ['in-mag', 'in-magn']) q(id).addEventListener('change', syncMagnetCount);
      body.querySelectorAll('input, textarea').forEach((el) => {
        el.addEventListener('input', onChange);
        el.addEventListener('change', onChange);
      });
      syncMagnetCount();
    },

    buildRequest(): BuildRequest | null {
      const nameFont = fonts.find((f) => f.id === namePicker.getSelectedId()) ?? fonts[0];
      const initFont = fonts.find((f) => f.id === initialPicker.getSelectedId()) ?? fonts[0];
      const first = firstLetterUpper(q<HTMLInputElement>('in-name').value);
      if (!first) return null;

      const initialGlyphs = textToGlyphs(first, initFont.font, num('in-isize'), 1);
      const nameGlyphs = attachFloatingMarks(
        textToGlyphs(q<HTMLInputElement>('in-name').value, nameFont.font, num('in-nsize'), 1),
      );

      const d = num('in-magd');
      const h = num('in-magh');
      const mags: Magnet[] = checked('in-mag') ? magnets.map((m) => ({ ...m, d, h })) : [];

      return {
        type: 'build',
        tool: 'initial',
        initialGlyphs,
        nameGlyphs,
        params: {
          initialThickness: num('in-ithick'),
          nameThickness: num('in-nthick'),
          pocketDepth: num('in-pocket'),
          clearance: num('in-clear'),
          nameOffsetX: num('in-ox'),
          nameOffsetY: num('in-oy'),
          nameRotate: num('in-rot'),
          flatBase: checked('in-flat'),
          flatBaseCut: num('in-flatcut'),
          initialColor: hexToRgb(q<HTMLInputElement>('in-icol').value),
          nameColor: hexToRgb(q<HTMLInputElement>('in-ncol').value),
          magnets: mags,
        },
      };
    },

    onGizmoLive(id, x, y, z) {
      const i = Number(id.split(':')[1]);
      if (!magnets[i]) return;
      const r = (v: number) => Math.round(v * 10) / 10;
      // The gizmo reports world Z; store it relative to the initial's top surface.
      const zRel = z - num('in-ithick');
      magnets[i] = { ...magnets[i], x: r(x), y: r(y), z: r(zRel) };
      const box = q('in-maglist');
      const set = (k: string, v: number) => {
        const el = box.querySelector<HTMLInputElement>(`input[data-i="${i}"][data-k="${k}"]`);
        if (el) el.value = String(v);
      };
      set('x', magnets[i].x);
      set('y', magnets[i].y);
      set('z', magnets[i].z);
    },

    onGizmoMove(id, x, y, z) {
      this.onGizmoLive?.(id, x, y, z);
    },

    downloadName() {
      return (q<HTMLInputElement>('in-name').value || 'iniziale').replace(/[^a-z0-9._-]+/gi, '_') || 'iniziale';
    },

    destroy() {
      namePicker?.destroy();
      initialPicker?.destroy();
    },
  };
}
