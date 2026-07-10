import type { PlatformInput } from '../models/types.js';
import { run261BaseSeedPlatforms } from './run261BasePlatformSeeds.js';
import { run262SeedPlatforms } from './run262PlatformSeeds.js';

export const run261SeedPlatforms: PlatformInput[] = [
  ...run261BaseSeedPlatforms,
  ...run262SeedPlatforms
];
