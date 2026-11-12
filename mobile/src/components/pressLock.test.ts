import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pressLock } from './pressLock';

describe('pressLock (chips, binder rows and retake are locked while busy)', () => {
  it('disables the control and ignores presses while busy', () => {
    let presses = 0;
    const props = pressLock(true, () => {
      presses += 1;
    });
    assert.equal(props.disabled, true);
    props.onPress();
    assert.equal(presses, 0);
  });

  it('enables the control and forwards presses when idle', () => {
    let presses = 0;
    const props = pressLock(false, () => {
      presses += 1;
    });
    assert.equal(props.disabled, false);
    props.onPress();
    assert.equal(presses, 1);
  });
});
