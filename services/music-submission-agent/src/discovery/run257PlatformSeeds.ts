import type { PlatformInput } from '../models/types.js';
import { run257BaseSeedPlatforms } from './run257BasePlatformSeeds.js';
import { run258SeedPlatforms } from './run258PlatformSeeds.js';

export const run257SeedPlatforms: PlatformInput[] = [
  ...run257BaseSeedPlatforms,
  ...run258SeedPlatforms
];
