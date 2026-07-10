import type { PlatformInput } from '../models/types.js';
import { run259BaseSeedPlatforms } from './run259BasePlatformSeeds.js';
import { run260SeedPlatforms } from './run260PlatformSeeds.js';

export const run259SeedPlatforms: PlatformInput[] = [
  ...run259BaseSeedPlatforms,
  ...run260SeedPlatforms
];
