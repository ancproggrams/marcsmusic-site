import type { PlatformInput } from '../models/types.js';

/**
 * Run 378 is a deduplication and re-verification run. It adds no new runtime
 * seed because KVRX and KALX are already represented by earlier canonical
 * records. Their current public policies are documented in the run artifacts.
 */
export const run378SeedPlatforms: PlatformInput[] = [];
