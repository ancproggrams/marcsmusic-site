<?php

declare(strict_types=1);

require '/opt/marcsmusic/runtime.php';

try {
    $pdo = marcsmusic_database_connection();
    marcsmusic_assert_core_schema($pdo);
    marcsmusic_assert_outreach_schema($pdo);
} catch (Throwable $exception) {
    fwrite(STDERR, "error: {$exception->getMessage()}\n");
    exit(78);
}
