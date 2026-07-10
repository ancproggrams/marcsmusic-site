import type { PlatformInput } from '../models/types.js';
import { run252BaseSeedPlatforms } from './run252BasePlatformSeeds.js';
import { run253SeedPlatforms } from './run253PlatformSeeds.js';

export const run252SeedPlatforms: PlatformInput[] = [
  ...run252BaseSeedPlatforms,
  ...run253SeedPlatforms
];
