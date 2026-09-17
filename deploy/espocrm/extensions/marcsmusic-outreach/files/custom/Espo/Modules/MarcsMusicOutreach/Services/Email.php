<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\MapsUniqueCreateConflicts;
use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;
use Espo\Services\Email as CoreEmail;

/** Preserves the core Email send lifecycle while mapping reviewed races. */
final class Email extends CoreEmail
{
    use MapsUniqueCreateConflicts;
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'outreachProjectionKey',
        'outreachCorrelationId',
        'outreachProviderMessageId',
        'outreachDeterministicMessageId',
        'outreachAcceptedAt',
        'outreachAutomaticResponse',
        'outreachMatchId',
        'outreachCampaignId',
        'musicReleaseId',
        'mediaContactId',
        'mediaOutletId',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'email.UNIQ_OUTREACH_PROJECTION_KEY',
        'email.UNIQ_OUTREACH_CORRELATION_ID',
    ];
}
