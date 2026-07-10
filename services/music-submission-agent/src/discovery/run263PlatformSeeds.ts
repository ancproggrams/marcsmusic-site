import type { PlatformInput } from '../models/types.js';
import { run263BaseSeedPlatforms } from './run263BasePlatformSeeds.js';
import { run264SeedPlatforms } from './run264PlatformSeeds.js';

export const run263SeedPlatforms: PlatformInput[] = [
  ...run263BaseSeedPlatforms,
  ...run264SeedPlatforms
];
