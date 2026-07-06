#!/bin/bash
set -Eeuo pipefail

reset_apache_mpm() {
  rm -f /etc/apache2/mods-enabled/mpm_*.load
  rm -f /etc/apache2/mods-enabled/mpm_*.conf
  ln -sf ../mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load
  ln -sf ../mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf
}

database_has_existing_espocrm_schema() {
  php <<'PHP'
<?php
$host = getenv('ESPOCRM_DATABASE_HOST') ?: 'espocrm-db';
$port = getenv('ESPOCRM_DATABASE_PORT') ?: '3306';
$db = getenv('ESPOCRM_DATABASE_NAME') ?: 'espocrm';
$user = getenv('ESPOCRM_DATABASE_USER') ?: 'espocrm';
$password = getenv('ESPOCRM_DATABASE_PASSWORD') ?: 'password';

try {
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $db);
    $pdo = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $statement = $pdo->prepare(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = :schema AND table_name = 'user'"
    );
    $statement->execute(['schema' => $db]);
    exit(((int) $statement->fetchColumn()) > 0 ? 0 : 1);
} catch (Throwable $e) {
    fwrite(STDERR, "warning: Could not inspect EspoCRM database: {$e->getMessage()}\n");
    exit(1);
}
PHP
}

seed_config_for_existing_database() {
  if [ ! -x bin/command ]; then
    return
  fi

  local installed
  installed="$(bin/command config:get isInstalled 2>/dev/null || true)"

  if [ "$installed" = "true" ]; then
    return
  fi

  if ! database_has_existing_espocrm_schema; then
    return
  fi

  echo >&2 "info: Existing EspoCRM database detected; writing local container config."

  bin/command config:populate
  bin/command config:set "defaultPermissions.user" "www-data"
  bin/command config:set "defaultPermissions.group" "www-data"
  bin/command config:set "database.platform" "${ESPOCRM_DATABASE_PLATFORM:-Mysql}"
  bin/command config:set "database.host" "${ESPOCRM_DATABASE_HOST:-espocrm-db}"
  bin/command config:set "database.port" "${ESPOCRM_DATABASE_PORT:-}"
  bin/command config:set "database.dbname" "${ESPOCRM_DATABASE_NAME:-espocrm}"
  bin/command config:set "database.user" "${ESPOCRM_DATABASE_USER:-espocrm}"
  bin/command config:set "database.password" "${ESPOCRM_DATABASE_PASSWORD:-password}"
  bin/command config:set "siteUrl" "${ESPOCRM_SITE_URL:-http://localhost}"
  bin/command config:set "isInstalled" "true" --type=bool
}

reset_apache_mpm
seed_config_for_existing_database
docker-entrypoint.sh true
reset_apache_mpm

exec "$@"
