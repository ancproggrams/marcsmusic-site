import type { RuntimeConfig } from '../config/runtime.js';

export const requiredAssetKeys = [
  'artistName',
  'artistEmail',
  'trackTitle',
  'trackSpotifyUrl',
  'trackSoundcloudUrl',
  'trackMp3Url',
  'trackWavUrl',
  'artworkUrl',
  'pressPhotoUrl',
  'epkUrl',
  'artistBio'
] as const;

export type RequiredAssetKey = (typeof requiredAssetKeys)[number];

export interface AssetValidationResult {
  valid: boolean;
  missing: RequiredAssetKey[];
}

export function validateRequiredAssets(requiredAssets: RuntimeConfig['requiredAssets']): AssetValidationResult {
  const missing = requiredAssetKeys.filter((key) => {
    const value = requiredAssets[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  return {
    valid: missing.length === 0,
    missing
  };
}

export function assetFields(requiredAssets: RuntimeConfig['requiredAssets']): Record<string, string> {
  return Object.fromEntries(
    Object.entries(requiredAssets).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0
    )
  );
}
