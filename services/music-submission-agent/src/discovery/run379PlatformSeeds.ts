import type { PlatformInput } from '../models/types.js';

/**
 * Run 379 repeated WREK and WPRB records that were already present in the
 * historical submission dataset as Run 109 canonical records. Run 380 retired
 * these duplicate runtime seeds after full pull-request patch inspection. The
 * original Run 379 data and report remain available as audit evidence.
 */
export const run379SeedPlatforms: PlatformInput[] = [];
