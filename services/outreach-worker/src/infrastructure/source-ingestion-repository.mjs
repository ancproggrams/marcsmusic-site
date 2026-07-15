import { randomUUID } from "node:crypto";
import { ApplicationError } from "../errors.mjs";
import {
  acquireSessionAdvisoryLock,
  acquireTransactionAdvisoryLock,
  databaseLimits,
  withTransaction
} from "./postgres.mjs";

const DEFAULT_PROCESSING_LEASE_SECONDS = 900;
const IDENTITY_TYPES = new Set([
  "email", "fingerprint", "instagram", "linkedin", "soundcloud",
  "name_outlet", "show_outlet", "outlet_domain"
]);
const IDENTITY_ENTITY_TYPES = new Set(["MediaOutlet", "MediaContact"]);

export class SourceIngestionRepository {
  constructor({ pool }) {
    if (!pool?.query) throw new TypeError("SourceIngestionRepository requires a PostgreSQL pool");
    this.pool = pool;
  }

  async reserveNonce({ sourceId, nonce, timestamp, ttlSeconds }) {
    return withTransaction(this.pool, async (client) => {
      await client.query("DELETE FROM source_ingestion_nonces WHERE expires_at < now()");
      const result = await client.query(
        `INSERT INTO source_ingestion_nonces(source_id,nonce,request_timestamp,expires_at)
         VALUES($1,$2,$3,$3::timestamptz + ($4::text || ' seconds')::interval)
         ON CONFLICT DO NOTHING
         RETURNING nonce`,
        [sourceId, nonce, timestamp.toISOString(), ttlSeconds]
      );
      return result.rowCount === 1;
    });
  }

  async beginArtifact({
    sourceId,
    artifactId,
    contentDigest,
    generatedAt,
    leaseOwner = randomUUID(),
    leaseSeconds = DEFAULT_PROCESSING_LEASE_SECONDS
  }) {
    leaseSeconds = boundedLeaseSeconds(leaseSeconds);
    if (typeof leaseOwner !== "string" || leaseOwner.length < 1 || leaseOwner.length > 64) {
      throw new TypeError("Source ingestion lease owner must contain 1-64 characters");
    }
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO source_ingestion_receipts(
           source_id,artifact_id,content_digest,generated_at,lease_owner,lease_version,locked_until
         )
         VALUES($1,$2,$3,$4,$5,1,now() + ($6::text || ' seconds')::interval)
         ON CONFLICT DO NOTHING
         RETURNING source_id`,
        [sourceId, artifactId, contentDigest, generatedAt, leaseOwner, leaseSeconds]
      );
      const current = await client.query(
        `SELECT source_id,artifact_id,content_digest,status,result,lease_owner,lease_version,locked_until,
                locked_until > now() AS lease_fresh
           FROM source_ingestion_receipts
          WHERE source_id=$1 AND artifact_id=$2
          FOR UPDATE`,
        [sourceId, artifactId]
      );
      const row = current.rows[0];
      if (!row || row.content_digest !== contentDigest) {
        throw new ApplicationError("Artifact identifier was reused with different content", {
          code: "SOURCE_ARTIFACT_ID_COLLISION", statusCode: 409, retryable: false
        });
      }
      if (row.status === "completed") return Object.freeze({ claimed: false, completed: true, result: row.result });
      if (inserted.rowCount) return claimedReceipt(row);
      if (row.status === "processing" && row.lease_fresh) {
        return Object.freeze({ claimed: false, completed: false, inProgress: true });
      }
      const reclaimed = await client.query(
        `UPDATE source_ingestion_receipts
            SET status='processing', attempts=attempts+1, last_error_code=NULL,
                lease_owner=$3,lease_version=lease_version+1,
                locked_until=now() + ($4::text || ' seconds')::interval,updated_at=now()
          WHERE source_id=$1 AND artifact_id=$2
          RETURNING source_id,artifact_id,lease_owner,lease_version,locked_until`,
        [sourceId, artifactId, leaseOwner, leaseSeconds]
      );
      return claimedReceipt(reclaimed.rows[0]);
    });
  }

  async renewArtifactLease({ sourceId, artifactId, leaseOwner, leaseVersion, leaseSeconds = DEFAULT_PROCESSING_LEASE_SECONDS }) {
    leaseSeconds = boundedLeaseSeconds(leaseSeconds);
    const updated = await this.pool.query(
      `UPDATE source_ingestion_receipts
          SET locked_until=now() + ($5::text || ' seconds')::interval,updated_at=now()
        WHERE source_id=$1 AND artifact_id=$2 AND status='processing'
          AND lease_owner=$3 AND lease_version=$4 AND locked_until > now()
        RETURNING locked_until`,
      [sourceId, artifactId, leaseOwner, leaseVersion, leaseSeconds]
    );
    return updated.rowCount === 1;
  }

  async completeArtifact({ sourceId, artifactId, leaseOwner, leaseVersion, result }) {
    const updated = await this.pool.query(
      `UPDATE source_ingestion_receipts
          SET status='completed',result=$5::jsonb,last_error_code=NULL,
              lease_owner=NULL,locked_until=NULL,updated_at=now()
        WHERE source_id=$1 AND artifact_id=$2 AND status='processing'
          AND lease_owner=$3 AND lease_version=$4 AND locked_until > now()`,
      [sourceId, artifactId, leaseOwner, leaseVersion, JSON.stringify(result)]
    );
    if (updated.rowCount !== 1) {
      throw new ApplicationError("Source artifact receipt lost its processing lease", {
        code: "SOURCE_ARTIFACT_LEASE_LOST", statusCode: 409, retryable: true
      });
    }
  }

  async failArtifact({ sourceId, artifactId, leaseOwner, leaseVersion, errorCode }) {
    const updated = await this.pool.query(
      `UPDATE source_ingestion_receipts
          SET status='failed',last_error_code=$5,lease_owner=NULL,locked_until=NULL,updated_at=now()
        WHERE source_id=$1 AND artifact_id=$2 AND status='processing'
          AND lease_owner=$3 AND lease_version=$4 AND locked_until > now()`,
      [sourceId, artifactId, leaseOwner, leaseVersion, String(errorCode).slice(0, 120)]
    );
    return updated.rowCount === 1;
  }

  async beginIdentityResolution({
    entityType,
    identities,
    claimOwner = randomUUID(),
    leaseSeconds = DEFAULT_PROCESSING_LEASE_SECONDS
  }) {
    const normalized = normalizeIdentities(entityType, identities);
    leaseSeconds = boundedLeaseSeconds(leaseSeconds);
    if (typeof claimOwner !== "string" || claimOwner.length < 1 || claimOwner.length > 64) {
      throw new TypeError("Source identity claim owner must contain 1-64 characters");
    }
    const keyJson = JSON.stringify(normalized);
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `DELETE FROM source_identity_claims
          WHERE id IN (
            SELECT id FROM source_identity_claims
             WHERE locked_until <= now()
             ORDER BY locked_until
             LIMIT 1000
          )`
      );
      for (const identity of normalized) {
        await acquireTransactionAdvisoryLock(
          client,
          `source-identity:${entityType}:${identity.type}:${identity.hash}`,
          this.pool.options ?? {}
        );
      }
      await client.query(
        `DELETE FROM source_identity_claims c
          USING source_identity_claim_items i,
                jsonb_to_recordset($1::jsonb) AS k(type text,hash text)
          WHERE c.id=i.claim_id
            AND i.entity_type=$2
            AND i.identity_type=k.type
            AND i.identity_hash=k.hash
            AND c.locked_until <= now()`,
        [keyJson, entityType]
      );
      const active = await client.query(
        `SELECT DISTINCT i.claim_id
           FROM source_identity_claim_items i
           JOIN source_identity_claims c ON c.id=i.claim_id
           JOIN jsonb_to_recordset($1::jsonb) AS k(type text,hash text)
             ON k.type=i.identity_type AND k.hash=i.identity_hash
          WHERE i.entity_type=$2 AND c.locked_until > now()
          LIMIT 1`,
        [keyJson, entityType]
      );
      if (active.rowCount) return Object.freeze({ claimed: false, inProgress: true });

      const bindings = await client.query(
        `WITH matched_ids AS (
           SELECT DISTINCT b.crm_entity_id
             FROM source_identity_bindings b
             JOIN jsonb_to_recordset($1::jsonb) AS k(type text,hash text)
               ON k.type=b.identity_type AND k.hash=b.identity_hash
            WHERE b.entity_type=$2 AND b.evidence_verified=true
         )
         SELECT m.crm_entity_id,
                bool_or(b.evidence_verified) AS evidence_verified,
                max(b.evidence_captured_at) FILTER (WHERE b.evidence_verified) AS verified_evidence_at,
                max(b.evidence_captured_at) AS latest_evidence_at
           FROM matched_ids m
           JOIN source_identity_bindings b
             ON b.entity_type=$2 AND b.crm_entity_id=m.crm_entity_id
          GROUP BY m.crm_entity_id
          ORDER BY m.crm_entity_id`,
        [keyJson, entityType]
      );
      if (bindings.rowCount > 1) throw identityAmbiguous();
      const claim = await client.query(
        `INSERT INTO source_identity_claims(claim_owner,entity_type,locked_until)
         VALUES($1,$2,now() + ($3::text || ' seconds')::interval)
         RETURNING id,locked_until`,
        [claimOwner, entityType, leaseSeconds]
      );
      await client.query(
        `INSERT INTO source_identity_claim_items(claim_id,entity_type,identity_type,identity_hash)
         SELECT $1,$2,k.type,k.hash
           FROM jsonb_to_recordset($3::jsonb) AS k(type text,hash text)`,
        [claim.rows[0].id, entityType, keyJson]
      );
      return Object.freeze({
        claimed: true,
        boundCrmEntityId: bindings.rows[0]?.crm_entity_id,
        boundEvidence: bindings.rows[0] ? Object.freeze({
          verified: Boolean(bindings.rows[0].evidence_verified),
          verifiedAt: bindings.rows[0].verified_evidence_at,
          latestAt: bindings.rows[0].latest_evidence_at
        }) : undefined,
        claim: Object.freeze({
          claimId: claim.rows[0].id,
          claimOwner,
          entityType,
          lockedUntil: claim.rows[0].locked_until
        })
      });
    });
  }

  async completeIdentityResolution({
    claimId,
    claimOwner,
    entityType,
    crmEntityId,
    sourceId,
    externalId,
    evidenceCapturedAt,
    evidenceVerified = false,
    acceptedIdentities
  }) {
    await withTransaction(this.pool, (client) => bindIdentityResolution(client, {
      claimId,
      claimOwner,
      entityType,
      crmEntityId,
      sourceId,
      externalId,
      evidenceCapturedAt,
      evidenceVerified,
      acceptedIdentities
    }));
  }

  async renewIdentityResolution({ claimId, claimOwner, entityType, leaseSeconds = DEFAULT_PROCESSING_LEASE_SECONDS }) {
    leaseSeconds = boundedLeaseSeconds(leaseSeconds);
    const result = await this.pool.query(
      `UPDATE source_identity_claims
          SET locked_until=now() + ($4::text || ' seconds')::interval
        WHERE id=$1 AND claim_owner=$2 AND entity_type=$3 AND locked_until > now()
        RETURNING locked_until`,
      [claimId, claimOwner, entityType, leaseSeconds]
    );
    return result.rowCount === 1;
  }

  async abandonIdentityResolution({ claimId, claimOwner }) {
    const result = await this.pool.query(
      "DELETE FROM source_identity_claims WHERE id=$1 AND claim_owner=$2",
      [claimId, claimOwner]
    );
    return result.rowCount === 1;
  }

  async linkRecord({
    sourceId,
    artifactId,
    leaseOwner,
    leaseVersion,
    externalId,
    entityType,
    crmEntityId,
    evidenceDigest,
    evidenceCapturedAt,
    evidenceVerified = false,
    identityResolution
  }) {
    if (identityResolution && identityResolution.entityType !== entityType) {
      throw new ApplicationError("Source identity claim type does not match its record link", {
        code: "SOURCE_IDENTITY_ENTITY_MISMATCH", statusCode: 409, retryable: false
      });
    }
    await withTransaction(this.pool, async (client) => {
      const lease = await client.query(
        `SELECT 1
           FROM source_ingestion_receipts
          WHERE source_id=$1 AND artifact_id=$2 AND status='processing'
            AND lease_owner=$3 AND lease_version=$4 AND locked_until > now()
          FOR UPDATE`,
        [sourceId, artifactId, leaseOwner, leaseVersion]
      );
      if (lease.rowCount !== 1) throw leaseLost();
      if (identityResolution) {
        await bindIdentityResolution(client, {
          ...identityResolution,
          crmEntityId,
          sourceId,
          externalId,
          evidenceCapturedAt,
          evidenceVerified
        });
      }
      await client.query(
        `INSERT INTO source_ingestion_record_links(
           source_id,external_id,entity_type,crm_entity_id,artifact_id,evidence_digest,evidence_captured_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT(source_id,external_id,entity_type) DO UPDATE SET
           crm_entity_id=EXCLUDED.crm_entity_id,
           artifact_id=EXCLUDED.artifact_id,
           evidence_digest=EXCLUDED.evidence_digest,
           evidence_captured_at=EXCLUDED.evidence_captured_at,
           updated_at=now()
         WHERE EXCLUDED.evidence_captured_at > source_ingestion_record_links.evidence_captured_at`,
        [sourceId, externalId, entityType, crmEntityId, artifactId, evidenceDigest, evidenceCapturedAt]
      );
    });
  }

  async hasActiveSuppression(checks) {
    if (!Array.isArray(checks) || !checks.length) return false;
    const normalized = checks.filter(({ subjectType, subjectHash }) =>
      ["email", "domain", "contact", "outlet"].includes(subjectType)
      && /^[0-9a-f]{64}$/u.test(subjectHash)
    );
    if (!normalized.length) return false;
    const result = await this.pool.query(
      `SELECT 1
         FROM suppression_cache s
         JOIN jsonb_to_recordset($1::jsonb) AS k(subject_type text,subject_hash text)
           ON k.subject_type=s.subject_type AND k.subject_hash=s.subject_hash
        WHERE s.active=true
        LIMIT 1`,
      [JSON.stringify(normalized.map(({ subjectType, subjectHash }) => ({
        subject_type: subjectType,
        subject_hash: subjectHash
      })))]
    );
    return result.rowCount === 1;
  }

  async withSuppressionFence(subjects, work) {
    if (!Array.isArray(subjects) || typeof work !== "function") {
      throw new TypeError("A source suppression fence requires subjects and work");
    }
    const keys = [...new Set(subjects
      .filter(([subjectType, subject]) =>
        ["email", "domain", "contact", "outlet"].includes(subjectType)
        && String(subject ?? "").trim()
      )
      .map(([subjectType, subject]) => suppressionFenceKey(subjectType, subject)))]
      .sort();
    if (!keys.length) return work();
    const client = await this.pool.connect();
    const acquired = [];
    const limits = databaseLimits(this.pool.options ?? {});
    try {
      for (const key of keys) {
        await acquireSessionAdvisoryLock(client, key, limits);
        acquired.push(key);
      }
      return await work();
    } finally {
      for (const key of acquired.reverse()) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]).catch(() => {});
      }
      client.release();
    }
  }

  async findLinkedEntity({ sourceId, externalId, entityType }) {
    const result = await this.pool.query(
      `SELECT crm_entity_id
         FROM source_ingestion_record_links
        WHERE source_id=$1 AND external_id=$2 AND entity_type=$3`,
      [sourceId, externalId, entityType]
    );
    return result.rows[0]?.crm_entity_id;
  }

  async getEmailValidation(recipientHash) {
    const result = await this.pool.query(
      `SELECT status,checked_at,provider_reference,validator_type
         FROM email_validation_cache
        WHERE recipient_hash=$1 AND expires_at > now()`,
      [recipientHash]
    );
    const row = result.rows[0];
    return row ? Object.freeze({
      status: row.status,
      checkedAt: row.checked_at,
      providerReference: row.provider_reference,
      method: row.validator_type
    }) : undefined;
  }

  async putEmailValidation({ recipientHash, status, checkedAt, providerReference, method, ttlDays }) {
    const validatorType = method ?? (String(providerReference).startsWith("smtp:") ? "smtp" : "http");
    await this.pool.query(
      `INSERT INTO email_validation_cache(recipient_hash,status,checked_at,expires_at,provider_reference,validator_type)
       VALUES($1,$2,$3,$3::timestamptz + ($6::text || ' days')::interval,$4,$5)
       ON CONFLICT(recipient_hash) DO UPDATE SET
         status=EXCLUDED.status,
         checked_at=EXCLUDED.checked_at,
         expires_at=EXCLUDED.expires_at,
         provider_reference=EXCLUDED.provider_reference,
         validator_type=EXCLUDED.validator_type,
         updated_at=now()`,
      [recipientHash, status, checkedAt, providerReference, validatorType, ttlDays]
    );
  }
}

function claimedReceipt(row) {
  if (!row?.lease_owner || !row.locked_until) throw leaseLost();
  return Object.freeze({
    claimed: true,
    completed: false,
    lease: Object.freeze({
      sourceId: row.source_id,
      artifactId: row.artifact_id,
      leaseOwner: row.lease_owner,
      leaseVersion: Number(row.lease_version),
      lockedUntil: row.locked_until
    })
  });
}

function leaseLost() {
  return new ApplicationError("Source artifact receipt lost its processing lease", {
    code: "SOURCE_ARTIFACT_LEASE_LOST", statusCode: 409, retryable: true
  });
}

function boundedLeaseSeconds(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 3_600) {
    throw new TypeError("Source ingestion lease must be between 1 and 3600 seconds");
  }
  return value;
}

function normalizeIdentities(entityType, identities) {
  if (!IDENTITY_ENTITY_TYPES.has(entityType) || !Array.isArray(identities) || !identities.length) {
    throw new TypeError("A source identity resolution requires a supported entity type and identities");
  }
  const unique = new Map();
  for (const identity of identities) {
    if (!IDENTITY_TYPES.has(identity?.type) || !/^[0-9a-f]{64}$/u.test(String(identity?.hash ?? ""))) {
      throw new TypeError("Source identity descriptors must use an allowed type and SHA-256 hash");
    }
    unique.set(`${identity.type}:${identity.hash}`, Object.freeze({ type: identity.type, hash: identity.hash }));
  }
  return [...unique.values()].sort((left, right) =>
    left.type.localeCompare(right.type) || left.hash.localeCompare(right.hash)
  );
}

async function bindIdentityResolution(client, {
  claimId,
  claimOwner,
  entityType,
  crmEntityId,
  sourceId,
  externalId,
  evidenceCapturedAt,
  evidenceVerified,
  acceptedIdentities
}) {
  if (!crmEntityId || !sourceId || !externalId) throw new TypeError("A complete source identity binding is required");
  const claim = await client.query(
    `SELECT id FROM source_identity_claims
      WHERE id=$1 AND claim_owner=$2 AND entity_type=$3 AND locked_until > now()
      FOR UPDATE`,
    [claimId, claimOwner, entityType]
  );
  if (!claim.rowCount) throw identityClaimLost();
  const items = await client.query(
    `SELECT identity_type,identity_hash
       FROM source_identity_claim_items
      WHERE claim_id=$1 AND entity_type=$2
      ORDER BY identity_type,identity_hash`,
    [claimId, entityType]
  );
  if (!items.rowCount) throw identityClaimLost();
  const accepted = acceptedIdentities === undefined
    ? (evidenceVerified ? items.rows.map(({ identity_type: type, identity_hash: hash }) => ({ type, hash })) : [])
    : normalizeOptionalIdentities(entityType, acceptedIdentities);
  const claimedKeys = new Set(items.rows.map(({ identity_type, identity_hash }) => `${identity_type}:${identity_hash}`));
  if (accepted.some(({ type, hash }) => !claimedKeys.has(`${type}:${hash}`))) {
    throw new ApplicationError("Accepted source identity was not part of its finite claim", {
      code: "SOURCE_IDENTITY_CLAIM_SCOPE_VIOLATED", statusCode: 409, retryable: false
    });
  }
  if (accepted.length && !evidenceVerified) {
    throw new ApplicationError("Unverified source identities cannot become canonical aliases", {
      code: "SOURCE_IDENTITY_EVIDENCE_UNVERIFIED", statusCode: 409, retryable: false
    });
  }
  const conflicts = await client.query(
    `SELECT DISTINCT b.crm_entity_id
       FROM source_identity_bindings b
       JOIN source_identity_claim_items i
         ON i.entity_type=b.entity_type
        AND i.identity_type=b.identity_type
        AND i.identity_hash=b.identity_hash
      WHERE i.claim_id=$1 AND b.crm_entity_id<>$2`,
    [claimId, crmEntityId]
  );
  if (conflicts.rowCount) throw identityAmbiguous();
  if (accepted.length) await client.query(
    `INSERT INTO source_identity_bindings(
       entity_type,identity_type,identity_hash,crm_entity_id,evidence_captured_at,
       evidence_verified,source_id,external_id
     )
     SELECT i.entity_type,i.identity_type,i.identity_hash,$2,$3,$4,$5,$6
       FROM source_identity_claim_items i
       JOIN jsonb_to_recordset($7::jsonb) AS a(type text,hash text)
         ON a.type=i.identity_type AND a.hash=i.identity_hash
      WHERE i.claim_id=$1
     ON CONFLICT(entity_type,identity_type,identity_hash) DO UPDATE SET
       evidence_captured_at=CASE
         WHEN EXCLUDED.evidence_verified AND (
           NOT source_identity_bindings.evidence_verified
           OR EXCLUDED.evidence_captured_at > source_identity_bindings.evidence_captured_at
         ) THEN EXCLUDED.evidence_captured_at ELSE source_identity_bindings.evidence_captured_at END,
       evidence_verified=source_identity_bindings.evidence_verified OR EXCLUDED.evidence_verified,
       source_id=CASE
         WHEN EXCLUDED.evidence_verified AND (
           NOT source_identity_bindings.evidence_verified
           OR EXCLUDED.evidence_captured_at > source_identity_bindings.evidence_captured_at
         ) THEN EXCLUDED.source_id ELSE source_identity_bindings.source_id END,
       external_id=CASE
         WHEN EXCLUDED.evidence_verified AND (
           NOT source_identity_bindings.evidence_verified
           OR EXCLUDED.evidence_captured_at > source_identity_bindings.evidence_captured_at
         ) THEN EXCLUDED.external_id ELSE source_identity_bindings.external_id END,
       updated_at=now()`,
    [claimId, crmEntityId, evidenceCapturedAt, Boolean(evidenceVerified), sourceId, externalId, JSON.stringify(accepted)]
  );
  await client.query("DELETE FROM source_identity_claims WHERE id=$1", [claimId]);
}

function identityAmbiguous() {
  return new ApplicationError("Source identity criteria resolve to multiple CRM records", {
    code: "SOURCE_DEDUP_AMBIGUOUS", statusCode: 409, retryable: false
  });
}

function identityClaimLost() {
  return new ApplicationError("Source identity resolution lost its finite claim", {
    code: "SOURCE_IDENTITY_CLAIM_LOST", statusCode: 409, retryable: true
  });
}

function normalizeOptionalIdentities(entityType, identities) {
  if (!Array.isArray(identities)) throw new TypeError("Accepted source identities must be an array");
  return identities.length ? normalizeIdentities(entityType, identities) : [];
}

function suppressionFenceKey(subjectType, subject) {
  return `outreach-send-authorization:${subjectType}:${String(subject).trim().toLowerCase()}`;
}
