import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const compiledSchemaPath = join(moduleDir, 'schema.sql');
const sourceSchemaPath = join(process.cwd(), 'src/db/schema.sql');

export type SqliteDatabase = Database.Database;

export function openDatabase(databasePath: string): SqliteDatabase {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  return database;
}

export function initializeDatabase(database: SqliteDatabase): void {
  const schemaPath = existsSync(compiledSchemaPath) ? compiledSchemaPath : sourceSchemaPath;
  const schema = readFileSync(schemaPath, 'utf8');
  database.exec(schema);
}

export function createInitializedDatabase(databasePath: string): SqliteDatabase {
  const database = openDatabase(databasePath);
  initializeDatabase(database);
  return database;
}
