<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class MediaOutlet extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'fingerprint',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'media_outlet.UNIQ_FINGERPRINT',
    ];
}
