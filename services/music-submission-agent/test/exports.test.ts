import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { AnalyticsService } from '../src/analytics/analyticsService.js';
import { ExportService } from '../src/exporters/exportService.js';
import { createTestContext } from './testHarness.js';

test('export service regenerates required artifacts', async () => {
  const context = createTestContext();
  try {
    const platform = context.repositories.platforms.upsert({
      name: 'Verified Submit',
      websiteUrl: 'https://verified.example',
      submissionUrl: 'https://verified.example/submit',
      genres: ['electronic']
    });
    context.repositories.platforms.markVerification(platform.id, {
      status: 'verified',
      active: true,
      confidenceScore: 91,
      manualReviewRequired: false,
      riskFlags: []
    });

    const analytics = new AnalyticsService(context.database, context.repositories, 1);
    const exports = new ExportService(context.dir, context.repositories, analytics);
    await exports.regenerate();

    for (const fileName of [
      'verified_submission_platforms.csv',
      'verified_submission_platforms.xlsx',
      'verified_submission_platforms.json',
      'verified_submission_platforms.sqlite',
      'submission_queue.sqlite',
      'analytics_dashboard.json',
      'daily_report.md'
    ]) {
      assert.equal(existsSync(join(context.dir, fileName)), true, fileName);
    }
  } finally {
    context.cleanup();
  }
});
