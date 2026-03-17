#!/usr/bin/env bash
set -euo pipefail

# Build a minimal release artifact from apps/web/webapp:
# - keep only currently referenced bundles/<hash> directories
# - exclude source maps (*.map)
# - keep runtime/static assets needed by Element at runtime

SRC_DIR="${1:-webapp}"
OUT_DIR="${2:-webapp_release}"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "ERROR: source dir not found: $SRC_DIR" >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# 1) Copy full tree once (without source maps), then prune stale bundle hashes.
rsync -a --delete \
  --exclude='*.map' \
  "$SRC_DIR"/ "$OUT_DIR"/

# 2) Detect active bundle hash directories referenced by html/json/js entry files.
mapfile -t ACTIVE_HASHES < <(
  rg -o "bundles/[a-f0-9]{20,}" \
    "$SRC_DIR"/*.html \
    "$SRC_DIR"/*.json \
    "$SRC_DIR"/*.js \
    "$SRC_DIR"/mobile_guide/*.html \
    "$SRC_DIR"/widgets/element-call/*.html \
    2>/dev/null \
  | sed -E 's#^bundles/##' \
  | sort -u
)

KEEP_SET="$(printf '%s\n' "${ACTIVE_HASHES[@]:-}" | sed '/^$/d' | tr '\n' ' ')"

if [[ -d "$OUT_DIR/bundles" ]]; then
  shopt -s nullglob
  for dir in "$OUT_DIR"/bundles/*; do
    base="$(basename "$dir")"
    if [[ " $KEEP_SET " != *" $base "* ]]; then
      rm -rf "$dir"
    fi
  done
  shopt -u nullglob
fi

echo "DONE: minimal release prepared"
echo "SRC: $SRC_DIR"
echo "OUT: $OUT_DIR"
du -sh "$SRC_DIR" "$OUT_DIR"
find "$OUT_DIR" -type f | wc -l | awk '{print "FILES:", $1}'

