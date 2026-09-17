# DJ source crawler

This Railway cron service performs a bounded live read of all 27 configured
public sources. It uses HTTPS only, rejects non-public DNS answers, follows at
most three redirects, honors `robots.txt`, applies a per-host delay, caps
response size and records counts rather than raw addresses in logs.

An address is emitted only when the public page labels it as an explicit music
submission, promotional or press route. That live page evidence is marked as
source-verified, while Mailgun remains the independent deliverability gate.
Booking, management, generic business, unlabelled and denied routes remain
held. The crawler never sends mail.

The service writes its durable state and private report to `/data` and posts
signed `dj-finder` artifacts to the outreach worker. The worker performs the
Mailgun validation step; only exact `Valid` results can pass the later outreach
eligibility gates, which also require locale, outlet, release and suppression
checks.

Required Railway variables:

```text
SOURCE_CRAWL_ENABLED=true
SOURCE_CRAWL_REGISTRY=/app/sources.json
SOURCE_CRAWL_DATA_DIR=/data
OUTREACH_SOURCE_PUBLISH_ENABLED=true
OUTREACH_SOURCE_INGESTION_BASE_URL=https://outreach-worker-production-production.up.railway.app
OUTREACH_SOURCE_SIGNING_KEY_ID=dj-crawler-2026-07
OUTREACH_SOURCE_SIGNING_KEY=<Railway secret; unique 32+ characters>
```

The signing key is also registered in the outreach worker's
`SOURCE_INGESTION_KEYRINGS_JSON`. Never put it in Git, logs or a fixture.
