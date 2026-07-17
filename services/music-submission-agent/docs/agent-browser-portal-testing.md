# Agent-browser portal testing

The music-submission agent uses [`vercel-labs/agent-browser`](https://github.com/vercel-labs/agent-browser) to inspect the currently discovered HTTP(S) submission portals.

## Safety contract

The runner is deliberately **inspect-only**:

- opens the authorized public portal URL;
- waits for the DOM;
- captures an accessibility snapshot, title, final URL, console summary, page-error summary and screenshot;
- detects forms, file uploads, submit controls, CAPTCHA/human checks, login boundaries, payment wording and rights/consent language;
- marks every interactive route as `needs_manual_review`;
- never fills a field;
- never clicks a button;
- never uploads a file;
- never submits a form;
- never accepts cookies or legal terms;
- never attempts a login;
- never solves or bypasses a CAPTCHA;
- never starts a payment.

The browser is started with content-boundary markers, output limits, isolated sessions and a target-domain allowlist. Third-party resources outside the target domain can therefore fail closed; this is recorded as a manual-review condition rather than worked around.

## Local use

Install the current pinned CLI and browser:

```bash
npm install --global agent-browser@0.31.2
agent-browser install --with-deps
agent-browser doctor --json
```

Run a small sample:

```bash
cd services/music-submission-agent
AGENT_BROWSER_BIN=agent-browser npm run portal:test:sample
```

Run all unique HTTP(S) portals discovered in `data/run*-platform-database.json`:

```bash
AGENT_BROWSER_BIN=agent-browser npm run portal:test
```

Useful options:

```bash
node scripts/test-portals-with-agent-browser.mjs \
  --shard-index 0 \
  --shard-count 8 \
  --limit 0 \
  --delay 2000 \
  --timeout 30000 \
  --screenshots true
```

Results are written to `data/portal-browser-tests/` as JSON, CSV, Markdown and screenshots. The directory is intentionally ignored by Git because screenshots and rendered page content may contain transient or untrusted third-party material.

## GitHub Actions

`.github/workflows/music-submission-portal-browser-tests.yml` runs the inspect-only test across parallel shards on relevant branch updates and can also be launched manually. Each shard uploads its results as a short-lived workflow artifact.

A portal remains suitable for unattended processing only when a separate, reviewed implementation proves that no login, CAPTCHA, payment, legal consent, rights declaration, personal-data disclosure or other protected/manual action is required. The current runner never declares an auto-submit candidate.
