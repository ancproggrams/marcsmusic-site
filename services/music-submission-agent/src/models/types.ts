export const queueStatuses = [
  'queued',
  'running',
  'waiting',
  'retrying',
  'completed',
  'failed',
  'cancelled',
  'archived',
  'needs_manual_review'
] as const;

export type QueueStatus = (typeof queueStatuses)[number];

export type JobType = 'discover_platforms' | 'verify_platform' | 'submit_to_platform' | 'export_data';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'inactive' | 'needs_manual_review';

export interface PlatformInput {
  name: string;
  websiteUrl: string;
  submissionUrl?: string;
  sourceUrl?: string;
  sourceType?: string;
  country?: string;
  language?: string;
  genres?: string[];
  submissionMethod?: string;
  feeRequired?: boolean;
  feeAmount?: string;
  loginRequired?: boolean;
  captchaDetected?: boolean;
  paymentRequired?: boolean;
  manualReviewRequired?: boolean;
  manualReviewReason?: string;
  notes?: string;
}

export interface PlatformRecord extends Required<
  Omit<
    PlatformInput,
    | 'sourceUrl'
    | 'country'
    | 'language'
    | 'submissionUrl'
    | 'submissionMethod'
    | 'feeAmount'
    | 'manualReviewReason'
    | 'notes'
  >
> {
  id: string;
  slug: string;
  canonicalKey: string;
  submissionUrl: string | null;
  sourceUrl: string | null;
  country: string | null;
  language: string | null;
  submissionMethod: string | null;
  feeAmount: string | null;
  manualReviewReason: string | null;
  active: boolean;
  confidenceScore: number;
  lastActivityAt: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: VerificationStatus;
  riskFlags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionFormRecord {
  id: string;
  platformId: string;
  formUrl: string;
  method: string;
  requiresLogin: boolean;
  requiresCaptcha: boolean;
  requiresPayment: boolean;
  requiresManualApproval: boolean;
  supportsUpload: boolean;
  requiredFields: string[];
  detectedFields: string[];
  status: string;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueueJob {
  id: string;
  platformId: string;
  submissionFormId: string | null;
  submissionUrl: string;
  jobType: JobType;
  priority: number;
  status: QueueStatus;
  attemptCount: number;
  maxAttempts: number;
  runAfter: string;
  lockedBy: string | null;
  lockedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
  manualReviewReason: string | null;
  lastError: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmailVerificationResult {
  email: string;
  syntaxValid: boolean;
  mxValid: boolean;
  roleAccount: boolean;
  disposable: boolean;
  temporary: boolean;
  smtpChecked: boolean;
  smtpDeliverable: boolean | null;
  status: 'verified' | 'rejected' | 'needs_manual_review';
  reason: string | null;
  deliverabilityScore: number;
  riskScore: number;
}

export interface AnalyticsMetrics {
  generatedAt: string;
  queueDepth: number;
  runningJobs: number;
  retryingJobs: number;
  failedJobs: number;
  manualReviewJobs: number;
  workerUtilization: number;
  submissionThroughput: number;
  successRate: number;
  retryRate: number;
  manualReviewRate: number;
  platformCount: number;
  verifiedPlatforms: number;
  countryCoverage: number;
  genreCoverage: number;
  freePlatforms: number;
  paidPlatforms: number;
  averageConfidence: number;
  averageDeliverability: number;
}

export interface WorkerResult {
  processed: number;
  manualReview: number;
  failed: number;
}
