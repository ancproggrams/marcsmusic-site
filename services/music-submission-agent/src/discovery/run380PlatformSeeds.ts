import type { PlatformInput } from '../models/types.js';

/**
 * Run 380 is a deduplication and re-verification run. It adds no new runtime
 * seed because WREK and WPRB are already represented by canonical Run 109
 * records. Their current public policies are documented in the run artifacts.
 */
export const run380SeedPlatforms: PlatformInput[] = [];
