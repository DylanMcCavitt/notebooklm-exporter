#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/dist"
mkdir -p "$OUT"
cd "$ROOT"
ZIP_OUT="$OUT/notebooklm-exporter.zip"
rm -f "$ZIP_OUT"
zip -r -9 "$ZIP_OUT" manifest.json src \
  -x "src/scripts/*" "*.map" "*.md" "*/.DS_Store" "__MACOSX/*" "dist/*" "node_modules/*" ".git/*"
echo "Packed → $ZIP_OUT"
