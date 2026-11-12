import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS, type Settings } from '../domain/types';
import { bootSettings, refreshSettings } from './settingsLoad';

const stored: Settings = { ...DEFAULT_SETTINGS, locale: 'ja', showLocation: true };

describe('bootSettings (App start)', () => {
  it('uses the stored settings', async () => {
    assert.deepEqual(await bootSettings(async () => stored), stored);
  });

  it('starts with defaults when storage cannot be read (never stuck on the boot screen)', async () => {
    assert.deepEqual(
      await bootSettings(() => Promise.reject(new Error('storage unavailable'))),
      DEFAULT_SETTINGS,
    );
    assert.deepEqual(
      await bootSettings(() => {
        throw new Error('module missing');
      }),
      DEFAULT_SETTINGS,
    );
  });

  it('returns a fresh defaults object each time', async () => {
    const a = await bootSettings(() => Promise.reject(new Error('x')));
    a.showDate = false;
    assert.equal((await bootSettings(() => Promise.reject(new Error('x')))).showDate, DEFAULT_SETTINGS.showDate);
  });
});

describe('refreshSettings (leaving Settings)', () => {
  it('applies the stored settings', async () => {
    const applied: Settings[] = [];
    await refreshSettings(async () => stored, (s) => applied.push(s));
    assert.deepEqual(applied, [stored]);
  });

  it('keeps the settings in memory when the read fails, without rejecting', async () => {
    const applied: Settings[] = [];
    await refreshSettings(() => Promise.reject(new Error('storage unavailable')), (s) => applied.push(s));
    assert.deepEqual(applied, []);
  });
});
