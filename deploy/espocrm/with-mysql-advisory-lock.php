<?php

declare(strict_types=1);

require '/opt/marcsmusic/runtime.php';

if ($argc < 4) {
    fwrite(STDERR, "Usage: with-mysql-advisory-lock.php <lock-name> <timeout-seconds> <command> [args...]\n");
    exit(64);
}

$lockName = $argv[1];
$timeout = filter_var(
    $argv[2],
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1, 'max_range' => 600]],
);
$command = array_slice($argv, 3);

if (!preg_match('/^[a-zA-Z0-9:_.-]{1,64}$/D', $lockName) || $timeout === false) {
    fwrite(STDERR, "error: Invalid advisory-lock parameters.\n");
    exit(64);
}

$pdo = null;
$locked = false;
$process = null;
$processPid = null;
$processGroupEstablished = false;
$terminationSignal = null;
$exitCode = 75;

$isProcessGroupAlive = static function () use (
    &$processPid,
    &$processGroupEstablished,
): bool {
    if (!is_int($processPid) || $processPid < 1) {
        return false;
    }

    if (posix_kill(-$processPid, 0)) {
        $processGroupEstablished = true;

        return true;
    }

    // EPERM still proves that the process group exists. The wrapper and its
    // descendants normally share a UID, but treating EPERM as live preserves
    // the lock-safety invariant if that ever changes.
    if (posix_get_last_error() === 1) {
        $processGroupEstablished = true;

        return true;
    }

    return false;
};

$signalProcessGroup = static function (int $signal) use (
    &$processPid,
    &$processGroupEstablished,
): void {
    if (!is_int($processPid) || $processPid < 1) {
        return;
    }

    // The child is launched through setsid. Signal its complete process group
    // before this process releases the database lock. Fall back to the direct
    // PID only for the small race before setsid establishes the group.
    if (posix_kill(-$processPid, $signal)) {
        $processGroupEstablished = true;

        return;
    }

    if (!$processGroupEstablished && posix_get_last_error() !== 1) {
        posix_kill($processPid, $signal);
    }
};

$handleTermination = static function (int $signal) use (
    &$terminationSignal,
    $signalProcessGroup,
): void {
    $terminationSignal ??= $signal;
    $signalProcessGroup($signal);
};

pcntl_async_signals(true);
pcntl_signal(SIGTERM, $handleTermination);
pcntl_signal(SIGINT, $handleTermination);

try {
    $pdo = marcsmusic_database_connection();
    $statement = $pdo->prepare('SELECT GET_LOCK(?, ?)');
    $statement->execute([$lockName, $timeout]);
    $locked = (int) $statement->fetchColumn() === 1;

    if (!$locked) {
        throw new RuntimeException('Timed out waiting for the EspoCRM deployment lock.');
    }

    $process = proc_open(
        ['/usr/bin/setsid', ...$command],
        [
            0 => ['file', 'php://stdin', 'r'],
            1 => ['file', 'php://stdout', 'w'],
            2 => ['file', 'php://stderr', 'w'],
        ],
        $pipes,
        MARCSMUSIC_ESPOCRM_ROOT,
        null,
        ['bypass_shell' => true],
    );

    if (!is_resource($process)) {
        throw new RuntimeException('Could not start the locked EspoCRM deployment command.');
    }

    $processStatus = proc_get_status($process);
    $processPid = $processStatus['pid'] ?? null;

    if (!is_int($processPid) || $processPid < 1) {
        throw new RuntimeException('Could not identify the locked EspoCRM deployment process.');
    }

    if (is_int($terminationSignal)) {
        $signalProcessGroup($terminationSignal);
    }

    $observedExitCode = null;
    $observedTermSignal = null;
    $closeExitCode = null;
    $drainStartedAt = null;
    $killSent = false;
    $orphanedProcessGroup = false;

    while (true) {
        $leaderRunning = false;

        if (is_resource($process)) {
            $processStatus = proc_get_status($process);

            if (!is_array($processStatus)) {
                throw new RuntimeException(
                    'Could not inspect the locked EspoCRM deployment process.',
                );
            }

            $leaderRunning = ($processStatus['running'] ?? null) === true;

            if (!$leaderRunning) {
                $observed = $processStatus['exitcode'] ?? null;
                $observedSignal = $processStatus['termsig'] ?? null;

                if (is_int($observed) && $observed >= 0) {
                    $observedExitCode = $observed;
                }

                if (is_int($observedSignal) && $observedSignal > 0) {
                    $observedTermSignal = $observedSignal;
                }

                // Reap the leader before probing the process group. A zombie
                // remains visible to kill(0) and would otherwise deadlock the
                // group-drain check even though it cannot execute more work.
                $closeExitCode = proc_close($process);
                $process = null;
            }
        }

        $processGroupAlive = $isProcessGroupAlive();

        if (!$leaderRunning && !$processGroupAlive) {
            break;
        }

        if (is_int($terminationSignal)) {
            if ($drainStartedAt === null) {
                $drainStartedAt = microtime(true);
                $signalProcessGroup($terminationSignal);
            }
        } elseif (!$leaderRunning && $processGroupAlive) {
            // A command is not complete while descendants from its isolated
            // process group can still mutate the database. Drain them and fail
            // the invocation instead of releasing the advisory lock early.
            $orphanedProcessGroup = true;

            if ($drainStartedAt === null) {
                $drainStartedAt = microtime(true);
                $signalProcessGroup(SIGTERM);
            }
        }

        if ($drainStartedAt !== null) {
            $elapsed = microtime(true) - $drainStartedAt;

            if ($elapsed >= 2.0 && !$killSent) {
                $signalProcessGroup(SIGKILL);
                $killSent = true;
            }

            if ($elapsed >= 5.0) {
                throw new RuntimeException(
                    'The locked EspoCRM deployment process group did not terminate.',
                );
            }
        }

        usleep(100_000);
    }

    if ($orphanedProcessGroup) {
        throw new RuntimeException(
            'The locked EspoCRM deployment command left descendant processes behind.',
        );
    }

    if (is_int($terminationSignal)) {
        $exitCode = 128 + $terminationSignal;
    } elseif (is_int($observedExitCode)) {
        $exitCode = $observedExitCode;
    } elseif (is_int($observedTermSignal)) {
        $exitCode = 128 + $observedTermSignal;
    } elseif (is_int($closeExitCode)) {
        $exitCode = $closeExitCode;
    } else {
        throw new RuntimeException(
            'Could not determine the locked EspoCRM deployment command status.',
        );
    }

    if ($exitCode < 0) {
        throw new RuntimeException('The locked EspoCRM deployment command terminated abnormally.');
    }
} catch (Throwable $exception) {
    fwrite(STDERR, "error: {$exception->getMessage()}\n");
    $exitCode = 75;
} finally {
    if (is_resource($process)) {
        $signalProcessGroup(SIGKILL);
        $leaderDrainStartedAt = microtime(true);
        $leaderDrainWarningLogged = false;

        while (true) {
            $status = proc_get_status($process);

            if (!is_array($status) || ($status['running'] ?? false) !== true) {
                break;
            }

            $signalProcessGroup(SIGKILL);

            if (!$leaderDrainWarningLogged && microtime(true) - $leaderDrainStartedAt >= 5.0) {
                fwrite(
                    STDERR,
                    "error: Holding the database lock while the deployment leader drains.\n",
                );
                $leaderDrainWarningLogged = true;
            }

            usleep(100_000);
        }

        proc_close($process);
        $process = null;
    }

    // Fail-stop: there is deliberately no timeout here. Releasing the MySQL
    // lock while a descendant can still write is less safe than keeping the
    // deployment unavailable until the process group has actually drained.
    $groupDrainStartedAt = microtime(true);
    $groupDrainWarningLogged = false;

    while ($isProcessGroupAlive()) {
        $signalProcessGroup(SIGKILL);

        if (!$groupDrainWarningLogged && microtime(true) - $groupDrainStartedAt >= 5.0) {
            fwrite(
                STDERR,
                "error: Holding the database lock while descendant processes drain.\n",
            );
            $groupDrainWarningLogged = true;
        }

        usleep(100_000);
    }

    if ($locked && $pdo instanceof PDO) {
        try {
            $statement = $pdo->prepare('SELECT RELEASE_LOCK(?)');
            $statement->execute([$lockName]);
        } catch (Throwable) {
            // The connection closing also releases a MySQL advisory lock.
        }
    }

    pcntl_signal(SIGTERM, SIG_DFL);
    pcntl_signal(SIGINT, SIG_DFL);
}

exit($exitCode);
