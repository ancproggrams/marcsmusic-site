import type { PlatformInput } from '../models/types.js';
import { run220BaseSeedPlatforms } from './run220BasePlatformSeeds.js';
import { run221SeedPlatforms } from './run221PlatformSeeds.js';

export const run220SeedPlatforms: PlatformInput[] = [
  ...run220BaseSeedPlatforms,
  ...run221SeedPlatforms
];
