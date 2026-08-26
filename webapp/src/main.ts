import './style.css';
import { loadDefaultFonts, loadUserFonts } from './fonts';
import { refreshAllPickers } from './fontPicker';
import { Viewer } from './viewer';
import { downloadThreeMF } from './threemf';
import { createNametagTool } from './tools/nametag';
import { createInterlockTool } from './tools/interlock';
import { createInitialTool } from './tools/initial';
import { createCookieTool } from './tools/cookie';
import { createTextCutterTool } from './tools/textcutter';
import { LOGO_SVG } from './logo';
import type { Tool } from './tool';
import type { BuildResponse, Part } from './types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const viewer = new Viewer($<HTMLCanvasElement>('preview'));
const toolArea = $('toolArea');
const statusEl = $('status');
const downloadBtn = $<HTMLButtonElement>('download');
const homeEl = $('home');
const brandLogoEl = $('brandLogo');
const setStatus = (s: string) => (statusEl.textContent = s);

// Tool registry.
const TOOLS: Tool[] = [
  createNametagTool(),
  createInterlockTool(),
  createInitialTool(),
  createCookieTool(),
  createTextCutterTool(),
];
const COMING: { name: string; subtitle: string }[] = [];

// Per-tool icon for the home cards.
const ICONS: Record<string, string> = {
  nametag: '🏷️',
  interlock: '🧩',
  initial: '🧲',
  cookie: '🍪',
  textcutter: '✂️',
};

let activeTool: Tool | null = null;
let lastParts: Part[] = [];
let ready = false;
let pendingRecenter = false;
let buildTimer: number | undefined;

function build(recenter = false) {
  if (!ready || !activeTool) return;
  const req = activeTool.buildRequest();
  if (!req) {
    setStatus('Inserisci il testo…');
    return;
  }
  if (recenter) pendingRecenter = true;
  setStatus('Genero la geometria…');
  worker.postMessage(req);
}

function scheduleBuild() {
  clearTimeout(buildTimer);
  buildTimer = window.setTimeout(() => build(false), 250);
}

worker.onmessage = (e: MessageEvent<BuildResponse>) => {
  const m = e.data;
  if (m.type === 'ready') {
    ready = true;
    if (activeTool) build(true);
  } else if (m.type === 'parts') {
    lastParts = m.parts;
    viewer.show(m.parts, { recenter: pendingRecenter });
    pendingRecenter = false;
    activeTool?.onParts?.(m.parts);
    setStatus(`Pronto — ${m.parts.length} parti / colori`);
    downloadBtn.disabled = false;
  } else if (m.type === 'error') {
    setStatus('Errore: ' + m.message);
  }
};

viewer.onDrag = (id, dx, dy) => {
  activeTool?.onDrag?.(id, dx, dy);
  build(false);
};
viewer.onGizmoChange = (id, x, y, z) => activeTool?.onGizmoLive?.(id, x, y, z);
viewer.onGizmoCommit = (id, x, y, z) => {
  activeTool?.onGizmoMove?.(id, x, y, z);
  build(false);
};

// --- Home landing --------------------------------------------------------
function buildHome() {
  const cards = TOOLS.map(
    (t) => `<button class="home-card" type="button" data-id="${t.id}">
      <span class="hc-icon">${ICONS[t.id] ?? '▪'}</span>
      <b>${t.name}</b>
      <span class="hc-sub">${t.subtitle}</span>
    </button>`,
  ).join('');
  homeEl.innerHTML = `
    <div class="home-inner">
      <div class="home-logo">${LOGO_SVG}</div>
      <h1 class="home-title">GlowLab3D <span>Studio</span></h1>
      <p class="home-sub">Crea modelli stampabili pronti da esportare in 3MF: targhette, scritte a incastro,
        iniziali con magneti, formine per biscotti e taglierine. Scegli una funzione per iniziare.</p>
      <div class="home-cards">${cards}</div>
    </div>`;
  homeEl.querySelectorAll<HTMLButtonElement>('.home-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = TOOLS.find((t) => t.id === btn.dataset.id);
      if (tool) activate(tool);
    });
  });
}

const showHome = () => homeEl.classList.remove('hidden');
const hideHome = () => homeEl.classList.add('hidden');

// --- Portal navigation ---------------------------------------------------
function renderHome() {
  if (activeTool) {
    activeTool.destroy?.();
    activeTool = null;
  }
  downloadBtn.disabled = true;
  lastParts = [];
  setStatus('');
  viewer.setGrid(false);
  showHome();
  toolArea.innerHTML = `<p class="portal-intro">Scegli una funzione:</p>`;
  const list = document.createElement('div');
  list.className = 'tool-list';
  for (const t of TOOLS) {
    const card = document.createElement('button');
    card.className = 'tool-card';
    card.type = 'button';
    card.innerHTML = `<b>${t.name}</b><span>${t.subtitle}</span>`;
    card.addEventListener('click', () => activate(t));
    list.appendChild(card);
  }
  for (const c of COMING) {
    const card = document.createElement('div');
    card.className = 'tool-card disabled';
    card.innerHTML = `<b>${c.name}</b><span>${c.subtitle}</span>`;
    list.appendChild(card);
  }
  toolArea.appendChild(list);
}

function activate(tool: Tool) {
  hideHome();
  if (activeTool) activeTool.destroy?.();
  activeTool = tool;
  downloadBtn.disabled = true;

  toolArea.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'back';
  back.type = 'button';
  back.textContent = '‹ Tutte le funzioni';
  back.addEventListener('click', renderHome);
  const title = document.createElement('h2');
  title.className = 'tool-title';
  title.textContent = tool.name;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'tool-body';
  toolArea.append(back, title, bodyEl);

  viewer.setGrid(!!tool.usesGrid);
  tool.mount(bodyEl, scheduleBuild, { selectGizmo: (id) => viewer.selectGizmo(id) });
  build(true);
}

downloadBtn.addEventListener('click', () => {
  if (!lastParts.length || !activeTool) return;
  downloadThreeMF(lastParts, activeTool.downloadName() + '.3mf');
});

// --- Boot ----------------------------------------------------------------
brandLogoEl.innerHTML = LOGO_SVG;
buildHome();
renderHome();
setStatus('Inizializzo il motore 3D e carico i font…');
const onFontLoaded = () => refreshAllPickers();
loadUserFonts(onFontLoaded);
loadDefaultFonts(onFontLoaded);
