import type { PlatformInput } from '../models/types.js';
import { run235BaseSeedPlatforms } from './run235BasePlatformSeeds.js';
import { run236SeedPlatforms } from './run236PlatformSeeds.js';

export const run235SeedPlatforms: PlatformInput[] = [
  ...run235BaseSeedPlatforms,
  ...run236SeedPlatforms
];
