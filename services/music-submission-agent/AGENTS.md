# Codex instructions — Music Submission Agent

## Scope
These instructions apply to `services/music-submission-agent/**`.

## Objective
Maintain the MarcsMusic global music-submission discovery pipeline. Discover, verify, enrich, deduplicate and queue legitimate opportunities using only publicly available, authorized submission routes.

## Hard safety boundaries
- Never bypass CAPTCHA, Cloudflare, anti-bot controls, login, authentication, paywalls, payment requirements, platform restrictions or protected email obfuscation.
- Never submit a form, send an email, upload audio, create an account, make a payment or contact a platform unless the task explicitly authorizes that exact external side effect.
- Browser testing is passive by default: navigation, DOM inspection, field discovery, validation discovery and screenshots only.
- Do not click a final submit/send/pay button.
- Mark any route involving CAPTCHA, login, payment, legal declarations, rights confirmation, account creation, OAuth, dynamic upload, ambiguous eligibility or uncertain AI-music policy as `needs_manual_review`.
- Do not perform SMTP, MX, catch-all or mailbox-level probing. Verify email addresses only through first-party publication, explicit business purpose, syntax and domain/context alignment.
- Do not decode, guess or infer protected or obfuscated email addresses.

## Browser tooling
Use `vercel-labs/agent-browser` for portal inspection and testing. Install and run it through the repository scripts. Respect robots, rate limits and platform terms. Use low concurrency and per-domain delays.

For every portal test, record:
- canonical URL and final URL;
- HTTP/navigation outcome;
- page title and activity evidence;
- detected form fields and required fields;
- upload controls and accepted file types;
- CAPTCHA/login/payment indicators;
- final submit control presence, without activating it;
- screenshot path;
- result status: `verified`, `needs_manual_review`, `inactive`, `blocked`, `duplicate` or `error`;
- concise evidence and timestamp.

## Data outputs
Update or create the latest versions of:
- `data/run*-platform-database.json`
- `data/run*-review-queue.csv`
- `data/run*-analytics-dashboard.json`
- `reports/YYYY-MM-DD-run-*.md`
- `reports/daily_report.md`
- browser-test artifacts under `data/portal-browser-tests/`

Deduplicate on normalized platform name, canonical domain, canonical submission URL and authorized business email. Consolidate multiple routes from one platform unless they represent materially different submission programs.

## Validation
Before committing:
1. Run `npm ci` in this service when dependencies changed; otherwise use the existing lockfile.
2. Run `npm run build`.
3. Run `npm test`.
4. Run `npm run lint`.
5. Run the browser test in dry/passive mode against a small representative sample before a full batch.
6. Confirm no final submission actions occurred.
7. Confirm generated JSON and CSV files parse successfully.
8. Check `git status` and commit all intended changes.

## Reporting
Every run report must state:
- number of portals tested;
- verified routes;
- duplicates removed;
- `needs_manual_review` count and reasons;
- inactive/blocked/error count;
- forms, emails, login, CAPTCHA and payment counts;
- whether any external side effect occurred;
- commands and tests executed;
- remaining limitations.

Do not claim a portal was tested unless the browser runner produced evidence for that portal.