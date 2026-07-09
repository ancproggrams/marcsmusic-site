import type { PlatformInput } from '../models/types.js';
import { run228BaseSeedPlatforms } from './run228BasePlatformSeeds.js';
import { run229SeedPlatforms } from './run229PlatformSeeds.js';

export const run228SeedPlatforms: PlatformInput[] = [
  ...run228BaseSeedPlatforms,
  ...run229SeedPlatforms
];
