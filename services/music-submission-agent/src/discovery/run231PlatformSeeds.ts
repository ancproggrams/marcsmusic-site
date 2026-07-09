import type { PlatformInput } from '../models/types.js';
import { run231BaseSeedPlatforms } from './run231BasePlatformSeeds.js';
import { run232SeedPlatforms } from './run232PlatformSeeds.js';

export const run231SeedPlatforms: PlatformInput[] = [
  ...run231BaseSeedPlatforms,
  ...run232SeedPlatforms
];
