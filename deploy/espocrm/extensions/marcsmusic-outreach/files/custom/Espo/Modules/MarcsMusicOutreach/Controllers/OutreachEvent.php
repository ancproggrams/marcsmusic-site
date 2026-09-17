<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Controllers;

use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Controllers\Record;
use Espo\Core\Exceptions\Forbidden;

final class OutreachEvent extends Record
{
    public function putActionUpdate(Request $request, Response $response): never
    {
        throw new Forbidden('Outreach events are append-only.');
    }

    public function patchActionUpdate(Request $request, Response $response): never
    {
        throw new Forbidden('Outreach events are append-only.');
    }

    public function deleteActionDelete(Request $request, Response $response): never
    {
        throw new Forbidden('Outreach events are append-only.');
    }

    public function postActionCreateLink(Request $request): never
    {
        throw new Forbidden('Outreach event links are immutable.');
    }

    public function deleteActionRemoveLink(Request $request): never
    {
        throw new Forbidden('Outreach event links are immutable.');
    }
}
