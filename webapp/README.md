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

## Font Waltograph

Il font **non** è incluso (licenza uso personale). La pagina parte con un font
di default e ha un campo **"Carica un font .ttf"**: seleziona lì il tuo
`waltograph.ttf` e verrà usato subito. È il modo pulito per avere lo stile
Disney senza problemi di licenza sul repo.

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
