#!/bin/bash
set -Eeuo pipefail
umask 0027

readonly ESPOCRM_ROOT='/var/www/html'
readonly DATABASE_STATE_COMMAND='/usr/local/bin/espocrm-database-state'
readonly CONFIG_VALIDATOR='/usr/local/bin/espocrm-validate-runtime-config'
readonly EXTENSION_INSTALLER='/usr/local/bin/install-outreach-extension'
readonly ADVISORY_LOCK_RUNNER='/usr/local/bin/with-mysql-advisory-lock'
readonly RUNTIME_WATCHDOG='/usr/local/bin/run-espocrm-watchdog'
readonly RUNTIME_ATTESTATION='/usr/local/bin/espocrm-runtime-attestation'
readonly DEPLOYMENT_ATTESTATION_VALIDATOR='/usr/local/bin/espocrm-validate-deployment-attestation'
readonly FLOCK='/usr/bin/flock'
readonly MAINTENANCE_FILE="${ESPOCRM_ROOT}/data/marcsmusic-runtime-maintenance"
readonly DAEMON_STOPPED_ACK_FILE="${ESPOCRM_ROOT}/data/marcsmusic-daemon-stopped"
readonly WATCHDOG_STOPPED_ACK_FILE="${ESPOCRM_ROOT}/data/marcsmusic-watchdog-stopped"

runtime_maintenance_token=''
runtime_image_contract=''
runtime_previous_contract=''

reset_apache_mpm() {
  rm -f /etc/apache2/mods-enabled/mpm_*.load
  rm -f /etc/apache2/mods-enabled/mpm_*.conf
  ln -sf ../mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load
  ln -sf ../mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf
}

normalize_owned_tree() {
  local path="$1"
  local allowed_root="$2"

  if [ ! -e "$path" ]; then
    return 0
  fi

  if [ -L "$path" ]; then
    echo >&2 "error: Refusing symbolic link at writable EspoCRM path ${path}."
    return 1
  fi

  local resolved_path
  local resolved_root
  resolved_path="$(readlink -f "$path")"
  resolved_root="$(readlink -f "$allowed_root")"

  case "$resolved_path" in
    "$resolved_root"/*) ;;
    *)
      echo >&2 "error: Writable EspoCRM path ${path} escapes its allowed root."
      return 1
      ;;
  esac

  find "$path" -xdev \( -type d -o -type f \) \
    -exec chown www-data:www-data {} +
}

normalize_espocrm_runtime_permissions() {
  normalize_owned_tree \
    "$ESPOCRM_ROOT/data/cache" \
    "$ESPOCRM_ROOT/data"
  normalize_owned_tree \
    "$ESPOCRM_ROOT/custom/Espo/Modules/MarcsMusicOutreach" \
    "$ESPOCRM_ROOT/custom"
  normalize_owned_tree \
    "$ESPOCRM_ROOT/client/custom/modules/marcsmusic-outreach" \
    "$ESPOCRM_ROOT/client/custom"

  local state_file

  for state_file in \
    "$ESPOCRM_ROOT/data/marcsmusic-outreach-extension-version" \
    "$ESPOCRM_ROOT/data/marcsmusic-outreach-extension-sha256" \
    "$ESPOCRM_ROOT/data/marcsmusic-outreach-extension-transition.json" \
    "$ESPOCRM_ROOT/data/marcsmusic-runtime-contract.sha256" \
    "$ESPOCRM_ROOT/data/marcsmusic-runtime-attestation.json"; do
    if [ -L "$state_file" ] || { [ -e "$state_file" ] && [ ! -f "$state_file" ]; }; then
      echo >&2 "error: Invalid outreach deployment state path ${state_file}."
      return 1
    fi

    [ ! -f "$state_file" ] || chown www-data:www-data "$state_file"
  done
}

enter_runtime_maintenance() {
  local expects_daemon="${ESPOCRM_EXPECT_EXTERNAL_DAEMON:-auto}"
  local expects_watchdog="${ESPOCRM_EXPECT_EXTERNAL_WATCHDOG:-auto}"
  local timeout="${ESPOCRM_DAEMON_STOP_TIMEOUT_SECONDS:-60}"
  local temporary_file
  local attempt
  local peer_is_active='false'
  local railway_singleton='false'

  if [ "$expects_daemon" != 'true' ] && [ "$expects_daemon" != 'false' ] &&
      [ "$expects_daemon" != 'auto' ]; then
    echo >&2 'error: ESPOCRM_EXPECT_EXTERNAL_DAEMON must be true, false, or auto.'
    return 1
  fi

  if [ "$expects_watchdog" != 'true' ] && [ "$expects_watchdog" != 'false' ] &&
      [ "$expects_watchdog" != 'auto' ]; then
    echo >&2 'error: ESPOCRM_EXPECT_EXTERNAL_WATCHDOG must be true, false, or auto.'
    return 1
  fi

  if ! [[ "$timeout" =~ ^[0-9]+$ ]] || [ "$timeout" -lt 1 ] || [ "$timeout" -gt 120 ]; then
    echo >&2 'error: ESPOCRM_DAEMON_STOP_TIMEOUT_SECONDS must be from 1 through 120.'
    return 1
  fi

  if [ -n "${RAILWAY_ENVIRONMENT_ID:-}" ] &&
      [ "${RAILWAY_VOLUME_MOUNT_PATH:-}" = '/var/www/persistent' ]; then
    railway_singleton='true'
  fi

  if [ -L "$MAINTENANCE_FILE" ] || [ -L "$DAEMON_STOPPED_ACK_FILE" ] ||
      [ -L "$WATCHDOG_STOPPED_ACK_FILE" ] ||
      { [ -e "$MAINTENANCE_FILE" ] && [ ! -f "$MAINTENANCE_FILE" ]; } ||
      { [ -e "$DAEMON_STOPPED_ACK_FILE" ] && [ ! -f "$DAEMON_STOPPED_ACK_FILE" ]; } ||
      { [ -e "$WATCHDOG_STOPPED_ACK_FILE" ] && [ ! -f "$WATCHDOG_STOPPED_ACK_FILE" ]; }; then
    echo >&2 'error: Invalid EspoCRM runtime-coordination path.'
    return 1
  fi

  if ! [[ "$runtime_image_contract" =~ ^[a-f0-9]{64}$ ]]; then
    echo >&2 'error: Runtime image contract is unavailable before maintenance.'
    return 1
  fi

  if ! [[ "$runtime_previous_contract" =~ ^[a-f0-9]{64}$ ]]; then
    echo >&2 'error: Previous runtime deployment contract is unavailable before maintenance.'
    return 1
  fi

  if [ "$railway_singleton" = 'true' ]; then
    if [ "$expects_daemon" = 'true' ] || [ "$expects_watchdog" = 'true' ]; then
      echo >&2 'error: Railway single-volume startup cannot require external shared-volume peers.'
      return 1
    fi

    # Railway never mounts an attached volume into old and new deployments at
    # the same time. A persisted signed lease can therefore only be stale here.
    expects_daemon='false'
    expects_watchdog='false'
  else
    if php "$RUNTIME_ATTESTATION" assert-peer-active "$runtime_previous_contract" \
        >/dev/null 2>&1; then
      peer_is_active='true'
    fi

    if [ "$expects_daemon" = 'auto' ]; then
      expects_daemon="$peer_is_active"
    elif [ "$expects_daemon" = 'false' ] && [ "$peer_is_active" = 'true' ]; then
      echo >&2 'error: An attested runtime peer is active; bypassing its daemon acknowledgement is forbidden.'
      return 1
    fi

    if [ "$expects_watchdog" = 'auto' ]; then
      expects_watchdog="$peer_is_active"
    elif [ "$expects_watchdog" = 'false' ] && [ "$peer_is_active" = 'true' ]; then
      echo >&2 'error: An attested runtime peer is active; bypassing its watchdog acknowledgement is forbidden.'
      return 1
    fi
  fi

  runtime_maintenance_token="$(php -r 'echo bin2hex(random_bytes(16));')"
  temporary_file="$(mktemp "${MAINTENANCE_FILE}.tmp.XXXXXX")"
  trap 'rm -f "$temporary_file"' RETURN
  printf '%s\n' "$runtime_maintenance_token" > "$temporary_file"
  chown www-data:www-data "$temporary_file"
  chmod 0660 "$temporary_file"
  mv -f "$temporary_file" "$MAINTENANCE_FILE"
  trap - RETURN

  for ((attempt = 1; attempt <= timeout; attempt++)); do
    local daemon_stopped='false'
    local watchdog_stopped='false'
    local expected_ack="${runtime_maintenance_token}:${runtime_previous_contract}"

    if [ -L "$DAEMON_STOPPED_ACK_FILE" ] || [ -L "$WATCHDOG_STOPPED_ACK_FILE" ] ||
        { [ -e "$DAEMON_STOPPED_ACK_FILE" ] && [ ! -f "$DAEMON_STOPPED_ACK_FILE" ]; } ||
        { [ -e "$WATCHDOG_STOPPED_ACK_FILE" ] && [ ! -f "$WATCHDOG_STOPPED_ACK_FILE" ]; }; then
      echo >&2 'error: Runtime acknowledgement path became invalid.'
      return 1
    fi

    if [ "$expects_daemon" = 'false' ] ||
        { [ -f "$DAEMON_STOPPED_ACK_FILE" ] &&
          [ "$(tr -d '\r\n' < "$DAEMON_STOPPED_ACK_FILE")" = "$expected_ack" ]; }; then
      daemon_stopped='true'
    fi

    if [ "$expects_watchdog" = 'false' ] ||
        { [ -f "$WATCHDOG_STOPPED_ACK_FILE" ] &&
          [ "$(tr -d '\r\n' < "$WATCHDOG_STOPPED_ACK_FILE")" = "$expected_ack" ]; }; then
      watchdog_stopped='true'
    fi

    if [ "$daemon_stopped" = 'true' ] && [ "$watchdog_stopped" = 'true' ]; then
      if [ "$railway_singleton" = 'false' ] &&
          [ "$expects_daemon" = 'false' ] && [ "$expects_watchdog" = 'false' ] &&
          [ "$attempt" -le 5 ]; then
        # Give an unattested but maintenance-aware peer a bounded discovery
        # window. If either peer appears, both acknowledgements become required.
        if { [ -f "$DAEMON_STOPPED_ACK_FILE" ] &&
             [ "$(tr -d '\r\n' < "$DAEMON_STOPPED_ACK_FILE")" = "$expected_ack" ]; } ||
           { [ -f "$WATCHDOG_STOPPED_ACK_FILE" ] &&
             [ "$(tr -d '\r\n' < "$WATCHDOG_STOPPED_ACK_FILE")" = "$expected_ack" ]; }; then
          expects_daemon='true'
          expects_watchdog='true'
        else
          sleep 1
          continue
        fi
      fi

      return 0
    fi

    sleep 1
  done

  echo >&2 'error: Shared EspoCRM runtime processes did not acknowledge maintenance mode.'
  return 1
}

initialize_runtime_contract() {
  local deployment_contract_path="${ESPOCRM_ROOT}/data/marcsmusic-runtime-contract.sha256"

  runtime_image_contract="$(php "$RUNTIME_ATTESTATION" image-contract)"

  if [ -L "$deployment_contract_path" ] ||
      { [ -e "$deployment_contract_path" ] && [ ! -f "$deployment_contract_path" ]; }; then
    echo >&2 'error: Runtime deployment contract path is invalid.'
    return 1
  fi

  if [ -f "$deployment_contract_path" ]; then
    runtime_previous_contract="$(tr -d '\r\n' < "$deployment_contract_path")"
  else
    # A new volume has no peer to quiesce. Establish the image identity before
    # the Compose daemon/watchdog siblings start and attempt acknowledgement.
    php "$RUNTIME_ATTESTATION" write-deployment-contract
    runtime_previous_contract="$runtime_image_contract"
  fi

  if ! [[ "$runtime_image_contract" =~ ^[a-f0-9]{64}$ ]] ||
      ! [[ "$runtime_previous_contract" =~ ^[a-f0-9]{64}$ ]]; then
    echo >&2 'error: Runtime deployment contract is malformed.'
    return 1
  fi
}

leave_runtime_maintenance() {
  local actual_token

  if [ -z "$runtime_maintenance_token" ] || [ ! -f "$MAINTENANCE_FILE" ] ||
      [ -L "$MAINTENANCE_FILE" ] || [ -L "$DAEMON_STOPPED_ACK_FILE" ] ||
      [ -L "$WATCHDOG_STOPPED_ACK_FILE" ] ||
      { [ -e "$DAEMON_STOPPED_ACK_FILE" ] && [ ! -f "$DAEMON_STOPPED_ACK_FILE" ]; } ||
      { [ -e "$WATCHDOG_STOPPED_ACK_FILE" ] && [ ! -f "$WATCHDOG_STOPPED_ACK_FILE" ]; }; then
    echo >&2 'error: EspoCRM runtime maintenance ownership was lost.'
    return 1
  fi

  actual_token="$(tr -d '\r\n' < "$MAINTENANCE_FILE")"

  if [ "$actual_token" != "$runtime_maintenance_token" ]; then
    echo >&2 'error: Another process replaced the EspoCRM runtime maintenance token.'
    return 1
  fi

  rm -f \
    "$MAINTENANCE_FILE" \
    "$DAEMON_STOPPED_ACK_FILE" \
    "$WATCHDOG_STOPPED_ACK_FILE"
  runtime_maintenance_token=''
}

write_root_layout_marker() {
  local destination="$1"
  local content="$2"
  local temporary_file

  if [ -L "$destination" ] || { [ -e "$destination" ] && [ ! -f "$destination" ]; }; then
    echo >&2 "error: Persistent layout marker is invalid: ${destination}."
    return 1
  fi

  temporary_file="$(mktemp "${destination}.tmp.XXXXXX")"
  trap 'rm -f "$temporary_file"' RETURN
  printf '%s\n' "$content" > "$temporary_file"
  chown root:root "$temporary_file"
  chmod 0440 "$temporary_file"
  sync -f "$temporary_file"
  mv -f "$temporary_file" "$destination"
  sync -f "$(dirname "$destination")"
  trap - RETURN
}

commit_pending_persistent_layout() {
  local mount_path="${RAILWAY_VOLUME_MOUNT_PATH:-}"

  [ -n "$mount_path" ] || return 0

  local pending_marker="${mount_path}/.marcsmusic-layout-restore-pending"
  local complete_marker="${mount_path}/.marcsmusic-layout-v1"

  if [ ! -e "$pending_marker" ]; then
    return 0
  fi

  if [ -L "$pending_marker" ] || [ ! -f "$pending_marker" ] ||
      [ "$(tr -d '\r\n' < "$pending_marker")" != 'layout-v1:restore-validation-pending' ]; then
    echo >&2 'error: Persistent restore-validation marker is invalid.'
    return 1
  fi

  write_root_layout_marker "$complete_marker" 'layout-v1:restored-and-validated'
  rm -f "$pending_marker"
  sync -f "$mount_path"
}

configure_railway_persistent_layout() {
  local mount_path="${RAILWAY_VOLUME_MOUNT_PATH:-}"

  if [ -z "$mount_path" ]; then
    if [ -n "${RAILWAY_ENVIRONMENT_ID:-}" ]; then
      echo >&2 'error: Railway EspoCRM deployments require a durable volume mounted at /var/www/persistent.'
      return 1
    fi

    return 0
  fi

  if [ "$mount_path" != '/var/www/persistent' ]; then
    echo >&2 'error: The Railway EspoCRM volume must be mounted at /var/www/persistent.'
    return 1
  fi

  if ! awk -v expected="$mount_path" '
      $2 == expected { found = 1 }
      END { exit found ? 0 : 1 }
    ' /proc/mounts; then
    echo >&2 'error: RAILWAY_VOLUME_MOUNT_PATH is set but no matching mount is active.'
    return 1
  fi

  if [ ! -d "$mount_path" ] || [ -L "$mount_path" ]; then
    echo >&2 'error: The Railway EspoCRM volume mount is not a real directory.'
    return 1
  fi

  if [ ! -x "$FLOCK" ]; then
    echo >&2 'error: flock is required to serialize persistent-layout initialization.'
    return 1
  fi

  local layout_lock_timeout="${ESPOCRM_LAYOUT_LOCK_TIMEOUT_SECONDS:-120}"
  local layout_lock_path="${mount_path}/.marcsmusic-layout.lock"
  local layout_lock_fd

  if ! [[ "$layout_lock_timeout" =~ ^[0-9]+$ ]] ||
      [ "$layout_lock_timeout" -lt 1 ] || [ "$layout_lock_timeout" -gt 600 ]; then
    echo >&2 'error: ESPOCRM_LAYOUT_LOCK_TIMEOUT_SECONDS must be from 1 through 600.'
    return 1
  fi

  if [ -L "$layout_lock_path" ] ||
      { [ -e "$layout_lock_path" ] && [ ! -f "$layout_lock_path" ]; }; then
    echo >&2 'error: Persistent-layout lock path is invalid.'
    return 1
  fi

  exec {layout_lock_fd}>"$layout_lock_path"
  "$FLOCK" --exclusive --timeout "$layout_lock_timeout" "$layout_lock_fd" || {
    echo >&2 'error: Timed out waiting for the persistent-layout lock.'
    return 1
  }

  chown root:www-data "$mount_path"
  chmod 0750 "$mount_path"

  local -a source_paths=('data' 'custom' 'client/custom')
  local -a persistent_paths=('data' 'custom' 'client-custom')
  local bootstrap_marker="${mount_path}/.marcsmusic-layout-bootstrap-in-progress"
  local bootstrap_stage="${mount_path}/.marcsmusic-layout-bootstrap-stage"
  local restore_pending_marker="${mount_path}/.marcsmusic-layout-restore-pending"
  local complete_marker="${mount_path}/.marcsmusic-layout-v1"
  local existing_path_count=0
  local layout_mode=''
  local index
  local marker
  local persistent_name

  for marker in "$bootstrap_marker" "$restore_pending_marker" "$complete_marker"; do
    if [ -L "$marker" ] || { [ -e "$marker" ] && [ ! -f "$marker" ]; }; then
      echo >&2 "error: Persistent layout marker is invalid: ${marker}."
      return 1
    fi
  done

  if [ -e "$bootstrap_marker" ]; then
    echo >&2 'error: A previous Railway persistent-layout bootstrap was interrupted.'
    echo >&2 'error: Verify or replace the incomplete volume explicitly; partial copies are never adopted.'
    return 1
  fi

  if [ -L "$bootstrap_stage" ] || [ -e "$bootstrap_stage" ]; then
    echo >&2 'error: A persistent-layout bootstrap stage already exists.'
    echo >&2 'error: Verify or replace the incomplete volume explicitly; staged copies are never adopted.'
    return 1
  fi

  for persistent_name in "${persistent_paths[@]}"; do
    local candidate="${mount_path}/${persistent_name}"

    if [ -L "$candidate" ] || { [ -e "$candidate" ] && [ ! -d "$candidate" ]; }; then
      echo >&2 "error: Persistent EspoCRM path is invalid: ${candidate}."
      return 1
    fi

    [ ! -d "$candidate" ] || existing_path_count=$((existing_path_count + 1))
  done

  if [ -f "$complete_marker" ]; then
    case "$(tr -d '\r\n' < "$complete_marker")" in
      layout-v1:bootstrap|layout-v1:restored-and-validated) ;;
      *)
        echo >&2 'error: Persistent layout completion marker is malformed.'
        return 1
        ;;
    esac

    [ "$existing_path_count" -eq 3 ] || {
      echo >&2 'error: A sealed persistent layout is missing one or more required trees.'
      return 1
    }
    layout_mode='sealed'
  elif [ "$existing_path_count" -eq 0 ]; then
    [ ! -e "$restore_pending_marker" ] || {
      echo >&2 'error: Restore validation is pending but its persistent trees are absent.'
      return 1
    }
    layout_mode='bootstrap'
    write_root_layout_marker "$bootstrap_marker" 'layout-v1:bootstrap-in-progress'
  elif [ "$existing_path_count" -eq 3 ]; then
    layout_mode='restored'
    write_root_layout_marker "$restore_pending_marker" 'layout-v1:restore-validation-pending'
  else
    echo >&2 'error: Railway persistent layout is only partially populated.'
    return 1
  fi

  if [ "$layout_mode" = 'bootstrap' ]; then
    mkdir "$bootstrap_stage"
    chown root:root "$bootstrap_stage"
    chmod 0700 "$bootstrap_stage"

    for index in "${!source_paths[@]}"; do
      local source_path="${ESPOCRM_ROOT}/${source_paths[$index]}"
      local staged_path="${bootstrap_stage}/${persistent_paths[$index]}"

      if [ ! -d "$source_path" ] || [ -L "$source_path" ] ||
          [ -n "$(find "$source_path" -type l -print -quit)" ]; then
        echo >&2 "error: Image-owned EspoCRM source tree is invalid: ${source_path}."
        return 1
      fi

      mkdir "$staged_path"
      cp -a "${source_path}/." "${staged_path}/"
      diff --brief --recursive --no-dereference "$source_path" "$staged_path"
      find "$staged_path" -xdev \( -type d -o -type f \) \
        -exec chown www-data:www-data {} +
    done

    # `sync -f` issues syncfs for the volume containing the stage. The durable
    # in-progress marker fences every crash point before the completion marker.
    sync -f "$bootstrap_stage"

    for persistent_name in "${persistent_paths[@]}"; do
      mv \
        "${bootstrap_stage}/${persistent_name}" \
        "${mount_path}/${persistent_name}"
    done

    rmdir "$bootstrap_stage"
    sync -f "$mount_path"
  fi

  for index in "${!source_paths[@]}"; do
    local source_path="${ESPOCRM_ROOT}/${source_paths[$index]}"
    local persistent_path="${mount_path}/${persistent_paths[$index]}"

    if [ -L "$persistent_path" ]; then
      echo >&2 "error: Refusing symbolic link at persistent EspoCRM path ${persistent_path}."
      return 1
    fi

    if [ ! -d "$persistent_path" ]; then
      echo >&2 "error: Persistent EspoCRM path ${persistent_path} is not a directory."
      return 1
    fi

    if [ -n "$(find "$persistent_path" -xdev -type l -print -quit)" ]; then
      echo >&2 "error: Persistent EspoCRM tree contains a symbolic link: ${persistent_path}."
      return 1
    fi

    if [ ! -L "$source_path" ] ||
        [ "$(readlink -f "$source_path" 2>/dev/null || true)" != "$persistent_path" ]; then
      rm -rf "$source_path"
      mkdir -p "$(dirname "$source_path")"
      ln -s "$persistent_path" "$source_path"
    fi

    chown www-data:www-data "$persistent_path"

    chmod 0770 "$persistent_path"
  done

  if [ "$layout_mode" = 'bootstrap' ]; then
    sync -f "$mount_path"
    write_root_layout_marker "$complete_marker" 'layout-v1:bootstrap'
    rm -f "$bootstrap_marker"
    sync -f "$mount_path"
  fi

  "$FLOCK" --unlock "$layout_lock_fd"
  exec {layout_lock_fd}>&-
}

normalize_railway_persistent_permissions() {
  local mount_path="${RAILWAY_VOLUME_MOUNT_PATH:-}"

  if [ -z "$mount_path" ]; then
    return 0
  fi

  chown root:www-data "$mount_path"
  chmod 0750 "$mount_path"

  local persistent_path

  for persistent_path in \
    "$mount_path/data" \
    "$mount_path/custom" \
    "$mount_path/client-custom"; do
    if [ ! -d "$persistent_path" ] || [ -L "$persistent_path" ]; then
      echo >&2 "error: Persistent EspoCRM path ${persistent_path} is not a real directory."
      return 1
    fi

    chown www-data:www-data "$persistent_path"
    chmod 0770 "$persistent_path"
  done

  find "$mount_path/data" -maxdepth 1 -type f \
    \( -name 'config*.php' -o -name 'state.php' -o -name 'marcsmusic-outreach-extension-*' \) \
    -exec chown www-data:www-data {} +

  for path in \
    "$mount_path/data/cache" \
    "$mount_path/custom/Espo/Modules/MarcsMusicOutreach" \
    "$mount_path/client-custom/modules/marcsmusic-outreach"; do
    if [ -L "$path" ]; then
      echo >&2 "error: Refusing symbolic link at writable EspoCRM path ${path}."
      return 1
    fi

    if [ -e "$path" ]; then
      local resolved_path
      resolved_path="$(readlink -f "$path")"

      case "$resolved_path" in
        "$mount_path"/*) ;;
        *)
          echo >&2 "error: Writable EspoCRM path ${path} escapes the persistent volume."
          return 1
          ;;
      esac

      find "$path" -xdev \( -type d -o -type f \) \
        -exec chown www-data:www-data {} +
    fi
  done
}

resolve_secret() {
  local variable_name="$1"
  local file_variable_name="${variable_name}_FILE"
  local direct_value="${!variable_name-}"
  local file_path="${!file_variable_name-}"

  if [ -n "$direct_value" ] && [ -n "$file_path" ]; then
    echo >&2 "error: Both ${variable_name} and ${file_variable_name} are set."
    return 1
  fi

  if [ -n "$file_path" ]; then
    if [ ! -r "$file_path" ]; then
      echo >&2 "error: Secret file for ${variable_name} is not readable."
      return 1
    fi

    direct_value="$(< "$file_path")"
  fi

  if [ -z "$direct_value" ]; then
    echo >&2 "error: Required secret ${variable_name} is missing."
    return 1
  fi

  if [[ "$direct_value" == *$'\n'* ]] || [ "${#direct_value}" -gt 4096 ]; then
    echo >&2 "error: Secret ${variable_name} has an invalid format."
    return 1
  fi

  printf -v "$variable_name" '%s' "$direct_value"
  export "$variable_name"
  unset "$file_variable_name"
}

require_environment() {
  local variable_name="$1"

  if [ -z "${!variable_name-}" ]; then
    echo >&2 "error: Required environment variable ${variable_name} is missing."
    return 1
  fi
}

validate_stable_secret_policy() {
  if [ "${#ESPOCRM_CONFIG_PASSWORD_SALT}" -lt 16 ]; then
    echo >&2 'error: ESPOCRM_CONFIG_PASSWORD_SALT must contain at least 16 characters.'
    return 1
  fi

  if [ "${#ESPOCRM_CONFIG_CRYPT_KEY}" -lt 32 ] ||
      [ "${#ESPOCRM_CONFIG_HASH_SECRET_KEY}" -lt 32 ]; then
    echo >&2 'error: EspoCRM crypt and hash secrets must contain at least 32 characters.'
    return 1
  fi

  if [ "$ESPOCRM_CONFIG_PASSWORD_SALT" = "$ESPOCRM_CONFIG_CRYPT_KEY" ] ||
      [ "$ESPOCRM_CONFIG_PASSWORD_SALT" = "$ESPOCRM_CONFIG_HASH_SECRET_KEY" ] ||
      [ "$ESPOCRM_CONFIG_CRYPT_KEY" = "$ESPOCRM_CONFIG_HASH_SECRET_KEY" ]; then
    echo >&2 'error: EspoCRM stable secrets must be independent values.'
    return 1
  fi
}

validate_environment() {
  resolve_secret ESPOCRM_DATABASE_PASSWORD
  resolve_secret ESPOCRM_CONFIG_PASSWORD_SALT
  resolve_secret ESPOCRM_CONFIG_CRYPT_KEY
  resolve_secret ESPOCRM_CONFIG_HASH_SECRET_KEY

  require_environment ESPOCRM_DATABASE_HOST
  require_environment ESPOCRM_DATABASE_INSTANCE_ID
  require_environment ESPOCRM_DATABASE_NAME
  require_environment ESPOCRM_DATABASE_USER
  require_environment ESPOCRM_SITE_URL
  require_environment ESPOCRM_VERSION

  ESPOCRM_DATABASE_PLATFORM="${ESPOCRM_DATABASE_PLATFORM:-Mysql}"
  ESPOCRM_DATABASE_PORT="${ESPOCRM_DATABASE_PORT:-3306}"
  export ESPOCRM_DATABASE_PLATFORM ESPOCRM_DATABASE_PORT

  if ! [[ "$ESPOCRM_DATABASE_PORT" =~ ^[0-9]{1,5}$ ]] ||
      [ "$ESPOCRM_DATABASE_PORT" -lt 1 ] ||
      [ "$ESPOCRM_DATABASE_PORT" -gt 65535 ]; then
    echo >&2 'error: ESPOCRM_DATABASE_PORT must be a valid TCP port.'
    return 1
  fi

  if ! [[ "$ESPOCRM_DATABASE_INSTANCE_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$ ]]; then
    echo >&2 'error: ESPOCRM_DATABASE_INSTANCE_ID must be a stable non-secret database service identity.'
    return 1
  fi

  validate_stable_secret_policy
  php "$CONFIG_VALIDATOR" assert-environment
}

wait_for_database() {
  local attempts="${ESPOCRM_DATABASE_CONNECT_ATTEMPTS:-12}"
  local delay=1
  local attempt
  local state
  local status

  if ! [[ "$attempts" =~ ^[0-9]+$ ]] || [ "$attempts" -lt 1 ] || [ "$attempts" -gt 30 ]; then
    echo >&2 'error: ESPOCRM_DATABASE_CONNECT_ATTEMPTS must be an integer from 1 through 30.'
    return 1
  fi

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    set +e
    state="$(php "$DATABASE_STATE_COMMAND")"
    status=$?
    set -e

    if [ "$status" -eq 0 ]; then
      printf '%s' "$state"
      return 0
    fi

    if [ "$status" -eq 78 ]; then
      echo >&2 'error: Refusing to use a partial or foreign EspoCRM database schema.'
      return 1
    fi

    if [ "$attempt" -eq "$attempts" ]; then
      break
    fi

    echo >&2 "info: Waiting for the EspoCRM database (attempt ${attempt}/${attempts})."
    sleep "$delay"
    delay=$((delay * 2))
    [ "$delay" -le 15 ] || delay=15
  done

  echo >&2 'error: EspoCRM database did not become ready before the startup deadline.'
  return 1
}

wait_for_database_connection() {
  local attempts="${ESPOCRM_DATABASE_CONNECT_ATTEMPTS:-12}"
  local delay=1
  local attempt

  if ! [[ "$attempts" =~ ^[0-9]+$ ]] || [ "$attempts" -lt 1 ] || [ "$attempts" -gt 30 ]; then
    echo >&2 'error: ESPOCRM_DATABASE_CONNECT_ATTEMPTS must be an integer from 1 through 30.'
    return 1
  fi

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if php -r '
      require "/opt/marcsmusic/runtime.php";
      $statement = marcsmusic_database_connection()->query("SELECT 1");
      exit($statement !== false && (int) $statement->fetchColumn() === 1 ? 0 : 1);
    ' >/dev/null 2>&1; then
      return 0
    fi

    if [ "$attempt" -eq "$attempts" ]; then
      break
    fi

    echo >&2 "info: Waiting for the EspoCRM database connection (attempt ${attempt}/${attempts})."
    sleep "$delay"
    delay=$((delay * 2))
    [ "$delay" -le 15 ] || delay=15
  done

  echo >&2 'error: EspoCRM database did not become reachable before the startup deadline.'
  return 1
}

config_state() {
  php "$CONFIG_VALIDATOR" state
}

set_stable_config_values() {
  bin/command config:set passwordSalt "$ESPOCRM_CONFIG_PASSWORD_SALT"
  bin/command config:set cryptKey "$ESPOCRM_CONFIG_CRYPT_KEY"
  bin/command config:set hashSecretKey "$ESPOCRM_CONFIG_HASH_SECRET_KEY"
}

prepare_fresh_install() {
  local state="$1"

  if [ "$state" = 'installed' ]; then
    echo >&2 'error: Refusing to install into an empty database while persisted EspoCRM config is installed.'
    return 1
  fi

  resolve_secret ESPOCRM_ADMIN_PASSWORD

  ESPOCRM_ADMIN_USERNAME="${ESPOCRM_ADMIN_USERNAME:-admin}"
  export ESPOCRM_ADMIN_USERNAME

  if [ "$ESPOCRM_ADMIN_USERNAME" != 'admin' ]; then
    echo >&2 'error: EspoCRM 10.0.2 fresh installation requires ESPOCRM_ADMIN_USERNAME=admin.'
    return 1
  fi

  if [ "${#ESPOCRM_ADMIN_PASSWORD}" -lt 16 ]; then
    echo >&2 'error: ESPOCRM_ADMIN_PASSWORD must contain at least 16 characters for a fresh install.'
    return 1
  fi

  echo >&2 'info: Preparing deterministic configuration for a fresh EspoCRM install.'
  bin/command config:populate
  set_stable_config_values
}

prepare_configuration() {
  local database_state="$1"
  local state
  state="$(config_state)"

  case "${database_state}:${state}" in
    fresh:missing|fresh:uninstalled)
      prepare_fresh_install "$state"
      ;;
    fresh:installed)
      prepare_fresh_install "$state"
      ;;
    existing:installed)
      php "$CONFIG_VALIDATOR" assert-runtime
      ;;
    existing:missing|existing:uninstalled)
      echo >&2 'error: Existing EspoCRM schema requires its original persistent data/config.php and data/config-internal.php.'
      echo >&2 'error: Restore the EspoCRM data volume; automatic cryptographic identity reconstruction is forbidden.'
      return 1
      ;;
    *)
      echo >&2 'error: Unsupported EspoCRM database/configuration state.'
      return 1
      ;;
  esac
}

validate_mutating_deployment_evidence() {
  local database_state="$1"
  local extension_status
  local installed_version

  [ "$database_state" = 'existing' ] || return 0

  installed_version="$(php "$CONFIG_VALIDATOR" version)"

  set +e
  "$EXTENSION_INSTALLER" check >/dev/null 2>&1
  extension_status=$?
  set -e

  case "$extension_status" in
    0)
      if [ "$installed_version" = "$ESPOCRM_VERSION" ]; then
        return 0
      fi
      ;;
    3)
      ;;
    *)
      echo >&2 'error: Existing outreach extension state is inconsistent before deployment.'
      return 1
      ;;
  esac

  ESPOCRM_MUTATION_SOURCE_VERSION="$installed_version" \
    php "$DEPLOYMENT_ATTESTATION_VALIDATOR"
  export ESPOCRM_INTERNAL_MUTATION_EVIDENCE_VALIDATED=true
}

run_official_entrypoint() {
  # EspoCRM 10 owns the install/migrate lifecycle. `true` prevents it from
  # starting a second process before this deployment finishes its checks.
  # Stable identity values are validated and persisted explicitly; excluding
  # them here prevents the official generic --type=auto config import from
  # ever coercing a numeric-looking secret to a non-string value.
  env \
    -u ESPOCRM_CONFIG_PASSWORD_SALT \
    -u ESPOCRM_CONFIG_CRYPT_KEY \
    -u ESPOCRM_CONFIG_HASH_SECRET_KEY \
    docker-entrypoint.sh true
}

finalize_fresh_install() {
  local database_state="$1"

  if [ "$database_state" != 'fresh' ]; then
    return 0
  fi

  # The stable password salt is authoritative, so re-apply the password after
  # the official installer has persisted all environment-backed config values.
  printf '%s\n' "$ESPOCRM_ADMIN_PASSWORD" |
    bin/command set-password "$ESPOCRM_ADMIN_USERNAME" >/dev/null
}

reconcile_outreach_extension() {
  local check_status
  local lock_timeout="${ESPOCRM_EXTENSION_LOCK_TIMEOUT_SECONDS:-120}"
  local lock_name

  if ! [[ "$lock_timeout" =~ ^[0-9]+$ ]] ||
      [ "$lock_timeout" -lt 1 ] || [ "$lock_timeout" -gt 600 ]; then
    echo >&2 'error: ESPOCRM_EXTENSION_LOCK_TIMEOUT_SECONDS must be from 1 through 600.'
    return 1
  fi

  lock_name="$(php -r '
    echo "marcsmusic:outreach:" . substr(
        hash("sha256", $argv[1] . "\0" . $argv[2]),
        0,
        24,
    );
  ' "$ESPOCRM_DATABASE_INSTANCE_ID" "$ESPOCRM_DATABASE_NAME")"

  set +e
  "$EXTENSION_INSTALLER" check
  check_status=$?
  set -e

  case "$check_status" in
    0)
      return 0
      ;;
    3)
      php "$ADVISORY_LOCK_RUNNER" \
        "$lock_name" \
        "$lock_timeout" \
        "$EXTENSION_INSTALLER" reconcile
      ;;
    *)
      echo >&2 'error: Outreach extension deployment state is inconsistent.'
      return 1
      ;;
  esac
}

locked_bootstrap() {
  local expected_contract="$1"
  local active_contract

  cd "$ESPOCRM_ROOT"

  if ! [[ "$expected_contract" =~ ^[a-f0-9]{64}$ ]]; then
    echo >&2 'error: Bootstrap fencing contract is malformed.'
    return 64
  fi

  active_contract="$(php "$RUNTIME_ATTESTATION" deployment-contract)"

  if [ "$active_contract" != "$expected_contract" ]; then
    echo >&2 'error: Runtime deployment contract changed while waiting for the bootstrap lock.'
    return 75
  fi

  if [ ! -x bin/command ]; then
    echo >&2 'error: EspoCRM 10 CLI is unavailable in the image.'
    return 1
  fi

  local database_state
  database_state="$(wait_for_database)"
  validate_mutating_deployment_evidence "$database_state"
  prepare_configuration "$database_state"
  run_official_entrypoint
  finalize_fresh_install "$database_state"
  unset ESPOCRM_ADMIN_PASSWORD ESPOCRM_ADMIN_PASSWORD_FILE
  php "$CONFIG_VALIDATOR" assert-ready
  reconcile_outreach_extension
  php "$CONFIG_VALIDATOR" assert-ready
  normalize_espocrm_runtime_permissions
  normalize_railway_persistent_permissions

  # This is the deployment commit point. The global MySQL lock remains held
  # while the persistent runtime identity and its first health attestation are
  # committed, so a contender cannot classify an intermediate state.
  php "$RUNTIME_ATTESTATION" write-deployment-contract
  "$RUNTIME_WATCHDOG" once
  commit_pending_persistent_layout
}

run_locked_bootstrap() {
  local lock_timeout="${ESPOCRM_DEPLOYMENT_LOCK_TIMEOUT_SECONDS:-600}"
  local lock_name

  if ! [[ "$lock_timeout" =~ ^[0-9]+$ ]] ||
      [ "$lock_timeout" -lt 1 ] || [ "$lock_timeout" -gt 600 ]; then
    echo >&2 'error: ESPOCRM_DEPLOYMENT_LOCK_TIMEOUT_SECONDS must be from 1 through 600.'
    return 1
  fi

  lock_name="$(php -r '
    echo "marcsmusic:espocrm:" . substr(
        hash("sha256", $argv[1] . "\0" . $argv[2]),
        0,
        24,
    );
  ' "$ESPOCRM_DATABASE_INSTANCE_ID" "$ESPOCRM_DATABASE_NAME")"

  php "$ADVISORY_LOCK_RUNNER" \
    "$lock_name" \
    "$lock_timeout" \
    "$0" __locked-bootstrap "$runtime_previous_contract"
}

main() {
  unset ESPOCRM_INTERNAL_MUTATION_EVIDENCE_VALIDATED ESPOCRM_MUTATION_SOURCE_VERSION

  if [ "$(id -u)" != '0' ]; then
    echo >&2 'error: EspoCRM bootstrap must start as root before dropping runtime privileges.'
    return 77
  fi

  if [ "${1:-}" = '__locked-bootstrap' ]; then
    [ "$#" -eq 2 ] || {
      echo >&2 'error: Invalid internal bootstrap invocation.'
      return 64
    }

    locked_bootstrap "$2"
    return
  fi

  if [ "$#" -eq 0 ]; then
    echo >&2 'error: No EspoCRM runtime command was supplied.'
    return 64
  fi

  reset_apache_mpm
  validate_environment
  configure_railway_persistent_layout
  cd "$ESPOCRM_ROOT"
  initialize_runtime_contract
  enter_runtime_maintenance

  if [ ! -x bin/command ]; then
    echo >&2 'error: EspoCRM 10 CLI is unavailable in the image.'
    return 1
  fi

  wait_for_database_connection
  run_locked_bootstrap
  unset ESPOCRM_ADMIN_PASSWORD ESPOCRM_ADMIN_PASSWORD_FILE
  reset_apache_mpm
  leave_runtime_maintenance

  exec "$@"
}

main "$@"
