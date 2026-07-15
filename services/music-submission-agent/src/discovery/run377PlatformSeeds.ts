import type { PlatformInput } from '../models/types.js';

/**
 * Run 377 originally repeated KVRX and KALX records that already existed in
 * the historical submission dataset. Run 378 retired those duplicate runtime
 * seeds after full pull-request patch inspection. The original run artifacts
 * remain available as audit evidence, but no duplicate platform is exported.
 */
export const run377SeedPlatforms: PlatformInput[] = [];
