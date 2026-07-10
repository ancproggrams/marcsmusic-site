import type { PlatformInput } from '../models/types.js';
import { run260BaseSeedPlatforms } from './run260BasePlatformSeeds.js';
import { run261SeedPlatforms } from './run261PlatformSeeds.js';

export const run260SeedPlatforms: PlatformInput[] = [
  ...run260BaseSeedPlatforms,
  ...run261SeedPlatforms
];
