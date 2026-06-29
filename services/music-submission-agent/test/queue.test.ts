import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestContext } from './testHarness.js';

test('queue deduplicates by idempotency key and claims atomically', () => {
  const context = createTestContext();
  try {
    const platform = context.repositories.platforms.upsert({
      name: 'Example Submit',
      websiteUrl: 'https://example.com',
      submissionUrl: 'https://example.com/submit'
    });

    const first = context.repositories.queue.enqueue({
      platformId: platform.id,
      submissionUrl: 'https://example.com/submit',
      jobType: 'verify_platform',
      idempotencyKey: 'verify:example'
    });
    const second = context.repositories.queue.enqueue({
      platformId: platform.id,
      submissionUrl: 'https://example.com/submit',
      jobType: 'verify_platform',
      idempotencyKey: 'verify:example'
    });

    assert.equal(first.id, second.id);

    const claimed = context.repositories.queue.claimNext('worker-a', ['verify_platform']);
    assert.equal(claimed?.id, first.id);
    assert.equal(claimed.status, 'running');
    assert.equal(context.repositories.queue.claimNext('worker-b', ['verify_platform']), null);
  } finally {
    context.cleanup();
  }
});

test('stale running jobs are recovered without duplicate active processing', () => {
  const context = createTestContext();
  try {
    const platform = context.repositories.platforms.upsert({
      name: 'Stale Submit',
      websiteUrl: 'https://stale.example',
      submissionUrl: 'https://stale.example/submit'
    });
    context.repositories.queue.enqueue({
      platformId: platform.id,
      submissionUrl: 'https://stale.example/submit',
      jobType: 'verify_platform',
      idempotencyKey: 'verify:stale'
    });

    const claimed = context.repositories.queue.claimNext('worker-a', ['verify_platform']);
    assert.ok(claimed);
    const recovered = context.repositories.queue.recoverStaleRunningJobs(new Date(Date.now() + 1_000).toISOString());
    assert.equal(recovered, 1);
    const retry = context.repositories.queue.findById(claimed.id);
    assert.equal(retry?.status, 'retrying');
  } finally {
    context.cleanup();
  }
});
