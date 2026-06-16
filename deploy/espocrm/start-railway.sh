#!/bin/bash
set -euo pipefail

docker-entrypoint.sh true

rm -f /etc/apache2/mods-enabled/mpm_event.load
rm -f /etc/apache2/mods-enabled/mpm_event.conf
rm -f /etc/apache2/mods-enabled/mpm_worker.load
rm -f /etc/apache2/mods-enabled/mpm_worker.conf

if command -v a2enmod >/dev/null 2>&1; then
  a2enmod mpm_prefork >/dev/null || true
fi

exec "$@"
