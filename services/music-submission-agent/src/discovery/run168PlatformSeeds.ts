import type { PlatformInput } from '../models/types.js';
import { run168BaseSeedPlatforms } from './run168BasePlatformSeeds.js';
import { run169SeedPlatforms } from './run169PlatformSeeds.js';

export const run168SeedPlatforms: PlatformInput[] = [
  ...run169SeedPlatforms,
  ...run168BaseSeedPlatforms,
];
