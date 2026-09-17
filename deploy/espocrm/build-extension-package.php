<?php

declare(strict_types=1);

/**
 * Build a deterministic EspoCRM extension package from a version-controlled source tree.
 *
 * Usage: php build-extension-package.php <source-directory> <destination.zip> <payload-manifest.json>
 */

if ($argc !== 4) {
    fwrite(STDERR, "Usage: php build-extension-package.php <source-directory> <destination.zip> <payload-manifest.json>\n");
    exit(64);
}

if (!class_exists(ZipArchive::class)) {
    fwrite(STDERR, "The PHP zip extension is required to build the EspoCRM package.\n");
    exit(69);
}

$sourceDirectory = realpath($argv[1]);
$destination = $argv[2];
$payloadManifestDestination = $argv[3];

if ($sourceDirectory === false || !is_dir($sourceDirectory)) {
    fwrite(STDERR, "Extension source directory does not exist: {$argv[1]}\n");
    exit(66);
}

$manifestPath = $sourceDirectory . DIRECTORY_SEPARATOR . 'manifest.json';

try {
    $manifest = json_decode(
        (string) file_get_contents($manifestPath),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
} catch (Throwable $exception) {
    fwrite(STDERR, "Invalid extension manifest: {$exception->getMessage()}\n");
    exit(65);
}

if (!is_array($manifest) || !is_string($manifest['name'] ?? null) || !is_string($manifest['version'] ?? null)) {
    fwrite(STDERR, "Extension manifest requires string name and version properties.\n");
    exit(65);
}

if (preg_match('/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/D', $manifest['version']) !== 1) {
    fwrite(STDERR, "Extension manifest version must use semantic version syntax.\n");
    exit(65);
}

$versionFilePath = $sourceDirectory
    . '/files/custom/Espo/Modules/MarcsMusicOutreach/Resources/version.json';

try {
    $versionFile = json_decode(
        (string) file_get_contents($versionFilePath),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
} catch (Throwable $exception) {
    fwrite(STDERR, "Invalid extension version marker: {$exception->getMessage()}\n");
    exit(65);
}

if (!is_array($versionFile) || ($versionFile['version'] ?? null) !== $manifest['version']) {
    fwrite(STDERR, "Manifest and installed-file marker versions must match.\n");
    exit(65);
}

$archiveTimestamp = strtotime((string) ($manifest['releaseDate'] ?? '') . 'T00:00:00Z');

if ($archiveTimestamp === false) {
    fwrite(STDERR, "Extension manifest requires a valid releaseDate.\n");
    exit(65);
}

$files = ['manifest.json'];
$payloadDigests = [];

foreach (['files', 'scripts'] as $directoryName) {
    $directory = $sourceDirectory . DIRECTORY_SEPARATOR . $directoryName;

    if (!is_dir($directory)) {
        continue;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY,
    );

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile() || $fileInfo->isLink()) {
            continue;
        }

        $absolutePath = $fileInfo->getPathname();
        $relativePath = substr($absolutePath, strlen($sourceDirectory) + 1);

        if ($relativePath === false || str_contains($relativePath, '..')) {
            fwrite(STDERR, "Unsafe extension path encountered: {$absolutePath}\n");
            exit(65);
        }

        $relativePath = str_replace(DIRECTORY_SEPARATOR, '/', $relativePath);
        $files[] = $relativePath;

        if (str_starts_with($relativePath, 'files/')) {
            $installedPath = substr($relativePath, strlen('files/'));

            if (
                $installedPath === false
                || !str_starts_with($installedPath, 'custom/Espo/Modules/MarcsMusicOutreach/')
            ) {
                fwrite(STDERR, "Extension payload escapes its owned module root: {$relativePath}\n");
                exit(65);
            }

            $digest = hash_file('sha256', $absolutePath);

            if (!is_string($digest)) {
                fwrite(STDERR, "Could not hash extension payload: {$relativePath}\n");
                exit(74);
            }

            $payloadDigests[$installedPath] = $digest;
        }
    }
}

sort($files, SORT_STRING);

$zip = new ZipArchive();
$openResult = $zip->open($destination, ZipArchive::CREATE | ZipArchive::OVERWRITE);

if ($openResult !== true) {
    fwrite(STDERR, "Could not create package {$destination}; ZipArchive error {$openResult}.\n");
    exit(73);
}

foreach ($files as $relativePath) {
    $absolutePath = $sourceDirectory . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

    if (!$zip->addFile($absolutePath, $relativePath)) {
        $zip->close();
        fwrite(STDERR, "Could not add {$relativePath} to the extension package.\n");
        exit(74);
    }

    if (!$zip->setMtimeName($relativePath, $archiveTimestamp)) {
        $zip->close();
        fwrite(STDERR, "Could not normalize the archive timestamp for {$relativePath}.\n");
        exit(74);
    }
}

if (!$zip->close()) {
    fwrite(STDERR, "Could not finalize extension package {$destination}.\n");
    exit(74);
}

ksort($payloadDigests, SORT_STRING);
$payloadManifest = json_encode(
    $payloadDigests,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
);

if (file_put_contents($payloadManifestDestination, $payloadManifest . "\n") === false) {
    fwrite(STDERR, "Could not write installed-payload manifest {$payloadManifestDestination}.\n");
    exit(74);
}

fwrite(STDOUT, "Built {$manifest['name']} {$manifest['version']} at {$destination}.\n");
