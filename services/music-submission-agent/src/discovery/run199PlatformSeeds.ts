import type { PlatformInput } from '../models/types.js';
import { run200SeedPlatforms } from './run200PlatformSeeds.js';
import { run199BaseSeedPlatforms } from './run199BasePlatformSeeds.js';

export const run199SeedPlatforms: PlatformInput[] = [
  ...run200SeedPlatforms,
  ...run199BaseSeedPlatforms
];
