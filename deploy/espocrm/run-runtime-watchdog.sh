#!/bin/bash
set -Eeuo pipefail
umask 0027

readonly ESPOCRM_ROOT='/var/www/html'
readonly MAINTENANCE_FILE="${ESPOCRM_ROOT}/data/marcsmusic-runtime-maintenance"
readonly STOPPED_ACK_FILE="${ESPOCRM_ROOT}/data/marcsmusic-watchdog-stopped"
readonly DEPLOYMENT_CONTRACT_FILE="${ESPOCRM_ROOT}/data/marcsmusic-runtime-contract.sha256"
readonly ATTESTATION_COMMAND='/usr/local/bin/espocrm-runtime-attestation'
readonly CONFIG_VALIDATOR='/usr/local/bin/espocrm-validate-runtime-config'
readonly EXTENSION_INSTALLER='/usr/local/bin/install-outreach-extension'
readonly TIMEOUT='/usr/bin/timeout'
readonly SETPRIV='/usr/bin/setpriv'

drop_runtime_privileges() {
  local current_uid
  current_uid="$(id -u)"

  if [ "$current_uid" = '0' ]; then
    [ -x "$SETPRIV" ] || {
      echo >&2 'error: setpriv is required to drop EspoCRM watchdog privileges.'
      return 69
    }

    exec "$SETPRIV" \
      --reuid=www-data \
      --regid=www-data \
      --init-groups \
      --inh-caps=-all \
      --ambient-caps=-all \
      --bounding-set=-all \
      --no-new-privs \
      -- "$0" "$@"
  fi

  if [ "$current_uid" != "$(id -u www-data)" ]; then
    echo >&2 'error: EspoCRM watchdog must run as www-data.'
    return 77
  fi
}

drop_runtime_privileges "$@"

assert_runtime_sandbox() {
  local field
  local value

  for field in CapInh CapPrm CapEff CapBnd CapAmb; do
    value="$(awk -v key="${field}:" '$1 == key { print $2 }' /proc/self/status)"

    if ! [[ "$value" =~ ^0+$ ]]; then
      echo >&2 "error: EspoCRM watchdog sandbox retained Linux capability field ${field}."
      return 77
    fi
  done

  value="$(awk '$1 == "NoNewPrivs:" { print $2 }' /proc/self/status)"

  if [ "$value" != '1' ]; then
    echo >&2 'error: EspoCRM watchdog sandbox requires NoNewPrivs.'
    return 77
  fi
}

assert_runtime_sandbox

if [ -n "${ESPOCRM_ADMIN_PASSWORD:-}" ]; then
  echo >&2 'error: Bootstrap administrator password must not reach the long-lived watchdog.'
  exit 78
fi
unset ESPOCRM_ADMIN_PASSWORD_FILE

remove_attestation() {
  php "$ATTESTATION_COMMAND" remove >/dev/null 2>&1 || true
}

write_stopped_ack() {
  [ -e "$MAINTENANCE_FILE" ] || return 0

  if [ ! -f "$MAINTENANCE_FILE" ] || [ -L "$MAINTENANCE_FILE" ] ||
      [ -L "$STOPPED_ACK_FILE" ] ||
      { [ -e "$STOPPED_ACK_FILE" ] && [ ! -f "$STOPPED_ACK_FILE" ]; } ||
      [ ! -f "$DEPLOYMENT_CONTRACT_FILE" ] || [ -L "$DEPLOYMENT_CONTRACT_FILE" ]; then
    echo >&2 'error: Invalid EspoCRM runtime-coordination path.'
    return 78
  fi

  local token
  local previous_contract
  local temporary_file
  token="$(tr -d '\r\n' < "$MAINTENANCE_FILE")"
  [[ "$token" =~ ^[a-f0-9]{32}$ ]] || return 78
  previous_contract="$(tr -d '\r\n' < "$DEPLOYMENT_CONTRACT_FILE")"
  [[ "$previous_contract" =~ ^[a-f0-9]{64}$ ]] || return 78

  temporary_file="$(mktemp "${STOPPED_ACK_FILE}.tmp.XXXXXX")"
  trap 'rm -f "$temporary_file"' RETURN
  printf '%s:%s\n' "$token" "$previous_contract" > "$temporary_file"
  chmod 0660 "$temporary_file"
  mv -f "$temporary_file" "$STOPPED_ACK_FILE"
  trap - RETURN
}

deep_check() {
  cd "$ESPOCRM_ROOT"

  php "$ATTESTATION_COMMAND" assert-deployment-contract || return 1
  php "$CONFIG_VALIDATOR" assert-ready || return 1
  php -r '
    require "/opt/marcsmusic/runtime.php";
    $statement = marcsmusic_database_connection()->query("SELECT 1");
    exit($statement !== false && (int) $statement->fetchColumn() === 1 ? 0 : 1);
  ' || return 1
  "$EXTENSION_INSTALLER" check || return 1
  bin/command app-check || return 1
  php "$ATTESTATION_COMMAND" write || return 1
}

run_once() {
  local deadline="${ESPOCRM_RUNTIME_WATCHDOG_DEADLINE_SECONDS:-45}"

  if ! [[ "$deadline" =~ ^[0-9]+$ ]] || [ "$deadline" -lt 15 ] || [ "$deadline" -gt 120 ]; then
    echo >&2 'error: ESPOCRM_RUNTIME_WATCHDOG_DEADLINE_SECONDS must be from 15 through 120.'
    return 64
  fi

  if "$TIMEOUT" --kill-after=5s "${deadline}s" "$0" deep-check; then
    return 0
  fi

  remove_attestation
  echo >&2 'error: EspoCRM runtime attestation check failed.'
  return 1
}

run_loop() {
  local interval="${ESPOCRM_RUNTIME_WATCHDOG_INTERVAL_SECONDS:-60}"
  local max_age="${ESPOCRM_RUNTIME_ATTESTATION_MAX_AGE_SECONDS:-150}"
  local deadline="${ESPOCRM_RUNTIME_WATCHDOG_DEADLINE_SECONDS:-45}"
  local waited

  if ! [[ "$interval" =~ ^[0-9]+$ ]] || [ "$interval" -lt 30 ] || [ "$interval" -gt 300 ]; then
    echo >&2 'error: ESPOCRM_RUNTIME_WATCHDOG_INTERVAL_SECONDS must be from 30 through 300.'
    return 64
  fi

  if ! [[ "$deadline" =~ ^[0-9]+$ ]] || [ "$deadline" -lt 15 ] || [ "$deadline" -gt 120 ]; then
    echo >&2 'error: ESPOCRM_RUNTIME_WATCHDOG_DEADLINE_SECONDS must be from 15 through 120.'
    return 64
  fi

  if ! [[ "$max_age" =~ ^[0-9]+$ ]] || [ "$max_age" -lt 15 ] ||
      [ "$max_age" -gt 900 ] || [ "$max_age" -lt $((interval + deadline + 15)) ]; then
    echo >&2 'error: Attestation max age must be 15-900 seconds and cover interval + deadline + 15.'
    return 64
  fi

  trap 'remove_attestation; exit 143' TERM INT

  while true; do
    if [ -L "$MAINTENANCE_FILE" ] || [ -L "$STOPPED_ACK_FILE" ] ||
        { [ -e "$MAINTENANCE_FILE" ] && [ ! -f "$MAINTENANCE_FILE" ]; } ||
        { [ -e "$STOPPED_ACK_FILE" ] && [ ! -f "$STOPPED_ACK_FILE" ]; } ||
        [ ! -f "$DEPLOYMENT_CONTRACT_FILE" ] || [ -L "$DEPLOYMENT_CONTRACT_FILE" ]; then
      remove_attestation
      echo >&2 'error: Runtime coordination path is symbolic.'
      return 78
    fi

    if [ -e "$MAINTENANCE_FILE" ]; then
      remove_attestation
      write_stopped_ack
      while [ -e "$MAINTENANCE_FILE" ]; do
        if [ -L "$MAINTENANCE_FILE" ] || [ -L "$STOPPED_ACK_FILE" ]; then
          remove_attestation
          echo >&2 'error: Runtime coordination path became symbolic.'
          return 78
        fi
        sleep 1
      done
      rm -f "$STOPPED_ACK_FILE"
      continue
    elif ! run_once; then
      rm -f "$STOPPED_ACK_FILE"
      # Exit fail-closed. Railway supervises this process together with Apache
      # and the daemon; Compose restarts this service while the shared daemon
      # independently drains itself when readiness loses the attestation.
      return 1
    else
      rm -f "$STOPPED_ACK_FILE"
    fi

    for ((waited = 0; waited < interval; waited++)); do
      [ ! -e "$MAINTENANCE_FILE" ] || break
      sleep 1
    done
  done
}

case "${1:-}" in
  deep-check)
    deep_check
    ;;
  once)
    run_once
    ;;
  loop)
    run_loop
    ;;
  *)
    echo >&2 'Usage: run-espocrm-watchdog <deep-check|once|loop>'
    exit 64
    ;;
esac
