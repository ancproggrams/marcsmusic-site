import type { PlatformRecord, QueueJob, SubmissionFormRecord, VerificationStatus } from '../models/types.js';
import { parseJsonArray, parseJsonObject } from '../utils/json.js';

type PrimitiveRow = Record<string, unknown>;

function text(row: PrimitiveRow, key: string): string {
  return String(row[key] ?? '');
}

function nullableText(row: PrimitiveRow, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function integer(row: PrimitiveRow, key: string): number {
  return Number(row[key] ?? 0);
}

function bool(row: PrimitiveRow, key: string): boolean {
  return Number(row[key] ?? 0) === 1;
}

export function mapPlatform(row: PrimitiveRow): PlatformRecord {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    slug: text(row, 'slug'),
    canonicalKey: text(row, 'canonical_key'),
    websiteUrl: text(row, 'website_url'),
    submissionUrl: nullableText(row, 'submission_url'),
    sourceUrl: nullableText(row, 'source_url'),
    sourceType: text(row, 'source_type'),
    country: nullableText(row, 'country'),
    language: nullableText(row, 'language'),
    genres: parseJsonArray(nullableText(row, 'genres_json')),
    submissionMethod: nullableText(row, 'submission_method'),
    feeRequired: bool(row, 'fee_required'),
    feeAmount: nullableText(row, 'fee_amount'),
    loginRequired: bool(row, 'login_required'),
    captchaDetected: bool(row, 'captcha_detected'),
    paymentRequired: bool(row, 'payment_required'),
    manualReviewRequired: bool(row, 'manual_review_required'),
    manualReviewReason: nullableText(row, 'manual_review_reason'),
    active: bool(row, 'active'),
    confidenceScore: integer(row, 'confidence_score'),
    lastActivityAt: nullableText(row, 'last_activity_at'),
    lastVerifiedAt: nullableText(row, 'last_verified_at'),
    verificationStatus: text(row, 'verification_status') as VerificationStatus,
    riskFlags: parseJsonArray(nullableText(row, 'risk_flags_json')),
    notes: nullableText(row, 'notes'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at')
  };
}

export function mapSubmissionForm(row: PrimitiveRow): SubmissionFormRecord {
  return {
    id: text(row, 'id'),
    platformId: text(row, 'platform_id'),
    formUrl: text(row, 'form_url'),
    method: text(row, 'method'),
    requiresLogin: bool(row, 'requires_login'),
    requiresCaptcha: bool(row, 'requires_captcha'),
    requiresPayment: bool(row, 'requires_payment'),
    requiresManualApproval: bool(row, 'requires_manual_approval'),
    supportsUpload: bool(row, 'supports_upload'),
    requiredFields: parseJsonArray(nullableText(row, 'required_fields_json')),
    detectedFields: parseJsonArray(nullableText(row, 'detected_fields_json')),
    status: text(row, 'status'),
    lastCheckedAt: nullableText(row, 'last_checked_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at')
  };
}

export function mapQueueJob(row: PrimitiveRow): QueueJob {
  return {
    id: text(row, 'id'),
    platformId: text(row, 'platform_id'),
    submissionFormId: nullableText(row, 'submission_form_id'),
    submissionUrl: text(row, 'submission_url'),
    jobType: text(row, 'job_type') as QueueJob['jobType'],
    priority: integer(row, 'priority'),
    status: text(row, 'status') as QueueJob['status'],
    attemptCount: integer(row, 'attempt_count'),
    maxAttempts: integer(row, 'max_attempts'),
    runAfter: text(row, 'run_after'),
    lockedBy: nullableText(row, 'locked_by'),
    lockedAt: nullableText(row, 'locked_at'),
    completedAt: nullableText(row, 'completed_at'),
    cancelledAt: nullableText(row, 'cancelled_at'),
    archivedAt: nullableText(row, 'archived_at'),
    manualReviewReason: nullableText(row, 'manual_review_reason'),
    lastError: nullableText(row, 'last_error'),
    idempotencyKey: text(row, 'idempotency_key'),
    payload: parseJsonObject(nullableText(row, 'payload_json')),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at')
  };
}
