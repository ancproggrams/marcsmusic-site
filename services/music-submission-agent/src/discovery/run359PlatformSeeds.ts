import type { PlatformInput } from '../models/types.js';

export const run359SeedPlatforms: PlatformInput[] = [];

export const run359DeduplicationActions = [
  {
    duplicateRun: 358,
    duplicateName: 'KVRX 91.7FM Digital-or-Physical Airplay Submission Route',
    canonicalRun: 112,
    canonicalName: 'KVRX 91.7FM Music Department Digital and Physical Airplay Submission Route',
    dedupeKeys: ['kvrx', 'kvrx.org', 'music@kvrx.org', 'https://www.kvrx.org/app/contact/'],
    action: 'removed_duplicate_seed_and_queue_row'
  },
  {
    duplicateRun: 358,
    duplicateName: 'KDVS 90.3FM Physical-Only Music Department Airplay Submission Route',
    canonicalRun: 130,
    canonicalName: 'KDVS Davis Physical-Only Music Department Airplay Submission Route',
    dedupeKeys: ['kdvs', 'kdvs.org', 'musicdept@kdvs.org', 'https://kdvs.org/contact'],
    action: 'removed_duplicate_seed_and_queue_row'
  }
] as const;
