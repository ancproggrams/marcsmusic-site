import type { PlatformInput } from '../models/types.js';
import { run214SeedPlatforms as run214BaseSeedPlatforms } from './run214BasePlatformSeeds.js';
import { run215SeedPlatforms } from './run215PlatformSeeds.js';

export const run214SeedPlatforms: PlatformInput[] = [
  ...run214BaseSeedPlatforms,
  ...run215SeedPlatforms,
];
