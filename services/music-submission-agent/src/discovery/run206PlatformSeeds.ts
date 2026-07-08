import type { PlatformInput } from '../models/types.js';
import { run207SeedPlatforms } from './run207PlatformSeeds.js';
import { run206BaseSeedPlatforms } from './run206BasePlatformSeeds.js';

export const run206SeedPlatforms: PlatformInput[] = [
  ...run207SeedPlatforms,
  ...run206BaseSeedPlatforms
];
