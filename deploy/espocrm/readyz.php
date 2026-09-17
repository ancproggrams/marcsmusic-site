<?php

declare(strict_types=1);

require '/opt/marcsmusic/runtime.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo '{"status":"method_not_allowed"}';
    exit;
}

try {
    $runtimeMaintenancePath = MARCSMUSIC_ESPOCRM_ROOT
        . '/data/marcsmusic-runtime-maintenance';

    if (is_link($runtimeMaintenancePath)) {
        throw new RuntimeException('Runtime maintenance marker is symbolic.');
    }

    if (file_exists($runtimeMaintenancePath)) {
        if (!is_file($runtimeMaintenancePath)) {
            throw new RuntimeException('Runtime maintenance marker is malformed.');
        }

        throw new RuntimeException('EspoCRM runtime maintenance is active.');
    }

    marcsmusic_assert_runtime_attestation_current();

    echo '{"status":"ready"}';
} catch (Throwable) {
    http_response_code(503);
    echo '{"status":"not_ready"}';
}
