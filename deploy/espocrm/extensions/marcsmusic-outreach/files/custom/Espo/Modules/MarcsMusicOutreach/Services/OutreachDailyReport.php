<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services;

use Espo\Modules\MarcsMusicOutreach\Services\Concerns\RejectsProjectionIdentityUpdateInput;

final class OutreachDailyReport extends UniqueConflictRecord
{
    use RejectsProjectionIdentityUpdateInput;

    protected const PROJECTION_IDENTITY_UPDATE_FIELDS = [
        'reportDate',
    ];

    protected const UNIQUE_CONFLICT_KEYS = [
        'outreach_daily_report.UNIQ_REPORT_DATE',
    ];
}
