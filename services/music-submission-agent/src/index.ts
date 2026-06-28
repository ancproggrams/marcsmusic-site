import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { config } from './config.js';
import { discoveredPlatforms, type SubmissionPlatform } from './data/discovered-platforms.js';

const generatedAt = new Date().toISOString();

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: SubmissionPlatform[]): string {
  const headers = [
    'id',
    'name',
    'category',
    'country',
    'submission_url',
    'activity_status',
    'verification_status',
    'queue_status',
    'manual_review_reasons',
    'fee_required',
    'login_required',
    'captcha_detected',
    'payment_required',
    'genre_fit',
    'confidence_score',
    'priority_score',
    'notes'
  ];
  const lines = rows.map((platform) => [
    platform.id,
    platform.name,
    platform.category,
    platform.country,
    platform.submissionUrl,
    platform.activityStatus,
    platform.verificationStatus,
    platform.queueStatus,
    platform.manualReviewReasons,
    platform.feeRequired,
    platform.loginRequired,
    platform.captchaDetected,
    platform.paymentRequired,
    platform.genreFit,
    platform.confidenceScore,
    platform.priorityScore,
    platform.notes
  ].map(csvEscape).join(','));
  return [headers.join(','), ...lines].join('\n');
}

function createSubmissionQueue() {
  return discoveredPlatforms
    .slice()
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((platform, index) => ({
      job_id: `MSQ-${String(index + 1).padStart(4, '0')}`,
      platform_id: platform.id,
      platform_slug: platform.slug,
      platform_name: platform.name,
      status: platform.queueStatus,
      priority_score: platform.priorityScore,
      reason: platform.manualReviewReasons.length > 0 ? platform.manualReviewReasons.join('; ') : 'ready_for_safe_browser_form_mapping',
      auto_submit_allowed: config.autoSubmitEnabled && platform.queueStatus === 'queued',
      created_at: generatedAt,
      updated_at: generatedAt
    }));
}

function createAnalytics(queue: ReturnType<typeof createSubmissionQueue>) {
  return {
    generated_at: generatedAt,
    total_platforms_discovered: discoveredPlatforms.length,
    verified_public_routes: discoveredPlatforms.filter((platform) => platform.verificationStatus === 'verified_public_route').length,
    queued: queue.filter((job) => job.status === 'queued').length,
    needs_manual_review: queue.filter((job) => job.status === 'needs_manual_review').length,
    auto_submit_enabled: config.autoSubmitEnabled,
    smtp_probe_performed: false,
    mx_probe_performed: false,
    login_required_count: discoveredPlatforms.filter((platform) => platform.loginRequired).length,
    payment_required_count: discoveredPlatforms.filter((platform) => platform.paymentRequired).length,
    captcha_detected_count: discoveredPlatforms.filter((platform) => platform.captchaDetected).length,
    free_public_candidate_count: discoveredPlatforms.filter(
      (platform) => !platform.feeRequired && !platform.loginRequired && !platform.paymentRequired && platform.queueStatus === 'queued'
    ).length,
    top_queue_ready: queue.filter((job) => job.status === 'queued').slice(0, 5).map((job) => job.platform_name)
  };
}

function writeSqliteDatabase(exportDir: string, queue: ReturnType<typeof createSubmissionQueue>) {
  const db = new Database(`${exportDir}/verified_submission_platforms.sqlite`);
  db.exec(`
    DROP TABLE IF EXISTS contacts;
    DROP TABLE IF EXISTS submission_queue;
    DROP TABLE IF EXISTS platforms;
    CREATE TABLE platforms (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      country TEXT NOT NULL,
      submission_url TEXT NOT NULL,
      evidence_url TEXT NOT NULL,
      activity_status TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      queue_status TEXT NOT NULL,
      manual_review_reasons TEXT NOT NULL,
      fee_required INTEGER NOT NULL,
      login_required INTEGER NOT NULL,
      captcha_detected INTEGER NOT NULL,
      payment_required INTEGER NOT NULL,
      genre_fit TEXT NOT NULL,
      confidence_score INTEGER NOT NULL,
      priority_score INTEGER NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id TEXT NOT NULL REFERENCES platforms(id),
      email TEXT NOT NULL,
      verification TEXT NOT NULL,
      role_account INTEGER NOT NULL,
      syntax_valid INTEGER NOT NULL,
      smtp_probe_performed INTEGER NOT NULL,
      mx_probe_performed INTEGER NOT NULL,
      deliverability_score INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE submission_queue (
      job_id TEXT PRIMARY KEY,
      platform_id TEXT NOT NULL REFERENCES platforms(id),
      platform_slug TEXT NOT NULL,
      platform_name TEXT NOT NULL,
      status TEXT NOT NULL,
      priority_score INTEGER NOT NULL,
      reason TEXT NOT NULL,
      auto_submit_allowed INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_platforms_status ON platforms(queue_status);
    CREATE INDEX idx_submission_queue_status ON submission_queue(status);
  `);

  const insertPlatform = db.prepare(`
    INSERT INTO platforms VALUES (
      @id, @slug, @name, @category, @country, @submission_url, @evidence_url, @activity_status,
      @verification_status, @queue_status, @manual_review_reasons, @fee_required, @login_required,
      @captcha_detected, @payment_required, @genre_fit, @confidence_score, @priority_score,
      @notes, @created_at, @updated_at
    )
  `);
  const insertContact = db.prepare(`
    INSERT INTO contacts (
      platform_id, email, verification, role_account, syntax_valid, smtp_probe_performed,
      mx_probe_performed, deliverability_score, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertJob = db.prepare(`
    INSERT INTO submission_queue VALUES (
      @job_id, @platform_id, @platform_slug, @platform_name, @status, @priority_score,
      @reason, @auto_submit_allowed, @created_at, @updated_at
    )
  `);

  const tx = db.transaction(() => {
    for (const platform of discoveredPlatforms) {
      insertPlatform.run({
        id: platform.id,
        slug: platform.slug,
        name: platform.name,
        category: platform.category,
        country: platform.country,
        submission_url: platform.submissionUrl,
        evidence_url: platform.evidenceUrl,
        activity_status: platform.activityStatus,
        verification_status: platform.verificationStatus,
        queue_status: platform.queueStatus,
        manual_review_reasons: platform.manualReviewReasons.join('; '),
        fee_required: Number(platform.feeRequired),
        login_required: Number(platform.loginRequired),
        captcha_detected: Number(platform.captchaDetected),
        payment_required: Number(platform.paymentRequired),
        genre_fit: platform.genreFit.join('; '),
        confidence_score: platform.confidenceScore,
        priority_score: platform.priorityScore,
        notes: platform.notes,
        created_at: generatedAt,
        updated_at: generatedAt
      });
      for (const contact of platform.contacts) {
        insertContact.run(
          platform.id,
          contact.email,
          contact.verification,
          Number(contact.roleAccount),
          Number(contact.syntaxValid),
          Number(contact.smtpProbePerformed),
          Number(contact.mxProbePerformed),
          contact.deliverabilityScore,
          generatedAt,
          generatedAt
        );
      }
    }
    for (const job of queue) {
      insertJob.run({ ...job, auto_submit_allowed: Number(job.auto_submit_allowed) });
    }
  });
  tx();
  db.close();
}

function createDailyReport(analytics: ReturnType<typeof createAnalytics>, queue: ReturnType<typeof createSubmissionQueue>): string {
  const ready = queue.filter((job) => job.status === 'queued');
  const manual = queue.filter((job) => job.status === 'needs_manual_review');
  return `# MarcsMusic Music Submission Agent Daily Report\n\nGenerated: ${generatedAt}\n\n## Summary\n\n- Platforms discovered/enriched: ${analytics.total_platforms_discovered}\n- Verified public routes: ${analytics.verified_public_routes}\n- Ready for safe browser form mapping: ${analytics.queued}\n- Needs manual review: ${analytics.needs_manual_review}\n- Login-required cases: ${analytics.login_required_count}\n- Payment-required cases: ${analytics.payment_required_count}\n- CAPTCHA detected: ${analytics.captcha_detected_count}\n\n## Ready Queue\n\n${ready.map((job) => `- ${job.platform_name} (${job.platform_slug}) — priority ${job.priority_score}`).join('\n') || '- None'}\n\n## Manual Review Queue\n\n${manual.map((job) => `- ${job.platform_name}: ${job.reason}`).join('\n')}\n\n## Safety Notes\n\nNo CAPTCHA, login, payment, authentication, or platform restriction bypass was attempted. SMTP probing and MX probing were not performed in this run. Published business emails were syntax-checked only.\n`;
}

function exportData() {
  mkdirSync(config.exportDir, { recursive: true });
  const queue = createSubmissionQueue();
  const analytics = createAnalytics(queue);

  writeFileSync(`${config.exportDir}/verified_submission_platforms.json`, JSON.stringify(discoveredPlatforms, null, 2));
  writeFileSync(`${config.exportDir}/verified_submission_platforms.csv`, toCsv(discoveredPlatforms));
  writeFileSync(`${config.exportDir}/submission_queue.json`, JSON.stringify(queue, null, 2));
  writeFileSync(`${config.exportDir}/analytics_dashboard.json`, JSON.stringify(analytics, null, 2));
  writeFileSync(`${config.exportDir}/daily_report.md`, createDailyReport(analytics, queue));
  writeSqliteDatabase(config.exportDir, queue);

  return analytics;
}

const dashboard = exportData();
console.log(JSON.stringify(dashboard));

createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  if (req.url === '/platforms') {
    res.end(JSON.stringify(discoveredPlatforms));
    return;
  }
  if (req.url === '/queue') {
    res.end(JSON.stringify(createSubmissionQueue()));
    return;
  }
  if (req.url === '/analytics' || req.url === '/metrics' || req.url === '/health') {
    res.end(JSON.stringify({ ok: true, ...dashboard }));
    return;
  }
  res.end(JSON.stringify({ ok: true, service: 'music-submission-agent', routes: ['/health', '/metrics', '/analytics', '/queue', '/platforms'] }));
}).listen(Number(process.env.PORT ?? 3000));
