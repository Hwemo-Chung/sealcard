import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createPlaceLabelLookup,
  geocoderLanguage,
  placeSources,
  type LocalizedGeocoder,
  type LocationApi,
} from './placeSources';

/** expo-location stand-in that records how each call was made. */
function fakeApi(status = 'granted') {
  const calls: { fn: string; arg?: unknown }[] = [];
  const api: LocationApi = {
    requestForegroundPermissionsAsync: async () => {
      calls.push({ fn: 'request' });
      return { status };
    },
    getForegroundPermissionsAsync: async () => {
      calls.push({ fn: 'get' });
      return { status };
    },
    getCurrentPositionAsync: async (options) => {
      calls.push({ fn: 'current', arg: options });
      return { coords: { latitude: 1, longitude: 2, accuracy: 5 } };
    },
    getLastKnownPositionAsync: async (options) => {
      calls.push({ fn: 'lastKnown', arg: options });
      return { coords: { latitude: 3, longitude: 4, altitude: 9 } };
    },
    reverseGeocodeAsync: async (location) => {
      calls.push({ fn: 'geocode', arg: location });
      return [{ city: 'Seoul' }];
    },
  };
  return { api, calls };
}

describe('placeSources (expo-location wiring for the place lookup)', () => {
  it('accepts a last known position no older than 600000 ms (10 min)', async () => {
    const { api, calls } = fakeApi();
    const coords = await placeSources(api, { accuracy: 3, prompt: true }).lastKnownFix();
    assert.deepEqual(calls, [{ fn: 'lastKnown', arg: { maxAge: 600000 } }]);
    assert.deepEqual(coords, { latitude: 3, longitude: 4 });
  });

  it('returns null when there is no recent enough last known position', async () => {
    const { api } = fakeApi();
    api.getLastKnownPositionAsync = async () => null;
    assert.equal(await placeSources(api, { accuracy: 3, prompt: true }).lastKnownFix(), null);
  });

  it('requests a fresh fix at the given accuracy', async () => {
    const { api, calls } = fakeApi();
    const coords = await placeSources(api, { accuracy: 3, prompt: true }).currentFix();
    assert.deepEqual(calls, [{ fn: 'current', arg: { accuracy: 3 } }]);
    assert.deepEqual(coords, { latitude: 1, longitude: 2 });
  });

  it('shows the permission dialog only when asked to (restarts only read the state)', async () => {
    const prompting = fakeApi();
    assert.equal(await placeSources(prompting.api, { accuracy: 3, prompt: true }).permission?.(), true);
    assert.deepEqual(prompting.calls, [{ fn: 'request' }]);

    const silent = fakeApi();
    assert.equal(await placeSources(silent.api, { accuracy: 3, prompt: false }).permission?.(), true);
    assert.deepEqual(silent.calls, [{ fn: 'get' }]);
  });

  it('treats any status but granted as no permission', async () => {
    const { api } = fakeApi('denied');
    assert.equal(await placeSources(api, { accuracy: 3, prompt: false }).permission?.(), false);
  });

  it('reverse-geocodes latitude and longitude only', async () => {
    const { api, calls } = fakeApi();
    const fix = { latitude: 5, longitude: 6, altitude: 7 };
    const places = await placeSources(api, { accuracy: 3, prompt: true }).reverseGeocode(fix);
    assert.deepEqual(calls, [{ fn: 'geocode', arg: { latitude: 5, longitude: 6 } }]);
    assert.deepEqual(places, [{ city: 'Seoul' }]);
  });
});

describe('place label language (follows the app UI language, not the device locale)', () => {
  function localized(parts: Record<string, { city: string; district: string }>) {
    const calls: { coords: unknown; language: string }[] = [];
    const geocode: LocalizedGeocoder = async (coords, language) => {
      calls.push({ coords, language });
      const p = parts[language];
      return p ? [p] : [];
    };
    return { geocode, calls };
  }

  it('geocodes through the localized geocoder in the app language', async () => {
    const { api, calls } = fakeApi();
    const loc = localized({ ko: { city: '에도가와구', district: '3초메' } });
    const src = placeSources(api, {
      accuracy: 3,
      prompt: true,
      language: () => 'ko',
      localized: loc.geocode,
    });
    assert.deepEqual(await src.reverseGeocode({ latitude: 35.7, longitude: 139.8 }), [
      { city: '에도가와구', district: '3초메' },
    ]);
    assert.deepEqual(loc.calls, [{ coords: { latitude: 35.7, longitude: 139.8 }, language: 'ko' }]);
    assert.deepEqual(calls, [], 'expo-location (device locale) is not used');
  });

  it('reads the app language when it geocodes, not when the lookup was set up', async () => {
    const { api } = fakeApi();
    const loc = localized({});
    let language = 'en';
    const src = placeSources(api, {
      accuracy: 3,
      prompt: true,
      language: () => language,
      localized: loc.geocode,
    });
    await src.reverseGeocode({ latitude: 1, longitude: 2 });
    language = 'ja';
    await src.reverseGeocode({ latitude: 1, longitude: 2 });
    assert.deepEqual(
      loc.calls.map((c) => c.language),
      ['en', 'ja'],
    );
  });

  it('falls back to expo-location when the localized geocoder is not in this build', async () => {
    const { api, calls } = fakeApi();
    const src = placeSources(api, { accuracy: 3, prompt: true, language: () => 'ko', localized: null });
    assert.deepEqual(await src.reverseGeocode({ latitude: 1, longitude: 2 }), [{ city: 'Seoul' }]);
    assert.deepEqual(calls, [{ fn: 'geocode', arg: { latitude: 1, longitude: 2 } }]);
  });

  it('falls back to expo-location when the localized geocoder fails', async () => {
    const { api, calls } = fakeApi();
    const src = placeSources(api, {
      accuracy: 3,
      prompt: true,
      language: () => 'ko',
      localized: async () => {
        throw new Error('Geocoder IOException');
      },
    });
    assert.deepEqual(await src.reverseGeocode({ latitude: 1, longitude: 2 }), [{ city: 'Seoul' }]);
    assert.deepEqual(calls, [{ fn: 'geocode', arg: { latitude: 1, longitude: 2 } }]);
  });

  it('falls back to expo-location when the localized geocoder or the language read throws synchronously', async () => {
    const throwing = fakeApi();
    const src = placeSources(throwing.api, {
      accuracy: 3,
      prompt: true,
      language: () => 'ko',
      localized: () => {
        throw new Error('native method missing'); // throws before returning a promise
      },
    });
    assert.deepEqual(await src.reverseGeocode({ latitude: 1, longitude: 2 }), [{ city: 'Seoul' }]);
    assert.deepEqual(throwing.calls, [{ fn: 'geocode', arg: { latitude: 1, longitude: 2 } }]);

    const badLocale = fakeApi();
    const viaLocale = placeSources(badLocale.api, {
      accuracy: 3,
      prompt: true,
      language: () => {
        throw new Error('i18n not ready');
      },
      localized: async () => [{ city: 'never' }],
    });
    assert.deepEqual(await viaLocale.reverseGeocode({ latitude: 1, longitude: 2 }), [{ city: 'Seoul' }]);
  });

  it('maps the app locale to the geocoder language (ko, ja, en; anything else en)', () => {
    assert.equal(geocoderLanguage('ko'), 'ko');
    assert.equal(geocoderLanguage('ja'), 'ja');
    assert.equal(geocoderLanguage('en'), 'en');
    assert.equal(geocoderLanguage('fr'), 'en');
  });
});

describe('createPlaceLabelLookup (camera lookup wiring: locationLabel.ts binds expo-location)', () => {
  it('a restart (prompt false) only reads the permission; the first start asks', async () => {
    const silent = fakeApi();
    await createPlaceLabelLookup(silent.api, { accuracy: 3, language: () => 'ko', localized: null })(false)
      .label;
    assert.ok(silent.calls.some((c) => c.fn === 'get'));
    assert.ok(!silent.calls.some((c) => c.fn === 'request'));

    const asking = fakeApi();
    await createPlaceLabelLookup(asking.api, { accuracy: 3, language: () => 'ko', localized: null })(true)
      .label;
    assert.ok(asking.calls.some((c) => c.fn === 'request'));
  });

  it('labels the place in the app language end to end', async () => {
    const { api } = fakeApi();
    const label = await createPlaceLabelLookup(api, {
      accuracy: 3,
      language: () => 'ja',
      localized: async (_c, language) =>
        language === 'ja' ? [{ city: '江戸川区', district: '三丁目' }] : [{ city: 'Edogawa City', district: '3-chōme' }],
    })(true).label;
    assert.equal(label, '江戸川区 · 三丁目');
  });
});
