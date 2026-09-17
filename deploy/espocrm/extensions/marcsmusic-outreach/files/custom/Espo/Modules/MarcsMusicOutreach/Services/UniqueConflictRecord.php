<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\MapsUniqueCreateConflicts;
use Espo\Services\Record;

/**
 * Base record service for entities whose API clients reconcile an idempotent
 * create race after receiving HTTP 409.
 */
abstract class UniqueConflictRecord extends Record
{
    use MapsUniqueCreateConflicts;
}
