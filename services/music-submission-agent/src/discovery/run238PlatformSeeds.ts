import type { PlatformInput } from '../models/types.js';
import { run238BaseSeedPlatforms } from './run238BasePlatformSeeds.js';
import { run239SeedPlatforms } from './run239PlatformSeeds.js';

export const run238SeedPlatforms: PlatformInput[] = [
  ...run238BaseSeedPlatforms,
  ...run239SeedPlatforms
];