import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { EmailVerifier } from '../src/verification/emailVerifier.js';

test('email verifier consumes AfterShip helper output when available', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aftership-helper-'));
  const helper = join(dir, 'aftership-email-verifier');
  try {
    writeFileSync(
      helper,
      [
        '#!/usr/bin/env node',
        'console.log(JSON.stringify({ok:true,result:{email:"demo@example.com",reachable:"unknown",syntax:{valid:true,username:"demo",domain:"example.com"},smtp:null,disposable:false,role_account:true,free:true,has_mx_records:true}}));'
      ].join('\n')
    );
    chmodSync(helper, 0o755);

    const verifier = new EmailVerifier(false, helper);
    const result = await verifier.verify('Demo@Example.com');
    assert.equal(result.email, 'demo@example.com');
    assert.equal(result.syntaxValid, true);
    assert.equal(result.mxValid, true);
    assert.equal(result.roleAccount, true);
    assert.equal(result.status, 'verified');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('email verifier fallback rejects invalid syntax without guessing', async () => {
  const verifier = new EmailVerifier(false, '/missing/aftership-helper');
  const result = await verifier.verify('not-an-email');

  assert.equal(result.status, 'rejected');
  assert.equal(result.syntaxValid, false);
});
