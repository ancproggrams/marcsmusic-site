<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Hooks\Email;

use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Hook\Hook\BeforeRemove;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\RemoveOptions;
use Espo\ORM\Repository\Option\SaveOptions;

/** @implements BeforeSave<Entity> @implements BeforeRemove<Entity> */
final class OutreachProjectionIntegrity implements BeforeSave, BeforeRemove
{
    /** @var list<string> */
    private const IMMUTABLE = [
        'name',
        'status',
        'dateSent',
        'from',
        'fromString',
        'to',
        'body',
        'isHtml',
        'parentType',
        'parentId',
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

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        $key = $entity->get('outreachProjectionKey');

        if ($this->managedKeyWasChanged($entity)) {
            throw new Forbidden('Managed outreach Email identity is immutable.');
        }

        if (!is_string($key) || $key === '') {
            if ($this->hasReservedProjectionIdentity($entity)) {
                throw new Forbidden('Outreach Email identity fields require a managed projection key.');
            }

            return;
        }

        if ($entity->isNew()) {
            $outbound =
                preg_match('/\A(?:send|response):[0-9a-f-]{36}\z/D', $key) === 1 &&
                $entity->get('status') === 'Sent' &&
                $this->hasRequiredIdentity($entity) &&
                $this->hasImmutableReceipt($entity);
            $inbound =
                preg_match('/\Ainbound:[0-9a-f]{64}\z/D', $key) === 1 &&
                $entity->get('status') === 'Received' &&
                $this->hasRequiredInboundIdentity($entity) &&
                $this->hasImmutableReceipt($entity);

            if (!$outbound && !$inbound) {
                throw new Forbidden('The managed outreach Email projection is incomplete.');
            }

            return;
        }

        foreach (self::IMMUTABLE as $attribute) {
            if ($entity->isAttributeChanged($attribute)) {
                throw new Forbidden('Managed outreach Email identity is immutable.');
            }
        }
    }

    public function beforeRemove(Entity $entity, RemoveOptions $options): void
    {
        if (is_string($entity->get('outreachProjectionKey')) && $entity->get('outreachProjectionKey') !== '') {
            throw new Forbidden('Managed outreach Emails cannot be deleted.');
        }
    }

    private function hasRequiredIdentity(Entity $entity): bool
    {
        foreach ([
            'outreachCorrelationId',
            'outreachProviderMessageId',
            'outreachDeterministicMessageId',
            'outreachMatchId',
            'outreachCampaignId',
            'musicReleaseId',
            'mediaContactId',
            'mediaOutletId',
        ] as $attribute) {
            if (!is_string($entity->get($attribute)) || $entity->get($attribute) === '') {
                return false;
            }
        }

        return true;
    }

    private function hasImmutableReceipt(Entity $entity): bool
    {
        $from = $entity->get('from');
        $to = $entity->get('to');
        $matchId = $entity->get('outreachMatchId');

        return
            is_string($from) && filter_var($from, FILTER_VALIDATE_EMAIL) !== false &&
            is_string($to) && filter_var($to, FILTER_VALIDATE_EMAIL) !== false &&
            $entity->get('fromString') === $from &&
            is_string($entity->get('dateSent')) && $entity->get('dateSent') !== '' &&
            $entity->get('parentType') === 'OutreachMatch' &&
            is_string($matchId) && $entity->get('parentId') === $matchId &&
            is_string($entity->get('name')) && $entity->get('name') !== '' &&
            is_string($entity->get('body'));
    }

    private function hasRequiredInboundIdentity(Entity $entity): bool
    {
        foreach ([
            'outreachCorrelationId',
            'outreachProviderMessageId',
            'outreachDeterministicMessageId',
            'outreachAcceptedAt',
            'outreachMatchId',
            'musicReleaseId',
            'mediaContactId',
        ] as $attribute) {
            if (!is_string($entity->get($attribute)) || $entity->get($attribute) === '') {
                return false;
            }
        }

        return $entity->get('outreachAutomaticResponse') === false;
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
            'outreachCorrelationId',
            'outreachProviderMessageId',
            'outreachDeterministicMessageId',
            'outreachMatchId',
            'outreachCampaignId',
            'musicReleaseId',
            'mediaContactId',
            'mediaOutletId',
        ] as $attribute) {
            $value = $entity->get($attribute);

            if (is_string($value) && trim($value) !== '') {
                return true;
            }
        }

        return false;
    }
}
