import type { PlatformInput } from '../models/types.js';
import { run174BaseSeedPlatforms } from './run174BasePlatformSeeds.js';
import { run175SeedPlatforms } from './run175PlatformSeeds.js';

export const run174SeedPlatforms: PlatformInput[] = [
  ...run175SeedPlatforms,
  ...run174BaseSeedPlatforms,
];
