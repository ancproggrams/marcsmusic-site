import { randomUUID } from "node:crypto";
import { acquireTransactionAdvisoryLock, databaseLimits, withTransaction } from "./postgres.mjs";
import { canonicalDigest, canonicalJson, PRIVACY_DATA_CLASSES } from "../domain/privacy-policy.mjs";

const EXECUTION_LEASE = "privacy-retention-execution";
const LEGAL_HOLD_LOCK = "privacy-governance-legal-hold-fence";
const PRIVACY_INDEX_BUILD_LOCK = "privacy-index-build-v1";
const INTEGRITY_VERSION = "hmac-sha256-exact-v1";
const DATA_CLASS_SET = new Set(PRIVACY_DATA_CLASSES);

export class PrivacyGovernanceRepository {
  constructor({ pool, cryptoBox, database = {} }) {
    if (!pool?.query || !pool?.connect) throw new TypeError("A PostgreSQL pool is required");
    if (!cryptoBox?.encryptJson || !cryptoBox?.privacyHash || !cryptoBox?.integrityHash) {
      throw new TypeError("A versioned CryptoBox with separate subject and integrity hashing is required");
    }
    this.pool = pool;
    this.cryptoBox = cryptoBox;
    this.databaseLimits = databaseLimits({ ...(pool.options ?? {}), ...database });
  }

  async createRetentionPlan({ policy, snapshotAt, actorId }) {
    const snapshot = validDate(snapshotAt, "snapshotAt");
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, LEGAL_HOLD_LOCK, this.databaseLimits);
      await this.assertPrivacyIndexReady(client);
      const activeHolds = await this.activeLegalHolds(client);
      const discovered = [];
      for (const [dataClass, classPolicy] of Object.entries(policy.dataClasses)) {
        const targets = TARGETS.filter((target) => target.dataClass === dataClass);
        const cutoff = new Date(snapshot.getTime() - classPolicy.retentionDays * 86_400_000);
        let classCount = 0;
        for (const target of targets) {
          if (target.unindexedSql) {
            const unindexed = await client.query(target.unindexedSql, [cutoff]);
            if (unindexed.rowCount) {
              throw governanceError(
                "PRIVACY_INDEX_BACKFILL_REQUIRED",
                `Eligible ${target.tableName} records require bounded privacy index backfill before planning`
              );
            }
          }
          const remaining = classPolicy.maximumRecordsPerPlan - classCount;
          if (remaining < 1) {
            const overflow = await client.query(target.candidateSql, [cutoff, 1]);
            if (overflow.rowCount) throw planLimitError(dataClass, classPolicy.maximumRecordsPerPlan);
            continue;
          }
          const rows = await client.query(target.candidateSql, [cutoff, remaining + 1]);
          if (rows.rowCount > remaining) throw planLimitError(dataClass, classPolicy.maximumRecordsPerPlan);
          const subjectKeysByRecord = await persistRecordSubjectKeys(client, target, rows.rows, this.cryptoBox);
          for (const row of rows.rows) {
            const recordKey = targetRecordKey(target, row, this.cryptoBox);
            const subjectKeys = subjectKeysByRecord.get(recordKey) ?? Object.freeze([]);
            const held = recordMatchesLegalHold(activeHolds, dataClass, subjectKeys);
            discovered.push(Object.freeze({
              dataClass,
              tableName: target.tableName,
              recordKey,
              observedDigest: target.digest(row, this.cryptoBox),
              observedDigestVersion: INTEGRITY_VERSION,
              cutoffAt: cutoff.toISOString(),
              action: held ? (target.preserveAction ?? "legal_hold_preserved") : target.action,
              status: held ? "held" : "planned"
            }));
          }
          classCount += rows.rowCount;
        }
      }
      const items = discovered
        .sort((left, right) => left.dataClass.localeCompare(right.dataClass)
          || left.tableName.localeCompare(right.tableName)
          || left.recordKey.localeCompare(right.recordKey))
        .map((item, ordinal) => Object.freeze({ ...item, ordinal }));
      const counts = planCounts(items);
      const targetContractDigest = this.cryptoBox.integrityHash(canonicalJson(items.map(planTargetContractItem)));
      const digest = canonicalDigest({
        schemaVersion: 2,
        planType: "retention",
        policyVersion: policy.policyVersion,
        policyDigest: policy.digest,
        approvedPolicyReference: policy.approvedPolicyReference,
        snapshotAt: snapshot.toISOString(),
        targetContractDigest,
        targetContractVersion: INTEGRITY_VERSION,
        items: items.map(planDigestItem)
      });
      const inserted = await client.query(
        `INSERT INTO privacy_governance_plans
          (plan_type,policy_schema_version,policy_version,policy_digest,approved_policy_reference,
           snapshot_at,canonical_digest,counts,status,created_by,target_contract_digest,target_contract_version)
         VALUES ('retention',$1,$2,$3,$4,$5,$6,$7::jsonb,'planned',$8,$9,$10)
         ON CONFLICT (canonical_digest) DO NOTHING
         RETURNING id,status,created_at`,
        [policy.schemaVersion, policy.policyVersion, policy.digest, policy.approvedPolicyReference,
          snapshot, digest, JSON.stringify(counts), actorId, targetContractDigest, INTEGRITY_VERSION]
      );
      if (!inserted.rowCount) {
        const existing = await client.query(
          "SELECT id,status,created_at FROM privacy_governance_plans WHERE canonical_digest=$1",
          [digest]
        );
        return Object.freeze({
          planId: existing.rows[0].id,
          digest,
          targetContractDigest,
          targetContractVersion: INTEGRITY_VERSION,
          counts: Object.freeze(counts),
          status: existing.rows[0].status,
          replayed: true
        });
      }
      const planId = inserted.rows[0].id;
      for (const batch of chunk(items, 500)) {
        await client.query(
          `INSERT INTO privacy_governance_plan_items
            (plan_id,ordinal,data_class,table_name,record_key,observed_digest,observed_digest_version,cutoff_at,action,status)
           SELECT $1,x.ordinal,x.data_class,x.table_name,x.record_key,x.observed_digest,x.observed_digest_version,
                  x.cutoff_at::timestamptz,x.action,x.status
           FROM jsonb_to_recordset($2::jsonb) AS x(
             ordinal bigint,data_class text,table_name text,record_key text,observed_digest char(64),
             observed_digest_version text,cutoff_at text,action text,status text
           )`,
          [planId, JSON.stringify(batch.map((item) => ({
            ordinal: item.ordinal,
            data_class: item.dataClass,
            table_name: item.tableName,
            record_key: item.recordKey,
            observed_digest: item.observedDigest,
            observed_digest_version: item.observedDigestVersion,
            cutoff_at: item.cutoffAt,
            action: item.action,
            status: item.status
          })))]
        );
      }
      await appendAudit(client, this.databaseLimits, {
        eventType: "retention_plan_created",
        aggregateType: "privacy_plan",
        aggregateId: planId,
        actorId,
        planDigest: digest,
        details: counts
      });
      return Object.freeze({
        planId,
        digest,
        targetContractDigest,
        targetContractVersion: INTEGRITY_VERSION,
        counts: Object.freeze(counts),
        status: "planned",
        replayed: false
      });
    });
  }

  async activeLegalHolds(client = this.pool) {
    const result = await client.query(
      `SELECT hold.id,hold.subject_type,hold.scope_data_class,subject_key.key_type,subject_key.subject_hash
       FROM privacy_legal_holds hold
       LEFT JOIN privacy_legal_hold_subject_keys subject_key ON subject_key.hold_id=hold.id
       WHERE hold.status='active' ORDER BY hold.id,subject_key.key_type,subject_key.subject_hash`
    );
    const holds = new Map();
    for (const row of result.rows) {
      const hold = holds.get(row.id) ?? {
        id: row.id,
        subjectType: row.subject_type,
        scopeDataClass: row.scope_data_class,
        subjectKeys: []
      };
      if (row.key_type && row.subject_hash) hold.subjectKeys.push(`${row.key_type}:${row.subject_hash}`);
      holds.set(row.id, hold);
    }
    return Object.freeze([...holds.values()].map((hold) => Object.freeze({
      ...hold,
      subjectKeys: Object.freeze(hold.subjectKeys)
    })));
  }

  async inspectPrivacyRecordIndex(client = this.pool) {
    const counts = {};
    for (const target of PRIVACY_INDEX_TARGETS) {
      const result = await client.query(`SELECT count(*)::int AS count FROM ${target.tableName} WHERE privacy_record_id IS NULL`);
      counts[target.tableName] = Number(result.rows[0].count);
    }
    return Object.freeze(counts);
  }

  async inspectPrivacyIndexState(client = this.pool) {
    const names = PRIVACY_INDEX_DEFINITIONS.map(({ name }) => name);
    const result = await client.query(
      `SELECT index_relation.relname AS index_name,
              table_relation.relname AS table_name,
              index_metadata.indisvalid,
              index_metadata.indisready,
              index_metadata.indisunique,
              access_method.amname AS access_method,
              ARRAY(
                SELECT attribute.attname
                FROM unnest(index_metadata.indkey::smallint[]) WITH ORDINALITY AS key(attnum,ordinality)
                JOIN pg_attribute attribute
                  ON attribute.attrelid=index_metadata.indrelid AND attribute.attnum=key.attnum
                WHERE key.ordinality<=index_metadata.indnkeyatts
                ORDER BY key.ordinality
              ) AS key_columns,
              pg_get_expr(index_metadata.indpred,index_metadata.indrelid) AS predicate
       FROM pg_class index_relation
       JOIN pg_namespace namespace ON namespace.oid=index_relation.relnamespace
       JOIN pg_index index_metadata ON index_metadata.indexrelid=index_relation.oid
       JOIN pg_class table_relation ON table_relation.oid=index_metadata.indrelid
       JOIN pg_am access_method ON access_method.oid=index_relation.relam
       WHERE namespace.nspname='public' AND index_relation.relname=ANY($1::text[])`,
      [names]
    );
    const byName = new Map(result.rows.map((row) => [row.index_name, row]));
    const indexes = PRIVACY_INDEX_DEFINITIONS.map((definition) => {
      const row = byName.get(definition.name);
      const compatible = row ? indexDefinitionMatches(definition, row) : false;
      const status = !row
        ? "missing"
        : !compatible
          ? "definition_mismatch"
          : row.indisvalid !== true || row.indisready !== true
            ? "invalid"
            : "valid";
      return Object.freeze({
        name: definition.name,
        tableName: definition.tableName,
        unique: definition.unique,
        status
      });
    });
    const indexesReady = indexes.every(({ status }) => status === "valid");
    const constraintResult = await client.query(
      `SELECT constraint_name.conname AS constraint_name,
              table_relation.relname AS table_name,
              constraint_name.convalidated,constraint_name.contype,
              referenced_relation.relname AS referenced_table,constraint_name.confdeltype,
              ARRAY(
                SELECT attribute.attname FROM unnest(constraint_name.conkey) WITH ORDINALITY AS key(attnum,ordinality)
                JOIN pg_attribute attribute ON attribute.attrelid=constraint_name.conrelid AND attribute.attnum=key.attnum
                ORDER BY key.ordinality
              ) AS local_columns,
              ARRAY(
                SELECT attribute.attname FROM unnest(constraint_name.confkey) WITH ORDINALITY AS key(attnum,ordinality)
                JOIN pg_attribute attribute ON attribute.attrelid=constraint_name.confrelid AND attribute.attnum=key.attnum
                ORDER BY key.ordinality
              ) AS referenced_columns
       FROM pg_constraint constraint_name
       JOIN pg_class table_relation ON table_relation.oid=constraint_name.conrelid
       LEFT JOIN pg_class referenced_relation ON referenced_relation.oid=constraint_name.confrelid
       JOIN pg_namespace namespace ON namespace.oid=table_relation.relnamespace
       WHERE namespace.nspname='public' AND constraint_name.conname=ANY($1::text[])`,
      [PRIVACY_CONSTRAINT_DEFINITIONS.map(({ name }) => name)]
    );
    const constraintByName = new Map(constraintResult.rows.map((row) => [row.constraint_name, row]));
    const constraints = PRIVACY_CONSTRAINT_DEFINITIONS.map((definition) => {
      const row = constraintByName.get(definition.name);
      const status = !row
        ? "missing"
        : !constraintDefinitionMatches(definition, row)
          ? "definition_mismatch"
          : row.convalidated === true
            ? "valid"
            : "not_valid";
      return Object.freeze({ name: definition.name, tableName: definition.tableName, status });
    });
    const constraintsReady = constraints.every(({ status }) => status === "valid");
    const recordContractResult = await client.query(
      `SELECT table_relation.relname AS table_name,attribute.attnotnull,
              pg_get_expr(attribute_default.adbin,attribute_default.adrelid) AS column_default,
              check_constraint.conname AS check_name,check_constraint.convalidated AS check_validated,
              pg_get_constraintdef(check_constraint.oid) AS check_definition
       FROM pg_class table_relation
       JOIN pg_namespace namespace ON namespace.oid=table_relation.relnamespace
       JOIN pg_attribute attribute
         ON attribute.attrelid=table_relation.oid AND attribute.attname='privacy_record_id' AND NOT attribute.attisdropped
       LEFT JOIN pg_attrdef attribute_default
         ON attribute_default.adrelid=attribute.attrelid AND attribute_default.adnum=attribute.attnum
       LEFT JOIN pg_constraint check_constraint
         ON check_constraint.conrelid=table_relation.oid AND check_constraint.conname=ANY($2::text[])
       WHERE namespace.nspname='public' AND table_relation.relname=ANY($1::text[])`,
      [
        PRIVACY_RECORD_ID_CONTRACTS.map(({ tableName }) => tableName),
        PRIVACY_RECORD_ID_CONTRACTS.map(({ checkName }) => checkName)
      ]
    );
    const recordContractByTable = new Map(recordContractResult.rows.map((row) => [row.table_name, row]));
    const recordIdContracts = PRIVACY_RECORD_ID_CONTRACTS.map((definition) => {
      const row = recordContractByTable.get(definition.tableName);
      const defaultStatus = !row?.column_default
        ? "missing"
        : normalizeDefaultExpression(row.column_default) === "gen_random_uuid()"
          ? "valid"
          : "definition_mismatch";
      return Object.freeze({
        tableName: definition.tableName,
        defaultStatus,
        notNull: row?.attnotnull === true,
        transitionalCheck: row?.check_name
          ? Object.freeze({
            name: row.check_name,
            validated: row.check_validated === true,
            definitionMatches: recordIdCheckMatches(row.check_definition)
          })
          : null
      });
    });
    const recordIdContractsReady = recordIdContracts.every(({ defaultStatus, notNull }) => defaultStatus === "valid" && notNull);
    const backfill = await this.inspectPrivacyRecordIndex(client);
    const backfillComplete = Object.values(backfill).every((count) => count === 0);
    return Object.freeze({
      schemaVersion: 1,
      ready: indexesReady && constraintsReady && recordIdContractsReady && backfillComplete,
      indexesReady,
      constraintsReady,
      recordIdContractsReady,
      backfillComplete,
      indexes: Object.freeze(indexes),
      constraints: Object.freeze(constraints),
      recordIdContracts: Object.freeze(recordIdContracts),
      backfill
    });
  }

  async ensurePrivacyIndexes({ actorId, apply = false }) {
    const before = await this.inspectPrivacyIndexState();
    if (!apply) return Object.freeze({ applied: false, changed: Object.freeze([]), before, after: before });
    const client = await this.pool.connect();
    let locked = false;
    const changed = [];
    try {
      const lock = await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS acquired", [PRIVACY_INDEX_BUILD_LOCK]);
      if (lock.rows[0]?.acquired !== true) {
        throw governanceError("PRIVACY_INDEX_BUILD_ALREADY_RUNNING", "Another privacy index build is already active", true);
      }
      locked = true;
      await client.query(
        `SELECT set_config('statement_timeout',$1,false),set_config('lock_timeout',$2,false)`,
        [`${this.databaseLimits.statementTimeoutMs}ms`, `${this.databaseLimits.lockTimeoutMs}ms`]
      );
      for (const definition of PRIVACY_INDEX_DEFINITIONS) {
        const state = await inspectSinglePrivacyIndex(client, definition);
        if (state?.status === "definition_mismatch" && state.valid) {
          throw governanceError(
            "PRIVACY_INDEX_DEFINITION_MISMATCH",
            `Existing valid index ${definition.name} does not match the compiled privacy index definition`
          );
        }
        if (state && (!state.valid || !state.ready || state.status === "definition_mismatch")) {
          await client.query(definition.dropSql);
          changed.push(Object.freeze({ name: definition.name, action: "invalid_index_dropped" }));
        }
        const current = await inspectSinglePrivacyIndex(client, definition);
        if (!current) {
          await client.query(definition.createSql);
          changed.push(Object.freeze({ name: definition.name, action: "index_created" }));
        }
        const verified = await inspectSinglePrivacyIndex(client, definition);
        if (!verified || !verified.valid || !verified.ready || verified.status !== "valid") {
          throw governanceError("PRIVACY_INDEX_BUILD_INCOMPLETE", `Privacy index ${definition.name} is not valid and ready`);
        }
      }
      for (const definition of PRIVACY_CONSTRAINT_DEFINITIONS) {
        const state = await inspectSinglePrivacyConstraint(client, definition);
        if (!state) {
          throw governanceError("PRIVACY_CONSTRAINT_MISSING", `Required privacy constraint ${definition.name} is missing`);
        }
        if (!state.compatible) {
          throw governanceError("PRIVACY_CONSTRAINT_DEFINITION_MISMATCH", `Constraint ${definition.name} is attached to an unexpected table`);
        }
        if (!state.validated) {
          await client.query(definition.validateSql);
          changed.push(Object.freeze({ name: definition.name, action: "constraint_validated" }));
        }
        const verified = await inspectSinglePrivacyConstraint(client, definition);
        if (!verified?.validated || !verified.compatible) {
          throw governanceError("PRIVACY_CONSTRAINT_VALIDATION_INCOMPLETE", `Privacy constraint ${definition.name} is not validated`);
        }
      }
    } finally {
      await client.query("RESET statement_timeout").catch(() => {});
      await client.query("RESET lock_timeout").catch(() => {});
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [PRIVACY_INDEX_BUILD_LOCK]).catch(() => {});
      client.release();
    }
    const after = await this.inspectPrivacyIndexState();
    if (!after.indexesReady || !after.constraintsReady) {
      throw governanceError("PRIVACY_INDEX_BUILD_INCOMPLETE", "Not all compiled privacy indexes and constraints are valid and ready");
    }
    if (changed.length) {
      await withTransaction(this.pool, async (auditClient) => appendAudit(auditClient, this.databaseLimits, {
        eventType: "privacy_schema_prepared",
        aggregateType: "privacy_record_index",
        aggregateId: "privacy-record-index-v1",
        actorId,
        details: { changed: changed.map(({ name, action }) => ({ name, action })) }
      }));
    }
    return Object.freeze({ applied: true, changed: Object.freeze(changed), before, after });
  }

  async assertPrivacyIndexReady(client = this.pool) {
    const state = await this.inspectPrivacyIndexState(client);
    if (!state.ready) {
      throw governanceError(
        "PRIVACY_INDEX_NOT_READY",
        "Privacy planning and execution require every compiled index and constraint to be valid and the bounded record-id backfill to be complete",
        true
      );
    }
    return state;
  }

  async finalizePrivacyRecordIdContracts({ actorId, apply = false }) {
    const before = await this.inspectPrivacyIndexState();
    if (!apply) return Object.freeze({ applied: false, changed: Object.freeze([]), before, after: before });
    if (!before.indexesReady) {
      throw governanceError("PRIVACY_INDEX_NOT_READY", "Privacy record-id indexes must be valid before finalization", true);
    }
    if (!before.backfillComplete) {
      throw governanceError("PRIVACY_INDEX_NOT_READY", "Bounded record-id backfill must complete before finalization", true);
    }
    const client = await this.pool.connect();
    let locked = false;
    const changed = [];
    try {
      const lock = await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS acquired", [PRIVACY_INDEX_BUILD_LOCK]);
      if (lock.rows[0]?.acquired !== true) {
        throw governanceError("PRIVACY_INDEX_BUILD_ALREADY_RUNNING", "Another privacy schema finalization is already active", true);
      }
      locked = true;
      await client.query(
        `SELECT set_config('statement_timeout',$1,false),set_config('lock_timeout',$2,false)`,
        [`${this.databaseLimits.statementTimeoutMs}ms`, `${this.databaseLimits.lockTimeoutMs}ms`]
      );
      for (const definition of PRIVACY_RECORD_ID_CONTRACTS) {
        const state = await inspectRecordIdContract(client, definition);
        if (state.defaultExpression && normalizeDefaultExpression(state.defaultExpression) !== "gen_random_uuid()") {
          throw governanceError("PRIVACY_RECORD_ID_DEFAULT_MISMATCH", `Unexpected privacy_record_id default on ${definition.tableName}`);
        }
        if (!state.defaultExpression) {
          await client.query(definition.setDefaultSql);
          changed.push(Object.freeze({ name: definition.tableName, action: "uuid_default_set" }));
        }
        if (state.checkExists && !state.checkCompatible) {
          throw governanceError("PRIVACY_RECORD_ID_CHECK_MISMATCH", `Unexpected privacy_record_id check definition on ${definition.tableName}`);
        }
      }
      for (const definition of PRIVACY_RECORD_ID_CONTRACTS) {
        const remaining = await client.query(definition.nullProbeSql);
        if (remaining.rowCount) {
          throw governanceError("PRIVACY_INDEX_NOT_READY", `Bounded record-id backfill is incomplete for ${definition.tableName}`, true);
        }
        let state = await inspectRecordIdContract(client, definition);
        if (!state.notNull && !state.checkExists) {
          await client.query(definition.addCheckSql);
          changed.push(Object.freeze({ name: definition.checkName, action: "not_null_check_added" }));
          state = await inspectRecordIdContract(client, definition);
        }
        if (!state.notNull && !state.checkValidated) {
          await client.query(definition.validateCheckSql);
          changed.push(Object.freeze({ name: definition.checkName, action: "not_null_check_validated" }));
          state = await inspectRecordIdContract(client, definition);
        }
        if (!state.notNull) {
          await client.query(definition.setNotNullSql);
          changed.push(Object.freeze({ name: definition.tableName, action: "not_null_set" }));
        }
        state = await inspectRecordIdContract(client, definition);
        if (state.checkExists) {
          await client.query(definition.dropCheckSql);
          changed.push(Object.freeze({ name: definition.checkName, action: "transitional_check_dropped" }));
        }
        const verified = await inspectRecordIdContract(client, definition);
        if (!verified.notNull || normalizeDefaultExpression(verified.defaultExpression) !== "gen_random_uuid()") {
          throw governanceError("PRIVACY_RECORD_ID_FINALIZATION_INCOMPLETE", `privacy_record_id contract is incomplete for ${definition.tableName}`);
        }
      }
    } finally {
      await client.query("RESET statement_timeout").catch(() => {});
      await client.query("RESET lock_timeout").catch(() => {});
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [PRIVACY_INDEX_BUILD_LOCK]).catch(() => {});
      client.release();
    }
    const after = await this.inspectPrivacyIndexState();
    if (!after.recordIdContractsReady || !after.backfillComplete) {
      throw governanceError("PRIVACY_RECORD_ID_FINALIZATION_INCOMPLETE", "Privacy record-id contracts are not ready");
    }
    if (changed.length) {
      await withTransaction(this.pool, async (auditClient) => appendAudit(auditClient, this.databaseLimits, {
        eventType: "privacy_record_id_contracts_finalized",
        aggregateType: "privacy_record_index",
        aggregateId: "privacy-record-index-v1",
        actorId,
        details: { changed: changed.map(({ name, action }) => ({ name, action })) }
      }));
    }
    return Object.freeze({ applied: true, changed: Object.freeze(changed), before, after });
  }

  async backfillPrivacyRecordIds({ actorId, apply = false, batchSize = 100, maxBatches = 10 }) {
    assertInteger(batchSize, 1, 500, "batchSize");
    assertInteger(maxBatches, 1, 10_000, "maxBatches");
    const before = await this.inspectPrivacyRecordIndex();
    if (!apply) return Object.freeze({ applied: false, before, updated: Object.freeze({}) });
    const indexState = await this.inspectPrivacyIndexState();
    if (!indexState.indexesReady) {
      throw governanceError("PRIVACY_INDEX_NOT_READY", "All compiled privacy indexes must be valid before record-id backfill", true);
    }
    const updated = Object.fromEntries(PRIVACY_INDEX_TARGETS.map(({ tableName }) => [tableName, 0]));
    let consecutiveEmpty = 0;
    let batches = 0;
    while (batches < maxBatches && consecutiveEmpty < PRIVACY_INDEX_TARGETS.length) {
      const target = PRIVACY_INDEX_TARGETS[batches % PRIVACY_INDEX_TARGETS.length];
      const count = await withTransaction(this.pool, async (client) => {
        await acquireTransactionAdvisoryLock(client, "privacy-record-index-backfill", this.databaseLimits);
        const result = await client.query(target.updateSql, [batchSize]);
        if (target.tableName === "contact_genre_denials" && result.rowCount) {
          await backfillContactGenreDenialHashes(client, result.rows, this.cryptoBox);
        }
        if (result.rowCount) {
          await appendAudit(client, this.databaseLimits, {
            eventType: "privacy_record_index_batch_completed",
            aggregateType: "privacy_record_index",
            aggregateId: "privacy-record-index-v1",
            actorId,
            details: { tableName: target.tableName, updated: result.rowCount }
          });
        }
        return result.rowCount;
      });
      updated[target.tableName] += count;
      batches += 1;
      consecutiveEmpty = count === 0 ? consecutiveEmpty + 1 : 0;
    }
    return Object.freeze({
      applied: true,
      batches,
      before,
      updated: Object.freeze(updated),
      after: await this.inspectPrivacyRecordIndex()
    });
  }

  async createLegalHold({ subjectType, subjectHash, subjectKeys, scopeDataClass, caseReference, evidence, actorId }) {
    assertScope(scopeDataClass);
    const lookupKeys = normalizeLegalHoldSubjectKeys(subjectHash, subjectKeys);
    const id = randomUUID();
    const encrypted = this.cryptoBox.encryptJson(evidence ?? {}, `privacy-legal-hold:${id}`);
    const evidenceDigest = this.cryptoBox.integrityHash(`legal-hold-evidence:${canonicalJson(evidence ?? {})}`);
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, LEGAL_HOLD_LOCK, this.databaseLimits);
      const inserted = await client.query(
        `INSERT INTO privacy_legal_holds
          (id,subject_type,subject_hash,scope_data_class,case_reference,evidence_digest,
           evidence_ciphertext,evidence_iv,evidence_tag,key_version,created_by,integrity_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (subject_type,subject_hash,scope_data_class,case_reference) WHERE status='active'
         DO NOTHING RETURNING id`,
        [id, subjectType, subjectHash, scopeDataClass, caseReference, evidenceDigest,
          encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, actorId, INTEGRITY_VERSION]
      );
      let holdId = inserted.rows[0]?.id;
      if (!holdId) {
        const existing = await client.query(
          `SELECT id,evidence_digest FROM privacy_legal_holds
           WHERE subject_type=$1 AND subject_hash=$2 AND scope_data_class=$3 AND case_reference=$4 AND status='active'`,
          [subjectType, subjectHash, scopeDataClass, caseReference]
        );
        if (existing.rows[0]?.evidence_digest !== evidenceDigest) {
          throw governanceError("PRIVACY_LEGAL_HOLD_REFERENCE_COLLISION", "Active legal-hold reference is bound to different encrypted evidence");
        }
        holdId = existing.rows[0]?.id;
      } else {
        await appendAudit(client, this.databaseLimits, {
          eventType: "legal_hold_created",
          aggregateType: "legal_hold",
          aggregateId: holdId,
          actorId,
          details: { scopeDataClass, caseReference }
        });
      }
      await client.query(
        `INSERT INTO privacy_legal_hold_subject_keys (hold_id,key_type,subject_hash)
         SELECT $1,subject_key.key_type,subject_key.subject_hash
         FROM jsonb_to_recordset($2::jsonb) AS subject_key(key_type text,subject_hash char(64))
         ON CONFLICT DO NOTHING`,
        [holdId, JSON.stringify(lookupKeys.map(({ keyType, subjectHash: hash }) => ({
          key_type: keyType,
          subject_hash: hash
        })))]
      );
      return Object.freeze({ holdId, replayed: !inserted.rowCount });
    });
  }

  async releaseLegalHold({ holdId, releaseReference, actorId }) {
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, LEGAL_HOLD_LOCK, this.databaseLimits);
      const result = await client.query(
        `UPDATE privacy_legal_holds SET status='released',released_by=$2,released_at=now(),release_reference=$3
         WHERE id=$1 AND status='active' RETURNING id,scope_data_class`,
        [holdId, actorId, releaseReference]
      );
      if (!result.rowCount) return Object.freeze({ released: false });
      await appendAudit(client, this.databaseLimits, {
        eventType: "legal_hold_released",
        aggregateType: "legal_hold",
        aggregateId: holdId,
        actorId,
        details: { scopeDataClass: result.rows[0].scope_data_class, releaseReference }
      });
      return Object.freeze({ released: true });
    });
  }

  async acquireExecutionLease({ planId, ownerId, leaseSeconds = 120 }) {
    assertInteger(leaseSeconds, 30, 300, "leaseSeconds");
    const result = await this.pool.query(
      `INSERT INTO privacy_execution_leases
        (lease_name,owner_id,fence_token,plan_id,locked_until,acquired_at,updated_at)
       VALUES ($1,$2,1,$3,now()+make_interval(secs => $4),now(),now())
       ON CONFLICT (lease_name) DO UPDATE SET
         owner_id=EXCLUDED.owner_id,
         fence_token=privacy_execution_leases.fence_token+1,
         plan_id=EXCLUDED.plan_id,
         locked_until=EXCLUDED.locked_until,
         acquired_at=now(),updated_at=now()
       WHERE privacy_execution_leases.locked_until IS NULL OR privacy_execution_leases.locked_until<=now()
       RETURNING owner_id,fence_token,plan_id,locked_until`,
      [EXECUTION_LEASE, ownerId, planId, leaseSeconds]
    );
    if (!result.rowCount) throw governanceError("PRIVACY_EXECUTION_ALREADY_RUNNING", "Another privacy execution lease is active", true);
    return Object.freeze({
      leaseName: EXECUTION_LEASE,
      ownerId: result.rows[0].owner_id,
      fenceToken: Number(result.rows[0].fence_token),
      planId: result.rows[0].plan_id,
      lockedUntil: result.rows[0].locked_until
    });
  }

  async beginExecution({ lease, expectedDigest, policyDigest, approvalId, changeId, recoveryId, actorId, leaseSeconds = 120 }) {
    const bindingDigest = canonicalDigest({ expectedDigest, policyDigest, approvalId, changeId, recoveryId });
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, LEGAL_HOLD_LOCK, this.databaseLimits);
      await assertLease(client, lease);
      await this.assertPrivacyIndexReady(client);
      const planResult = await client.query("SELECT * FROM privacy_governance_plans WHERE id=$1 FOR UPDATE", [lease.planId]);
      const plan = planResult.rows[0];
      if (!plan) throw governanceError("PRIVACY_PLAN_NOT_FOUND", "Privacy plan was not found");
      if (plan.canonical_digest !== expectedDigest || plan.policy_digest !== policyDigest) {
        throw governanceError("PRIVACY_PLAN_DIGEST_MISMATCH", "Plan or policy digest does not match the approved dry-run");
      }
      if (plan.target_contract_version !== INTEGRITY_VERSION || !plan.target_contract_digest) {
        throw governanceError("PRIVACY_PLAN_TARGET_CONTRACT_UNSUPPORTED", "Retention plan predates the immutable target contract and must be replanned");
      }
      const targetItems = await client.query(
        `SELECT ordinal,data_class,table_name,record_key,observed_digest,observed_digest_version,cutoff_at,action
         FROM privacy_governance_plan_items WHERE plan_id=$1 ORDER BY ordinal`,
        [plan.id]
      );
      if (targetItems.rows.some((item) => item.observed_digest_version !== INTEGRITY_VERSION)) {
        throw governanceError("PRIVACY_PLAN_TARGET_CONTRACT_UNSUPPORTED", "Retention plan item has an unsupported integrity version");
      }
      const actualTargetContract = this.cryptoBox.integrityHash(
        canonicalJson(targetItems.rows.map(planTargetContractItem))
      );
      if (actualTargetContract !== plan.target_contract_digest) {
        throw governanceError("PRIVACY_PLAN_TARGET_CONTRACT_MISMATCH", "Retention plan items differ from the approved immutable target contract");
      }
      if (plan.execution_binding_digest && plan.execution_binding_digest !== bindingDigest) {
        throw governanceError("PRIVACY_EXECUTION_BINDING_MISMATCH", "Execution identifiers differ from the existing digest-bound approval");
      }
      if (plan.status === "completed") {
        await releaseLease(client, lease);
        return Object.freeze({ completed: true, bindingDigest });
      }
      await client.query(
        `UPDATE privacy_governance_plans SET status='running',approval_id=$2,change_id=$3,recovery_id=$4,
           execution_binding_digest=$5,started_at=COALESCE(started_at,now()),updated_at=now(),last_error_code=NULL
         WHERE id=$1`,
        [plan.id, approvalId, changeId, recoveryId, bindingDigest]
      );
      await renewLease(client, lease, leaseSeconds);
      await appendAudit(client, this.databaseLimits, {
        eventType: "retention_execution_started",
        aggregateType: "privacy_plan",
        aggregateId: plan.id,
        actorId,
        planDigest: expectedDigest,
        approvalId,
        changeId,
        recoveryId,
        details: { executionBindingDigest: bindingDigest }
      });
      return Object.freeze({ completed: false, blocked: false, bindingDigest });
    });
  }

  async executeBatch({ lease, batchSize, actorId, leaseSeconds = 120 }) {
    assertInteger(batchSize, 1, 500, "batchSize");
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, LEGAL_HOLD_LOCK, this.databaseLimits);
      await assertLease(client, lease);
      const planResult = await client.query("SELECT * FROM privacy_governance_plans WHERE id=$1 FOR UPDATE", [lease.planId]);
      const plan = planResult.rows[0];
      if (!plan || plan.status !== "running") throw governanceError("PRIVACY_PLAN_NOT_RUNNING", "Privacy plan is not in an executable state");
      const items = await client.query(
        `SELECT * FROM privacy_governance_plan_items
         WHERE plan_id=$1 AND status='planned'
         ORDER BY ordinal FOR UPDATE SKIP LOCKED LIMIT $2`,
        [plan.id, batchSize]
      );
      if (!items.rowCount) {
        await client.query(
          "UPDATE privacy_governance_plans SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1",
          [plan.id]
        );
        await releaseLease(client, lease);
        await appendAudit(client, this.databaseLimits, {
          eventType: "retention_execution_completed",
          aggregateType: "privacy_plan",
          aggregateId: plan.id,
          actorId,
          planDigest: plan.canonical_digest,
          approvalId: plan.approval_id,
          changeId: plan.change_id,
          recoveryId: plan.recovery_id,
          details: { completed: true }
        });
        return Object.freeze({ processed: 0, remaining: 0, completed: true });
      }
      const activeHolds = await this.activeLegalHolds(client);
      for (const item of items.rows) {
        const target = targetFor(item.table_name, item.data_class);
        if (item.observed_digest_version !== INTEGRITY_VERSION || item.action !== target.action) {
          throw governanceError("PRIVACY_PLAN_TARGET_CONTRACT_MISMATCH", "Retention plan action or integrity version is outside the compiled target contract");
        }
        const current = await client.query(target.loadSql, [item.record_key]);
        const row = current.rows[0];
        if (!row || target.digest(row, this.cryptoBox) !== item.observed_digest || row.privacy_tombstoned_at) {
          throw governanceError("PRIVACY_PLAN_DRIFT", "A planned record changed after the approved dry-run");
        }
        const subjectKeys = await durableRecordSubjectKeys(client, item, this.cryptoBox);
        if (recordMatchesLegalHold(activeHolds, item.data_class, subjectKeys)) {
          throw governanceError("PRIVACY_LEGAL_HOLD_ACTIVE", "A matching legal hold became active after planning", true);
        }
        await target.tombstone({ client, row, planId: plan.id, cryptoBox: this.cryptoBox });
        await client.query(
          `UPDATE privacy_governance_plan_items SET status='completed',completed_at=now()
           WHERE plan_id=$1 AND ordinal=$2 AND status='planned'`,
          [plan.id, item.ordinal]
        );
      }
      await renewLease(client, lease, leaseSeconds);
      const remaining = await client.query(
        `SELECT ordinal FROM privacy_governance_plan_items
         WHERE plan_id=$1 AND status='planned' ORDER BY ordinal LIMIT 1`,
        [plan.id]
      );
      const remainingCount = remaining.rowCount;
      await appendAudit(client, this.databaseLimits, {
        eventType: "retention_batch_completed",
        aggregateType: "privacy_plan",
        aggregateId: plan.id,
        actorId,
        planDigest: plan.canonical_digest,
        approvalId: plan.approval_id,
        changeId: plan.change_id,
        recoveryId: plan.recovery_id,
        details: { processed: items.rowCount, hasRemaining: remainingCount > 0 }
      });
      if (remainingCount === 0) {
        await client.query(
          "UPDATE privacy_governance_plans SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1",
          [plan.id]
        );
        await releaseLease(client, lease);
        await appendAudit(client, this.databaseLimits, {
          eventType: "retention_execution_completed",
          aggregateType: "privacy_plan",
          aggregateId: plan.id,
          actorId,
          planDigest: plan.canonical_digest,
          approvalId: plan.approval_id,
          changeId: plan.change_id,
          recoveryId: plan.recovery_id,
          details: { completed: true }
        });
      }
      return Object.freeze({ processed: items.rowCount, remaining: remainingCount, completed: remainingCount === 0 });
    });
  }

  async markExecutionFailed({ lease, errorCode, actorId }) {
    return withTransaction(this.pool, async (client) => {
      await assertLease(client, lease);
      const plan = await client.query("SELECT * FROM privacy_governance_plans WHERE id=$1 FOR UPDATE", [lease.planId]);
      if (!plan.rowCount || plan.rows[0].status === "completed") {
        await releaseLease(client, lease);
        return false;
      }
      const blocked = errorCode === "PRIVACY_LEGAL_HOLD_ACTIVE";
      await client.query(
        "UPDATE privacy_governance_plans SET status=$2,last_error_code=$3,updated_at=now() WHERE id=$1",
        [lease.planId, blocked ? "blocked" : "failed", errorCode]
      );
      await releaseLease(client, lease);
      await appendAudit(client, this.databaseLimits, {
        eventType: blocked ? "retention_execution_blocked" : "retention_execution_failed",
        aggregateType: "privacy_plan",
        aggregateId: lease.planId,
        actorId,
        planDigest: plan.rows[0].canonical_digest,
        approvalId: plan.rows[0].approval_id,
        changeId: plan.rows[0].change_id,
        recoveryId: plan.rows[0].recovery_id,
        details: { errorCode }
      });
      return true;
    });
  }

  async relinquishExecutionLease(lease) {
    return withTransaction(this.pool, async (client) => {
      await assertLease(client, lease);
      await releaseLease(client, lease);
      return true;
    });
  }

  async getPlan(planId) {
    const result = await this.pool.query("SELECT * FROM privacy_governance_plans WHERE id=$1", [planId]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async listAuditEvents(aggregateId) {
    const result = await this.pool.query(
      `SELECT sequence_id,event_type,aggregate_type,aggregate_id,actor_id,plan_digest,details,previous_hash,event_hash,created_at
       FROM privacy_audit_events WHERE aggregate_id=$1 ORDER BY sequence_id`,
      [aggregateId]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async createDsarRequest({
    requestId,
    requestType,
    subjectType,
    subjectHash,
    subjectKeys,
    requestReference,
    payload,
    actorId
  }) {
    const lookupKeys = normalizeSubjectLookupKeys(subjectHash, subjectKeys);
    const requestDigest = this.cryptoBox.integrityHash(`dsar-request:${canonicalJson(payload)}`);
    const encrypted = this.cryptoBox.encryptJson(payload, `privacy-dsar-request:${requestId}`);
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO privacy_dsar_requests
          (id,request_type,subject_type,subject_hash,request_reference,request_digest,payload_ciphertext,payload_iv,
           payload_tag,key_version,requested_by,integrity_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (request_reference) DO NOTHING RETURNING id`,
        [requestId, requestType, subjectType, subjectHash, requestReference, requestDigest, encrypted.ciphertext,
          encrypted.iv, encrypted.tag, encrypted.keyVersion, actorId, INTEGRITY_VERSION]
      );
      if (!inserted.rowCount) {
        const existing = await client.query(
          `SELECT id,request_type,subject_type,subject_hash,request_digest FROM privacy_dsar_requests
           WHERE request_reference=$1`,
          [requestReference]
        );
        const row = existing.rows[0];
        if (!row || row.request_type !== requestType || row.subject_type !== subjectType
          || row.subject_hash !== subjectHash || row.request_digest !== requestDigest) {
          throw governanceError("PRIVACY_DSAR_REFERENCE_COLLISION", "DSAR request reference is already bound to different immutable facts");
        }
        await insertDsarSubjectKeys(client, row.id, lookupKeys, "request_subject");
        return Object.freeze({ requestId: row.id, replayed: true });
      }
      await insertDsarSubjectKeys(client, requestId, lookupKeys, "request_subject");
      await appendAudit(client, this.databaseLimits, {
        eventType: "dsar_request_created",
        aggregateType: "dsar_request",
        aggregateId: requestId,
        actorId,
        details: { requestType, requestReference }
      });
      return Object.freeze({ requestId, replayed: false });
    });
  }

  async planDsarRequest({ requestId, actorId, maximumRecords = 5_000 }) {
    assertInteger(maximumRecords, 1, 10_000, "maximumRecords");
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, LEGAL_HOLD_LOCK, this.databaseLimits);
      const requestResult = await client.query("SELECT * FROM privacy_dsar_requests WHERE id=$1 FOR UPDATE", [requestId]);
      const request = requestResult.rows[0];
      if (!request) throw governanceError("PRIVACY_DSAR_NOT_FOUND", "DSAR request was not found");
      const artifactType = dsarArtifactType(request.request_type);
      const existing = await client.query(
        `SELECT id,artifact_digest,counts FROM privacy_dsar_artifacts
         WHERE request_id=$1 AND artifact_type=$2 ORDER BY created_at DESC LIMIT 1`,
        [requestId, artifactType]
      );
      if (existing.rowCount) {
        const espoMutationPlans = await listEspoMutationPlanManifest(client, requestId);
        return Object.freeze({
          requestId,
          artifactId: existing.rows[0].id,
          digest: existing.rows[0].artifact_digest,
          counts: Object.freeze(existing.rows[0].counts),
          espoMutationPlans,
          status: request.status,
          replayed: true
        });
      }
      const requestPayload = this.cryptoBox.decryptJson({
        ciphertext: request.payload_ciphertext,
        iv: request.payload_iv,
        tag: request.payload_tag,
        keyVersion: request.key_version
      }, `privacy-dsar-request:${request.id}`);
      const expectedRequestDigest = integrityDigestForVersion(
        this.cryptoBox,
        request.integrity_version,
        `dsar-request:${canonicalJson(requestPayload)}`
      );
      if (expectedRequestDigest !== request.request_digest) {
        throw governanceError("PRIVACY_DSAR_REQUEST_INTEGRITY_FAILED", "Encrypted DSAR request failed its versioned integrity contract");
      }
      const snapshot = await buildDsarSnapshot(client, this.cryptoBox, {
        subjectType: request.subject_type,
        subjectValue: requestPayload.subject.value,
        subjectHash: request.subject_hash,
        maximumRecords
      });
      const relatedSubjectKeys = new Map();
      const addRelatedKey = (keyType, subjectHash) => {
        if (/^[0-9a-f]{64}$/u.test(String(subjectHash ?? ""))) {
          relatedSubjectKeys.set(`${keyType}:${subjectHash}`, Object.freeze({ keyType, subjectHash }));
        }
      };
      const requestKeys = await client.query(
        "SELECT key_type,subject_hash FROM privacy_dsar_subject_keys WHERE request_id=$1",
        [request.id]
      );
      for (const key of requestKeys.rows) addRelatedKey(key.key_type, key.subject_hash);
      if (request.subject_type === "email") {
        const normalizedEmail = String(requestPayload.subject.value).trim().toLowerCase();
        addRelatedKey("email_validation", this.cryptoBox.subjectHash(normalizedEmail));
        addRelatedKey("source_identity", this.cryptoBox.subjectHash(`source-identity:email:${normalizedEmail}`));
      }
      for (const records of [
        snapshot.records.sendQueue,
        snapshot.records.responseQueue,
        snapshot.records.sequenceAllocations,
        snapshot.records.humanReviews,
        snapshot.records.crmDeliveryProjections,
        snapshot.records.sourceIdentityBindings
      ]) {
        for (const record of records) {
          if (record.contact_id) addRelatedKey("canonical", this.cryptoBox.subjectHash(`contact:${record.contact_id}`));
          if (record.outlet_id) addRelatedKey("canonical", this.cryptoBox.subjectHash(`outlet:${record.outlet_id}`));
        }
      }
      await insertDsarSubjectKeys(client, request.id, [...relatedSubjectKeys.values()], "derived_record");
      const activeHolds = await client.query(
        `SELECT DISTINCT hold.scope_data_class,hold.case_reference FROM privacy_legal_holds hold
         WHERE hold.status='active' AND (hold.subject_type='global' OR EXISTS (
           SELECT 1 FROM privacy_legal_hold_subject_keys hold_key
           JOIN privacy_dsar_subject_keys request_key
             ON request_key.request_id=$1 AND request_key.key_type=hold_key.key_type
            AND request_key.subject_hash=hold_key.subject_hash
           WHERE hold_key.hold_id=hold.id
         ))
         ORDER BY hold.scope_data_class,hold.case_reference`,
        [request.id]
      );
      const blocked = request.request_type === "erasure" && activeHolds.rowCount > 0;
      const subjectGraph = dsarSubjectGraph(requestPayload.subject, snapshot, this.cryptoBox);
      await persistDsarSubjectGraph(client, request.id, subjectGraph);
      const subjectGraphDigest = this.cryptoBox.integrityHash(canonicalJson(subjectGraph.map(subjectGraphDigestItem)));
      assertEspoMutationsBelongToSubjectGraph(requestPayload.espoMutations ?? [], subjectGraph, this.cryptoBox);
      const artifactPayload = Object.freeze({
        schemaVersion: 2,
        requestId: request.id,
        requestType: request.request_type,
        requestReference: request.request_reference,
        subject: requestPayload.subject,
        evidence: requestPayload.evidence,
        requestedCorrection: requestPayload.requestedCorrection,
        generatedAt: new Date().toISOString(),
        blockedByLegalHold: blocked,
        legalHolds: activeHolds.rows.map((row) => ({
          scopeDataClass: row.scope_data_class,
          caseReference: row.case_reference
        })),
        suppressionTreatment: "preserve_hashed_deny_wins_evidence",
        subjectGraphDigest,
        snapshot
      });
      const digest = this.cryptoBox.integrityHash(`dsar-artifact:${canonicalJson(artifactPayload)}`);
      const encrypted = this.cryptoBox.encryptJson(
        artifactPayload,
        `privacy-dsar-artifact:${request.id}:${artifactType}:${digest}`
      );
      const artifact = await client.query(
        `INSERT INTO privacy_dsar_artifacts
          (request_id,artifact_type,artifact_digest,counts,payload_ciphertext,payload_iv,payload_tag,key_version,created_by,integrity_version)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [request.id, artifactType, digest, JSON.stringify(snapshot.counts), encrypted.ciphertext,
          encrypted.iv, encrypted.tag, encrypted.keyVersion, actorId, INTEGRITY_VERSION]
      );
      for (const mutation of blocked ? [] : (requestPayload.espoMutations ?? [])) {
        const planId = randomUUID();
        const entityIdHash = this.cryptoBox.integrityHash(`espocrm:${mutation.entityType}:${mutation.entityId}`);
        const planPayload = Object.freeze({
          schemaVersion: 1,
          requestId: request.id,
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          expectedVersion: mutation.expectedVersion,
          mutationType: mutation.mutationType,
          patch: mutation.patch,
          subjectGraphDigest
        });
        const planDigest = this.cryptoBox.integrityHash(`espo-plan:${canonicalJson(planPayload)}`);
        const planEncrypted = this.cryptoBox.encryptJson(planPayload, `privacy-espo-plan:${planId}`);
        await client.query(
          `INSERT INTO privacy_espo_mutation_plans
            (id,request_id,entity_type,entity_id_hash,expected_version,mutation_type,plan_digest,
             payload_ciphertext,payload_iv,payload_tag,key_version,integrity_version,subject_graph_digest)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (request_id,entity_type,entity_id_hash,mutation_type,plan_digest) DO NOTHING`,
          [planId, request.id, mutation.entityType, entityIdHash, mutation.expectedVersion,
            mutation.mutationType, planDigest, planEncrypted.ciphertext, planEncrypted.iv,
            planEncrypted.tag, planEncrypted.keyVersion, INTEGRITY_VERSION, subjectGraphDigest]
        );
      }
      const espoMutationPlans = await listEspoMutationPlanManifest(client, request.id);
      await client.query(
        "UPDATE privacy_dsar_requests SET status=$2,updated_at=now() WHERE id=$1",
        [request.id, blocked ? "blocked" : "planned"]
      );
      await appendAudit(client, this.databaseLimits, {
        eventType: blocked ? "dsar_plan_blocked" : "dsar_plan_created",
        aggregateType: "dsar_request",
        aggregateId: request.id,
        actorId,
        details: {
          requestType: request.request_type,
          artifactType,
          artifactDigest: digest,
          counts: snapshot.counts,
          blockedByLegalHold: blocked,
          espoMutationPlanCount: espoMutationPlans.length
        }
      });
      return Object.freeze({
        requestId,
        artifactId: artifact.rows[0].id,
        digest,
        counts: Object.freeze(snapshot.counts),
        espoMutationPlans,
        status: blocked ? "blocked" : "planned",
        replayed: false
      });
    });
  }

  async closeDsarRequest({ requestId, closureReference, actorId }) {
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, LEGAL_HOLD_LOCK, this.databaseLimits);
      const request = await client.query(
        `UPDATE privacy_dsar_requests SET status='closed',closed_at=now(),closed_by=$2,closure_reference=$3,updated_at=now()
         WHERE id=$1 AND status IN ('open','planned','blocked') RETURNING id,request_type`,
        [requestId, actorId, closureReference]
      );
      if (!request.rowCount) return Object.freeze({ closed: false });
      await client.query(
        "UPDATE privacy_espo_mutation_plans SET status='cancelled' WHERE request_id=$1 AND status='planned'",
        [requestId]
      );
      await appendAudit(client, this.databaseLimits, {
        eventType: "dsar_request_closed",
        aggregateType: "dsar_request",
        aggregateId: requestId,
        actorId,
        details: { closureReference, requestType: request.rows[0].request_type }
      });
      return Object.freeze({ closed: true });
    });
  }

  async readDsarArtifact({ requestId, artifactId }) {
    const exported = await readVerifiedDsarArtifact(this.pool, this.cryptoBox, { requestId, artifactId });
    return exported?.payload;
  }

  async exportDsarArtifact({ requestId, artifactId, actorId }) {
    const exported = await readVerifiedDsarArtifact(this.pool, this.cryptoBox, { requestId, artifactId });
    if (!exported) return undefined;
    await withTransaction(this.pool, async (client) => appendAudit(client, this.databaseLimits, {
      eventType: "dsar_artifact_exported",
      aggregateType: "dsar_request",
      aggregateId: requestId,
      actorId,
      details: { artifactId, artifactType: exported.manifest.artifactType, artifactDigest: exported.manifest.digest }
    }));
    return exported;
  }

  async readEspoMutationPlan(planId) {
    const exported = await readVerifiedEspoMutationPlan(this.pool, this.cryptoBox, planId);
    return exported?.payload;
  }

  async exportEspoMutationPlan({ planId, actorId }) {
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, LEGAL_HOLD_LOCK, this.databaseLimits);
      const exported = await readVerifiedEspoMutationPlan(client, this.cryptoBox, planId);
      if (!exported) return undefined;
      if (exported.manifest.status !== "planned") {
        throw governanceError("PRIVACY_ESPO_PLAN_NOT_EXPORTABLE", "Espo mutation plan is not in an exportable state");
      }
      const requestState = await client.query("SELECT status FROM privacy_dsar_requests WHERE id=$1 FOR SHARE", [exported.manifest.requestId]);
      if (requestState.rows[0]?.status !== "planned") {
        throw governanceError("PRIVACY_ESPO_PLAN_NOT_EXPORTABLE", "Espo mutation plan request is not in an exportable state");
      }
      if (exported.manifest.mutationType === "erasure_anonymization") {
        const holds = await client.query(
          `SELECT 1 FROM privacy_legal_holds hold
           WHERE hold.status='active' AND (hold.subject_type='global' OR EXISTS (
             SELECT 1 FROM privacy_legal_hold_subject_keys hold_key
             JOIN privacy_dsar_subject_keys request_key
               ON request_key.request_id=$1 AND request_key.key_type=hold_key.key_type
              AND request_key.subject_hash=hold_key.subject_hash
             WHERE hold_key.hold_id=hold.id
           )) LIMIT 1`,
          [exported.manifest.requestId]
        );
        if (holds.rowCount) {
          throw governanceError("PRIVACY_LEGAL_HOLD_ACTIVE", "Espo erasure plan export is fenced by an active legal hold", true);
        }
      }
      await appendAudit(client, this.databaseLimits, {
        eventType: "espo_mutation_plan_exported",
        aggregateType: "espo_mutation_plan",
        aggregateId: planId,
        actorId,
        details: { planDigest: exported.manifest.digest, requestId: exported.manifest.requestId }
      });
      return exported;
    });
  }
}

const PRIVACY_INDEX_DEFINITIONS = Object.freeze([
  privacyIndex({
    name: "sequence_allocations_privacy_record_idx",
    tableName: "sequence_allocations",
    unique: true,
    columns: ["privacy_record_id"],
    predicate: "privacy_record_id IS NOT NULL"
  }),
  privacyIndex({ name: "sequence_allocations_privacy_null_idx", tableName: "sequence_allocations", columns: ["recipient_hash"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "source_ingestion_links_privacy_null_idx", tableName: "source_ingestion_record_links", columns: ["source_id", "external_id", "entity_type"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "email_validation_cache_privacy_null_idx", tableName: "email_validation_cache", columns: ["recipient_hash"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "source_identity_bindings_privacy_null_idx", tableName: "source_identity_bindings", columns: ["entity_type", "identity_type", "identity_hash"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "source_identity_claim_items_privacy_null_idx", tableName: "source_identity_claim_items", columns: ["claim_id", "entity_type", "identity_type", "identity_hash"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "send_counters_privacy_record_idx", tableName: "send_counters", unique: true, columns: ["privacy_record_id"], predicate: "privacy_record_id IS NOT NULL" }),
  privacyIndex({ name: "send_counters_privacy_null_idx", tableName: "send_counters", columns: ["counter_date", "counter_type", "subject_hash"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "send_capacity_privacy_record_idx", tableName: "send_capacity_reservations", unique: true, columns: ["privacy_record_id"], predicate: "privacy_record_id IS NOT NULL" }),
  privacyIndex({ name: "send_capacity_privacy_null_idx", tableName: "send_capacity_reservations", columns: ["send_queue_id", "counter_date"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "outlet_guard_privacy_record_idx", tableName: "outlet_first_send_guards", unique: true, columns: ["privacy_record_id"], predicate: "privacy_record_id IS NOT NULL" }),
  privacyIndex({ name: "outlet_guard_privacy_null_idx", tableName: "outlet_first_send_guards", columns: ["outlet_hash"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "source_receipt_privacy_record_idx", tableName: "source_ingestion_receipts", unique: true, columns: ["privacy_record_id"], predicate: "privacy_record_id IS NOT NULL" }),
  privacyIndex({ name: "source_receipt_privacy_null_idx", tableName: "source_ingestion_receipts", columns: ["source_id", "artifact_id"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "genre_denial_privacy_record_idx", tableName: "contact_genre_denials", unique: true, columns: ["privacy_record_id"], predicate: "privacy_record_id IS NOT NULL" }),
  privacyIndex({ name: "genre_denial_privacy_null_idx", tableName: "contact_genre_denials", columns: ["contact_id", "genre"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "campaign_outlet_counters_privacy_record_idx", tableName: "campaign_outlet_allocation_counters", unique: true, columns: ["privacy_record_id"] }),
  privacyIndex({ name: "campaign_outlet_counters_privacy_candidate_idx", tableName: "campaign_outlet_allocation_counters", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "campaign_outlet_ledger_privacy_record_idx", tableName: "campaign_outlet_allocation_ledger", unique: true, columns: ["privacy_record_id"] }),
  privacyIndex({ name: "campaign_outlet_ledger_privacy_candidate_idx", tableName: "campaign_outlet_allocation_ledger", columns: ["allocated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "campaign_outlet_ledger_privacy_contact_idx", tableName: "campaign_outlet_allocation_ledger", columns: ["contact_hash", "allocated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "campaign_outlet_ledger_privacy_recipient_idx", tableName: "campaign_outlet_allocation_ledger", columns: ["recipient_hash", "allocated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "crm_intake_receipts_privacy_record_idx", tableName: "crm_intake_receipts", unique: true, columns: ["privacy_record_id"], predicate: "privacy_record_id IS NOT NULL" }),
  privacyIndex({ name: "crm_intake_receipts_privacy_null_idx", tableName: "crm_intake_receipts", columns: ["entity_type", "entity_id", "revision_digest"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "crm_intake_receipts_privacy_candidate_idx", tableName: "crm_intake_receipts", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "crm_intake_receipts_privacy_entity_idx", tableName: "crm_intake_receipts", columns: ["entity_type", "entity_id", "updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "purpose_bound_evidence_privacy_record_idx", tableName: "purpose_bound_evidence_attestations", unique: true, columns: ["privacy_record_id"], predicate: "privacy_record_id IS NOT NULL" }),
  privacyIndex({ name: "purpose_bound_evidence_privacy_null_idx", tableName: "purpose_bound_evidence_attestations", columns: ["entity_type", "entity_id"], predicate: "privacy_record_id IS NULL" }),
  privacyIndex({ name: "purpose_bound_evidence_privacy_candidate_idx", tableName: "purpose_bound_evidence_attestations", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "purpose_bound_evidence_privacy_entity_idx", tableName: "purpose_bound_evidence_attestations", columns: ["entity_type", "entity_id", "updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({
    name: "source_ingestion_links_privacy_record_idx",
    tableName: "source_ingestion_record_links",
    unique: true,
    columns: ["privacy_record_id"],
    predicate: "privacy_record_id IS NOT NULL"
  }),
  privacyIndex({
    name: "email_validation_cache_privacy_record_idx",
    tableName: "email_validation_cache",
    unique: true,
    columns: ["privacy_record_id"],
    predicate: "privacy_record_id IS NOT NULL"
  }),
  privacyIndex({
    name: "source_identity_bindings_privacy_record_idx",
    tableName: "source_identity_bindings",
    unique: true,
    columns: ["privacy_record_id"],
    predicate: "privacy_record_id IS NOT NULL"
  }),
  privacyIndex({
    name: "source_identity_claim_items_privacy_record_idx",
    tableName: "source_identity_claim_items",
    unique: true,
    columns: ["privacy_record_id"],
    predicate: "privacy_record_id IS NOT NULL"
  }),
  privacyIndex({ name: "privacy_event_candidate_idx", tableName: "encrypted_event_inbox", columns: ["created_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_copy_candidate_idx", tableName: "copy_artifacts", columns: ["created_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_response_candidate_idx", tableName: "response_queue", columns: ["created_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_review_candidate_idx", tableName: "human_review_items", columns: ["updated_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_work_candidate_idx", tableName: "work_items", columns: ["created_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_send_candidate_idx", tableName: "send_queue", columns: ["created_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_allocation_candidate_idx", tableName: "sequence_allocations", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_delivery_candidate_idx", tableName: "delivery_attempts", columns: ["started_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_response_delivery_candidate_idx", tableName: "response_delivery_attempts", columns: ["started_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_outcome_candidate_idx", tableName: "outcome_events", columns: ["occurred_at", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_source_link_candidate_idx", tableName: "source_ingestion_record_links", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_email_validation_candidate_idx", tableName: "email_validation_cache", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_source_identity_binding_candidate_idx", tableName: "source_identity_bindings", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_source_identity_claim_candidate_idx", tableName: "source_identity_claims", columns: ["locked_until", "id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "privacy_source_identity_item_candidate_idx", tableName: "source_identity_claim_items", columns: ["claim_id", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "crm_delivery_projections_privacy_candidate_idx", tableName: "crm_delivery_projections", columns: ["created_at", "send_queue_id"], predicate: "privacy_tombstoned_at IS NULL" }),
  privacyIndex({ name: "contact_genre_denials_privacy_candidate_idx", tableName: "contact_genre_denials", columns: ["created_at", "contact_id", "genre"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "send_counters_privacy_candidate_idx", tableName: "send_counters", columns: ["counter_date", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "send_capacity_privacy_candidate_idx", tableName: "send_capacity_reservations", columns: ["finalized_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "outlet_guard_privacy_candidate_idx", tableName: "outlet_first_send_guards", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "source_receipt_privacy_candidate_idx", tableName: "source_ingestion_receipts", columns: ["updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "privacy_dsar_event_entity_idx", tableName: "encrypted_event_inbox", columns: ["entity_id", "created_at", "id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "privacy_dsar_review_contact_idx", tableName: "human_review_items", columns: ["contact_id", "created_at", "id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "privacy_dsar_source_link_crm_idx", tableName: "source_ingestion_record_links", columns: ["crm_entity_id", "updated_at", "privacy_record_id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "privacy_dsar_crm_contact_idx", tableName: "crm_delivery_projections", columns: ["contact_id", "created_at", "send_queue_id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "privacy_legal_hold_lifecycle_idx", tableName: "privacy_legal_holds", columns: ["released_at", "id"], predicate: "status='released' AND privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "privacy_dsar_request_lifecycle_idx", tableName: "privacy_dsar_requests", columns: ["closed_at", "id"], predicate: "status='closed' AND privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "privacy_dsar_artifact_lifecycle_idx", tableName: "privacy_dsar_artifacts", columns: ["created_at", "id"], predicate: "privacy_tombstoned_at IS NULL" })
  ,privacyIndex({ name: "privacy_espo_plan_lifecycle_idx", tableName: "privacy_espo_mutation_plans", columns: ["created_at", "id"], predicate: "status='cancelled' AND privacy_tombstoned_at IS NULL" })
]);

const PRIVACY_CONSTRAINT_DEFINITIONS = Object.freeze([
  privacyConstraint("encrypted_event_inbox", "encrypted_event_inbox_privacy_plan_fk"),
  privacyConstraint("copy_artifacts", "copy_artifacts_privacy_plan_fk"),
  privacyConstraint("response_queue", "response_queue_privacy_plan_fk"),
  privacyConstraint("human_review_items", "human_review_items_privacy_plan_fk"),
  privacyConstraint("work_items", "work_items_privacy_plan_fk"),
  privacyConstraint("send_queue", "send_queue_privacy_plan_fk"),
  privacyConstraint("sequence_allocations", "sequence_allocations_privacy_plan_fk"),
  privacyConstraint("delivery_attempts", "delivery_attempts_privacy_plan_fk"),
  privacyConstraint("response_delivery_attempts", "response_delivery_attempts_privacy_plan_fk"),
  privacyConstraint("outcome_events", "outcome_events_privacy_plan_fk"),
  privacyConstraint("source_ingestion_record_links", "source_ingestion_record_links_privacy_plan_fk"),
  privacyConstraint("email_validation_cache", "email_validation_cache_privacy_plan_fk"),
  privacyConstraint("source_identity_bindings", "source_identity_bindings_privacy_plan_fk"),
  privacyConstraint("source_identity_claims", "source_identity_claims_privacy_plan_fk"),
  privacyConstraint("source_identity_claim_items", "source_identity_claim_items_privacy_plan_fk"),
  privacyConstraint("crm_delivery_projections", "crm_delivery_projections_privacy_plan_fk"),
  privacyConstraint("contact_genre_denials", "contact_genre_denials_privacy_plan_fk")
  ,privacyConstraint("send_counters", "send_counters_privacy_plan_fk")
  ,privacyConstraint("send_capacity_reservations", "send_capacity_reservations_privacy_plan_fk")
  ,privacyConstraint("outlet_first_send_guards", "outlet_first_send_guards_privacy_plan_fk")
  ,privacyConstraint("source_ingestion_receipts", "source_ingestion_receipts_privacy_plan_fk")
  ,privacyConstraint("campaign_outlet_allocation_counters", "campaign_outlet_counters_privacy_plan_fk")
  ,privacyConstraint("campaign_outlet_allocation_ledger", "campaign_outlet_ledger_privacy_plan_fk")
  ,privacyConstraint("crm_intake_receipts", "crm_intake_receipts_privacy_plan_fk")
  ,privacyConstraint("purpose_bound_evidence_attestations", "purpose_bound_evidence_privacy_plan_fk")
  ,privacyConstraint("privacy_legal_holds", "privacy_legal_holds_privacy_plan_fk")
  ,privacyConstraint("privacy_dsar_requests", "privacy_dsar_requests_privacy_plan_fk")
  ,privacyConstraint("privacy_dsar_artifacts", "privacy_dsar_artifacts_privacy_plan_fk")
  ,privacyConstraint("privacy_espo_mutation_plans", "privacy_espo_mutation_plans_privacy_plan_fk")
]);

const PRIVACY_RECORD_ID_CONTRACTS = Object.freeze([
  privacyRecordIdContract("sequence_allocations", "sequence_allocations_privacy_record_not_null"),
  privacyRecordIdContract("source_ingestion_record_links", "source_ingestion_record_links_privacy_record_not_null"),
  privacyRecordIdContract("email_validation_cache", "email_validation_cache_privacy_record_not_null"),
  privacyRecordIdContract("source_identity_bindings", "source_identity_bindings_privacy_record_not_null"),
  privacyRecordIdContract("source_identity_claim_items", "source_identity_claim_items_privacy_record_not_null")
  ,privacyRecordIdContract("send_counters", "send_counters_privacy_record_not_null")
  ,privacyRecordIdContract("send_capacity_reservations", "send_capacity_reservations_privacy_record_not_null")
  ,privacyRecordIdContract("outlet_first_send_guards", "outlet_first_send_guards_privacy_record_not_null")
  ,privacyRecordIdContract("source_ingestion_receipts", "source_ingestion_receipts_privacy_record_not_null")
  ,privacyRecordIdContract("contact_genre_denials", "contact_genre_denials_privacy_record_not_null")
  ,privacyRecordIdContract("campaign_outlet_allocation_counters", "campaign_outlet_counters_privacy_record_not_null")
  ,privacyRecordIdContract("campaign_outlet_allocation_ledger", "campaign_outlet_ledger_privacy_record_not_null")
  ,privacyRecordIdContract("crm_intake_receipts", "crm_intake_receipts_privacy_record_not_null")
  ,privacyRecordIdContract("purpose_bound_evidence_attestations", "purpose_bound_evidence_privacy_record_not_null")
]);

const PRIVACY_INDEX_TARGETS = Object.freeze([
  Object.freeze({
    tableName: "sequence_allocations",
    updateSql: `WITH picked AS (
      SELECT recipient_hash FROM sequence_allocations WHERE privacy_record_id IS NULL
      ORDER BY recipient_hash FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE sequence_allocations target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.recipient_hash=picked.recipient_hash AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "source_ingestion_record_links",
    updateSql: `WITH picked AS (
      SELECT source_id,external_id,entity_type FROM source_ingestion_record_links WHERE privacy_record_id IS NULL
      ORDER BY source_id,external_id,entity_type FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE source_ingestion_record_links target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.source_id=picked.source_id AND target.external_id=picked.external_id
      AND target.entity_type=picked.entity_type AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "email_validation_cache",
    updateSql: `WITH picked AS (
      SELECT recipient_hash FROM email_validation_cache WHERE privacy_record_id IS NULL
      ORDER BY recipient_hash FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE email_validation_cache target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.recipient_hash=picked.recipient_hash AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "source_identity_bindings",
    updateSql: `WITH picked AS (
      SELECT entity_type,identity_type,identity_hash FROM source_identity_bindings WHERE privacy_record_id IS NULL
      ORDER BY entity_type,identity_type,identity_hash FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE source_identity_bindings target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.entity_type=picked.entity_type AND target.identity_type=picked.identity_type
      AND target.identity_hash=picked.identity_hash AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "source_identity_claim_items",
    updateSql: `WITH picked AS (
      SELECT claim_id,entity_type,identity_type,identity_hash FROM source_identity_claim_items WHERE privacy_record_id IS NULL
      ORDER BY claim_id,entity_type,identity_type,identity_hash FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE source_identity_claim_items target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.claim_id=picked.claim_id AND target.entity_type=picked.entity_type
      AND target.identity_type=picked.identity_type AND target.identity_hash=picked.identity_hash
      AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "send_counters",
    updateSql: `WITH picked AS (
      SELECT counter_date,counter_type,subject_hash FROM send_counters WHERE privacy_record_id IS NULL
      ORDER BY counter_date,counter_type,subject_hash FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE send_counters target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.counter_date=picked.counter_date AND target.counter_type=picked.counter_type
      AND target.subject_hash=picked.subject_hash AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "send_capacity_reservations",
    updateSql: `WITH picked AS (
      SELECT send_queue_id,counter_date FROM send_capacity_reservations WHERE privacy_record_id IS NULL
      ORDER BY send_queue_id,counter_date FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE send_capacity_reservations target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.send_queue_id=picked.send_queue_id AND target.counter_date=picked.counter_date
      AND target.privacy_record_id IS NULL RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "outlet_first_send_guards",
    updateSql: `WITH picked AS (
      SELECT outlet_hash FROM outlet_first_send_guards WHERE privacy_record_id IS NULL
      ORDER BY outlet_hash FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE outlet_first_send_guards target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.outlet_hash=picked.outlet_hash AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "source_ingestion_receipts",
    updateSql: `WITH picked AS (
      SELECT source_id,artifact_id FROM source_ingestion_receipts WHERE privacy_record_id IS NULL
      ORDER BY source_id,artifact_id FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE source_ingestion_receipts target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.source_id=picked.source_id AND target.artifact_id=picked.artifact_id
      AND target.privacy_record_id IS NULL RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "contact_genre_denials",
    updateSql: `WITH picked AS (
      SELECT contact_id,genre FROM contact_genre_denials WHERE privacy_record_id IS NULL
      ORDER BY contact_id,genre FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE contact_genre_denials target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.contact_id=picked.contact_id AND target.genre=picked.genre
      AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id,target.contact_id,target.source_event_id,target.match_id,target.release_id`
  }),
  Object.freeze({
    tableName: "campaign_outlet_allocation_counters",
    updateSql: `WITH picked AS (
      SELECT release_hash,outlet_hash FROM campaign_outlet_allocation_counters WHERE privacy_record_id IS NULL
      ORDER BY release_hash,outlet_hash FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE campaign_outlet_allocation_counters target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.release_hash=picked.release_hash AND target.outlet_hash=picked.outlet_hash
      AND target.privacy_record_id IS NULL RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "campaign_outlet_allocation_ledger",
    updateSql: `WITH picked AS (
      SELECT allocation_hash FROM campaign_outlet_allocation_ledger WHERE privacy_record_id IS NULL
      ORDER BY allocation_hash FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE campaign_outlet_allocation_ledger target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.allocation_hash=picked.allocation_hash
      AND target.privacy_record_id IS NULL RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "crm_intake_receipts",
    updateSql: `WITH picked AS (
      SELECT entity_type,entity_id,revision_digest FROM crm_intake_receipts WHERE privacy_record_id IS NULL
      ORDER BY entity_type,entity_id,revision_digest FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE crm_intake_receipts target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.entity_type=picked.entity_type AND target.entity_id=picked.entity_id
      AND target.revision_digest=picked.revision_digest AND target.privacy_record_id IS NULL
    RETURNING target.privacy_record_id`
  }),
  Object.freeze({
    tableName: "purpose_bound_evidence_attestations",
    updateSql: `WITH picked AS (
      SELECT entity_type,entity_id FROM purpose_bound_evidence_attestations WHERE privacy_record_id IS NULL
      ORDER BY entity_type,entity_id FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE purpose_bound_evidence_attestations target SET privacy_record_id=gen_random_uuid()
    FROM picked WHERE target.entity_type=picked.entity_type AND target.entity_id=picked.entity_id
      AND target.privacy_record_id IS NULL RETURNING target.privacy_record_id`
  })
]);

async function backfillContactGenreDenialHashes(client, rows, cryptoBox) {
  await client.query(
    `UPDATE contact_genre_denials target SET
       contact_hash=COALESCE(target.contact_hash,value.contact_hash),
       source_event_hash=COALESCE(target.source_event_hash,value.source_event_hash),
       match_hash=COALESCE(target.match_hash,value.match_hash),
       release_hash=COALESCE(target.release_hash,value.release_hash)
     FROM jsonb_to_recordset($1::jsonb) AS value(
       privacy_record_id uuid,contact_hash char(64),source_event_hash char(64),match_hash char(64),release_hash char(64)
     ) WHERE target.privacy_record_id=value.privacy_record_id`,
    [JSON.stringify(rows.map((row) => ({
      privacy_record_id: row.privacy_record_id,
      contact_hash: cryptoBox.subjectHash(`contact:${row.contact_id}`),
      source_event_hash: cryptoBox.integrityHash(`genre-denial-event:${row.source_event_id}`),
      match_hash: cryptoBox.integrityHash(`genre-denial-match:${row.match_id}`),
      release_hash: cryptoBox.integrityHash(`genre-denial-release:${row.release_id}`)
    })))]
  );
}

const TARGETS = Object.freeze([
  target({
    dataClass: "inbound_event_evidence",
    tableName: "encrypted_event_inbox",
    action: "crypto_tombstone",
    candidateSql: `SELECT id::text AS privacy_record_key,* FROM encrypted_event_inbox
      WHERE privacy_tombstoned_at IS NULL AND status IN ('processed','dead_letter')
        AND COALESCE(processed_at,created_at)<$1 ORDER BY COALESCE(processed_at,created_at),id LIMIT $2`,
    loadSql: "SELECT id::text AS privacy_record_key,* FROM encrypted_event_inbox WHERE id=$1::uuid FOR UPDATE",
    fields: ["id","source","external_id","event_type","entity_type","entity_id","payload_ciphertext","payload_iv","payload_tag","key_version","status","created_at","processed_at"],
    tombstone: tombstoneEvent
  }),
  target({
    dataClass: "generated_copy_evidence",
    tableName: "copy_artifacts",
    action: "crypto_tombstone",
    candidateSql: `SELECT c.id::text AS privacy_record_key,c.* FROM copy_artifacts c
      WHERE c.privacy_tombstoned_at IS NULL AND c.created_at<$1
        AND NOT EXISTS (SELECT 1 FROM send_queue q WHERE q.copy_artifact_id=c.id AND q.status IN ('ready','sending','failed'))
      ORDER BY c.created_at,c.id LIMIT $2`,
    loadSql: "SELECT id::text AS privacy_record_key,* FROM copy_artifacts WHERE id=$1::uuid FOR UPDATE",
    fields: ["id","match_id","sequence_step","template_version","prompt_version","content_sha256","content_ciphertext","content_iv","content_tag","key_version","validation_status","confidence","created_at"],
    tombstone: tombstoneCopy
  }),
  target({
    dataClass: "automatic_response_evidence",
    tableName: "response_queue",
    action: "crypto_tombstone",
    candidateSql: `SELECT id::text AS privacy_record_key,* FROM response_queue
      WHERE privacy_tombstoned_at IS NULL AND status IN ('sent','delivery_unknown','canceled','dead_letter')
        AND created_at<$1 ORDER BY created_at,id LIMIT $2`,
    loadSql: "SELECT id::text AS privacy_record_key,* FROM response_queue WHERE id=$1::uuid FOR UPDATE",
    fields: ["id","match_id","release_id","contact_id","outlet_id","idempotency_key","deterministic_message_id","payload_ciphertext","payload_iv","payload_tag","key_version","status","provider_message_id","created_at","sent_at"],
    tombstone: tombstoneResponse
  }),
  target({
    dataClass: "human_review_evidence",
    tableName: "human_review_items",
    action: "crypto_tombstone",
    candidateSql: `SELECT id::text AS privacy_record_key,* FROM human_review_items
      WHERE privacy_tombstoned_at IS NULL AND status IN ('approved','rejected','completed')
        AND updated_at<$1 ORDER BY updated_at,id LIMIT $2`,
    loadSql: "SELECT id::text AS privacy_record_key,* FROM human_review_items WHERE id=$1::uuid FOR UPDATE",
    fields: ["id","review_type","source","source_event_id","match_id","contact_id","outlet_id","reason","proposed_action","evidence_ciphertext","evidence_iv","evidence_tag","key_version","status","decision","decision_reason","created_at","updated_at"],
    tombstone: tombstoneHumanReview
  }),
  target({
    dataClass: "human_review_evidence",
    tableName: "privacy_legal_holds",
    action: "crypto_tombstone",
    candidateSql: `SELECT id::text AS privacy_record_key,* FROM privacy_legal_holds
      WHERE status='released' AND privacy_tombstoned_at IS NULL AND released_at<$1
      ORDER BY released_at,id LIMIT $2`,
    loadSql: "SELECT id::text AS privacy_record_key,* FROM privacy_legal_holds WHERE id=$1::uuid FOR UPDATE",
    fields: ["id","subject_type","subject_hash","scope_data_class","case_reference","evidence_digest",
      "evidence_ciphertext","evidence_iv","evidence_tag","key_version","integrity_version","released_at"],
    tombstone: tombstoneLegalHoldEvidence
  }),
  target({
    dataClass: "human_review_evidence",
    tableName: "privacy_dsar_requests",
    action: "crypto_tombstone",
    candidateSql: `SELECT id::text AS privacy_record_key,* FROM privacy_dsar_requests
      WHERE status='closed' AND privacy_tombstoned_at IS NULL AND closed_at<$1
      ORDER BY closed_at,id LIMIT $2`,
    loadSql: "SELECT id::text AS privacy_record_key,* FROM privacy_dsar_requests WHERE id=$1::uuid FOR UPDATE",
    fields: ["id","request_type","subject_type","subject_hash","request_reference","request_digest",
      "payload_ciphertext","payload_iv","payload_tag","key_version","integrity_version","closed_at"],
    tombstone: tombstoneDsarRequestEvidence
  }),
  target({
    dataClass: "human_review_evidence",
    tableName: "privacy_dsar_artifacts",
    action: "crypto_tombstone",
    candidateSql: `SELECT artifact.id::text AS privacy_record_key,artifact.* FROM privacy_dsar_artifacts artifact
      JOIN privacy_dsar_requests request ON request.id=artifact.request_id
      WHERE request.status='closed' AND artifact.privacy_tombstoned_at IS NULL AND request.closed_at<$1
      ORDER BY request.closed_at,artifact.id LIMIT $2`,
    loadSql: "SELECT id::text AS privacy_record_key,* FROM privacy_dsar_artifacts WHERE id=$1::uuid FOR UPDATE",
    fields: ["id","request_id","artifact_type","artifact_digest","counts","payload_ciphertext","payload_iv",
      "payload_tag","key_version","integrity_version","created_at"],
    tombstone: tombstoneDsarArtifactEvidence
  }),
  target({
    dataClass: "human_review_evidence",
    tableName: "privacy_espo_mutation_plans",
    action: "crypto_tombstone",
    candidateSql: `SELECT plan.id::text AS privacy_record_key,plan.* FROM privacy_espo_mutation_plans plan
      JOIN privacy_dsar_requests request ON request.id=plan.request_id
      WHERE request.status='closed' AND plan.status='cancelled' AND plan.privacy_tombstoned_at IS NULL
        AND request.closed_at<$1 ORDER BY request.closed_at,plan.id LIMIT $2`,
    loadSql: "SELECT id::text AS privacy_record_key,* FROM privacy_espo_mutation_plans WHERE id=$1::uuid FOR UPDATE",
    fields: ["id","request_id","entity_type","entity_id_hash","expected_version","mutation_type","plan_digest",
      "payload_ciphertext","payload_iv","payload_tag","key_version","integrity_version","subject_graph_digest","created_at"],
    tombstone: tombstoneEspoPlanEvidence
  }),
  metadataTarget("queue_routing_metadata", "work_items",
    `SELECT id::text AS privacy_record_key,* FROM work_items WHERE privacy_tombstoned_at IS NULL
      AND status IN ('completed','dead_letter') AND created_at<$1 ORDER BY created_at,id LIMIT $2`,
    ["id","kind","entity_type","entity_id","dedupe_key","payload","status","last_error_code","created_at","completed_at"], tombstoneWork),
  metadataTarget("queue_routing_metadata", "send_queue",
    `SELECT id::text AS privacy_record_key,* FROM send_queue WHERE privacy_tombstoned_at IS NULL
      AND status IN ('sent','delivery_unknown','canceled','dead_letter') AND created_at<$1 ORDER BY created_at,id LIMIT $2`,
    ["id","match_id","release_id","contact_id","recipient_hash","outlet_id","sequence_step","idempotency_key","deterministic_message_id","status","provider_message_id","created_at","sent_at","canceled_at"], tombstoneSend),
  target({
    dataClass: "queue_routing_metadata",
    tableName: "send_counters",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM send_counters
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND counter_date<$1::date
      ORDER BY counter_date,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM send_counters WHERE privacy_record_id IS NULL
      AND privacy_tombstoned_at IS NULL AND counter_date<$1::date LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM send_counters WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","counter_date","counter_type","subject_hash","sent_count","updated_at"],
    tombstone: tombstoneSendCounter
  }),
  target({
    dataClass: "queue_routing_metadata",
    tableName: "send_capacity_reservations",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM send_capacity_reservations
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND status IN ('consumed','released')
        AND COALESCE(finalized_at,reserved_at)<$1 ORDER BY COALESCE(finalized_at,reserved_at),privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM send_capacity_reservations WHERE privacy_record_id IS NULL
      AND privacy_tombstoned_at IS NULL AND status IN ('consumed','released')
      AND COALESCE(finalized_at,reserved_at)<$1 LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM send_capacity_reservations WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","send_queue_id","counter_date","global_hash","release_hash","domain_hash","status","reserved_at","finalized_at"],
    tombstone: tombstoneCapacityReservation
  }),
  target({
    dataClass: "queue_routing_metadata",
    tableName: "outlet_first_send_guards",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM outlet_first_send_guards
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND status IN ('consumed','released')
        AND cooldown_until<$1 ORDER BY updated_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM outlet_first_send_guards WHERE privacy_record_id IS NULL
      AND privacy_tombstoned_at IS NULL AND status IN ('consumed','released') AND cooldown_until<$1 LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM outlet_first_send_guards WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","outlet_hash","match_id","send_queue_id","status","reserved_at","consumed_at","released_at","cooldown_until","updated_at"],
    tombstone: tombstoneOutletGuard
  }),
  target({
    dataClass: "queue_routing_metadata",
    tableName: "sequence_allocations",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM sequence_allocations
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND status='released' AND updated_at<$1
        AND (cooldown_until IS NULL OR cooldown_until<now()) ORDER BY updated_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM sequence_allocations
      WHERE privacy_record_id IS NULL AND privacy_tombstoned_at IS NULL AND status='released' AND updated_at<$1
        AND (cooldown_until IS NULL OR cooldown_until<now()) LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM sequence_allocations WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","recipient_hash","match_id","release_id","contact_id","outlet_id","status","acquired_at","initial_sent_at","released_at","cooldown_until","release_reason","updated_at"],
    tombstone: tombstoneAllocation
  }),
  target({
    dataClass: "queue_routing_metadata",
    tableName: "campaign_outlet_allocation_counters",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM campaign_outlet_allocation_counters
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND updated_at<$1
      ORDER BY updated_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM campaign_outlet_allocation_counters
      WHERE privacy_record_id IS NULL AND privacy_tombstoned_at IS NULL AND updated_at<$1 LIMIT 1`,
    loadSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM campaign_outlet_allocation_counters
      WHERE privacy_record_id=$1::uuid FOR UPDATE`,
    fields: ["privacy_record_id","release_hash","outlet_hash","allocated_count","created_at","updated_at"],
    tombstone: tombstoneCampaignOutletCounter
  }),
  target({
    dataClass: "queue_routing_metadata",
    tableName: "campaign_outlet_allocation_ledger",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM campaign_outlet_allocation_ledger
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND allocated_at<$1
      ORDER BY allocated_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM campaign_outlet_allocation_ledger
      WHERE privacy_record_id IS NULL AND privacy_tombstoned_at IS NULL AND allocated_at<$1 LIMIT 1`,
    loadSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM campaign_outlet_allocation_ledger
      WHERE privacy_record_id=$1::uuid FOR UPDATE`,
    fields: ["privacy_record_id","allocation_hash","release_hash","outlet_hash","contact_hash","outlet_subject_hash","recipient_hash","allocated_at"],
    tombstone: tombstoneCampaignOutletLedger
  }),
  metadataTarget("delivery_attempt_metadata", "delivery_attempts",
    `SELECT id::text AS privacy_record_key,* FROM delivery_attempts WHERE privacy_tombstoned_at IS NULL
      AND status<>'started' AND COALESCE(finished_at,started_at)<$1 ORDER BY COALESCE(finished_at,started_at),id LIMIT $2`,
    ["id","send_queue_id","attempt_number","status","provider_message_id","error_code","correlation_id","started_at","finished_at"], tombstoneDeliveryAttempt),
  metadataTarget("delivery_attempt_metadata", "response_delivery_attempts",
    `SELECT id::text AS privacy_record_key,* FROM response_delivery_attempts WHERE privacy_tombstoned_at IS NULL
      AND status<>'started' AND COALESCE(finished_at,started_at)<$1 ORDER BY COALESCE(finished_at,started_at),id LIMIT $2`,
    ["id","response_queue_id","attempt_number","status","provider_message_id","error_code","correlation_id","started_at","finished_at"], tombstoneResponseAttempt),
  metadataTarget("outcome_metadata", "outcome_events",
    `SELECT id::text AS privacy_record_key,* FROM outcome_events WHERE privacy_tombstoned_at IS NULL
      AND occurred_at<$1 ORDER BY occurred_at,id LIMIT $2`,
    ["id","match_id","send_queue_id","event_type","provider_event_id","occurred_at","created_at"], tombstoneOutcome),
  metadataTarget("outcome_metadata", "crm_delivery_projections",
    `SELECT send_queue_id::text AS privacy_record_key,* FROM crm_delivery_projections
      WHERE privacy_tombstoned_at IS NULL AND (status='completed' OR (status='failed' AND last_failure_retryable=false))
        AND COALESCE(completed_at,updated_at)<$1 ORDER BY COALESCE(completed_at,updated_at),send_queue_id LIMIT $2`,
    ["send_queue_id","match_id","release_id","contact_id","outlet_id","provider_message_id","deterministic_message_id",
      "correlation_id","accepted_at","campaign_projection_key","email_projection_key","event_projection_key","status",
      "last_failure_retryable","campaign_id","email_id","event_id","created_at","updated_at","completed_at"], tombstoneCrmDeliveryProjection,
    { loadSql: "SELECT send_queue_id::text AS privacy_record_key,* FROM crm_delivery_projections WHERE send_queue_id=$1::uuid FOR UPDATE" }),
  target({
    dataClass: "outcome_metadata",
    tableName: "contact_genre_denials",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM contact_genre_denials
      WHERE privacy_record_id IS NOT NULL AND contact_hash IS NOT NULL AND privacy_tombstoned_at IS NULL
        AND created_at<$1 ORDER BY created_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM contact_genre_denials WHERE (privacy_record_id IS NULL OR contact_hash IS NULL)
      AND privacy_tombstoned_at IS NULL AND created_at<$1 LIMIT 1`,
    loadSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM contact_genre_denials
      WHERE privacy_record_id=$1::uuid FOR UPDATE`,
    fields: ["privacy_record_id","contact_id","contact_hash","genre","source_event_id","source_event_hash",
      "match_id","match_hash","release_id","release_hash","created_at"],
    tombstone: tombstoneContactGenreDenial
  }),
  target({
    dataClass: "source_traceability_metadata",
    tableName: "source_ingestion_receipts",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM source_ingestion_receipts
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND status IN ('completed','failed')
        AND updated_at<$1 ORDER BY updated_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM source_ingestion_receipts WHERE privacy_record_id IS NULL
      AND privacy_tombstoned_at IS NULL AND status IN ('completed','failed') AND updated_at<$1 LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM source_ingestion_receipts WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","source_id","artifact_id","content_digest","generated_at","status","result","last_error_code","attempts","created_at","updated_at"],
    tombstone: tombstoneSourceReceipt
  }),
  target({
    dataClass: "source_traceability_metadata",
    tableName: "source_ingestion_record_links",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM source_ingestion_record_links
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND updated_at<$1 ORDER BY updated_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM source_ingestion_record_links
      WHERE privacy_record_id IS NULL AND privacy_tombstoned_at IS NULL AND updated_at<$1 LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM source_ingestion_record_links WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","source_id","external_id","entity_type","crm_entity_id","artifact_id","evidence_digest","evidence_captured_at","created_at","updated_at"],
    tombstone: tombstoneSourceLink
  }),
  target({
    dataClass: "source_traceability_metadata",
    tableName: "source_identity_bindings",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM source_identity_bindings
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND updated_at<$1
      ORDER BY updated_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM source_identity_bindings
      WHERE privacy_record_id IS NULL AND privacy_tombstoned_at IS NULL AND updated_at<$1 LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM source_identity_bindings WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","entity_type","identity_type","identity_hash","crm_entity_id","evidence_captured_at",
      "evidence_verified","source_id","external_id","created_at","updated_at"],
    tombstone: tombstoneSourceIdentityBinding
  }),
  target({
    dataClass: "source_traceability_metadata",
    tableName: "source_identity_claim_items",
    action: "metadata_anonymize",
    candidateSql: `SELECT item.privacy_record_id::text AS privacy_record_key,item.*
      FROM source_identity_claim_items item JOIN source_identity_claims claim ON claim.id=item.claim_id
      WHERE item.privacy_record_id IS NOT NULL AND item.privacy_tombstoned_at IS NULL AND claim.locked_until<$1
      ORDER BY claim.locked_until,item.privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM source_identity_claim_items item
      JOIN source_identity_claims claim ON claim.id=item.claim_id
      WHERE item.privacy_record_id IS NULL AND item.privacy_tombstoned_at IS NULL AND claim.locked_until<$1 LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM source_identity_claim_items WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","claim_id","entity_type","identity_type","identity_hash"],
    tombstone: tombstoneSourceIdentityClaimItem
  }),
  metadataTarget("source_traceability_metadata", "source_identity_claims",
    `SELECT id::text AS privacy_record_key,* FROM source_identity_claims
      WHERE privacy_tombstoned_at IS NULL AND locked_until<$1 ORDER BY locked_until,id LIMIT $2`,
    ["id","claim_owner","entity_type","locked_until","created_at"], tombstoneSourceIdentityClaim),
  target({
    dataClass: "source_traceability_metadata",
    tableName: "crm_intake_receipts",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM crm_intake_receipts
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND status IN ('completed','failed')
        AND COALESCE(completed_at,updated_at)<$1
      ORDER BY COALESCE(completed_at,updated_at),privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM crm_intake_receipts WHERE privacy_record_id IS NULL
      AND privacy_tombstoned_at IS NULL AND status IN ('completed','failed')
      AND COALESCE(completed_at,updated_at)<$1 LIMIT 1`,
    loadSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM crm_intake_receipts
      WHERE privacy_record_id=$1::uuid FOR UPDATE`,
    fields: ["privacy_record_id","entity_type","entity_id","revision_digest","status","result","attempts",
      "last_error_code","lease_owner","lease_version","locked_until","created_at","updated_at","completed_at"],
    tombstone: tombstoneCrmIntakeReceipt
  }),
  target({
    dataClass: "source_traceability_metadata",
    tableName: "purpose_bound_evidence_attestations",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM purpose_bound_evidence_attestations
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND status IN ('invalid','revoked') AND updated_at<$1
      ORDER BY updated_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM purpose_bound_evidence_attestations WHERE privacy_record_id IS NULL
      AND privacy_tombstoned_at IS NULL AND status IN ('invalid','revoked') AND updated_at<$1 LIMIT 1`,
    loadSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM purpose_bound_evidence_attestations
      WHERE privacy_record_id=$1::uuid FOR UPDATE`,
    fields: ["privacy_record_id","entity_type","entity_id","entity_version","digest_version","evidence_digest",
      "evidence_captured_at","purpose","basis","source_kind","origin_revision_digest","origin_entity_id",
      "origin_source_id","origin_artifact_id","status","revocation_reason","created_at","updated_at"],
    tombstone: tombstonePurposeBoundEvidence
  }),
  target({
    dataClass: "email_validation_metadata",
    tableName: "email_validation_cache",
    action: "metadata_anonymize",
    candidateSql: `SELECT privacy_record_id::text AS privacy_record_key,* FROM email_validation_cache
      WHERE privacy_record_id IS NOT NULL AND privacy_tombstoned_at IS NULL AND expires_at<$1 ORDER BY expires_at,privacy_record_id LIMIT $2`,
    unindexedSql: `SELECT 1 FROM email_validation_cache
      WHERE privacy_record_id IS NULL AND privacy_tombstoned_at IS NULL AND expires_at<$1 LIMIT 1`,
    loadSql: "SELECT privacy_record_id::text AS privacy_record_key,* FROM email_validation_cache WHERE privacy_record_id=$1::uuid FOR UPDATE",
    fields: ["privacy_record_id","recipient_hash","status","checked_at","expires_at","provider_reference","validator_type","created_at","updated_at"],
    tombstone: tombstoneEmailValidation
  })
]);

async function buildDsarSnapshot(client, cryptoBox, {
  subjectType,
  subjectValue,
  subjectHash,
  maximumRecords
}) {
  const normalizedEmail = subjectType === "email" ? String(subjectValue).trim().toLowerCase() : undefined;
  const recipientHash = subjectType === "email"
    ? cryptoBox.privacyHash(`email:${normalizedEmail}`)
    : undefined;
  const validationRecipientHash = normalizedEmail ? cryptoBox.privacyHash(normalizedEmail) : undefined;
  const sourceIdentityHash = normalizedEmail ? cryptoBox.privacyHash(`source-identity:email:${normalizedEmail}`) : undefined;
  const contactIds = new Set(subjectType === "contact" ? [subjectValue] : []);
  if (recipientHash) {
    const linked = await client.query(
      `SELECT contact_id FROM send_queue WHERE recipient_hash=$1 AND privacy_tombstoned_at IS NULL
       UNION
       SELECT contact_id FROM sequence_allocations WHERE recipient_hash=$1 AND privacy_tombstoned_at IS NULL`,
      [recipientHash]
    );
    for (const row of linked.rows) contactIds.add(row.contact_id);
  }
  if (sourceIdentityHash) {
    const linked = await client.query(
      `SELECT crm_entity_id FROM source_identity_bindings
       WHERE identity_hash=$1 AND privacy_tombstoned_at IS NULL`,
      [sourceIdentityHash]
    );
    for (const row of linked.rows) contactIds.add(row.crm_entity_id);
  }
  const contacts = [...contactIds].sort();
  const dsarSubjectHashes = [...new Set([
    subjectHash,
    recipientHash,
    validationRecipientHash,
    sourceIdentityHash,
    ...contacts.map((contactId) => cryptoBox.subjectHash(`contact:${contactId}`))
  ].filter(Boolean))];
  await assertDsarEncryptedPayloadBound(client, { contacts, recipientHash, subjectHashes: dsarSubjectHashes });
  let remaining = maximumRecords;
  const take = async (text, parameters) => {
    if (remaining < 1) throw governanceError("PRIVACY_DSAR_RESULT_LIMIT_EXCEEDED", "DSAR result exceeds its explicit record limit");
    const result = await client.query(text, [...parameters, remaining + 1]);
    if (result.rowCount > remaining) throw governanceError("PRIVACY_DSAR_RESULT_LIMIT_EXCEEDED", "DSAR result exceeds its explicit record limit");
    remaining -= result.rowCount;
    return result.rows;
  };
  const sends = await take(
    `SELECT id,match_id,release_id,contact_id,outlet_id,sequence_step,status,provider_message_id,created_at,sent_at,canceled_at,copy_artifact_id
     FROM send_queue
     WHERE privacy_tombstoned_at IS NULL AND (contact_id=ANY($1::text[]) OR ($2::text IS NOT NULL AND recipient_hash=$2))
     ORDER BY created_at,id LIMIT $3`,
    [contacts, recipientHash ?? null]
  );
  const responses = await take(
    `SELECT id,match_id,release_id,contact_id,outlet_id,status,provider_message_id,created_at,sent_at,
       idempotency_key,payload_ciphertext,payload_iv,payload_tag,key_version
     FROM response_queue WHERE privacy_tombstoned_at IS NULL AND contact_id=ANY($1::text[])
     ORDER BY created_at,id LIMIT $2`,
    [contacts]
  );
  const allocations = await take(
    `SELECT privacy_record_id,match_id,release_id,contact_id,outlet_id,status,acquired_at,initial_sent_at,released_at,cooldown_until,release_reason
     FROM sequence_allocations
     WHERE privacy_tombstoned_at IS NULL AND (contact_id=ANY($1::text[]) OR ($2::text IS NOT NULL AND recipient_hash=$2))
     ORDER BY updated_at,privacy_record_id LIMIT $3`,
    [contacts, recipientHash ?? null]
  );
  const contactSubjectHashes = contacts.map((contactId) => cryptoBox.subjectHash(`contact:${contactId}`));
  const campaignOutletAllocations = await take(
    `SELECT privacy_record_id,allocation_hash,release_hash,outlet_hash,contact_hash,outlet_subject_hash,recipient_hash,allocated_at
     FROM campaign_outlet_allocation_ledger
     WHERE privacy_tombstoned_at IS NULL
       AND (contact_hash=ANY($1::text[]) OR ($2::text IS NOT NULL AND recipient_hash=$2))
     ORDER BY allocated_at,privacy_record_id LIMIT $3`,
    [contactSubjectHashes, recipientHash ?? null]
  );
  const campaignOutletCounters = await take(
    `SELECT DISTINCT counter.privacy_record_id,counter.release_hash,counter.outlet_hash,
       counter.allocated_count,counter.created_at,counter.updated_at
     FROM campaign_outlet_allocation_counters counter
     JOIN campaign_outlet_allocation_ledger ledger
       ON ledger.release_hash=counter.release_hash AND ledger.outlet_hash=counter.outlet_hash
     WHERE counter.privacy_tombstoned_at IS NULL AND ledger.privacy_tombstoned_at IS NULL
       AND (ledger.contact_hash=ANY($1::text[]) OR ($2::text IS NOT NULL AND ledger.recipient_hash=$2))
     ORDER BY counter.updated_at,counter.privacy_record_id LIMIT $3`,
    [contactSubjectHashes, recipientHash ?? null]
  );
  const reviews = await take(
    `SELECT id,review_type,source,source_event_id,match_id,contact_id,outlet_id,reason,proposed_action,status,decision,
       created_at,updated_at,evidence_ciphertext,evidence_iv,evidence_tag,key_version
     FROM human_review_items WHERE privacy_tombstoned_at IS NULL AND contact_id=ANY($1::text[])
     ORDER BY created_at,id LIMIT $2`,
    [contacts]
  );
  const events = await take(
    `SELECT id,source,external_id,event_type,entity_type,entity_id,status,created_at,processed_at,
       payload_ciphertext,payload_iv,payload_tag,key_version
     FROM encrypted_event_inbox event WHERE privacy_tombstoned_at IS NULL AND (
       entity_id=ANY($1::text[]) OR EXISTS (
         SELECT 1 FROM privacy_record_subject_keys subject_key
         WHERE subject_key.data_class='inbound_event_evidence'
           AND subject_key.table_name='encrypted_event_inbox' AND subject_key.record_key=event.id::text
           AND subject_key.subject_hash=ANY($2::text[])
       )) ORDER BY created_at,id LIMIT $3`,
    [contacts, dsarSubjectHashes]
  );
  const sendIds = sends.map((row) => row.id);
  const capacityReservations = await take(
    `SELECT privacy_record_id,send_queue_id,counter_date,global_hash,release_hash,domain_hash,status,reserved_at,finalized_at
     FROM send_capacity_reservations WHERE privacy_tombstoned_at IS NULL AND send_queue_id=ANY($1::uuid[])
     ORDER BY reserved_at,privacy_record_id LIMIT $2`,
    [sendIds]
  );
  const counterHashes = [...new Set(capacityReservations.flatMap((row) => [row.global_hash, row.release_hash, row.domain_hash]))];
  const sendCounters = await take(
    `SELECT privacy_record_id,counter_date,counter_type,subject_hash,sent_count,updated_at
     FROM send_counters WHERE privacy_tombstoned_at IS NULL AND subject_hash=ANY($1::text[])
     ORDER BY counter_date,privacy_record_id LIMIT $2`,
    [counterHashes]
  );
  const outletGuards = await take(
    `SELECT privacy_record_id,outlet_hash,send_queue_id,status,reserved_at,consumed_at,released_at,cooldown_until,updated_at
     FROM outlet_first_send_guards WHERE privacy_tombstoned_at IS NULL AND send_queue_id=ANY($1::uuid[])
     ORDER BY updated_at,privacy_record_id LIMIT $2`,
    [sendIds]
  );
  const outcomes = await take(
    `SELECT id,match_id,send_queue_id,event_type,provider_event_id,occurred_at,created_at
     FROM outcome_events WHERE privacy_tombstoned_at IS NULL AND send_queue_id=ANY($1::uuid[])
     ORDER BY occurred_at,id LIMIT $2`,
    [sendIds]
  );
  const copyIds = [...new Set(sends.map((row) => String(row.copy_artifact_id)))];
  const copies = await take(
    `SELECT id,match_id,sequence_step,template_version,prompt_version,validation_status,confidence,created_at,
       content_sha256,content_ciphertext,content_iv,content_tag,key_version
     FROM copy_artifacts WHERE privacy_tombstoned_at IS NULL AND id=ANY($1::uuid[])
     ORDER BY created_at,id LIMIT $2`,
    [copyIds]
  );
  const responseIds = responses.map((row) => row.id);
  const matchIds = [...new Set([
    ...sends.map((row) => row.match_id),
    ...responses.map((row) => row.match_id),
    ...allocations.map((row) => row.match_id)
  ].filter(Boolean))];
  const workEntityIds = [...new Set([...contacts, ...matchIds, ...sendIds.map(String), ...responseIds.map(String)])];
  const workItems = await take(
    `SELECT id,kind,entity_type,entity_id,payload,status,last_error_code,created_at,completed_at
     FROM work_items WHERE privacy_tombstoned_at IS NULL AND entity_id=ANY($1::text[])
     ORDER BY created_at,id LIMIT $2`,
    [workEntityIds]
  );
  const deliveryAttempts = await take(
    `SELECT id,send_queue_id,attempt_number,status,provider_message_id,error_code,correlation_id,started_at,finished_at
     FROM delivery_attempts WHERE privacy_tombstoned_at IS NULL AND send_queue_id=ANY($1::uuid[])
     ORDER BY started_at,id LIMIT $2`,
    [sendIds]
  );
  const responseDeliveryAttempts = await take(
    `SELECT id,response_queue_id,attempt_number,status,provider_message_id,error_code,correlation_id,started_at,finished_at
     FROM response_delivery_attempts WHERE privacy_tombstoned_at IS NULL AND response_queue_id=ANY($1::uuid[])
     ORDER BY started_at,id LIMIT $2`,
    [responseIds]
  );
  const sourceLinks = await take(
    `SELECT privacy_record_id,source_id,external_id,entity_type,crm_entity_id,artifact_id,evidence_digest,
       evidence_captured_at,created_at,updated_at
     FROM source_ingestion_record_links
     WHERE privacy_tombstoned_at IS NULL AND crm_entity_id=ANY($1::text[])
     ORDER BY updated_at,privacy_record_id LIMIT $2`,
    [contacts]
  );
  const sourceReceipts = await take(
    `SELECT DISTINCT receipt.privacy_record_id,receipt.source_id,receipt.artifact_id,receipt.content_digest,
       receipt.generated_at,receipt.status,receipt.result,receipt.last_error_code,receipt.attempts,
       receipt.created_at,receipt.updated_at
     FROM source_ingestion_receipts receipt JOIN source_ingestion_record_links link
       ON link.source_id=receipt.source_id AND link.artifact_id=receipt.artifact_id
     WHERE receipt.privacy_tombstoned_at IS NULL AND link.crm_entity_id=ANY($1::text[])
     ORDER BY receipt.updated_at,receipt.privacy_record_id LIMIT $2`,
    [contacts]
  );
  const emailValidations = await take(
    `SELECT privacy_record_id,status,checked_at,expires_at,provider_reference,validator_type,created_at,updated_at
     FROM email_validation_cache
     WHERE privacy_tombstoned_at IS NULL AND $1::text IS NOT NULL AND recipient_hash=$1
     ORDER BY updated_at,privacy_record_id LIMIT $2`,
    [validationRecipientHash ?? null]
  );
  const sourceIdentityBindings = await take(
    `SELECT privacy_record_id,entity_type,identity_type,identity_hash,crm_entity_id,evidence_captured_at,
       evidence_verified,source_id,external_id,created_at,updated_at
     FROM source_identity_bindings
     WHERE privacy_tombstoned_at IS NULL
       AND (crm_entity_id=ANY($1::text[]) OR ($2::text IS NOT NULL AND identity_hash=$2))
     ORDER BY updated_at,privacy_record_id LIMIT $3`,
    [contacts, sourceIdentityHash ?? null]
  );
  const sourceIdentityClaimItems = await take(
    `SELECT item.privacy_record_id,item.claim_id,item.entity_type,item.identity_type,item.identity_hash
     FROM source_identity_claim_items item
     LEFT JOIN source_identity_bindings binding
       ON binding.entity_type=item.entity_type AND binding.identity_type=item.identity_type
      AND binding.identity_hash=item.identity_hash AND binding.privacy_tombstoned_at IS NULL
     WHERE item.privacy_tombstoned_at IS NULL
       AND (binding.crm_entity_id=ANY($1::text[]) OR ($2::text IS NOT NULL AND item.identity_hash=$2))
     ORDER BY item.claim_id,item.privacy_record_id LIMIT $3`,
    [contacts, sourceIdentityHash ?? null]
  );
  const claimIds = [...new Set(sourceIdentityClaimItems.map((row) => row.claim_id))];
  const sourceIdentityClaims = await take(
    `SELECT id,claim_owner,entity_type,locked_until,created_at FROM source_identity_claims
     WHERE privacy_tombstoned_at IS NULL AND id=ANY($1::uuid[])
     ORDER BY created_at,id LIMIT $2`,
    [claimIds]
  );
  const crmIntakeReceipts = await take(
    `SELECT privacy_record_id,entity_type,entity_id,revision_digest,status,result,attempts,last_error_code,
       created_at,updated_at,completed_at
     FROM crm_intake_receipts WHERE privacy_tombstoned_at IS NULL
       AND entity_type='MediaContact' AND entity_id=ANY($1::text[])
     ORDER BY updated_at,privacy_record_id LIMIT $2`,
    [contacts]
  );
  const purposeBoundEvidence = await take(
    `SELECT privacy_record_id,entity_type,entity_id,entity_version,digest_version,evidence_digest,
       evidence_captured_at,purpose,basis,source_kind,origin_revision_digest,origin_entity_id,
       origin_source_id,origin_artifact_id,status,revocation_reason,created_at,updated_at
     FROM purpose_bound_evidence_attestations WHERE privacy_tombstoned_at IS NULL
       AND entity_type='MediaContact' AND (entity_id=ANY($1::text[]) OR origin_entity_id=ANY($1::text[]))
     ORDER BY updated_at,privacy_record_id LIMIT $2`,
    [contacts]
  );
  const crmDeliveryProjections = await take(
    `SELECT send_queue_id,match_id,release_id,contact_id,outlet_id,provider_message_id,deterministic_message_id,
       correlation_id,accepted_at,campaign_projection_key,email_projection_key,event_projection_key,status,
       campaign_id,email_id,event_id,created_at,updated_at,completed_at
     FROM crm_delivery_projections
     WHERE privacy_tombstoned_at IS NULL
       AND (contact_id=ANY($1::text[]) OR send_queue_id=ANY($2::uuid[]))
     ORDER BY created_at,send_queue_id LIMIT $3`,
    [contacts, sendIds]
  );
  const contactGenreDenials = await take(
    `SELECT privacy_record_id,contact_hash,genre,source_event_hash,match_hash,release_hash,created_at
     FROM contact_genre_denials WHERE privacy_tombstoned_at IS NULL
       AND (contact_hash=ANY($1::text[]) OR (contact_hash IS NULL AND contact_id=ANY($2::text[])))
     ORDER BY created_at,privacy_record_id LIMIT $3`,
    [contacts.map((contactId) => cryptoBox.subjectHash(`contact:${contactId}`)), contacts]
  );
  const suppressionHashes = new Set([subjectHash]);
  for (const contactId of contacts) suppressionHashes.add(cryptoBox.privacyHash(`contact:${contactId}`));
  const suppressions = await take(
    `SELECT subject_type,reason,source,active,first_seen_at,last_seen_at
     FROM suppression_cache WHERE subject_hash=ANY($1::text[])
     ORDER BY first_seen_at,id LIMIT $2`,
    [[...suppressionHashes]]
  );
  const records = Object.freeze({
    sendQueue: sends.map((row) => publicRow(row, ["copy_artifact_id"])),
    responseQueue: responses.map((row) => ({
      ...publicRow(row, ["idempotency_key","payload_ciphertext","payload_iv","payload_tag","key_version"]),
      payload: cryptoBox.decryptJson({
        ciphertext: row.payload_ciphertext,
        iv: row.payload_iv,
        tag: row.payload_tag,
        keyVersion: row.key_version
      }, `response:${row.idempotency_key}`)
    })),
    sequenceAllocations: allocations.map((row) => publicRow(row)),
    campaignOutletAllocations: campaignOutletAllocations.map((row) => publicRow(row,
      ["allocation_hash", "release_hash", "outlet_hash", "contact_hash", "outlet_subject_hash", "recipient_hash"])),
    campaignOutletCounters: campaignOutletCounters.map((row) => publicRow(row, ["release_hash", "outlet_hash"])),
    sendCapacityReservations: capacityReservations.map((row) => publicRow(row, ["global_hash", "release_hash", "domain_hash"])),
    sendCounters: sendCounters.map((row) => publicRow(row, ["subject_hash"])),
    outletFirstSendGuards: outletGuards.map((row) => publicRow(row, ["outlet_hash"])),
    humanReviews: reviews.map((row) => ({
      ...publicRow(row, ["evidence_ciphertext","evidence_iv","evidence_tag","key_version"]),
      evidence: cryptoBox.decryptJson({
        ciphertext: row.evidence_ciphertext,
        iv: row.evidence_iv,
        tag: row.evidence_tag,
        keyVersion: row.key_version
      }, `human-review:${row.source}:${row.source_event_id}:${row.review_type}`)
    })),
    inboundEvents: events.map((row) => ({
      ...publicRow(row, ["payload_ciphertext","payload_iv","payload_tag","key_version"]),
      payload: cryptoBox.decryptJson({
        ciphertext: row.payload_ciphertext,
        iv: row.payload_iv,
        tag: row.payload_tag,
        keyVersion: row.key_version
      }, `${row.source}:${row.external_id}`)
    })),
    outcomes: outcomes.map((row) => publicRow(row)),
    copyArtifacts: copies.map((row) => ({
      ...publicRow(row, ["content_ciphertext","content_iv","content_tag","key_version","content_sha256"]),
      content: cryptoBox.decryptJson({
        ciphertext: row.content_ciphertext,
        iv: row.content_iv,
        tag: row.content_tag,
        keyVersion: row.key_version
      }, `${row.match_id}:${row.sequence_step}:${row.content_sha256}`)
    })),
    workItems: workItems.map((row) => publicRow(row)),
    deliveryAttempts: deliveryAttempts.map((row) => publicRow(row)),
    responseDeliveryAttempts: responseDeliveryAttempts.map((row) => publicRow(row)),
    sourceIngestionRecordLinks: sourceLinks.map((row) => publicRow(row)),
    sourceIngestionReceipts: sourceReceipts.map((row) => publicRow(row, ["content_digest"])),
    emailValidationCache: emailValidations.map((row) => publicRow(row)),
    sourceIdentityBindings: sourceIdentityBindings.map((row) => publicRow(row)),
    sourceIdentityClaimItems: sourceIdentityClaimItems.map((row) => publicRow(row)),
    sourceIdentityClaims: sourceIdentityClaims.map((row) => publicRow(row)),
    crmIntakeReceipts: crmIntakeReceipts.map((row) => publicRow(row, ["revision_digest"])),
    purposeBoundEvidence: purposeBoundEvidence.map((row) => publicRow(row,
      ["evidence_digest", "origin_revision_digest"])),
    crmDeliveryProjections: crmDeliveryProjections.map((row) => publicRow(row)),
    contactGenreDenials: contactGenreDenials.map((row) => publicRow(row)),
    suppressions: suppressions.map((row) => publicRow(row))
  });
  const counts = Object.freeze(Object.fromEntries(
    Object.entries(records).map(([name, values]) => [name, values.length])
  ));
  const snapshot = Object.freeze({
    subjectType,
    linkedContactCount: contacts.length,
    counts,
    records,
    erasureActions: Object.freeze({
      tombstoneRecordCount: Object.entries(records)
        .filter(([name]) => !new Set(["suppressions", "contactGenreDenials"]).has(name))
        .reduce((total, [, values]) => total + values.length, 0),
      preserveHashedSuppressionCount: records.suppressions.length,
      preserveDenyWinsGenreCount: records.contactGenreDenials.length,
      espocrmExecution: "separate_version_conditional_plan_only"
    })
  });
  if (Buffer.byteLength(canonicalJson(snapshot), "utf8") > 10 * 1_024 * 1_024) {
    throw governanceError("PRIVACY_DSAR_ARTIFACT_TOO_LARGE", "DSAR artifact exceeds its encrypted 10 MiB bound");
  }
  return snapshot;
}

async function assertDsarEncryptedPayloadBound(client, { contacts, recipientHash, subjectHashes }) {
  const result = await client.query(
    `WITH relevant_sends AS MATERIALIZED (
       SELECT id,copy_artifact_id FROM send_queue
       WHERE privacy_tombstoned_at IS NULL
         AND (contact_id=ANY($1::text[]) OR ($2::text IS NOT NULL AND recipient_hash=$2))
     ), encrypted_sizes AS (
       SELECT octet_length(payload_ciphertext)+octet_length(payload_iv)+octet_length(payload_tag) AS bytes
       FROM response_queue WHERE privacy_tombstoned_at IS NULL AND contact_id=ANY($1::text[])
       UNION ALL
       SELECT octet_length(evidence_ciphertext)+octet_length(evidence_iv)+octet_length(evidence_tag)
       FROM human_review_items WHERE privacy_tombstoned_at IS NULL AND contact_id=ANY($1::text[])
       UNION ALL
       SELECT octet_length(event.payload_ciphertext)+octet_length(event.payload_iv)+octet_length(event.payload_tag)
       FROM encrypted_event_inbox event WHERE event.privacy_tombstoned_at IS NULL AND (
         event.entity_id=ANY($1::text[]) OR EXISTS (
           SELECT 1 FROM privacy_record_subject_keys subject_key
           WHERE subject_key.data_class='inbound_event_evidence'
             AND subject_key.table_name='encrypted_event_inbox' AND subject_key.record_key=event.id::text
             AND subject_key.subject_hash=ANY($3::text[])
         )
       )
       UNION ALL
       SELECT octet_length(copy.content_ciphertext)+octet_length(copy.content_iv)+octet_length(copy.content_tag)
       FROM copy_artifacts copy WHERE copy.privacy_tombstoned_at IS NULL
         AND copy.id IN (SELECT copy_artifact_id FROM relevant_sends)
     ) SELECT COALESCE(sum(bytes),0)::bigint AS encrypted_bytes FROM encrypted_sizes`,
    [contacts, recipientHash ?? null, subjectHashes]
  );
  const encryptedBytes = Number(result.rows[0].encrypted_bytes);
  if (!Number.isSafeInteger(encryptedBytes) || encryptedBytes > 8 * 1_024 * 1_024) {
    throw governanceError(
      "PRIVACY_DSAR_ARTIFACT_TOO_LARGE",
      "DSAR encrypted source data exceeds the 8 MiB preflight budget for the 10 MiB streaming envelope"
    );
  }
}

function publicRow(row, excluded = []) {
  const blocked = new Set(excluded);
  return Object.freeze(Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !blocked.has(key))
      .map(([key, value]) => [key, normalizeValue(value)])
  ));
}

function dsarArtifactType(requestType) {
  return ({
    lookup: "lookup",
    export: "export",
    correction: "correction_plan",
    erasure: "erasure_plan"
  })[requestType];
}

function dsarSubjectGraph(subject, snapshot, cryptoBox) {
  const graph = new Map();
  const add = (entityType, entityId, relationType, evidenceTable, evidenceRecordKey) => {
    const id = String(entityId ?? "").trim();
    if (!id || !new Set(["MediaContact", "Email"]).has(entityType)) return;
    const entityIdHash = cryptoBox.integrityHash(`espocrm:${entityType}:${id}`);
    graph.set(`${entityType}:${entityIdHash}`, Object.freeze({
      entityType,
      entityIdHash,
      relationType,
      evidenceTable,
      evidenceRecordKey: String(evidenceRecordKey ?? entityIdHash)
    }));
  };
  if (subject.type === "contact") {
    add("MediaContact", subject.value, "direct_subject", "privacy_dsar_requests", cryptoBox.integrityHash(`dsar-contact:${subject.value}`));
  }
  for (const [recordType, records] of Object.entries(snapshot.records)) {
    for (const record of records) {
      if (record.contact_id) {
        add(
          "MediaContact",
          record.contact_id,
          "direct_subject",
          recordType,
          record.privacy_record_id ?? record.id ?? record.send_queue_id ?? cryptoBox.integrityHash(canonicalJson(record))
        );
      }
    }
  }
  for (const projection of snapshot.records.crmDeliveryProjections ?? []) {
    if (projection.email_id) {
      add("Email", projection.email_id, "delivery_evidence", "crm_delivery_projections", projection.send_queue_id);
    }
  }
  return Object.freeze([...graph.values()].sort((left, right) => left.entityType.localeCompare(right.entityType)
    || left.entityIdHash.localeCompare(right.entityIdHash)));
}

function subjectGraphDigestItem(value) {
  return {
    entityType: value.entityType,
    entityIdHash: value.entityIdHash,
    relationType: value.relationType,
    evidenceTable: value.evidenceTable,
    evidenceRecordKey: value.evidenceRecordKey
  };
}

async function persistDsarSubjectGraph(client, requestId, graph) {
  if (!graph.length) return;
  await client.query(
    `INSERT INTO privacy_dsar_subject_entities
      (request_id,entity_type,entity_id_hash,relation_type,evidence_table,evidence_record_key)
     SELECT $1,entry.entity_type,entry.entity_id_hash,entry.relation_type,entry.evidence_table,entry.evidence_record_key
     FROM jsonb_to_recordset($2::jsonb) AS entry(
       entity_type text,entity_id_hash char(64),relation_type text,evidence_table text,evidence_record_key text
     ) ON CONFLICT DO NOTHING`,
    [requestId, JSON.stringify(graph.map((entry) => ({
      entity_type: entry.entityType,
      entity_id_hash: entry.entityIdHash,
      relation_type: entry.relationType,
      evidence_table: entry.evidenceTable,
      evidence_record_key: entry.evidenceRecordKey
    })))]
  );
}

function assertEspoMutationsBelongToSubjectGraph(mutations, graph, cryptoBox) {
  const allowed = new Set(graph.map(({ entityType, entityIdHash }) => `${entityType}:${entityIdHash}`));
  for (const mutation of mutations) {
    const entityIdHash = cryptoBox.integrityHash(`espocrm:${mutation.entityType}:${mutation.entityId}`);
    if (!allowed.has(`${mutation.entityType}:${entityIdHash}`)) {
      throw governanceError(
        "PRIVACY_ESPO_SUBJECT_GRAPH_MISMATCH",
        "Espo mutation entity is not linked to the verified DSAR subject graph"
      );
    }
  }
}

async function insertDsarSubjectKeys(client, requestId, keys, relationType) {
  if (!keys.length) return;
  await client.query(
    `INSERT INTO privacy_dsar_subject_keys (request_id,key_type,subject_hash,relation_type)
     SELECT $1,entry.key_type,entry.subject_hash,$3
     FROM jsonb_to_recordset($2::jsonb) AS entry(key_type text,subject_hash char(64))
     ON CONFLICT DO NOTHING`,
    [requestId, JSON.stringify(keys.map(({ keyType, subjectHash }) => ({ key_type: keyType, subject_hash: subjectHash }))), relationType]
  );
}

async function listEspoMutationPlanManifest(client, requestId) {
  const result = await client.query(
    `SELECT id,request_id,entity_type,expected_version,mutation_type,plan_digest,status
     FROM privacy_espo_mutation_plans WHERE request_id=$1 ORDER BY entity_type,id`,
    [requestId]
  );
  return Object.freeze(result.rows.map((row) => Object.freeze({
    planId: row.id,
    requestId: row.request_id,
    entityType: row.entity_type,
    expectedVersion: Number(row.expected_version),
    mutationType: row.mutation_type,
    digest: row.plan_digest,
    status: row.status
  })));
}

async function readVerifiedEspoMutationPlan(client, cryptoBox, planId) {
  const result = await client.query("SELECT * FROM privacy_espo_mutation_plans WHERE id=$1", [planId]);
  const row = result.rows[0];
  if (!row) return undefined;
  const payload = cryptoBox.decryptJson({
    ciphertext: row.payload_ciphertext,
    iv: row.payload_iv,
    tag: row.payload_tag,
    keyVersion: row.key_version
  }, `privacy-espo-plan:${row.id}`);
  const expectedDigest = integrityDigestForVersion(cryptoBox, row.integrity_version, `espo-plan:${canonicalJson(payload)}`);
  const expectedEntityHash = cryptoBox.integrityHash(`espocrm:${payload.entityType}:${payload.entityId}`);
  const graphResult = await client.query(
    `SELECT entity_type,entity_id_hash,relation_type,evidence_table,evidence_record_key
     FROM privacy_dsar_subject_entities WHERE request_id=$1 ORDER BY entity_type,entity_id_hash`,
    [row.request_id]
  );
  const graph = graphResult.rows.map((entry) => ({
    entityType: entry.entity_type,
    entityIdHash: entry.entity_id_hash,
    relationType: entry.relation_type,
    evidenceTable: entry.evidence_table,
    evidenceRecordKey: entry.evidence_record_key
  }));
  const expectedGraphDigest = cryptoBox.integrityHash(canonicalJson(graph.map(subjectGraphDigestItem)));
  const entityLinked = graph.some((entry) => entry.entityType === row.entity_type && entry.entityIdHash === row.entity_id_hash);
  if (expectedDigest !== row.plan_digest || expectedEntityHash !== row.entity_id_hash
      || payload.requestId !== row.request_id || payload.entityType !== row.entity_type
      || Number(payload.expectedVersion) !== Number(row.expected_version)
      || payload.mutationType !== row.mutation_type || payload.subjectGraphDigest !== row.subject_graph_digest
      || expectedGraphDigest !== row.subject_graph_digest || !entityLinked) {
    throw governanceError("PRIVACY_ESPO_PLAN_INTEGRITY_FAILED", "Encrypted Espo mutation plan failed digest or metadata verification");
  }
  return Object.freeze({
    schemaVersion: 1,
    manifest: Object.freeze({
      planId: row.id,
      requestId: row.request_id,
      entityType: row.entity_type,
      expectedVersion: Number(row.expected_version),
      mutationType: row.mutation_type,
      digest: row.plan_digest,
      status: row.status,
      subjectGraphDigest: row.subject_graph_digest,
      integrityVersion: row.integrity_version
    }),
    payload: Object.freeze(payload)
  });
}

async function readVerifiedDsarArtifact(client, cryptoBox, { requestId, artifactId }) {
  const result = await client.query(
    "SELECT * FROM privacy_dsar_artifacts WHERE id=$1 AND request_id=$2",
    [artifactId, requestId]
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const payload = cryptoBox.decryptJson({
    ciphertext: row.payload_ciphertext,
    iv: row.payload_iv,
    tag: row.payload_tag,
    keyVersion: row.key_version
  }, `privacy-dsar-artifact:${row.request_id}:${row.artifact_type}:${row.artifact_digest}`);
  const expectedDigest = integrityDigestForVersion(cryptoBox, row.integrity_version, `dsar-artifact:${canonicalJson(payload)}`);
  if (expectedDigest !== row.artifact_digest || payload.requestId !== row.request_id) {
    throw governanceError("PRIVACY_DSAR_ARTIFACT_INTEGRITY_FAILED", "Encrypted DSAR artifact failed digest or request binding verification");
  }
  return Object.freeze({
    schemaVersion: 1,
    manifest: Object.freeze({
      requestId: row.request_id,
      artifactId: row.id,
      artifactType: row.artifact_type,
      digest: row.artifact_digest,
      counts: Object.freeze(row.counts),
      integrityVersion: row.integrity_version
    }),
    payload: Object.freeze(payload)
  });
}

function target(value) {
  return Object.freeze({
    ...value,
    digest: (row, cryptoBox) => cryptoBox.integrityHash(`privacy-row:${value.tableName}:${canonicalJson(projectRow(row, value.fields))}`)
  });
}

function metadataTarget(dataClass, tableName, candidateSql, fields, tombstone, overrides = {}) {
  return target({
    dataClass,
    tableName,
    action: "metadata_anonymize",
    candidateSql,
    loadSql: overrides.loadSql ?? `SELECT id::text AS privacy_record_key,* FROM ${tableName} WHERE id=$1::uuid FOR UPDATE`,
    fields,
    tombstone
  });
}

async function tombstoneEvent({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "encrypted_event_inbox", row.id);
  const externalId = `privacy-${token}`;
  const encrypted = cryptoBox.encryptJson(tombstonePayload("inbound_event_evidence", token), `${row.source}:${externalId}`);
  await client.query(
    `UPDATE encrypted_event_inbox SET external_id=$2,entity_id=NULL,payload_ciphertext=$3,payload_iv=$4,
       payload_tag=$5,key_version=$6,privacy_tombstoned_at=now(),privacy_plan_id=$7 WHERE id=$1`,
    [row.id, externalId, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, planId]
  );
}

async function tombstoneCopy({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "copy_artifacts", row.id);
  const matchId = `privacy-${token}`;
  const encrypted = cryptoBox.encryptJson(tombstonePayload("generated_copy_evidence", token), `${matchId}:${row.sequence_step}:${token}`);
  await client.query(
    `UPDATE copy_artifacts SET match_id=$2,content_sha256=$3,content_ciphertext=$4,content_iv=$5,
       content_tag=$6,key_version=$7,prompt_version=NULL,confidence=NULL,privacy_tombstoned_at=now(),privacy_plan_id=$8 WHERE id=$1`,
    [row.id, matchId, token, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, planId]
  );
}

async function tombstoneResponse({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "response_queue", row.id);
  const idempotencyKey = `privacy-${token}`;
  const encrypted = cryptoBox.encryptJson(tombstonePayload("automatic_response_evidence", token), `response:${idempotencyKey}`);
  await client.query(
    `UPDATE response_queue SET match_id=$2,release_id=NULL,contact_id=$2,outlet_id=NULL,idempotency_key=$3,
       deterministic_message_id=$4,provider_message_id=NULL,payload_ciphertext=$5,payload_iv=$6,payload_tag=$7,
       key_version=$8,last_error_code='privacy_tombstone',privacy_tombstoned_at=now(),privacy_plan_id=$9 WHERE id=$1`,
    [row.id, `privacy-${token}`, idempotencyKey, `privacy-${token}@invalid.local`, encrypted.ciphertext,
      encrypted.iv, encrypted.tag, encrypted.keyVersion, planId]
  );
}

async function tombstoneHumanReview({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "human_review_items", row.id);
  const sourceEventId = `privacy-${token}`;
  const encrypted = cryptoBox.encryptJson(tombstonePayload("human_review_evidence", token), `human-review:${row.source}:${sourceEventId}:${row.review_type}`);
  await client.query(
    `UPDATE human_review_items SET source_event_id=$2,match_id=NULL,contact_id=NULL,outlet_id=NULL,
       reason='privacy_tombstone',proposed_action=NULL,evidence_ciphertext=$3,evidence_iv=$4,evidence_tag=$5,
       key_version=$6,decision_reason='privacy_tombstone',privacy_tombstoned_at=now(),privacy_plan_id=$7 WHERE id=$1`,
    [row.id, sourceEventId, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, planId]
  );
}

async function tombstoneLegalHoldEvidence({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "privacy_legal_holds", row.id);
  const encrypted = cryptoBox.encryptJson(tombstonePayload("human_review_evidence", token), `privacy-legal-hold:${row.id}`);
  await client.query(
    `UPDATE privacy_legal_holds SET evidence_ciphertext=$2,evidence_iv=$3,evidence_tag=$4,key_version=$5,
       privacy_tombstoned_at=now(),privacy_plan_id=$6 WHERE id=$1`,
    [row.id, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, planId]
  );
}

async function tombstoneDsarRequestEvidence({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "privacy_dsar_requests", row.id);
  const encrypted = cryptoBox.encryptJson(tombstonePayload("human_review_evidence", token), `privacy-dsar-request:${row.id}`);
  await client.query(
    `UPDATE privacy_dsar_requests SET payload_ciphertext=$2,payload_iv=$3,payload_tag=$4,key_version=$5,
       privacy_tombstoned_at=now(),privacy_plan_id=$6,updated_at=now() WHERE id=$1`,
    [row.id, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, planId]
  );
}

async function tombstoneDsarArtifactEvidence({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "privacy_dsar_artifacts", row.id);
  const aad = `privacy-dsar-artifact:${row.request_id}:${row.artifact_type}:${row.artifact_digest}`;
  const encrypted = cryptoBox.encryptJson(tombstonePayload("human_review_evidence", token), aad);
  await client.query(
    `UPDATE privacy_dsar_artifacts SET payload_ciphertext=$2,payload_iv=$3,payload_tag=$4,key_version=$5,
       privacy_tombstoned_at=now(),privacy_plan_id=$6 WHERE id=$1`,
    [row.id, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, planId]
  );
}

async function tombstoneEspoPlanEvidence({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "privacy_espo_mutation_plans", row.id);
  const encrypted = cryptoBox.encryptJson(tombstonePayload("human_review_evidence", token), `privacy-espo-plan:${row.id}`);
  await client.query(
    `UPDATE privacy_espo_mutation_plans SET payload_ciphertext=$2,payload_iv=$3,payload_tag=$4,key_version=$5,
       privacy_tombstoned_at=now(),privacy_plan_id=$6 WHERE id=$1`,
    [row.id, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, planId]
  );
}

async function tombstoneWork({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "work_items", row.id);
  await client.query(
    `UPDATE work_items SET entity_id=$2,dedupe_key=$3,payload='{"privacyTombstone":true}'::jsonb,
       last_error_code='privacy_tombstone',privacy_tombstoned_at=now(),privacy_plan_id=$4 WHERE id=$1`,
    [row.id, `privacy-${token}`, `privacy-${token}`, planId]
  );
}

async function tombstoneSend({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "send_queue", row.id);
  await client.query(
    `UPDATE send_queue SET match_id=$2,release_id=$2,contact_id=$2,recipient_hash=$3,outlet_id=NULL,
       idempotency_key=$4,deterministic_message_id=$5,provider_message_id=NULL,last_error_code='privacy_tombstone',
       privacy_tombstoned_at=now(),privacy_plan_id=$6 WHERE id=$1`,
    [row.id, `privacy-${token}`, token, `privacy-${token}`, `privacy-${token}@invalid.local`, planId]
  );
}

async function tombstoneSendCounter({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "send_counters", row.privacy_record_id);
  await client.query(
    `UPDATE send_counters SET subject_hash=$2,sent_count=0,updated_at=now(),
       privacy_tombstoned_at=now(),privacy_plan_id=$3 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, planId]
  );
}

async function tombstoneCapacityReservation({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "send_capacity_reservations", row.privacy_record_id);
  await client.query(
    `UPDATE send_capacity_reservations SET global_hash=$2,release_hash=$2,domain_hash=$2,
       privacy_tombstoned_at=now(),privacy_plan_id=$3 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, planId]
  );
}

async function tombstoneOutletGuard({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "outlet_first_send_guards", row.privacy_record_id);
  await client.query(
    `UPDATE outlet_first_send_guards SET outlet_hash=$2,match_id=$3,updated_at=now(),
       privacy_tombstoned_at=now(),privacy_plan_id=$4 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, `privacy-${token}`, planId]
  );
}

async function tombstoneAllocation({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "sequence_allocations", row.privacy_record_id);
  await client.query(
    `UPDATE sequence_allocations SET recipient_hash=$2,match_id=$3,release_id=$3,contact_id=$3,outlet_id=NULL,
       release_reason='privacy_tombstone',privacy_tombstoned_at=now(),privacy_plan_id=$4 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, `privacy-${token}`, planId]
  );
}

async function tombstoneCampaignOutletCounter({ client, row, planId }) {
  // The pair-level aggregate is deliberately retained at the deny-wins ceiling.
  // Dropping or lowering it would silently reopen lifetime allocation capacity.
  await client.query(
    `UPDATE campaign_outlet_allocation_counters SET allocated_count=2,updated_at=now(),
       privacy_tombstoned_at=now(),privacy_plan_id=$2 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, planId]
  );
}

async function tombstoneCampaignOutletLedger({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "campaign_outlet_allocation_ledger", row.privacy_record_id);
  // Preserve the safety invariant before severing every person-linkable ledger identity.
  await client.query(
    `INSERT INTO campaign_outlet_allocation_counters
       (release_hash,outlet_hash,allocated_count,privacy_record_id,created_at,updated_at)
     VALUES ($1,$2,2,gen_random_uuid(),now(),now())
     ON CONFLICT (release_hash,outlet_hash) DO UPDATE SET
       allocated_count=2,updated_at=now()`,
    [row.release_hash, row.outlet_hash]
  );
  await client.query(
    `UPDATE campaign_outlet_allocation_ledger SET allocation_hash=$2,release_hash=$2,outlet_hash=$2,
       contact_hash=$2,outlet_subject_hash=$2,recipient_hash=$2,
       privacy_tombstoned_at=now(),privacy_plan_id=$3 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, planId]
  );
}

async function tombstoneDeliveryAttempt({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "delivery_attempts", row.id);
  await client.query(
    `UPDATE delivery_attempts SET provider_message_id=NULL,error_code='privacy_tombstone',correlation_id=$2,
       privacy_tombstoned_at=now(),privacy_plan_id=$3 WHERE id=$1`,
    [row.id, `privacy-${token}`, planId]
  );
}

async function tombstoneResponseAttempt({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "response_delivery_attempts", row.id);
  await client.query(
    `UPDATE response_delivery_attempts SET provider_message_id=NULL,error_code='privacy_tombstone',correlation_id=$2,
       privacy_tombstoned_at=now(),privacy_plan_id=$3 WHERE id=$1`,
    [row.id, `privacy-${token}`, planId]
  );
}

async function tombstoneOutcome({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "outcome_events", row.id);
  await client.query(
    `UPDATE outcome_events SET match_id=NULL,provider_event_id=$2,privacy_tombstoned_at=now(),privacy_plan_id=$3 WHERE id=$1`,
    [row.id, `privacy-${token}`, planId]
  );
}

async function tombstoneCrmDeliveryProjection({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "crm_delivery_projections", row.send_queue_id);
  const value = `privacy-${token}`;
  await client.query(
    `UPDATE crm_delivery_projections SET match_id=$2,release_id=$2,contact_id=$2,outlet_id=NULL,
       provider_message_id=$2,deterministic_message_id=$3,correlation_id=$2,campaign_projection_key=$4,
       email_projection_key=$5,event_projection_key=$6,last_error_code='privacy_tombstone',campaign_id=NULL,
       email_id=NULL,event_id=NULL,privacy_tombstoned_at=now(),privacy_plan_id=$7
     WHERE send_queue_id=$1`,
    [row.send_queue_id, value, `${value}@invalid.local`, `privacy-campaign-${token}`,
      `privacy-email-${token}`, `privacy-event-${token}`, planId]
  );
}

async function tombstoneContactGenreDenial({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "contact_genre_denials", row.privacy_record_id);
  await client.query(
    `UPDATE contact_genre_denials SET contact_id=$2,source_event_id=$2,match_id=$2,release_id=$2,
       privacy_tombstoned_at=now(),privacy_plan_id=$3 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, `privacy-${token}`, planId]
  );
}

async function tombstoneSourceReceipt({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "source_ingestion_receipts", row.privacy_record_id);
  await client.query(
    `UPDATE source_ingestion_receipts SET content_digest=$2,result='{"privacyTombstone":true}'::jsonb,
       last_error_code='privacy_tombstone',updated_at=now(),privacy_tombstoned_at=now(),privacy_plan_id=$3
     WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, planId]
  );
}

async function tombstoneSourceLink({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "source_ingestion_record_links", row.privacy_record_id);
  await client.query(
    `UPDATE source_ingestion_record_links SET external_id=$2,crm_entity_id=$3,evidence_digest=$4,
       privacy_tombstoned_at=now(),privacy_plan_id=$5 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, `privacy-${token}`, token.slice(0, 24), token, planId]
  );
}

async function tombstoneSourceIdentityBinding({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "source_identity_bindings", row.privacy_record_id);
  await client.query(
    `UPDATE source_identity_bindings SET identity_hash=$2,crm_entity_id=$3,source_id=$4,external_id=$5,
       evidence_verified=false,privacy_tombstoned_at=now(),privacy_plan_id=$6
     WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, token.slice(0, 24), token.slice(0, 64), `privacy-${token}`, planId]
  );
}

async function tombstoneSourceIdentityClaimItem({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "source_identity_claim_items", row.privacy_record_id);
  await client.query(
    `UPDATE source_identity_claim_items SET identity_hash=$2,privacy_tombstoned_at=now(),privacy_plan_id=$3
     WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, planId]
  );
}

async function tombstoneSourceIdentityClaim({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "source_identity_claims", row.id);
  await client.query(
    `UPDATE source_identity_claims SET claim_owner=$2,locked_until=now(),privacy_tombstoned_at=now(),privacy_plan_id=$3
     WHERE id=$1`,
    [row.id, token.slice(0, 64), planId]
  );
}

async function tombstoneCrmIntakeReceipt({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "crm_intake_receipts", row.privacy_record_id);
  await client.query(
    `UPDATE crm_intake_receipts SET entity_id=$2,revision_digest=$3,status='completed',
       result='{"privacyTombstone":true}'::jsonb,last_error_code='privacy_tombstone',
       lease_owner=NULL,locked_until=NULL,completed_at=COALESCE(completed_at,now()),updated_at=now(),
       privacy_tombstoned_at=now(),privacy_plan_id=$4 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token.slice(0, 24), token, planId]
  );
}

async function tombstonePurposeBoundEvidence({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "purpose_bound_evidence_attestations", row.privacy_record_id);
  await client.query(
    `UPDATE purpose_bound_evidence_attestations SET entity_id=$2::varchar(24),entity_version=0,
       evidence_digest=$3::char(64),evidence_captured_at=now(),purpose='privacy_tombstone',basis='privacy_tombstone',
       origin_revision_digest=$3::char(64),
       origin_entity_id=CASE WHEN origin_entity_id IS NULL THEN NULL ELSE $2::varchar(24) END,
       origin_source_id=CASE WHEN origin_source_id IS NULL THEN NULL ELSE $3::varchar(64) END,
       origin_artifact_id=CASE WHEN origin_artifact_id IS NULL THEN NULL ELSE $4::varchar(180) END,
       status='revoked',revocation_reason='privacy_tombstone',updated_at=now(),
       privacy_tombstoned_at=now(),privacy_plan_id=$5 WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token.slice(0, 24), token, `privacy-${token}`, planId]
  );
}

async function tombstoneEmailValidation({ client, row, planId, cryptoBox }) {
  const token = tombstoneToken(cryptoBox, "email_validation_cache", row.privacy_record_id);
  await client.query(
    `UPDATE email_validation_cache SET recipient_hash=$2,status='Unknown',provider_reference='privacy-tombstone',
       checked_at=now(),expires_at=now(),updated_at=now(),privacy_tombstoned_at=now(),privacy_plan_id=$3
     WHERE privacy_record_id=$1`,
    [row.privacy_record_id, token, planId]
  );
}

function privacyIndex({ name, tableName, columns, predicate, unique = false }) {
  for (const identifier of [name, tableName, ...columns]) assertCompiledSqlIdentifier(identifier);
  const quotedColumns = columns.map((column) => `"${column}"`).join(",");
  const where = predicate ? ` WHERE ${predicate}` : "";
  return Object.freeze({
    name,
    tableName,
    columns: Object.freeze([...columns]),
    predicate: predicate ?? null,
    unique,
    createSql: `CREATE ${unique ? "UNIQUE " : ""}INDEX CONCURRENTLY "${name}" ON "public"."${tableName}" (${quotedColumns})${where}`,
    dropSql: `DROP INDEX CONCURRENTLY IF EXISTS "public"."${name}"`
  });
}

function privacyConstraint(tableName, name) {
  assertCompiledSqlIdentifier(tableName);
  assertCompiledSqlIdentifier(name);
  return Object.freeze({
    tableName,
    name,
    localColumns: Object.freeze(["privacy_plan_id"]),
    referencedTable: "privacy_governance_plans",
    referencedColumns: Object.freeze(["id"]),
    deleteAction: "r",
    validateSql: `ALTER TABLE "public"."${tableName}" VALIDATE CONSTRAINT "${name}"`
  });
}

function constraintDefinitionMatches(definition, row) {
  return row.table_name === definition.tableName
    && row.contype === "f"
    && row.referenced_table === definition.referencedTable
    && row.confdeltype === definition.deleteAction
    && JSON.stringify(normalizeIndexColumns(row.local_columns)) === JSON.stringify(definition.localColumns)
    && JSON.stringify(normalizeIndexColumns(row.referenced_columns)) === JSON.stringify(definition.referencedColumns);
}

function privacyRecordIdContract(tableName, checkName) {
  assertCompiledSqlIdentifier(tableName);
  assertCompiledSqlIdentifier(checkName);
  return Object.freeze({
    tableName,
    checkName,
    setDefaultSql: `ALTER TABLE "public"."${tableName}" ALTER COLUMN "privacy_record_id" SET DEFAULT gen_random_uuid()`,
    nullProbeSql: `SELECT 1 FROM "public"."${tableName}" WHERE "privacy_record_id" IS NULL LIMIT 1`,
    addCheckSql: `ALTER TABLE "public"."${tableName}" ADD CONSTRAINT "${checkName}" CHECK ("privacy_record_id" IS NOT NULL) NOT VALID`,
    validateCheckSql: `ALTER TABLE "public"."${tableName}" VALIDATE CONSTRAINT "${checkName}"`,
    setNotNullSql: `ALTER TABLE "public"."${tableName}" ALTER COLUMN "privacy_record_id" SET NOT NULL`,
    dropCheckSql: `ALTER TABLE "public"."${tableName}" DROP CONSTRAINT "${checkName}"`
  });
}

function assertCompiledSqlIdentifier(value) {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(value)) throw new TypeError("Compiled privacy SQL identifier is invalid");
}

function indexDefinitionMatches(definition, row) {
  return row.table_name === definition.tableName
    && row.indisunique === definition.unique
    && row.access_method === "btree"
    && JSON.stringify(normalizeIndexColumns(row.key_columns)) === JSON.stringify(definition.columns)
    && normalizeIndexPredicate(row.predicate) === normalizeIndexPredicate(definition.predicate);
}

function normalizeIndexColumns(value) {
  if (Array.isArray(value)) return value;
  const encoded = String(value ?? "");
  if (encoded === "{}" || encoded === "") return [];
  if (encoded.startsWith("{") && encoded.endsWith("}")) {
    return encoded.slice(1, -1).split(",").map((column) => column.replace(/^"|"$/gu, ""));
  }
  return [encoded];
}

function normalizeIndexPredicate(value) {
  return String(value ?? "").toLowerCase().replace(/::(?:text|character varying)/gu, "").replace(/[\s"()]+/gu, "");
}

async function inspectSinglePrivacyIndex(client, definition) {
  const result = await client.query(
    `SELECT table_relation.relname AS table_name,
            index_metadata.indisvalid,
            index_metadata.indisready,
            index_metadata.indisunique,
            access_method.amname AS access_method,
            ARRAY(
              SELECT attribute.attname
              FROM unnest(index_metadata.indkey::smallint[]) WITH ORDINALITY AS key(attnum,ordinality)
              JOIN pg_attribute attribute
                ON attribute.attrelid=index_metadata.indrelid AND attribute.attnum=key.attnum
              WHERE key.ordinality<=index_metadata.indnkeyatts
              ORDER BY key.ordinality
            ) AS key_columns,
            pg_get_expr(index_metadata.indpred,index_metadata.indrelid) AS predicate
     FROM pg_class index_relation
     JOIN pg_namespace namespace ON namespace.oid=index_relation.relnamespace
     JOIN pg_index index_metadata ON index_metadata.indexrelid=index_relation.oid
     JOIN pg_class table_relation ON table_relation.oid=index_metadata.indrelid
     JOIN pg_am access_method ON access_method.oid=index_relation.relam
     WHERE namespace.nspname='public' AND index_relation.relname=$1`,
    [definition.name]
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return Object.freeze({
    valid: row.indisvalid === true,
    ready: row.indisready === true,
    status: indexDefinitionMatches(definition, row) ? "valid" : "definition_mismatch"
  });
}

async function inspectSinglePrivacyConstraint(client, definition) {
  const result = await client.query(
    `SELECT table_relation.relname AS table_name,constraint_name.convalidated,constraint_name.contype,
            referenced_relation.relname AS referenced_table,constraint_name.confdeltype,
            ARRAY(
              SELECT attribute.attname FROM unnest(constraint_name.conkey) WITH ORDINALITY AS key(attnum,ordinality)
              JOIN pg_attribute attribute ON attribute.attrelid=constraint_name.conrelid AND attribute.attnum=key.attnum
              ORDER BY key.ordinality
            ) AS local_columns,
            ARRAY(
              SELECT attribute.attname FROM unnest(constraint_name.confkey) WITH ORDINALITY AS key(attnum,ordinality)
              JOIN pg_attribute attribute ON attribute.attrelid=constraint_name.confrelid AND attribute.attnum=key.attnum
              ORDER BY key.ordinality
            ) AS referenced_columns
     FROM pg_constraint constraint_name
     JOIN pg_class table_relation ON table_relation.oid=constraint_name.conrelid
     LEFT JOIN pg_class referenced_relation ON referenced_relation.oid=constraint_name.confrelid
     JOIN pg_namespace namespace ON namespace.oid=table_relation.relnamespace
     WHERE namespace.nspname='public' AND constraint_name.conname=$1`,
    [definition.name]
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return Object.freeze({
    tableName: row.table_name,
    validated: row.convalidated === true,
    compatible: constraintDefinitionMatches(definition, row)
  });
}

async function inspectRecordIdContract(client, definition) {
  const result = await client.query(
    `SELECT attribute.attnotnull,
            pg_get_expr(attribute_default.adbin,attribute_default.adrelid) AS column_default,
            check_constraint.oid IS NOT NULL AS check_exists,
            check_constraint.convalidated AS check_validated,
            pg_get_constraintdef(check_constraint.oid) AS check_definition
     FROM pg_class table_relation
     JOIN pg_namespace namespace ON namespace.oid=table_relation.relnamespace
     JOIN pg_attribute attribute
       ON attribute.attrelid=table_relation.oid AND attribute.attname='privacy_record_id' AND NOT attribute.attisdropped
     LEFT JOIN pg_attrdef attribute_default
       ON attribute_default.adrelid=attribute.attrelid AND attribute_default.adnum=attribute.attnum
     LEFT JOIN pg_constraint check_constraint
       ON check_constraint.conrelid=table_relation.oid AND check_constraint.conname=$2
     WHERE namespace.nspname='public' AND table_relation.relname=$1`,
    [definition.tableName, definition.checkName]
  );
  const row = result.rows[0];
  if (!row) throw governanceError("PRIVACY_RECORD_ID_COLUMN_MISSING", `privacy_record_id is missing on ${definition.tableName}`);
  return Object.freeze({
    notNull: row.attnotnull === true,
    defaultExpression: row.column_default ?? null,
    checkExists: row.check_exists === true,
    checkValidated: row.check_validated === true,
    checkCompatible: !row.check_exists || recordIdCheckMatches(row.check_definition)
  });
}

function recordIdCheckMatches(value) {
  return normalizeIndexPredicate(value).replace(/^check/u, "") === "privacy_record_idisnotnull";
}

function normalizeDefaultExpression(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s"]/gu, "")
    .replace(/^public\./u, "");
}

async function appendAudit(client, limits, event) {
  const details = event.details ?? {};
  await client.query(
    `SELECT * FROM append_privacy_audit_event(
       $1::text,$2::text,$3::text,$4::text,$5::char(64),$6::text,$7::text,$8::text,$9::jsonb
     )`,
    [event.eventType, event.aggregateType, event.aggregateId, event.actorId, event.planDigest ?? null,
      event.approvalId ?? null, event.changeId ?? null, event.recoveryId ?? null,
      JSON.stringify(details)]
  );
}

async function assertLease(client, lease) {
  const result = await client.query(
    `SELECT 1 FROM privacy_execution_leases
     WHERE lease_name=$1 AND owner_id=$2 AND fence_token=$3 AND plan_id=$4 AND locked_until>now() FOR UPDATE`,
    [lease.leaseName, lease.ownerId, lease.fenceToken, lease.planId]
  );
  if (!result.rowCount) throw governanceError("PRIVACY_EXECUTION_LEASE_LOST", "Privacy execution lease is missing, expired, or fenced", true);
}

async function renewLease(client, lease, leaseSeconds) {
  const result = await client.query(
    `UPDATE privacy_execution_leases SET locked_until=now()+make_interval(secs => $5),updated_at=now()
     WHERE lease_name=$1 AND owner_id=$2 AND fence_token=$3 AND plan_id=$4 AND locked_until>now()`,
    [lease.leaseName, lease.ownerId, lease.fenceToken, lease.planId, leaseSeconds]
  );
  if (!result.rowCount) throw governanceError("PRIVACY_EXECUTION_LEASE_LOST", "Privacy execution lease could not be renewed", true);
}

async function releaseLease(client, lease) {
  await client.query(
    `UPDATE privacy_execution_leases SET owner_id=NULL,plan_id=NULL,locked_until=NULL,updated_at=now()
     WHERE lease_name=$1 AND owner_id=$2 AND fence_token=$3 AND plan_id=$4`,
    [lease.leaseName, lease.ownerId, lease.fenceToken, lease.planId]
  );
}

function recordMatchesLegalHold(holds, dataClass, subjectKeys) {
  const recordKeys = new Set(subjectKeys.map(({ keyType, subjectHash }) => `${keyType}:${subjectHash}`));
  return holds.some((hold) => (hold.scopeDataClass === "*" || hold.scopeDataClass === dataClass)
    && (hold.subjectType === "global" || hold.subjectKeys.some((key) => recordKeys.has(key))));
}

function targetRecordKey(target, row, cryptoBox) {
  return target.recordKey ? target.recordKey(row, cryptoBox) : String(row.privacy_record_key);
}

async function persistRecordSubjectKeys(client, target, rows, cryptoBox) {
  const byRecord = new Map();
  const entityRecords = new Map();
  const ensure = (recordKey) => {
    if (!byRecord.has(recordKey)) byRecord.set(recordKey, new Map());
    return byRecord.get(recordKey);
  };
  const addHash = (recordKey, keyType, subjectHash) => {
    const hash = String(subjectHash ?? "");
    if (/^[0-9a-f]{64}$/u.test(hash)) ensure(recordKey).set(`${keyType}:${hash}`, Object.freeze({ keyType, subjectHash: hash }));
  };
  const addEntityReference = (recordKey, entityType, entityId) => {
    const id = String(entityId ?? "").trim();
    if (!id) return;
    if (new Set(["MediaContact", "contact"]).has(entityType)) {
      addHash(recordKey, "canonical", cryptoBox.subjectHash(`contact:${id}`));
    } else if (new Set(["MediaOutlet", "outlet"]).has(entityType)) {
      addHash(recordKey, "canonical", cryptoBox.subjectHash(`outlet:${id}`));
    } else return;
    const entityKey = `${entityType === "MediaContact" || entityType === "contact" ? "MediaContact" : "MediaOutlet"}:${id}`;
    if (!entityRecords.has(entityKey)) entityRecords.set(entityKey, new Set());
    entityRecords.get(entityKey).add(recordKey);
  };
  const addLinked = (recordKey, linked) => {
    addEntityReference(recordKey, "contact", linked.contact_id);
    addEntityReference(recordKey, "outlet", linked.outlet_id);
    addEntityReference(recordKey, linked.entity_type, linked.entity_id ?? linked.crm_entity_id);
    if (linked.recipient_hash) addHash(recordKey, "canonical", linked.recipient_hash);
    if (linked.identity_hash) addHash(recordKey, "source_identity", linked.identity_hash);
    if (linked.contact_hash) addHash(recordKey, "canonical", linked.contact_hash);
    if (linked.outlet_hash) addHash(recordKey, "canonical", linked.outlet_hash);
    if (linked.outlet_subject_hash) addHash(recordKey, "canonical", linked.outlet_subject_hash);
    if (linked.key_type && linked.subject_hash) addHash(recordKey, linked.key_type, linked.subject_hash);
  };

  for (const row of rows) {
    const recordKey = targetRecordKey(target, row, cryptoBox);
    ensure(recordKey);
    addLinked(recordKey, row);
    if (target.tableName === "encrypted_event_inbox" || target.tableName === "work_items") {
      addEntityReference(recordKey, row.entity_type, row.entity_id);
    }
    if (target.tableName === "email_validation_cache") {
      ensure(recordKey).delete(`canonical:${row.recipient_hash}`);
      addHash(recordKey, "email_validation", row.recipient_hash);
    }
    if (target.tableName === "source_identity_bindings" || target.tableName === "source_identity_claim_items") {
      addHash(recordKey, "source_identity", row.identity_hash);
    }
    if (target.tableName === "purpose_bound_evidence_attestations" && row.origin_entity_id) {
      addEntityReference(recordKey, row.entity_type, row.origin_entity_id);
    }
  }

  const linkedRows = await loadBatchSubjectRelations(client, target, rows);
  for (const linked of linkedRows) addLinked(String(linked.record_key), linked);

  if (entityRecords.size) {
    const contactIds = [];
    const outletIds = [];
    for (const entityKey of entityRecords.keys()) {
      const separator = entityKey.indexOf(":");
      const type = entityKey.slice(0, separator);
      const id = entityKey.slice(separator + 1);
      (type === "MediaContact" ? contactIds : outletIds).push(id);
    }
    const bindings = await client.query(
      `SELECT entity_type,crm_entity_id,identity_hash FROM source_identity_bindings
       WHERE (entity_type='MediaContact' AND crm_entity_id=ANY($1::text[]))
          OR (entity_type='MediaOutlet' AND crm_entity_id=ANY($2::text[]))`,
      [contactIds, outletIds]
    );
    for (const binding of bindings.rows) {
      for (const recordKey of entityRecords.get(`${binding.entity_type}:${binding.crm_entity_id}`) ?? []) {
        addHash(recordKey, "source_identity", binding.identity_hash);
      }
    }
  }

  const keyRows = [];
  const stateRows = [];
  for (const [recordKey, values] of byRecord) {
    const keys = [...values.values()].sort((left, right) => left.keyType.localeCompare(right.keyType)
      || left.subjectHash.localeCompare(right.subjectHash));
    for (const key of keys) {
      keyRows.push({
        data_class: target.dataClass,
        table_name: target.tableName,
        record_key: recordKey,
        key_type: key.keyType,
        subject_hash: key.subjectHash
      });
    }
    stateRows.push({
      data_class: target.dataClass,
      table_name: target.tableName,
      record_key: recordKey,
      linkage_digest: cryptoBox.integrityHash(canonicalJson(keys))
    });
  }
  for (const batch of chunk(keyRows, 1_000)) {
    await client.query(
      `INSERT INTO privacy_record_subject_keys (data_class,table_name,record_key,key_type,subject_hash)
       SELECT item.data_class,item.table_name,item.record_key,item.key_type,item.subject_hash
       FROM jsonb_to_recordset($1::jsonb) AS item(
         data_class text,table_name text,record_key text,key_type text,subject_hash char(64)
       ) ON CONFLICT DO NOTHING`,
      [JSON.stringify(batch)]
    );
  }
  const recordKeys = [...byRecord.keys()];
  const authoritative = new Map(recordKeys.map((recordKey) => [recordKey, []]));
  if (recordKeys.length) {
    const persisted = await client.query(
      `SELECT record_key,key_type,subject_hash FROM privacy_record_subject_keys
       WHERE data_class=$1 AND table_name=$2 AND record_key=ANY($3::text[])
       ORDER BY record_key,key_type,subject_hash`,
      [target.dataClass, target.tableName, recordKeys]
    );
    for (const row of persisted.rows) {
      authoritative.get(row.record_key)?.push({ keyType: row.key_type, subjectHash: row.subject_hash });
    }
  }
  stateRows.length = 0;
  for (const [recordKey, keys] of authoritative) {
    stateRows.push({
      data_class: target.dataClass,
      table_name: target.tableName,
      record_key: recordKey,
      linkage_digest: cryptoBox.integrityHash(canonicalJson(keys))
    });
  }
  for (const batch of chunk(stateRows, 1_000)) {
    await client.query(
      `INSERT INTO privacy_record_subject_state
        (data_class,table_name,record_key,linkage_digest,integrity_version)
       SELECT item.data_class,item.table_name,item.record_key,item.linkage_digest,$2
       FROM jsonb_to_recordset($1::jsonb) AS item(
         data_class text,table_name text,record_key text,linkage_digest char(64)
       ) ON CONFLICT (data_class,table_name,record_key) DO UPDATE SET
         linkage_digest=EXCLUDED.linkage_digest,integrity_version=EXCLUDED.integrity_version,linked_at=now()`,
      [JSON.stringify(batch), INTEGRITY_VERSION]
    );
  }
  return new Map([...authoritative].map(([recordKey, keys]) => [recordKey, Object.freeze(keys)]));
}

async function loadBatchSubjectRelations(client, target, rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id ?? row.privacy_record_id ?? row.send_queue_id).filter(Boolean);
  const byTable = {
    copy_artifacts: `SELECT queue.copy_artifact_id::text AS record_key,queue.contact_id,queue.outlet_id,queue.recipient_hash
      FROM send_queue queue WHERE queue.copy_artifact_id=ANY($1::uuid[])`,
    delivery_attempts: `SELECT attempt.id::text AS record_key,queue.contact_id,queue.outlet_id,queue.recipient_hash
      FROM delivery_attempts attempt JOIN send_queue queue ON queue.id=attempt.send_queue_id
      WHERE attempt.id=ANY($1::uuid[])`,
    response_delivery_attempts: `SELECT attempt.id::text AS record_key,queue.contact_id,queue.outlet_id
      FROM response_delivery_attempts attempt JOIN response_queue queue ON queue.id=attempt.response_queue_id
      WHERE attempt.id=ANY($1::uuid[])`,
    outcome_events: `SELECT outcome.id::text AS record_key,queue.contact_id,queue.outlet_id,queue.recipient_hash
      FROM outcome_events outcome JOIN send_queue queue ON queue.id=outcome.send_queue_id
      WHERE outcome.id=ANY($1::uuid[])`,
    source_identity_claim_items: `SELECT item.privacy_record_id::text AS record_key,binding.entity_type,binding.crm_entity_id,
             item.identity_hash
      FROM source_identity_claim_items item LEFT JOIN source_identity_bindings binding
        ON binding.entity_type=item.entity_type AND binding.identity_type=item.identity_type
       AND binding.identity_hash=item.identity_hash
      WHERE item.privacy_record_id=ANY($1::uuid[])`,
    source_identity_claims: `SELECT claim.id::text AS record_key,binding.entity_type,binding.crm_entity_id,item.identity_hash
      FROM source_identity_claims claim JOIN source_identity_claim_items item ON item.claim_id=claim.id
      LEFT JOIN source_identity_bindings binding ON binding.entity_type=item.entity_type
       AND binding.identity_type=item.identity_type AND binding.identity_hash=item.identity_hash
      WHERE claim.id=ANY($1::uuid[])`,
    encrypted_event_inbox: `SELECT event.id::text AS record_key,queue.contact_id,queue.outlet_id,queue.recipient_hash
      FROM encrypted_event_inbox event JOIN outcome_events outcome ON outcome.provider_event_id=event.external_id
      JOIN send_queue queue ON queue.id=outcome.send_queue_id WHERE event.id=ANY($1::uuid[])
      UNION ALL
      SELECT event.id::text AS record_key,review.contact_id,review.outlet_id,NULL::text AS recipient_hash
      FROM encrypted_event_inbox event JOIN human_review_items review
        ON review.source=event.source AND review.source_event_id=event.external_id
      WHERE event.id=ANY($1::uuid[])`,
    send_capacity_reservations: `SELECT reservation.privacy_record_id::text AS record_key,queue.contact_id,queue.outlet_id,queue.recipient_hash
      FROM send_capacity_reservations reservation JOIN send_queue queue ON queue.id=reservation.send_queue_id
      WHERE reservation.privacy_record_id=ANY($1::uuid[])`,
    source_ingestion_receipts: `SELECT receipt.privacy_record_id::text AS record_key,link.entity_type,link.crm_entity_id
      FROM source_ingestion_receipts receipt JOIN source_ingestion_record_links link
        ON link.source_id=receipt.source_id AND link.artifact_id=receipt.artifact_id
      WHERE receipt.privacy_record_id=ANY($1::uuid[])`,
    privacy_legal_holds: `SELECT hold.id::text AS record_key,subject.key_type,subject.subject_hash
      FROM privacy_legal_holds hold JOIN privacy_legal_hold_subject_keys subject ON subject.hold_id=hold.id
      WHERE hold.id=ANY($1::uuid[])`,
    privacy_dsar_requests: `SELECT request.id::text AS record_key,subject.key_type,subject.subject_hash
      FROM privacy_dsar_requests request JOIN privacy_dsar_subject_keys subject ON subject.request_id=request.id
      WHERE request.id=ANY($1::uuid[])`,
    privacy_dsar_artifacts: `SELECT artifact.id::text AS record_key,subject.key_type,subject.subject_hash
      FROM privacy_dsar_artifacts artifact JOIN privacy_dsar_subject_keys subject ON subject.request_id=artifact.request_id
      WHERE artifact.id=ANY($1::uuid[])`,
    privacy_espo_mutation_plans: `SELECT plan.id::text AS record_key,subject.key_type,subject.subject_hash
      FROM privacy_espo_mutation_plans plan JOIN privacy_dsar_subject_keys subject ON subject.request_id=plan.request_id
      WHERE plan.id=ANY($1::uuid[])`
  };
  if (target.tableName === "send_counters") {
    const keys = rows.map((row) => `${row.counter_date.toISOString?.().slice(0, 10) ?? row.counter_date}:${row.counter_type}:${row.subject_hash}`);
    return (await client.query(
      `SELECT counter.privacy_record_id::text AS record_key,queue.contact_id,queue.outlet_id,queue.recipient_hash
       FROM send_counters counter JOIN send_capacity_reservations reservation
         ON reservation.counter_date=counter.counter_date AND (
           (counter.counter_type='global' AND reservation.global_hash=counter.subject_hash) OR
           (counter.counter_type='release' AND reservation.release_hash=counter.subject_hash) OR
           (counter.counter_type='domain' AND reservation.domain_hash=counter.subject_hash)
         )
       JOIN send_queue queue ON queue.id=reservation.send_queue_id
       WHERE (counter.counter_date::text||':'||counter.counter_type||':'||counter.subject_hash)=ANY($1::text[])`,
      [keys]
    )).rows;
  }
  const sql = byTable[target.tableName];
  if (!sql || !ids.length) return [];
  return (await client.query(sql, [ids])).rows;
}

async function durableRecordSubjectKeys(client, item, cryptoBox) {
  const state = await client.query(
    `SELECT linkage_digest,integrity_version FROM privacy_record_subject_state
     WHERE data_class=$1 AND table_name=$2 AND record_key=$3`,
    [item.data_class, item.table_name, item.record_key]
  );
  if (!state.rowCount || state.rows[0].integrity_version !== INTEGRITY_VERSION) {
    throw governanceError("PRIVACY_SUBJECT_LINK_MISSING", "Approved record has no complete durable subject linkage", true);
  }
  const keys = await client.query(
    `SELECT key_type,subject_hash FROM privacy_record_subject_keys
     WHERE data_class=$1 AND table_name=$2 AND record_key=$3 ORDER BY key_type,subject_hash`,
    [item.data_class, item.table_name, item.record_key]
  );
  const values = keys.rows.map((row) => Object.freeze({ keyType: row.key_type, subjectHash: row.subject_hash }));
  const digest = cryptoBox.integrityHash(canonicalJson(values));
  if (digest !== state.rows[0].linkage_digest) {
    throw governanceError("PRIVACY_SUBJECT_LINK_INTEGRITY_FAILED", "Durable subject linkage failed its integrity contract");
  }
  return Object.freeze(values);
}

function targetFor(tableName, dataClass) {
  const found = TARGETS.find((target) => target.tableName === tableName && target.dataClass === dataClass);
  if (!found) throw governanceError("PRIVACY_PLAN_TARGET_INVALID", "Privacy plan contains a target outside the compiled allowlist");
  return found;
}

function planCounts(items) {
  const byDataClass = {};
  let planned = 0;
  let held = 0;
  for (const item of items) {
    byDataClass[item.dataClass] ??= { total: 0, planned: 0, held: 0 };
    byDataClass[item.dataClass].total += 1;
    byDataClass[item.dataClass][item.status] += 1;
    if (item.status === "held") held += 1;
    else planned += 1;
  }
  return Object.freeze({ total: items.length, planned, held, byDataClass });
}

function planDigestItem(item) {
  return {
    ordinal: item.ordinal,
    dataClass: item.dataClass,
    tableName: item.tableName,
    recordKey: item.recordKey,
    observedDigest: item.observedDigest,
    observedDigestVersion: item.observedDigestVersion,
    cutoffAt: item.cutoffAt,
    action: item.action,
    status: item.status
  };
}

function planTargetContractItem(item) {
  return {
    ordinal: Number(item.ordinal),
    dataClass: item.dataClass ?? item.data_class,
    tableName: item.tableName ?? item.table_name,
    recordKey: item.recordKey ?? item.record_key,
    observedDigest: item.observedDigest ?? item.observed_digest,
    observedDigestVersion: item.observedDigestVersion ?? item.observed_digest_version,
    cutoffAt: normalizeValue(item.cutoffAt ?? item.cutoff_at),
    action: item.action
  };
}

function projectRow(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, normalizeValue(row[field])]));
}

function normalizeValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") return JSON.parse(canonicalJson(value));
  return value;
}

function integrityDigestForVersion(cryptoBox, version, value) {
  if (version === INTEGRITY_VERSION) return cryptoBox.integrityHash(value);
  if (version === "normalized-hmac-v0") return cryptoBox.privacyHash(value);
  throw governanceError("PRIVACY_INTEGRITY_VERSION_UNSUPPORTED", "Encrypted privacy record uses an unsupported integrity version");
}

function tombstoneToken(cryptoBox, tableName, recordId) {
  return cryptoBox.integrityHash(`privacy-tombstone:${tableName}:${recordId}`);
}

function tombstonePayload(dataClass, token) {
  return Object.freeze({ privacyTombstone: true, schemaVersion: 1, dataClass, recordToken: token });
}

function validDate(value, name) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw governanceError("PRIVACY_DATE_INVALID", `${name} must be a valid date`);
  return date;
}

function assertScope(value) {
  if (value !== "*" && !DATA_CLASS_SET.has(value)) {
    throw governanceError("PRIVACY_LEGAL_HOLD_SCOPE_INVALID", "Legal-hold data-class scope is invalid");
  }
}

function normalizeLegalHoldSubjectKeys(subjectHash, values) {
  return normalizeSubjectLookupKeys(subjectHash, values);
}

function normalizeSubjectLookupKeys(subjectHash, values) {
  const allowedTypes = new Set(["canonical", "email_validation", "source_identity"]);
  const keys = Array.isArray(values) ? values : [{ keyType: "canonical", subjectHash }];
  const unique = new Map();
  for (const value of keys) {
    const keyType = String(value?.keyType ?? "");
    const hash = String(value?.subjectHash ?? "");
    if (!allowedTypes.has(keyType) || !/^[0-9a-f]{64}$/u.test(hash)) {
      throw governanceError("PRIVACY_LEGAL_HOLD_SUBJECT_KEY_INVALID", "Legal-hold subject lookup key is invalid");
    }
    unique.set(`${keyType}:${hash}`, Object.freeze({ keyType, subjectHash: hash }));
  }
  if (![...unique.values()].some(({ keyType, subjectHash: hash }) => keyType === "canonical" && hash === subjectHash)) {
    throw governanceError("PRIVACY_LEGAL_HOLD_SUBJECT_KEY_INVALID", "Legal-hold canonical subject key is missing");
  }
  return Object.freeze([...unique.values()].sort((left, right) => left.keyType.localeCompare(right.keyType)
    || left.subjectHash.localeCompare(right.subjectHash)));
}

function assertInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}

function planLimitError(dataClass, maximum) {
  return governanceError("PRIVACY_PLAN_LIMIT_EXCEEDED", `Candidate count for ${dataClass} exceeds maximumRecordsPerPlan=${maximum}`);
}

function governanceError(code, message, retryable = false) {
  return Object.assign(new Error(message), { code, retryable });
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
