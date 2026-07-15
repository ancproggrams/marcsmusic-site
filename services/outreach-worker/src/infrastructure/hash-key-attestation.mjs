import { safeEqualText } from "./crypto-box.mjs";

export const HASH_KEY_BOOTSTRAP_CONFIRMATION = "approved-existing-hash-key-attestation";

export async function assertHashKeyAttestation({
  pool,
  cryptoBox,
  bootstrapReference,
  bootstrapConfirmation
}) {
  if (!pool?.connect) throw new TypeError("A PostgreSQL pool is required for hash-key attestation");
  if (typeof cryptoBox?.hashKeyAttestation !== "function") {
    throw new TypeError("A versioned CryptoBox is required for hash-key attestation");
  }
  const client = await pool.connect();
  let bootstrapped = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["outreach-hash-key-attestation-v1"]);
    let stored = await readStoredAttestation(client);
    if (!stored) {
      const existingHashedData = await hasExistingHashedData(client);
      const reference = existingHashedData
        ? requireApprovedBootstrapReference(bootstrapReference, bootstrapConfirmation)
        : "empty-database-bootstrap";
      const expected = cryptoBox.hashKeyAttestation(reference);
      await client.query(
        `INSERT INTO outreach_hash_key_attestations
           (singleton_id,hash_epoch,subject_hash_version,integrity_hash_version,key_fingerprint,
            attestation_mac,bootstrap_reference)
         VALUES (1,$1,$2,$3,$4,$5,$6)`,
        [expected.hashEpoch, expected.subjectHashVersion, expected.integrityHashVersion,
          expected.keyFingerprint, expected.attestationMac, reference]
      );
      stored = await readStoredAttestation(client);
      bootstrapped = true;
    }
    verifyStoredAttestation(stored, cryptoBox);
    await client.query("COMMIT");
    return Object.freeze({
      verified: true,
      bootstrapped,
      hashEpoch: stored.hash_epoch,
      subjectHashVersion: stored.subject_hash_version,
      integrityHashVersion: stored.integrity_hash_version,
      attestedAt: stored.attested_at
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "42P01") {
      throw hashLifecycleError(
        "HASH_KEY_ATTESTATION_SCHEMA_MISSING",
        "Hash-key attestation schema is missing; migration 018 must complete before this runtime may start"
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

async function readStoredAttestation(client) {
  const result = await client.query(
    `SELECT hash_epoch,subject_hash_version,integrity_hash_version,key_fingerprint,
       attestation_mac,bootstrap_reference,attested_at
     FROM outreach_hash_key_attestations WHERE singleton_id=1 FOR UPDATE`
  );
  return result.rows[0];
}

async function hasExistingHashedData(client) {
  const result = await client.query(
    `SELECT (
       EXISTS (SELECT 1 FROM suppression_cache)
       OR EXISTS (SELECT 1 FROM sequence_allocations)
       OR EXISTS (SELECT 1 FROM send_queue)
       OR EXISTS (SELECT 1 FROM send_counters)
       OR EXISTS (SELECT 1 FROM send_capacity_reservations)
       OR EXISTS (SELECT 1 FROM outlet_first_send_guards)
       OR EXISTS (SELECT 1 FROM email_validation_cache)
       OR EXISTS (SELECT 1 FROM source_identity_bindings)
       OR EXISTS (SELECT 1 FROM source_identity_claim_items)
       OR EXISTS (SELECT 1 FROM contact_genre_denials)
       OR EXISTS (SELECT 1 FROM campaign_outlet_allocation_counters)
       OR EXISTS (SELECT 1 FROM campaign_outlet_allocation_ledger)
       OR EXISTS (SELECT 1 FROM privacy_legal_holds)
       OR EXISTS (SELECT 1 FROM privacy_legal_hold_subject_keys)
       OR EXISTS (SELECT 1 FROM privacy_dsar_requests)
       OR EXISTS (SELECT 1 FROM privacy_dsar_subject_keys)
       OR EXISTS (SELECT 1 FROM privacy_record_subject_keys)
       OR EXISTS (SELECT 1 FROM privacy_espo_mutation_plans)
     ) AS value`
  );
  return result.rows[0]?.value === true;
}

function requireApprovedBootstrapReference(reference, confirmation) {
  const normalized = String(reference ?? "").trim();
  if (confirmation !== HASH_KEY_BOOTSTRAP_CONFIRMATION || normalized.length < 12 || normalized.length > 128) {
    throw hashLifecycleError(
      "HASH_KEY_ATTESTATION_BOOTSTRAP_APPROVAL_REQUIRED",
      "Existing keyed identities require an approved bootstrap reference before the active hash-key namespace can be attested"
    );
  }
  return normalized;
}

function verifyStoredAttestation(stored, cryptoBox) {
  if (!stored) {
    throw hashLifecycleError("HASH_KEY_ATTESTATION_MISSING", "Hash-key attestation could not be persisted");
  }
  if (stored.hash_epoch !== cryptoBox.hashKeyEpoch) {
    throw hashLifecycleError(
      "HASH_KEY_ROTATION_REQUIRED",
      "OUTREACH_HASH_KEY_EPOCH differs from the durable namespace; changing it requires an approved bounded rehash migration"
    );
  }
  if (stored.subject_hash_version !== cryptoBox.subjectHashVersion
      || stored.integrity_hash_version !== cryptoBox.integrityVersion) {
    throw hashLifecycleError(
      "HASH_KEY_IDENTITY_VERSION_UNSUPPORTED",
      "The durable keyed-identity schema is not supported by this runtime"
    );
  }
  const expected = cryptoBox.hashKeyAttestation(stored.bootstrap_reference);
  if (!safeEqualText(stored.key_fingerprint, expected.keyFingerprint)
      || !safeEqualText(stored.attestation_mac, expected.attestationMac)) {
    throw hashLifecycleError(
      "HASH_KEY_ATTESTATION_MISMATCH",
      "OUTREACH_HASH_KEY does not authenticate the durable keyed-identity namespace; startup is refused"
    );
  }
}

function hashLifecycleError(code, message) {
  return Object.assign(new Error(message), { code, retryable: false });
}
