import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRequiredAssets } from '../src/submission/assetValidation.js';

test('asset validation requires the full approved asset pack', () => {
  const result = validateRequiredAssets({
    artistName: 'MarcsMusic',
    artistEmail: 'artist@example.com'
  });

  assert.equal(result.valid, false);
  assert.ok(result.missing.includes('trackTitle'));
  assert.ok(result.missing.includes('pressPhotoUrl'));
});

test('asset validation accepts complete pack', () => {
  const result = validateRequiredAssets({
    artistName: 'MarcsMusic',
    artistEmail: 'artist@example.com',
    trackTitle: 'Track',
    trackSpotifyUrl: 'https://open.spotify.com/track/example',
    trackSoundcloudUrl: 'https://soundcloud.com/example/track',
    trackMp3Url: 'https://cdn.example.com/track.mp3',
    trackWavUrl: 'https://cdn.example.com/track.wav',
    artworkUrl: 'https://cdn.example.com/art.jpg',
    pressPhotoUrl: 'https://cdn.example.com/photo.jpg',
    epkUrl: 'https://example.com/epk',
    artistBio: 'Bio'
  });

  assert.equal(result.valid, true);
});
