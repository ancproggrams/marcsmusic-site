<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Hooks\OutreachEvent;

use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Hook\Hook\BeforeRemove;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\RemoveOptions;
use Espo\ORM\Repository\Option\SaveOptions;

/** @implements BeforeSave<Entity> @implements BeforeRemove<Entity> */
final class Immutable implements BeforeSave, BeforeRemove
{
    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        if (!$entity->isNew()) {
            throw new Forbidden('Outreach events are append-only.');
        }
    }

    public function beforeRemove(Entity $entity, RemoveOptions $options): void
    {
        throw new Forbidden('Outreach events are append-only.');
    }
}
