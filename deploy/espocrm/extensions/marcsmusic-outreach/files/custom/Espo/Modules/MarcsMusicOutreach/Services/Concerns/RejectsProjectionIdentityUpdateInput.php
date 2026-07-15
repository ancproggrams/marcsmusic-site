<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Services\Concerns;

use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Record\UpdateParams;
use Espo\Core\Record\UpdateResult;
use stdClass;

/**
 * Rejects attempts to update extension-owned, read-only projection identity
 * before EspoCRM filters the input and enters the save lifecycle.
 *
 * EspoCRM's generic update service removes readOnlyAfterCreate attributes but
 * still saves the entity. That otherwise increments OCC and audit metadata for
 * a request that appears to be a no-op. These fields are reserved to the
 * outreach projection on every record, so rejecting their presence does not
 * constrain standard CRM fields or legitimate relationship updates.
 */
trait RejectsProjectionIdentityUpdateInput
{
    public function update(
        string $id,
        stdClass $data,
        UpdateParams $params = new UpdateParams(),
    ): UpdateResult {
        foreach (static::PROJECTION_IDENTITY_UPDATE_FIELDS as $field) {
            if (property_exists($data, $field)) {
                throw new Forbidden('Managed outreach projection identity is immutable.');
            }
        }

        return parent::update($id, $data, $params);
    }
}
