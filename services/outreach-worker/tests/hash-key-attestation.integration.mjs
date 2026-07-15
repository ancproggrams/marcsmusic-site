import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";
import {
  assertHashKeyAttestation,
  HASH_KEY_BOOTSTRAP_CONFIRMATION
} from "../src/infrastructure/hash-key-attestation.mjs";
import { runMigrations } from "../src/infrastructure/postgres.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

const { Pool } = pg;

test("hash-key namespace is immutably attested and startup fails closed on drift", async (t) => {
  const cluster = await startPostgresTestCluster();
  try {
    await t.test("concurrent fresh startup persists exactly one authenticated namespace", async () => {
      const database = await cluster.createDatabase();
      const pool = new Pool({ connectionString: database.url, max: 10 });
      const box = cryptoBox("hash-attestation-key-a-with-at-least-32-characters", "epoch-1");
      try {
        await runMigrations(pool);
        const results = await Promise.all(Array.from({ length: 8 }, () => assertHashKeyAttestation({
          pool,
          cryptoBox: box
        })));
        assert.equal(results.filter(({ bootstrapped }) => bootstrapped).length, 1);
        assert.ok(results.every(({ verified, hashEpoch }) => verified && hashEpoch === "epoch-1"));
        assert.ok(results.every((result) => !Object.hasOwn(result, "keyFingerprint")));
        const stored = await pool.query("SELECT * FROM outreach_hash_key_attestations");
        assert.equal(stored.rowCount, 1);
        assert.equal(stored.rows[0].bootstrap_reference, "empty-database-bootstrap");

        await assert.rejects(
          () => pool.query("UPDATE outreach_hash_key_attestations SET hash_epoch='forged' WHERE singleton_id=1"),
          (error) => error.code === "55000"
        );
        await assert.rejects(
          () => pool.query("DELETE FROM outreach_hash_key_attestations WHERE singleton_id=1"),
          (error) => error.code === "55000"
        );
        await assert.rejects(
          () => pool.query("TRUNCATE outreach_hash_key_attestations"),
          (error) => error.code === "55000"
        );
        await assert.rejects(
          () => assertHashKeyAttestation({
            pool,
            cryptoBox: cryptoBox("different-hash-attestation-key-with-32-characters", "epoch-1")
          }),
          (error) => error.code === "HASH_KEY_ATTESTATION_MISMATCH" && error.retryable === false
        );
        await assert.rejects(
          () => assertHashKeyAttestation({ pool, cryptoBox: cryptoBox(box.hashKey, "epoch-2") }),
          (error) => error.code === "HASH_KEY_ROTATION_REQUIRED" && error.retryable === false
        );

        const privileged = await pool.connect();
        try {
          await privileged.query("ALTER TABLE outreach_hash_key_attestations DISABLE TRIGGER outreach_hash_key_attestation_immutable_row");
          await privileged.query("UPDATE outreach_hash_key_attestations SET attestation_mac=$1 WHERE singleton_id=1", ["f".repeat(64)]);
        } finally {
          await privileged.query("ALTER TABLE outreach_hash_key_attestations ENABLE TRIGGER outreach_hash_key_attestation_immutable_row").catch(() => {});
          privileged.release();
        }
        await assert.rejects(
          () => assertHashKeyAttestation({ pool, cryptoBox: box }),
          (error) => error.code === "HASH_KEY_ATTESTATION_MISMATCH"
        );
      } finally {
        await pool.end();
      }
    });

    await t.test("an existing identity namespace requires an explicit one-time bootstrap approval", async () => {
      const database = await cluster.createDatabase();
      const pool = new Pool({ connectionString: database.url, max: 4 });
      const box = cryptoBox("existing-hash-attestation-key-with-32-characters", "legacy-epoch-1");
      try {
        await runMigrations(pool);
        await pool.query(
          `INSERT INTO suppression_cache(subject_type,subject_hash,reason,source,active)
           VALUES ('email',$1,'unsubscribed','attestation-test',true)`,
          [box.privacyHash("email:existing@example.test")]
        );
        await assert.rejects(
          () => assertHashKeyAttestation({ pool, cryptoBox: box }),
          (error) => error.code === "HASH_KEY_ATTESTATION_BOOTSTRAP_APPROVAL_REQUIRED"
        );
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM outreach_hash_key_attestations")).rows[0].count, 0);
        await assert.rejects(
          () => assertHashKeyAttestation({
            pool,
            cryptoBox: box,
            bootstrapReference: "change-hash-attestation-001",
            bootstrapConfirmation: "wrong-confirmation"
          }),
          (error) => error.code === "HASH_KEY_ATTESTATION_BOOTSTRAP_APPROVAL_REQUIRED"
        );
        const activated = await assertHashKeyAttestation({
          pool,
          cryptoBox: box,
          bootstrapReference: "change-hash-attestation-001",
          bootstrapConfirmation: HASH_KEY_BOOTSTRAP_CONFIRMATION
        });
        assert.equal(activated.bootstrapped, true);
        const stored = await pool.query(
          "SELECT hash_epoch,bootstrap_reference FROM outreach_hash_key_attestations WHERE singleton_id=1"
        );
        assert.deepEqual(stored.rows[0], {
          hash_epoch: "legacy-epoch-1",
          bootstrap_reference: "change-hash-attestation-001"
        });
        assert.equal((await assertHashKeyAttestation({ pool, cryptoBox: box })).verified, true);
      } finally {
        await pool.end();
      }
    });
  } finally {
    await cluster.stop();
  }
});

function cryptoBox(hashKey, hashKeyEpoch) {
  return new CryptoBox({
    encryptionKey: Buffer.alloc(32, 88),
    keyVersion: "data-v1",
    hashKey,
    hashKeyEpoch
  });
}

