import type { PlatformInput } from '../models/types.js';
import { run173BaseSeedPlatforms } from './run173BasePlatformSeeds.js';
import { run174SeedPlatforms } from './run174PlatformSeeds.js';

export const run173SeedPlatforms: PlatformInput[] = [
  ...run174SeedPlatforms,
  ...run173BaseSeedPlatforms,
];
