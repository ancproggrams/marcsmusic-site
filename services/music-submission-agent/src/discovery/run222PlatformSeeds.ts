import type { PlatformInput } from '../models/types.js';
import { run222BaseSeedPlatforms } from './run222BasePlatformSeeds.js';
import { run223SeedPlatforms } from './run223PlatformSeeds.js';

export const run222SeedPlatforms: PlatformInput[] = [
  ...run222BaseSeedPlatforms,
  ...run223SeedPlatforms
];
