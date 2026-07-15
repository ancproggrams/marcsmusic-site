<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Hooks\OutreachSuppression;

use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Hook\Hook\BeforeRemove;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\RemoveOptions;
use Espo\ORM\Repository\Option\SaveOptions;

/** @implements BeforeSave<Entity> @implements BeforeRemove<Entity> */
final class DenyWins implements BeforeSave, BeforeRemove
{
    /** @var array<string, string> */
    private const SUBJECT_FIELD_BY_TYPE = [
        'contact' => 'mediaContactId',
        'outlet' => 'mediaOutletId',
        'email' => 'emailAddress',
        'domain' => 'domain',
    ];

    /** @var list<string> */
    private const IMMUTABLE_SUBJECT_ATTRIBUTES = [
        'subjectHash',
        'subjectType',
        'mediaContactId',
        'mediaOutletId',
        'emailAddress',
        'domain',
    ];

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        if ($entity->isNew()) {
            if ($entity->get('active') !== true) {
                throw new Forbidden('A suppression must be active when created.');
            }

            $this->assertSubjectContract($entity);

            return;
        }

        if ($entity->isAttributeChanged('active') && $entity->get('active') !== true) {
            throw new Forbidden('Suppressions cannot be deactivated.');
        }

        foreach (self::IMMUTABLE_SUBJECT_ATTRIBUTES as $attribute) {
            if ($entity->isAttributeChanged($attribute)) {
                throw new Forbidden('A suppression subject cannot be changed.');
            }
        }
    }

    public function beforeRemove(Entity $entity, RemoveOptions $options): void
    {
        throw new Forbidden('Suppressions cannot be deleted.');
    }

    private function assertSubjectContract(Entity $entity): void
    {
        $subjectType = $entity->get('subjectType');
        $subjectHash = $entity->get('subjectHash');

        if (!is_string($subjectType) || !array_key_exists($subjectType, self::SUBJECT_FIELD_BY_TYPE)) {
            throw new Forbidden('A suppression subject type is invalid.');
        }

        if (!is_string($subjectHash) || preg_match('/\A[a-f0-9]{64}\z/D', $subjectHash) !== 1) {
            throw new Forbidden('A suppression subject hash is invalid.');
        }

        $presentFields = [];

        foreach (self::SUBJECT_FIELD_BY_TYPE as $field) {
            $value = $entity->get($field);

            if (is_string($value) && trim($value) !== '') {
                $presentFields[] = $field;
            } elseif ($value !== null && $value !== '') {
                throw new Forbidden('A suppression subject value is invalid.');
            }
        }

        if (
            count($presentFields) !== 1 ||
            $presentFields[0] !== self::SUBJECT_FIELD_BY_TYPE[$subjectType]
        ) {
            throw new Forbidden('A suppression must contain exactly one matching subject.');
        }
    }
}
