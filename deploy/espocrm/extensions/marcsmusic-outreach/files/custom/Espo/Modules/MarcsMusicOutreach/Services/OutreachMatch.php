<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class OutreachMatch extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'musicReleaseId',
        'mediaContactId',
        'mediaOutletId',
        'idempotencyKey',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'outreach_match.UNIQ_IDEMPOTENCY_KEY',
    ];
}
