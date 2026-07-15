<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Hooks\Campaign;

use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Hook\Hook\BeforeRemove;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\RemoveOptions;
use Espo\ORM\Repository\Option\SaveOptions;

/** @implements BeforeSave<Entity> @implements BeforeRemove<Entity> */
final class OutreachProjectionIntegrity implements BeforeSave, BeforeRemove
{
    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        $key = $entity->get('outreachProjectionKey');

        if ($this->managedKeyWasChanged($entity)) {
            throw new Forbidden('Managed outreach Campaign identity is immutable.');
        }

        if (!is_string($key) || $key === '') {
            if (
                $entity->get('outreachManaged') === true ||
                $this->hasText($entity->get('musicReleaseId')) ||
                $this->hasText($entity->get('outreachTargetListId'))
            ) {
                throw new Forbidden('Campaign projection fields require a managed projection key.');
            }

            return;
        }

        if ($entity->isNew()) {
            $releaseId = $entity->get('musicReleaseId');
            $targetListId = $entity->get('outreachTargetListId');
            $membershipCount = $entity->get('targetMembershipCount');

            if (
                !is_string($releaseId) || $releaseId === '' ||
                !is_string($targetListId) || $targetListId === '' ||
                !hash_equals("music-release:{$releaseId}", $key) ||
                $entity->get('outreachManaged') !== true ||
                $entity->get('targetMembershipProjectionState') !== 'Projected' ||
                !is_int($membershipCount) || $membershipCount < 0
            ) {
                throw new Forbidden('The managed outreach Campaign projection is incomplete.');
            }

            return;
        }

        foreach (['outreachProjectionKey', 'musicReleaseId', 'outreachManaged'] as $attribute) {
            if ($entity->isAttributeChanged($attribute)) {
                throw new Forbidden('Managed outreach Campaign identity is immutable.');
            }
        }

        if ($entity->isAttributeChanged('outreachTargetListId')) {
            $previous = $entity->getFetched('outreachTargetListId');
            $next = $entity->get('outreachTargetListId');

            if (
                (is_string($previous) && $previous !== '') ||
                !is_string($next) || $next === ''
            ) {
                throw new Forbidden('Managed outreach Campaign target identity is immutable once assigned.');
            }
        }

        if (
            $entity->isAttributeChanged('targetMembershipCount') &&
            $entity->get('targetMembershipProjectionState') !== 'Projected'
        ) {
            throw new Forbidden('Target membership cannot change before an adapter is verified.');
        }
    }

    public function beforeRemove(Entity $entity, RemoveOptions $options): void
    {
        if (is_string($entity->get('outreachProjectionKey')) && $entity->get('outreachProjectionKey') !== '') {
            throw new Forbidden('Managed outreach Campaigns cannot be deleted.');
        }
    }

    private function managedKeyWasChanged(Entity $entity): bool
    {
        $fetched = $entity->getFetched('outreachProjectionKey');

        return
            !$entity->isNew() &&
            is_string($fetched) && $fetched !== '' &&
            $entity->isAttributeChanged('outreachProjectionKey');
    }

    private function hasText(mixed $value): bool
    {
        return is_string($value) && trim($value) !== '';
    }
}
