import type { PlatformInput } from '../models/types.js';
import { run206SeedPlatforms } from './run206PlatformSeeds.js';
import { run205BaseSeedPlatforms } from './run205BasePlatformSeeds.js';

export const run205SeedPlatforms: PlatformInput[] = [
  ...run206SeedPlatforms,
  ...run205BaseSeedPlatforms
];
