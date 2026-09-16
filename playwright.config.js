import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js',
  timeout: 20_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:31891',
    channel: 'chrome',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'env PORT=31891 BOOKING_SQLITE_PATH=.tmp/e2e.sqlite TRANSPARANTE_BROKER_SYNC_ENABLED=false node server.js',
    url: 'http://127.0.0.1:31891/api/health/live',
    reuseExistingServer: false,
    timeout: 15_000
  }
});
