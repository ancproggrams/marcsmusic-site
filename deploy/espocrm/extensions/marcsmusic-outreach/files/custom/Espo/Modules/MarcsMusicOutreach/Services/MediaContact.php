<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

final class MediaContact extends UniqueConflictRecord
{
    protected const UNIQUE_CONFLICT_KEYS = [
        'media_contact.UNIQ_FINGERPRINT',
    ];
}
