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
HAS_OVERRIDES=0

# Iterate remaining positional args (do not use "${arr[@]}" on an empty array with `set -u`).
for arg; do
  case "${arg}" in
    --overrides|--overrides=*)
      HAS_OVERRIDES=1
      break
      ;;
  esac
done

EXTRA_ARGS=("$@")

mkdir -p "${OUTPUT_DIR}"
if [ ! -f "${DEFAULT_OVERRIDES}" ]; then
  printf '{\n  "slots": {}\n}\n' > "${DEFAULT_OVERRIDES}"
fi

if [ "${HAS_OVERRIDES}" -eq 0 ]; then
  EXTRA_ARGS+=(--overrides "${DEFAULT_OVERRIDES}")
fi

# JSON goes to stdout only (start-brand-review parses it). Hints go to stderr.
set +e
"${SCRIPT_DIR}/webcrawler/scripts/run-webcrawler.sh" brand \
  "${URL}" \
  --brand-id "${BRAND_ID}" \
  --out-dir "${OUTPUT_DIR}" \
  "${EXTRA_ARGS[@]}"
exit_code=$?
set -e

if [ "${exit_code}" -eq 0 ] && [ -z "${STOREFRONT_BRANDING_REVIEW_SESSION:-}" ]; then
  cat >&2 <<EOF

---
Preview files were written (see JSON above). This script does not start a server.

  Full review UI (Save overrides, Regenerate, Apply to storefront):
    ./.agents/skills/storefront-branding/scripts/start-brand-review.sh "${URL}" "${BRAND_ID}"

  Or open the generated page locally (preview-only; limited actions):
    ${OUTPUT_DIR}/preview.html
EOF
fi

exit "${exit_code}"
