import type { PlatformInput } from '../models/types.js';
import { run171BaseSeedPlatforms } from './run171BasePlatformSeeds.js';
import { run172SeedPlatforms } from './run172PlatformSeeds.js';

export const run171SeedPlatforms: PlatformInput[] = [
  ...run172SeedPlatforms,
  ...run171BaseSeedPlatforms,
];
