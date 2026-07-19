# Name Tag Generator (web) — testo → 3MF multicolore

Generatore **100% lato client**: apri la pagina, scrivi un nome, ottieni un
`.3mf` multicolore pronto per lo slicer. Nessun backend. Ispirato
all'architettura del progetto open *Clicker-Generator* (three.js + manifold-3d),
ma con codice originale e geometria da targhetta (base + contorno + testo).

## Come funziona

- **three.js** carica il font e ne estrae i contorni 2D delle lettere.
- **manifold-3d** (WASM, in un Web Worker) estrude i contorni e costruisce i
  solidi: base bianca, contorno azzurro rialzato, testo lilla.
- L'export scrive a mano un **3MF multicolore** (`fflate`), con ogni parte su un
  proprio slot filamento → Bambu Studio / OrcaSlicer / MakerWorld lo aprono già
  colorato.

## Font

- **Font di default:** un set di Google Fonts (licenza **OFL**) — Coiny, Chewy,
  Sour Gummy, DynaPuff, Carter One, Bubblegum Sans, Archivo, Alkatra, Pacifico,
  Lobster e altri. Non sono committati: vengono **scaricati in fase di build** da
  `scripts/download-fonts.mjs` (hook `prebuild`/`predev`) nella cartella
  `public/fonts/`. Il menù a tendina mostra ogni nome **nell'anteprima del font**.
- **Font personali (upload):** il campo *"Carica un font .ttf/.otf"* accetta
  qualsiasi font (es. **Waltograph**). Viene salvato in **IndexedDB** del browser,
  quindi resta selezionabile nel menù anche riaprendo il sito. Waltograph non è
  incluso nel repo per la sua licenza (uso personale): si carica così.
- **Elenco font:** modificabile in `src/default-fonts.json` (`slug`, `name`,
  `path` nel repo `google/fonts`). Un font che non si scarica viene semplicemente
  saltato, senza far fallire la build.

## Sviluppo locale

Requisiti: Node.js 20+.

```bash
cd webapp
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build in dist/
npm run preview  # anteprima della build
```

## Pubblicazione (GitHub Pages)

Il workflow [`.github/workflows/deploy-webapp.yml`](../.github/workflows/deploy-webapp.yml)
compila `webapp/` e pubblica su GitHub Pages a ogni push.

**Setup una tantum:** nel repo → **Settings → Pages → Source → GitHub Actions**.
Poi l'URL della pagina compare al termine del job *deploy*.
