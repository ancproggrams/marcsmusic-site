import type Database from 'better-sqlite3';
import type { Repositories } from '../db/repositories.js';
import type { AnalyticsMetrics } from '../models/types.js';
import { parseJsonArray } from '../utils/json.js';
import { nowIso } from '../utils/time.js';

interface CountRow {
  count: number;
}

interface AverageRow {
  average: number | null;
}

export class AnalyticsService {
  public constructor(
    private readonly database: Database.Database,
    private readonly repositories: Repositories,
    private readonly maxWorkerConcurrency: number
  ) {}

  public collect(): AnalyticsMetrics {
    const queueCounts = this.repositories.queue.countByStatus();
    const queueDepth = queueCounts.queued + queueCounts.waiting + queueCounts.retrying;
    const platformCount = this.count('SELECT COUNT(*) AS count FROM platforms');
    const verifiedPlatforms = this.count(
      "SELECT COUNT(*) AS count FROM platforms WHERE verification_status = 'verified'"
    );
    const completed = queueCounts.completed;
    const failed = queueCounts.failed;
    const manual = queueCounts.needs_manual_review;
    const totalTerminal = completed + failed + manual;
    const retrying = queueCounts.retrying;
    const countries = this.database
      .prepare("SELECT DISTINCT country FROM platforms WHERE country IS NOT NULL AND country != ''")
      .all() as {
      country: string;
    }[];
    const genreRows = this.database.prepare('SELECT genres_json FROM platforms').all() as { genres_json: string }[];
    const genres = new Set<string>();
    for (const row of genreRows) {
      for (const genre of parseJsonArray(row.genres_json)) {
        genres.add(genre);
      }
    }

    const metrics: AnalyticsMetrics = {
      generatedAt: nowIso(),
      queueDepth,
      runningJobs: queueCounts.running,
      retryingJobs: retrying,
      failedJobs: failed,
      manualReviewJobs: manual,
      workerUtilization: this.round(queueCounts.running / Math.max(1, this.maxWorkerConcurrency)),
      submissionThroughput: completed,
      successRate: this.round(totalTerminal === 0 ? 0 : completed / totalTerminal),
      retryRate: this.round(queueDepth === 0 ? 0 : retrying / queueDepth),
      manualReviewRate: this.round(totalTerminal === 0 ? 0 : manual / totalTerminal),
      platformCount,
      verifiedPlatforms,
      countryCoverage: countries.length,
      genreCoverage: genres.size,
      freePlatforms: this.count('SELECT COUNT(*) AS count FROM platforms WHERE fee_required = 0'),
      paidPlatforms: this.count('SELECT COUNT(*) AS count FROM platforms WHERE fee_required = 1'),
      averageConfidence: this.average('SELECT AVG(confidence_score) AS average FROM platforms'),
      averageDeliverability: this.average(
        'SELECT AVG(deliverability_score) AS average FROM contacts WHERE deliverability_score IS NOT NULL'
      )
    };

    this.repositories.analyticsSnapshots.store(metrics.generatedAt.slice(0, 10), metrics);
    return metrics;
  }

  private count(sql: string): number {
    const row = this.database.prepare(sql).get() as CountRow;
    return Number(row.count ?? 0);
  }

  private average(sql: string): number {
    const row = this.database.prepare(sql).get() as AverageRow;
    return this.round(row.average ?? 0);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
