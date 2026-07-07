import type { PlatformInput } from '../models/types.js';
import { run176BaseSeedPlatforms } from './run176BasePlatformSeeds.js';
import { run177SeedPlatforms } from './run177PlatformSeeds.js';

export const run176SeedPlatforms: PlatformInput[] = run177SeedPlatforms.concat(run176BaseSeedPlatforms);
