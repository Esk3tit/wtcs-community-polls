#!/usr/bin/env bash
# .planning/closure/audit-mobile.sh — UIDN-02 Lighthouse mobile audit harness
# Phase 9 / v1.1 / Issue #18.
# Re-runnable: edit BASE_URL / ROUTES / THRESHOLDS below; nothing else.
#
# Audits 5 production routes (D-05) for Perf/A11y/BP/SEO scores.
# Does NOT fail-fast — runs all routes, accumulates failures, exits non-zero
# at end if any threshold missed (D-14 ship-anyway analog applies; document
# overage in UIDN-02 evidence file rather than re-run until pass).

set -uo pipefail

BASE_URL="https://polls.wtcsmapban.com"
ROUTES=(       "/"     "/topics" "/archive" "/auth/error" "/admin"  )
ROUTE_NAMES=(  "home"  "topics"  "archive"  "auth-error"  "admin"   )
THRESHOLD_PERF=90
THRESHOLD_A11Y=95
THRESHOLD_BP=95
THRESHOLD_SEO=90
ARTIFACTS_DIR=".planning/closure/artifacts/lighthouse"

# F7 — clean prior-run artifacts so acceptance count checks aren't
# contaminated by stale files from earlier runs.
rm -rf "$ARTIFACTS_DIR"
mkdir -p "$ARTIFACTS_DIR"
fail_count=0
declare -a results

for i in "${!ROUTES[@]}"; do
  route="${ROUTES[$i]}"
  name="${ROUTE_NAMES[$i]}"
  out="$ARTIFACTS_DIR/lh-mobile-${name}"

  echo ">>> Auditing ${BASE_URL}${route} -> ${out}.report.{html,json}"
  npx -y lighthouse@13.2.0 "${BASE_URL}${route}" \
    --form-factor=mobile \
    --throttling-method=simulate \
    --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox" \
    --output=html --output=json \
    --output-path="$out" \
    --quiet || { echo "  lighthouse exited non-zero on ${route}"; fail_count=$((fail_count+1)); continue; }

  # Lighthouse appends .report.<ext> automatically when multiple outputs are requested.
  perf=$(jq -r '.categories.performance.score * 100 | floor' "${out}.report.json")
  a11y=$(jq -r '.categories.accessibility.score * 100 | floor' "${out}.report.json")
  bp=$(jq -r '."categories"."best-practices".score * 100 | floor' "${out}.report.json")
  seo=$(jq -r '.categories.seo.score * 100 | floor' "${out}.report.json")

  status="PASS"
  if [ "$perf" -lt "$THRESHOLD_PERF" ] || [ "$a11y" -lt "$THRESHOLD_A11Y" ] \
    || [ "$bp" -lt "$THRESHOLD_BP" ] || [ "$seo" -lt "$THRESHOLD_SEO" ]; then
    status="FAIL"
    fail_count=$((fail_count+1))
  fi
  results+=("${status} ${name}: P=${perf} A=${a11y} BP=${bp} SEO=${seo}")
done

echo ""
echo "=== Summary ==="
for r in "${results[@]}"; do echo "  $r"; done
echo "Failed routes: ${fail_count} / ${#ROUTES[@]}"

# F1 / Decision A — update MANIFEST.json with sha256 + size for every Lighthouse
# report file. The manifest IS committed (un-ignored in .gitignore); the binary
# reports themselves are gitignored.
MANIFEST=".planning/closure/artifacts/MANIFEST.json"
mkdir -p "$(dirname "$MANIFEST")"
recordedAt="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[ -f "$MANIFEST" ] || echo '{"entries":[]}' > "$MANIFEST"
tmp="$(mktemp)"

# Prune stale Lighthouse entries from the previous run before upserting current
# files. Without this, deleted/failed routes leave dangling MANIFEST rows
# pointing at files removed by the rm -rf above.
jq --arg dir "$ARTIFACTS_DIR/" '
  .entries = [(.entries // [])[]
    | select(.kind != "lighthouse" or (.path | startswith($dir) | not))]
' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"

for f in "$ARTIFACTS_DIR"/lh-mobile-*.report.html "$ARTIFACTS_DIR"/lh-mobile-*.report.json; do
  [ -f "$f" ] || continue
  sha=$(shasum -a 256 "$f" | awk '{print $1}')
  size=$(wc -c < "$f" | tr -d ' ')
  jq --arg path "$f" --arg sha "$sha" --argjson size "$size" --arg at "$recordedAt" --arg kind "lighthouse" '
    .entries = ((.entries // []) | map(select(.path != $path))) + [{
      path: $path, sha256: $sha, sizeBytes: $size, recordedAt: $at, kind: $kind
    }] | .updatedAt = $at
  ' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
done
echo "Updated $MANIFEST with $(jq '.entries | length' "$MANIFEST") total entries"

[ "$fail_count" -eq 0 ] || exit 1
