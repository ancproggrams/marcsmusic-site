import type { PlatformInput } from '../models/types.js';
import { run256BaseSeedPlatforms } from './run256BasePlatformSeeds.js';
import { run257SeedPlatforms } from './run257PlatformSeeds.js';

export const run256SeedPlatforms: PlatformInput[] = [
  ...run256BaseSeedPlatforms,
  ...run257SeedPlatforms
];
