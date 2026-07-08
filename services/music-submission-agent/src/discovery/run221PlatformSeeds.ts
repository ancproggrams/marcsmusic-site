import type { PlatformInput } from '../models/types.js';
import { run221BaseSeedPlatforms } from './run221BasePlatformSeeds.js';
import { run222SeedPlatforms } from './run222PlatformSeeds.js';

export const run221SeedPlatforms: PlatformInput[] = [
  ...run221BaseSeedPlatforms,
  ...run222SeedPlatforms
];
