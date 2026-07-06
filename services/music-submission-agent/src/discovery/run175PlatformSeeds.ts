import type { PlatformInput } from '../models/types.js';
import { run175BaseSeedPlatforms } from './run175BasePlatformSeeds.js';
import { run176SeedPlatforms } from './run176PlatformSeeds.js';

export const run175SeedPlatforms: PlatformInput[] = run176SeedPlatforms.concat(run175BaseSeedPlatforms);
