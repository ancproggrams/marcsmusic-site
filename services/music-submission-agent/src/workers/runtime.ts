import type { Server } from 'node:http';
import { createApiServer } from '../api/server.js';
import type { AnalyticsService } from '../analytics/analyticsService.js';
import type { RuntimeConfig } from '../config/runtime.js';
import type { Repositories } from '../db/repositories.js';
import type { ExportService } from '../exports/exportService.js';
import type { MonitoringService } from '../monitoring/monitoringService.js';
import { calculateRetryAt } from '../queue/retryPolicy.js';
import type { DiscoveryWorker } from '../discovery/seedPlatforms.js';
import type { SubmissionWorker } from '../submission/submissionWorker.js';
import { logger } from '../utils/logger.js';
import type { VerificationWorker } from '../verification/platformVerifier.js';

interface RuntimeDependencies {
  config: RuntimeConfig;
  repositories: Repositories;
  analytics: AnalyticsService;
  monitoring: MonitoringService;
  exports: ExportService;
  discovery: DiscoveryWorker;
  verification: VerificationWorker;
  submission: SubmissionWorker;
  databaseHealthCheck: () => void;
  closeDatabase: () => void;
}

type LoopHandle = NodeJS.Timeout;

function hasMode(config: RuntimeConfig, mode: string): boolean {
  return config.workerMode === 'all' || config.workerMode === 'worker' || config.workerMode === mode;
}

async function drainWorker(
  name: string,
  worker: { processNext(workerId: string): Promise<boolean> },
  workerId: string,
  limit = 25
): Promise<number> {
  let processed = 0;
  while (processed < limit) {
    const didWork = await worker.processNext(workerId);
    if (!didWork) {
      break;
    }
    processed += 1;
  }

  if (processed > 0) {
    logger.info({ worker: name, processed }, 'worker drained jobs');
  }
  return processed;
}

export class WorkerRuntime {
  private readonly loopHandles: LoopHandle[] = [];
  private server: Server | null = null;
  private stopping = false;

  public constructor(private readonly dependencies: RuntimeDependencies) {}

  public async runOnce(): Promise<void> {
    const { discovery, verification, submission, exports } = this.dependencies;
    discovery.runOnce();
    await drainWorker('verification-once', verification, 'verification-once', 20);
    await drainWorker('submission-once', submission, 'submission-once', 20);
    await exports.regenerate();
  }

  public async start(): Promise<void> {
    const { config, repositories, discovery, verification, submission, exports } = this.dependencies;
    repositories.queue.recoverStaleRunningJobs(new Date(Date.now() - 15 * 60_000).toISOString());

    if (config.workerMode === 'all' || config.workerMode === 'api') {
      this.server = createApiServer({
        repositories,
        analytics: this.dependencies.analytics,
        monitoring: this.dependencies.monitoring,
        databaseHealthCheck: this.dependencies.databaseHealthCheck
      });
      await new Promise<void>((resolve) => {
        this.server?.listen(config.port, config.host, resolve);
      });
      logger.info({ host: config.host, port: config.port }, 'api server listening');
    }

    if (hasMode(config, 'discovery')) {
      discovery.runOnce();
      this.loop('discovery', config.discoveryIntervalMs, async () => {
        discovery.runOnce();
        await exports.regenerate();
      });
    }

    if (hasMode(config, 'verification')) {
      void drainWorker('verification-startup', verification, 'verification-startup').then(async () =>
        exports.regenerate()
      );
      this.loop('verification', config.verificationIntervalMs, async () => {
        await drainWorker('verification', verification, `verification-${process.pid}`);
        await exports.regenerate();
      });
    }

    if (hasMode(config, 'submission')) {
      void drainWorker('submission-startup', submission, 'submission-startup').then(async () => exports.regenerate());
      this.loop('submission', config.submissionIntervalMs, async () => {
        await drainWorker('submission', submission, `submission-${process.pid}`);
        await exports.regenerate();
      });
    }

    if (hasMode(config, 'exports')) {
      await exports.regenerate();
      this.loop('exports', Math.max(config.discoveryIntervalMs, 60_000), async () => {
        await exports.regenerate();
      });
    }
  }

  public async stop(): Promise<void> {
    if (this.stopping) {
      return;
    }

    this.stopping = true;
    for (const handle of this.loopHandles) {
      clearInterval(handle);
    }

    if (this.server) {
      await new Promise<void>((resolve) => this.server?.close(() => resolve()));
    }

    this.dependencies.closeDatabase();
  }

  private loop(name: string, intervalMs: number, handler: () => Promise<void>): void {
    let running = false;
    const handle = setInterval(
      () => {
        if (running || this.stopping) {
          return;
        }

        running = true;
        handler()
          .catch((error) => {
            logger.error({ error, nextRetryAt: calculateRetryAt(1) }, `worker loop ${name} failed`);
          })
          .finally(() => {
            running = false;
          });
      },
      Math.max(intervalMs, 1_000)
    );
    this.loopHandles.push(handle);
  }
}
