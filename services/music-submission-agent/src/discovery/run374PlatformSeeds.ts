import type { PlatformInput } from '../models/types.js';

// Run 374 is a deduplication and enrichment correction.
// KEXP was already represented by the canonical Run 39 record and was
// repeatedly rediscovered under renamed but semantically identical routes.
// No new unique platform seed is added in this run.
export const run374SeedPlatforms: PlatformInput[] = [];
