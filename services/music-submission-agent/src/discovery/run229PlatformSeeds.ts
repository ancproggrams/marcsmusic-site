import type { PlatformInput } from '../models/types.js';
import { run229BaseSeedPlatforms } from './run229BasePlatformSeeds.js';
import { run230SeedPlatforms } from './run230PlatformSeeds.js';

export const run229SeedPlatforms: PlatformInput[] = [
  ...run229BaseSeedPlatforms,
  ...run230SeedPlatforms
];
