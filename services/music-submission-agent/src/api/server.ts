import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AnalyticsService } from '../analytics/analyticsService.js';
import type { Repositories } from '../db/repositories.js';
import type { MonitoringService } from '../monitoring/monitoringService.js';
import { logger } from '../utils/logger.js';

interface ApiDependencies {
  repositories: Repositories;
  analytics: AnalyticsService;
  monitoring: MonitoringService;
  databaseHealthCheck: () => void;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendText(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(body);
}

function metricsToPrometheus(metrics: ReturnType<AnalyticsService['collect']>): string {
  return [
    `music_submission_queue_depth ${metrics.queueDepth}`,
    `music_submission_worker_utilization ${metrics.workerUtilization}`,
    `music_submission_throughput_total ${metrics.submissionThroughput}`,
    `music_submission_success_rate ${metrics.successRate}`,
    `music_submission_retry_rate ${metrics.retryRate}`,
    `music_submission_manual_review_rate ${metrics.manualReviewRate}`,
    `music_submission_platform_count ${metrics.platformCount}`,
    `music_submission_verified_platforms ${metrics.verifiedPlatforms}`,
    `music_submission_country_coverage ${metrics.countryCoverage}`,
    `music_submission_genre_coverage ${metrics.genreCoverage}`,
    `music_submission_free_platforms ${metrics.freePlatforms}`,
    `music_submission_paid_platforms ${metrics.paidPlatforms}`,
    `music_submission_average_confidence ${metrics.averageConfidence}`,
    `music_submission_average_deliverability ${metrics.averageDeliverability}`
  ].join('\n');
}

export function createApiServer(dependencies: ApiDependencies): Server {
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    void handleRequest(request, response, dependencies).catch((error) => {
      logger.error({ error }, 'api request failed');
      sendJson(response, 500, { ok: false, error: 'internal_server_error' });
    });
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ApiDependencies
): Promise<void> {
  if (request.method !== 'GET') {
    sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }

  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/health' || path === '/api/health') {
    dependencies.databaseHealthCheck();
    sendJson(response, 200, {
      ok: true,
      service: 'music-submission-agent',
      monitoring: dependencies.monitoring.check()
    });
    return;
  }

  if (path === '/metrics') {
    sendText(response, 200, `${metricsToPrometheus(dependencies.analytics.collect())}\n`);
    return;
  }

  if (path === '/queue') {
    sendJson(response, 200, {
      jobs: dependencies.repositories.queue.list(Number(url.searchParams.get('limit') ?? 100)),
      counts: dependencies.repositories.queue.countByStatus()
    });
    return;
  }

  if (path === '/platforms') {
    sendJson(response, 200, {
      platforms: dependencies.repositories.platforms.list(Number(url.searchParams.get('limit') ?? 500))
    });
    return;
  }

  if (path === '/analytics') {
    sendJson(response, 200, dependencies.analytics.collect());
    return;
  }

  sendJson(response, 404, { ok: false, error: 'not_found' });
}
