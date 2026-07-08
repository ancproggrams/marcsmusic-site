import type { PlatformInput } from '../models/types.js';
import { run203SeedPlatforms } from './run203PlatformSeeds.js';
import { run202BaseSeedPlatforms } from './run202BasePlatformSeeds.js';

export const run202SeedPlatforms: PlatformInput[] = [
  ...run203SeedPlatforms,
  ...run202BaseSeedPlatforms
];
