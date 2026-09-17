<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class TargetList extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'outreachProjectionKey',
        'musicReleaseId',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'target_list.UNIQ_MUSIC_RELEASE',
        'target_list.UNIQ_OUTREACH_PROJECTION_KEY',
    ];
}
