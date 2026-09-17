import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";
import { reencryptStoredData } from "../src/infrastructure/data-reencryption.mjs";
import { runMigrations } from "../src/infrastructure/postgres.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

const { Pool } = pg;

test("privacy governance ciphertext participates in bounded versioned data-key rotation", async () => {
  const cluster = await startPostgresTestCluster();
  const database = await cluster.createDatabase();
  const pool = new Pool({ connectionString: database.url, max: 4 });
  const oldBox = new CryptoBox({
    encryptionKey: Buffer.alloc(32, 31), keyVersion: "v1", hashKey: "privacy-rotation-hash-key-32-characters"
  });
  const newBox = new CryptoBox({
    encryptionKey: Buffer.alloc(32, 32), keyVersion: "v2", decryptionKeys: { v1: Buffer.alloc(32, 31) },
    hashKey: "privacy-rotation-hash-key-32-characters"
  });
  try {
    await runMigrations(pool);
    const holdId = randomUUID();
    const requestId = randomUUID();
    const artifactId = randomUUID();
    const espoPlanId = randomUUID();
    const holdPayload = { authority: "rotation-test" };
    const requestPayload = { schemaVersion: 1, subject: { type: "contact", value: "contact-rotation" }, evidence: {}, requestedCorrection: null, espoMutations: [] };
    const artifactPayload = { schemaVersion: 2, requestId, subject: requestPayload.subject };
    const espoPayload = {
      schemaVersion: 1, requestId, entityType: "MediaContact", entityId: "contact-rotation",
      expectedVersion: 1, mutationType: "correction", patch: { name: "Corrected" }, subjectGraphDigest: "d".repeat(64)
    };
    const holdEncrypted = oldBox.encryptJson(holdPayload, `privacy-legal-hold:${holdId}`);
    const requestEncrypted = oldBox.encryptJson(requestPayload, `privacy-dsar-request:${requestId}`);
    const artifactDigest = oldBox.integrityHash(`dsar-artifact:${JSON.stringify(artifactPayload)}`);
    const artifactEncrypted = oldBox.encryptJson(artifactPayload, `privacy-dsar-artifact:${requestId}:export:${artifactDigest}`);
    const espoEncrypted = oldBox.encryptJson(espoPayload, `privacy-espo-plan:${espoPlanId}`);
    await pool.query(
      `INSERT INTO privacy_legal_holds
        (id,subject_type,subject_hash,scope_data_class,case_reference,evidence_digest,evidence_ciphertext,evidence_iv,
         evidence_tag,key_version,created_by,integrity_version)
       VALUES ($1,'contact',$2,'*','rotation-case-001',$3,$4,$5,$6,'v1','rotation-actor-001','hmac-sha256-exact-v1')`,
      [holdId, oldBox.subjectHash("contact:contact-rotation"), oldBox.integrityHash(`legal-hold-evidence:${JSON.stringify(holdPayload)}`),
        holdEncrypted.ciphertext, holdEncrypted.iv, holdEncrypted.tag]
    );
    await pool.query(
      `INSERT INTO privacy_dsar_requests
        (id,request_type,subject_type,subject_hash,request_reference,request_digest,payload_ciphertext,payload_iv,
         payload_tag,key_version,requested_by,integrity_version)
       VALUES ($1,'export','contact',$2,'rotation-dsar-001',$3,$4,$5,$6,'v1','rotation-actor-001','hmac-sha256-exact-v1')`,
      [requestId, oldBox.subjectHash("contact:contact-rotation"), oldBox.integrityHash(`dsar-request:${JSON.stringify(requestPayload)}`),
        requestEncrypted.ciphertext, requestEncrypted.iv, requestEncrypted.tag]
    );
    await pool.query(
      `INSERT INTO privacy_dsar_artifacts
        (id,request_id,artifact_type,artifact_digest,counts,payload_ciphertext,payload_iv,payload_tag,key_version,created_by,integrity_version)
       VALUES ($1,$2,'export',$3,'{}',$4,$5,$6,'v1','rotation-actor-001','hmac-sha256-exact-v1')`,
      [artifactId, requestId, artifactDigest, artifactEncrypted.ciphertext, artifactEncrypted.iv, artifactEncrypted.tag]
    );
    await pool.query(
      `INSERT INTO privacy_espo_mutation_plans
        (id,request_id,entity_type,entity_id_hash,expected_version,mutation_type,plan_digest,payload_ciphertext,
         payload_iv,payload_tag,key_version,integrity_version,subject_graph_digest)
       VALUES ($1,$2,'MediaContact',$3,1,'correction',$4,$5,$6,$7,'v1','hmac-sha256-exact-v1',$8)`,
      [espoPlanId, requestId, oldBox.integrityHash("espocrm:MediaContact:contact-rotation"),
        oldBox.integrityHash(`espo-plan:${JSON.stringify(espoPayload)}`), espoEncrypted.ciphertext, espoEncrypted.iv,
        espoEncrypted.tag, espoPayload.subjectGraphDigest]
    );

    const rotated = await reencryptStoredData({ pool, cryptoBox: newBox, apply: true, batchSize: 2, maxBatches: 32 });
    for (const table of ["privacy_legal_holds", "privacy_dsar_requests", "privacy_dsar_artifacts", "privacy_espo_mutation_plans"]) {
      assert.deepEqual(rotated.versionsAfter[table], { v2: 1 }, table);
    }
    const hold = (await pool.query("SELECT * FROM privacy_legal_holds WHERE id=$1", [holdId])).rows[0];
    assert.deepEqual(newBox.decryptJson({
      ciphertext: hold.evidence_ciphertext, iv: hold.evidence_iv, tag: hold.evidence_tag, keyVersion: hold.key_version
    }, `privacy-legal-hold:${holdId}`), holdPayload);
  } finally {
    await pool.end().catch(() => {});
    await cluster.stop();
  }
});
