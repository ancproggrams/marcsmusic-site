CREATE TABLE IF NOT EXISTS platforms (
  platform_id TEXT PRIMARY KEY,
  platform_name TEXT NOT NULL,
  category TEXT NOT NULL,
  country TEXT,
  language TEXT,
  genres TEXT,
  website TEXT NOT NULL,
  submission_url TEXT NOT NULL,
  submission_type TEXT,
  submission_guidelines TEXT,
  required_assets TEXT,
  fee_required TEXT,
  fee_amount TEXT,
  expected_review_time TEXT,
  source_url TEXT,
  verification_timestamp TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  automation_status TEXT NOT NULL DEFAULT 'discovered',
  manual_review_reason TEXT,
  contact_route TEXT,
  email_stored TEXT,
  email_verification_status TEXT,
  deliverability_score INTEGER,
  risk_score INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_queue (
  job_id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL,
  submission_url TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'queued',
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_timestamp TEXT NOT NULL,
  updated_timestamp TEXT NOT NULL,
  assigned_worker TEXT,
  next_retry TEXT,
  last_error TEXT,
  FOREIGN KEY(platform_id) REFERENCES platforms(platform_id)
);

CREATE TABLE IF NOT EXISTS submission_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT,
  platform_id TEXT,
  event_type TEXT NOT NULL,
  message TEXT,
  data_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platforms_url ON platforms(website, submission_url);
CREATE INDEX IF NOT EXISTS idx_platforms_status ON platforms(automation_status);
CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON submission_queue(status, priority DESC);
