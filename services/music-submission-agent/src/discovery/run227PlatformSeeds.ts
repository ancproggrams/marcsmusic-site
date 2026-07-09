import type { PlatformInput } from '../models/types.js';
import { run227BaseSeedPlatforms } from './run227BasePlatformSeeds.js';
import { run228SeedPlatforms } from './run228PlatformSeeds.js';

export const run227SeedPlatforms: PlatformInput[] = [
  ...run227BaseSeedPlatforms,
  ...run228SeedPlatforms
];
