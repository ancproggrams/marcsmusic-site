<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class OutreachEvent extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'outreachMatchId',
        'mediaContactId',
        'musicReleaseId',
        'mediaOutletId',
        'campaignId',
        'emailId',
        'externalEventId',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'outreach_event.UNIQ_EXTERNAL_EVENT_ID',
    ];
}
