#!/bin/bash
set -Eeuo pipefail
umask 0027

readonly ESPOCRM_ROOT='/var/www/html'
readonly MAINTENANCE_FILE="${ESPOCRM_ROOT}/data/marcsmusic-runtime-maintenance"
readonly STOPPED_ACK_FILE="${ESPOCRM_ROOT}/data/marcsmusic-daemon-stopped"
readonly DEPLOYMENT_CONTRACT_FILE="${ESPOCRM_ROOT}/data/marcsmusic-runtime-contract.sha256"
readonly DAEMON_PID_FILE='/tmp/marcsmusic-espocrm-daemon.pid'
readonly READY_URL="${ESPOCRM_WEB_READY_URL:-http://espocrm/readyz.php}"
readonly SETSID='/usr/bin/setsid'
readonly CONFIG_VALIDATOR='/usr/local/bin/espocrm-validate-runtime-config'
readonly EXTENSION_INSTALLER='/usr/local/bin/install-outreach-extension'
readonly RUNTIME_ATTESTATION='/usr/local/bin/espocrm-runtime-attestation'
readonly SETPRIV='/usr/bin/setpriv'

daemon_pid=''

drop_runtime_privileges() {
  local current_uid
  current_uid="$(id -u)"

  if [ "$current_uid" = '0' ]; then
    [ -x "$SETPRIV" ] || {
      echo >&2 'error: setpriv is required to drop EspoCRM daemon privileges.'
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
    echo >&2 'error: EspoCRM daemon wrapper must run as www-data.'
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
      echo >&2 "error: EspoCRM daemon sandbox retained Linux capability field ${field}."
      return 77
    fi
  done

  value="$(awk '$1 == "NoNewPrivs:" { print $2 }' /proc/self/status)"

  if [ "$value" != '1' ]; then
    echo >&2 'error: EspoCRM daemon sandbox requires NoNewPrivs.'
    return 77
  fi
}

assert_runtime_sandbox

if [ -n "${ESPOCRM_ADMIN_PASSWORD:-}" ]; then
  echo >&2 'error: Bootstrap administrator password must not reach the long-lived daemon.'
  exit 78
fi
unset ESPOCRM_ADMIN_PASSWORD_FILE

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

stop_daemon() {
  local attempt

  if [ -z "$daemon_pid" ]; then
    rm -f "$DAEMON_PID_FILE"
    return 0
  fi

  if kill -0 -- "-${daemon_pid}" 2>/dev/null; then
    kill -TERM -- "-${daemon_pid}" 2>/dev/null || true

    for ((attempt = 1; attempt <= 20; attempt++)); do
      kill -0 -- "-${daemon_pid}" 2>/dev/null || break
      sleep 1
    done

    if kill -0 -- "-${daemon_pid}" 2>/dev/null; then
      echo >&2 'warning: EspoCRM daemon process group did not stop gracefully; sending SIGKILL.'
      kill -KILL -- "-${daemon_pid}" 2>/dev/null || true
    fi
  fi

  wait "$daemon_pid" 2>/dev/null || true

  for ((attempt = 1; attempt <= 5; attempt++)); do
    kill -0 -- "-${daemon_pid}" 2>/dev/null || break
    sleep 1
  done

  if kill -0 -- "-${daemon_pid}" 2>/dev/null; then
    echo >&2 'error: EspoCRM daemon process group is still active.'
    return 1
  fi

  daemon_pid=''
  rm -f "$DAEMON_PID_FILE"
}

shutdown() {
  trap - TERM INT
  stop_daemon
  exit 143
}

trap shutdown TERM INT

if [ ! -x "$SETSID" ]; then
  echo >&2 'error: setsid is required to isolate EspoCRM daemon descendants.'
  exit 69
fi

while true; do
  if [ -L "$MAINTENANCE_FILE" ] || [ -L "$STOPPED_ACK_FILE" ] ||
      { [ -e "$MAINTENANCE_FILE" ] && [ ! -f "$MAINTENANCE_FILE" ]; } ||
      { [ -e "$STOPPED_ACK_FILE" ] && [ ! -f "$STOPPED_ACK_FILE" ]; } ||
      [ ! -f "$DEPLOYMENT_CONTRACT_FILE" ] || [ -L "$DEPLOYMENT_CONTRACT_FILE" ]; then
    echo >&2 'error: Invalid EspoCRM runtime-coordination path.'
    exit 78
  fi

  if [ -f "$MAINTENANCE_FILE" ]; then
    stop_daemon
    write_stopped_ack
    sleep 1
    continue
  fi

  rm -f "$STOPPED_ACK_FILE"

  if ! curl --fail --silent --max-time 5 "$READY_URL" >/dev/null; then
    sleep 2
    continue
  fi

  # Close the readiness-to-start race with a second maintenance check.
  if [ -f "$MAINTENANCE_FILE" ]; then
    continue
  fi

  if ! php "$RUNTIME_ATTESTATION" assert-deployment-contract ||
      ! php "$CONFIG_VALIDATOR" assert-ready ||
      ! "$EXTENSION_INSTALLER" check; then
    echo >&2 'error: Daemon image contract does not match the shared EspoCRM deployment.'
    exit 78
  fi

  if [ -f "$MAINTENANCE_FILE" ]; then
    continue
  fi

  "$SETSID" /usr/local/bin/php "${ESPOCRM_ROOT}/daemon.php" &
  daemon_pid=$!
  printf '%s\n' "$daemon_pid" > "$DAEMON_PID_FILE"

  readiness_failures=0

  while kill -0 "$daemon_pid" 2>/dev/null; do
    if [ -f "$MAINTENANCE_FILE" ]; then
      stop_daemon
      write_stopped_ack
      break
    fi

    if curl --fail --silent --max-time 5 "$READY_URL" >/dev/null; then
      readiness_failures=0
    else
      readiness_failures=$((readiness_failures + 1))
    fi

    if [ "$readiness_failures" -ge 3 ]; then
      echo >&2 'warning: EspoCRM web readiness is unavailable; pausing the daemon.'
      stop_daemon
      break
    fi

    sleep 2
  done

  if [ -n "$daemon_pid" ]; then
    set +e
    wait "$daemon_pid"
    daemon_status=$?
    set -e

    if kill -0 -- "-${daemon_pid}" 2>/dev/null; then
      stop_daemon
    else
      daemon_pid=''
      rm -f "$DAEMON_PID_FILE"
    fi

    echo >&2 'error: EspoCRM daemon exited unexpectedly.'
    [ "$daemon_status" -ne 0 ] || daemon_status=1
    exit "$daemon_status"
  fi
done
