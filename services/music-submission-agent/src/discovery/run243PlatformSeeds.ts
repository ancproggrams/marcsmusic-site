import type { PlatformInput } from '../models/types.js';
import { run243BaseSeedPlatforms } from './run243BasePlatformSeeds.js';
import { run244SeedPlatforms } from './run244PlatformSeeds.js';

export const run243SeedPlatforms: PlatformInput[] = [
  ...run243BaseSeedPlatforms,
  ...run244SeedPlatforms
];
