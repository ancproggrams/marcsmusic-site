#!/bin/bash
set -Eeuo pipefail

web_pid=''
daemon_pid=''
watchdog_pid=''
readonly SETSID='/usr/bin/setsid'

stop_processes() {
  trap - TERM INT
  local attempt
  local running

  if [ -n "$web_pid" ] && kill -0 "$web_pid" 2>/dev/null; then
    kill -TERM "$web_pid" 2>/dev/null || true
  fi

  if [ -n "$daemon_pid" ] && kill -0 -- "-${daemon_pid}" 2>/dev/null; then
    kill -TERM -- "-${daemon_pid}" 2>/dev/null || true
  fi

  if [ -n "$watchdog_pid" ] && kill -0 -- "-${watchdog_pid}" 2>/dev/null; then
    kill -TERM -- "-${watchdog_pid}" 2>/dev/null || true
  fi

  for ((attempt = 1; attempt <= 35; attempt++)); do
    running='false'

    if [ -n "$web_pid" ] && kill -0 "$web_pid" 2>/dev/null; then
      running='true'
    fi

    if [ -n "$daemon_pid" ] && kill -0 -- "-${daemon_pid}" 2>/dev/null; then
      running='true'
    fi

    if [ -n "$watchdog_pid" ] && kill -0 -- "-${watchdog_pid}" 2>/dev/null; then
      running='true'
    fi

    [ "$running" = 'true' ] || break
    sleep 1
  done

  if [ -n "$web_pid" ] && kill -0 "$web_pid" 2>/dev/null; then
    kill -KILL "$web_pid" 2>/dev/null || true
  fi

  if [ -n "$daemon_pid" ] && kill -0 -- "-${daemon_pid}" 2>/dev/null; then
    kill -KILL -- "-${daemon_pid}" 2>/dev/null || true
  fi

  if [ -n "$watchdog_pid" ] && kill -0 -- "-${watchdog_pid}" 2>/dev/null; then
    kill -KILL -- "-${watchdog_pid}" 2>/dev/null || true
  fi

  [ -z "$web_pid" ] || wait "$web_pid" 2>/dev/null || true
  [ -z "$daemon_pid" ] || wait "$daemon_pid" 2>/dev/null || true
  [ -z "$watchdog_pid" ] || wait "$watchdog_pid" 2>/dev/null || true

  if [ -n "$daemon_pid" ] && kill -0 -- "-${daemon_pid}" 2>/dev/null; then
    echo >&2 'error: EspoCRM daemon process group is still active after shutdown.'
    return 1
  fi

  if [ -n "$watchdog_pid" ] && kill -0 -- "-${watchdog_pid}" 2>/dev/null; then
    echo >&2 'error: EspoCRM watchdog process group is still active after shutdown.'
    return 1
  fi
}

handle_signal() {
  stop_processes
  exit 143
}

trap handle_signal TERM INT

if [ ! -x "$SETSID" ]; then
  echo >&2 'error: setsid is required to isolate EspoCRM daemon descendants.'
  exit 69
fi

apache2-foreground &
web_pid=$!

ESPOCRM_WEB_READY_URL='http://127.0.0.1/readyz.php' \
  "$SETSID" /usr/local/bin/run-shared-espocrm-daemon &
daemon_pid=$!

"$SETSID" /usr/local/bin/run-espocrm-watchdog loop &
watchdog_pid=$!

set +e
wait -n "$web_pid" "$daemon_pid" "$watchdog_pid"
exit_status=$?
set -e

echo >&2 'error: An EspoCRM Railway runtime process exited; stopping its peer.'
stop_processes

# A clean but unexpected child exit must still trigger Railway's restart policy.
[ "$exit_status" -ne 0 ] || exit_status=1
exit "$exit_status"
