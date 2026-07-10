import type { PlatformInput } from '../models/types.js';
import { run254BaseSeedPlatforms } from './run254BasePlatformSeeds.js';
import { run255SeedPlatforms } from './run255PlatformSeeds.js';

export const run254SeedPlatforms: PlatformInput[] = [
  ...run254BaseSeedPlatforms,
  ...run255SeedPlatforms
];
