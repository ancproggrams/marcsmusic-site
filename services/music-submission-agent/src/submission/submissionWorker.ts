import type { BrowserExecutor } from '../browser/index.js';
import type { RuntimeConfig } from '../config/runtime.js';
import type { Repositories } from '../db/repositories.js';
import { calculateRetryAt, shouldRetryError } from '../queue/retryPolicy.js';
import { assetFields, validateRequiredAssets } from './assetValidation.js';

export class SubmissionWorker {
  public constructor(
    private readonly repositories: Repositories,
    private readonly browser: BrowserExecutor,
    private readonly config: RuntimeConfig
  ) {}

  public async processNext(workerId: string): Promise<boolean> {
    const job = this.repositories.queue.claimNext(workerId, ['submit_to_platform']);
    if (!job) {
      return false;
    }

    const platform = this.repositories.platforms.findById(job.platformId);
    const form = job.submissionFormId ? this.repositories.forms.findById(job.submissionFormId) : null;
    if (!platform) {
      this.repositories.queue.fail(job.id, 'Platform not found');
      return true;
    }

    if (!this.config.autoSubmitEnabled) {
      this.repositories.queue.markManualReview(job.id, 'AUTO_SUBMIT_ENABLED is false');
      return true;
    }

    const assetValidation = validateRequiredAssets(this.config.requiredAssets);
    if (!assetValidation.valid) {
      this.repositories.queue.markManualReview(
        job.id,
        `Missing required assets: ${assetValidation.missing.join(', ')}`
      );
      return true;
    }

    if (
      platform.manualReviewRequired ||
      platform.loginRequired ||
      platform.captchaDetected ||
      platform.paymentRequired
    ) {
      this.repositories.queue.markManualReview(
        job.id,
        platform.manualReviewReason ?? 'Platform requires manual review before submission'
      );
      return true;
    }

    if (form?.requiresLogin || form?.requiresCaptcha || form?.requiresPayment || form?.requiresManualApproval) {
      this.repositories.queue.markManualReview(job.id, 'Submission form contains protected workflow requirements');
      return true;
    }

    try {
      const navigation = await this.browser.navigate(job.submissionUrl);
      if (navigation.needsManualReview) {
        this.repositories.queue.markManualReview(
          job.id,
          navigation.reason ?? 'Browser navigation requires manual review'
        );
        return true;
      }

      const fill = await this.browser.fillForm(assetFields(this.config.requiredAssets));
      if (fill.needsManualReview) {
        this.repositories.queue.markManualReview(job.id, fill.reason ?? 'Browser form fill requires manual review');
        return true;
      }

      const upload = await this.browser.uploadFile(
        'track',
        this.config.requiredAssets.trackMp3Url ?? this.config.requiredAssets.trackWavUrl ?? ''
      );
      if (upload.needsManualReview) {
        this.repositories.queue.markManualReview(job.id, upload.reason ?? 'Browser upload requires manual review');
        return true;
      }

      this.repositories.queue.complete(job.id);
      this.repositories.events.record({
        jobId: job.id,
        platformId: platform.id,
        eventType: 'submission_completed',
        message: `Submission completed for ${platform.name}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (shouldRetryError(message) && job.attemptCount < job.maxAttempts) {
        this.repositories.queue.retry(job.id, calculateRetryAt(job.attemptCount), message);
      } else {
        this.repositories.queue.fail(job.id, message);
      }
    }
    return true;
  }
}
