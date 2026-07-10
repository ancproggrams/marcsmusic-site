import type { PlatformInput } from '../models/types.js';
import { run253BaseSeedPlatforms } from './run253BasePlatformSeeds.js';
import { run254SeedPlatforms } from './run254PlatformSeeds.js';

export const run253SeedPlatforms: PlatformInput[] = [
  ...run253BaseSeedPlatforms,
  ...run254SeedPlatforms
];
