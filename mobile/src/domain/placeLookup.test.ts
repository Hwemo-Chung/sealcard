import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';

import {
  CURRENT_FIX_TIMEOUT_MS,
  LOOKUP_TIMEOUT_MS,
  createPlaceTracker,
  formatPlace,
  lookupPlaceLabel,
  placeAtShutter,
  startPlaceLookup,
  type Coords,
  type PlaceLookup,
  type PlaceParts,
  type PlaceSources,
} from './placeLookup';

const SEOUL: Coords = { latitude: 37.5665, longitude: 126.978 };
const BUSAN: Coords = { latitude: 35.1796, longitude: 129.0756 };
const NAMES = new Map<number, PlaceParts>([
  [SEOUL.latitude, { city: 'Seoul', district: 'Jung-gu' }],
  [BUSAN.latitude, { city: 'Busan', district: 'Haeundae-gu' }],
]);

/** Drain pending promise callbacks (setImmediate is not faked). */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const never = <T>() => new Promise<T>(() => {});
/** Resolves after `ms` of (fake) time. */
const after = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

function track<T>(p: Promise<T>) {
  const state: { done: boolean; value?: T } = { done: false };
  void p.then((value) => {
    state.done = true;
    state.value = value;
  });
  return state;
}

function sources(over: Partial<PlaceSources>): PlaceSources {
  return {
    currentFix: () => never(),
    lastKnownFix: async () => null,
    reverseGeocode: async (c) => {
      const place = NAMES.get(c.latitude);
      return place ? [place] : [];
    },
    ...over,
  };
}

function fakeTimers(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return t.mock.timers;
}

describe('lookupPlaceLabel (location stamp timing)', () => {
  it('stamps a fix that arrives after 5 s when there is no recent last-known position', async (t) => {
    const timers = fakeTimers(t);
    const label = track(lookupPlaceLabel(sources({ currentFix: () => after(5000, SEOUL) })));

    timers.tick(5000);
    await flush();

    assert.equal(label.done, true);
    assert.equal(label.value, 'Seoul · Jung-gu');
  });

  it('waits the full fix limit before falling back to the last-known position', async (t) => {
    const timers = fakeTimers(t);
    const label = track(lookupPlaceLabel(sources({ lastKnownFix: async () => BUSAN })));

    timers.tick(CURRENT_FIX_TIMEOUT_MS - 1);
    await flush();
    assert.equal(label.done, false, 'must keep waiting for a fresh fix');

    timers.tick(1);
    await flush();
    assert.equal(label.value, 'Busan · Haeundae-gu');
  });

  it('uses the last-known position at once when the fix fails outright', async () => {
    const label = await lookupPlaceLabel(
      sources({
        currentFix: () => Promise.reject(new Error('location off')),
        lastKnownFix: async () => BUSAN,
      }),
    );
    assert.equal(label, 'Busan · Haeundae-gu');
  });

  it('gives up without a stamp when neither a fix nor a recent position exists', async (t) => {
    const timers = fakeTimers(t);
    const label = track(lookupPlaceLabel(sources({})));

    timers.tick(CURRENT_FIX_TIMEOUT_MS);
    await flush();

    assert.equal(label.done, true);
    assert.equal(label.value, null);
  });

  it('still leaves 3 s to reverse-geocode a fix that lands just before the fix limit', async (t) => {
    const timers = fakeTimers(t);
    const label = track(
      lookupPlaceLabel(
        sources({
          currentFix: () => after(CURRENT_FIX_TIMEOUT_MS - 100, SEOUL),
          reverseGeocode: () => after(3000, [{ city: 'Seoul', district: 'Jung-gu' }]),
        }),
      ),
    );

    timers.tick(CURRENT_FIX_TIMEOUT_MS - 100);
    await flush();
    timers.tick(3000);
    await flush();

    assert.equal(label.value, 'Seoul · Jung-gu');
  });

  it('cuts off a hung reverse geocode at the overall limit', async (t) => {
    const timers = fakeTimers(t);
    const label = track(
      lookupPlaceLabel(
        sources({ currentFix: async () => SEOUL, reverseGeocode: () => never() }),
      ),
    );
    await flush(); // the fix arrives at t=0, geocoding then hangs

    timers.tick(LOOKUP_TIMEOUT_MS - 1);
    await flush();
    assert.equal(label.done, false);

    timers.tick(1);
    await flush();
    assert.equal(label.done, true);
    assert.equal(label.value, null);
  });

  it('keeps the overall limit at or above the fix limit', () => {
    assert.ok(LOOKUP_TIMEOUT_MS >= CURRENT_FIX_TIMEOUT_MS);
  });
});

describe('startPlaceLookup (recent position queried in parallel)', () => {
  it('geocodes the recent position at the start, not after the fix limit', async (t) => {
    fakeTimers(t);
    let lastKnownCalls = 0;
    const lookup = startPlaceLookup(
      sources({
        lastKnownFix: async () => {
          lastKnownCalls += 1;
          return BUSAN;
        },
      }),
    );
    const label = track(lookup.label);
    await flush();

    assert.equal(lastKnownCalls, 1, 'recent position must be requested at t=0');
    assert.equal(lookup.recentLabel(), 'Busan · Haeundae-gu');
    assert.equal(label.done, false, 'the main label still waits for a fresh fix');
  });

  it('has no recent label while its geocode is running, failing, or without a position', async (t) => {
    const timers = fakeTimers(t);
    const slow = startPlaceLookup(
      sources({
        lastKnownFix: async () => BUSAN,
        reverseGeocode: () => after(10000, [{ city: 'Busan' }]),
      }),
    );
    const failing = startPlaceLookup(
      sources({ lastKnownFix: () => Promise.reject(new Error('no provider')) }),
    );
    const none = startPlaceLookup(sources({}));
    await flush();
    timers.tick(9999);
    await flush();

    assert.equal(slow.recentLabel(), null);
    assert.equal(failing.recentLabel(), null);
    assert.equal(none.recentLabel(), null);
  });

  it('requests no position when location permission is denied', async () => {
    let fixCalls = 0;
    const lookup = startPlaceLookup(
      sources({
        permission: async () => false,
        currentFix: async () => {
          fixCalls += 1;
          return SEOUL;
        },
        lastKnownFix: async () => {
          fixCalls += 1;
          return BUSAN;
        },
      }),
    );

    assert.equal(await lookup.label, null);
    assert.equal(lookup.recentLabel(), null);
    assert.equal(fixCalls, 0);
  });

  it('does not count time spent on the permission dialog', async (t) => {
    const timers = fakeTimers(t);
    const lookup = startPlaceLookup(
      sources({
        permission: () => after(30000, true),
        currentFix: () => after(5000, SEOUL),
      }),
    );
    const label = track(lookup.label);

    timers.tick(30000);
    await flush();
    timers.tick(5000);
    await flush();

    assert.equal(label.value, 'Seoul · Jung-gu');
  });
});

describe('lookup limits, pinned with literal ms', () => {
  it('waits exactly 8000 ms for a fresh fix before using the recent position', async (t) => {
    const timers = fakeTimers(t);
    const label = track(lookupPlaceLabel(sources({ lastKnownFix: async () => BUSAN })));

    timers.tick(7999);
    await flush();
    assert.equal(label.done, false, 'still waiting for a fresh fix at 7999 ms');

    timers.tick(1);
    await flush();
    assert.equal(label.value, 'Busan · Haeundae-gu');
  });

  it('cuts the whole lookup off at exactly 12000 ms', async (t) => {
    const timers = fakeTimers(t);
    const label = track(
      lookupPlaceLabel(sources({ currentFix: async () => SEOUL, reverseGeocode: () => never() })),
    );
    await flush();

    timers.tick(11999);
    await flush();
    assert.equal(label.done, false, 'still running at 11999 ms');

    timers.tick(1);
    await flush();
    assert.equal(label.done, true);
    assert.equal(label.value, null);
  });
});

describe('fresh fix found but its reverse geocode fails or is empty', () => {
  const recentOnly = (geocodeFresh: () => Promise<PlaceParts[]>) =>
    sources({
      currentFix: async () => SEOUL,
      lastKnownFix: async () => BUSAN,
      reverseGeocode: (c) =>
        c.latitude === SEOUL.latitude ? geocodeFresh() : Promise.resolve([NAMES.get(c.latitude)!]),
    });

  it('falls back to the recent position when geocoding the fresh fix rejects', async () => {
    const label = await lookupPlaceLabel(
      recentOnly(() => Promise.reject(new Error('geocoder unavailable'))),
    );
    assert.equal(label, 'Busan · Haeundae-gu');
  });

  it('falls back to the recent position when the fresh fix geocodes to nothing', async () => {
    assert.equal(await lookupPlaceLabel(recentOnly(async () => [])), 'Busan · Haeundae-gu');
    assert.equal(await lookupPlaceLabel(recentOnly(async () => [{}])), 'Busan · Haeundae-gu');
  });
});

describe('createPlaceTracker (stale place restarted on foreground and at the shutter)', () => {
  /** Lookups whose label is already known; records whether each start may prompt. */
  function fakeBegin() {
    const prompts: boolean[] = [];
    const begin = (prompt: boolean): PlaceLookup => {
      prompts.push(prompt);
      const label = Promise.resolve(`place-${prompts.length}`);
      return { label, firstLabel: label, recentLabel: () => null };
    };
    return { prompts, begin };
  }

  it('prompts for permission only on the first start, never on a restart', () => {
    let now = 0;
    const { prompts, begin } = fakeBegin();
    const tracker = createPlaceTracker(begin, () => now);

    tracker.start();
    tracker.onForeground();
    now = 3_600_000;
    tracker.atShutter('place-2');
    assert.deepEqual(prompts, [true, false, false]);
  });

  it('keeps a lookup started 300000 ms before the shutter and restarts it at 300001 ms', () => {
    let now = 1_000;
    const { prompts, begin } = fakeBegin();
    const tracker = createPlaceTracker(begin, () => now);
    const first = tracker.start();

    now = 1_000 + 300_000;
    const kept = tracker.atShutter('Busan');
    assert.equal(kept.restarted, false);
    assert.equal(kept.lookup, first);
    assert.equal(kept.resolved, 'Busan', 'the shown place is still fresh enough to stamp');

    now = 1_000 + 300_001;
    const renewed = tracker.atShutter('Busan');
    assert.equal(renewed.restarted, true);
    assert.notEqual(renewed.lookup, first);
    assert.equal(renewed.lookup, tracker.current());
    assert.equal(renewed.resolved, null, 'a stale shown place must not be stamped');
    assert.equal(prompts.length, 2);
  });

  it('restarts the lookup when the app comes back to the foreground', () => {
    const { begin } = fakeBegin();
    const tracker = createPlaceTracker(begin, () => 0);
    const first = tracker.start();
    const next = tracker.onForeground();
    assert.ok(next);
    assert.notEqual(next, first);
    assert.equal(tracker.current(), next);
  });

  it('starts nothing on foreground or at the shutter while the location toggle is off', () => {
    const { prompts, begin } = fakeBegin();
    const tracker = createPlaceTracker(begin, () => 10_000_000);
    assert.equal(tracker.onForeground(), null);
    tracker.start();
    tracker.stop();
    assert.equal(tracker.current(), null);
    assert.equal(tracker.onForeground(), null);
    assert.deepEqual(tracker.atShutter(null), { lookup: null, resolved: null, restarted: false });
    assert.equal(prompts.length, 1);
  });

  it('stamps where the user is now when the camera was left open for an hour', async () => {
    let now = 0;
    let position = BUSAN;
    const tracker = createPlaceTracker(
      () => startPlaceLookup(sources({ currentFix: async () => position })),
      () => now,
    );
    const shown = await tracker.start().label;
    assert.equal(shown, 'Busan · Haeundae-gu');

    now = 3_600_000;
    position = SEOUL;
    const { lookup, resolved } = tracker.atShutter(shown);
    const place = await placeAtShutter({ enabled: true, resolved, lookup });
    assert.equal(place.locationLabel, 'Seoul · Jung-gu');
  });
});

describe('formatPlace', () => {
  it('joins city and district', () => {
    assert.equal(formatPlace({ city: 'Seoul', district: 'Jung-gu' }), 'Seoul · Jung-gu');
  });

  it('does not repeat the city and returns null for an empty address', () => {
    assert.equal(formatPlace({ city: 'Seoul', name: 'Seoul' }), 'Seoul');
    assert.equal(formatPlace({}), null);
    assert.equal(formatPlace(undefined), null);
  });
});
