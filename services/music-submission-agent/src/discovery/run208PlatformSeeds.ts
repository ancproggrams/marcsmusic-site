import type { PlatformInput } from '../models/types.js';
import { run209SeedPlatforms } from './run209PlatformSeeds.js';
import { run208BaseSeedPlatforms } from './run208BasePlatformSeeds.js';

export const run208SeedPlatforms: PlatformInput[] = [
  ...run209SeedPlatforms,
  ...run208BaseSeedPlatforms,
];
