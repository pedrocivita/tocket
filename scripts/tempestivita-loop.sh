#!/usr/bin/env bash
# Oficina helper: close Mapper → Tocket Memory Bank → triage for Tempestivita.
# Does not vendor the mapper. Sibling tool:
#   https://github.com/pedrocivita/appmap-mapper
#
# Mapper (run in that repo):
#   npx tsx src/cli.ts all --url https://tempestivita.civita.dev --smoke
#   # writes out/tempestivita.appmap.json
#
# Then from a Tocket workspace:
#   MAPPER_OUT=../appmap-mapper/out LAST_RUN=path/to/last-run.json ./scripts/tempestivita-loop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${APP:-tempestivita}"
MAPPER_OUT="${MAPPER_OUT:-../appmap-mapper/out}"
LAST_RUN="${LAST_RUN:-}"
DRY="${DRY:-1}"

args=(suite loop --app "$APP" --mapper-out "$MAPPER_OUT")
if [[ -n "$LAST_RUN" ]]; then
  args+=(--last-run "$LAST_RUN")
fi
if [[ "$DRY" != "0" ]]; then
  args+=(--dry-run)
fi

if command -v tocket >/dev/null 2>&1; then
  exec tocket "${args[@]}"
fi
exec node "$ROOT/dist/index.js" "${args[@]}"
