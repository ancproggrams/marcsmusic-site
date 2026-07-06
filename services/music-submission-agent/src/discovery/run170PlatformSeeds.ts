import type { PlatformInput } from '../models/types.js';
import { run170BaseSeedPlatforms } from './run170BasePlatformSeeds.js';
import { run171SeedPlatforms } from './run171PlatformSeeds.js';

export const run170SeedPlatforms: PlatformInput[] = [
  ...run171SeedPlatforms,
  ...run170BaseSeedPlatforms,
];
