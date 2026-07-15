<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class MusicRelease extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'isrc',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'music_release.UNIQ_ISRC',
    ];
}
