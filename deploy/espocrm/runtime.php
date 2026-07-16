<?php

declare(strict_types=1);

const MARCSMUSIC_ESPOCRM_ROOT = '/var/www/html';
const MARCSMUSIC_ESPOCRM_IMAGE_VERSION = '10.0.2';
const MARCSMUSIC_OUTREACH_PAYLOAD_MANIFEST = '/opt/marcsmusic-outreach-installed-payload.json';
const MARCSMUSIC_OUTREACH_MODULE_ROOT = 'custom/Espo/Modules/MarcsMusicOutreach';
const MARCSMUSIC_OUTREACH_ENTITY_DEFS_ROOT = '/opt/marcsmusic-outreach-extension/files/custom/Espo/Modules/MarcsMusicOutreach/Resources/metadata/entityDefs';
const MARCSMUSIC_RUNTIME_ATTESTATION_PATH = '/var/www/html/data/marcsmusic-runtime-attestation.json';
const MARCSMUSIC_RUNTIME_ATTESTATION_LOCK_PATH = '/var/www/html/data/marcsmusic-runtime-attestation.lock';
const MARCSMUSIC_RUNTIME_IMAGE_CONTRACT_PATH = '/opt/marcsmusic-runtime-contract.sha256';
const MARCSMUSIC_RUNTIME_DEPLOYMENT_CONTRACT_PATH = '/var/www/html/data/marcsmusic-runtime-contract.sha256';
const MARCSMUSIC_ESPOCRM_CORE_TABLE_MANIFEST_SHA256 = '88e9668e031d9f8a26b0cee47eecfe74ad74941111233bec29b5fb75e10dcc49';

/**
 * Complete base-table manifest generated from EspoCRM 10.0.0 and verified
 * unchanged by a clean install of the pinned 10.0.2 image. Additional
 * extension tables are permitted; omitting any core table is not.
 */
const MARCSMUSIC_ESPOCRM_CORE_TABLES = [
    'account',
    'account_contact',
    'account_document',
    'account_portal_user',
    'account_target_list',
    'action_history_record',
    'address_country',
    'app_log_record',
    'app_secret',
    'array_value',
    'attachment',
    'auth_log_record',
    'auth_token',
    'authentication_provider',
    'autofollow',
    'call',
    'call_contact',
    'call_lead',
    'call_user',
    'campaign',
    'campaign_log_record',
    'campaign_target_list',
    'campaign_target_list_excluding',
    'campaign_tracking_url',
    'case',
    'case_contact',
    'case_knowledge_base_article',
    'contact',
    'contact_document',
    'contact_meeting',
    'contact_opportunity',
    'contact_target_list',
    'currency',
    'currency_record',
    'currency_record_rate',
    'dashboard_template',
    'document',
    'document_folder',
    'document_folder_path',
    'document_lead',
    'document_opportunity',
    'email',
    'email_account',
    'email_address',
    'email_email_account',
    'email_email_address',
    'email_filter',
    'email_folder',
    'email_inbound_email',
    'email_queue_item',
    'email_template',
    'email_template_category',
    'email_template_category_path',
    'email_user',
    'entity_collaborator',
    'entity_email_address',
    'entity_phone_number',
    'entity_team',
    'entity_user',
    'export',
    'extension',
    'external_account',
    'group_email_folder',
    'group_email_folder_team',
    'import',
    'import_entity',
    'import_error',
    'inbound_email',
    'inbound_email_team',
    'integration',
    'job',
    'kanban_order',
    'knowledge_base_article',
    'knowledge_base_article_knowledge_base_category',
    'knowledge_base_article_portal',
    'knowledge_base_category',
    'knowledge_base_category_path',
    'layout_record',
    'layout_set',
    'lead',
    'lead_capture',
    'lead_capture_log_record',
    'lead_meeting',
    'lead_target_list',
    'mass_action',
    'mass_email',
    'mass_email_target_list',
    'mass_email_target_list_excluding',
    'meeting',
    'meeting_user',
    'next_number',
    'note',
    'note_portal',
    'note_team',
    'note_user',
    'notification',
    'o_auth_account',
    'o_auth_provider',
    'opportunity',
    'password_change_request',
    'phone_number',
    'pipeline',
    'pipeline_stage',
    'portal',
    'portal_portal_role',
    'portal_role',
    'portal_role_user',
    'portal_user',
    'preferences',
    'reminder',
    'role',
    'role_team',
    'role_user',
    'scheduled_job',
    'scheduled_job_log_record',
    'sms',
    'sms_phone_number',
    'star_subscription',
    'stream_subscription',
    'system_data',
    'target',
    'target_list',
    'target_list_category',
    'target_list_category_path',
    'target_list_user',
    'task',
    'team',
    'team_user',
    'template',
    'two_factor_code',
    'unique_id',
    'user',
    'user_data',
    'user_reaction',
    'user_working_time_range',
    'webhook',
    'webhook_event_queue_item',
    'webhook_queue_item',
    'working_time_calendar',
    'working_time_calendar_working_time_range',
    'working_time_range',
];

/**
 * Base schema guaranteed by the pinned EspoCRM image and its own installer.
 * Extension-owned columns are intentionally kept in
 * MARCSMUSIC_OUTREACH_CORE_SCHEMA below so database-state.php can admit a
 * vanilla install before the outreach extension migration runs.
 */
const MARCSMUSIC_ESPOCRM_CORE_SCHEMA = [
    'user' => ['id', 'user_name', 'is_active', 'deleted'],
    'job' => ['id', 'status', 'execute_time', 'deleted'],
    'scheduled_job' => ['id', 'name', 'status', 'scheduling', 'deleted'],
    'scheduled_job_log_record' => [
        'id',
        'status',
        'execution_time',
        'scheduled_job_id',
        'deleted',
    ],
    'attachment' => ['id', 'name', 'size', 'storage', 'deleted'],
    'team' => ['id', 'name', 'deleted'],
    'role' => ['id', 'name', 'deleted'],
    'lead' => ['id', 'first_name', 'last_name', 'status', 'deleted'],
    'contact' => ['id', 'first_name', 'last_name', 'deleted'],
    'account' => ['id', 'name', 'deleted'],
    'email' => [
        'id',
        'name',
        'status',
        'date_sent',
        'parent_id',
        'parent_type',
        'deleted',
    ],
    'campaign' => ['id', 'name', 'status', 'deleted'],
    'target_list' => ['id', 'name', 'deleted'],
    'opportunity' => ['id', 'name', 'stage', 'deleted'],
    'email_address' => ['id', 'name', 'lower', 'invalid', 'opt_out', 'deleted'],
    'note' => ['id', 'type', 'parent_id', 'parent_type', 'deleted'],
    'auth_token' => ['id', 'token', 'user_id', 'is_active', 'deleted'],
    'extension' => ['id', 'name', 'version', 'is_installed', 'deleted'],
];

/**
 * Columns added to EspoCRM core tables by the MarcsMusic outreach extension.
 *
 * These are intentionally separate from MARCSMUSIC_ESPOCRM_CORE_SCHEMA. The
 * base contract is used to classify a database before the extension migration
 * runs; requiring these columns there would classify a valid vanilla EspoCRM
 * install as a corrupt/foreign database and prevent the extension from ever
 * being installed. The extension contract is asserted only after the package
 * migration has completed.
 */
const MARCSMUSIC_OUTREACH_CORE_SCHEMA = [
    'email' => [
        'outreach_projection_key',
        'outreach_correlation_id',
        'outreach_provider_message_id',
        'outreach_deterministic_message_id',
        'outreach_accepted_at',
        'outreach_automatic_response',
        'outreach_match_id',
        'outreach_campaign_id',
        'music_release_id',
        'media_contact_id',
        'media_outlet_id',
    ],
    'campaign' => [
        'music_release_id',
        'outreach_target_list_id',
        'outreach_projection_key',
        'outreach_managed',
        'target_membership_projection_state',
        'target_membership_reason_code',
        'target_membership_review_id',
        'target_membership_checked_at',
        'target_membership_projected_at',
        'target_membership_count',
    ],
    'target_list' => [
        'outreach_projection_key',
        'outreach_managed',
        'music_release_id',
        'outreach_campaign_id',
        'eligibility_policy_version',
        'membership_projected_at',
    ],
    'opportunity' => [
        'campaign_id',
        'outreach_projection_key',
        'outreach_match_id',
        'music_release_id',
        'media_contact_id',
        'media_outlet_id',
        'source_outreach_event_id',
        'latest_outreach_event_id',
        'outreach_interest_status',
        'outreach_interest_at',
        'outreach_revenue_state',
    ],
];

/**
 * Version-specific secondary indexes that belong to the pinned EspoCRM core.
 * Index names are not part of the contract; ordered columns, uniqueness and
 * BTREE semantics are.
 */
const MARCSMUSIC_ESPOCRM_CORE_SECONDARY_INDEXES = [
    'user' => [
        ['columns' => ['user_name', 'delete_id'], 'unique' => true, 'primary' => false],
    ],
    'job' => [
        ['columns' => ['status', 'execute_time'], 'unique' => false, 'primary' => false],
        ['columns' => ['status', 'deleted'], 'unique' => false, 'primary' => false],
        ['columns' => ['status', 'scheduled_job_id'], 'unique' => false, 'primary' => false],
    ],
    'scheduled_job_log_record' => [
        ['columns' => ['scheduled_job_id', 'execution_time'], 'unique' => false, 'primary' => false],
    ],
    'email' => [
        ['columns' => ['date_sent', 'deleted'], 'unique' => false, 'primary' => false],
        ['columns' => ['date_sent', 'status', 'deleted'], 'unique' => false, 'primary' => false],
    ],
    'email_address' => [
        ['columns' => ['lower'], 'unique' => false, 'primary' => false],
    ],
    'lead' => [
        ['columns' => ['status', 'deleted'], 'unique' => false, 'primary' => false],
        ['columns' => ['created_at', 'id'], 'unique' => true, 'primary' => false],
    ],
    'auth_token' => [
        ['columns' => ['token', 'deleted'], 'unique' => false, 'primary' => false],
    ],
];

/**
 * Secondary indexes added by the MarcsMusic outreach extension to EspoCRM
 * core tables. These are checked only after the extension migration; keeping
 * them out of the base contract lets a vanilla but otherwise valid database
 * complete its first extension install.
 */
const MARCSMUSIC_OUTREACH_CORE_SECONDARY_INDEXES = [
    'email' => [
        ['columns' => ['outreach_projection_key'], 'unique' => true, 'primary' => false],
        ['columns' => ['outreach_correlation_id'], 'unique' => true, 'primary' => false],
        ['columns' => ['outreach_provider_message_id', 'deleted'], 'unique' => false, 'primary' => false],
        ['columns' => ['outreach_match_id', 'date_sent', 'deleted'], 'unique' => false, 'primary' => false],
        ['columns' => ['outreach_campaign_id', 'date_sent', 'deleted'], 'unique' => false, 'primary' => false],
    ],
    'campaign' => [
        ['columns' => ['outreach_projection_key'], 'unique' => true, 'primary' => false],
        ['columns' => ['music_release_id'], 'unique' => true, 'primary' => false],
        ['columns' => ['target_membership_projection_state', 'modified_at', 'deleted'], 'unique' => false, 'primary' => false],
    ],
    'target_list' => [
        ['columns' => ['outreach_projection_key'], 'unique' => true, 'primary' => false],
        ['columns' => ['music_release_id'], 'unique' => true, 'primary' => false],
    ],
    'opportunity' => [
        ['columns' => ['outreach_projection_key'], 'unique' => true, 'primary' => false],
        ['columns' => ['outreach_match_id'], 'unique' => true, 'primary' => false],
        ['columns' => ['source_outreach_event_id'], 'unique' => true, 'primary' => false],
        ['columns' => ['latest_outreach_event_id', 'deleted'], 'unique' => false, 'primary' => false],
        ['columns' => ['media_contact_id', 'outreach_interest_at', 'deleted'], 'unique' => false, 'primary' => false],
    ],
];

const MARCSMUSIC_OUTREACH_SCHEMA = [
    'music_release' => [
        'id',
        'name',
        'status',
        'isrc',
        'source_evidence_captured_at',
        'source_evidence_digest',
        'source_evidence_reference',
        'epk_attestation_state',
        'epk_manifest_sha256',
        'epk_verified_at',
        'epk_evidence_reference',
        'daily_send_limit',
        'deleted',
    ],
    'media_outlet' => [
        'id',
        'name',
        'fingerprint',
        'submission_policy',
        'activity_status',
        'deleted',
    ],
    'media_contact' => [
        'id',
        'first_name',
        'last_name',
        'show_name',
        'media_outlet_id',
        'status',
        'do_not_contact',
        'rejected_genres',
        'rejected_genres_updated_at',
        'rejected_genres_source_event_id',
        'future_release_interest',
        'future_release_genres',
        'future_release_interest_at',
        'future_release_interest_event_id',
        'deleted',
    ],
    'outreach_match' => [
        'id',
        'music_release_id',
        'media_contact_id',
        'media_outlet_id',
        'campaign_id',
        'idempotency_key',
        'campaign_status',
        'next_action_at',
        'deleted',
    ],
    'outreach_event' => [
        'id',
        'outreach_match_id',
        'music_release_id',
        'media_contact_id',
        'media_outlet_id',
        'campaign_id',
        'email_id',
        'event_type',
        'event_date',
        'external_event_id',
        'correlation_id',
        'deleted',
    ],
    'outreach_daily_report' => [
        'id',
        'report_date',
        'status',
        'deleted',
    ],
    'outreach_suppression' => [
        'id',
        'subject_type',
        'subject_hash',
        'active',
        'suppressed_at',
        'deleted',
    ],
];

/** @return non-empty-string */
function marcsmusic_required_environment(string $name): string
{
    $value = getenv($name);

    if (!is_string($value) || $value === '') {
        throw new RuntimeException("Required environment variable {$name} is missing.");
    }

    return $value;
}

function marcsmusic_read_regular_file(string $path, string $description): string
{
    if (!is_file($path) || is_link($path)) {
        throw new RuntimeException("{$description} is unavailable or symbolic.");
    }

    $value = file_get_contents($path);

    if (!is_string($value)) {
        throw new RuntimeException("{$description} cannot be read.");
    }

    return $value;
}

function marcsmusic_prepare_www_data_file(string $path, int $mode): void
{
    if (!function_exists('posix_getpwnam') || !function_exists('posix_getgrnam')) {
        throw new RuntimeException('POSIX identity lookup is unavailable.');
    }

    $user = posix_getpwnam('www-data');
    $group = posix_getgrnam('www-data');

    if (!is_array($user) || !is_int($user['uid'] ?? null) ||
        !is_array($group) || !is_int($group['gid'] ?? null)) {
        throw new RuntimeException('www-data identity cannot be resolved.');
    }

    clearstatcache(true, $path);
    $owner = fileowner($path);
    $fileGroup = filegroup($path);

    if (
        !is_int($owner)
        || !is_int($fileGroup)
        || ($owner !== $user['uid'] && !chown($path, $user['uid']))
        || ($fileGroup !== $group['gid'] && !chgrp($path, $group['gid']))
        || !chmod($path, $mode)
    ) {
        throw new RuntimeException('Runtime file ownership cannot be established.');
    }
}

function marcsmusic_atomic_write_runtime_file(
    string $path,
    string $contents,
    string $description,
): void {
    if (is_link($path) || (file_exists($path) && !is_file($path))) {
        throw new RuntimeException("{$description} path is symbolic or non-regular.");
    }

    $temporaryPath = tempnam(dirname($path), 'marcsmusic-runtime.tmp.');

    if (!is_string($temporaryPath)) {
        throw new RuntimeException("{$description} temporary file cannot be created.");
    }

    try {
        $handle = fopen($temporaryPath, 'wb');

        if (!is_resource($handle)) {
            throw new RuntimeException("{$description} temporary file cannot be opened.");
        }

        try {
            if (fwrite($handle, $contents) !== strlen($contents) || !fflush($handle)) {
                throw new RuntimeException("{$description} cannot be written.");
            }

            if (function_exists('fsync') && !fsync($handle)) {
                throw new RuntimeException("{$description} cannot be synchronized.");
            }
        } finally {
            fclose($handle);
        }

        marcsmusic_prepare_www_data_file($temporaryPath, 0660);

        if (!rename($temporaryPath, $path)) {
            throw new RuntimeException("{$description} cannot be committed.");
        }
    } finally {
        if (is_file($temporaryPath)) {
            unlink($temporaryPath);
        }
    }
}

/**
 * @template T
 * @param callable(): T $operation
 * @return T
 */
function marcsmusic_with_runtime_attestation_lock(callable $operation): mixed
{
    $path = MARCSMUSIC_RUNTIME_ATTESTATION_LOCK_PATH;

    if (is_link($path) || (file_exists($path) && !is_file($path))) {
        throw new RuntimeException('Runtime attestation lock path is symbolic or non-regular.');
    }

    $handle = fopen($path, 'c+b');

    if (!is_resource($handle)) {
        throw new RuntimeException('Runtime attestation lock cannot be opened.');
    }

    try {
        marcsmusic_prepare_www_data_file($path, 0660);

        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Runtime attestation lock cannot be acquired.');
        }

        try {
            return $operation();
        } finally {
            flock($handle, LOCK_UN);
        }
    } finally {
        fclose($handle);
    }
}

/** @return non-empty-string */
function marcsmusic_runtime_image_contract(): string
{
    $digest = trim(marcsmusic_read_regular_file(
        MARCSMUSIC_RUNTIME_IMAGE_CONTRACT_PATH,
        'Runtime image contract',
    ));

    if (preg_match('/^[a-f0-9]{64}$/D', $digest) !== 1) {
        throw new RuntimeException('Runtime image contract is malformed.');
    }

    return $digest;
}

function marcsmusic_write_runtime_deployment_contract(): void
{
    marcsmusic_atomic_write_runtime_file(
        MARCSMUSIC_RUNTIME_DEPLOYMENT_CONTRACT_PATH,
        marcsmusic_runtime_image_contract() . "\n",
        'Runtime deployment contract',
    );
}

/** @return non-empty-string */
function marcsmusic_runtime_deployment_contract(): string
{
    $digest = trim(marcsmusic_read_regular_file(
        MARCSMUSIC_RUNTIME_DEPLOYMENT_CONTRACT_PATH,
        'Runtime deployment contract',
    ));

    if (preg_match('/^[a-f0-9]{64}$/D', $digest) !== 1) {
        throw new RuntimeException('Runtime deployment contract is malformed.');
    }

    return $digest;
}

function marcsmusic_assert_runtime_deployment_contract(): void
{
    $expected = marcsmusic_runtime_deployment_contract();
    $actual = marcsmusic_runtime_image_contract();

    if (!hash_equals($expected, $actual)) {
        throw new RuntimeException('Container image does not match the active runtime deployment contract.');
    }
}

/** @return array{checkedAt: int, coreVersion: string, extensionVersion: string, packageSha256: string, runtimeSha256: string} */
function marcsmusic_runtime_attestation_payload(int $checkedAt): array
{
    $manifest = json_decode(
        marcsmusic_read_regular_file(
            '/opt/marcsmusic-outreach-extension/manifest.json',
            'Outreach extension manifest',
        ),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $extensionVersion = is_array($manifest) ? ($manifest['version'] ?? null) : null;
    $packageDigest = trim(marcsmusic_read_regular_file(
        '/opt/marcsmusic-outreach-extension.sha256',
        'Outreach package digest',
    ));

    if (
        !is_string($extensionVersion)
        || preg_match('/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/D', $extensionVersion) !== 1
        || preg_match('/^[a-f0-9]{64}$/D', $packageDigest) !== 1
    ) {
        throw new RuntimeException('Runtime attestation source is invalid.');
    }

    return [
        'checkedAt' => $checkedAt,
        'coreVersion' => MARCSMUSIC_ESPOCRM_IMAGE_VERSION,
        'extensionVersion' => $extensionVersion,
        'packageSha256' => $packageDigest,
        'runtimeSha256' => marcsmusic_runtime_image_contract(),
    ];
}

/** @param array{checkedAt: int, coreVersion: string, extensionVersion: string, packageSha256: string, runtimeSha256: string} $payload */
function marcsmusic_runtime_attestation_signature(array $payload): string
{
    $canonical = json_encode(
        $payload,
        JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
    );

    return hash_hmac(
        'sha256',
        $canonical,
        marcsmusic_required_environment('ESPOCRM_CONFIG_HASH_SECRET_KEY'),
    );
}

function marcsmusic_assert_runtime_peer_active(string $expectedRuntimeDigest): void
{
    if (preg_match('/^[a-f0-9]{64}$/D', $expectedRuntimeDigest) !== 1) {
        throw new RuntimeException('Expected peer runtime digest is malformed.');
    }

    $document = json_decode(
        marcsmusic_read_regular_file(
            MARCSMUSIC_RUNTIME_ATTESTATION_PATH,
            'Runtime peer attestation',
        ),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );

    if (!is_array($document)) {
        throw new RuntimeException('Runtime peer attestation is malformed.');
    }

    $payload = [
        'checkedAt' => $document['checkedAt'] ?? null,
        'coreVersion' => $document['coreVersion'] ?? null,
        'extensionVersion' => $document['extensionVersion'] ?? null,
        'packageSha256' => $document['packageSha256'] ?? null,
        'runtimeSha256' => $document['runtimeSha256'] ?? null,
    ];
    $signature = $document['signature'] ?? null;

    if (
        !is_int($payload['checkedAt'])
        || !is_string($payload['coreVersion'])
        || !is_string($payload['extensionVersion'])
        || !is_string($payload['packageSha256'])
        || !is_string($payload['runtimeSha256'])
        || !is_string($signature)
        || count($document) !== 6
    ) {
        throw new RuntimeException('Runtime peer attestation fields are malformed.');
    }

    /** @var array{checkedAt: int, coreVersion: string, extensionVersion: string, packageSha256: string, runtimeSha256: string} $payload */
    if (!hash_equals(marcsmusic_runtime_attestation_signature($payload), $signature)) {
        throw new RuntimeException('Runtime peer attestation signature is invalid.');
    }

    $maxAge = filter_var(
        getenv('ESPOCRM_RUNTIME_PEER_MAX_AGE_SECONDS') ?: '180',
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 15, 'max_range' => 900]],
    );
    $now = time();

    if (
        $maxAge === false
        || $payload['checkedAt'] > $now + 5
        || $payload['checkedAt'] < $now - $maxAge
        || !hash_equals($expectedRuntimeDigest, $payload['runtimeSha256'])
    ) {
        throw new RuntimeException('No current attestation from the expected runtime peer is available.');
    }
}

function marcsmusic_write_runtime_attestation(): void
{
    marcsmusic_with_runtime_attestation_lock(static function (): void {
        marcsmusic_assert_runtime_deployment_contract();
        $payload = marcsmusic_runtime_attestation_payload(time());
        $document = $payload + [
            'signature' => marcsmusic_runtime_attestation_signature($payload),
        ];
        marcsmusic_atomic_write_runtime_file(
            MARCSMUSIC_RUNTIME_ATTESTATION_PATH,
            json_encode($document, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n",
            'Runtime attestation',
        );
    });
}

function marcsmusic_remove_runtime_attestation(): void
{
    marcsmusic_with_runtime_attestation_lock(static function (): void {
        $path = MARCSMUSIC_RUNTIME_ATTESTATION_PATH;

        if (is_link($path) || (file_exists($path) && !is_file($path))) {
            throw new RuntimeException('Runtime attestation path is symbolic or non-regular.');
        }

        if (!file_exists($path)) {
            return;
        }

        $localContract = marcsmusic_runtime_image_contract();

        if (!hash_equals(marcsmusic_runtime_deployment_contract(), $localContract)) {
            return;
        }

        $document = json_decode(
            marcsmusic_read_regular_file($path, 'Runtime attestation'),
            true,
        );
        $attestedContract = is_array($document) ? ($document['runtimeSha256'] ?? null) : null;

        if (!is_string($attestedContract) || !hash_equals($localContract, $attestedContract)) {
            return;
        }

        if (!unlink($path)) {
            throw new RuntimeException('Runtime attestation cannot be removed.');
        }
    });
}

function marcsmusic_assert_runtime_attestation_current(): void
{
    marcsmusic_assert_runtime_deployment_contract();
    $document = json_decode(
        marcsmusic_read_regular_file(
            MARCSMUSIC_RUNTIME_ATTESTATION_PATH,
            'Runtime attestation',
        ),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );

    if (!is_array($document)) {
        throw new RuntimeException('Runtime attestation is malformed.');
    }

    $payload = [
        'checkedAt' => $document['checkedAt'] ?? null,
        'coreVersion' => $document['coreVersion'] ?? null,
        'extensionVersion' => $document['extensionVersion'] ?? null,
        'packageSha256' => $document['packageSha256'] ?? null,
        'runtimeSha256' => $document['runtimeSha256'] ?? null,
    ];
    $signature = $document['signature'] ?? null;

    if (
        !is_int($payload['checkedAt'])
        || !is_string($payload['coreVersion'])
        || !is_string($payload['extensionVersion'])
        || !is_string($payload['packageSha256'])
        || !is_string($payload['runtimeSha256'])
        || !is_string($signature)
        || count($document) !== 6
    ) {
        throw new RuntimeException('Runtime attestation fields are malformed.');
    }

    /** @var array{checkedAt: int, coreVersion: string, extensionVersion: string, packageSha256: string, runtimeSha256: string} $payload */
    if (!hash_equals(marcsmusic_runtime_attestation_signature($payload), $signature)) {
        throw new RuntimeException('Runtime attestation signature is invalid.');
    }

    $maxAge = filter_var(
        getenv('ESPOCRM_RUNTIME_ATTESTATION_MAX_AGE_SECONDS') ?: '150',
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 15, 'max_range' => 900]],
    );
    $now = time();

    if (
        $maxAge === false
        || $payload['checkedAt'] > $now + 5
        || $payload['checkedAt'] < $now - $maxAge
    ) {
        throw new RuntimeException('Runtime attestation is stale.');
    }

    $expected = marcsmusic_runtime_attestation_payload($payload['checkedAt']);

    if ($payload !== $expected) {
        throw new RuntimeException('Runtime attestation does not match the image contract.');
    }

    $deploymentVersion = trim(marcsmusic_read_regular_file(
        MARCSMUSIC_ESPOCRM_ROOT . '/data/marcsmusic-outreach-extension-version',
        'Outreach deployment version',
    ));
    $deploymentDigest = trim(marcsmusic_read_regular_file(
        MARCSMUSIC_ESPOCRM_ROOT . '/data/marcsmusic-outreach-extension-sha256',
        'Outreach deployment digest',
    ));

    if (
        !hash_equals($payload['extensionVersion'], $deploymentVersion)
        || !hash_equals($payload['packageSha256'], $deploymentDigest)
    ) {
        throw new RuntimeException('Runtime attestation does not match committed deployment state.');
    }
}

/** @return array<string, mixed> */
function marcsmusic_load_espocrm_configuration(
    string $root = MARCSMUSIC_ESPOCRM_ROOT,
): array {
    $utilPath = $root . '/application/Espo/Core/Utils/Util.php';

    if (!class_exists(\Espo\Core\Utils\Util::class, false)) {
        if (!is_file($utilPath)) {
            throw new RuntimeException('EspoCRM configuration merge utility is unavailable.');
        }

        require_once $utilPath;
    }

    $configuration = [];

    foreach (
        [
            'application/Espo/Resources/defaults/systemConfig.php',
            'data/config.php',
            'data/config-internal.php',
            'data/config-override.php',
            'data/config-internal-override.php',
            'data/state.php',
        ] as $relativePath
    ) {
        $path = $root . '/' . $relativePath;

        if (!is_file($path)) {
            continue;
        }

        $fragment = (static fn (string $file): mixed => require $file)($path);

        if (!is_array($fragment)) {
            throw new RuntimeException("EspoCRM configuration file {$relativePath} is invalid.");
        }

        /** @var array<string, mixed> $fragment */
        /** @var array<string, mixed> $configuration */
        $configuration = \Espo\Core\Utils\Util::merge($configuration, $fragment);
    }

    return $configuration;
}

/** @param array<string, mixed> $configuration */
function marcsmusic_assert_stable_secrets(array $configuration): void
{
    $expected = [
        'passwordSalt' => marcsmusic_required_environment('ESPOCRM_CONFIG_PASSWORD_SALT'),
        'cryptKey' => marcsmusic_required_environment('ESPOCRM_CONFIG_CRYPT_KEY'),
        'hashSecretKey' => marcsmusic_required_environment('ESPOCRM_CONFIG_HASH_SECRET_KEY'),
    ];

    foreach ($expected as $key => $expectedValue) {
        $actual = $configuration[$key] ?? null;

        if (!is_string($actual) || !hash_equals($expectedValue, $actual)) {
            throw new RuntimeException("EspoCRM stable secret {$key} does not match its configured source.");
        }
    }
}

/** @param array<string, mixed> $configuration */
function marcsmusic_assert_ready_configuration(array $configuration): void
{
    marcsmusic_assert_stable_secrets($configuration);
    marcsmusic_assert_runtime_binding($configuration);

    if (($configuration['isInstalled'] ?? null) !== true) {
        throw new RuntimeException('EspoCRM is not marked as installed.');
    }

    if (($configuration['maintenanceMode'] ?? false) !== false) {
        throw new RuntimeException('EspoCRM maintenance mode is active or malformed.');
    }

    $expectedVersion = marcsmusic_required_environment('ESPOCRM_VERSION');
    $installedVersion = $configuration['version'] ?? null;

    if (!is_string($installedVersion) || !hash_equals($expectedVersion, $installedVersion)) {
        throw new RuntimeException('The EspoCRM runtime and configured versions do not match.');
    }
}

function marcsmusic_normalize_site_url(string $url): string
{
    $parts = parse_url($url);

    if (!is_array($parts)) {
        throw new RuntimeException('ESPOCRM_SITE_URL is invalid.');
    }

    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower((string) ($parts['host'] ?? ''));
    $path = (string) ($parts['path'] ?? '');
    $port = $parts['port'] ?? null;

    if (
        $scheme === ''
        || $host === ''
        || isset($parts['user'])
        || isset($parts['pass'])
        || isset($parts['query'])
        || isset($parts['fragment'])
        || ($path !== '' && $path !== '/')
    ) {
        throw new RuntimeException('ESPOCRM_SITE_URL must be an origin URL without credentials, path, query, or fragment.');
    }

    $localHosts = ['localhost', '127.0.0.1', '::1'];

    if ($scheme !== 'https' && !($scheme === 'http' && in_array($host, $localHosts, true))) {
        throw new RuntimeException('ESPOCRM_SITE_URL must use HTTPS outside local development.');
    }

    if ($port !== null && (!is_int($port) || $port < 1 || $port > 65535)) {
        throw new RuntimeException('ESPOCRM_SITE_URL contains an invalid port.');
    }

    $hostLiteral = str_contains($host, ':') ? "[{$host}]" : $host;

    return $scheme . '://' . $hostLiteral . ($port === null ? '' : ":{$port}");
}

function marcsmusic_assert_environment_contract(): void
{
    $platform = marcsmusic_required_environment('ESPOCRM_DATABASE_PLATFORM');

    if (!hash_equals('Mysql', $platform)) {
        throw new RuntimeException('ESPOCRM_DATABASE_PLATFORM must be Mysql.');
    }

    if (!hash_equals(
        MARCSMUSIC_ESPOCRM_IMAGE_VERSION,
        marcsmusic_required_environment('ESPOCRM_VERSION'),
    )) {
        throw new RuntimeException('ESPOCRM_VERSION does not match the pinned application image.');
    }

    marcsmusic_normalize_site_url(
        marcsmusic_required_environment('ESPOCRM_SITE_URL'),
    );

    if (
        getenv('RAILWAY_ENVIRONMENT_ID') !== false
        && !str_ends_with(
            strtolower(marcsmusic_required_environment('ESPOCRM_DATABASE_HOST')),
            '.railway.internal',
        )
    ) {
        throw new RuntimeException(
            'Railway EspoCRM must use its environment-isolated encrypted private database hostname.',
        );
    }
}

/** @param array<string, mixed> $configuration */
function marcsmusic_assert_runtime_binding(array $configuration): void
{
    marcsmusic_assert_environment_contract();

    $database = $configuration['database'] ?? null;

    if (!is_array($database)) {
        throw new RuntimeException('EspoCRM database configuration is unavailable.');
    }

    $expected = [
        'platform' => marcsmusic_required_environment('ESPOCRM_DATABASE_PLATFORM'),
        'host' => marcsmusic_required_environment('ESPOCRM_DATABASE_HOST'),
        'port' => getenv('ESPOCRM_DATABASE_PORT') ?: '3306',
        'dbname' => marcsmusic_required_environment('ESPOCRM_DATABASE_NAME'),
        'user' => marcsmusic_required_environment('ESPOCRM_DATABASE_USER'),
        'password' => marcsmusic_required_environment('ESPOCRM_DATABASE_PASSWORD'),
    ];

    foreach ($expected as $key => $expectedValue) {
        $actual = $database[$key] ?? null;

        if ((string) $actual !== $expectedValue) {
            throw new RuntimeException("EspoCRM database binding {$key} does not match its configured source.");
        }
    }

    $actualSiteUrl = $configuration['siteUrl'] ?? null;

    if (!is_string($actualSiteUrl)) {
        throw new RuntimeException('EspoCRM site URL configuration is unavailable.');
    }

    if (!hash_equals(
        marcsmusic_normalize_site_url(marcsmusic_required_environment('ESPOCRM_SITE_URL')),
        marcsmusic_normalize_site_url($actualSiteUrl),
    )) {
        throw new RuntimeException('EspoCRM site URL does not match its configured source.');
    }
}

/** @param array<string, mixed> $configuration */
function marcsmusic_assert_runtime_migration_source(array $configuration): void
{
    marcsmusic_assert_stable_secrets($configuration);
    marcsmusic_assert_runtime_binding($configuration);

    $installedVersion = $configuration['version'] ?? null;
    $targetVersion = marcsmusic_required_environment('ESPOCRM_VERSION');

    if (
        !is_string($installedVersion)
        || preg_match('/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/D', $installedVersion) !== 1
    ) {
        throw new RuntimeException('Installed EspoCRM version state is invalid.');
    }

    if (hash_equals($targetVersion, $installedVersion)) {
        return;
    }

    if (
        hash_equals('10.0.0', $installedVersion)
        && hash_equals(MARCSMUSIC_ESPOCRM_IMAGE_VERSION, $targetVersion)
        && hash_equals('true', getenv('ESPOCRM_INTERNAL_MUTATION_EVIDENCE_VALIDATED') ?: '')
        && hash_equals(
            $installedVersion,
            getenv('ESPOCRM_RESTORE_REHEARSAL_SOURCE_VERSION') ?: '',
        )
    ) {
        return;
    }

    throw new RuntimeException(
        'The EspoCRM core transition is not covered by validated restore evidence.',
    );
}

function marcsmusic_database_connection(): PDO
{
    $host = marcsmusic_required_environment('ESPOCRM_DATABASE_HOST');
    $port = getenv('ESPOCRM_DATABASE_PORT') ?: '3306';
    $database = marcsmusic_required_environment('ESPOCRM_DATABASE_NAME');
    $user = marcsmusic_required_environment('ESPOCRM_DATABASE_USER');
    $password = marcsmusic_required_environment('ESPOCRM_DATABASE_PASSWORD');

    if (!preg_match('/^[a-zA-Z0-9._:\\[\\]-]+$/D', $host) || str_contains($host, ';')) {
        throw new RuntimeException('EspoCRM database host is invalid.');
    }

    if (
        !preg_match('/^[0-9]{1,5}$/D', $port)
        || (int) $port < 1
        || (int) $port > 65535
    ) {
        throw new RuntimeException('EspoCRM database port is invalid.');
    }

    if (!preg_match('/^[a-zA-Z0-9_$-]{1,64}$/D', $database)) {
        throw new RuntimeException('EspoCRM database name is invalid.');
    }

    return new PDO(
        sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database),
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 3,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => false,
        ],
    );
}

/**
 * @param array<string, list<string>> $schema
 * @return list<string>
 */
function marcsmusic_missing_database_columns(PDO $pdo, array $schema): array
{
    $database = marcsmusic_required_environment('ESPOCRM_DATABASE_NAME');
    $tables = array_keys($schema);
    $placeholders = implode(', ', array_fill(0, count($tables), '?'));
    $statement = $pdo->prepare(
        "SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
           FROM information_schema.columns
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME IN ({$placeholders})",
    );
    $statement->execute([$database, ...$tables]);

    /** @var array<string, array<string, true>> $present */
    $present = [];

    while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
        $table = $row['table_name'] ?? null;
        $column = $row['column_name'] ?? null;

        if (is_string($table) && is_string($column)) {
            $present[$table][$column] = true;
        }
    }

    $missing = [];

    foreach ($schema as $table => $columns) {
        foreach ($columns as $column) {
            if (!isset($present[$table][$column])) {
                $missing[] = "{$table}.{$column}";
            }
        }
    }

    return $missing;
}

function marcsmusic_assert_core_table_manifest_integrity(): void
{
    $tables = MARCSMUSIC_ESPOCRM_CORE_TABLES;
    $sortedTables = $tables;
    sort($sortedTables, SORT_STRING);
    $digest = hash('sha256', implode("\n", $tables) . "\n");

    if (
        count($tables) !== 141
        || count(array_unique($tables, SORT_STRING)) !== count($tables)
        || $tables !== $sortedTables
        || !hash_equals(MARCSMUSIC_ESPOCRM_CORE_TABLE_MANIFEST_SHA256, $digest)
    ) {
        throw new LogicException('Pinned EspoCRM core table manifest is invalid.');
    }
}

/**
 * @param list<string> $requiredTables
 * @return list<string>
 */
function marcsmusic_missing_database_tables(PDO $pdo, array $requiredTables): array
{
    $database = marcsmusic_required_environment('ESPOCRM_DATABASE_NAME');
    $placeholders = implode(', ', array_fill(0, count($requiredTables), '?'));
    $statement = $pdo->prepare(
        "SELECT TABLE_NAME AS table_name
           FROM information_schema.tables
          WHERE TABLE_SCHEMA = ?
            AND TABLE_TYPE = 'BASE TABLE'
            AND TABLE_NAME IN ({$placeholders})",
    );
    $statement->execute([$database, ...$requiredTables]);

    /** @var list<string> $present */
    $present = $statement->fetchAll(PDO::FETCH_COLUMN);

    return array_values(array_diff($requiredTables, $present));
}

/**
 * @param list<string> $requiredTables
 * @return list<string>
 */
function marcsmusic_non_innodb_tables(PDO $pdo, array $requiredTables): array
{
    $database = marcsmusic_required_environment('ESPOCRM_DATABASE_NAME');
    $placeholders = implode(', ', array_fill(0, count($requiredTables), '?'));
    $statement = $pdo->prepare(
        "SELECT TABLE_NAME AS table_name, ENGINE AS engine
           FROM information_schema.tables
          WHERE TABLE_SCHEMA = ?
            AND TABLE_TYPE = 'BASE TABLE'
            AND TABLE_NAME IN ({$placeholders})",
    );
    $statement->execute([$database, ...$requiredTables]);

    /** @var array<string, string> $engines */
    $engines = [];

    while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
        $table = $row['table_name'] ?? null;
        $engine = $row['engine'] ?? null;

        if (is_string($table) && is_string($engine)) {
            $engines[$table] = strtoupper($engine);
        }
    }

    return array_values(array_filter(
        $requiredTables,
        static fn (string $table): bool => ($engines[$table] ?? null) !== 'INNODB',
    ));
}

/**
 * @param array<string, list<array{columns: list<string>, unique: bool, primary: bool}>> $requiredIndexes
 * @return list<string>
 */
function marcsmusic_missing_database_indexes(PDO $pdo, array $requiredIndexes): array
{
    $database = marcsmusic_required_environment('ESPOCRM_DATABASE_NAME');
    $tables = array_keys($requiredIndexes);
    $placeholders = implode(', ', array_fill(0, count($tables), '?'));
    $statement = $pdo->prepare(
        "SELECT TABLE_NAME AS table_name,
                INDEX_NAME AS index_name,
                COLUMN_NAME AS column_name,
                SEQ_IN_INDEX AS seq_in_index,
                NON_UNIQUE AS non_unique,
                SUB_PART AS sub_part,
                INDEX_TYPE AS index_type
           FROM information_schema.statistics
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME IN ({$placeholders})
          ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
    );
    $statement->execute([$database, ...$tables]);

    /** @var array<string, array<string, array{columns: list<string>, unique: bool, primary: bool}>> $present */
    $present = [];
    /** @var array<string, array<string, true>> $invalid */
    $invalid = [];

    while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
        $table = $row['table_name'] ?? null;
        $index = $row['index_name'] ?? null;
        $column = $row['column_name'] ?? null;
        $nonUnique = $row['non_unique'] ?? null;
        $subPart = $row['sub_part'] ?? null;
        $indexType = $row['index_type'] ?? null;

        if (!is_string($table) || !is_string($index)) {
            continue;
        }

        if (
            !is_string($column)
            || $subPart !== null
            || !is_string($indexType)
            || strtoupper($indexType) !== 'BTREE'
            || !($nonUnique === 0 || $nonUnique === 1 || $nonUnique === '0' || $nonUnique === '1')
        ) {
            $invalid[$table][$index] = true;
            continue;
        }

        $present[$table][$index] ??= [
            'columns' => [],
            'unique' => (int) $nonUnique === 0,
            'primary' => $index === 'PRIMARY',
        ];
        $present[$table][$index]['columns'][] = $column;
    }

    foreach ($invalid as $table => $indexes) {
        foreach (array_keys($indexes) as $index) {
            unset($present[$table][$index]);
        }
    }

    $missing = [];

    foreach ($requiredIndexes as $table => $indexes) {
        $presentSequences = array_values($present[$table] ?? []);

        foreach ($indexes as $requiredIndex) {
            if (!in_array($requiredIndex, $presentSequences, true)) {
                $missing[] = $table . '(' . implode(',', $requiredIndex['columns']) . ')';
            }
        }
    }

    return $missing;
}

/**
 * @param list<string> $tables
 * @return array<string, list<array{columns: list<string>, unique: bool, primary: bool}>>
 */
function marcsmusic_primary_key_contract(array $tables): array
{
    $result = [];

    foreach ($tables as $table) {
        $result[$table] = [[
            'columns' => ['id'],
            'unique' => true,
            'primary' => true,
        ]];
    }

    return $result;
}

/** @return array<string, list<array{columns: list<string>, unique: bool, primary: bool}>> */
function marcsmusic_expected_core_indexes(): array
{
    $result = marcsmusic_primary_key_contract(MARCSMUSIC_ESPOCRM_CORE_TABLES);

    foreach (MARCSMUSIC_ESPOCRM_CORE_SECONDARY_INDEXES as $table => $indexes) {
        foreach ($indexes as $index) {
            $result[$table][] = $index;
        }
    }

    return $result;
}

/** @return array<string, list<array{columns: list<string>, unique: bool, primary: bool}>> */
function marcsmusic_expected_outreach_indexes(): array
{
    $entities = [
        'music_release' => 'MusicRelease',
        'media_outlet' => 'MediaOutlet',
        'media_contact' => 'MediaContact',
        'outreach_match' => 'OutreachMatch',
        'outreach_event' => 'OutreachEvent',
        'outreach_daily_report' => 'OutreachDailyReport',
        'outreach_suppression' => 'OutreachSuppression',
    ];
    // Start with extension-owned indexes on EspoCRM core tables. Entity
    // definitions below contribute the outreach-owned table indexes.
    $result = MARCSMUSIC_OUTREACH_CORE_SECONDARY_INDEXES;

    foreach ($entities as $table => $entity) {
        $result[$table] = marcsmusic_primary_key_contract([$table])[$table];
        $path = MARCSMUSIC_OUTREACH_ENTITY_DEFS_ROOT . "/{$entity}.json";

        if (!is_file($path) || is_link($path)) {
            throw new RuntimeException("Outreach entity definition {$entity} is unavailable.");
        }

        $definition = json_decode(
            (string) file_get_contents($path),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $indexes = is_array($definition) ? ($definition['indexes'] ?? null) : null;

        if (!is_array($indexes)) {
            throw new RuntimeException("Outreach entity definition {$entity} has no index contract.");
        }

        foreach ($indexes as $index) {
            $columns = is_array($index) ? ($index['columns'] ?? null) : null;

            if (!is_array($columns) || $columns === []) {
                throw new RuntimeException("Outreach entity definition {$entity} has an invalid index.");
            }

            $normalizedColumns = [];

            foreach ($columns as $column) {
                if (!is_string($column) || preg_match('/^[a-z][a-zA-Z0-9]*$/D', $column) !== 1) {
                    throw new RuntimeException("Outreach entity definition {$entity} has an unsafe index column.");
                }

                $normalized = preg_replace('/(?<!^)[A-Z]/', '_$0', $column);

                if (!is_string($normalized)) {
                    throw new RuntimeException('Outreach index column could not be normalized.');
                }

                $normalizedColumns[] = strtolower($normalized);
            }

            $result[$table][] = [
                'columns' => $normalizedColumns,
                'unique' => ($index['unique'] ?? false) === true,
                'primary' => false,
            ];
        }
    }

    return $result;
}

function marcsmusic_assert_core_schema(PDO $pdo): void
{
    marcsmusic_assert_core_table_manifest_integrity();
    $missingTables = marcsmusic_missing_database_tables(
        $pdo,
        MARCSMUSIC_ESPOCRM_CORE_TABLES,
    );
    $missingColumns = marcsmusic_missing_database_columns(
        $pdo,
        MARCSMUSIC_ESPOCRM_CORE_SCHEMA,
    );
    $missingIndexes = marcsmusic_missing_database_indexes(
        $pdo,
        marcsmusic_expected_core_indexes(),
    );
    $invalidEngines = marcsmusic_non_innodb_tables(
        $pdo,
        MARCSMUSIC_ESPOCRM_CORE_TABLES,
    );

    if (
        $missingTables !== []
        || $missingColumns !== []
        || $missingIndexes !== []
        || $invalidEngines !== []
    ) {
        throw new RuntimeException(sprintf(
            'Required EspoCRM core schema contract is incomplete: missing tables [%s]; missing columns [%s]; missing indexes [%s]; non-InnoDB tables [%s].',
            implode(', ', $missingTables),
            implode(', ', $missingColumns),
            implode(', ', $missingIndexes),
            implode(', ', $invalidEngines),
        ));
    }
}

function marcsmusic_assert_outreach_schema(PDO $pdo): void
{
    $outreachSchema = array_merge(
        MARCSMUSIC_OUTREACH_CORE_SCHEMA,
        MARCSMUSIC_OUTREACH_SCHEMA,
    );
    $missingColumns = marcsmusic_missing_database_columns(
        $pdo,
        $outreachSchema,
    );
    $missingIndexes = marcsmusic_missing_database_indexes(
        $pdo,
        marcsmusic_expected_outreach_indexes(),
    );
    $invalidEngines = marcsmusic_non_innodb_tables(
        $pdo,
        array_keys($outreachSchema),
    );

    if ($missingColumns !== [] || $missingIndexes !== [] || $invalidEngines !== []) {
        throw new RuntimeException(sprintf(
            'Required EspoCRM outreach schema contract is incomplete: missing columns [%s]; missing indexes [%s]; non-InnoDB tables [%s].',
            implode(', ', $missingColumns),
            implode(', ', $missingIndexes),
            implode(', ', $invalidEngines),
        ));
    }
}

function marcsmusic_assert_installed_outreach_payload(
    string $root = MARCSMUSIC_ESPOCRM_ROOT,
    string $manifestPath = MARCSMUSIC_OUTREACH_PAYLOAD_MANIFEST,
): void {
    if (!is_file($manifestPath) || is_link($manifestPath)) {
        throw new RuntimeException('Outreach installed-payload manifest is unavailable.');
    }

    $manifest = json_decode(
        (string) file_get_contents($manifestPath),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );

    if (!is_array($manifest) || $manifest === []) {
        throw new RuntimeException('Outreach installed-payload manifest is invalid.');
    }

    $moduleRoot = $root . '/' . MARCSMUSIC_OUTREACH_MODULE_ROOT;

    if (!is_dir($moduleRoot) || is_link($moduleRoot)) {
        throw new RuntimeException('Outreach installed module root is unavailable or symbolic.');
    }

    $expectedPaths = [];

    foreach ($manifest as $relativePath => $expectedDigest) {
        if (
            !is_string($relativePath)
            || !is_string($expectedDigest)
            || preg_match('/^[a-f0-9]{64}$/D', $expectedDigest) !== 1
            || !str_starts_with(
                $relativePath,
                MARCSMUSIC_OUTREACH_MODULE_ROOT . '/',
            )
            || str_contains($relativePath, '..')
        ) {
            throw new RuntimeException('Outreach installed-payload manifest contains an unsafe entry.');
        }

        $installedPath = $root . '/' . $relativePath;

        if (!is_file($installedPath) || is_link($installedPath)) {
            throw new RuntimeException('Outreach installed payload is missing or symbolic.');
        }

        $actualDigest = hash_file('sha256', $installedPath);

        if (!is_string($actualDigest) || !hash_equals($expectedDigest, $actualDigest)) {
            throw new RuntimeException('Outreach installed payload has drifted from its package.');
        }

        $expectedPaths[] = $relativePath;
    }

    $actualPaths = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(
            $moduleRoot,
            FilesystemIterator::SKIP_DOTS,
        ),
        RecursiveIteratorIterator::SELF_FIRST,
    );

    foreach ($iterator as $fileInfo) {
        if ($fileInfo->isLink()) {
            throw new RuntimeException('Outreach installed payload contains a symbolic link.');
        }

        if (!$fileInfo->isFile()) {
            continue;
        }

        $absolutePath = $fileInfo->getPathname();
        $relativePath = substr($absolutePath, strlen($root) + 1);

        if (!is_string($relativePath) || $relativePath === '') {
            throw new RuntimeException('Outreach installed payload path cannot be normalized.');
        }

        $actualPaths[] = str_replace(DIRECTORY_SEPARATOR, '/', $relativePath);
    }

    sort($expectedPaths, SORT_STRING);
    sort($actualPaths, SORT_STRING);

    if ($actualPaths !== $expectedPaths) {
        throw new RuntimeException('Outreach installed payload contains untracked files.');
    }
}
