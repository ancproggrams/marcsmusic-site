import type Database from 'better-sqlite3';
import type {
  AnalyticsMetrics,
  JobType,
  PlatformInput,
  PlatformRecord,
  QueueJob,
  QueueStatus,
  SubmissionFormRecord,
  VerificationStatus
} from '../models/types.js';
import { createId, platformCanonicalKey, slugify } from '../utils/ids.js';
import { stringifyJson } from '../utils/json.js';
import { nowIso } from '../utils/time.js';
import { mapPlatform, mapQueueJob, mapSubmissionForm } from './rowMappers.js';

type SqlParams = Record<string, unknown>;

export class PlatformRepository {
  public constructor(private readonly database: Database.Database) {}

  public upsert(input: PlatformInput): PlatformRecord {
    const existing = this.findByCanonicalKey(platformCanonicalKey(input.name, input.websiteUrl, input.submissionUrl));
    const timestamp = nowIso();
    const id = existing?.id ?? createId('plt');
    const slug = existing?.slug ?? slugify(input.name);
    const canonicalKey =
      existing?.canonicalKey ?? platformCanonicalKey(input.name, input.websiteUrl, input.submissionUrl);

    this.database
      .prepare(
        `
        INSERT INTO platforms (
          id, name, slug, canonical_key, website_url, submission_url, source_url, source_type,
          country, language, genres_json, submission_method, fee_required, fee_amount,
          login_required, captcha_detected, payment_required, manual_review_required,
          manual_review_reason, active, confidence_score, verification_status, risk_flags_json,
          notes, created_at, updated_at
        )
        VALUES (
          @id, @name, @slug, @canonicalKey, @websiteUrl, @submissionUrl, @sourceUrl, @sourceType,
          @country, @language, @genresJson, @submissionMethod, @feeRequired, @feeAmount,
          @loginRequired, @captchaDetected, @paymentRequired, @manualReviewRequired,
          @manualReviewReason, 1, @confidenceScore, @verificationStatus, @riskFlagsJson,
          @notes, @createdAt, @updatedAt
        )
        ON CONFLICT(canonical_key) DO UPDATE SET
          name = excluded.name,
          website_url = excluded.website_url,
          submission_url = COALESCE(excluded.submission_url, platforms.submission_url),
          source_url = COALESCE(excluded.source_url, platforms.source_url),
          source_type = excluded.source_type,
          country = COALESCE(excluded.country, platforms.country),
          language = COALESCE(excluded.language, platforms.language),
          genres_json = excluded.genres_json,
          submission_method = COALESCE(excluded.submission_method, platforms.submission_method),
          fee_required = excluded.fee_required,
          fee_amount = COALESCE(excluded.fee_amount, platforms.fee_amount),
          login_required = excluded.login_required,
          captcha_detected = excluded.captcha_detected,
          payment_required = excluded.payment_required,
          manual_review_required = excluded.manual_review_required,
          manual_review_reason = COALESCE(excluded.manual_review_reason, platforms.manual_review_reason),
          notes = COALESCE(excluded.notes, platforms.notes),
          updated_at = excluded.updated_at
        `
      )
      .run({
        id,
        name: input.name,
        slug,
        canonicalKey,
        websiteUrl: input.websiteUrl,
        submissionUrl: input.submissionUrl ?? null,
        sourceUrl: input.sourceUrl ?? input.websiteUrl,
        sourceType: input.sourceType ?? 'seed',
        country: input.country ?? null,
        language: input.language ?? null,
        genresJson: stringifyJson(input.genres ?? []),
        submissionMethod: input.submissionMethod ?? null,
        feeRequired: input.feeRequired ? 1 : 0,
        feeAmount: input.feeAmount ?? null,
        loginRequired: input.loginRequired ? 1 : 0,
        captchaDetected: input.captchaDetected ? 1 : 0,
        paymentRequired: input.paymentRequired ? 1 : 0,
        manualReviewRequired: input.manualReviewRequired ? 1 : 0,
        manualReviewReason: input.manualReviewReason ?? null,
        confidenceScore: input.manualReviewRequired ? 60 : 50,
        verificationStatus: input.manualReviewRequired ? 'needs_manual_review' : 'pending',
        riskFlagsJson: stringifyJson([]),
        notes: input.notes ?? null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      });

    const platform = this.findByCanonicalKey(canonicalKey);
    if (!platform) {
      throw new Error(`Failed to upsert platform ${input.name}`);
    }

    return platform;
  }

  public findById(id: string): PlatformRecord | null {
    const row = this.database.prepare('SELECT * FROM platforms WHERE id = ?').get(id) as SqlParams | undefined;
    return row ? mapPlatform(row) : null;
  }

  public findByCanonicalKey(canonicalKey: string): PlatformRecord | null {
    const row = this.database.prepare('SELECT * FROM platforms WHERE canonical_key = ?').get(canonicalKey) as
      SqlParams | undefined;
    return row ? mapPlatform(row) : null;
  }

  public list(limit = 500): PlatformRecord[] {
    const rows = this.database
      .prepare('SELECT * FROM platforms ORDER BY confidence_score DESC, name LIMIT ?')
      .all(limit) as SqlParams[];
    return rows.map(mapPlatform);
  }

  public listNeedingVerification(limit = 50): PlatformRecord[] {
    const rows = this.database
      .prepare(
        `
        SELECT * FROM platforms
        WHERE verification_status IN ('pending', 'needs_manual_review')
        ORDER BY manual_review_required ASC, updated_at ASC
        LIMIT ?
        `
      )
      .all(limit) as SqlParams[];
    return rows.map(mapPlatform);
  }

  public markVerification(
    id: string,
    update: {
      status: VerificationStatus;
      active: boolean;
      confidenceScore: number;
      manualReviewRequired?: boolean;
      manualReviewReason?: string | null;
      riskFlags?: string[];
      loginRequired?: boolean;
      captchaDetected?: boolean;
      paymentRequired?: boolean;
      feeRequired?: boolean;
      lastActivityAt?: string | null;
    }
  ): void {
    const timestamp = nowIso();
    this.database
      .prepare(
        `
        UPDATE platforms SET
          verification_status = @status,
          active = @active,
          confidence_score = @confidenceScore,
          manual_review_required = COALESCE(@manualReviewRequired, manual_review_required),
          manual_review_reason = @manualReviewReason,
          risk_flags_json = @riskFlagsJson,
          login_required = COALESCE(@loginRequired, login_required),
          captcha_detected = COALESCE(@captchaDetected, captcha_detected),
          payment_required = COALESCE(@paymentRequired, payment_required),
          fee_required = COALESCE(@feeRequired, fee_required),
          last_activity_at = @lastActivityAt,
          last_verified_at = @timestamp,
          updated_at = @timestamp
        WHERE id = @id
        `
      )
      .run({
        id,
        status: update.status,
        active: update.active ? 1 : 0,
        confidenceScore: update.confidenceScore,
        manualReviewRequired: update.manualReviewRequired === undefined ? null : update.manualReviewRequired ? 1 : 0,
        manualReviewReason: update.manualReviewReason ?? null,
        riskFlagsJson: stringifyJson(update.riskFlags ?? []),
        loginRequired: update.loginRequired === undefined ? null : update.loginRequired ? 1 : 0,
        captchaDetected: update.captchaDetected === undefined ? null : update.captchaDetected ? 1 : 0,
        paymentRequired: update.paymentRequired === undefined ? null : update.paymentRequired ? 1 : 0,
        feeRequired: update.feeRequired === undefined ? null : update.feeRequired ? 1 : 0,
        lastActivityAt: update.lastActivityAt ?? null,
        timestamp
      });
  }
}

export class SubmissionFormRepository {
  public constructor(private readonly database: Database.Database) {}

  public upsert(input: {
    platformId: string;
    formUrl: string;
    method?: string;
    requiresLogin?: boolean;
    requiresCaptcha?: boolean;
    requiresPayment?: boolean;
    requiresManualApproval?: boolean;
    supportsUpload?: boolean;
    requiredFields?: string[];
    detectedFields?: string[];
    status?: string;
    lastCheckedAt?: string;
  }): SubmissionFormRecord {
    const existing = this.findByPlatformAndUrl(input.platformId, input.formUrl);
    const timestamp = nowIso();
    const id = existing?.id ?? createId('frm');

    this.database
      .prepare(
        `
        INSERT INTO submission_forms (
          id, platform_id, form_url, method, requires_login, requires_captcha, requires_payment,
          requires_manual_approval, supports_upload, required_fields_json, detected_fields_json,
          status, last_checked_at, created_at, updated_at
        )
        VALUES (
          @id, @platformId, @formUrl, @method, @requiresLogin, @requiresCaptcha, @requiresPayment,
          @requiresManualApproval, @supportsUpload, @requiredFieldsJson, @detectedFieldsJson,
          @status, @lastCheckedAt, @createdAt, @updatedAt
        )
        ON CONFLICT(platform_id, form_url) DO UPDATE SET
          method = excluded.method,
          requires_login = excluded.requires_login,
          requires_captcha = excluded.requires_captcha,
          requires_payment = excluded.requires_payment,
          requires_manual_approval = excluded.requires_manual_approval,
          supports_upload = excluded.supports_upload,
          required_fields_json = excluded.required_fields_json,
          detected_fields_json = excluded.detected_fields_json,
          status = excluded.status,
          last_checked_at = excluded.last_checked_at,
          updated_at = excluded.updated_at
        `
      )
      .run({
        id,
        platformId: input.platformId,
        formUrl: input.formUrl,
        method: input.method ?? 'form',
        requiresLogin: input.requiresLogin ? 1 : 0,
        requiresCaptcha: input.requiresCaptcha ? 1 : 0,
        requiresPayment: input.requiresPayment ? 1 : 0,
        requiresManualApproval: input.requiresManualApproval ? 1 : 0,
        supportsUpload: input.supportsUpload ? 1 : 0,
        requiredFieldsJson: stringifyJson(input.requiredFields ?? []),
        detectedFieldsJson: stringifyJson(input.detectedFields ?? []),
        status: input.status ?? 'pending',
        lastCheckedAt: input.lastCheckedAt ?? null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      });

    const form = this.findByPlatformAndUrl(input.platformId, input.formUrl);
    if (!form) {
      throw new Error(`Failed to upsert submission form ${input.formUrl}`);
    }

    return form;
  }

  public findByPlatformAndUrl(platformId: string, formUrl: string): SubmissionFormRecord | null {
    const row = this.database
      .prepare('SELECT * FROM submission_forms WHERE platform_id = ? AND form_url = ?')
      .get(platformId, formUrl) as SqlParams | undefined;
    return row ? mapSubmissionForm(row) : null;
  }

  public findById(id: string): SubmissionFormRecord | null {
    const row = this.database.prepare('SELECT * FROM submission_forms WHERE id = ?').get(id) as SqlParams | undefined;
    return row ? mapSubmissionForm(row) : null;
  }
}

export class QueueRepository {
  public constructor(private readonly database: Database.Database) {}

  public enqueue(input: {
    platformId: string;
    submissionFormId?: string | null;
    submissionUrl: string;
    jobType: JobType;
    priority?: number;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
    runAfter?: string;
    maxAttempts?: number;
  }): QueueJob {
    const existing = this.findByIdempotencyKey(input.idempotencyKey);
    if (existing && !['failed', 'cancelled', 'archived'].includes(existing.status)) {
      return existing;
    }

    const timestamp = nowIso();
    const id = existing?.id ?? createId('job');
    this.database
      .prepare(
        `
        INSERT INTO submission_queue (
          id, platform_id, submission_form_id, submission_url, job_type, priority, status,
          attempt_count, max_attempts, run_after, idempotency_key, payload_json, created_at, updated_at
        )
        VALUES (
          @id, @platformId, @submissionFormId, @submissionUrl, @jobType, @priority, 'queued',
          0, @maxAttempts, @runAfter, @idempotencyKey, @payloadJson, @createdAt, @updatedAt
        )
        ON CONFLICT(idempotency_key) DO UPDATE SET
          status = 'queued',
          priority = excluded.priority,
          run_after = excluded.run_after,
          payload_json = excluded.payload_json,
          last_error = NULL,
          manual_review_reason = NULL,
          updated_at = excluded.updated_at
        `
      )
      .run({
        id,
        platformId: input.platformId,
        submissionFormId: input.submissionFormId ?? null,
        submissionUrl: input.submissionUrl,
        jobType: input.jobType,
        priority: input.priority ?? 50,
        maxAttempts: input.maxAttempts ?? 5,
        runAfter: input.runAfter ?? timestamp,
        idempotencyKey: input.idempotencyKey,
        payloadJson: stringifyJson(input.payload ?? {}),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      });

    const job = this.findByIdempotencyKey(input.idempotencyKey);
    if (!job) {
      throw new Error(`Failed to enqueue job ${input.idempotencyKey}`);
    }

    return job;
  }

  public claimNext(
    workerId: string,
    jobTypes: JobType[] = ['verify_platform', 'submit_to_platform', 'export_data']
  ): QueueJob | null {
    if (jobTypes.length === 0) {
      return null;
    }

    const timestamp = nowIso();
    const placeholders = jobTypes.map(() => '?').join(', ');
    const statement = this.database.prepare(
      `
      UPDATE submission_queue
      SET status = 'running',
          locked_by = ?,
          locked_at = ?,
          attempt_count = attempt_count + 1,
          updated_at = ?
      WHERE id = (
        SELECT id FROM submission_queue
        WHERE status IN ('queued', 'retrying', 'waiting')
          AND run_after <= ?
          AND job_type IN (${placeholders})
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      )
      RETURNING *
      `
    );
    const row = statement.get(workerId, timestamp, timestamp, timestamp, ...jobTypes) as SqlParams | undefined;
    return row ? mapQueueJob(row) : null;
  }

  public findById(id: string): QueueJob | null {
    const row = this.database.prepare('SELECT * FROM submission_queue WHERE id = ?').get(id) as SqlParams | undefined;
    return row ? mapQueueJob(row) : null;
  }

  public findByIdempotencyKey(idempotencyKey: string): QueueJob | null {
    const row = this.database
      .prepare('SELECT * FROM submission_queue WHERE idempotency_key = ?')
      .get(idempotencyKey) as SqlParams | undefined;
    return row ? mapQueueJob(row) : null;
  }

  public list(limit = 100): QueueJob[] {
    const rows = this.database
      .prepare('SELECT * FROM submission_queue ORDER BY created_at DESC LIMIT ?')
      .all(limit) as SqlParams[];
    return rows.map(mapQueueJob);
  }

  public countByStatus(): Record<QueueStatus, number> {
    const counts = Object.fromEntries(
      [
        'queued',
        'running',
        'waiting',
        'retrying',
        'completed',
        'failed',
        'cancelled',
        'archived',
        'needs_manual_review'
      ].map((status) => [status, 0])
    ) as Record<QueueStatus, number>;
    const rows = this.database
      .prepare('SELECT status, COUNT(*) AS count FROM submission_queue GROUP BY status')
      .all() as {
      status: QueueStatus;
      count: number;
    }[];
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  public complete(id: string): void {
    const timestamp = nowIso();
    this.database
      .prepare(
        `
        UPDATE submission_queue
        SET status = 'completed', completed_at = @timestamp, locked_by = NULL, locked_at = NULL, updated_at = @timestamp
        WHERE id = @id
        `
      )
      .run({ id, timestamp });
  }

  public retry(id: string, runAfter: string, errorMessage: string): void {
    const timestamp = nowIso();
    this.database
      .prepare(
        `
        UPDATE submission_queue
        SET status = 'retrying', run_after = @runAfter, locked_by = NULL, locked_at = NULL,
            last_error = @errorMessage, updated_at = @timestamp
        WHERE id = @id
        `
      )
      .run({ id, runAfter, errorMessage, timestamp });
  }

  public fail(id: string, errorMessage: string): void {
    const timestamp = nowIso();
    this.database
      .prepare(
        `
        UPDATE submission_queue
        SET status = 'failed', locked_by = NULL, locked_at = NULL, last_error = @errorMessage, updated_at = @timestamp
        WHERE id = @id
        `
      )
      .run({ id, errorMessage, timestamp });
  }

  public markManualReview(id: string, reason: string): void {
    const timestamp = nowIso();
    this.database
      .prepare(
        `
        UPDATE submission_queue
        SET status = 'needs_manual_review', manual_review_reason = @reason,
            locked_by = NULL, locked_at = NULL, updated_at = @timestamp
        WHERE id = @id
        `
      )
      .run({ id, reason, timestamp });
  }

  public recoverStaleRunningJobs(staleBeforeIso: string): number {
    const timestamp = nowIso();
    const result = this.database
      .prepare(
        `
        UPDATE submission_queue
        SET status = CASE WHEN attempt_count >= max_attempts THEN 'failed' ELSE 'retrying' END,
            run_after = @timestamp,
            last_error = 'Recovered stale running job after worker crash',
            locked_by = NULL,
            locked_at = NULL,
            updated_at = @timestamp
        WHERE status = 'running' AND locked_at < @staleBeforeIso
        `
      )
      .run({ staleBeforeIso, timestamp });
    return result.changes;
  }
}

export class ContactRepository {
  public constructor(private readonly database: Database.Database) {}

  public storeVerifiedEmail(input: {
    platformId: string;
    email: string;
    sourceUrl?: string;
    deliverabilityScore: number;
    riskScore: number;
    verification: {
      syntaxValid: boolean;
      mxValid: boolean;
      roleAccount: boolean;
      disposable: boolean;
      temporary: boolean;
      smtpChecked: boolean;
      smtpDeliverable: boolean | null;
      status: string;
      reason: string | null;
    };
  }): void {
    const timestamp = nowIso();
    const contactId = createId('cnt');
    const verificationId = createId('emv');
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `
          INSERT INTO contacts (
            id, platform_id, contact_type, value, source_url, verification_status,
            deliverability_score, risk_score, created_at, updated_at
          )
          VALUES (@contactId, @platformId, 'email', @email, @sourceUrl, 'verified', @deliverabilityScore, @riskScore, @timestamp, @timestamp)
          ON CONFLICT(platform_id, contact_type, value) DO UPDATE SET
            source_url = COALESCE(excluded.source_url, contacts.source_url),
            verification_status = 'verified',
            deliverability_score = excluded.deliverability_score,
            risk_score = excluded.risk_score,
            updated_at = excluded.updated_at
          `
        )
        .run({
          contactId,
          platformId: input.platformId,
          email: input.email,
          sourceUrl: input.sourceUrl ?? null,
          deliverabilityScore: input.deliverabilityScore,
          riskScore: input.riskScore,
          timestamp
        });

      const row = this.database
        .prepare('SELECT id FROM contacts WHERE platform_id = ? AND contact_type = ? AND value = ?')
        .get(input.platformId, 'email', input.email) as { id: string };

      this.database
        .prepare(
          `
          INSERT INTO email_verifications (
            id, contact_id, email, syntax_valid, mx_valid, role_account, disposable,
            temporary, smtp_checked, smtp_deliverable, status, reason,
            deliverability_score, risk_score, checked_at, created_at, updated_at
          )
          VALUES (
            @verificationId, @contactId, @email, @syntaxValid, @mxValid, @roleAccount, @disposable,
            @temporary, @smtpChecked, @smtpDeliverable, @status, @reason,
            @deliverabilityScore, @riskScore, @timestamp, @timestamp, @timestamp
          )
          `
        )
        .run({
          verificationId,
          contactId: row.id,
          email: input.email,
          syntaxValid: input.verification.syntaxValid ? 1 : 0,
          mxValid: input.verification.mxValid ? 1 : 0,
          roleAccount: input.verification.roleAccount ? 1 : 0,
          disposable: input.verification.disposable ? 1 : 0,
          temporary: input.verification.temporary ? 1 : 0,
          smtpChecked: input.verification.smtpChecked ? 1 : 0,
          smtpDeliverable:
            input.verification.smtpDeliverable === null ? null : input.verification.smtpDeliverable ? 1 : 0,
          status: input.verification.status,
          reason: input.verification.reason,
          deliverabilityScore: input.deliverabilityScore,
          riskScore: input.riskScore,
          timestamp
        });
    });

    transaction();
  }
}

export class EventRepository {
  public constructor(private readonly database: Database.Database) {}

  public record(input: {
    jobId?: string | null;
    platformId?: string | null;
    eventType: string;
    severity?: 'info' | 'warn' | 'error';
    message?: string;
    data?: Record<string, unknown>;
  }): void {
    const timestamp = nowIso();
    this.database
      .prepare(
        `
        INSERT INTO submission_events (
          id, job_id, platform_id, event_type, severity, message, data_json, created_at, updated_at
        )
        VALUES (@id, @jobId, @platformId, @eventType, @severity, @message, @dataJson, @timestamp, @timestamp)
        `
      )
      .run({
        id: createId('evt'),
        jobId: input.jobId ?? null,
        platformId: input.platformId ?? null,
        eventType: input.eventType,
        severity: input.severity ?? 'info',
        message: input.message ?? null,
        dataJson: stringifyJson(input.data ?? {}),
        timestamp
      });
  }
}

export class AnalyticsSnapshotRepository {
  public constructor(private readonly database: Database.Database) {}

  public store(snapshotDate: string, metrics: AnalyticsMetrics): void {
    const timestamp = nowIso();
    this.database
      .prepare(
        `
        INSERT INTO analytics_snapshots (id, snapshot_date, metrics_json, created_at, updated_at)
        VALUES (@id, @snapshotDate, @metricsJson, @timestamp, @timestamp)
        ON CONFLICT(snapshot_date) DO UPDATE SET
          metrics_json = excluded.metrics_json,
          updated_at = excluded.updated_at
        `
      )
      .run({
        id: createId('asn'),
        snapshotDate,
        metricsJson: stringifyJson(metrics),
        timestamp
      });
  }
}

export interface Repositories {
  platforms: PlatformRepository;
  forms: SubmissionFormRepository;
  queue: QueueRepository;
  contacts: ContactRepository;
  events: EventRepository;
  analyticsSnapshots: AnalyticsSnapshotRepository;
}

export function createRepositories(database: Database.Database): Repositories {
  return {
    platforms: new PlatformRepository(database),
    forms: new SubmissionFormRepository(database),
    queue: new QueueRepository(database),
    contacts: new ContactRepository(database),
    events: new EventRepository(database),
    analyticsSnapshots: new AnalyticsSnapshotRepository(database)
  };
}
