import type { PlatformInput } from '../models/types.js';
import { run216BaseSeedPlatforms } from './run216BasePlatformSeeds.js';
import { run217SeedPlatforms } from './run217PlatformSeeds.js';

export const run216SeedPlatforms: PlatformInput[] = [
  ...run216BaseSeedPlatforms,
  ...run217SeedPlatforms
];
