<?php

declare(strict_types=1);

require '/opt/marcsmusic/runtime.php';

$mode = $argv[1] ?? '';

try {
    if ($mode === 'assert-environment') {
        marcsmusic_assert_environment_contract();
        exit(0);
    }

    if ($mode === 'assert-payload') {
        marcsmusic_assert_installed_outreach_payload();
        exit(0);
    }

    if ($mode === 'state') {
        $configuration = marcsmusic_load_espocrm_configuration();

        fwrite(
            STDOUT,
            ($configuration['isInstalled'] ?? null) === true ? "installed\n" : "uninstalled\n",
        );
        exit(0);
    }

    if ($mode === 'version') {
        $configuration = marcsmusic_load_espocrm_configuration();
        $version = $configuration['version'] ?? null;

        if (!is_string($version) || preg_match('/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/D', $version) !== 1) {
            throw new RuntimeException('Installed EspoCRM version state is invalid.');
        }

        fwrite(STDOUT, $version . "\n");
        exit(0);
    }

    $configuration = marcsmusic_load_espocrm_configuration();

    if ($mode === 'assert-runtime') {
        marcsmusic_assert_runtime_migration_source($configuration);
        exit(0);
    }

    if ($mode === 'assert-ready') {
        marcsmusic_assert_ready_configuration($configuration);
        exit(0);
    }

    fwrite(STDERR, "Usage: validate-runtime-config.php <state|version|assert-environment|assert-payload|assert-runtime|assert-ready>\n");
    exit(64);
} catch (Throwable $exception) {
    fwrite(STDERR, "error: {$exception->getMessage()}\n");
    exit(78);
}
