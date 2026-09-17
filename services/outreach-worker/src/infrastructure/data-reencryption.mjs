import { withTransaction } from "./postgres.mjs";

const DATASETS = Object.freeze([
  Object.freeze({
    name: "encrypted_event_inbox",
    select: "id,source,external_id,payload_ciphertext,payload_iv,payload_tag,key_version",
    ciphertextColumn: "payload_ciphertext",
    ivColumn: "payload_iv",
    tagColumn: "payload_tag",
    aad: (row) => `${row.source}:${row.external_id}`
  }),
  Object.freeze({
    name: "copy_artifacts",
    select: "id,match_id,sequence_step,content_sha256,content_ciphertext,content_iv,content_tag,key_version",
    ciphertextColumn: "content_ciphertext",
    ivColumn: "content_iv",
    tagColumn: "content_tag",
    aad: (row) => `${row.match_id}:${row.sequence_step}:${row.content_sha256}`
  }),
  Object.freeze({
    name: "response_queue",
    select: "id,idempotency_key,payload_ciphertext,payload_iv,payload_tag,key_version",
    ciphertextColumn: "payload_ciphertext",
    ivColumn: "payload_iv",
    tagColumn: "payload_tag",
    aad: (row) => `response:${row.idempotency_key}`
  }),
  Object.freeze({
    name: "human_review_items",
    select: "id,source,source_event_id,review_type,evidence_ciphertext,evidence_iv,evidence_tag,key_version",
    ciphertextColumn: "evidence_ciphertext",
    ivColumn: "evidence_iv",
    tagColumn: "evidence_tag",
    aad: (row) => `human-review:${row.source}:${row.source_event_id}:${row.review_type}`
  }),
  Object.freeze({
    name: "privacy_legal_holds",
    select: "id,evidence_ciphertext,evidence_iv,evidence_tag,key_version",
    ciphertextColumn: "evidence_ciphertext",
    ivColumn: "evidence_iv",
    tagColumn: "evidence_tag",
    aad: (row) => `privacy-legal-hold:${row.id}`
  }),
  Object.freeze({
    name: "privacy_dsar_requests",
    select: "id,payload_ciphertext,payload_iv,payload_tag,key_version",
    ciphertextColumn: "payload_ciphertext",
    ivColumn: "payload_iv",
    tagColumn: "payload_tag",
    aad: (row) => `privacy-dsar-request:${row.id}`
  }),
  Object.freeze({
    name: "privacy_dsar_artifacts",
    select: "id,request_id,artifact_type,artifact_digest,payload_ciphertext,payload_iv,payload_tag,key_version",
    ciphertextColumn: "payload_ciphertext",
    ivColumn: "payload_iv",
    tagColumn: "payload_tag",
    aad: (row) => `privacy-dsar-artifact:${row.request_id}:${row.artifact_type}:${row.artifact_digest}`
  }),
  Object.freeze({
    name: "privacy_espo_mutation_plans",
    select: "id,payload_ciphertext,payload_iv,payload_tag,key_version",
    ciphertextColumn: "payload_ciphertext",
    ivColumn: "payload_iv",
    tagColumn: "payload_tag",
    aad: (row) => `privacy-espo-plan:${row.id}`
  })
]);

const ROTATION_LOCK = "marcsmusic-outreach-data-reencryption";

export async function inspectDataKeyVersions(pool) {
  assertPool(pool);
  const versions = {};
  for (const dataset of DATASETS) {
    const result = await pool.query(
      `SELECT key_version,count(*)::int AS count
         FROM ${dataset.name}
        GROUP BY key_version
        ORDER BY key_version`
    );
    versions[dataset.name] = Object.freeze(Object.fromEntries(
      result.rows.map(({ key_version: version, count }) => [version, Number(count)])
    ));
  }
  return Object.freeze(versions);
}

export async function reencryptStoredData({ pool, cryptoBox, apply = false, batchSize = 100, maxBatches = 10 }) {
  assertPool(pool);
  if (!cryptoBox?.keyVersion || typeof cryptoBox.reencryptJson !== "function") {
    throw new TypeError("A versioned CryptoBox is required");
  }
  assertBoundedInteger(batchSize, 1, 500, "batchSize");
  assertBoundedInteger(maxBatches, 1, 1_000, "maxBatches");
  const before = await inspectDataKeyVersions(pool);
  if (!apply) {
    return Object.freeze({
      applied: false,
      activeKeyVersion: cryptoBox.keyVersion,
      batchSize,
      maxBatches,
      batches: 0,
      updated: emptyCounts(),
      versions: before
    });
  }

  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query("SELECT pg_try_advisory_lock(hashtext($1)) AS acquired", [ROTATION_LOCK]);
    if (lock.rows[0]?.acquired !== true) {
      throw Object.assign(new Error("Another data re-encryption job is already running"), {
        code: "DATA_REENCRYPTION_ALREADY_RUNNING",
        retryable: true
      });
    }

    const updated = emptyCounts();
    let batches = 0;
    let consecutiveEmpty = 0;
    while (batches < maxBatches && consecutiveEmpty < DATASETS.length) {
      const dataset = DATASETS[batches % DATASETS.length];
      const count = await reencryptDatasetBatch({ pool, cryptoBox, dataset, batchSize });
      batches += 1;
      updated[dataset.name] += count;
      consecutiveEmpty = count === 0 ? consecutiveEmpty + 1 : 0;
    }
    const after = await inspectDataKeyVersions(pool);
    return Object.freeze({
      applied: true,
      activeKeyVersion: cryptoBox.keyVersion,
      batchSize,
      maxBatches,
      batches,
      updated: Object.freeze(updated),
      versionsBefore: before,
      versionsAfter: after
    });
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock(hashtext($1))", [ROTATION_LOCK]).catch(() => {});
    lockClient.release();
  }
}

async function reencryptDatasetBatch({ pool, cryptoBox, dataset, batchSize }) {
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `SELECT ${dataset.select}
         FROM ${dataset.name}
        WHERE key_version<>$1
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT $2`,
      [cryptoBox.keyVersion, batchSize]
    );
    let updated = 0;
    for (const row of result.rows) {
      const encrypted = cryptoBox.reencryptJson({
        ciphertext: row[dataset.ciphertextColumn],
        iv: row[dataset.ivColumn],
        tag: row[dataset.tagColumn],
        keyVersion: row.key_version
      }, dataset.aad(row));
      const committed = await client.query(
        `UPDATE ${dataset.name}
            SET ${dataset.ciphertextColumn}=$2,${dataset.ivColumn}=$3,${dataset.tagColumn}=$4,key_version=$5
          WHERE id=$1 AND key_version=$6`,
        [row.id, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, row.key_version]
      );
      updated += committed.rowCount;
    }
    return updated;
  });
}

function emptyCounts() {
  return Object.fromEntries(DATASETS.map(({ name }) => [name, 0]));
}

function assertPool(pool) {
  if (!pool?.query || !pool?.connect) throw new TypeError("A PostgreSQL pool is required");
}

function assertBoundedInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}
