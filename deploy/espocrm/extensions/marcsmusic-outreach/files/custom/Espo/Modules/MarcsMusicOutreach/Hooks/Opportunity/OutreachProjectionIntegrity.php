<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Hooks\Opportunity;

use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Hook\Hook\BeforeRemove;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\RemoveOptions;
use Espo\ORM\Repository\Option\SaveOptions;

/** @implements BeforeSave<Entity> @implements BeforeRemove<Entity> */
final class OutreachProjectionIntegrity implements BeforeSave, BeforeRemove
{
    /** @var array<string, int> */
    private const INTEREST_RANK = [
        'Warm' => 1,
        'Interested' => 2,
        'Asset Requested' => 3,
        'Placement Confirmed' => 4,
    ];

    /** @var list<string> */
    private const IMMUTABLE = [
        'outreachProjectionKey',
        'outreachMatchId',
        'musicReleaseId',
        'mediaContactId',
        'mediaOutletId',
        'sourceOutreachEventId',
        'campaignId',
    ];

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        $key = $entity->get('outreachProjectionKey');

        if ($this->managedKeyWasChanged($entity)) {
            throw new Forbidden('Managed outreach Opportunity identity is immutable.');
        }

        if (!is_string($key) || $key === '') {
            if ($this->hasReservedProjectionIdentity($entity)) {
                throw new Forbidden('Outreach Opportunity identity fields require a managed projection key.');
            }

            return;
        }

        if ($entity->isNew()) {
            $matchId = $entity->get('outreachMatchId');

            if (
                !is_string($matchId) || $matchId === '' ||
                !hash_equals("match:{$matchId}", $key) ||
                !$this->hasRequiredIdentity($entity) ||
                $entity->get('outreachRevenueState') !== 'Unspecified' ||
                $this->hasFinancialProjection($entity) ||
                !array_key_exists((string) $entity->get('outreachInterestStatus'), self::INTEREST_RANK) ||
                $entity->get('latestOutreachEventId') !== $entity->get('sourceOutreachEventId')
            ) {
                throw new Forbidden('The outreach Opportunity must represent interest without fabricated revenue or close date.');
            }

            return;
        }

        foreach (self::IMMUTABLE as $attribute) {
            if ($entity->isAttributeChanged($attribute)) {
                throw new Forbidden('Managed outreach Opportunity identity is immutable.');
            }
        }

        $statusChanged = $entity->isAttributeChanged('outreachInterestStatus');
        $latestEventChanged = $entity->isAttributeChanged('latestOutreachEventId');
        $interestAtChanged = $entity->isAttributeChanged('outreachInterestAt');

        if ($statusChanged) {
            $from = $entity->getFetched('outreachInterestStatus');
            $to = $entity->get('outreachInterestStatus');

            if (
                !is_string($from) || !is_string($to) ||
                !isset(self::INTEREST_RANK[$from], self::INTEREST_RANK[$to]) ||
                self::INTEREST_RANK[$to] <= self::INTEREST_RANK[$from] ||
                !$latestEventChanged || !$interestAtChanged ||
                !is_string($entity->get('latestOutreachEventId')) || $entity->get('latestOutreachEventId') === ''
            ) {
                throw new Forbidden('Managed outreach interest may only advance with attributable event evidence.');
            }
        } elseif ($latestEventChanged || $interestAtChanged) {
            throw new Forbidden('Managed outreach interest evidence cannot change without a stronger signal.');
        }

        if ($this->hasFinancialProjection($entity) && $entity->get('outreachRevenueState') !== 'Human Confirmed') {
            throw new Forbidden('Outreach revenue requires an explicit attributable human confirmation.');
        }
    }

    public function beforeRemove(Entity $entity, RemoveOptions $options): void
    {
        if (is_string($entity->get('outreachProjectionKey')) && $entity->get('outreachProjectionKey') !== '') {
            throw new Forbidden('Managed outreach Opportunities cannot be deleted.');
        }
    }

    private function hasRequiredIdentity(Entity $entity): bool
    {
        foreach ([
            'outreachMatchId',
            'musicReleaseId',
            'mediaContactId',
            'mediaOutletId',
            'sourceOutreachEventId',
            'latestOutreachEventId',
            'campaignId',
        ] as $attribute) {
            if (!is_string($entity->get($attribute)) || $entity->get($attribute) === '') {
                return false;
            }
        }

        return true;
    }

    private function hasFinancialProjection(Entity $entity): bool
    {
        $amount = $entity->get('amount');

        return $amount !== null || $entity->get('closeDate') !== null;
    }

    private function managedKeyWasChanged(Entity $entity): bool
    {
        $fetched = $entity->getFetched('outreachProjectionKey');

        return
            !$entity->isNew() &&
            is_string($fetched) && $fetched !== '' &&
            $entity->isAttributeChanged('outreachProjectionKey');
    }

    private function hasReservedProjectionIdentity(Entity $entity): bool
    {
        foreach ([
            'outreachMatchId',
            'musicReleaseId',
            'mediaContactId',
            'mediaOutletId',
            'sourceOutreachEventId',
            'latestOutreachEventId',
        ] as $attribute) {
            $value = $entity->get($attribute);

            if (is_string($value) && trim($value) !== '') {
                return true;
            }
        }

        return false;
    }
}
