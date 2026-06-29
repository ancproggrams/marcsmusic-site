import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { createInitializedDatabase } from '../src/db/database.js';
import { createRepositories, type Repositories } from '../src/db/repositories.js';

export interface TestContext {
  dir: string;
  database: Database.Database;
  repositories: Repositories;
  cleanup: () => void;
}

export function createTestContext(): TestContext {
  const dir = mkdtempSync(join(tmpdir(), 'music-agent-'));
  const database = createInitializedDatabase(join(dir, 'test.sqlite'));
  const repositories = createRepositories(database);

  return {
    dir,
    database,
    repositories,
    cleanup: () => {
      database.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
