import type { PlatformInput } from '../models/types.js';
import { run240BaseSeedPlatforms } from './run240BasePlatformSeeds.js';
import { run241SeedPlatforms } from './run241PlatformSeeds.js';

export const run240SeedPlatforms: PlatformInput[] = [
  ...run240BaseSeedPlatforms,
  ...run241SeedPlatforms
];
