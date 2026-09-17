import { loadConfig } from "../config.mjs";
import { createPostgresPool, runMigrations } from "../infrastructure/postgres.mjs";

const config = loadConfig();
const pool = createPostgresPool(config.database);
try {
  await runMigrations(pool);
} finally {
  await pool.end();
}
