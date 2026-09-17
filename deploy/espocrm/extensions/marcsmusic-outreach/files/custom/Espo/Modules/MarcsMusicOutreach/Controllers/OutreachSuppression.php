<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Controllers;

use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Controllers\Record;
use Espo\Core\Exceptions\Forbidden;

final class OutreachSuppression extends Record
{
    public function deleteActionDelete(Request $request, Response $response): never
    {
        throw new Forbidden('Suppressions cannot be deleted.');
    }

    public function postActionCreateLink(Request $request): never
    {
        throw new Forbidden('Suppression subject links are immutable.');
    }

    public function deleteActionRemoveLink(Request $request): never
    {
        throw new Forbidden('Suppression subject links are immutable.');
    }
}
