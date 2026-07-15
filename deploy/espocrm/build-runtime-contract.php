<?php

declare(strict_types=1);

$outputPath = $argv[1] ?? '';
$baseImageIdentity = $argv[2] ?? '';

if (
    $outputPath === ''
    || $baseImageIdentity
        !== 'espocrm/espocrm:10.0.2-apache@sha256:ee13cdbcf52dc032d1e50a9b15d8774d2633c71dce4b2a9d208e3af6fbf40e35'
) {
    fwrite(STDERR, "Usage: build-runtime-contract.php <output> <pinned-base-image>\n");
    exit(64);
}

$roots = [
    '/opt/marcsmusic/image-build/Dockerfile',
    '/opt/marcsmusic/runtime.php',
    '/opt/marcsmusic-outreach-extension',
    '/opt/marcsmusic-outreach-extension.zip',
    '/opt/marcsmusic-outreach-extension.sha256',
    '/opt/marcsmusic-outreach-installed-payload.json',
    '/usr/local/bin/start-railway-espocrm',
    '/usr/local/bin/run-railway-espocrm',
    '/usr/local/bin/run-shared-espocrm-daemon',
    '/usr/local/bin/run-espocrm-watchdog',
    '/usr/local/bin/install-outreach-extension',
    '/usr/local/bin/espocrm-database-state',
    '/usr/local/bin/espocrm-validate-runtime-config',
    '/usr/local/bin/espocrm-runtime-attestation',
    '/usr/local/bin/espocrm-assert-outreach-schema',
    '/usr/local/bin/with-mysql-advisory-lock',
    '/usr/local/bin/espocrm-validate-deployment-attestation',
    '/usr/local/bin/build-espocrm-extension-package',
    '/usr/local/bin/build-espocrm-runtime-contract',
    '/usr/local/bin/tini',
    '/var/www/html/public/readyz.php',
    '/etc/apache2/mods-enabled/mpm_prefork.load',
    '/etc/apache2/mods-enabled/mpm_prefork.conf',
];

/** @var array<string, string> $entries */
$entries = ['base-image' => 'image:' . $baseImageIdentity];

$record = static function (string $path) use (&$entries): void {
    $metadata = lstat($path);

    if (!is_array($metadata)) {
        throw new RuntimeException("Runtime contract source cannot be inspected: {$path}");
    }

    $mode = sprintf('%04o', $metadata['mode'] & 07777);

    if (is_link($path)) {
        $target = readlink($path);

        if (!is_string($target) || $target === '') {
            throw new RuntimeException("Runtime contract symlink is invalid: {$path}");
        }

        $entries[$path] = "link:{$mode}:{$target}";
        return;
    }

    if (is_file($path)) {
        $digest = hash_file('sha256', $path);

        if (!is_string($digest)) {
            throw new RuntimeException("Runtime contract source cannot be hashed: {$path}");
        }

        $entries[$path] = "file:{$mode}:{$digest}";
        return;
    }

    if (is_dir($path)) {
        $entries[$path] = "directory:{$mode}";
        return;
    }

    throw new RuntimeException("Unsupported runtime contract source type: {$path}");
};

try {
    foreach ($roots as $root) {
        if (!file_exists($root) && !is_link($root)) {
            throw new RuntimeException("Runtime contract source is missing: {$root}");
        }

        $record($root);

        if (!is_dir($root) || is_link($root)) {
            continue;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator(
                $root,
                FilesystemIterator::CURRENT_AS_FILEINFO
                | FilesystemIterator::KEY_AS_PATHNAME
                | FilesystemIterator::SKIP_DOTS,
            ),
            RecursiveIteratorIterator::SELF_FIRST,
        );

        foreach ($iterator as $path => $_info) {
            $record((string) $path);
        }
    }

    ksort($entries, SORT_STRING);
    $context = hash_init('sha256');

    foreach ($entries as $path => $value) {
        hash_update($context, $path . "\0" . $value . "\0");
    }

    $digest = hash_final($context);

    if (file_put_contents($outputPath, $digest . "\n", LOCK_EX) !== 65) {
        throw new RuntimeException('Runtime contract digest cannot be written.');
    }
} catch (Throwable $exception) {
    fwrite(STDERR, "error: {$exception->getMessage()}\n");
    exit(78);
}
