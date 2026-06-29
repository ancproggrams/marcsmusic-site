import { mkdirSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { AnalyticsService } from '../analytics/analyticsService.js';
import type { Repositories } from '../db/repositories.js';
import type { AnalyticsMetrics, PlatformRecord, QueueJob } from '../models/types.js';
import { writeMinimalXlsx } from './xlsxWriter.js';

function csvEscape(value: unknown): string {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function platformExportRow(platform: PlatformRecord): Record<string, unknown> {
  return {
    id: platform.id,
    name: platform.name,
    website_url: platform.websiteUrl,
    submission_url: platform.submissionUrl,
    country: platform.country,
    language: platform.language,
    genres: platform.genres.join('|'),
    submission_method: platform.submissionMethod,
    fee_required: platform.feeRequired,
    login_required: platform.loginRequired,
    captcha_detected: platform.captchaDetected,
    payment_required: platform.paymentRequired,
    verification_status: platform.verificationStatus,
    confidence_score: platform.confidenceScore,
    manual_review_required: platform.manualReviewRequired,
    manual_review_reason: platform.manualReviewReason,
    last_verified_at: platform.lastVerifiedAt
  };
}

function jobExportRow(job: QueueJob): Record<string, unknown> {
  return {
    id: job.id,
    platform_id: job.platformId,
    submission_url: job.submissionUrl,
    job_type: job.jobType,
    priority: job.priority,
    status: job.status,
    attempt_count: job.attemptCount,
    run_after: job.runAfter,
    last_error: job.lastError,
    manual_review_reason: job.manualReviewReason,
    created_at: job.createdAt,
    updated_at: job.updatedAt
  };
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0] ?? {});
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
  ].join('\n');
}

function writeSqliteSnapshot(filePath: string, tableName: string, rows: Record<string, unknown>[]): void {
  rmSync(filePath, { force: true });
  const database = new Database(filePath);
  try {
    database.pragma('journal_mode = WAL');
    const headers = Object.keys(rows[0] ?? { empty: '' });
    database.exec(`CREATE TABLE ${tableName} (${headers.map((header) => `"${header}" TEXT`).join(', ')})`);
    const placeholders = headers.map((header) => `@${header}`).join(', ');
    const statement = database.prepare(
      `INSERT INTO ${tableName} (${headers.map((header) => `"${header}"`).join(', ')}) VALUES (${placeholders})`
    );
    const transaction = database.transaction((records: Record<string, unknown>[]) => {
      for (const row of records) {
        statement.run(
          Object.fromEntries(
            headers.map((header) => [header, row[header] === undefined ? null : String(row[header])])
          ) as Record<string, string | null>
        );
      }
    });
    transaction(rows.length > 0 ? rows : [{ empty: '' }]);
  } finally {
    database.close();
  }
}

export class ExportService {
  public constructor(
    private readonly exportDir: string,
    private readonly repositories: Repositories,
    private readonly analytics: AnalyticsService
  ) {}

  public async regenerate(): Promise<AnalyticsMetrics> {
    mkdirSync(this.exportDir, { recursive: true });
    const metrics = this.analytics.collect();
    const allPlatforms = this.repositories.platforms.list(10_000);
    const verifiedPlatforms = allPlatforms.filter((platform) => platform.verificationStatus === 'verified');
    const platformRows = verifiedPlatforms.map(platformExportRow);
    const queueRows = this.repositories.queue.list(10_000).map(jobExportRow);

    await writeFile(
      join(this.exportDir, 'verified_submission_platforms.json'),
      JSON.stringify(verifiedPlatforms, null, 2)
    );
    await writeFile(join(this.exportDir, 'verified_submission_platforms.csv'), toCsv(platformRows));
    await writeMinimalXlsx(join(this.exportDir, 'verified_submission_platforms.xlsx'), platformRows);
    writeSqliteSnapshot(
      join(this.exportDir, 'verified_submission_platforms.sqlite'),
      'verified_submission_platforms',
      platformRows
    );
    writeSqliteSnapshot(join(this.exportDir, 'submission_queue.sqlite'), 'submission_queue', queueRows);
    await writeFile(join(this.exportDir, 'analytics_dashboard.json'), JSON.stringify(metrics, null, 2));
    await writeFile(
      join(this.exportDir, 'daily_report.md'),
      [
        '# Daily Report',
        '',
        `Generated: ${metrics.generatedAt}`,
        '',
        `- Platforms: ${metrics.platformCount}`,
        `- Verified platforms: ${metrics.verifiedPlatforms}`,
        `- Queue depth: ${metrics.queueDepth}`,
        `- Manual review jobs: ${metrics.manualReviewJobs}`,
        `- Success rate: ${metrics.successRate}`,
        `- Retry rate: ${metrics.retryRate}`,
        `- Average confidence: ${metrics.averageConfidence}`
      ].join('\n')
    );

    return metrics;
  }
}
