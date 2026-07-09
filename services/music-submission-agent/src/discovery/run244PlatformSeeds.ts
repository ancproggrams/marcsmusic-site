import type { PlatformInput } from '../models/types.js';
import { run244BaseSeedPlatforms } from './run244BasePlatformSeeds.js';
import { run245SeedPlatforms } from './run245PlatformSeeds.js';

export const run244SeedPlatforms: PlatformInput[] = [
  ...run244BaseSeedPlatforms,
  ...run245SeedPlatforms
];
