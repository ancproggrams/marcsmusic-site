<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Hooks\OutreachMatch;

use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\SaveOptions;
use JsonException;

/** @implements BeforeSave<Entity> */
final class CampaignStatusTransition implements BeforeSave
{
    private const STATUS = 'campaignStatus';

    /** @var null|array{createStates: list<string>, transitions: array<string, list<string>>} */
    private static ?array $graph = null;

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        $to = $entity->get(self::STATUS);

        if (!is_string($to) || $to === '') {
            throw new Forbidden('An outreach campaign status is required.');
        }

        $graph = self::graph();

        if ($entity->isNew()) {
            if (!in_array($to, $graph['createStates'], true)) {
                throw new Forbidden('The requested outreach bootstrap state is not allowed.');
            }

            return;
        }

        if (!$entity->isAttributeChanged(self::STATUS)) {
            return;
        }

        $from = $entity->getFetched(self::STATUS);

        if (!is_string($from) || !array_key_exists($from, $graph['transitions'])) {
            throw new Forbidden('The previous outreach campaign state cannot be verified.');
        }

        if (!in_array($to, $graph['transitions'][$from], true)) {
            throw new Forbidden("Outreach campaign transition {$from} -> {$to} is not allowed.");
        }
    }

    /** @return array{createStates: list<string>, transitions: array<string, list<string>>} */
    private static function graph(): array
    {
        if (self::$graph !== null) {
            return self::$graph;
        }

        $path = dirname(__DIR__, 2) . '/Resources/campaign-status-transitions.json';

        try {
            $contents = @file_get_contents($path);

            if (!is_string($contents)) {
                throw new JsonException('Transition graph cannot be read.');
            }

            $decoded = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new Forbidden('The outreach transition policy is unavailable.');
        }

        if (!is_array($decoded) || !is_array($decoded['createStates'] ?? null) || !is_array($decoded['transitions'] ?? null)) {
            throw new Forbidden('The outreach transition policy is malformed.');
        }

        /** @var array{createStates: list<string>, transitions: array<string, list<string>>} $decoded */
        self::$graph = $decoded;

        return self::$graph;
    }
}
