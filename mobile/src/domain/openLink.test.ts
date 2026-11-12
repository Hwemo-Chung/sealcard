import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { openOrFallback } from './openLink';

describe('openOrFallback (settings links)', () => {
  it('opens the url and does not show the fallback', async () => {
    const opened: string[] = [];
    let failed = 0;
    const ok = await openOrFallback(
      async (url) => {
        opened.push(url);
      },
      'mailto:a@b.c',
      () => {
        failed += 1;
      },
    );
    assert.equal(ok, true);
    assert.deepEqual(opened, ['mailto:a@b.c']);
    assert.equal(failed, 0);
  });

  it('shows the fallback when no app can open the url', async () => {
    let failed = 0;
    const ok = await openOrFallback(
      async () => {
        throw new Error('Could not open URL');
      },
      'mailto:a@b.c',
      () => {
        failed += 1;
      },
    );
    assert.equal(ok, false);
    assert.equal(failed, 1);
  });

  it('shows the fallback when the opener throws synchronously', async () => {
    let failed = 0;
    const ok = await openOrFallback(
      () => {
        throw new Error('sync');
      },
      'https://example.invalid',
      () => {
        failed += 1;
      },
    );
    assert.equal(ok, false);
    assert.equal(failed, 1);
  });
});
