#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $(basename "$0") <url> <brand-id> [extra webcrawler brand args...]"
  exit 1
fi

URL="$1"
BRAND_ID="$2"
shift 2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$(pwd)"
OUTPUT_DIR="${TARGET_DIR}/.webcrawler/${BRAND_ID}"
DEFAULT_OVERRIDES="${OUTPUT_DIR}/overrides.json"
EXTRA_ARGS=("$@")
HAS_OVERRIDES=0

for arg in "${EXTRA_ARGS[@]}"; do
  case "${arg}" in
    --overrides|--overrides=*)
      HAS_OVERRIDES=1
      break
      ;;
  esac
done

mkdir -p "${OUTPUT_DIR}"
if [ ! -f "${DEFAULT_OVERRIDES}" ]; then
  printf '{\n  "slots": {}\n}\n' > "${DEFAULT_OVERRIDES}"
fi

if [ "${HAS_OVERRIDES}" -eq 0 ]; then
  EXTRA_ARGS+=(--overrides "${DEFAULT_OVERRIDES}")
fi

"${SCRIPT_DIR}/webcrawler/scripts/run-webcrawler.sh" brand \
  "${URL}" \
  --brand-id "${BRAND_ID}" \
  --out-dir "${OUTPUT_DIR}" \
  "${EXTRA_ARGS[@]}"
