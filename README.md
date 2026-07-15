# Name Tag Generator — Waltograph / Disney style

Genera automaticamente file **`.3mf`** di targhette con i nomi, in stile Disney,
usando il font **Waltograph** caricato direttamente dal disco (quindi **senza
dipendere** dai font installati su nessuna piattaforma).

Il design è basato sull'originale di Vanessa Matos: base bianca, contorno
azzurro rialzato e testo lilla.

## Come funziona

- **`name_tag.scad`** — il modello parametrico. In cima fa
  `use <fonts/waltograph.ttf>`: è così che quei progetti "Disney Generator"
  usano il font anche dove non è installato sul server — se lo portano dietro
  nel file.
- **`generate.sh`** — chiama OpenSCAD e produce un `.3mf` per ogni nome. Rileva
  in automatico il nome-famiglia del font con `fc-scan`.
- **`.github/workflows/build-3mf.yml`** — una GitHub Action installa OpenSCAD,
  recupera il font, genera i `.3mf` e li rende scaricabili come *artifact*.

## 1) Aggiungi il font

Metti il file in `fonts/waltograph.ttf`. Non è incluso nel repo per motivi di
licenza (uso personale). Dettagli in [`fonts/README.md`](fonts/README.md).

## 2a) Genera i file su GitHub (senza installare nulla)

1. Imposta il segreto `WALTOGRAPH_URL` con l'URL diretto al `.ttf`
   (*Settings → Secrets and variables → Actions*), **oppure** committa tu il
   font in `fonts/`.
2. Vai su **Actions → Build 3MF name tags → Run workflow**.
3. (Opzionale) inserisci i nomi separati da virgola, es. `Mario, Anna, Luca`.
   Se lasci vuoto usa l'elenco in `names.txt`.
4. A fine esecuzione scarica l'artifact **`name-tags-3mf`**: dentro trovi un
   `.3mf` per ogni nome.

## 2b) Genera i file in locale

Requisiti: [OpenSCAD](https://openscad.org/downloads.html) e `fontconfig`.

```bash
# Tutti i nomi elencati in names.txt
./generate.sh

# Oppure nomi specifici
./generate.sh "Mario" "Anna" "Luca"
```

I file finiscono nella cartella `output/`.

## Personalizzazione

- **Nomi:** modifica `names.txt` (uno per riga) oppure passali come argomenti.
- **Aspetto:** apri `name_tag.scad` e regola `Font_Size`, `Text_Height`,
  `Plate_Height`, `Border_Size`, il contorno azzurro (`Base_Outline_*`), ecc.
- **Più righe:** puoi anche override da riga di comando, es.
  `openscad -o out.3mf -D 'Line1_Text="Mario"' -D 'Line2_Text="2024"' name_tag.scad`

## Nota sui colori nel `.3mf`

Il modello usa `color()` per bianco/azzurro/lilla. Se il colore venga scritto o
meno nel `.3mf` dipende dalla versione di OpenSCAD. In ogni caso la geometria è
corretta e stampabile: nello slicer puoi assegnare i colori per parte o per
altezza (change filament) per ottenere l'effetto multicolore.

## Nota sulla licenza del font

Waltograph è **freeware per uso personale**. Rispetta i termini della tua copia:
non ridistribuire il `.ttf` in progetti pubblici se la licenza non lo consente.
