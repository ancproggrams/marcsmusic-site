<?php

declare(strict_types=1);

require '/opt/marcsmusic/runtime.php';

try {
    marcsmusic_assert_core_table_manifest_integrity();
    $pdo = marcsmusic_database_connection();
    $database = marcsmusic_required_environment('ESPOCRM_DATABASE_NAME');
    $objectCountStatement = $pdo->prepare(
        "SELECT
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ?) +
            (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = ?) +
            (SELECT COUNT(*) FROM information_schema.events WHERE event_schema = ?)",
    );
    $objectCountStatement->execute([$database, $database, $database]);

    if ((int) $objectCountStatement->fetchColumn() === 0) {
        fwrite(STDOUT, "fresh\n");
        exit(0);
    }

    $tableStatement = $pdo->prepare(
        "SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = ?
            AND table_type = 'BASE TABLE'",
    );
    $tableStatement->execute([$database]);

    /** @var list<string> $tables */
    $tables = $tableStatement->fetchAll(PDO::FETCH_COLUMN);

    $requiredTables = MARCSMUSIC_ESPOCRM_CORE_TABLES;
    $missingTables = array_values(array_diff($requiredTables, $tables));
    $missingColumns = marcsmusic_missing_database_columns(
        $pdo,
        MARCSMUSIC_ESPOCRM_CORE_SCHEMA,
    );
    $missingIndexes = marcsmusic_missing_database_indexes(
        $pdo,
        marcsmusic_expected_core_indexes(),
    );
    $invalidEngines = marcsmusic_non_innodb_tables($pdo, $requiredTables);

    if (
        $missingTables === []
        && $missingColumns === []
        && $missingIndexes === []
        && $invalidEngines === []
    ) {
        fwrite(STDOUT, "existing\n");
        exit(0);
    }

    fwrite(
        STDERR,
        "error: The configured database does not satisfy the EspoCRM base core schema contract.\n",
    );
    exit(78);
} catch (Throwable $exception) {
    fwrite(STDERR, "warning: EspoCRM database is not ready ({$exception->getMessage()}).\n");
    exit(75);
}
