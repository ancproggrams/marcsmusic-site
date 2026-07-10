import type { PlatformInput } from '../models/types.js';
import { run255BaseSeedPlatforms } from './run255BasePlatformSeeds.js';
import { run256SeedPlatforms } from './run256PlatformSeeds.js';

export const run255SeedPlatforms: PlatformInput[] = [
  ...run255BaseSeedPlatforms,
  ...run256SeedPlatforms
];
