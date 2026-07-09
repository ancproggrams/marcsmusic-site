import type { PlatformInput } from '../models/types.js';
import { run236BaseSeedPlatforms } from './run236BasePlatformSeeds.js';
import { run237SeedPlatforms } from './run237PlatformSeeds.js';

export const run236SeedPlatforms: PlatformInput[] = [
  ...run236BaseSeedPlatforms,
  ...run237SeedPlatforms
];
