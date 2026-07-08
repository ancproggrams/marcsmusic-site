import type { PlatformInput } from '../models/types.js';
import { run201SeedPlatforms } from './run201PlatformSeeds.js';
import { run200BaseSeedPlatforms } from './run200BasePlatformSeeds.js';

export const run200SeedPlatforms: PlatformInput[] = [
  ...run201SeedPlatforms,
  ...run200BaseSeedPlatforms
];
