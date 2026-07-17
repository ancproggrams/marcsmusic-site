# Codex recurring task — Music Submission Agent

Work in repository `ancproggrams/marcsmusic-site` on branch `music-submission-agent-service`.

Read and obey `services/music-submission-agent/AGENTS.md` before making changes.

## Permanent task

Operate the complete MarcsMusic music-submission system from the current repository state. This is not a one-time migration task. Every time this task is invoked, execute exactly one complete next run.

Determine the latest completed run from committed repository artifacts and Git history, then create the next sequential run. Do not hard-code Run 427 if a later run already exists.

## Execute one complete run

1. Synchronize the branch and inspect the current implementation, latest database, queue, dashboard, reports and browser evidence.
2. Discover legitimate global music-submission opportunities from first-party public sources.
3. Verify platform activity, authorized submission purpose, eligibility information and business contacts.
4. Use `vercel-labs/agent-browser` to inspect all newly found portals and a rotating validation sample of existing portals.
5. Browser activity must remain passive: navigate, inspect, detect fields, validate route state and capture evidence. Never activate the final submission action.
6. Detect and record:
   - canonical and final URLs;
   - accessibility and redirects;
   - current activity evidence;
   - form presence and field labels;
   - required fields and upload controls;
   - visible accepted file formats;
   - login, CAPTCHA, Cloudflare, payment and account requirements;
   - legal, rights, clean-content and AI-policy declarations;
   - final submit control presence without clicking it.
7. Verify business emails only through first-party plaintext publication, explicit purpose, syntax and domain/context alignment. Never probe mail servers or mailboxes.
8. Deduplicate using normalized platform name, canonical domain, canonical submission URL and authorized business email.
9. Classify CAPTCHA, login, payment, account, OAuth, legal declaration, rights confirmation, dynamic upload, unclear eligibility and uncertain AI-policy cases as `needs_manual_review`.
10. Update the next-run versions of:
    - platform database;
    - submission/review queue;
    - analytics dashboard;
    - detailed run report;
    - daily report;
    - browser JSON/CSV evidence and screenshots.
11. Keep all counts internally consistent and preserve source provenance.
12. Run build, tests, lint, JSON/CSV validation and the passive browser smoke suite.
13. Commit the full run to `music-submission-agent-service` and leave the worktree clean.
14. Update the existing Music Submission Agent PR title and body with the actual run number, commit, metrics, evidence and safety statement.

## Scaling the browser checks

- Start each run with a representative passive smoke set.
- Run newly discovered portals in full.
- Revalidate existing portals according to a rotation based on age, prior errors and manual-review risk.
- Use sharding, checkpoints, bounded retries, low concurrency and domain throttling.
- A blocked portal remains evidence of a restriction; do not attempt circumvention.

## Non-negotiable restrictions

- Do not submit any form.
- Do not send any email or direct message.
- Do not upload MarcsMusic audio, artwork or documents.
- Do not solve, outsource or bypass CAPTCHA.
- Do not log in, create accounts or use saved sessions.
- Do not pay, start checkout or bypass payment.
- Do not decode protected email addresses.
- Do not perform SMTP, MX, catch-all or mailbox probing.
- Do not claim a portal was tested without browser-generated evidence.
- Do not claim a run completed without a real repository commit.

## Required final response from Codex

Report only observed results:
- completed run number;
- commit SHA and branch;
- files changed;
- exact commands executed;
- portals discovered and tested;
- verified/manual-review/inactive/blocked/error/duplicate counts;
- form/email/login/CAPTCHA/payment counts;
- artifact and screenshot locations;
- build, test and lint outcomes;
- PR update status;
- explicit confirmation that no final submission or other unauthorized external side effect occurred.