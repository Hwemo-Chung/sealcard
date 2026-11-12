import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { locationForCapture, settleWithin } from './settle';

const never = <T>() => new Promise<T>(() => {});
const later = <T>(value: T, ms: number) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

describe('settleWithin', () => {
  it('returns the value when the promise settles in time', async () => {
    assert.equal(await settleWithin(Promise.resolve('Seoul'), 50, null), 'Seoul');
  });

  it('returns the fallback once the wait elapses', async () => {
    const started = Date.now();
    assert.equal(await settleWithin(later('late', 300), 20, null), null);
    assert.ok(Date.now() - started < 250, 'must not wait for the slow promise');
  });

  it('returns the fallback when the promise rejects', async () => {
    assert.equal(await settleWithin(Promise.reject(new Error('gps')), 50, 'fallback'), 'fallback');
  });
});

describe('locationForCapture (location stamp at shutter time)', () => {
  it('stamps nothing when the location toggle is off', async () => {
    assert.equal(
      await locationForCapture({ enabled: false, resolved: 'Seoul', pending: null, waitMs: 50 }),
      null,
    );
  });

  it('uses an already resolved place without waiting', async () => {
    const started = Date.now();
    assert.equal(
      await locationForCapture({ enabled: true, resolved: 'Seoul', pending: never(), waitMs: 500 }),
      'Seoul',
    );
    assert.ok(Date.now() - started < 100);
  });

  it('waits for a lookup that is still running at shutter time', async () => {
    assert.equal(
      await locationForCapture({
        enabled: true,
        resolved: null,
        pending: later('Busan', 10),
        waitMs: 500,
      }),
      'Busan',
    );
  });

  it('gives up after the wait so the shutter never hangs', async () => {
    assert.equal(
      await locationForCapture({ enabled: true, resolved: null, pending: never(), waitMs: 20 }),
      null,
    );
  });

  it('falls back to the recent-position label when the wait runs out', async () => {
    assert.equal(
      await locationForCapture({
        enabled: true,
        resolved: null,
        pending: never(),
        recent: () => 'Busan',
        waitMs: 20,
      }),
      'Busan',
    );
  });

  it('prefers a lookup result that lands within the wait over the recent label', async () => {
    assert.equal(
      await locationForCapture({
        enabled: true,
        resolved: null,
        pending: later('Seoul', 10),
        recent: () => 'Busan',
        waitMs: 500,
      }),
      'Seoul',
    );
  });

  it('returns null when the lookup already finished without a place', async () => {
    assert.equal(
      await locationForCapture({ enabled: true, resolved: null, pending: null, waitMs: 20 }),
      null,
    );
  });
});
