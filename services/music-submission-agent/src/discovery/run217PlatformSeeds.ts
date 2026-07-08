import type { PlatformInput } from '../models/types.js';
import { run217BaseSeedPlatforms } from './run217BasePlatformSeeds.js';
import { run218SeedPlatforms } from './run218PlatformSeeds.js';

export const run217SeedPlatforms: PlatformInput[] = [
  ...run217BaseSeedPlatforms,
  ...run218SeedPlatforms
];
