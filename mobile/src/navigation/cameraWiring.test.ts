import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PLACE_MAX_AGE_MS, createPlaceTracker, type PlaceLookup } from '../domain/placeLookup';
import { onCameraAppState, placeForShot } from './cameraWiring';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function lookup(label: string | null, recent: string | null = null): PlaceLookup {
  return { label: Promise.resolve(label), firstLabel: Promise.resolve(label), recentLabel: () => recent };
}

describe('onCameraAppState (camera AppState listener body)', () => {
  it('back in the foreground: re-reads the camera permission and restarts the place lookup', () => {
    const log: string[] = [];
    const next = lookup('Seoul');
    onCameraAppState('active', {
      recheckPermission: async () => {
        log.push('recheck');
      },
      tracker: {
        onForeground: () => {
          log.push('restart');
          return next;
        },
      },
      follow: (l) => log.push(l === next ? 'follow next' : 'follow other'),
    });
    assert.deepEqual(log, ['recheck', 'restart', 'follow next']);
  });

  it('does not follow anything while the location toggle is off', () => {
    const log: string[] = [];
    onCameraAppState('active', {
      recheckPermission: async () => undefined,
      tracker: { onForeground: () => null },
      follow: () => log.push('follow'),
    });
    assert.deepEqual(log, []);
  });

  it('ignores background and inactive', () => {
    const log: string[] = [];
    for (const state of ['background', 'inactive']) {
      onCameraAppState(state, {
        recheckPermission: async () => {
          log.push('recheck');
        },
        tracker: {
          onForeground: () => {
            log.push('restart');
            return null;
          },
        },
        follow: () => log.push('follow'),
      });
    }
    assert.deepEqual(log, []);
  });

  it('swallows a failing permission re-check (no unhandled rejection)', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      onCameraAppState('active', {
        recheckPermission: () => Promise.reject(new Error('camera service down')),
        tracker: { onForeground: () => null },
        follow: () => {},
      });
      await flush();
      await flush();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    assert.deepEqual(unhandled, []);
  });
});

describe('placeForShot (camera shutter place step)', () => {
  it('restarts a stale lookup, shows it, and never stamps the stale place', async () => {
    let clock = 0;
    const started: PlaceLookup[] = [];
    const tracker = createPlaceTracker(() => {
      const l = lookup(started.length === 0 ? 'Old place' : 'New place');
      started.push(l);
      return l;
    }, () => clock);
    tracker.start();
    clock = PLACE_MAX_AGE_MS + 1;
    const followed: PlaceLookup[] = [];
    const place = await placeForShot({
      tracker,
      shown: 'Old place',
      isOn: () => true,
      follow: (l) => followed.push(l),
    });
    assert.equal(started.length, 2);
    assert.deepEqual(followed, [started[1]]);
    assert.equal(place.locationLabel, 'New place');
  });

  it('stamps the shown place of a fresh lookup without restarting', async () => {
    const tracker = createPlaceTracker(() => lookup('Seoul'), () => 0);
    tracker.start();
    const followed: PlaceLookup[] = [];
    const place = await placeForShot({ tracker, shown: 'Seoul', isOn: () => true, follow: (l) => followed.push(l) });
    assert.deepEqual(followed, []);
    assert.equal(place.locationLabel, 'Seoul');
  });

  it('reads the location toggle after the wait (turned off meanwhile → no place)', async () => {
    let resolveLabel: (v: string | null) => void = () => {};
    const pending: PlaceLookup = {
      label: new Promise<string | null>((r) => (resolveLabel = r)),
      firstLabel: Promise.resolve(null),
      recentLabel: () => null,
    };
    const tracker = createPlaceTracker(() => pending, () => 0);
    tracker.start();
    let on = true;
    const shot = placeForShot({ tracker, shown: null, isOn: () => on, follow: () => {} });
    on = false; // user turned location off while the shutter waited
    resolveLabel('Seoul');
    assert.deepEqual(await shot, { locationLabel: null, locationPending: null });
  });
});
