#!/bin/bash
set -Eeuo pipefail
umask 0027

readonly ESPOCRM_ROOT='/var/www/html'
readonly EXTENSION_MANIFEST='/opt/marcsmusic-outreach-extension/manifest.json'
readonly EXTENSION_PACKAGE='/opt/marcsmusic-outreach-extension.zip'
readonly EXPECTED_PACKAGE_DIGEST_FILE='/opt/marcsmusic-outreach-extension.sha256'
readonly EXTENSION_VERSION_FILE="${ESPOCRM_ROOT}/custom/Espo/Modules/MarcsMusicOutreach/Resources/version.json"
readonly DEPLOYMENT_VERSION_FILE="${ESPOCRM_ROOT}/data/marcsmusic-outreach-extension-version"
readonly DEPLOYMENT_DIGEST_FILE="${ESPOCRM_ROOT}/data/marcsmusic-outreach-extension-sha256"
readonly TRANSITION_STATE_FILE="${ESPOCRM_ROOT}/data/marcsmusic-outreach-extension-transition.json"

manifest_value() {
  local key="$1"

  php -r '
    $manifest = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
    $value = $manifest[$argv[2]] ?? null;

    if (!is_string($value) || $value === "") {
        fwrite(STDERR, "Missing extension manifest value: {$argv[2]}\n");
        exit(1);
    }

    fwrite(STDOUT, $value);
  ' "$EXTENSION_MANIFEST" "$key"
}

read_digest() {
  local path="$1"
  local value

  [ -r "$path" ] || return 1
  value="$(tr -d '\r\n' < "$path")"
  [[ "$value" =~ ^[a-f0-9]{64}$ ]] || return 1
  printf '%s' "$value"
}

read_deployment_version() {
  local value

  [ -r "$DEPLOYMENT_VERSION_FILE" ] || return 1
  value="$(tr -d '\r\n' < "$DEPLOYMENT_VERSION_FILE")"
  [[ "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || return 1
  printf '%s' "$value"
}

json_version_equals() {
  local path="$1"
  local expected_version="$2"

  [ -r "$path" ] || return 1

  php -r '
    try {
        $document = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
        $version = $document["version"] ?? null;
        exit(is_string($version) && hash_equals($argv[2], $version) ? 0 : 1);
    } catch (Throwable) {
        exit(1);
    }
  ' "$path" "$expected_version"
}

deployment_version_equals() {
  local expected_version="$1"
  local actual_version

  actual_version="$(read_deployment_version)" || return 1
  [ "$actual_version" = "$expected_version" ]
}

deployment_version_is_newer_than() {
  local expected_version="$1"
  local actual_version

  actual_version="$(read_deployment_version)" || return 1

  php -r '
    exit(version_compare($argv[1], $argv[2], ">") ? 0 : 1);
  ' "$actual_version" "$expected_version"
}

deployment_digest_equals() {
  local expected_digest="$1"
  local actual_digest

  actual_digest="$(read_digest "$DEPLOYMENT_DIGEST_FILE")" || return 1
  [ "$actual_digest" = "$expected_digest" ]
}

package_digest_equals() {
  local expected_digest="$1"
  local actual_digest

  actual_digest="$(php -r 'echo hash_file("sha256", $argv[1]);' "$EXTENSION_PACKAGE")"
  [ "$actual_digest" = "$expected_digest" ]
}

transition_equals() {
  local expected_version="$1"
  local expected_digest="$2"

  [ -r "$TRANSITION_STATE_FILE" ] || return 1

  php -r '
    try {
        $state = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
        $version = $state["version"] ?? null;
        $digest = $state["sha256"] ?? null;
        exit(
            is_string($version) && hash_equals($argv[2], $version) &&
            is_string($digest) && hash_equals($argv[3], $digest)
                ? 0
                : 1
        );
    } catch (Throwable) {
        exit(1);
    }
  ' "$TRANSITION_STATE_FILE" "$expected_version" "$expected_digest"
}

installed_extension_equals() {
  local expected_name="$1"
  local expected_version="$2"
  local extension_list

  extension_list="$(bin/command extension -l)" || return 1

  awk -v expected_name="$expected_name" -v expected_version="$expected_version" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }

    /^[[:space:]]*Name[[:space:]]*:/ {
      name = trim(substr($0, index($0, ":") + 1))
    }

    /^[[:space:]]*Version[[:space:]]*:/ {
      version = trim(substr($0, index($0, ":") + 1))
    }

    /^[[:space:]]*Installed[[:space:]]*:/ {
      installed = tolower(trim(substr($0, index($0, ":") + 1)))

      if (name == expected_name && version == expected_version &&
          (installed == "yes" || installed == "true" || installed == "1")) {
        found = 1
      }
    }

    END { exit found ? 0 : 1 }
  ' <<< "$extension_list"
}

schema_is_complete() {
  php /usr/local/bin/espocrm-assert-outreach-schema >/dev/null 2>&1
}

payload_is_complete() {
  php /usr/local/bin/espocrm-validate-runtime-config assert-payload >/dev/null 2>&1
}

write_owned_file() {
  local destination="$1"
  local content="$2"
  local temporary_file

  temporary_file="$(mktemp "${destination}.tmp.XXXXXX")"
  trap 'rm -f "$temporary_file"' RETURN
  printf '%s\n' "$content" > "$temporary_file"
  chown www-data:www-data "$temporary_file"
  chmod 0660 "$temporary_file"
  mv -f "$temporary_file" "$destination"
  trap - RETURN
}

write_transition_state() {
  local version="$1"
  local digest="$2"
  local document

  document="$(php -r '
    echo json_encode(
        ["version" => $argv[1], "sha256" => $argv[2]],
        JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES,
    );
  ' "$version" "$digest")"
  write_owned_file "$TRANSITION_STATE_FILE" "$document"
}

write_deployment_state() {
  local version="$1"
  local digest="$2"

  # The version file is the commit marker and is intentionally written last.
  write_owned_file "$DEPLOYMENT_DIGEST_FILE" "$digest"
  write_owned_file "$DEPLOYMENT_VERSION_FILE" "$version"
  rm -f "$TRANSITION_STATE_FILE"
}

assert_deployment_state_is_well_formed() {
  local has_version='false'
  local has_digest='false'
  local state_file

  for state_file in \
    "$DEPLOYMENT_VERSION_FILE" \
    "$DEPLOYMENT_DIGEST_FILE" \
    "$TRANSITION_STATE_FILE"; do
    if [ -L "$state_file" ] || { [ -e "$state_file" ] && [ ! -f "$state_file" ]; }; then
      echo >&2 "error: Invalid outreach deployment state path ${state_file}."
      return 1
    fi
  done

  [ ! -e "$DEPLOYMENT_VERSION_FILE" ] || has_version='true'
  [ ! -e "$DEPLOYMENT_DIGEST_FILE" ] || has_digest='true'

  if [ "$has_version" != "$has_digest" ]; then
    if [ "$has_version" = 'false' ] && [ -e "$TRANSITION_STATE_FILE" ]; then
      read_digest "$DEPLOYMENT_DIGEST_FILE" >/dev/null || {
        echo >&2 'error: Outreach transition digest state is malformed.'
        return 1
      }
      return 0
    fi

    echo >&2 'error: Outreach deployment version and digest state are not paired.'
    return 1
  fi

  if [ "$has_version" = 'true' ]; then
    read_deployment_version >/dev/null || {
      echo >&2 'error: Outreach deployment version state is malformed.'
      return 1
    }
    read_digest "$DEPLOYMENT_DIGEST_FILE" >/dev/null || {
      echo >&2 'error: Outreach deployment digest state is malformed.'
      return 1
    }
  fi
}

check_current() {
  local extension_name="$1"
  local expected_version="$2"
  local expected_digest="$3"

  if ! deployment_version_equals "$expected_version"; then
    return 3
  fi

  if ! deployment_digest_equals "$expected_digest"; then
    echo >&2 'error: Same-version outreach package drift detected; bump the extension version.'
    return 1
  fi

  if [ -e "$TRANSITION_STATE_FILE" ]; then
    if transition_equals "$expected_version" "$expected_digest"; then
      return 3
    fi

    echo >&2 'error: Outreach transition state conflicts with a committed deployment.'
    return 1
  fi

  if ! json_version_equals "$EXTENSION_VERSION_FILE" "$expected_version"; then
    echo >&2 'error: Outreach deployment state is current but its code version has drifted.'
    return 1
  fi

  if ! installed_extension_equals "$extension_name" "$expected_version"; then
    echo >&2 'error: Outreach deployment state is current but the EspoCRM extension registry has drifted.'
    return 1
  fi

  if ! payload_is_complete; then
    echo >&2 'error: Outreach deployment state is current but its installed payload has drifted.'
    return 1
  fi

  if ! schema_is_complete; then
    echo >&2 'error: Outreach deployment state is current but its database schema has drifted.'
    return 1
  fi
}

finish_transition() {
  local extension_name="$1"
  local extension_version="$2"
  local package_digest="$3"

  bin/command rebuild
  php /usr/local/bin/espocrm-assert-outreach-schema

  if ! json_version_equals "$EXTENSION_VERSION_FILE" "$extension_version"; then
    echo >&2 'error: Outreach extension version marker does not match the installed package.'
    return 1
  fi

  if ! installed_extension_equals "$extension_name" "$extension_version"; then
    echo >&2 'error: Outreach extension is absent from the EspoCRM extension registry.'
    return 1
  fi

  php /usr/local/bin/espocrm-validate-runtime-config assert-payload

  write_deployment_state "$extension_version" "$package_digest"
}

reconcile() {
  local extension_name="$1"
  local extension_version="$2"
  local package_digest="$3"

  if check_current "$extension_name" "$extension_version" "$package_digest"; then
    echo >&2 "info: ${extension_name} ${extension_version} is already deployed."
    return 0
  else
    local check_status=$?
    [ "$check_status" -eq 3 ] || return "$check_status"
  fi

  if [ -e "$TRANSITION_STATE_FILE" ]; then
    if ! transition_equals "$extension_version" "$package_digest"; then
      echo >&2 'error: Outreach transition belongs to another version or package digest.'
      return 1
    fi

    echo >&2 "info: Resuming verified ${extension_name} transition to ${extension_version}."

    if ! json_version_equals "$EXTENSION_VERSION_FILE" "$extension_version" ||
        ! installed_extension_equals "$extension_name" "$extension_version" ||
        ! payload_is_complete; then
      bin/command extension --file="$EXTENSION_PACKAGE"
    fi

    finish_transition "$extension_name" "$extension_version" "$package_digest"
    return 0
  fi

  if json_version_equals "$EXTENSION_VERSION_FILE" "$extension_version" ||
      installed_extension_equals "$extension_name" "$extension_version"; then
    echo >&2 'error: Refusing to adopt an untracked same-version outreach installation.'
    return 1
  fi

  echo >&2 "info: Applying ${extension_name} version transition to ${extension_version}."
  write_transition_state "$extension_version" "$package_digest"
  bin/command extension --file="$EXTENSION_PACKAGE"
  finish_transition "$extension_name" "$extension_version" "$package_digest"
}

main() {
  local mode="${1:-}"

  cd "$ESPOCRM_ROOT"

  if [ ! -x bin/command ]; then
    echo >&2 'error: EspoCRM CLI is unavailable.'
    return 1
  fi

  if [ ! -r "$EXTENSION_MANIFEST" ] || [ ! -r "$EXTENSION_PACKAGE" ] ||
      [ ! -r "$EXPECTED_PACKAGE_DIGEST_FILE" ]; then
    echo >&2 'error: The versioned outreach extension package is unavailable.'
    return 1
  fi

  local extension_name
  local extension_version
  local package_digest
  extension_name="$(manifest_value name)"
  extension_version="$(manifest_value version)"

  if ! [[ "$extension_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
    echo >&2 'error: Outreach extension manifest version is invalid.'
    return 1
  fi

  package_digest="$(read_digest "$EXPECTED_PACKAGE_DIGEST_FILE")" || {
    echo >&2 'error: The expected outreach package digest is malformed.'
    return 1
  }

  if ! package_digest_equals "$package_digest"; then
    echo >&2 'error: The outreach package does not match its image-build digest.'
    return 1
  fi

  assert_deployment_state_is_well_formed

  if [ -e "$DEPLOYMENT_VERSION_FILE" ] &&
      deployment_version_is_newer_than "$extension_version"; then
    echo >&2 'error: Outreach extension downgrade is forbidden without a tested down-migration.'
    return 1
  fi

  case "$mode" in
    check)
      check_current "$extension_name" "$extension_version" "$package_digest"
      ;;
    reconcile)
      reconcile "$extension_name" "$extension_version" "$package_digest"
      ;;
    *)
      echo >&2 'Usage: install-outreach-extension <check|reconcile>'
      return 64
      ;;
  esac
}

main "$@"
