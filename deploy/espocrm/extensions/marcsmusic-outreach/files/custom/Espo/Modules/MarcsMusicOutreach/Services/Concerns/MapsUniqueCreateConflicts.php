<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services\Concerns;

use Espo\Core\Exceptions\ConflictSilent;
use Espo\Core\Exceptions\Error\Body;
use Espo\Core\Record\CreateParams;
use Espo\Core\Record\CreateResult;
use PDOException;
use stdClass;

/**
 * Converts only reviewed MySQL unique-key races to EspoCRM's public 409
 * contract. Every other database exception remains an internal error.
 */
trait MapsUniqueCreateConflicts
{
    public function create(stdClass $data, CreateParams $params = new CreateParams()): CreateResult
    {
        try {
            return parent::create($data, $params);
        } catch (PDOException $exception) {
            if (!$this->isAllowlistedUniqueConflict($exception)) {
                throw $exception;
            }

            throw ConflictSilent::createWithBody(
                'unique-conflict',
                Body::create()->withMessage('A record with the same unique identity already exists.'),
            );
        }
    }

    private function isAllowlistedUniqueConflict(PDOException $exception): bool
    {
        $errorInfo = $exception->errorInfo;

        if (
            !is_array($errorInfo) ||
            (string) ($errorInfo[0] ?? '') !== '23000' ||
            (int) ($errorInfo[1] ?? 0) !== 1062 ||
            !is_string($errorInfo[2] ?? null)
        ) {
            return false;
        }

        $matches = [];

        if (preg_match("/for key ['`]([^'`]+)['`]\\z/D", $errorInfo[2], $matches) !== 1) {
            return false;
        }

        return in_array($matches[1], static::UNIQUE_CONFLICT_KEYS, true);
    }
}
