import type { PlatformInput } from '../models/types.js';
import { run241BaseSeedPlatforms } from './run241BasePlatformSeeds.js';
import { run242SeedPlatforms } from './run242PlatformSeeds.js';

export const run241SeedPlatforms: PlatformInput[] = [
  ...run241BaseSeedPlatforms,
  ...run242SeedPlatforms
];
