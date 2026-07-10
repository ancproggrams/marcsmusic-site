# Acceptance Checklist

## Implemented In This Iteration

- [x] `npm run verify` passes.
- [x] Specs are written and versioned.
- [x] Modular platform registry exists.
- [x] Default 15 platforms remain exact.
- [x] `publication-service.mjs` resolves adapters through registry.
- [x] Multi-artist default artist exists.
- [x] Artist CRUD endpoints exist.
- [x] Release upload accepts MP3/WAV and JPG/PNG/WEBP.
- [x] Release upload rejects invalid files.
- [x] Checksums are generated.
- [x] Player sync creates idempotent manifest entries and direct download links.
- [x] EspoCRM segment service filters contacts and excludes suppressed contacts.
- [x] Mailgun campaign preview/test/send services exist.
- [x] Campaign send is guarded.
- [x] HTML dashboard is served at `/music/app`.
- [x] Railway and env docs are updated.

## Remaining Production Hardening

- [ ] Persist publication/campaign state in Railway MySQL or approved durable
      store instead of JSON files.
- [ ] Update production `public/index.html` player from manifest through
      an approved deployment workflow.
- [ ] Add Mailgun webhook event ingestion.
- [ ] Add real EspoCRM field mapping once production fields are confirmed.
