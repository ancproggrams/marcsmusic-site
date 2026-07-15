-- migration: no-transaction
-- See 012_daily_report_query_indexes.sql. Keep concurrent DDL statements in
-- separate migrations so PostgreSQL never wraps them in an implicit block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS work_items_report_window_idx
  ON work_items (created_at)
  INCLUDE (status);
