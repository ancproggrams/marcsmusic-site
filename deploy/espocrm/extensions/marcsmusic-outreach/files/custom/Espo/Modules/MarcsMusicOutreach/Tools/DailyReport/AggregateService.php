<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Tools\DailyReport;

use Espo\Core\ORM\EntityManager;
use Espo\Modules\MarcsMusicOutreach\Entities\MediaContact;
use Espo\Modules\MarcsMusicOutreach\Entities\OutreachMatch;
use PDO;
use UnexpectedValueException;

final class AggregateService
{
    private const MAXIMUM_COUNTER = 2_147_483_647;

    public function __construct(private EntityManager $entityManager)
    {}

    /**
     * All counters are evaluated inside one repeatable-read snapshot. Only
     * aggregate rows leave the database; no contact or match collection is
     * materialized in PHP or transferred to the worker.
     *
     * @return array{
     *   newContacts: int,
     *   validatedContacts: int,
     *   duplicateContacts: int,
     *   eligibleContacts: int,
     *   blockedContacts: int,
     *   matchesCreated: int
     * }
     */
    public function summarize(string $start, string $end): array
    {
        return $this->entityManager->getTransactionManager()->run(function () use ($start, $end): array {
            $contactWindow = $this->window($start, $end);
            $matchWindow = $this->window($start, $end);

            return [
                'newContacts' => $this->count(MediaContact::ENTITY_TYPE, $contactWindow),
                'validatedContacts' => $this->count(MediaContact::ENTITY_TYPE, [
                    ...$contactWindow,
                    'emailValidationStatus' => 'Valid',
                ]),
                'duplicateContacts' => $this->count(MediaContact::ENTITY_TYPE, [
                    ...$contactWindow,
                    'duplicateOfId!=' => null,
                ]),
                'eligibleContacts' => $this->countDistinctMatchContacts($matchWindow, ['Eligible']),
                'blockedContacts' => $this->countDistinctMatchContacts($matchWindow, ['Blocked', 'Skipped']),
                'matchesCreated' => $this->count(OutreachMatch::ENTITY_TYPE, $matchWindow),
            ];
        });
    }

    /** @return array<string, bool|string> */
    private function window(string $start, string $end): array
    {
        return [
            'createdAt>=' => $start,
            'createdAt<' => $end,
            'deleted' => false,
        ];
    }

    /** @param array<string, bool|string|null> $where */
    private function count(string $entityType, array $where): int
    {
        return $this->boundedCounter(
            $this->entityManager->getRepository($entityType)->where($where)->count()
        );
    }

    /**
     * @param array<string, bool|string> $window
     * @param non-empty-list<string> $statuses
     */
    private function countDistinctMatchContacts(array $window, array $statuses): int
    {
        $distinctContacts = $this->entityManager
            ->getQueryBuilder()
            ->select()
            ->from(OutreachMatch::ENTITY_TYPE)
            // Derived-table columns retain their explicit select aliases.
            // `id` is stable across Espo's outer expression normalization;
            // a camelCase alias would be rewritten to a non-existent column.
            ->select('mediaContactId', 'id')
            ->distinct()
            ->where([
                ...$window,
                'mediaContactId!=' => null,
                'eligibilityStatus' => $statuses,
            ])
            ->build();

        $countQuery = $this->entityManager
            ->getQueryBuilder()
            ->select()
            ->fromQuery($distinctContacts, 'matches')
            ->select('COUNT:(matches.id)', 'value')
            ->build();

        $row = $this->entityManager
            ->getQueryExecutor()
            ->execute($countQuery)
            ->fetch(PDO::FETCH_ASSOC);

        return $this->boundedCounter($row['value'] ?? null);
    }

    private function boundedCounter(mixed $value): int
    {
        if (is_string($value) && preg_match('/^\d+$/D', $value) === 1) {
            $value = (int) $value;
        }

        if (!is_int($value) || $value < 0 || $value > self::MAXIMUM_COUNTER) {
            throw new UnexpectedValueException('Daily report aggregate counter is invalid.');
        }

        return $value;
    }
}
