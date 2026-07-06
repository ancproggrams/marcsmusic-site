import type { PlatformInput } from '../models/types.js';
import { run172BaseSeedPlatforms } from './run172BasePlatformSeeds.js';
import { run173SeedPlatforms } from './run173PlatformSeeds.js';

export const run172SeedPlatforms: PlatformInput[] = [
  ...run173SeedPlatforms,
  ...run172BaseSeedPlatforms,
];
