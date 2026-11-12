import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toastLayer } from './toastLayer';

describe('toastLayer (App toast overlay above every screen)', () => {
  it('never takes touches', () => {
    assert.equal(toastLayer.pointerEvents, 'none');
  });

  it('covers the whole screen and puts the toast at the bottom', () => {
    assert.deepEqual(toastLayer.style, {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'flex-end',
      alignItems: 'center',
    });
  });
});
