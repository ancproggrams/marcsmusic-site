import assert from 'node:assert/strict';
import test from 'node:test';
import { NoopBrowserExecutor } from '../src/browser/index.js';

test('noop browser always escalates active submission actions', async () => {
  const browser = new NoopBrowserExecutor();
  const navigation = await browser.navigate('https://example.com/submit');
  const fill = await browser.fillForm({ artistName: 'MarcsMusic' });
  const upload = await browser.uploadFile('track', 'https://cdn.example.com/track.mp3');

  assert.equal(navigation.needsManualReview, true);
  assert.equal(fill.needsManualReview, true);
  assert.equal(upload.needsManualReview, true);
  assert.deepEqual(await browser.logs(), [
    'noop:navigate:https://example.com/submit',
    'noop:fillForm:artistName',
    'noop:uploadFile:track:https://cdn.example.com/track.mp3'
  ]);
});
