<?php

declare(strict_types=1);

require '/opt/marcsmusic/runtime.php';

$mode = $argv[1] ?? '';

try {
    if ($mode === 'image-contract') {
        fwrite(STDOUT, marcsmusic_runtime_image_contract() . "\n");
        exit(0);
    }

    if ($mode === 'write-deployment-contract') {
        marcsmusic_write_runtime_deployment_contract();
        exit(0);
    }

    if ($mode === 'deployment-contract') {
        fwrite(STDOUT, marcsmusic_runtime_deployment_contract() . "\n");
        exit(0);
    }

    if ($mode === 'assert-deployment-contract') {
        marcsmusic_assert_runtime_deployment_contract();
        exit(0);
    }

    if ($mode === 'assert-peer-active') {
        marcsmusic_assert_runtime_peer_active($argv[2] ?? '');
        exit(0);
    }

    if ($mode === 'write') {
        marcsmusic_write_runtime_attestation();
        exit(0);
    }

    if ($mode === 'remove') {
        marcsmusic_remove_runtime_attestation();
        exit(0);
    }

    if ($mode === 'assert-current') {
        marcsmusic_assert_runtime_attestation_current();
        exit(0);
    }

    fwrite(
        STDERR,
        "Usage: runtime-attestation.php <image-contract|deployment-contract|write-deployment-contract|assert-deployment-contract|assert-peer-active DIGEST|write|remove|assert-current>\n",
    );
    exit(64);
} catch (Throwable $exception) {
    fwrite(STDERR, "error: {$exception->getMessage()}\n");
    exit(78);
}
