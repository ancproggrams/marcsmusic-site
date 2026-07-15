<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class OutreachSuppression extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'subjectHash',
        'subjectType',
        'emailAddress',
        'domain',
        'mediaContactId',
        'mediaOutletId',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'outreach_suppression.UNIQ_SUBJECT_HASH',
    ];
}
