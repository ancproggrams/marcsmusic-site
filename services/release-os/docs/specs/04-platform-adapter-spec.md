# Platform Adapter Spec

Each adapter exports:

```js
{
  capability,
  async publish({ release, artist, platformAccount, action, dryRun, env, fetch }) {}
}
```

Default platform IDs:

Audiomack, Audius, Bandcamp, BandLab, Drooble, HearThis, Hypeddit, Jamendo,
Linktree, N1M, Podomatic, ReverbNation, SoundClick, SoundCloud, Spreaker.

## Rules

- SoundCloud and Spreaker are executable adapters.
- Audius returns dry-run SDK steps and blocks real execution until Node >=22 or
  an isolated compatible worker exists.
- Jamendo returns a research/contract-check manual task.
- Platforms without confirmed public upload API return manual tasks.
- Missing artist platform account blocks executable adapters.
- Dry-run must work without credentials.

