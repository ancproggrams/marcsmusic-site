import type { PlatformInput } from '../models/types.js';
import { run212SeedPlatforms } from './run212PlatformSeeds.js';
import { run211BaseSeedPlatforms } from './run211BasePlatformSeeds.js';

export const run211SeedPlatforms: PlatformInput[] = [
  ...run212SeedPlatforms,
  ...run211BaseSeedPlatforms,
];
