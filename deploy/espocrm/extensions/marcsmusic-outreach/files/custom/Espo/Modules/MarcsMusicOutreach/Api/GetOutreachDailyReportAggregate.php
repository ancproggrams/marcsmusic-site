<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Api;

use DateTimeImmutable;
use DateTimeZone;
use Espo\Core\Acl;
use Espo\Core\Acl\Table;
use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Modules\MarcsMusicOutreach\Entities\MediaContact;
use Espo\Modules\MarcsMusicOutreach\Entities\OutreachDailyReport;
use Espo\Modules\MarcsMusicOutreach\Entities\OutreachMatch;
use Espo\Modules\MarcsMusicOutreach\Tools\DailyReport\AggregateService;

final class GetOutreachDailyReportAggregate implements Action
{
    private const MINIMUM_WINDOW_SECONDS = 23 * 60 * 60;
    private const MAXIMUM_WINDOW_SECONDS = 25 * 60 * 60;

    public function __construct(
        private Acl $acl,
        private AggregateService $aggregateService,
    ) {}

    public function process(Request $request): Response
    {
        $this->assertGlobalReadAccess();

        $start = $this->parseDateTime($request->getQueryParam('start'), 'start');
        $end = $this->parseDateTime($request->getQueryParam('end'), 'end');
        $seconds = $end->getTimestamp() - $start->getTimestamp();

        if ($seconds < self::MINIMUM_WINDOW_SECONDS || $seconds > self::MAXIMUM_WINDOW_SECONDS) {
            throw new BadRequest('A bounded 23 to 25 hour report window is required.');
        }

        return ResponseComposer::json(
            $this->aggregateService->summarize(
                $start->format('Y-m-d H:i:s'),
                $end->format('Y-m-d H:i:s'),
            )
        );
    }

    private function assertGlobalReadAccess(): void
    {
        foreach ([
            OutreachDailyReport::ENTITY_TYPE,
            MediaContact::ENTITY_TYPE,
            OutreachMatch::ENTITY_TYPE,
        ] as $entityType) {
            if (
                !$this->acl->checkScope($entityType, Table::ACTION_READ) ||
                !$this->acl->checkReadAll($entityType)
            ) {
                throw new Forbidden('Global daily-report aggregation access is required.');
            }
        }
    }

    private function parseDateTime(?string $value, string $parameter): DateTimeImmutable
    {
        if ($value === null || preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/D', $value) !== 1) {
            throw new BadRequest("A valid {$parameter} UTC datetime is required.");
        }

        $parsed = DateTimeImmutable::createFromFormat(
            '!Y-m-d H:i:s',
            $value,
            new DateTimeZone('UTC'),
        );

        if ($parsed === false || $parsed->format('Y-m-d H:i:s') !== $value) {
            throw new BadRequest("A valid {$parameter} UTC datetime is required.");
        }

        return $parsed;
    }
}
