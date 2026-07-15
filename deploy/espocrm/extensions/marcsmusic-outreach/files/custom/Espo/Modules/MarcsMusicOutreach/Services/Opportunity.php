<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class Opportunity extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'outreachProjectionKey',
        'outreachMatchId',
        'musicReleaseId',
        'mediaContactId',
        'mediaOutletId',
        'sourceOutreachEventId',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'opportunity.UNIQ_OUTREACH_PROJECTION_KEY',
        'opportunity.UNIQ_OUTREACH_MATCH',
        'opportunity.UNIQ_SOURCE_OUTREACH_EVENT',
    ];
}
