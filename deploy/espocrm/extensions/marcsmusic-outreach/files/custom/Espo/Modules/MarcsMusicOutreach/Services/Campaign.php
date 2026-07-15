<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class Campaign extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'outreachProjectionKey',
        'musicReleaseId',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'campaign.UNIQ_MUSIC_RELEASE',
        'campaign.UNIQ_OUTREACH_PROJECTION_KEY',
    ];
}
