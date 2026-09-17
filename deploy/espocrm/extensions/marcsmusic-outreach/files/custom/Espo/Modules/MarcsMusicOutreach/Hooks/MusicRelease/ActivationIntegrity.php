<?php

declare(strict_types=1);

namespace Espo\Modules\MarcsMusicOutreach\Hooks\MusicRelease;

use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\SaveOptions;

/** @implements BeforeSave<Entity> */
final class ActivationIntegrity implements BeforeSave
{
    /** @var list<string> */
    private const MANIFEST_ATTRIBUTES = [
        'epkUrl',
        'isrc',
        'artistName',
        'name',
        'releaseDate',
        'genres',
        'moods',
        'bpm',
        'instrumental',
        'artworkUrl',
        'spotifyUrl',
        'downloadUrl',
        'radioEditUrl',
        'privateStreamUrl',
    ];

    /** @var array<string, list<string>> */
    private const ATTESTATION_TRANSITIONS = [
        'Unverified' => ['Verified', 'Failed'],
        'Verified' => ['Invalidated', 'Failed'],
        'Invalidated' => ['Verified', 'Failed'],
        'Failed' => ['Verified'],
    ];

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        $this->canonicalizeIsrc($entity);

        if ($entity->isNew()) {
            $state = $entity->get('epkAttestationState') ?? 'Unverified';

            if (
                $state !== 'Unverified' ||
                $entity->get('epkManifestSha256') !== null ||
                $entity->get('epkVerifiedAt') !== null ||
                $entity->get('epkEvidenceReference') !== null
            ) {
                throw new Forbidden('New Music Releases must begin without a self-asserted EPK attestation.');
            }
        }

        if (!$entity->isNew() && $this->manifestChanged($entity)) {
            $entity->set('epkAttestationState', 'Invalidated');
            $entity->set('epkManifestSha256', null);
            $entity->set('epkVerifiedAt', null);
            $entity->set('epkEvidenceReference', null);

            if ($entity->get('status') === 'Active') {
                $entity->set('status', 'Paused');
            } elseif ($entity->get('status') === 'Ready') {
                $entity->set('status', 'Draft');
            }
        } else {
            $this->validateAttestationTransition($entity);
        }

        if ($entity->get('epkAttestationState') === 'Verified') {
            $this->assertVerifiedAttestation($entity);
        }

        if ($entity->get('status') === 'Active') {
            if ($entity->get('epkAttestationState') !== 'Verified') {
                throw new Forbidden('A verified EPK attestation is required before activation.');
            }

            $this->assertVerifiedAttestation($entity);
        }
    }

    private function canonicalizeIsrc(Entity $entity): void
    {
        $value = $entity->get('isrc');

        if ($value === null || $value === '') {
            return;
        }

        if (!is_string($value)) {
            throw new Forbidden('ISRC must be a canonical string.');
        }

        $canonical = strtoupper(str_replace('-', '', trim($value)));

        if (preg_match('/\A[A-Z]{2}[A-Z0-9]{3}[0-9]{7}\z/D', $canonical) !== 1) {
            throw new Forbidden('ISRC must contain a valid canonical 12-character code.');
        }

        $entity->set('isrc', $canonical);
    }

    private function manifestChanged(Entity $entity): bool
    {
        foreach (self::MANIFEST_ATTRIBUTES as $attribute) {
            if ($entity->isAttributeChanged($attribute)) {
                return true;
            }
        }

        return false;
    }

    private function validateAttestationTransition(Entity $entity): void
    {
        $to = $entity->get('epkAttestationState') ?? 'Unverified';

        if (!is_string($to) || !array_key_exists($to, self::ATTESTATION_TRANSITIONS)) {
            throw new Forbidden('The EPK attestation state is invalid.');
        }

        if ($entity->isNew() || !$entity->isAttributeChanged('epkAttestationState')) {
            return;
        }

        $from = $entity->getFetched('epkAttestationState') ?? 'Unverified';

        if (
            !is_string($from) ||
            !array_key_exists($from, self::ATTESTATION_TRANSITIONS) ||
            !in_array($to, self::ATTESTATION_TRANSITIONS[$from], true)
        ) {
            throw new Forbidden("EPK attestation transition {$from} -> {$to} is not allowed.");
        }
    }

    private function assertVerifiedAttestation(Entity $entity): void
    {
        $digest = $entity->get('epkManifestSha256');
        $verifiedAt = $entity->get('epkVerifiedAt');
        $evidence = $entity->get('epkEvidenceReference');
        $verifiedTimestamp = is_string($verifiedAt) ? strtotime($verifiedAt . ' UTC') : false;

        if (
            !is_string($digest) || preg_match('/\A[0-9a-f]{64}\z/D', $digest) !== 1 ||
            !is_string($verifiedAt) || preg_match('/\A[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\z/D', $verifiedAt) !== 1 ||
            $verifiedTimestamp === false || gmdate('Y-m-d H:i:s', $verifiedTimestamp) !== $verifiedAt ||
            !is_string($evidence) || trim($evidence) === '' || strlen($evidence) > 512 ||
            preg_match('/[\x00-\x1F\x7F]/D', $evidence) === 1 ||
            !$this->isPublicHttpsUrl($entity->get('epkUrl'))
        ) {
            throw new Forbidden('The verified EPK attestation evidence is incomplete or unsafe.');
        }
    }

    private function isPublicHttpsUrl(mixed $value): bool
    {
        if (!is_string($value) || strlen($value) > 512 || filter_var($value, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $parts = parse_url($value);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));

        if (
            $scheme !== 'https' || $host === '' ||
            isset($parts['user']) || isset($parts['pass']) ||
            $host === 'localhost' || !str_contains($host, '.') ||
            preg_match('/\.(?:local|localhost|internal|invalid|test|example)\z/D', $host) === 1
        ) {
            return false;
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return filter_var(
                $host,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            ) !== false;
        }

        return preg_match('/\A(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\z/D', $host) === 1;
    }
}
