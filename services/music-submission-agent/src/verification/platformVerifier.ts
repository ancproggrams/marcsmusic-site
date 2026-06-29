import * as cheerio from 'cheerio';
import type { Repositories } from '../db/repositories.js';
import type { PlatformRecord, VerificationStatus } from '../models/types.js';
import { calculateRetryAt, shouldRetryError } from '../queue/retryPolicy.js';
import { nowIso } from '../utils/time.js';
import { HttpClient } from './httpClient.js';
import { isRobotsAllowed } from './robots.js';

export interface PlatformVerificationResult {
  status: VerificationStatus;
  active: boolean;
  confidenceScore: number;
  manualReviewRequired: boolean;
  manualReviewReason: string | null;
  riskFlags: string[];
  loginRequired: boolean;
  captchaDetected: boolean;
  paymentRequired: boolean;
  feeRequired: boolean;
  detectedFields: string[];
  requiredFields: string[];
  supportsUpload: boolean;
  lastActivityAt: string | null;
}

const loginPattern = /\b(log\s?in|sign\s?in|create account|account required|member login|oauth)\b/i;
const captchaPattern = /\b(captcha|recaptcha|hcaptcha|turnstile|bot protection|cloudflare challenge)\b/i;
const paymentPattern = /\b(payment|checkout|credits?|paid campaign|pricing|subscription|fee required)\b/i;
const closedPattern =
  /\b(closed for submissions|submissions are closed|not accepting submissions|no longer accepting)\b/i;
const parkedPattern = /\b(domain for sale|buy this domain|parked free|sedo parking)\b/i;

function detectInputFields(html: string): {
  detectedFields: string[];
  requiredFields: string[];
  supportsUpload: boolean;
} {
  const $ = cheerio.load(html);
  const detected = new Set<string>();
  const required = new Set<string>();
  let supportsUpload = false;

  $('input, textarea, select').each((_index, element) => {
    const name = $(element).attr('name') ?? $(element).attr('id') ?? $(element).attr('type');
    if (!name) {
      return;
    }

    detected.add(name);
    if ($(element).attr('required') !== undefined) {
      required.add(name);
    }

    if ($(element).attr('type') === 'file') {
      supportsUpload = true;
    }
  });

  return {
    detectedFields: [...detected].sort(),
    requiredFields: [...required].sort(),
    supportsUpload
  };
}

function scoreVerification(input: {
  httpOk: boolean;
  hasSubmissionUrl: boolean;
  manualReview: boolean;
  riskFlags: string[];
  feeRequired: boolean;
  genres: string[];
}): number {
  let score = input.httpOk ? 55 : 0;
  if (input.hasSubmissionUrl) score += 15;
  if (input.genres.length > 0) score += 10;
  if (!input.manualReview) score += 15;
  if (!input.feeRequired) score += 5;
  score -= input.riskFlags.length * 8;
  return Math.max(0, Math.min(100, score));
}

export class PlatformVerifier {
  public constructor(private readonly httpClient = new HttpClient()) {}

  public async verify(platform: PlatformRecord): Promise<PlatformVerificationResult> {
    const targetUrl = platform.submissionUrl ?? platform.websiteUrl;
    const robots = await isRobotsAllowed(targetUrl, this.httpClient);
    if (!robots.allowed) {
      return {
        status: 'needs_manual_review',
        active: true,
        confidenceScore: 40,
        manualReviewRequired: true,
        manualReviewReason: robots.reason ?? 'robots.txt disallows automated access',
        riskFlags: ['robots_disallowed'],
        loginRequired: platform.loginRequired,
        captchaDetected: platform.captchaDetected,
        paymentRequired: platform.paymentRequired,
        feeRequired: platform.feeRequired,
        detectedFields: [],
        requiredFields: [],
        supportsUpload: false,
        lastActivityAt: null
      };
    }

    const response = await this.httpClient.fetchText(targetUrl);
    const text = response.text;
    const normalizedText = text.replace(/\s+/g, ' ');
    const detected = detectInputFields(text);
    const riskFlags: string[] = [];

    if (response.status === 404 || response.status === 410) {
      return {
        status: 'inactive',
        active: false,
        confidenceScore: 0,
        manualReviewRequired: false,
        manualReviewReason: null,
        riskFlags: ['dead_website'],
        loginRequired: platform.loginRequired,
        captchaDetected: platform.captchaDetected,
        paymentRequired: platform.paymentRequired,
        feeRequired: platform.feeRequired,
        ...detected,
        lastActivityAt: null
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} verifying ${targetUrl}`);
    }

    if (parkedPattern.test(normalizedText)) {
      return {
        status: 'rejected',
        active: false,
        confidenceScore: 0,
        manualReviewRequired: false,
        manualReviewReason: null,
        riskFlags: ['parked_or_scam_like_domain'],
        loginRequired: false,
        captchaDetected: false,
        paymentRequired: false,
        feeRequired: false,
        ...detected,
        lastActivityAt: null
      };
    }

    if (closedPattern.test(normalizedText)) {
      return {
        status: 'inactive',
        active: false,
        confidenceScore: 20,
        manualReviewRequired: false,
        manualReviewReason: null,
        riskFlags: ['closed_submissions'],
        loginRequired: false,
        captchaDetected: false,
        paymentRequired: false,
        feeRequired: false,
        ...detected,
        lastActivityAt: nowIso()
      };
    }

    const loginRequired = platform.loginRequired || loginPattern.test(normalizedText);
    const captchaDetected = platform.captchaDetected || captchaPattern.test(normalizedText);
    const paymentRequired = platform.paymentRequired || paymentPattern.test(normalizedText);
    const feeRequired = platform.feeRequired || paymentRequired;

    if (loginRequired) riskFlags.push('login_required');
    if (captchaDetected) riskFlags.push('captcha_detected');
    if (paymentRequired) riskFlags.push('payment_required');

    const manualReasons = [
      platform.manualReviewReason,
      loginRequired ? 'login required' : null,
      captchaDetected ? 'CAPTCHA or anti-bot workflow detected' : null,
      paymentRequired ? 'payment or credits required' : null
    ].filter((reason): reason is string => Boolean(reason));
    const manualReviewRequired = platform.manualReviewRequired || manualReasons.length > 0;
    const status: VerificationStatus = manualReviewRequired ? 'needs_manual_review' : 'verified';

    return {
      status,
      active: true,
      confidenceScore: scoreVerification({
        httpOk: response.ok,
        hasSubmissionUrl: Boolean(platform.submissionUrl),
        manualReview: manualReviewRequired,
        riskFlags,
        feeRequired,
        genres: platform.genres
      }),
      manualReviewRequired,
      manualReviewReason: manualReasons.join('; ') || null,
      riskFlags,
      loginRequired,
      captchaDetected,
      paymentRequired,
      feeRequired,
      detectedFields: detected.detectedFields,
      requiredFields: detected.requiredFields,
      supportsUpload: detected.supportsUpload,
      lastActivityAt: nowIso()
    };
  }
}

export class VerificationWorker {
  public constructor(
    private readonly repositories: Repositories,
    private readonly verifier = new PlatformVerifier()
  ) {}

  public async processNext(workerId: string): Promise<boolean> {
    const job = this.repositories.queue.claimNext(workerId, ['verify_platform']);
    if (!job) {
      return false;
    }

    const platform = this.repositories.platforms.findById(job.platformId);
    if (!platform) {
      this.repositories.queue.fail(job.id, 'Platform not found');
      return true;
    }

    try {
      const result = await this.verifier.verify(platform);
      this.repositories.platforms.markVerification(platform.id, result);
      const form = this.repositories.forms.upsert({
        platformId: platform.id,
        formUrl: platform.submissionUrl ?? platform.websiteUrl,
        method: platform.submissionMethod ?? 'form',
        requiresLogin: result.loginRequired,
        requiresCaptcha: result.captchaDetected,
        requiresPayment: result.paymentRequired,
        requiresManualApproval: result.manualReviewRequired,
        supportsUpload: result.supportsUpload,
        requiredFields: result.requiredFields,
        detectedFields: result.detectedFields,
        status: result.status,
        lastCheckedAt: nowIso()
      });

      if (result.manualReviewRequired) {
        this.repositories.queue.markManualReview(job.id, result.manualReviewReason ?? 'manual review required');
      } else if (result.status === 'verified') {
        this.repositories.queue.complete(job.id);
        this.repositories.queue.enqueue({
          platformId: platform.id,
          submissionFormId: form.id,
          submissionUrl: form.formUrl,
          jobType: 'submit_to_platform',
          priority: Math.max(10, result.confidenceScore),
          idempotencyKey: `submit:${platform.id}:${form.id}`,
          payload: { verifiedAt: nowIso() }
        });
      } else {
        this.repositories.queue.fail(job.id, `Platform ${result.status}`);
      }

      this.repositories.events.record({
        jobId: job.id,
        platformId: platform.id,
        eventType: 'platform_verified',
        message: `Platform verification result: ${result.status}`,
        data: { confidenceScore: result.confidenceScore, riskFlags: result.riskFlags }
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (shouldRetryError(message) && job.attemptCount < job.maxAttempts) {
        this.repositories.queue.retry(job.id, calculateRetryAt(job.attemptCount), message);
        this.repositories.events.record({
          jobId: job.id,
          platformId: platform.id,
          eventType: 'verification_retry_scheduled',
          severity: 'warn',
          message
        });
      } else {
        this.repositories.queue.fail(job.id, message);
        this.repositories.events.record({
          jobId: job.id,
          platformId: platform.id,
          eventType: 'verification_failed',
          severity: 'error',
          message
        });
      }
      return true;
    }
  }
}
