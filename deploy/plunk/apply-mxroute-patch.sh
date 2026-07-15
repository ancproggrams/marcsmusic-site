#!/usr/bin/env bash
set -euo pipefail

# This script is intentionally fail-closed. It is a reproducibility gate for
# the pinned upstream source, not a variable-only SES bypass. A reviewed fork
# patch must replace the explicit refusal below before this is used in CI or a
# Railway Docker build.

die() {
  printf '%s\n' "plunk-mxroute: $*" >&2
  exit 78
}

SOURCE_ROOT=${1:-}
[[ -n "$SOURCE_ROOT" ]] || die "usage: $0 <checked-out-plunk-source>"
[[ -d "$SOURCE_ROOT/.git" ]] || die "source path is not a Git checkout"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
EXPECTED_REF=$(tr -d '[:space:]' < "$SCRIPT_DIR/UPSTREAM_REF")
[[ "$EXPECTED_REF" =~ ^[0-9a-f]{40}$ ]] || die "UPSTREAM_REF is not a full commit SHA"

ACTUAL_REF=$(git -C "$SOURCE_ROOT" rev-parse HEAD 2>/dev/null || true)
[[ "$ACTUAL_REF" == "$EXPECTED_REF" ]] || die "source ref is $ACTUAL_REF; expected pinned Plunk ref"

while IFS=' ' read -r relative_path expected_sha; do
  [[ -n "$relative_path" ]] || continue
  file="$SOURCE_ROOT/$relative_path"
  [[ -f "$file" ]] || die "pinned source is missing $relative_path"
  actual_sha=$(shasum -a 256 "$file" | awk '{print $1}')
  [[ "$actual_sha" == "$expected_sha" ]] || \
    die "$relative_path differs from the reviewed source; refuse an unreviewed patch"
done <<'EOF'
apps/api/src/services/SESService.ts c280ac8bbf974cb914dfaedbe2fce1f36a85bc4500ecf9db2d1e364f7356af0e
apps/api/src/app/constants.ts 254116651a244ad903f8df4039070bf57d3f9ed4e9344275b160dbd8fc80d71f
apps/api/src/jobs/email-processor.ts ea4aed3b2ef67052f14335bca887c4127ff8f25c2301d9c684c3180c0a97dc4c
EOF

# The inspected source has no outbound MXRoute implementation. Refuse to
# claim otherwise until a complete fork patch is reviewed. Keep this check
# after the source fingerprints so a future patch cannot silently run against
# another upstream commit.
cat >&2 <<'EOF'
plunk-mxroute: REFUSED (upstream Plunk outbound delivery is AWS SES)
plunk-mxroute: the pinned source has no SMTP_HOST/SMTP_PORT/SMTP_USER/
plunk-mxroute: SMTP_PASSWORD/SMTP_SECURE outbound transport. apps/smtp is an
plunk-mxroute: inbound relay into /v1/send and does not solve delivery.
plunk-mxroute: supply a reviewed fork patch covering SMTP, domain verification,
plunk-mxroute: quota, timeout-after-DATA reconciliation, and tests before build.
EOF
exit 78
