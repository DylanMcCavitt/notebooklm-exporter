#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist"
mkdir -p "$OUT"
zip -r -9 "$OUT/notebooklm-exporter.zip" . \
  -x "node_modules/*" ".git/*" "dist/*" "*.map" "scripts/*" "*.md"
echo "Packed → $OUT/notebooklm-exporter.zip"
