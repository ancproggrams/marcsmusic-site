# Codex instructions — Music Submission Agent

## Scope
These instructions apply to `services/music-submission-agent/**`.

## Permanent ownership
Codex is the primary execution environment for this entire system from Run 427 onward. All future discovery, verification, enrichment, deduplication, browser inspection, queue generation, analytics updates, reports, tests and repository commits must be performed from Codex against the repository state.

Do not simulate a completed run in chat. Do not invent portal checks, commits, counts, screenshots or updated artifacts. A run is complete only when Codex has executed the workflow, generated evidence, updated the repository and committed the result.

Each invocation must continue from the highest committed run number. Determine the next run number from repository artifacts and Git history; never rely only on a prompt-supplied number. Use one run number consistently across seed files, JSON, CSV, reports, analytics and PR metadata.

## Objective
Maintain the MarcsMusic global music-submission discovery pipeline. Discover, verify, enrich, deduplicate and queue legitimate opportunities using only publicly available, authorized submission routes.

## Required recurring workflow
For every run:
1. Pull and inspect the current branch and identify the latest completed run.
2. Load the latest platform database, queue, analytics and daily report.
3. Discover new first-party submission opportunities from public sources.
4. Verify current platform activity and the authorized purpose of each route.
5. Inspect web portals passively with `vercel-labs/agent-browser`.
6. Verify business emails only through first-party publication, syntax and context/domain alignment.
7. Deduplicate against all prior records.
8. Classify each route and queue only legitimate opportunities.
9. Update the platform database, submission/review queue, analytics dashboard and reports.
10. Run build, tests, lint and data validation.
11. Commit the complete run and leave a clean worktree.
12. Update the existing Music Submission Agent pull request rather than creating a new PR for every run, unless explicitly instructed otherwise.

## Hard safety boundaries
- Never bypass CAPTCHA, Cloudflare, anti-bot controls, login, authentication, paywalls, payment requirements, platform restrictions or protected email obfuscation.
- Never submit a form, send an email, upload audio, create an account, make a payment or contact a platform unless a human explicitly authorizes that exact external side effect for that exact destination.
- Browser testing is passive by default: navigation, DOM inspection, field discovery, validation discovery and screenshots only.
- Do not click a final submit, send, publish, confirm, purchase or pay control.
- Mark any route involving CAPTCHA, login, payment, legal declarations, rights confirmation, account creation, OAuth, dynamic upload, ambiguous eligibility or uncertain AI-music policy as `needs_manual_review`.
- Do not perform SMTP, MX, catch-all or mailbox-level probing. Verify email addresses only through first-party publication, explicit business purpose, syntax and domain/context alignment.
- Do not decode, guess or infer protected or obfuscated email addresses.
- Respect robots directives, rate limits, platform terms and reasonable per-domain delays.
- Never use browser automation to evade a restriction or to impersonate a human reviewer.

## Browser tooling
Use `vercel-labs/agent-browser` for portal inspection and testing. Install and run it through repository scripts. Use low concurrency, per-domain throttling, bounded retries, timeouts, checkpoints and resumable shards.

For every portal test, record:
- canonical URL and final URL;
- HTTP/navigation outcome;
- page title and activity evidence;
- detected form fields and required fields;
- upload controls and accepted file types;
- CAPTCHA/login/payment indicators;
- legal, rights and AI-policy declarations;
- final submit control presence, without activating it;
- screenshot path;
- result status: `verified`, `needs_manual_review`, `inactive`, `blocked`, `duplicate` or `error`;
- concise evidence and timestamp.

Email-only and physical-only routes must also be tested as route-guidance pages, without sending messages or packages.

## Data outputs
Update or create the latest versions of:
- `data/run*-platform-database.json`
- `data/run*-review-queue.csv`
- `data/run*-analytics-dashboard.json`
- `reports/YYYY-MM-DD-run-*.md`
- `reports/daily_report.md`
- browser-test artifacts under `data/portal-browser-tests/`

Deduplicate on normalized platform name, canonical domain, canonical submission URL and authorized business email. Consolidate multiple routes from one platform unless they represent materially different submission programs.

Preserve provenance for every added or changed record. A platform may not be marked `verified` without first-party or browser-generated evidence captured during the current or a still-valid recent run.

## Validation
Before committing:
1. Run `npm ci` in this service when dependencies changed; otherwise use the existing lockfile.
2. Run `npm run build`.
3. Run `npm test`.
4. Run `npm run lint`.
5. Run the browser test in dry/passive mode against a representative smoke set before a full batch.
6. Confirm no final submission actions occurred.
7. Confirm generated JSON and CSV files parse successfully.
8. Validate unique IDs, canonical URLs, run numbers and aggregate counts.
9. Check `git diff` and `git status`.
10. Commit all intended changes and leave the worktree clean.

## Reporting
Every run report must state:
- run number and commit SHA;
- number of portals discovered and tested;
- verified routes;
- duplicates removed;
- `needs_manual_review` count and reasons;
- inactive/blocked/error count;
- forms, emails, login, CAPTCHA and payment counts;
- artifact and screenshot paths;
- whether any external side effect occurred;
- exact commands and tests executed;
- remaining limitations.

Do not claim a portal was tested unless the browser runner produced evidence for that portal. Do not claim repository changes, CI results or deployment results that were not actually observed.