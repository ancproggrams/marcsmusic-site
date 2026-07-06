import type { PlatformInput } from '../models/types.js';
import { run169BaseSeedPlatforms } from './run169BasePlatformSeeds.js';
import { run170SeedPlatforms } from './run170PlatformSeeds.js';

export const run169SeedPlatforms: PlatformInput[] = [
  ...run170SeedPlatforms,
  ...run169BaseSeedPlatforms,
];
