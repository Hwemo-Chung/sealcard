import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';

import {
  LOCATION_WAIT_AFTER_SHUTTER_MS,
  lookupPlaceLabel,
  placeAtShutter,
  startPlaceLookup,
  type Coords,
  type PlaceParts,
  type PlaceSources,
  type ShutterPlace,
} from '../domain/placeLookup';
import { locationForCapture } from '../domain/settle';
import { applyLateLocation, confirmPreview, stampLateLocation } from './lateLocation';
import type { RootScreen } from './types';

const SHOT = 'file:///cache/shot-1.jpg';

const capture = {
  photoUri: SHOT,
  templateId: 'polaroid',
  dateFormatId: 'dot',
  sealedAtIso: '2026-11-11T00:00:00.000Z',
  showDate: true,
  locationLabel: null,
  showBinderName: false,
} as const;

const preview: RootScreen = { name: 'sealPreview', ...capture };

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('applyLateLocation (place lookup that finishes after the shutter wait)', () => {
  it('adds the late place to the preview of the same shot', () => {
    assert.deepEqual(applyLateLocation(preview, SHOT, 'Seoul · Jung-gu'), {
      ...preview,
      locationLabel: 'Seoul · Jung-gu',
    });
  });

  it('leaves the preview as is when the lookup found nothing', () => {
    assert.equal(applyLateLocation(preview, SHOT, null), preview);
  });

  it('never replaces a place the shot already has', () => {
    const stamped: RootScreen = { ...preview, locationLabel: 'Busan' };
    assert.equal(applyLateLocation(stamped, SHOT, 'Seoul'), stamped);
  });

  it('ignores a result that belongs to an earlier shot (retake)', () => {
    const retaken: RootScreen = { ...preview, photoUri: 'file:///cache/shot-2.jpg' };
    assert.equal(applyLateLocation(retaken, SHOT, 'Seoul'), retaken);
    const camera: RootScreen = { name: 'sealCamera' };
    assert.equal(applyLateLocation(camera, SHOT, 'Seoul'), camera);
  });

  it('does not touch the binder picker: the stamped composite was captured on confirm', () => {
    const picker: RootScreen = {
      name: 'pickBinder',
      ...capture,
      compositeUri: 'file:///cache/composite.jpg',
      width: 300,
      height: 380,
    };
    assert.equal(applyLateLocation(picker, SHOT, 'Seoul'), picker);
  });

  it('stamps an early shot whose fix lands after the post-shutter wait', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const timers = t.mock.timers;
    const SEOUL: Coords = { latitude: 37.5665, longitude: 126.978 };

    // Camera opened at t=0: fix comes in at 7 s, no recent last-known position.
    const lookup = lookupPlaceLabel({
      currentFix: () => new Promise((resolve) => setTimeout(() => resolve(SEOUL), 7000)),
      lastKnownFix: async () => null,
      reverseGeocode: async () => [{ city: 'Seoul', district: 'Jung-gu' }],
    });
    let lateLabel: string | null | undefined;
    void lookup.then((label) => {
      lateLabel = label;
    });

    // Shutter at t=1 s; the camera waits at most LOCATION_WAIT_AFTER_SHUTTER_MS.
    timers.tick(1000);
    let shutterLabel: string | null | undefined;
    void locationForCapture({
      enabled: true,
      resolved: null,
      pending: lookup,
      waitMs: LOCATION_WAIT_AFTER_SHUTTER_MS,
    }).then((label) => {
      shutterLabel = label;
    });
    timers.tick(LOCATION_WAIT_AFTER_SHUTTER_MS);
    await flush();
    assert.equal(shutterLabel, null, 'preview opens without a place');
    assert.equal(lateLabel, undefined, 'lookup is still running');

    // Fix arrives while the user looks at the preview.
    timers.tick(7000 - 1000 - LOCATION_WAIT_AFTER_SHUTTER_MS);
    await flush();
    assert.equal(lateLabel, 'Seoul · Jung-gu');
    const screen = applyLateLocation(preview, SHOT, lateLabel);
    assert.equal(screen.name === 'sealPreview' && screen.locationLabel, 'Seoul · Jung-gu');
  });
});

describe('location stamp at the shutter with a slow fix (camera opened at t=0, shutter at 1 s)', () => {
  const SEOUL: Coords = { latitude: 37.5665, longitude: 126.978 };
  const BUSAN: Coords = { latitude: 35.1796, longitude: 129.0756 };
  const NAMES = new Map<number, PlaceParts>([
    [SEOUL.latitude, { city: 'Seoul', district: 'Jung-gu' }],
    [BUSAN.latitude, { city: 'Busan', district: 'Haeundae-gu' }],
  ]);
  const geocode = async (c: Coords): Promise<PlaceParts[]> => [NAMES.get(c.latitude) ?? {}];
  const never = <T>() => new Promise<T>(() => {});
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

  /** Camera mounts at t=0, shutter at t=1 s; returns what the camera passes to onCaptured. */
  async function shootAt1s(t: TestContext, src: Partial<PlaceSources>) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const lookup = startPlaceLookup({
      currentFix: () => never(),
      lastKnownFix: async () => null,
      reverseGeocode: geocode,
      ...src,
    });
    await flush();
    t.mock.timers.tick(1000);
    const shot = track(placeAtShutter({ enabled: true, resolved: null, lookup }));
    return { lookup, shot };
  }

  /** App screen state after onCaptured opened the preview with the shutter result. */
  function openPreview(place: ShutterPlace) {
    let screen: RootScreen = { name: 'sealPreview', ...capture, locationLabel: place.locationLabel };
    stampLateLocation({ photoUri: SHOT, ...place }, (next) => {
      screen = next(screen);
    });
    return () => screen;
  }

  const placeOf = (screen: RootScreen) =>
    screen.name === 'sealPreview' ? screen.locationLabel : 'not a preview';

  it('stamps the recent position exactly when the 4 s wait runs out (pins the 4000 ms wait)', async (t) => {
    const { shot } = await shootAt1s(t, { lastKnownFix: async () => BUSAN });

    t.mock.timers.tick(3999);
    await flush();
    assert.equal(shot.done, false, 'the shutter keeps waiting for a fresh fix until 4 s');

    t.mock.timers.tick(1);
    await flush();
    assert.equal(shot.done, true);
    assert.equal(shot.value?.locationLabel, 'Busan · Haeundae-gu');
    assert.equal(shot.value?.locationPending, null, 'nothing left to fill');
  });

  it('prefers a fresh fix that lands 3.9 s after the shutter over the recent position', async (t) => {
    const { shot } = await shootAt1s(t, {
      currentFix: () => after(4900, SEOUL),
      lastKnownFix: async () => BUSAN,
    });

    t.mock.timers.tick(3900);
    await flush();
    assert.equal(shot.value?.locationLabel, 'Seoul · Jung-gu');
  });

  it('never replaces the recent position the user already sees with a later fresh fix', async (t) => {
    const { lookup, shot } = await shootAt1s(t, {
      currentFix: () => after(7000, SEOUL),
      lastKnownFix: async () => BUSAN,
    });
    t.mock.timers.tick(4000);
    await flush();
    assert.ok(shot.value);
    assert.equal(shot.value.locationLabel, 'Busan · Haeundae-gu');
    const screen = openPreview(shot.value);

    t.mock.timers.tick(2000); // fresh fix at 7 s
    await flush();
    assert.equal(await lookup.label, 'Seoul · Jung-gu', 'the fresh fix did land');
    assert.equal(placeOf(screen()), 'Busan · Haeundae-gu');
  });

  it('does not wait past 4 s for a slow recent geocode, and fills the empty preview as soon as it lands', async (t) => {
    const { shot } = await shootAt1s(t, {
      lastKnownFix: async () => BUSAN,
      reverseGeocode: (c) => after(6000, [NAMES.get(c.latitude) ?? {}]),
    });
    t.mock.timers.tick(4000);
    await flush();
    assert.equal(shot.done, true, 'no extra wait for the recent geocode');
    assert.ok(shot.value);
    assert.equal(shot.value.locationLabel, null);
    const screen = openPreview(shot.value);

    t.mock.timers.tick(999); // 5.999 s
    await flush();
    assert.equal(placeOf(screen()), null);
    t.mock.timers.tick(1); // recent geocode lands at 6 s, before the 8 s fix limit
    await flush();
    assert.equal(placeOf(screen()), 'Busan · Haeundae-gu');
  });

  it('fills the empty preview with a fresh fix when there is no recent position', async (t) => {
    const { shot } = await shootAt1s(t, { currentFix: () => after(7000, SEOUL) });
    t.mock.timers.tick(4000);
    await flush();
    assert.ok(shot.value);
    assert.equal(shot.value.locationLabel, null);
    const screen = openPreview(shot.value);

    t.mock.timers.tick(2000);
    await flush();
    assert.equal(placeOf(screen()), 'Seoul · Jung-gu');
  });

  it('stamps nothing and leaves nothing pending when the location toggle is off', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const lookup = startPlaceLookup({
      currentFix: async () => SEOUL,
      lastKnownFix: async () => BUSAN,
      reverseGeocode: geocode,
    });
    assert.deepEqual(await placeAtShutter({ enabled: false, resolved: null, lookup }), {
      locationLabel: null,
      locationPending: null,
    });
  });

  it('stamps nothing when the toggle is turned off during the wait, even if the fix lands in time', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let on = true;
    const lookup = startPlaceLookup({
      currentFix: () => after(2000, SEOUL),
      lastKnownFix: async () => BUSAN,
      reverseGeocode: geocode,
    });
    await flush();
    const shot = track(placeAtShutter({ enabled: () => on, resolved: null, lookup }));

    t.mock.timers.tick(1000);
    on = false; // user taps the location chip while the shutter waits
    t.mock.timers.tick(1000); // fresh fix lands at 2 s, inside the 4 s wait
    await flush();
    assert.equal(shot.done, true);
    assert.deepEqual(shot.value, { locationLabel: null, locationPending: null });
  });

  it('leaves nothing for the preview to fill later when the toggle is turned off during the wait', async (t) => {
    // With the toggle on, this wait hands the lookup over (see "fills the empty preview…").
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let on = true;
    const lookup = startPlaceLookup({
      currentFix: () => never(),
      lastKnownFix: async () => null,
      reverseGeocode: geocode,
    });
    await flush();
    const shot = track(placeAtShutter({ enabled: () => on, resolved: null, lookup }));

    t.mock.timers.tick(1000);
    on = false;
    t.mock.timers.tick(3000);
    await flush();
    assert.deepEqual(shot.value, { locationLabel: null, locationPending: null });
  });
});

describe('confirmPreview (App onConfirmSeal)', () => {
  // The payload names the shot it was captured from (finding 5), so the fixture carries photoUri.
  const shot = { photoUri: SHOT, compositeUri: 'file:///cache/composite.jpg', width: 300, height: 380 };

  it('carries a place that landed on the preview after it opened into the binder picker', () => {
    const landed = applyLateLocation(preview, SHOT, 'Seoul · Jung-gu');
    assert.deepEqual(confirmPreview(landed, shot), {
      name: 'pickBinder',
      ...capture,
      locationLabel: 'Seoul · Jung-gu',
      ...shot,
    });
  });

  it('does nothing when back already left the preview', () => {
    const camera: RootScreen = { name: 'sealCamera' };
    assert.equal(confirmPreview(camera, shot), camera);
  });

  it('does nothing when the binder picker of the same shot is already up (second confirm)', () => {
    const picker: RootScreen = {
      name: 'pickBinder',
      ...capture,
      compositeUri: 'file:///cache/composite-0.jpg',
      width: 300,
      height: 380,
    };
    assert.equal(confirmPreview(picker, shot), picker);
  });

  it('ignores a composite captured from an earlier shot (retake while it was capturing)', () => {
    const retaken: RootScreen = { ...preview, photoUri: 'file:///cache/shot-2.jpg' };
    assert.equal(confirmPreview(retaken, shot), retaken);
  });
});

describe('stampLateLocation with a failing place lookup', () => {
  it('leaves the preview as it is and raises no unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    let updates = 0;
    try {
      stampLateLocation(
        {
          photoUri: SHOT,
          locationLabel: null,
          locationPending: Promise.reject(new Error('geocoder crashed')),
        },
        () => {
          updates += 1;
        },
      );
      for (let i = 0; i < 5; i += 1) await new Promise<void>((r) => setImmediate(r));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    assert.equal(updates, 0);
    assert.deepEqual(unhandled, []);
  });
});
