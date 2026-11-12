import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onHardwareBack, resolveBack } from './back';
import type { RootScreen } from './types';

const capture = {
  photoUri: 'file:///cache/photo.jpg',
  templateId: 'polaroid',
  dateFormatId: 'dot',
  sealedAtIso: '2026-11-11T00:00:00.000Z',
  showDate: true,
  locationLabel: 'Seoul',
  showBinderName: true,
} as const;

describe('resolveBack (Android hardware back)', () => {
  it('lets the OS handle back on the root binder list', () => {
    assert.deepEqual(resolveBack({ name: 'binders' }), { type: 'exit' });
  });

  it('returns to the binder list from binder detail', () => {
    assert.deepEqual(resolveBack({ name: 'binderDetail', binderId: 'b1' }), {
      type: 'navigate',
      to: { name: 'binders' },
      reloadSettings: false,
    });
  });

  it('returns to the originating binder from card detail', () => {
    assert.deepEqual(
      resolveBack({ name: 'cardDetail', cardId: 'c1', fromBinderId: 'b1' }),
      { type: 'navigate', to: { name: 'binderDetail', binderId: 'b1' }, reloadSettings: false },
    );
  });

  it('returns to uncategorized when card detail has no binder context', () => {
    assert.deepEqual(resolveBack({ name: 'cardDetail', cardId: 'c1' }), {
      type: 'navigate',
      to: { name: 'binderDetail', binderId: null },
      reloadSettings: false,
    });
  });

  it('closes the camera to the binder list', () => {
    assert.deepEqual(resolveBack({ name: 'sealCamera' }), {
      type: 'navigate',
      to: { name: 'binders' },
      reloadSettings: false,
    });
  });

  it('goes from seal preview back to the camera (retake)', () => {
    assert.deepEqual(resolveBack({ name: 'sealPreview', ...capture }), {
      type: 'navigate',
      to: { name: 'sealCamera' },
      reloadSettings: false,
    });
  });

  it('goes from binder picker back to seal preview with the same capture', () => {
    const screen: RootScreen = {
      name: 'pickBinder',
      ...capture,
      compositeUri: 'file:///cache/composite.jpg',
      width: 300,
      height: 380,
    };
    assert.deepEqual(resolveBack(screen), {
      type: 'navigate',
      to: { name: 'sealPreview', ...capture },
      reloadSettings: false,
    });
  });

  it('leaves settings to the binder list and reloads settings like the on-screen back', () => {
    assert.deepEqual(resolveBack({ name: 'settings' }), {
      type: 'navigate',
      to: { name: 'binders' },
      reloadSettings: true,
    });
  });
});

describe('resolveBack while a seal is being saved', () => {
  const picker: RootScreen = {
    name: 'pickBinder',
    ...capture,
    compositeUri: 'file:///cache/composite.jpg',
    width: 300,
    height: 380,
  };

  it('swallows back on the binder picker while the seal is saving (no navigation)', () => {
    assert.deepEqual(resolveBack(picker, { busy: true }), { type: 'consume' });
  });

  it('returns to the preview when the binder picker is idle', () => {
    assert.deepEqual(resolveBack(picker, { busy: false }), {
      type: 'navigate',
      to: { name: 'sealPreview', ...capture },
      reloadSettings: false,
    });
  });

  it('does not change back on other screens', () => {
    assert.deepEqual(resolveBack({ name: 'binders' }, { busy: true }), { type: 'exit' });
    assert.deepEqual(resolveBack({ name: 'settings' }, { busy: true }), {
      type: 'navigate',
      to: { name: 'binders' },
      reloadSettings: true,
    });
  });

  it('leaves to the binder list (like Cancel) once the save stalled, never to the preview', () => {
    // Re-confirming the same capture from the preview would mount a new picker whose
    // Done could seal it a second time while the stalled save may still land.
    assert.deepEqual(resolveBack(picker, { stalled: true }), {
      type: 'navigate',
      to: { name: 'binders' },
      reloadSettings: false,
    });
  });
});

describe('onHardwareBack (App hardwareBackPress listener)', () => {
  const picker: RootScreen = {
    name: 'pickBinder',
    ...capture,
    compositeUri: 'file:///cache/composite.jpg',
    width: 300,
    height: 380,
  };

  function effects() {
    const calls = { navigate: [] as RootScreen[], reloads: 0 };
    return {
      calls,
      fx: {
        navigate: (to: RootScreen) => calls.navigate.push(to),
        reloadSettings: () => {
          calls.reloads += 1;
        },
      },
    };
  }

  it('swallows back on the picker while the seal is saving', () => {
    const { calls, fx } = effects();
    assert.equal(onHardwareBack(picker, 'saving', fx), true, 'handled: the OS must not exit');
    assert.deepEqual(calls, { navigate: [], reloads: 0 });
  });

  it('goes to the binder list from a stalled save', () => {
    const { calls, fx } = effects();
    assert.equal(onHardwareBack(picker, 'stalled', fx), true);
    assert.deepEqual(calls.navigate, [{ name: 'binders' }]);
  });

  it('returns to the preview from an idle picker', () => {
    const { calls, fx } = effects();
    assert.equal(onHardwareBack(picker, 'idle', fx), true);
    assert.deepEqual(calls.navigate, [{ name: 'sealPreview', ...capture }]);
  });

  it('lets the OS handle back on the root list', () => {
    const { calls, fx } = effects();
    assert.equal(onHardwareBack({ name: 'binders' }, 'idle', fx), false);
    assert.deepEqual(calls, { navigate: [], reloads: 0 });
  });

  it('reloads settings when leaving settings', () => {
    const { calls, fx } = effects();
    assert.equal(onHardwareBack({ name: 'settings' }, 'idle', fx), true);
    assert.deepEqual(calls, { navigate: [{ name: 'binders' }], reloads: 1 });
  });
});
