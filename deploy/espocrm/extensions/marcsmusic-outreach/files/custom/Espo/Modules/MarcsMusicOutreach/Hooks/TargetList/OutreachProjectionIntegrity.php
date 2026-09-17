<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Hooks\TargetList;

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
            throw new Forbidden('Managed outreach Target List identity is immutable.');
        }

        if (!is_string($key) || $key === '') {
            if (
                $entity->get('outreachManaged') === true ||
                $this->hasText($entity->get('musicReleaseId')) ||
                $this->hasText($entity->get('outreachCampaignId'))
            ) {
                throw new Forbidden('Target List projection fields require a managed projection key.');
            }

            return;
        }

        if ($entity->isNew()) {
            $releaseId = $entity->get('musicReleaseId');
            $policyVersion = $entity->get('eligibilityPolicyVersion');

            if (
                !is_string($releaseId) || $releaseId === '' ||
                !hash_equals("music-release:{$releaseId}", $key) ||
                $entity->get('outreachManaged') !== true ||
                !is_string($policyVersion) || $policyVersion === ''
            ) {
                throw new Forbidden('The managed outreach Target List projection is incomplete.');
            }

            return;
        }

        foreach (['outreachProjectionKey', 'musicReleaseId', 'outreachManaged'] as $attribute) {
            if ($entity->isAttributeChanged($attribute)) {
                throw new Forbidden('Managed outreach Target List identity is immutable.');
            }
        }

        if ($entity->isAttributeChanged('outreachCampaignId')) {
            $previous = $entity->getFetched('outreachCampaignId');
            $next = $entity->get('outreachCampaignId');

            if (
                (is_string($previous) && $previous !== '') ||
                !is_string($next) || $next === ''
            ) {
                throw new Forbidden('Managed outreach Target List campaign identity is immutable once assigned.');
            }
        }
    }

    public function beforeRemove(Entity $entity, RemoveOptions $options): void
    {
        if (is_string($entity->get('outreachProjectionKey')) && $entity->get('outreachProjectionKey') !== '') {
            throw new Forbidden('Managed outreach Target Lists cannot be deleted.');
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
