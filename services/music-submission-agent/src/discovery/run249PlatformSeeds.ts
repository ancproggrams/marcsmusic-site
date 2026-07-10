import type { PlatformInput } from '../models/types.js';
import { run249BaseSeedPlatforms } from './run249BasePlatformSeeds.js';
import { run250SeedPlatforms } from './run250PlatformSeeds.js';

export const run249SeedPlatforms: PlatformInput[] = [
  ...run249BaseSeedPlatforms,
  ...run250SeedPlatforms
];