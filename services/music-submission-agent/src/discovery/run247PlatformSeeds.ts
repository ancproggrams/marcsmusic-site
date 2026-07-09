import type { PlatformInput } from '../models/types.js';
import { run247BaseSeedPlatforms } from './run247BasePlatformSeeds.js';
import { run248SeedPlatforms } from './run248PlatformSeeds.js';

export const run247SeedPlatforms: PlatformInput[] = [
  ...run247BaseSeedPlatforms,
  ...run248SeedPlatforms
];