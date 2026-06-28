# Operations Guide

## Purpose

This service is the Railway container foundation for the MarcsMusic submission agent.

It currently provides:

- a separate service folder;
- Docker build support;
- a health endpoint;
- seed discovery output;
- queue export output;
- analytics dashboard output;
- daily report output;
- manual-review-first safety behavior.

## Safety gate

Keep automatic submission disabled until these are present:

1. approved track assets;
2. approved pitch text;
3. approved form template;
4. connected browser executor;
5. confirmed platform rules;
6. per-platform rate limits.

## Manual review cases

Escalate instead of automating when a route requires:

- account access;
- payment;
- human label fit judgment;
- unclear rights;
- protected forms;
- personal signature/address fields;
- unsupported upload controls.

## Railway

Set the Railway service root to:

```txt
services/music-submission-agent
```

Recommended variables:

```env
DATABASE_PATH=/data/submissions.sqlite
EXPORT_DIR=/data/exports
WORKER_MODE=all
AUTO_SUBMIT_ENABLED=false
ARTIST_NAME=MarcsMusic
ARTIST_EMAIL=marc@marcsmusic.nl
```

## Next implementation step

Replace the seed platform list with live discovery modules and connect the Vercel Agent Browser executor as a separate adapter. Keep all protected flows marked for manual review.
