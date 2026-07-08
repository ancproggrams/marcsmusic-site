import type { PlatformInput } from '../models/types.js';
import { run224BaseSeedPlatforms } from './run224BasePlatformSeeds.js';
import { run225SeedPlatforms } from './run225PlatformSeeds.js';

export const run224SeedPlatforms: PlatformInput[] = [
  ...run224BaseSeedPlatforms,
  ...run225SeedPlatforms
];
