import type { PlatformInput } from '../models/types.js';
import { run199SeedPlatforms } from './run199PlatformSeeds.js';
import { run198BaseSeedPlatforms } from './run198BasePlatformSeeds.js';

export const run198SeedPlatforms: PlatformInput[] = [
  ...run199SeedPlatforms,
  ...run198BaseSeedPlatforms
];
