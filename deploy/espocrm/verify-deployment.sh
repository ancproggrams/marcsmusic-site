#!/bin/bash
set -Eeuo pipefail
umask 0077

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly CONTRACT="${SCRIPT_DIR}/deployment-contract.json"
readonly RAILWAY_IGNORE="${SCRIPT_DIR}/.railwayignore"
readonly IMAGE_TAG="marcsmusic/espocrm:contract-test-${$}"
readonly DATABASE_IMAGE='mysql:9.4@sha256:135bc87cce147c3d28cecb9ad270b814cb52805af7ddeea83bfcaf157d05a6b2'
readonly TEST_PREFIX="marcsmusic-espocrm-${$}"
readonly NETWORK="${TEST_PREFIX}-network"
readonly DATABASE_CONTAINER="${TEST_PREFIX}-database"
readonly APPLICATION_CONTAINER="${TEST_PREFIX}-application"

temporary_root=''
declare -a compose_command=()

cleanup() {
  docker rm --volumes --force "$APPLICATION_CONTAINER" >/dev/null 2>&1 || true
  docker rm --volumes --force "$DATABASE_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  docker image rm "$IMAGE_TAG" >/dev/null 2>&1 || true

  if [ -n "$temporary_root" ]; then
    rm -rf "$temporary_root"
  fi
}

trap cleanup EXIT

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo >&2 "error: Required verification command is unavailable: ${command_name}."
    return 69
  fi
}

wait_for_database() {
  local attempt
  local root_password="$1"

  for ((attempt = 1; attempt <= 60; attempt++)); do
    if docker exec "$DATABASE_CONTAINER" \
        mysqladmin ping \
          --host=127.0.0.1 \
          --user=root \
          --password="$root_password" \
          --silent >/dev/null 2>&1; then
      return 0
    fi

    if [ "$(docker inspect --format '{{.State.Running}}' "$DATABASE_CONTAINER")" != 'true' ]; then
      echo >&2 'error: Disposable MySQL exited during verification.'
      docker logs --tail 200 "$DATABASE_CONTAINER" >&2 || true
      return 1
    fi

    sleep 2
  done

  echo >&2 'error: Disposable MySQL did not become ready.'
  docker logs --tail 200 "$DATABASE_CONTAINER" >&2 || true
  return 1
}

wait_for_application() {
  local attempt
  local published_port

  published_port="$(docker port "$APPLICATION_CONTAINER" 80/tcp | head -n 1 | sed 's/.*://')"

  if ! [[ "$published_port" =~ ^[0-9]+$ ]]; then
    echo >&2 'error: Disposable EspoCRM HTTP port is unavailable.'
    return 1
  fi

  for ((attempt = 1; attempt <= 180; attempt++)); do
    if curl --fail --silent --show-error --max-time 5 \
        "http://127.0.0.1:${published_port}/readyz.php" >/dev/null 2>&1; then
      return 0
    fi

    if [ "$(docker inspect --format '{{.State.Running}}' "$APPLICATION_CONTAINER")" != 'true' ]; then
      echo >&2 'error: Disposable EspoCRM exited during verification.'
      docker logs --tail 300 "$APPLICATION_CONTAINER" >&2 || true
      return 1
    fi

    sleep 2
  done

  echo >&2 'error: Disposable EspoCRM did not become ready.'
  docker logs --tail 300 "$APPLICATION_CONTAINER" >&2 || true
  return 1
}

application_environment() {
  printf '%s\n' \
    '--env' 'RAILWAY_ENVIRONMENT_ID=contract-test' \
    '--env' 'RAILWAY_VOLUME_MOUNT_PATH=/var/www/persistent' \
    '--env' 'ESPOCRM_DATABASE_PLATFORM=Mysql' \
    '--env' 'ESPOCRM_DATABASE_HOST=mysql.railway.internal' \
    '--env' 'ESPOCRM_DATABASE_INSTANCE_ID=contract-test-database' \
    '--env' 'ESPOCRM_DATABASE_PORT=3306' \
    '--env' 'ESPOCRM_DATABASE_NAME=espocrm' \
    '--env' 'ESPOCRM_DATABASE_USER=espocrm' \
    '--env' 'ESPOCRM_DATABASE_PASSWORD_FILE=/run/secrets/database-password' \
    '--env' 'ESPOCRM_SITE_URL=http://127.0.0.1' \
    '--env' 'ESPOCRM_CONFIG_PASSWORD_SALT_FILE=/run/secrets/password-salt' \
    '--env' 'ESPOCRM_CONFIG_CRYPT_KEY_FILE=/run/secrets/crypt-key' \
    '--env' 'ESPOCRM_CONFIG_HASH_SECRET_KEY_FILE=/run/secrets/hash-secret-key' \
    '--env' 'ESPOCRM_ADMIN_USERNAME=admin' \
    '--env' 'ESPOCRM_ADMIN_PASSWORD_FILE=/run/secrets/admin-password' \
    '--env' 'ESPOCRM_DATABASE_CONNECT_ATTEMPTS=30'
}

run_expected_failure() {
  local name="$1"
  shift

  if docker run --name "$name" "$@"; then
    echo >&2 "error: Fail-closed test unexpectedly succeeded: ${name}."
    docker rm --volumes --force "$name" >/dev/null 2>&1 || true
    return 1
  fi

  docker rm --volumes --force "$name" >/dev/null 2>&1 || true
}

application_exec() {
  docker exec "$APPLICATION_CONTAINER" /bin/bash -c '
    set -Eeuo pipefail

    for name in \
      ESPOCRM_DATABASE_PASSWORD \
      ESPOCRM_CONFIG_PASSWORD_SALT \
      ESPOCRM_CONFIG_CRYPT_KEY \
      ESPOCRM_CONFIG_HASH_SECRET_KEY; do
      file_name="${name}_FILE"
      file_path="${!file_name-}"
      [ -n "$file_path" ] && [ -r "$file_path" ]
      printf -v "$name" "%s" "$(< "$file_path")"
      export "$name"
      unset "$file_name"
    done

    exec "$@"
  ' contract-secret-exec "$@"
}

verify_railway_package() {
  local extension_count
  local filesystem_list
  local git_list
  local manifest
  local manifest_digest
  local package_count
  local package_list
  local relative_path

  package_list="$(
    cd "$SCRIPT_DIR"
    rg --files \
      --hidden \
      --no-ignore-vcs \
      --ignore-file .railwayignore \
      . | sed 's#^\./##' | LC_ALL=C sort
  )"
  filesystem_list="$(
    find "$SCRIPT_DIR" -type f |
      sed "s#^${SCRIPT_DIR}/##" |
      LC_ALL=C sort
  )"
  git_list="$(
    git -C "$REPOSITORY_ROOT" ls-files \
      --cached \
      --others \
      --exclude-standard \
      -- deploy/espocrm |
      sed 's#^deploy/espocrm/##' |
      LC_ALL=C sort
  )"

  if [ "$package_list" != "$filesystem_list" ] || [ "$git_list" != "$filesystem_list" ]; then
    echo >&2 'error: Railway package, filesystem and Git-visible file sets differ.'
    return 1
  fi

  while IFS= read -r relative_path; do
    if ! [[ "$relative_path" =~ ^[A-Za-z0-9._/-]+$ ]]; then
      echo >&2 "error: Railway package path is unsafe: ${relative_path}."
      return 1
    fi

    case "$relative_path" in
      .railwayignore|Dockerfile|assert-outreach-schema.php|\
      build-extension-package.php|build-runtime-contract.php|database-state.php|\
      deployment-contract.json|docker-compose.yml|install-outreach-extension.sh|\
      railway.json|readyz.php|run-railway-processes.sh|run-runtime-watchdog.sh|\
      run-shared-daemon.sh|runtime-attestation.php|runtime.php|start-railway.sh|\
      validate-deployment-attestation.php|validate-runtime-config.php|\
      verify-api-contract.sh|verify-deployment.sh|with-mysql-advisory-lock.php|\
      extensions/marcsmusic-outreach/*)
        ;;
      *)
        echo >&2 "error: Railway package path is not allowlisted: ${relative_path}."
        return 1
        ;;
    esac
  done <<<"$filesystem_list"

  extension_count="$(
    find "${SCRIPT_DIR}/extensions/marcsmusic-outreach" -type f |
      wc -l |
      tr -d ' '
  )"
  package_count="$(printf '%s\n' "$package_list" | wc -l | tr -d ' ')"

  if [ "$package_count" -ne 129 ] ||
      [ "$extension_count" -ne 107 ]; then
    echo >&2 'error: Railway package or extension file count changed without contract review.'
    return 1
  fi

  if [ -n "$(find "$SCRIPT_DIR" -type l -print -quit)" ] ||
      [ -n "$(find "$SCRIPT_DIR" ! -type d ! -type f -print -quit)" ]; then
    echo >&2 'error: Railway package contains a symbolic link or special file.'
    return 1
  fi

  if [ -n "$(find "$SCRIPT_DIR" -type f \( \
      -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' -o \
      -name '*.p12' -o -name '*.pfx' -o -name '*.sql' -o -name '*.sql.gz' -o \
      -name 'config.php' -o -name 'config-internal.php' -o -name '*.zip' \
    \) -print -quit)" ] ||
      [ -n "$(find "$SCRIPT_DIR" -type f -size +1048576c -print -quit)" ]; then
    echo >&2 'error: Railway package contains a forbidden or oversized file.'
    return 1
  fi

  gitleaks dir "$SCRIPT_DIR" \
    --config "${REPOSITORY_ROOT}/.gitleaks.toml" \
    --redact=100 \
    --no-banner \
    --no-color \
    --log-level error

  manifest="$(
    cd "$SCRIPT_DIR"

    while IFS= read -r relative_path; do
      shasum -a 256 -- "$relative_path"
    done <<<"$package_list"
  )"
  manifest_digest="$(printf '%s' "$manifest" | shasum -a 256 | awk '{print $1}')"

  echo "    Railway package allowlist passed: ${package_count} files, manifest ${manifest_digest}"
}

run_static_verification() {
  local file

  echo '==> Static deployment contract verification'
  require_command bash
  require_command curl
  require_command date
  require_command cmp
  require_command docker
  require_command gitleaks
  require_command git
  require_command grep
  require_command jq
  require_command node
  require_command openssl
  require_command rg
  require_command shasum

  docker info >/dev/null

  if docker compose version >/dev/null 2>&1; then
    compose_command=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    compose_command=(docker-compose)
  else
    echo >&2 'error: Docker Compose is unavailable.'
    return 69
  fi

  jq --exit-status '
    .schemaVersion == 1 and
    .release.coreVersion == "10.0.2" and
    .release.extensionVersion == "1.2.2" and
    .release.baseImage == "espocrm/espocrm:10.0.2-apache@sha256:ee13cdbcf52dc032d1e50a9b15d8774d2633c71dce4b2a9d208e3af6fbf40e35" and
    .release.databaseImage == "mysql:9.4@sha256:135bc87cce147c3d28cecb9ad270b814cb52805af7ddeea83bfcaf157d05a6b2" and
    .release.allowedCoreSourceVersions == ["10.0.0", "10.0.2"] and
    .release.coreUpgradeIncluded == true and
    .railway.startCommand == null and
    .railway.replicas == 1 and
    .railway.imageEntrypoint == [
      "/usr/local/bin/tini",
      "-g",
      "--",
      "/usr/local/bin/start-railway-espocrm"
    ] and
    .railway.imageCommand == ["run-railway-espocrm"] and
    .persistentVolume.mountPath == "/var/www/persistent" and
    (.persistentVolume.requiredSubdirectories | keys | sort) ==
      (["client-custom", "custom", "data"] | sort) and
    .persistentVolume.partialLayoutPolicy == "reject" and
    .persistentVolume.symbolicLinkPolicy == "reject" and
    .startupSafety.databaseAdvisoryLock == true and
    .startupSafety.maintenanceAcknowledgements == ["daemon", "watchdog"] and
    .startupSafety.runtimeUsers.daemon == "www-data" and
    .startupSafety.runtimeUsers.watchdog == "www-data" and
    .startupSafety.runtimeCapabilities == "none for daemon and watchdog" and
    .startupSafety.failClosedOnInterruptedVolumeCopy == true and
    .startupSafety.failClosedOnMissingOriginalConfiguration == true and
    .startupSafety.failClosedOnSchemaFingerprintMismatch == true
  ' "$CONTRACT" >/dev/null

  jq --exit-status '
    (.release | has("compatibilityException") | not) and
    .release.upgradePath.source == "10.0.0" and
    .release.upgradePath.target == "10.0.2" and
    .release.upgradePath.requiresBoundRestoreEvidence == true
  ' "$CONTRACT" >/dev/null

  jq --exit-status '
    .deploy.startCommand == null and
    .deploy.healthcheckPath == "/readyz.php" and
    .deploy.healthcheckTimeout == 300 and
    .deploy.drainingSeconds == 45
  ' "${SCRIPT_DIR}/railway.json" >/dev/null

  grep --quiet --fixed-strings \
    'FROM espocrm/espocrm:10.0.2-apache@sha256:ee13cdbcf52dc032d1e50a9b15d8774d2633c71dce4b2a9d208e3af6fbf40e35' \
    "${SCRIPT_DIR}/Dockerfile"
  grep --quiet --fixed-strings \
    'ENTRYPOINT ["/usr/local/bin/tini", "-g", "--", "/usr/local/bin/start-railway-espocrm"]' \
    "${SCRIPT_DIR}/Dockerfile"
  grep --quiet --fixed-strings \
    "!== 'espocrm/espocrm:10.0.2-apache@sha256:ee13cdbcf52dc032d1e50a9b15d8774d2633c71dce4b2a9d208e3af6fbf40e35'" \
    "${SCRIPT_DIR}/build-runtime-contract.php"
  grep --quiet --fixed-strings \
    'installed_version="$(php "$CONFIG_VALIDATOR" version)"' \
    "${SCRIPT_DIR}/start-railway.sh"

  grep --quiet --fixed-strings '!/extensions/marcsmusic-outreach/**' "$RAILWAY_IGNORE"
  git -C "$REPOSITORY_ROOT" check-ignore --verbose --no-index \
    deploy/espocrm/.railwayignore |
    grep --quiet --fixed-strings '!deploy/espocrm/.railwayignore'
  verify_railway_package

  [ "$(grep --count --fixed-strings \
    'entrypoint: ["/usr/local/bin/tini", "-g", "--",' \
    "${SCRIPT_DIR}/docker-compose.yml")" -eq 2 ]
  [ "$(grep --count --fixed-strings 'cap_drop: ["ALL"]' \
    "${SCRIPT_DIR}/docker-compose.yml")" -eq 2 ]
  [ "$(grep --count --fixed-strings 'security_opt: ["no-new-privileges:true"]' \
    "${SCRIPT_DIR}/docker-compose.yml")" -eq 2 ]
  ! grep --quiet --fixed-strings 'init: true' "${SCRIPT_DIR}/docker-compose.yml"

  for file in "${SCRIPT_DIR}"/*.sh; do
    bash -n "$file"
  done

  git -C "$REPOSITORY_ROOT" diff --check -- deploy/espocrm

  ESPOCRM_DB_ROOT_PASSWORD='compose-contract-root-password' \
  ESPOCRM_DB_PASSWORD='compose-contract-database-password' \
  ESPOCRM_SITE_URL='http://127.0.0.1' \
  ESPOCRM_CONFIG_PASSWORD_SALT='compose-contract-password-salt' \
  ESPOCRM_CONFIG_CRYPT_KEY='compose-contract-crypt-key-value-0001' \
  ESPOCRM_CONFIG_HASH_SECRET_KEY='compose-contract-hash-key-value-0001' \
  ESPOCRM_ADMIN_PASSWORD='compose-contract-admin-password' \
    "${compose_command[@]}" --file "${SCRIPT_DIR}/docker-compose.yml" config --quiet
}

build_and_verify_image() {
  local first_digest
  local second_digest
  local evidence_digest
  local evidence_json
  local evidence_timestamp
  local tampered_digest
  local tampered_evidence
  local target_architecture

  echo '==> Build and deterministic artifact verification'
  case "$(docker info --format '{{.Architecture}}')" in
    amd64|x86_64) target_architecture='amd64' ;;
    arm64|aarch64) target_architecture='arm64' ;;
    *)
      echo >&2 'error: Unsupported Docker server architecture for contract verification.'
      return 69
      ;;
  esac

  docker build \
    --build-arg "TARGETARCH=${target_architecture}" \
    --tag "$IMAGE_TAG" \
    "$SCRIPT_DIR"

  docker image inspect "$IMAGE_TAG" --format '{{json .Config.Entrypoint}} {{json .Config.Cmd}}' |
    grep --quiet --fixed-strings \
      '["/usr/local/bin/tini","-g","--","/usr/local/bin/start-railway-espocrm"] ["run-railway-espocrm"]'

  docker run --rm --entrypoint /bin/bash "$IMAGE_TAG" -c '
    set -Eeuo pipefail
    while IFS= read -r -d "" file; do
      php -l "$file" >/dev/null
    done < <(find \
      /opt/marcsmusic \
      /opt/marcsmusic-outreach-extension \
      /usr/local/bin \
      /var/www/html/public/readyz.php \
      -type f -name "*.php" -print0)
  '

  mkdir -p "${temporary_root}/artifact-one" "${temporary_root}/artifact-two"

  docker run --rm --entrypoint php \
    --mount "type=bind,source=${temporary_root}/artifact-one,target=/output" \
    "$IMAGE_TAG" \
    /usr/local/bin/build-espocrm-extension-package \
    /opt/marcsmusic-outreach-extension \
    /output/extension.zip \
    /output/payload.json

  docker run --rm --entrypoint php \
    --mount "type=bind,source=${temporary_root}/artifact-two,target=/output" \
    "$IMAGE_TAG" \
    /usr/local/bin/build-espocrm-extension-package \
    /opt/marcsmusic-outreach-extension \
    /output/extension.zip \
    /output/payload.json

  first_digest="$(shasum -a 256 "${temporary_root}/artifact-one/extension.zip" | awk '{print $1}')"
  second_digest="$(shasum -a 256 "${temporary_root}/artifact-two/extension.zip" | awk '{print $1}')"
  [ "$first_digest" = "$second_digest" ]
  cmp \
    "${temporary_root}/artifact-one/payload.json" \
    "${temporary_root}/artifact-two/payload.json"

  docker run --rm --entrypoint /bin/bash "$IMAGE_TAG" -c '
    set -Eeuo pipefail
    expected="$(tr -d "\r\n" </opt/marcsmusic-outreach-extension.sha256)"
    actual="$(sha256sum /opt/marcsmusic-outreach-extension.zip | cut -d " " -f 1)"
    [ "$expected" = "$actual" ]
    test "$(id -u www-data)" = 33
    test -x /usr/local/bin/tini
    test -x /usr/bin/flock
    test -x /usr/bin/setpriv
    test -x /usr/bin/setsid
  '

  docker run --rm --entrypoint php "$IMAGE_TAG" -r '
    require "/opt/marcsmusic/runtime.php";
    marcsmusic_assert_core_table_manifest_integrity();

    if (count(MARCSMUSIC_ESPOCRM_CORE_TABLES) !== 141) {
        throw new RuntimeException("Pinned EspoCRM core table manifest is incomplete.");
    }

    foreach (MARCSMUSIC_OUTREACH_CORE_SCHEMA as $table => $columns) {
        if (array_intersect($columns, MARCSMUSIC_ESPOCRM_CORE_SCHEMA[$table] ?? []) !== []) {
            throw new RuntimeException("Outreach column leaked into the base EspoCRM schema contract: {$table}.");
        }
    }

    foreach (MARCSMUSIC_OUTREACH_CORE_SECONDARY_INDEXES as $table => $indexes) {
        $baseIndexes = MARCSMUSIC_ESPOCRM_CORE_SECONDARY_INDEXES[$table] ?? [];

        foreach ($indexes as $index) {
            if (in_array($index, $baseIndexes, true)) {
                throw new RuntimeException("Outreach index leaked into the base EspoCRM index contract: {$table}.");
            }
        }
    }

    $outreachIndexes = marcsmusic_expected_outreach_indexes();

    foreach (MARCSMUSIC_OUTREACH_CORE_SECONDARY_INDEXES as $table => $indexes) {
        foreach ($indexes as $index) {
            if (!in_array($index, $outreachIndexes[$table] ?? [], true)) {
                throw new RuntimeException("Outreach core index is missing from the merged outreach contract: {$table}.");
            }
        }
    }
  '

  evidence_timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  evidence_json="$(jq --compact-output --sort-keys --null-input \
    --arg timestamp "$evidence_timestamp" \
    '{
      schemaVersion: 1,
      result: "passed",
      changeId: "contract-change",
      recoveryPointId: "contract-recovery",
      recoveryPointCreatedAt: $timestamp,
      rehearsalId: "contract-rehearsal",
      sourceVersion: "10.0.0",
      restoredAt: $timestamp,
      databaseSha256: ("a" * 64),
      applicationSha256: ("b" * 64),
      checks: {
        tableCount: 141,
        coreTableManifestSha256: "88e9668e031d9f8a26b0cee47eecfe74ad74941111233bec29b5fb75e10dcc49",
        configRestore: "verified"
      }
    }')"
  evidence_digest="$(printf '%s' "$evidence_json" | shasum -a 256 | awk '{print $1}')"

  local -a evidence_environment=(
    --env 'ESPOCRM_CHANGE_ID=contract-change'
    --env 'ESPOCRM_RECOVERY_POINT_ID=contract-recovery'
    --env "ESPOCRM_RECOVERY_POINT_CREATED_AT=${evidence_timestamp}"
    --env "ESPOCRM_RECOVERY_POINT_DATABASE_SHA256=$(printf 'a%.0s' {1..64})"
    --env "ESPOCRM_RECOVERY_POINT_APPLICATION_SHA256=$(printf 'b%.0s' {1..64})"
    --env 'ESPOCRM_RESTORE_REHEARSAL_ID=contract-rehearsal'
    --env "ESPOCRM_RESTORE_REHEARSED_AT=${evidence_timestamp}"
    --env 'ESPOCRM_RESTORE_REHEARSAL_SOURCE_VERSION=10.0.0'
    --env 'ESPOCRM_MUTATION_SOURCE_VERSION=10.0.0'
  )

  docker run --rm --entrypoint php \
    "${evidence_environment[@]}" \
    --env "ESPOCRM_RESTORE_REHEARSAL_EVIDENCE_SHA256=${evidence_digest}" \
    --env "ESPOCRM_RESTORE_REHEARSAL_EVIDENCE_JSON=${evidence_json}" \
    "$IMAGE_TAG" \
    /usr/local/bin/espocrm-validate-deployment-attestation

  tampered_evidence="$(printf '%s' "$evidence_json" |
    jq --compact-output --sort-keys '.recoveryPointId = "unbound-recovery"')"
  tampered_digest="$(printf '%s' "$tampered_evidence" | shasum -a 256 | awk '{print $1}')"
  run_expected_failure "${TEST_PREFIX}-unbound-evidence" \
    --entrypoint php \
    "${evidence_environment[@]}" \
    --env "ESPOCRM_RESTORE_REHEARSAL_EVIDENCE_SHA256=${tampered_digest}" \
    --env "ESPOCRM_RESTORE_REHEARSAL_EVIDENCE_JSON=${tampered_evidence}" \
    "$IMAGE_TAG" \
    /usr/local/bin/espocrm-validate-deployment-attestation
}

run_integration_verification() {
  local cancellation_status
  local database_password
  local database_root_password
  local failed_container
  local interrupted_root
  local partial_root
  local missing_config_root
  local published_port

  echo '==> Disposable Railway-shaped integration verification'
  database_password="$(openssl rand -hex 24)"
  database_root_password="$(openssl rand -hex 24)"

  mkdir -p \
    "${temporary_root}/mysql" \
    "${temporary_root}/persistent" \
    "${temporary_root}/secrets"
  printf '%s\n' "$database_password" >"${temporary_root}/secrets/database-password"
  printf '%s\n' 'contract-test-password-salt-0001' >"${temporary_root}/secrets/password-salt"
  printf '%s\n' 'contract-test-crypt-key-value-00000001' >"${temporary_root}/secrets/crypt-key"
  printf '%s\n' 'contract-test-hash-secret-value-000001' >"${temporary_root}/secrets/hash-secret-key"
  printf '%s\n' 'contract-test-admin-password-000001' >"${temporary_root}/secrets/admin-password"

  docker network create "$NETWORK" >/dev/null
  docker run --detach \
    --name "$DATABASE_CONTAINER" \
    --network "$NETWORK" \
    --network-alias mysql.railway.internal \
    --env "MYSQL_ROOT_PASSWORD=${database_root_password}" \
    --env MYSQL_DATABASE=espocrm \
    --env MYSQL_USER=espocrm \
    --env "MYSQL_PASSWORD=${database_password}" \
    --mount "type=bind,source=${temporary_root}/mysql,target=/var/lib/mysql" \
    "$DATABASE_IMAGE" >/dev/null
  wait_for_database "$database_root_password"

  local -a app_environment=()
  while IFS= read -r value; do
    app_environment+=("$value")
  done < <(application_environment)

  docker run --detach \
    --name "$APPLICATION_CONTAINER" \
    --network "$NETWORK" \
    --publish 127.0.0.1::80 \
    --mount "type=bind,source=${temporary_root}/persistent,target=/var/www/persistent" \
    --mount "type=bind,source=${temporary_root}/secrets,target=/run/secrets,readonly" \
    "${app_environment[@]}" \
    "$IMAGE_TAG" >/dev/null
  wait_for_application

  application_exec php \
    /usr/local/bin/espocrm-runtime-attestation assert-current
  application_exec \
    /usr/local/bin/install-outreach-extension check
  application_exec php \
    /usr/local/bin/espocrm-assert-outreach-schema

  # Prove that schema validation covers the complete 141-table manifest rather
  # than only the higher-value column/index sentinels. The renamed table is not
  # part of MARCSMUSIC_ESPOCRM_CORE_SCHEMA and is restored in a finally block.
  application_exec php -r '
    require "/opt/marcsmusic/runtime.php";
    $pdo = marcsmusic_database_connection();
    $source = "address_country";
    $temporary = "marcsmusic_contract_missing_core";
    $renamed = false;

    try {
        $pdo->exec("RENAME TABLE `{$source}` TO `{$temporary}`");
        $renamed = true;
        $failedClosed = false;

        try {
            marcsmusic_assert_core_schema($pdo);
        } catch (RuntimeException) {
            $failedClosed = true;
        }

        if (!$failedClosed) {
            throw new RuntimeException(
                "Core schema validation accepted a missing non-sentinel table.",
            );
        }
    } finally {
        if ($renamed) {
            $pdo->exec("RENAME TABLE `{$temporary}` TO `{$source}`");
        }
    }

    marcsmusic_assert_core_schema($pdo);
  '
  application_exec /bin/bash -c \
    'cd /var/www/html && exec bin/command app-check' >/dev/null
  echo '    schema, extension, attestation and app-check passed'

  published_port="$(docker port "$APPLICATION_CONTAINER" 80/tcp | head -n 1 | sed 's/.*://')"
  if ! [[ "$published_port" =~ ^[0-9]+$ ]]; then
    echo >&2 'error: Disposable EspoCRM API port is unavailable.'
    return 1
  fi
  "${SCRIPT_DIR}/verify-api-contract.sh" \
    "$APPLICATION_CONTAINER" \
    "$DATABASE_CONTAINER" \
    "http://127.0.0.1:${published_port}" \
    "${temporary_root}/secrets/admin-password" \
    "${temporary_root}/secrets/database-password"
  echo '    HTTP API, ACL, uniqueness and immutable-identity contracts passed'

  docker exec "$APPLICATION_CONTAINER" /bin/bash -c '
    set -Eeuo pipefail

    assert_sandbox() {
      local pid="$1"
      local field
      local value

      for field in CapInh CapPrm CapEff CapBnd CapAmb; do
        value="$(awk -v key="${field}:" '\''$1 == key { print $2 }'\'' "/proc/${pid}/status")"
        [[ "$value" =~ ^0+$ ]]
      done

      test "$(awk '\''$1 == "NoNewPrivs:" { print $2 }'\'' "/proc/${pid}/status")" = 1
    }

    test "$(cat /proc/1/comm)" = tini
    test "$(cat /var/www/persistent/.marcsmusic-layout-v1)" = layout-v1:bootstrap
    test -d /var/www/persistent/data
    test -d /var/www/persistent/custom
    test -d /var/www/persistent/client-custom
    test "$(stat --format %a /run/secrets/admin-password)" = 600
    ! /usr/bin/setpriv \
      --reuid=www-data \
      --regid=www-data \
      --init-groups \
      --inh-caps=-all \
      --ambient-caps=-all \
      --bounding-set=-all \
      --no-new-privs \
      -- test -r /run/secrets/admin-password
    if tr "\0" "\n" </proc/1/environ |
        awk -F= '\''
          $1 == "ESPOCRM_ADMIN_PASSWORD" { found = 1 }
          END { exit found ? 0 : 1 }
        '\''; then
      echo >&2 "error: Bootstrap administrator password leaked into the init environment."
      exit 1
    fi

    daemon_pid=""
    for _attempt in {1..30}; do
      if [ -s /tmp/marcsmusic-espocrm-daemon.pid ]; then
        daemon_pid="$(cat /tmp/marcsmusic-espocrm-daemon.pid)"

        if [[ "$daemon_pid" =~ ^[0-9]+$ ]] && kill -0 "$daemon_pid" 2>/dev/null; then
          break
        fi
      fi

      daemon_pid=""
      sleep 1
    done

    [ -n "$daemon_pid" ]
    test "$(awk "/^Uid:/{print \$2}" "/proc/${daemon_pid}/status")" = 33
    assert_sandbox "$daemon_pid"

    watchdog_found=false
    self_cmdline="/proc/$$/cmdline"
    for _attempt in {1..30}; do
      for cmdline in /proc/[0-9]*/cmdline; do
        [ "$cmdline" != "$self_cmdline" ] || continue
        command="$(tr "\0" " " <"$cmdline" 2>/dev/null || true)"
        case "$command" in
          *run-espocrm-watchdog*loop*)
            status="${cmdline%/cmdline}/status"
            test "$(awk "/^Uid:/{print \$2}" "$status")" = 33
            sandbox_pid="${cmdline#/proc/}"
            sandbox_pid="${sandbox_pid%/cmdline}"
            assert_sandbox "$sandbox_pid"
            watchdog_found=true
            ;;
        esac

      done

      [ "$watchdog_found" = 'false' ] || break
      sleep 1
    done
    [ "$watchdog_found" = true ]
  '
  echo '    init, daemon and watchdog sandbox checks passed'

  # The advisory-lock owner must kill and reap its complete child process group
  # before another contender can acquire the same database lock. The leader
  # exits on TERM while its background descendant deliberately ignores TERM,
  # proving that the wrapper's process-group SIGKILL and drain path is active.
  set +e
  application_exec /usr/bin/timeout \
    --foreground \
    --signal=TERM \
    --kill-after=8s \
    2s \
    php /usr/local/bin/with-mysql-advisory-lock \
      marcsmusic:contract-cancel 30 \
      /bin/bash -c \
      'trap "exit 143" TERM INT; (trap "" TERM INT; echo "$BASHPID" >/var/www/html/data/contract-lock-child.pid; while :; do sleep 1; done) & wait'
  cancellation_status=$?
  set -e

  if [ "$cancellation_status" -ne 124 ]; then
    echo >&2 "error: Advisory-lock cancellation returned ${cancellation_status}, expected 124."
    return 1
  fi

  docker exec "$APPLICATION_CONTAINER" /bin/bash -c '
    child_pid="$(cat /var/www/html/data/contract-lock-child.pid)"

    for _attempt in {1..20}; do
      kill -0 "$child_pid" 2>/dev/null || exit 0
      sleep 1
    done

    exit 1
  '
  application_exec php \
    /usr/local/bin/with-mysql-advisory-lock \
    marcsmusic:contract-cancel 5 /usr/bin/true
  echo '    advisory-lock cancellation and reacquisition passed'

  docker restart --time 30 "$APPLICATION_CONTAINER" >/dev/null
  wait_for_application
  echo '    sealed-volume restart passed'

  docker stop --time 30 "$APPLICATION_CONTAINER" >/dev/null
  docker rm --volumes "$APPLICATION_CONTAINER" >/dev/null

  partial_root="${temporary_root}/partial-layout"
  mkdir -p "${partial_root}/data"
  failed_container="${TEST_PREFIX}-partial-layout"
  run_expected_failure "$failed_container" \
    --network "$NETWORK" \
    --mount "type=bind,source=${partial_root},target=/var/www/persistent" \
    --mount "type=bind,source=${temporary_root}/secrets,target=/run/secrets,readonly" \
    "${app_environment[@]}" \
    "$IMAGE_TAG"
  echo '    partial-layout rejection passed'

  interrupted_root="${temporary_root}/interrupted-layout"
  mkdir -p \
    "${interrupted_root}/.marcsmusic-layout-bootstrap-stage/data" \
    "${interrupted_root}/data"
  printf '%s\n' 'layout-v1:bootstrap-in-progress' > \
    "${interrupted_root}/.marcsmusic-layout-bootstrap-in-progress"
  failed_container="${TEST_PREFIX}-interrupted-layout"
  run_expected_failure "$failed_container" \
    --network "$NETWORK" \
    --mount "type=bind,source=${interrupted_root},target=/var/www/persistent" \
    --mount "type=bind,source=${temporary_root}/secrets,target=/run/secrets,readonly" \
    "${app_environment[@]}" \
    "$IMAGE_TAG"
  echo '    interrupted-layout rejection passed'

  missing_config_root="${temporary_root}/missing-config"
  mkdir -p "$missing_config_root"
  failed_container="${TEST_PREFIX}-missing-config"
  run_expected_failure "$failed_container" \
    --network "$NETWORK" \
    --mount "type=bind,source=${missing_config_root},target=/var/www/persistent" \
    --mount "type=bind,source=${temporary_root}/secrets,target=/run/secrets,readonly" \
    "${app_environment[@]}" \
    "$IMAGE_TAG"
  echo '    existing-database missing-config rejection passed'
}

main() {
  local mode='full'
  local temporary_parent="${ESPOCRM_VERIFY_TEMP_ROOT:-${HOME}/.codex/tmp/espocrm-verify}"

  if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != '--static-only' ]; }; then
    echo >&2 'usage: verify-deployment.sh [--static-only]'
    return 64
  fi
  if [ "$#" -eq 1 ]; then
    mode='static'
  fi

  if [ "$mode" = 'static' ]; then
    run_static_verification
    echo 'EspoCRM static deployment contract verification passed.'
    return 0
  fi

  mkdir -p "$temporary_parent"
  chmod 0700 "$temporary_parent"
  temporary_root="$(mktemp -d "${temporary_parent}/marcsmusic-espocrm-contract.XXXXXX")"
  run_static_verification
  build_and_verify_image
  run_integration_verification
  echo 'EspoCRM deployment contract verification passed.'
}

main "$@"
