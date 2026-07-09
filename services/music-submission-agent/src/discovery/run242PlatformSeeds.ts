import type { PlatformInput } from '../models/types.js';
import { run242BaseSeedPlatforms } from './run242BasePlatformSeeds.js';
import { run243SeedPlatforms } from './run243PlatformSeeds.js';

export const run242SeedPlatforms: PlatformInput[] = [
  ...run242BaseSeedPlatforms,
  ...run243SeedPlatforms
];
