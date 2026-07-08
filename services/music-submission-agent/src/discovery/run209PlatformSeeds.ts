import type { PlatformInput } from '../models/types.js';
import { run210SeedPlatforms } from './run210PlatformSeeds.js';
import { run209BaseSeedPlatforms } from './run209BasePlatformSeeds.js';

export const run209SeedPlatforms: PlatformInput[] = [
  ...run210SeedPlatforms,
  ...run209BaseSeedPlatforms,
];
