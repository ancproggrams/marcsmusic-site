import type { PlatformInput } from '../models/types.js';
import { run215BaseSeedPlatforms } from './run215BasePlatformSeeds.js';
import { run216SeedPlatforms } from './run216PlatformSeeds.js';

export const run215SeedPlatforms: PlatformInput[] = [
  ...run215BaseSeedPlatforms,
  ...run216SeedPlatforms
];
