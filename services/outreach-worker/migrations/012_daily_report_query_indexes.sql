-- migration: no-transaction
-- Built without blocking production writes. IF NOT EXISTS makes a crash
-- between index creation and schema_migrations recording safe to replay under
-- the migration advisory lock. One concurrent DDL statement per migration is
-- required because PostgreSQL treats a multi-statement query as a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS outcome_events_report_window_idx
  ON outcome_events (occurred_at)
  INCLUDE (event_type, send_queue_id);
