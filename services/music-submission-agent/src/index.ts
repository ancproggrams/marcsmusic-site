import { NoopBrowserExecutor } from './browser/index.js';
import { config } from './config/runtime.js';
import { AnalyticsService } from './analytics/analyticsService.js';
import { createInitializedDatabase } from './db/database.js';
import { createRepositories } from './db/repositories.js';
import { DiscoveryWorker } from './discovery/seedPlatforms.js';
import { ExportService } from './exporters/exportService.js';
import { MonitoringService } from './monitoring/monitoringService.js';
import { SubmissionWorker } from './submission/submissionWorker.js';
import { logger } from './utils/logger.js';
import { PlatformVerifier, VerificationWorker } from './verification/platformVerifier.js';
import { WorkerRuntime } from './workers/runtime.js';

const database = createInitializedDatabase(config.databasePath);
const repositories = createRepositories(database);
const analytics = new AnalyticsService(database, repositories, config.maxBrowserConcurrency);
const monitoring = new MonitoringService(repositories);
const exportService = new ExportService(config.exportDir, repositories, analytics);
const discovery = new DiscoveryWorker(repositories);
const verifier = new PlatformVerifier();
const verification = new VerificationWorker(repositories, verifier);
const browser = new NoopBrowserExecutor();
const submission = new SubmissionWorker(repositories, browser, config);
const runtime = new WorkerRuntime({
  config,
  repositories,
  analytics,
  monitoring,
  exports: exportService,
  discovery,
  verification,
  submission,
  databaseHealthCheck: () => {
    database.prepare('SELECT 1').get();
  },
  closeDatabase: () => {
    database.close();
  }
});

const runOnce = process.argv.includes('--once');

process.on('SIGTERM', () => {
  void runtime.stop().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  void runtime.stop().then(() => process.exit(0));
});

try {
  if (runOnce) {
    await runtime.runOnce();
    await runtime.stop();
  } else {
    await runtime.start();
  }
} catch (error) {
  logger.error({ error }, 'music submission agent failed to start');
  await runtime.stop();
  process.exitCode = 1;
}
