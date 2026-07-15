#!/usr/bin/env bash
# ===============================================================
#  Genera un file .3mf per ogni nome usando OpenSCAD.
#
#  Uso:
#    ./generate.sh                 # legge i nomi da names.txt
#    ./generate.sh "Mario" "Anna"  # genera i nomi passati come argomenti
#
#  Requisiti: openscad (CLI) + fontconfig (fc-scan, opzionale ma consigliato)
# ===============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCAD="$SCRIPT_DIR/name_tag.scad"
FONT="$SCRIPT_DIR/fonts/waltograph.ttf"
OUT="$SCRIPT_DIR/output"
mkdir -p "$OUT"

if ! command -v openscad >/dev/null 2>&1; then
    echo "ERRORE: 'openscad' non trovato nel PATH. Installalo prima di continuare." >&2
    exit 1
fi

# --- Rileva il nome-famiglia del font (piu' robusto che indovinarlo) ---
FONT_ARGS=()
if [ -f "$FONT" ]; then
    if command -v fc-scan >/dev/null 2>&1; then
        FAMILY="$(fc-scan --format '%{family[0]}\n' "$FONT" 2>/dev/null | head -n1 || true)"
        if [ -n "${FAMILY:-}" ]; then
            FONT_ARGS=(-D "Font_Name=\"$FAMILY\"")
            echo "Font rilevato -> famiglia: '$FAMILY'"
        fi
    fi
    if [ ${#FONT_ARGS[@]} -eq 0 ]; then
        echo "Font trovato ma nome-famiglia non rilevato: uso il default nello .scad."
    fi
else
    echo "ATTENZIONE: '$FONT' non trovato: verra' usato un font di ripiego (NON Waltograph)." >&2
fi

# --- Raccogli i nomi ---
NAMES=()
if [ "$#" -gt 0 ]; then
    NAMES=("$@")
elif [ -f "$SCRIPT_DIR/names.txt" ]; then
    while IFS= read -r line; do
        # salta righe vuote e commenti (#)
        case "$line" in
            ''|'#'*) continue ;;
        esac
        NAMES+=("$line")
    done < "$SCRIPT_DIR/names.txt"
fi

if [ ${#NAMES[@]} -eq 0 ]; then
    echo "Nessun nome da generare (names.txt vuoto e nessun argomento)." >&2
    exit 1
fi

# --- Genera un .3mf per ogni nome ---
for NAME in "${NAMES[@]}"; do
    # nome file sicuro: spazi -> _ , tieni solo alfanumerici/_/-
    SAFE="$(printf '%s' "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_-')"
    [ -z "$SAFE" ] && SAFE="tag"
    echo "-> '$NAME'  =>  output/$SAFE.3mf"
    openscad -o "$OUT/$SAFE.3mf" \
        -D "Line1_Text=\"$NAME\"" \
        ${FONT_ARGS[@]+"${FONT_ARGS[@]}"} \
        "$SCAD"
done

echo "Fatto. File generati in: $OUT"
