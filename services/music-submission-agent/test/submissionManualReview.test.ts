import assert from 'node:assert/strict';
import test from 'node:test';
import { NoopBrowserExecutor } from '../src/browser/index.js';
import type { RuntimeConfig } from '../src/config/runtime.js';
import { SubmissionWorker } from '../src/submission/submissionWorker.js';
import { createTestContext } from './testHarness.js';

const baseConfig: RuntimeConfig = {
  databasePath: ':memory:',
  exportDir: '/tmp',
  port: 3000,
  host: '127.0.0.1',
  autoSubmitEnabled: false,
  emailSmtpVerifyEnabled: false,
  workerMode: 'all',
  maxBrowserConcurrency: 1,
  discoveryIntervalMs: 1_000,
  verificationIntervalMs: 1_000,
  submissionIntervalMs: 1_000,
  afterShipEmailVerifierBin: 'bin/aftership-email-verifier',
  requiredAssets: {}
};

test('submission worker escalates when auto submit is disabled', async () => {
  const context = createTestContext();
  try {
    const platform = context.repositories.platforms.upsert({
      name: 'Manual Submit',
      websiteUrl: 'https://manual.example',
      submissionUrl: 'https://manual.example/submit'
    });
    context.repositories.queue.enqueue({
      platformId: platform.id,
      submissionUrl: 'https://manual.example/submit',
      jobType: 'submit_to_platform',
      idempotencyKey: 'submit:manual'
    });

    const worker = new SubmissionWorker(context.repositories, new NoopBrowserExecutor(), baseConfig);
    assert.equal(await worker.processNext('worker'), true);
    const job = context.repositories.queue.findByIdempotencyKey('submit:manual');
    assert.equal(job?.status, 'needs_manual_review');
    assert.equal(job.manualReviewReason, 'AUTO_SUBMIT_ENABLED is false');
  } finally {
    context.cleanup();
  }
});
