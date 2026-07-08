import type { PlatformInput } from '../models/types.js';
import { run202SeedPlatforms } from './run202PlatformSeeds.js';
import { run201BaseSeedPlatforms } from './run201BasePlatformSeeds.js';

export const run201SeedPlatforms: PlatformInput[] = [
  ...run202SeedPlatforms,
  ...run201BaseSeedPlatforms
];
