#!/usr/bin/env bash
set -euo pipefail

# This script applies the reviewed native SMTP fork patch. It is intentionally
# fail-closed: a changed upstream ref, changed source fingerprint, dirty
# checkout or incomplete patch aborts before modifying anything.

die() {
  printf '%s\n' "plunk-mxroute: $*" >&2
  exit 78
}

sha256_file() {
  local file=$1
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    die "no SHA-256 utility available (need sha256sum or shasum)"
  fi
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
  actual_sha=$(sha256_file "$file")
  [[ "$actual_sha" == "$expected_sha" ]] || \
    die "$relative_path differs from the reviewed source; refuse an unreviewed patch"
done <<'EOF'
apps/api/src/services/SESService.ts c280ac8bbf974cb914dfaedbe2fce1f36a85bc4500ecf9db2d1e364f7356af0e
apps/api/src/app/constants.ts 254116651a244ad903f8df4039070bf57d3f9ed4e9344275b160dbd8fc80d71f
apps/api/src/jobs/email-processor.ts ea4aed3b2ef67052f14335bca887c4127ff8f25c2301d9c684c3180c0a97dc4c
EOF

if [[ -n "$(git -C "$SOURCE_ROOT" status --short)" ]]; then
  die "source checkout has local changes; use a clean checkout before applying the fork"
fi

# The upstream example contains non-production placeholder credentials.  Blank
# those values before applying our patch so the reviewed patch itself never
# stores or reintroduces credentials in Git.  Real Railway secrets are supplied
# at runtime and are never read from this source tree.
EXAMPLE_ENV="$SOURCE_ROOT/.env.self-host.example"
[[ -f "$EXAMPLE_ENV" ]] || die "pinned source is missing $EXAMPLE_ENV"
SANITIZED_ENV=$(mktemp "$SOURCE_ROOT/.env.self-host.example.XXXXXX") || die "cannot create temporary sanitized env file"
awk '
  /^(DB_PASSWORD|MINIO_ROOT_PASSWORD|S3_ACCESS_KEY_SECRET)=/ {
    sub(/=.*/, "=")
  }
  { print }
' "$EXAMPLE_ENV" > "$SANITIZED_ENV"
if ! cmp -s "$EXAMPLE_ENV" "$SANITIZED_ENV"; then
  chmod 0644 "$SANITIZED_ENV"
  mv "$SANITIZED_ENV" "$EXAMPLE_ENV"
else
  rm -f "$SANITIZED_ENV"
fi

PATCH_FILE="$SCRIPT_DIR/patches/0001-mxroute-native-starttls.patch"
[[ -f "$PATCH_FILE" ]] || die "reviewed MXRoute patch is missing"
git -C "$SOURCE_ROOT" apply --check "$PATCH_FILE" || die "MXRoute patch does not apply cleanly"
git -C "$SOURCE_ROOT" apply "$PATCH_FILE" || die "failed to apply reviewed MXRoute patch"
git -C "$SOURCE_ROOT" diff --check || die "patched source contains whitespace errors"

[[ ! -e "$SOURCE_ROOT/apps/api/src/services/SESService.ts" ]] || die "SESService still exists after patch"
for runtime_path in \
  "$SOURCE_ROOT/apps/api/src/app" \
  "$SOURCE_ROOT/apps/api/src/controllers" \
  "$SOURCE_ROOT/apps/api/src/jobs" \
  "$SOURCE_ROOT/apps/api/src/services"/*.ts \
  "$SOURCE_ROOT/apps/api/package.json"; do
  [[ -f "$runtime_path" || -d "$runtime_path" ]] || continue
  if [[ -d "$runtime_path" ]]; then
    if find "$runtime_path" -type f -not -path '*/__tests__/*' -print0 | xargs -0 grep --line-number --fixed-strings '@aws-sdk/client-ses' >/dev/null 2>&1; then
      die "AWS SES runtime reference remains after patch"
    fi
  elif grep --line-number --fixed-strings '@aws-sdk/client-ses' "$runtime_path" >/dev/null 2>&1; then
    die "AWS SES runtime reference remains after patch"
  fi
done
for required in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_SECURE; do
  grep -q "export const $required" "$SOURCE_ROOT/apps/api/src/app/constants.ts" || \
    die "patched constants do not define $required"
done

printf '%s\n' "plunk-mxroute: applied pinned native STARTTLS patch at $ACTUAL_REF"
