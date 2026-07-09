import type { PlatformInput } from '../models/types.js';
import { run246BaseSeedPlatforms } from './run246BasePlatformSeeds.js';
import { run247SeedPlatforms } from './run247PlatformSeeds.js';

export const run246SeedPlatforms: PlatformInput[] = [
  ...run246BaseSeedPlatforms,
  ...run247SeedPlatforms
];