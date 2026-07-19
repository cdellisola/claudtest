import './style.css';
import {
  fonts,
  importFontFile,
  loadDefaultFonts,
  loadUserFonts,
  removeUserFont,
  textToGlyphs,
  type FontOption,
} from './fonts';
import { Viewer } from './viewer';
import { downloadThreeMF } from './threemf';
import type { Part, TagParams, RGB, BuildResponse } from './types';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const viewer = new Viewer($<HTMLCanvasElement>('preview'));

let lastParts: Part[] = [];
let ready = false;
let buildTimer: number | undefined;
let selectedFontId = 'helvetiker';
let userPickedFont = false;

const statusEl = $('status');
const setStatus = (s: string) => (statusEl.textContent = s);

const hexToRgb = (h: string): RGB => {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

const num = (id: string) => parseFloat($<HTMLInputElement>(id).value);
const checked = (id: string) => $<HTMLInputElement>(id).checked;
const currentFont = (): FontOption => fonts.find((f) => f.id === selectedFontId) ?? fonts[0];

function params(): TagParams {
  return {
    fontSizeMm: num('fontSize'),
    textHeight: num('textHeight'),
    plateHeight: num('plateHeight'),
    borderSize: num('borderSize'),
    outlineSize: num('outlineSize'),
    outlineHeight: num('outlineHeight'),
    useBase: checked('useBase'),
    useOutline: checked('useOutline'),
    keychain: checked('keychain'),
    keychainRing: num('keychainRing'),
    keychainHole: num('keychainHole'),
    baseColor: hexToRgb($<HTMLInputElement>('baseColor').value),
    outlineColor: hexToRgb($<HTMLInputElement>('outlineColor').value),
    textColor: hexToRgb($<HTMLInputElement>('textColor').value),
  };
}

function build() {
  if (!ready) return;
  const text = $<HTMLTextAreaElement>('text').value;
  const p = params();
  let glyphs;
  try {
    glyphs = textToGlyphs(text, currentFont().font, p.fontSizeMm);
  } catch (e: any) {
    setStatus('Errore font: ' + e.message);
    return;
  }
  if (!glyphs.length) {
    setStatus('Scrivi un nome…');
    return;
  }
  setStatus('Genero la geometria…');
  worker.postMessage({ type: 'build', glyphs, params: p });
}

function scheduleBuild() {
  clearTimeout(buildTimer);
  buildTimer = window.setTimeout(build, 250);
}

worker.onmessage = (e: MessageEvent<BuildResponse>) => {
  const m = e.data;
  if (m.type === 'ready') {
    ready = true;
    build();
  } else if (m.type === 'parts') {
    lastParts = m.parts;
    viewer.show(m.parts);
    setStatus(`Pronto — ${m.parts.length} parti / colori`);
    $<HTMLButtonElement>('download').disabled = false;
  } else if (m.type === 'error') {
    setStatus('Errore: ' + m.message);
  }
};

// --- Custom font dropdown with previews ---
const trigger = $<HTMLButtonElement>('fontTrigger');
const panel = $('fontPanel');

function renderFontList() {
  const cur = currentFont();
  trigger.textContent = cur.name;
  trigger.style.fontFamily = cur.cssFamily;

  panel.innerHTML = '';
  for (const f of fonts) {
    const item = document.createElement('div');
    item.className = 'font-item' + (f.id === selectedFontId ? ' selected' : '');

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = f.name;
    label.style.fontFamily = f.cssFamily;
    item.appendChild(label);

    if (f.user) {
      const remove = document.createElement('button');
      remove.className = 'remove';
      remove.type = 'button';
      remove.title = 'Rimuovi questo font';
      remove.textContent = '✕';
      remove.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const wasSelected = f.id === selectedFontId;
        await removeUserFont(f);
        if (wasSelected) {
          selectedFontId = fonts[0]?.id ?? 'helvetiker';
          build();
        }
        renderFontList();
      });
      item.appendChild(remove);
    } else if (f.id !== 'helvetiker') {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'OFL';
      item.appendChild(badge);
    }

    item.addEventListener('click', () => {
      selectedFontId = f.id;
      userPickedFont = true;
      panel.classList.add('hidden');
      renderFontList();
      build();
    });

    panel.appendChild(item);
  }
}

trigger.addEventListener('click', () => panel.classList.toggle('hidden'));
document.addEventListener('click', (e) => {
  if (!$('fontDropdown').contains(e.target as Node)) panel.classList.add('hidden');
});

/** Auto-select a nice default (Coiny) once it has loaded, unless the user chose one. */
function maybeAutoSelect() {
  if (userPickedFont) return;
  const pick = fonts.find((f) => f.name === 'Coiny') ?? fonts.find((f) => f.id.startsWith('def-'));
  if (pick && pick.id !== selectedFontId) {
    selectedFontId = pick.id;
    build();
  }
}

function onFontLoaded() {
  maybeAutoSelect();
  renderFontList();
}

// --- Wire up numeric / color / toggle controls ---
for (const id of [
  'text', 'fontSize', 'textHeight', 'plateHeight', 'borderSize',
  'outlineSize', 'outlineHeight', 'useBase', 'useOutline',
  'keychain', 'keychainRing', 'keychainHole',
  'baseColor', 'outlineColor', 'textColor',
]) {
  const el = $(id);
  el.addEventListener('input', scheduleBuild);
  el.addEventListener('change', scheduleBuild);
}

$<HTMLInputElement>('fontfile').addEventListener('change', async (ev) => {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  setStatus('Carico il font…');
  try {
    const opt = await importFontFile(file);
    if (opt) {
      selectedFontId = opt.id;
      userPickedFont = true;
      renderFontList();
      setStatus('Font caricato e salvato: ' + opt.name);
      build();
    } else {
      setStatus('Font non valido.');
    }
  } catch (e: any) {
    setStatus('Font non valido: ' + e.message);
  }
  (ev.target as HTMLInputElement).value = '';
});

$<HTMLButtonElement>('download').addEventListener('click', () => {
  if (!lastParts.length) return;
  const first = $<HTMLTextAreaElement>('text').value.split('\n')[0] || 'name-tag';
  const safe = first.replace(/[^a-z0-9._-]+/gi, '_') || 'name-tag';
  downloadThreeMF(lastParts, safe + '.3mf');
});

// --- Boot ---
renderFontList();
setStatus('Inizializzo il motore 3D e carico i font…');
loadUserFonts(onFontLoaded);
loadDefaultFonts(onFontLoaded);
