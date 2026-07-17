# Codex task — move the Music Submission Agent run to Codex

Work in repository `ancproggrams/marcsmusic-site` on branch `music-submission-agent-service`.

Read and obey `services/music-submission-agent/AGENTS.md` before making changes.

## Task

Take over the recurring MarcsMusic music-submission workflow from Run 426 onward.

1. Inspect the current service implementation, latest run database, review queue, analytics dashboard and daily report.
2. Integrate `https://github.com/vercel-labs/agent-browser` as the browser engine for passive portal testing.
3. Build a deterministic runner that reads all current platform records, resolves their canonical submission URLs and tests portals without performing a final submission.
4. Start with a representative smoke set, including:
   - Brum Radio submission form;
   - WWPV email-only route;
   - KAOS submission guidance;
   - KCR submission guidance;
   - one login-gated route;
   - one CAPTCHA or anti-bot-protected route;
   - one payment-gated route when already present in the database.
5. Then support sharded full-database runs with resume/checkpoint capability, low concurrency, domain throttling, timeouts and retries.
6. Detect and record:
   - accessible/inaccessible status;
   - redirects and canonical URL;
   - visible activity evidence;
   - submission form presence;
   - field labels, required fields and upload controls;
   - accepted file extensions when visible;
   - login, CAPTCHA, Cloudflare, payment and legal/manual declarations;
   - final submit control presence, but never activate it.
7. Map results back into the platform database and queue. Use `needs_manual_review` for any login, CAPTCHA, payment, legal declaration, rights confirmation, dynamic upload, unclear eligibility or uncertain AI-music policy.
8. Deduplicate records using normalized name, canonical domain, canonical submission URL and authorized email.
9. Produce/update:
   - platform database;
   - submission/review queue;
   - analytics dashboard;
   - daily report;
   - per-portal JSON/CSV results;
   - screenshots for browser-tested portals.
10. Add tests for classification, deduplication, redaction, result serialization and the prohibition on final-submit actions.
11. Run build, tests and lint. Commit all changes and leave the worktree clean.

## Non-negotiable restrictions

- Do not submit any portal form.
- Do not send any email.
- Do not upload MarcsMusic audio or artwork.
- Do not solve or bypass CAPTCHA.
- Do not log in or create accounts.
- Do not pay or bypass payment.
- Do not decode protected email addresses.
- Do not perform SMTP/MX/mailbox probing.
- Do not claim a test succeeded without browser-generated evidence.

## Expected final response

Report:
- commit SHA;
- files changed;
- exact commands executed;
- number of portals tested;
- verified/manual-review/blocked/error counts;
- screenshots and result-file locations;
- tests and lint outcomes;
- explicit confirmation that no final submission or other external side effect occurred.