import type { PlatformInput } from '../models/types.js';
import { run204SeedPlatforms } from './run204PlatformSeeds.js';
import { run203BaseSeedPlatforms } from './run203BasePlatformSeeds.js';

export const run203SeedPlatforms: PlatformInput[] = [
  ...run204SeedPlatforms,
  ...run203BaseSeedPlatforms
];
