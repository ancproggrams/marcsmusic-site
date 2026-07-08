import type { PlatformInput } from '../models/types.js';
import { run205SeedPlatforms } from './run205PlatformSeeds.js';
import { run204BaseSeedPlatforms } from './run204BasePlatformSeeds.js';

export const run204SeedPlatforms: PlatformInput[] = [
  ...run205SeedPlatforms,
  ...run204BaseSeedPlatforms
];
