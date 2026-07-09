import type { PlatformInput } from '../models/types.js';
import { run239BaseSeedPlatforms } from './run239BasePlatformSeeds.js';
import { run240SeedPlatforms } from './run240PlatformSeeds.js';

export const run239SeedPlatforms: PlatformInput[] = [
  ...run239BaseSeedPlatforms,
  ...run240SeedPlatforms
];
