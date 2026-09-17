<?php

declare(strict_types=1);

const ESPOCRM_ATTESTED_CORE_VERSION = '10.0.2';
const ESPOCRM_ATTESTED_UPGRADE_SOURCE_VERSION = '10.0.0';
const ESPOCRM_ATTESTED_CORE_TABLE_MANIFEST_SHA256 = '88e9668e031d9f8a26b0cee47eecfe74ad74941111233bec29b5fb75e10dcc49';
const ESPOCRM_MAX_EVIDENCE_BYTES = 65536;

/** @return non-empty-string */
function requiredAttestationValue(string $name): string
{
    $value = getenv($name);

    if (!is_string($value) || $value === '') {
        throw new RuntimeException("Required deployment evidence {$name} is missing.");
    }

    return $value;
}

function assertIdentifier(string $name): void
{
    if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._:\/-]{2,127}$/D', requiredAttestationValue($name)) !== 1) {
        throw new RuntimeException("Deployment evidence {$name} is malformed.");
    }
}

function assertDigest(string $name): void
{
    if (preg_match('/^[a-f0-9]{64}$/D', requiredAttestationValue($name)) !== 1) {
        throw new RuntimeException("Deployment evidence {$name} must be a SHA-256 digest.");
    }
}

function assertRecentTimestamp(string $name, int $maxAge): void
{
    $value = requiredAttestationValue($name);

    if (
        preg_match(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/D',
            $value,
        ) !== 1
    ) {
        throw new RuntimeException("Deployment evidence {$name} must be RFC 3339 without fractional seconds.");
    }

    $timestamp = new DateTimeImmutable($value);
    $now = time();

    if ($timestamp->getTimestamp() > $now + 300 || $timestamp->getTimestamp() < $now - $maxAge) {
        throw new RuntimeException("Deployment evidence {$name} is future-dated or stale.");
    }
}

/** @return mixed */
function canonicalizeEvidenceValue(mixed $value): mixed
{
    if (!is_array($value)) {
        return $value;
    }

    if (array_is_list($value)) {
        return array_map(canonicalizeEvidenceValue(...), $value);
    }

    ksort($value, SORT_STRING);

    foreach ($value as $key => $item) {
        $value[$key] = canonicalizeEvidenceValue($item);
    }

    return $value;
}

/** @return array<string, mixed> */
function readBoundRestoreEvidence(): array
{
    $inline = getenv('ESPOCRM_RESTORE_REHEARSAL_EVIDENCE_JSON');
    $path = getenv('ESPOCRM_RESTORE_REHEARSAL_EVIDENCE_FILE');
    $hasInline = is_string($inline) && $inline !== '';
    $hasPath = is_string($path) && $path !== '';

    if ($hasInline === $hasPath) {
        throw new RuntimeException(
            'Exactly one restore rehearsal evidence JSON source or file is required.',
        );
    }

    if ($hasPath) {
        if (!is_file($path) || is_link($path)) {
            throw new RuntimeException('Restore rehearsal evidence file is unavailable or symbolic.');
        }

        $resolvedPath = realpath($path);

        if (
            !is_string($resolvedPath)
            || (!str_starts_with($resolvedPath, '/run/secrets/')
                && !str_starts_with($resolvedPath, '/var/www/persistent/data/'))
        ) {
            throw new RuntimeException('Restore rehearsal evidence file is outside an approved runtime root.');
        }

        $size = filesize($resolvedPath);

        if (!is_int($size) || $size < 2 || $size > ESPOCRM_MAX_EVIDENCE_BYTES) {
            throw new RuntimeException('Restore rehearsal evidence file size is invalid.');
        }

        $inline = file_get_contents($resolvedPath);
    }

    if (!is_string($inline) || strlen($inline) < 2 || strlen($inline) > ESPOCRM_MAX_EVIDENCE_BYTES) {
        throw new RuntimeException('Restore rehearsal evidence JSON size is invalid.');
    }

    $evidence = json_decode($inline, true, 32, JSON_THROW_ON_ERROR);

    if (!is_array($evidence) || array_is_list($evidence)) {
        throw new RuntimeException('Restore rehearsal evidence must be a JSON object.');
    }

    $canonical = json_encode(
        canonicalizeEvidenceValue($evidence),
        JSON_THROW_ON_ERROR
            | JSON_UNESCAPED_SLASHES
            | JSON_UNESCAPED_UNICODE
            | JSON_PRESERVE_ZERO_FRACTION,
    );
    $expectedDigest = requiredAttestationValue('ESPOCRM_RESTORE_REHEARSAL_EVIDENCE_SHA256');

    if (!hash_equals($expectedDigest, hash('sha256', $canonical))) {
        throw new RuntimeException('Restore rehearsal evidence digest does not match its canonical artifact.');
    }

    return $evidence;
}

/** @param array<string, mixed> $evidence */
function assertEvidenceBinding(array $evidence): void
{
    $bindings = [
        'changeId' => 'ESPOCRM_CHANGE_ID',
        'recoveryPointId' => 'ESPOCRM_RECOVERY_POINT_ID',
        'recoveryPointCreatedAt' => 'ESPOCRM_RECOVERY_POINT_CREATED_AT',
        'rehearsalId' => 'ESPOCRM_RESTORE_REHEARSAL_ID',
        'restoredAt' => 'ESPOCRM_RESTORE_REHEARSED_AT',
        'sourceVersion' => 'ESPOCRM_RESTORE_REHEARSAL_SOURCE_VERSION',
        'databaseSha256' => 'ESPOCRM_RECOVERY_POINT_DATABASE_SHA256',
        'applicationSha256' => 'ESPOCRM_RECOVERY_POINT_APPLICATION_SHA256',
    ];

    if (($evidence['schemaVersion'] ?? null) !== 1 || ($evidence['result'] ?? null) !== 'passed') {
        throw new RuntimeException('Restore rehearsal evidence schema or result is invalid.');
    }

    foreach ($bindings as $field => $environmentName) {
        $actual = $evidence[$field] ?? null;

        if (!is_string($actual) || !hash_equals(requiredAttestationValue($environmentName), $actual)) {
            throw new RuntimeException("Restore rehearsal evidence field {$field} is not bound to deployment evidence.");
        }
    }

    $checks = $evidence['checks'] ?? null;

    if (
        !is_array($checks)
        || ($checks['tableCount'] ?? null) !== 141
        || ($checks['configRestore'] ?? null) !== 'verified'
        || ($checks['coreTableManifestSha256'] ?? null)
            !== ESPOCRM_ATTESTED_CORE_TABLE_MANIFEST_SHA256
    ) {
        throw new RuntimeException('Restore rehearsal evidence checks are incomplete or failed.');
    }
}

try {
    $recoveryMaxAge = filter_var(
        getenv('ESPOCRM_RECOVERY_MAX_AGE_SECONDS') ?: '86400',
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 900, 'max_range' => 604800]],
    );
    $rehearsalMaxAge = filter_var(
        getenv('ESPOCRM_RESTORE_REHEARSAL_MAX_AGE_SECONDS') ?: '2592000',
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 3600, 'max_range' => 7776000]],
    );

    if ($recoveryMaxAge === false || $rehearsalMaxAge === false) {
        throw new RuntimeException('Deployment evidence age policy is invalid.');
    }

    assertIdentifier('ESPOCRM_CHANGE_ID');
    assertIdentifier('ESPOCRM_RECOVERY_POINT_ID');
    assertRecentTimestamp('ESPOCRM_RECOVERY_POINT_CREATED_AT', $recoveryMaxAge);
    assertDigest('ESPOCRM_RECOVERY_POINT_DATABASE_SHA256');
    assertDigest('ESPOCRM_RECOVERY_POINT_APPLICATION_SHA256');
    assertIdentifier('ESPOCRM_RESTORE_REHEARSAL_ID');
    assertRecentTimestamp('ESPOCRM_RESTORE_REHEARSED_AT', $rehearsalMaxAge);
    assertDigest('ESPOCRM_RESTORE_REHEARSAL_EVIDENCE_SHA256');

    $sourceVersion = requiredAttestationValue('ESPOCRM_MUTATION_SOURCE_VERSION');
    $targetVersion = requiredAttestationValue('ESPOCRM_VERSION');
    $rehearsalSourceVersion = requiredAttestationValue(
        'ESPOCRM_RESTORE_REHEARSAL_SOURCE_VERSION',
    );

    if (!hash_equals(ESPOCRM_ATTESTED_CORE_VERSION, $targetVersion)) {
        throw new RuntimeException('Deployment target does not match the pinned EspoCRM core version.');
    }

    if (!hash_equals($sourceVersion, $rehearsalSourceVersion)) {
        throw new RuntimeException('Restore rehearsal source is not bound to the installed core version.');
    }

    if (
        !hash_equals($sourceVersion, $targetVersion)
        && !(hash_equals(ESPOCRM_ATTESTED_UPGRADE_SOURCE_VERSION, $sourceVersion)
            && hash_equals(ESPOCRM_ATTESTED_CORE_VERSION, $targetVersion))
    ) {
        throw new RuntimeException('Restore rehearsal does not authorize this core transition.');
    }

    assertEvidenceBinding(readBoundRestoreEvidence());
} catch (Throwable $exception) {
    fwrite(STDERR, "error: {$exception->getMessage()}\n");
    exit(78);
}
