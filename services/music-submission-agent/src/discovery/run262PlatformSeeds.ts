import type { PlatformInput } from '../models/types.js';
import { run262BaseSeedPlatforms } from './run262BasePlatformSeeds.js';
import { run263SeedPlatforms } from './run263PlatformSeeds.js';

export const run262SeedPlatforms: PlatformInput[] = [
  ...run262BaseSeedPlatforms,
  ...run263SeedPlatforms
];
