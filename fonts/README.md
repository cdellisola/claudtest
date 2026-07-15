# Cartella dei font

Metti qui il file del font Waltograph con **questo nome esatto**:

```
fonts/waltograph.ttf
```

Lo `.scad` lo carica con `use <fonts/waltograph.ttf>` e lo script `generate.sh`
rileva automaticamente il nome-famiglia interno (es. "Waltograph UI").

## Perché il font non è incluso nel repo

Waltograph è **freeware solo per uso personale**: la ridistribuzione dentro un
repository pubblico è una zona grigia dal punto di vista della licenza. Per
questo il file `.ttf` **non è committato** qui. Devi procurartelo tu e metterlo
in questa cartella.

## Come fornirlo alla GitHub Action

Hai due possibilità:

1. **Segreto del repository (consigliato):** crea un segreto chiamato
   `WALTOGRAPH_URL` con l'URL diretto al file `.ttf`. La Action lo scarica in
   automatico prima di generare i modelli.
   (Settings → Secrets and variables → Actions → New repository secret)

2. **Committarlo tu manualmente** in `fonts/waltograph.ttf` (se la licenza della
   tua copia lo consente per il tuo uso).

Se nessuna delle due è presente, i `.3mf` vengono comunque generati ma con un
font di ripiego (non Waltograph).

## Verificare il nome-famiglia del font

```bash
fc-scan --format '%{family[0]}\n' fonts/waltograph.ttf
# oppure, dentro OpenSCAD:  Help → Font List
```
