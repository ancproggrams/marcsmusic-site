import type { PlatformInput } from '../models/types.js';
import { run232BaseSeedPlatforms } from './run232BasePlatformSeeds.js';
import { run233SeedPlatforms } from './run233PlatformSeeds.js';

export const run232SeedPlatforms: PlatformInput[] = [
  ...run232BaseSeedPlatforms,
  ...run233SeedPlatforms
];
