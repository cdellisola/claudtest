import './style.css';
import { fonts, importFont, textToRings } from './fonts';
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

const statusEl = $('status');
const setStatus = (s: string) => (statusEl.textContent = s);

const hexToRgb = (h: string): RGB => {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

const num = (id: string) => parseFloat($<HTMLInputElement>(id).value);
const checked = (id: string) => $<HTMLInputElement>(id).checked;
const currentFont = () => {
  const id = $<HTMLSelectElement>('font').value;
  return fonts.find((f) => f.id === id) ?? fonts[0];
};

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
    baseColor: hexToRgb($<HTMLInputElement>('baseColor').value),
    outlineColor: hexToRgb($<HTMLInputElement>('outlineColor').value),
    textColor: hexToRgb($<HTMLInputElement>('textColor').value),
  };
}

function build() {
  if (!ready) return;
  const text = $<HTMLTextAreaElement>('text').value;
  const p = params();
  let rings;
  try {
    rings = textToRings(text, currentFont().font, p.fontSizeMm);
  } catch (e: any) {
    setStatus('Errore font: ' + e.message);
    return;
  }
  if (!rings.length) {
    setStatus('Scrivi un nome…');
    return;
  }
  setStatus('Genero la geometria…');
  worker.postMessage({ type: 'build', rings, params: p });
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

function refreshFontSelect(selectId?: string) {
  const sel = $<HTMLSelectElement>('font');
  sel.innerHTML = '';
  for (const f of fonts) {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = f.name;
    sel.appendChild(o);
  }
  if (selectId) sel.value = selectId;
}

// --- Wire up controls ---
refreshFontSelect();

for (const id of [
  'text', 'fontSize', 'textHeight', 'plateHeight', 'borderSize',
  'outlineSize', 'outlineHeight', 'useBase', 'useOutline',
  'baseColor', 'outlineColor', 'textColor', 'font',
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
    const opt = await importFont(file);
    refreshFontSelect(opt.id);
    setStatus('Font caricato: ' + opt.name);
    build();
  } catch (e: any) {
    setStatus('Font non valido: ' + e.message);
  }
});

$<HTMLButtonElement>('download').addEventListener('click', () => {
  if (!lastParts.length) return;
  const first = $<HTMLTextAreaElement>('text').value.split('\n')[0] || 'name-tag';
  const safe = first.replace(/[^a-z0-9._-]+/gi, '_') || 'name-tag';
  downloadThreeMF(lastParts, safe + '.3mf');
});

setStatus('Inizializzo il motore 3D…');
