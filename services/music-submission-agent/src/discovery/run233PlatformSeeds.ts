import type { PlatformInput } from '../models/types.js';
import { run233BaseSeedPlatforms } from './run233BasePlatformSeeds.js';
import { run234SeedPlatforms } from './run234PlatformSeeds.js';

export const run233SeedPlatforms: PlatformInput[] = [
  ...run233BaseSeedPlatforms,
  ...run234SeedPlatforms
];
